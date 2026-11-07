'use client';
/**
 * CustomerProfile — the FULL-page customer profile (8 tabs).
 *
 * Restored design (upload/Contacts_extracted/Contacts/customer profile.html):
 *   ┌─ Top action bar: ← Customers | Edit ▾ | New transaction ▾ ┐
 *   ├─ Profile card: avatar | name + contact grid | financial summary ┤
 *   ├─ 8 tabs: Transaction List · Activity Feed · Statements ·
 *   │          Recurring Transactions · Customer Details · Late Fees ·
 *   │          Notes · Tasks (New badge)
 *   └─ Tab pane below.
 *
 * Backed by Supabase via /api/crm/customers/[id] (useCrmCustomer hook).
 * Notes + Tasks tabs read/write live to crm_notes / crm_tasks.
 */
import { useState } from 'react';
import {
  useCrmCustomer,
  useCrmMutations,
  type CrmCustomer,
} from '@/hooks/useCrmApi';

type Tab = 'transactions' | 'activity' | 'statements' | 'recurring' | 'details' | 'latefees' | 'notes' | 'tasks';

const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function initials(first: string | null, last: string | null, company: string | null) {
  const a = first?.[0] || '';
  const b = last?.[0] || '';
  if (a || b) return (a + b).toUpperCase();
  return (company?.[0] || '?').toUpperCase();
}
function fullName(c: CrmCustomer) {
  if (c.first_name && c.last_name) return `${c.first_name} ${c.last_name}`;
  return c.first_name || c.company_name || c.email || 'Unnamed customer';
}
function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TABS: { id: Tab; label: string; badge?: string }[] = [
  { id: 'transactions', label: 'Transaction List' },
  { id: 'activity', label: 'Activity Feed' },
  { id: 'statements', label: 'Statements' },
  { id: 'recurring', label: 'Recurring Transactions' },
  { id: 'details', label: 'Customer Details' },
  { id: 'latefees', label: 'Late Fees' },
  { id: 'notes', label: 'Notes' },
  { id: 'tasks', label: 'Tasks', badge: 'New' },
];

const TXN_MENU = [
  'Invoice',
  'Payment',
  'Recurring payment',
  'Estimate',
  'Payment Link',
  'Sales Receipt',
  'Credit memo',
  'Statement',
];

interface CustomerProfileProps {
  customerId: string;
  onToast: (m: string) => void;
  onBack: () => void;
  onNavigate?: (d: string, s: string) => void;
  onCreate?: (label: string, prefill?: { customerName?: string; customerId?: string }) => void;
}

export default function CustomerProfile({ customerId, onToast, onBack, onCreate }: CustomerProfileProps) {
  const { data: customer, loaded, refresh } = useCrmCustomer(customerId);
  const [tab, setTab] = useState<Tab>('transactions');
  const [txnMenuOpen, setTxnMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const { updateCustomer, archiveCustomer, createNote, createTask } = useCrmMutations(onToast);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');

  // Edit-form state
  const [edit, setEdit] = useState({
    first_name: '', last_name: '', company_name: '', email: '', phone: '',
    address_line1: '', city: '', state: '', postal_code: '', country: 'US',
  });

  if (!loaded && !customer) {
    return (
      <main className="px-6 pb-12 flex flex-col h-full">
        <div className="flex items-center py-4">
          <button className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline" onClick={onBack}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>Customers
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-[32px] mr-2">progress_activity</span>
          Loading customer…
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="px-6 pb-12 flex flex-col h-full">
        <div className="flex items-center py-4">
          <button className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline" onClick={onBack}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>Customers
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-on-surface-variant">
          Customer not found.
        </div>
      </main>
    );
  }

  const openEdit = () => {
    setEdit({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      company_name: customer.company_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      city: customer.city || '',
      state: customer.state || '',
      postal_code: customer.postal_code || '',
      country: customer.country || 'US',
    });
    setEditOpen(true);
  };

  async function handleSaveEdit() {
    try {
      await updateCustomer(customerId, {
        first_name: edit.first_name || null,
        last_name: edit.last_name || null,
        company_name: edit.company_name || null,
        email: edit.email || null,
        phone: edit.phone || null,
        address_line1: edit.address_line1 || null,
        city: edit.city || null,
        state: edit.state || null,
        postal_code: edit.postal_code || null,
        country: edit.country || 'US',
      });
      setEditOpen(false);
      refresh();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleStageChange(stage: string) {
    try {
      await updateCustomer(customerId, { lifecycle_stage: stage });
      refresh();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleArchive() {
    try {
      await archiveCustomer(customerId);
      onBack();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    try {
      await createNote({ customer_id: customerId, body: noteBody, note_type: 'general' });
      onToast('Note added');
      setNoteBody('');
      refresh();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    try {
      await createTask({
        customer_id: customerId,
        title: taskTitle,
        task_type: 'follow_up',
        priority: taskPriority,
        status: 'open',
        due_at: taskDue || null,
      });
      onToast('Task created');
      setTaskTitle('');
      setTaskDue('');
      setTaskPriority('medium');
      setTaskDrawerOpen(false);
      refresh();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  function handleNewTxn(label: string) {
    setTxnMenuOpen(false);
    if (onCreate) {
      onCreate(label, { customerName: fullName(customer), customerId: customer.id });
    } else {
      onToast(`New ${label} for ${fullName(customer)}`);
    }
  }

  const notes = customer.notes || [];
  const tasks = customer.tasks || [];
  const activity = customer.activity || [];
  const segments = customer.segments || [];
  const openTaskCount = tasks.filter(t => t.status !== 'done' && t.status !== 'closed').length;
  const openBalance = customer.outstanding_balance || 0;
  const overdue = 0; // Supabase doesn't expose overdue yet — surface 0 honestly

  return (
    <main className="flex flex-col h-full overflow-hidden bg-background">
      {/* ═══ TOP ACTION BAR ═══ */}
      <header className="h-14 px-6 flex items-center justify-between bg-white border-b border-surface-dim shrink-0">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline" onClick={onBack}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>Customers
          </button>
          <span className="text-on-surface-variant text-[12px]">/ {fullName(customer)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex">
            <button className="h-8 px-3 border border-surface-dim rounded-l bg-white text-[13px] font-semibold hover:bg-surface-container" onClick={openEdit}>Edit</button>
            <button className="h-8 px-1.5 border border-l-0 border-surface-dim rounded-r bg-white hover:bg-surface-container" onClick={openEdit}>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>
          <div className="relative">
            <div className="flex">
              <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={() => handleNewTxn('Invoice')}>
                New transaction
              </button>
              <button className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container" onClick={e => { e.stopPropagation(); setTxnMenuOpen(v => !v); }}>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            {txnMenuOpen && (
              <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">New transaction</div>
                {TXN_MENU.map(label => (
                  <button key={label} onClick={() => handleNewTxn(label)}>
                    <span className="material-symbols-outlined">{label.includes('Invoice') ? 'receipt_long' : label.includes('Estimate') ? 'request_quote' : label.includes('Payment') || label.includes('Receipt') ? 'payments' : label.includes('Credit') ? 'credit_card' : 'description'}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── PROFILE CARD ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-6 flex gap-6 mb-4">
          {/* Avatar + name */}
          <div className="w-1/4 flex flex-col items-center justify-center text-center border-r border-surface-dim pr-6">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-2xl font-bold text-on-surface-variant mb-3">
              {initials(customer.first_name, customer.last_name, customer.company_name)}
            </div>
            <h1 className="text-[22px] font-semibold mb-1">{fullName(customer)}</h1>
            {customer.company_name ? (
              <div className="text-[12px] text-on-surface-variant mb-3">{customer.company_name}</div>
            ) : (
              <a href="#" className="text-[12px] text-primary hover:underline mb-3" onClick={e => { e.preventDefault(); openEdit(); }}>Add company name</a>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className={`pill role ${customer.lifecycle_stage === 'vip' ? 'vendor' : customer.lifecycle_stage === 'new_customer' ? 'customer' : customer.lifecycle_stage === 'lead' ? 'lead' : 'contact'}`}>{customer.lifecycle_stage}</span>
              <span className="pill tag">{customer.customer_type}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Create note" onClick={() => setTab('notes')}><span className="material-symbols-outlined text-[18px]">edit_note</span></button>
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high" title="Create task" onClick={() => setTaskDrawerOpen(true)}><span className="material-symbols-outlined text-[18px]">task_alt</span></button>
            </div>
          </div>

          {/* Contact grid */}
          <div className="flex-1 grid grid-cols-2 gap-6 text-[13px]">
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Email</div>
                {customer.email ? <a href={`mailto:${customer.email}`} className="text-primary hover:underline">{customer.email}</a> : <button className="text-primary hover:underline" onClick={openEdit}>Add email</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Billing address</div>
                {[customer.address_line1, customer.city, customer.state, customer.postal_code, customer.country].filter(Boolean).join(', ') || <button className="text-primary hover:underline" onClick={openEdit}>Add billing address</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Notes</div>
                {notes.length > 0 ? <span className="text-on-surface">{notes.length} note{notes.length === 1 ? '' : 's'}</span> : <button className="text-primary hover:underline" onClick={() => setTab('notes')}>Add notes</button>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Phone</div>
                {customer.phone ? <span>{customer.phone}</span> : <button className="text-primary hover:underline" onClick={openEdit}>Add phone number</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Shipping address</div>
                <button className="text-primary hover:underline" onClick={openEdit}>Add shipping address</button>
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Custom Fields</div>
                <button className="mt-1 text-on-surface-variant hover:text-on-surface" onClick={openEdit}><span className="material-symbols-outlined text-[18px]">edit</span></button>
              </div>
            </div>
          </div>

          {/* Financial summary */}
          <div className="w-64 shrink-0 bg-[#eef5fa] rounded-lg p-4">
            <h3 className="font-semibold text-[14px] mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-primary">account_balance_wallet</span>Financial summary</h3>
            <div className="mb-4">
              <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className={`w-2 h-2 rounded-full ${openBalance > 0 ? 'bg-yellow-400' : 'bg-green-500'}`}></span>Open Balance</div>
              <div className="text-[20px] font-semibold text-on-surface">{money(openBalance)}</div>
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className="w-2 h-2 rounded-full bg-error"></span>Overdue payment</div>
              <div className="text-[20px] font-semibold text-on-surface">{money(overdue)}</div>
            </div>
            <div className="mb-4">
              <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className="w-2 h-2 rounded-full bg-secondary"></span>Lifetime value</div>
              <div className="text-[20px] font-semibold text-on-surface">{money(customer.lifetime_value || 0)}</div>
            </div>
            <div className="pt-3 border-t border-surface-dim grid grid-cols-2 gap-2 text-[12px]">
              <div><div className="text-on-surface-variant">Visits</div><div className="font-semibold">{customer.total_visits || 0}</div></div>
              <div><div className="text-on-surface-variant">30d spend</div><div className="font-semibold">{money(customer.total_spend_30d || 0)}</div></div>
              <div><div className="text-on-surface-variant">Last activity</div><div className="font-semibold">{customer.last_activity_at ? `${daysSince(customer.last_activity_at)}d ago` : '—'}</div></div>
              <div><div className="text-on-surface-variant">Added</div><div className="font-semibold">{fmtDate(customer.created_at)}</div></div>
            </div>
          </div>
        </div>

        {/* ── LIFECYCLE STAGE CHANGER ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="text-[12px] text-on-surface-variant uppercase font-bold">Lifecycle stage</div>
          <div className="flex gap-2">
            {['lead', 'new_customer', 'active', 'vip'].map(stage => (
              <button key={stage} className={`h-7 px-3 rounded text-label-sm border ${customer.lifecycle_stage === stage ? 'bg-primary text-white border-primary' : 'border-surface-dim hover:bg-surface-container-low'}`} onClick={() => handleStageChange(stage)}>
                {stage.replace('_', ' ')}
              </button>
            ))}
          </div>
          {segments.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-[12px] text-on-surface-variant">
              <span>Segments:</span>
              {segments.map(s => <span key={s} className="pill tag">{s}</span>)}
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div className="border-b border-surface-dim mb-4 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {TABS.map(t => (
              <button key={t.id} className={`pb-3 text-[14px] tab-underline ${tab === t.id ? 'active' : 'text-on-surface-variant hover:text-on-surface'} flex items-center gap-2`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.badge && <span className="bg-[#d81b60] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">{t.badge}</span>}
                {t.id === 'tasks' && openTaskCount > 0 && <span className="text-[11px] text-on-surface-variant">({openTaskCount})</span>}
                {t.id === 'notes' && notes.length > 0 && <span className="text-[11px] text-on-surface-variant">({notes.length})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ TAB PANES ═══ */}

        {/* 1. Transaction List */}
        {tab === 'transactions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button className="h-8 px-3 border border-surface-dim rounded text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container">Batch actions</button>
                <select className="h-8 px-3 border border-surface-dim rounded text-[13px] bg-white">
                  <option>All transactions</option><option>Invoices</option><option>Estimates</option><option>Credit memos</option><option>Sales Receipts</option><option>Money received</option>
                </select>
                <select className="h-8 px-3 border border-surface-dim rounded text-[13px] bg-white"><option>All</option><option>Open</option><option>Overdue</option><option>Paid</option></select>
                <select className="h-8 px-3 border border-surface-dim rounded text-[13px] bg-white"><option>All</option><option>This month</option><option>Last month</option></select>
              </div>
              <div className="flex items-center gap-1">
                <button className="icon-btn" title="Print" onClick={() => onToast('Printing transaction list…')}><span className="material-symbols-outlined text-[18px]">print</span></button>
                <button className="icon-btn" title="Export" onClick={() => onToast('Exporting to CSV…')}><span className="material-symbols-outlined text-[18px]">download</span></button>
                <button className="icon-btn" title="More actions" onClick={() => onToast('More actions…')}><span className="material-symbols-outlined text-[18px]">more_vert</span></button>
              </div>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              <table className="data-table">
                <thead><tr>
                  <th className="w-8"><input type="checkbox" className="accent-primary" /></th>
                  <th>Date <span className="material-symbols-outlined text-[12px] align-middle">arrow_drop_down</span></th>
                  <th>Type</th><th>No.</th><th>Customer</th><th>Memo</th>
                  <th className="text-right">Amount</th><th>Status</th><th className="text-right">Action</th>
                </tr></thead>
                <tbody>
                  <tr><td colSpan={9} className="text-center py-10 text-on-surface-variant">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[40px] text-outline-variant">receipt_long</span>
                      <div className="font-semibold text-[14px] text-on-surface">No transactions yet</div>
                      <div className="text-[12px]">Create one with “New transaction” above.</div>
                      <button className="mt-2 h-8 px-3 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container" onClick={() => handleNewTxn('Invoice')}>Create invoice</button>
                    </div>
                  </td></tr>
                </tbody>
                <tfoot><tr className="bg-surface-container-low font-semibold"><td colSpan={6} className="text-right">Total</td><td className="text-right tabular-nums">{money(0)}</td><td colSpan={2}></td></tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 2. Activity Feed */}
        {tab === 'activity' && (
          <div className="bg-white border border-surface-dim rounded-xl p-8 flex items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Keep track of every interaction</h2>
              <p className="text-body-md text-on-surface-variant mb-6 max-w-lg">Strengthen your connection with {fullName(customer)}. Add a note, task, or review recent activity — new activities will appear here from now on.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-surface-dim rounded-lg p-4">
                  <div className="material-symbols-outlined text-[24px] text-on-surface-variant mb-2">edit_note</div>
                  <h3 className="font-semibold text-[14px] mb-1">Create a note</h3>
                  <p className="text-[12px] text-on-surface-variant mb-4">Capture important details. Add your first note to keep customer info handy.</p>
                  <button className="w-full h-8 border border-surface-dim rounded text-[12px] font-semibold hover:bg-surface-container" onClick={() => setTab('notes')}>Add note</button>
                </div>
                <div className="border border-surface-dim rounded-lg p-4">
                  <div className="material-symbols-outlined text-[24px] text-on-surface-variant mb-2">task_alt</div>
                  <h3 className="font-semibold text-[14px] mb-1">Assign a task</h3>
                  <p className="text-[12px] text-on-surface-variant mb-4">Stay organized. Create a task to track your work and never miss a step.</p>
                  <button className="w-full h-8 border border-surface-dim rounded text-[12px] font-semibold hover:bg-surface-container" onClick={() => setTaskDrawerOpen(true)}>Add task</button>
                </div>
              </div>
              {activity.length > 0 && (
                <div className="mt-6 border-t border-surface-dim pt-4">
                  <h3 className="font-semibold text-[14px] mb-2">Recent activity ({activity.length})</h3>
                  <div className="space-y-2">
                    {activity.slice(0, 10).map(a => (
                      <div key={a.id} className="text-[12px] flex items-center gap-2 py-1">
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">history</span>
                        <span className="font-medium text-on-surface">{a.activity_type}</span>
                        {a.description && <span className="text-on-surface-variant">— {a.description}</span>}
                        <span className="ml-auto text-on-surface-variant">{fmtDate(a.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="w-64 h-64 shrink-0 bg-surface-container-low rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[80px] text-outline">support_agent</span>
            </div>
          </div>
        )}

        {/* 3. Statements */}
        {tab === 'statements' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button className="h-8 px-3 border border-surface-dim rounded text-[13px] font-semibold text-on-surface-variant hover:bg-surface-container">Batch actions</button>
              <select className="h-8 px-3 border border-surface-dim rounded text-[13px] bg-white"><option>Last 12 months</option><option>This year</option></select>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              <table className="data-table">
                <thead><tr><th className="w-8"><input type="checkbox" className="accent-primary" /></th><th>Date</th><th>No.</th><th>Customer</th><th>Start Date</th><th>End Date</th><th>Statement Type</th><th className="text-right">Action</th></tr></thead>
                <tbody><tr><td colSpan={8} className="text-center py-8 text-on-surface-variant">No matching statements found.</td></tr></tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Recurring Transactions */}
        {tab === 'recurring' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2 top-1.5 text-[18px] text-outline">search</span>
                <input className="h-8 pl-8 pr-2 border border-surface-dim rounded text-[13px] w-64 focus:outline-none focus:border-primary" placeholder="Search by template name" />
              </div>
              <div className="flex items-center gap-3">
                <a href="#" className="text-[13px] text-primary hover:underline">Manage recurring payments</a>
                <div className="flex">
                  <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={() => handleNewTxn('Recurring payment')}><span className="material-symbols-outlined text-[16px]">add</span>New template</button>
                  <button className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container"><span className="material-symbols-outlined text-[16px]">expand_more</span></button>
                </div>
              </div>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Txn Type</th><th>Interval</th><th>Previous Date</th><th>Next Date</th><th className="text-right">Amount</th><th className="text-right">Action</th></tr></thead>
                <tbody><tr><td colSpan={8} className="text-center py-8 text-on-surface-variant">No matching recurring transactions found.</td></tr></tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Customer Details */}
        {tab === 'details' && (
          <div className="grid grid-cols-2 gap-8 text-[13px]">
            <div>
              <h3 className="font-semibold text-[14px] mb-3">Contact info</h3>
              <table className="w-full">
                {[
                  ['Customer', fullName(customer)],
                  ['Company', customer.company_name || '—'],
                  ['Customer type', customer.customer_type],
                  ['Email', customer.email || '—'],
                  ['Phone', customer.phone || '—'],
                  ['Country', customer.country],
                  ['Notes', notes.length > 0 ? `${notes.length} note(s)` : '—'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                ))}
              </table>
              <h3 className="font-semibold text-[14px] mt-6 mb-3">Attachments</h3>
              <div className="text-on-surface-variant">None</div>
            </div>
            <div>
              <h3 className="font-semibold text-[14px] mb-3">Additional info</h3>
              <table className="w-full">
                {[
                  ['Billing address', [customer.address_line1, customer.city, customer.state, customer.postal_code].filter(Boolean).join(', ') || '—'],
                  ['Shipping address', 'See all addresses'],
                  ['City', customer.city || '—'],
                  ['State', customer.state || '—'],
                  ['Postal code', customer.postal_code || '—'],
                  ['Lifecycle stage', customer.lifecycle_stage],
                  ['Lifecycle status', customer.lifecycle_status],
                  ['Last activity', customer.last_activity_at ? fmtDate(customer.last_activity_at) : '—'],
                  ['Added', fmtDate(customer.created_at)],
                  ['Updated', fmtDate(customer.updated_at)],
                  ['Segments', segments.length > 0 ? segments.join(', ') : '—'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2">{v === 'See all addresses' ? <a href="#" className="text-primary hover:underline">{v}</a> : v}</td></tr>
                ))}
              </table>
            </div>
          </div>
        )}

        {/* 6. Late Fees */}
        {tab === 'latefees' && (
          <div className="border border-surface-dim rounded-lg p-6 bg-white text-[13px]">
            To apply late fees, you&apos;ll first need to turn them on at a company level under <a href="#" className="font-semibold underline text-on-surface">Account and Settings</a>.
          </div>
        )}

        {/* 7. Notes */}
        {tab === 'notes' && (
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-surface-dim pb-2">
              <div className="text-[13px] text-on-surface-variant">{notes.length} note(s)</div>
              <button className="text-[13px] font-semibold text-primary hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">add</span>Add note</button>
            </div>
            {notes.length === 0 ? (
              <div className="empty-state mt-12">
                <span className="material-symbols-outlined">folder_open</span>
                <div className="font-semibold text-[14px] text-on-surface mt-4">No notes yet</div>
                <div className="text-[12px] text-on-surface-variant mt-1">Notes you add will appear here.</div>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {notes.map(n => (
                  <div key={n.id} className="bg-white border border-surface-dim rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="pill tag">{n.note_type || 'general'}</span>
                      <span className="text-[11px] text-on-surface-variant">{fmtDate(n.created_at)}</span>
                    </div>
                    <div className="text-[13px]">{n.body}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white border border-surface-dim rounded-lg p-4 flex gap-2">
              <input className="field-input flex-1" placeholder="Add a note…" value={noteBody} onChange={e => setNoteBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }} />
              <button className="h-8 px-4 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container" onClick={handleAddNote}>Add note</button>
            </div>
          </div>
        )}

        {/* 8. Tasks */}
        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] text-on-surface-variant">{tasks.length} task(s) · {openTaskCount} open</div>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 border border-surface-dim rounded text-[13px] font-semibold hover:bg-surface-container flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">filter_list</span>Filter</button>
                <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded hover:bg-primary-container flex items-center gap-1" onClick={() => setTaskDrawerOpen(true)}><span className="material-symbols-outlined text-[16px]">add</span>Add task</button>
              </div>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              {tasks.length === 0 ? (
                <table className="data-table">
                  <thead><tr><th>Task</th><th>Priority</th><th>Assigned To</th><th>Due Date</th><th className="text-right">Actions</th></tr></thead>
                  <tbody><tr><td colSpan={5} className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#8af5be] text-[#00714b] mb-2"><span className="material-symbols-outlined text-[20px]">check</span></div>
                    <h3 className="font-semibold text-[14px] text-on-surface">You&apos;re caught up!</h3>
                    <p className="text-[12px] text-on-surface-variant mt-1">You don&apos;t have any tasks to do. Check back soon to stay on top of things.</p>
                  </td></tr></tbody>
                </table>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Task</th><th>Type</th><th>Priority</th><th>Status</th><th>Due Date</th><th className="text-right">Actions</th></tr></thead>
                  <tbody>
                    {tasks.map(t => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.title}</td>
                        <td>{t.task_type || '—'}</td>
                        <td><span className={`pill tag ${t.priority === 'high' ? 'role vendor' : t.priority === 'low' ? 'tag' : ''}`}>{t.priority}</span></td>
                        <td><span className={`pill status ${t.status === 'open' ? 'role customer' : 'tag'}`}>{t.status}</span></td>
                        <td>{fmtDate(t.due_at)}</td>
                        <td className="text-right"><button className="action-link" onClick={() => onToast('Marking task complete…')}>Complete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ TASK DRAWER ═══ */}
      {taskDrawerOpen && (
        <>
          <div className="drawer-scrim open" onClick={() => setTaskDrawerOpen(false)} />
          <div className="drawer open" style={{ width: 560 }}>
            <div className="flex items-center justify-between px-6 h-14 border-b border-surface-dim shrink-0">
              <h3 className="text-[16px] font-semibold">Add task</h3>
              <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => setTaskDrawerOpen(false)}><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="field-label">Task name</label>
                <input className="field-input" placeholder="e.g. Follow up on invoice" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Priority</label>
                <select className="field-input" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="field-label">Due date</label>
                <input className="field-input" type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
              </div>
              <div className="pt-4 border-t border-surface-dim">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-[13px]">Linked records (1)</h4>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
                </div>
                <div className="text-[12px]]">
                  <span className="text-primary font-medium">Customer</span><br />
                  <span className="text-on-surface-variant">{fullName(customer)}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-surface-dim">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-[13px]">Attachments (0)</h4>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
                </div>
                <div className="border border-dashed border-surface-dim rounded-lg p-6 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[28px]">upload_file</span>
                  <div className="text-[11px]">Drop files here or click to browse</div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-surface-dim flex justify-end shrink-0">
              <button className="h-8 px-4 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container" onClick={handleAddTask}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* ═══ EDIT DRAWER ═══ */}
      {editOpen && (
        <>
          <div className="drawer-scrim open" onClick={() => setEditOpen(false)} />
          <div className="drawer drawer-wide open" style={{ width: 720 }}>
            <div className="flex items-center justify-between px-6 h-14 border-b border-surface-dim shrink-0 bg-white">
              <h3 className="text-[18px] font-medium text-on-surface">Edit customer</h3>
              <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => setEditOpen(false)}><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              <section>
                <h3 className="font-semibold text-[14px] mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">badge</span>Name and contact</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="field-label">First name</label><input className="field-input" value={edit.first_name} onChange={e => setEdit({ ...edit, first_name: e.target.value })} /></div>
                  <div><label className="field-label">Last name</label><input className="field-input" value={edit.last_name} onChange={e => setEdit({ ...edit, last_name: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="field-label">Company name</label><input className="field-input" value={edit.company_name} onChange={e => setEdit({ ...edit, company_name: e.target.value })} /></div>
                  <div><label className="field-label">Email</label><input className="field-input" type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="field-label">Phone number</label><input className="field-input" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
                  <div><label className="field-label">Country</label><input className="field-input" value={edit.country} onChange={e => setEdit({ ...edit, country: e.target.value })} /></div>
                </div>
              </section>
              <section>
                <h3 className="font-semibold text-[14px] mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">location_on</span>Billing address</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2"><label className="field-label">Street address</label><input className="field-input" value={edit.address_line1} onChange={e => setEdit({ ...edit, address_line1: e.target.value })} /></div>
                  <div><label className="field-label">City</label><input className="field-input" value={edit.city} onChange={e => setEdit({ ...edit, city: e.target.value })} /></div>
                  <div><label className="field-label">State</label><input className="field-input" value={edit.state} onChange={e => setEdit({ ...edit, state: e.target.value })} /></div>
                  <div><label className="field-label">ZIP code</label><input className="field-input" value={edit.postal_code} onChange={e => setEdit({ ...edit, postal_code: e.target.value })} /></div>
                </div>
              </section>
            </div>
            <div className="h-16 border-t border-surface-dim px-6 flex items-center justify-between shrink-0 bg-white">
              <button className="h-9 px-4 border border-error text-error rounded text-[13px] font-semibold hover:bg-error-container" onClick={handleArchive}>Archive customer</button>
              <button className="h-9 px-6 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
