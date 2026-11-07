'use client';
/**
 * PartyProfile — the ONE full-page profile for every party type.
 *
 * Customers, Vendors, Suppliers, Leads all open this same page. They're all
 * "parties" — the same data model, different role tags. The Customers list,
 * Vendors list, Suppliers list are just role-filtered views of /api/parties.
 *
 * Data flow (instant-render pattern):
 *   1. Renders immediately from the `summary` prop (name/roles/balance from the
 *      cached list row — already in hand when the user clicks).
 *   2. Background-fetches the full record via useParty(id, source) →
 *      GET /api/parties/[id]?source=…, which returns the source-table row +
 *      notes/tasks/activity in one unified shape.
 *
 * Design: 8 tabs (Transaction List · Activity Feed · Statements · Recurring ·
 * Details · Late Fees · Notes · Tasks) + profile card with financial summary +
 * lifecycle stage changer (customers) / 1099 & terms (vendors) / kind & status
 * (suppliers) / lead source & follow-up (leads).
 */
import { useState } from 'react';
import {
  useParty,
  usePlatformMutations,
  fetchJson,
  type PartyDetail,
} from '@/hooks/useCrmApi';

type Tab = 'transactions' | 'activity' | 'statements' | 'recurring' | 'details' | 'latefees' | 'notes' | 'tasks';

const money = (n: number | null | undefined) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function initials(name: string) {
  return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??';
}
function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function fmtDate(iso: string | null | undefined): string {
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
  { id: 'details', label: 'Details' },
  { id: 'latefees', label: 'Late Fees' },
  { id: 'notes', label: 'Notes' },
  { id: 'tasks', label: 'Tasks', badge: 'New' },
];

/* "New transaction" menu — adapts to role: customers get Invoice/Receipt,
   vendors get Bill/Check, suppliers get PO, leads get Estimate. */
const TXN_MENU_BY_ROLE: Record<string, string[]> = {
  customer: ['Invoice', 'Payment', 'Recurring payment', 'Estimate', 'Payment Link', 'Sales Receipt', 'Credit memo', 'Statement'],
  vendor: ['Bill', 'Check', 'Expense', 'Purchase order', 'Vendor credit', 'Recurring bill'],
  supplier: ['Purchase order', 'Bill', 'Check'],
  lead: ['Estimate', 'Invoice'],
};

interface PartyProfileProps {
  partyId: string;
  source: string; // 'crm_customers' | 'acct_vendors' | 'suppliers' | 'crm_leads'
  /** Label for the back button — the screen the user traveled FROM
   *  (e.g. "Parties" when arriving via the Parties list, "Customers" when
   *  arriving via the Customers list). NOT derived from the party's role:
   *  the same customer opened from Parties must say "← Parties". */
  backLabel?: string;
  /** Instant-render summary from the cached list row (optional). */
  summary?: {
    name?: string;
    roles?: string[];
    balance?: number;
    email?: string | null;
    phone?: string | null;
  };
  onToast: (m: string) => void;
  onBack: () => void;
  onNavigate?: (d: string, s: string) => void;
  onCreate?: (label: string, prefill?: { partyName?: string; partyId?: string; source?: string }) => void;
}

export default function PartyProfile({ partyId, source, backLabel, summary, onToast, onBack, onCreate }: PartyProfileProps) {
  const { data: party, loaded, refresh } = useParty(partyId, source);
  const [tab, setTab] = useState<Tab>('transactions');
  const [txnMenuOpen, setTxnMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);

  const { createNote, createTask } = usePlatformMutations(onToast);
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [edit, setEdit] = useState<Record<string, string>>({});

  // Derive the role label from the source table for display + menu.
  const roleKey = source === 'crm_customers' ? 'customer'
    : source === 'acct_vendors' ? 'vendor'
    : source === 'suppliers' ? 'supplier'
    : source === 'crm_leads' ? 'lead' : 'customer';
  const roleLabel = roleKey.charAt(0).toUpperCase() + roleKey.slice(1);
  const txnMenu = TXN_MENU_BY_ROLE[roleKey] || TXN_MENU_BY_ROLE.customer;

  // Instant-render fallback while the full record loads.
  const displayName = party?.name || summary?.name || 'Unnamed party';
  const displayRoles = party?.roles || summary?.roles || [roleKey];
  const displayBalance = party?.balance ?? summary?.balance ?? 0;

  const openEdit = () => {
    setEdit({
      name: party?.name || summary?.name || '',
      email: party?.email || summary?.email || '',
      phone: party?.phone || summary?.phone || '',
      company: party?.company || '',
      address_line1: party?.address_line1 || '',
      city: party?.city || '',
      state: party?.state || '',
      postal_code: party?.postal_code || '',
      country: party?.country || 'US',
    });
    setEditOpen(true);
  };

  async function handleSaveEdit() {
    try {
      const res = await fetchJson<{ data: any }>(`/api/parties/${partyId}?source=${source}`, {
        method: 'PATCH',
        body: JSON.stringify(edit),
      });
      if (res.ok) { onToast('Saved'); setEditOpen(false); refresh(); }
      else onToast(`Save failed: ${res.error}`);
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleArchive() {
    try {
      const res = await fetchJson<{ data: any }>(`/api/parties/${partyId}?source=${source}`, { method: 'DELETE' });
      if (res.ok) { onToast(`${roleLabel} archived`); onBack(); }
      else onToast(`Archive failed: ${res.error}`);
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    try {
      await createNote({ customer_id: partyId, body: noteBody, note_type: 'general' });
      onToast('Note added');
      setNoteBody('');
      refresh();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleAddTask() {
    if (!taskTitle.trim()) return;
    try {
      await createTask({
        customer_id: partyId,
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
      onCreate(label, { partyName: displayName, partyId, source });
    } else {
      onToast(`New ${label} for ${displayName}`);
    }
  }

  const notes = party?.notes || [];
  const tasks = party?.tasks || [];
  const activity = party?.activity || [];
  const openTaskCount = tasks.filter(t => t.status !== 'done' && t.status !== 'closed').length;
  const openBalance = party?.outstanding_balance ?? party?.balance ?? 0;
  const isCustomer = roleKey === 'customer';
  const isVendor = roleKey === 'vendor';
  const isSupplier = roleKey === 'supplier';
  const isLead = roleKey === 'lead';

  return (
    <main className="flex flex-col h-full overflow-hidden bg-background">
      {/* ═══ TOP ACTION BAR ═══ */}
      <header className="h-14 px-6 flex items-center justify-between bg-white border-b border-surface-dim shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button className="flex items-center gap-1 text-primary font-semibold text-[13px] hover:underline shrink-0" onClick={onBack}>
            <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>{backLabel || 'Parties'}
          </button>
          <span className="text-on-surface-variant text-[12px] truncate">/ {displayName}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex">
            <button className="h-8 px-3 border border-surface-dim rounded-l bg-white text-[13px] font-semibold hover:bg-surface-container" onClick={openEdit}>Edit</button>
            <button className="h-8 px-1.5 border border-l-0 border-surface-dim rounded-r bg-white hover:bg-surface-container" onClick={openEdit}>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
          </div>
          <div className="relative">
            <div className="flex">
              <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1" onClick={() => handleNewTxn(txnMenu[0])}>
                New transaction
              </button>
              <button className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container" onClick={e => { e.stopPropagation(); setTxnMenuOpen(v => !v); }}>
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            {txnMenuOpen && (
              <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 220 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">New transaction</div>
                {txnMenu.map(label => (
                  <button key={label} onClick={() => handleNewTxn(label)}>
                    <span className="material-symbols-outlined">{label.includes('Invoice') || label.includes('Bill') ? 'receipt_long' : label.includes('Estimate') || label.includes('Quote') ? 'request_quote' : label.includes('Check') || label.includes('Payment') ? 'payments' : label.includes('Credit') ? 'credit_card' : label.includes('Order') ? 'shopping_bag' : 'description'}</span>
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
        {!loaded && !party ? (
          <div className="flex items-center justify-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] mr-2">progress_activity</span>
            Loading {roleLabel.toLowerCase()}…
          </div>
        ) : (
        <>
        {/* ── PROFILE CARD ── */}
        <div className="bg-white border border-surface-dim rounded-xl p-6 flex gap-6 mb-4">
          {/* Avatar + name */}
          <div className="w-1/4 flex flex-col items-center justify-center text-center border-r border-surface-dim pr-6">
            <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-2xl font-bold text-on-surface-variant mb-3">
              {initials(displayName)}
            </div>
            <h1 className="text-[22px] font-semibold mb-1">{displayName}</h1>
            {party?.company && party.company !== displayName && (
              <div className="text-[12px] text-on-surface-variant mb-3">{party.company}</div>
            )}
            {!party?.company && (
              <a href="#" className="text-[12px] text-primary hover:underline mb-3" onClick={e => { e.preventDefault(); openEdit(); }}>Add company name</a>
            )}
            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
              {displayRoles.map(r => (
                <span key={r} className={`pill role ${r === 'customer' ? 'customer' : r === 'vendor' ? 'vendor' : r === 'supplier' ? 'supplier' : 'contact'}`}>{r}</span>
              ))}
              {isCustomer && party?.customer_type && <span className="pill tag">{party.customer_type}</span>}
              {isVendor && party?.vendor_number && <span className="pill tag">#{party.vendor_number}</span>}
              {isSupplier && party?.kind && <span className="pill tag">{party.kind}</span>}
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
                {party?.email ? <a href={`mailto:${party.email}`} className="text-primary hover:underline">{party.email}</a> : <button className="text-primary hover:underline" onClick={openEdit}>Add email</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">{isVendor ? 'Terms' : 'Billing address'}</div>
                {isVendor && party?.payment_terms_days != null ? `${party.payment_terms_days} days` :
                 party ? ([party.address_line1, party.city, party.state, party.postal_code].filter(Boolean).join(', ') || <button className="text-primary hover:underline" onClick={openEdit}>Add billing address</button>) :
                 <button className="text-primary hover:underline" onClick={openEdit}>Add billing address</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Notes</div>
                {notes.length > 0 ? <span className="text-on-surface">{notes.length} note{notes.length === 1 ? '' : 's'}</span> : <button className="text-primary hover:underline" onClick={() => setTab('notes')}>Add notes</button>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Phone</div>
                {party?.phone ? <span>{party.phone}</span> : <button className="text-primary hover:underline" onClick={openEdit}>Add phone number</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">
                  {isLead ? 'Lead source' : isSupplier ? 'Ordering status' : isVendor ? '1099 / W-9' : 'Shipping address'}
                </div>
                {isLead ? (party?.lead_source || <button className="text-primary hover:underline" onClick={openEdit}>Add source</button>) :
                 isSupplier ? (party?.ordering_status || '—') :
                 isVendor ? (
                   <span className="flex items-center gap-2">
                     {party?.is_1099_vendor ? <span className="pill tag">1099</span> : 'Not 1099'}
                     {party?.w9_received_at ? <span className="pill status role customer">W-9 ✓</span> : <span className="pill tag">No W-9</span>}
                   </span>
                 ) :
                 <button className="text-primary hover:underline" onClick={openEdit}>Add shipping address</button>}
              </div>
              <div>
                <div className="font-semibold text-on-surface-variant mb-1">Custom Fields</div>
                <button className="mt-1 text-on-surface-variant hover:text-on-surface" onClick={openEdit}><span className="material-symbols-outlined text-[18px]">edit</span></button>
              </div>
            </div>
          </div>

          {/* Financial / status summary */}
          <div className="w-64 shrink-0 bg-[#eef5fa] rounded-lg p-4">
            <h3 className="font-semibold text-[14px] mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">
                {isCustomer ? 'account_balance_wallet' : isVendor ? 'payments' : isSupplier ? 'factory' : isLead ? 'flag' : 'person'}
              </span>
              {isCustomer ? 'Financial summary' : isVendor ? 'Vendor terms' : isSupplier ? 'Supplier info' : isLead ? 'Lead info' : 'Summary'}
            </h3>
            {isCustomer && (
              <>
                <div className="mb-4">
                  <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className={`w-2 h-2 rounded-full ${openBalance > 0 ? 'bg-yellow-400' : 'bg-green-500'}`}></span>Open Balance</div>
                  <div className="text-[20px] font-semibold text-on-surface">{money(openBalance)}</div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center gap-1 text-[12px] text-on-surface-variant mb-1"><span className="w-2 h-2 rounded-full bg-secondary"></span>Lifetime value</div>
                  <div className="text-[20px] font-semibold text-on-surface">{money(party?.lifetimeValue)}</div>
                </div>
                <div className="pt-3 border-t border-surface-dim grid grid-cols-2 gap-2 text-[12px]">
                  <div><div className="text-on-surface-variant">Visits</div><div className="font-semibold">{party?.total_visits ?? 0}</div></div>
                  <div><div className="text-on-surface-variant">30d spend</div><div className="font-semibold">{money(party?.total_spend_30d)}</div></div>
                  <div><div className="text-on-surface-variant">Last activity</div><div className="font-semibold">{party?.last_activity_at ? `${daysSince(party.last_activity_at)}d ago` : '—'}</div></div>
                  <div><div className="text-on-surface-variant">Added</div><div className="font-semibold">{fmtDate(party?.created_at)}</div></div>
                </div>
              </>
            )}
            {isVendor && (
              <div className="space-y-3 text-[13px]">
                <div><div className="text-[11px] text-on-surface-variant">Payment terms</div><div className="font-semibold">{party?.payment_terms_days ?? 30} days</div></div>
                <div><div className="text-[11px] text-on-surface-variant">1099 vendor</div><div className="font-semibold">{party?.is_1099_vendor ? 'Yes' : 'No'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">W-9 received</div><div className="font-semibold">{party?.w9_received_at ? fmtDate(party.w9_received_at) : 'Not received'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Status</div><div className="font-semibold">{party?.lifecycle_status}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Added</div><div className="font-semibold">{fmtDate(party?.created_at)}</div></div>
              </div>
            )}
            {isSupplier && (
              <div className="space-y-3 text-[13px]">
                <div><div className="text-[11px] text-on-surface-variant">Kind</div><div className="font-semibold">{party?.kind || '—'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Ordering status</div><div className="font-semibold">{party?.ordering_status || '—'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Added</div><div className="font-semibold">{fmtDate(party?.created_at)}</div></div>
              </div>
            )}
            {isLead && (
              <div className="space-y-3 text-[13px]">
                <div><div className="text-[11px] text-on-surface-variant">Status</div><div className="font-semibold">{party?.status || '—'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Source</div><div className="font-semibold">{party?.lead_source || '—'}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">First contact</div><div className="font-semibold">{fmtDate(party?.first_contact_at)}</div></div>
                <div><div className="text-[11px] text-on-surface-variant">Next follow-up</div><div className="font-semibold">{fmtDate(party?.next_follow_up_at)}</div></div>
              </div>
            )}
          </div>
        </div>

        {/* ── LIFECYCLE / STATUS BAR (customers only — stage changer) ── */}
        {isCustomer && party?.lifecycleStage && (
          <div className="bg-white border border-surface-dim rounded-xl p-4 mb-4 flex items-center gap-3">
            <div className="text-[12px] text-on-surface-variant uppercase font-bold">Lifecycle stage</div>
            <StageChanger partyId={partyId} source={source} current={party.lifecycleStage} onToast={onToast} onSaved={refresh} />
          </div>
        )}

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
                  <option>All transactions</option><option>Invoices</option><option>Estimates</option><option>Bills</option><option>Credit memos</option><option>Sales Receipts</option>
                </select>
                <select className="h-8 px-3 border border-surface-dim rounded text-[13px] bg-white"><option>All</option><option>Open</option><option>Overdue</option><option>Paid</option></select>
              </div>
              <div className="flex items-center gap-1">
                <button className="icon-btn" title="Print" onClick={() => onToast('Printing…')}><span className="material-symbols-outlined text-[18px]">print</span></button>
                <button className="icon-btn" title="Export" onClick={() => onToast('Exporting to CSV…')}><span className="material-symbols-outlined text-[18px]">download</span></button>
              </div>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              <table className="data-table">
                <thead><tr>
                  <th className="w-8"><input type="checkbox" className="accent-primary" /></th>
                  <th>Date</th><th>Type</th><th>No.</th><th>{roleLabel}</th><th>Memo</th>
                  <th className="text-right">Amount</th><th>Status</th><th className="text-right">Action</th>
                </tr></thead>
                <tbody>
                  <tr><td colSpan={9} className="text-center py-10 text-on-surface-variant">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[40px] text-outline-variant">receipt_long</span>
                      <div className="font-semibold text-[14px] text-on-surface">No transactions yet</div>
                      <div className="text-[12px]">Create one with “New transaction” above.</div>
                      <button className="mt-2 h-8 px-3 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container" onClick={() => handleNewTxn(txnMenu[0])}>Create {txnMenu[0]}</button>
                    </div>
                  </td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Activity Feed */}
        {tab === 'activity' && (
          <div className="bg-white border border-surface-dim rounded-xl p-8 flex items-center gap-8">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Keep track of every interaction</h2>
              <p className="text-body-md text-on-surface-variant mb-6 max-w-lg">Strengthen your connection with {displayName}. Add a note, task, or review recent activity — new activities will appear here.</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-surface-dim rounded-lg p-4">
                  <div className="material-symbols-outlined text-[24px] text-on-surface-variant mb-2">edit_note</div>
                  <h3 className="font-semibold text-[14px] mb-1">Create a note</h3>
                  <p className="text-[12px] text-on-surface-variant mb-4">Capture important details.</p>
                  <button className="w-full h-8 border border-surface-dim rounded text-[12px] font-semibold hover:bg-surface-container" onClick={() => setTab('notes')}>Add note</button>
                </div>
                <div className="border border-surface-dim rounded-lg p-4">
                  <div className="material-symbols-outlined text-[24px] text-on-surface-variant mb-2">task_alt</div>
                  <h3 className="font-semibold text-[14px] mb-1">Assign a task</h3>
                  <p className="text-[12px] text-on-surface-variant mb-4">Stay organized.</p>
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
                <thead><tr><th className="w-8"><input type="checkbox" className="accent-primary" /></th><th>Date</th><th>No.</th><th>{roleLabel}</th><th>Start Date</th><th>End Date</th><th>Statement Type</th><th className="text-right">Action</th></tr></thead>
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
              <button className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded hover:bg-primary-container flex items-center gap-1" onClick={() => handleNewTxn(isVendor ? 'Recurring bill' : 'Recurring payment')}><span className="material-symbols-outlined text-[16px]">add</span>New template</button>
            </div>
            <div className="bg-white border border-surface-dim rounded-xl overflow-hidden">
              <table className="data-table">
                <thead><tr><th>Name</th><th>Type</th><th>Txn Type</th><th>Interval</th><th>Previous Date</th><th>Next Date</th><th className="text-right">Amount</th><th className="text-right">Action</th></tr></thead>
                <tbody><tr><td colSpan={8} className="text-center py-8 text-on-surface-variant">No matching recurring transactions found.</td></tr></tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. Details */}
        {tab === 'details' && (
          <div className="grid grid-cols-2 gap-8 text-[13px]">
            <div>
              <h3 className="font-semibold text-[14px] mb-3">Contact info</h3>
              <table className="w-full">
                {[
                  ['Name', displayName],
                  ['Company', party?.company || '—'],
                  ['Email', party?.email || '—'],
                  ['Phone', party?.phone || '—'],
                  ['Address', [party?.address_line1, party?.city, party?.state, party?.postal_code].filter(Boolean).join(', ') || '—'],
                  ['Country', party?.country || '—'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                ))}
              </table>
              {isCustomer && (
                <>
                  <h3 className="font-semibold text-[14px] mt-6 mb-3">Customer info</h3>
                  <table className="w-full">
                    {[['Customer type', party?.customer_type || '—'], ['Lifecycle stage', party?.lifecycleStage || '—'], ['Lifecycle status', party?.lifecycle_status || '—'], ['Total visits', party?.total_visits ?? '—'], ['30d spend', money(party?.total_spend_30d)], ['Last activity', party?.last_activity_at ? fmtDate(party.last_activity_at) : '—']].map(([k, v]) => (
                      <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                    ))}
                  </table>
                </>
              )}
              {isVendor && (
                <>
                  <h3 className="font-semibold text-[14px] mt-6 mb-3">Vendor info</h3>
                  <table className="w-full">
                    {[['Vendor #', party?.vendor_number || '—'], ['Payment terms', party?.payment_terms_days != null ? `${party.payment_terms_days} days` : '—'], ['1099 vendor', party?.is_1099_vendor ? 'Yes' : 'No'], ['W-9 received', party?.w9_received_at ? fmtDate(party.w9_received_at) : 'Not received']].map(([k, v]) => (
                      <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                    ))}
                  </table>
                </>
              )}
              {isSupplier && (
                <>
                  <h3 className="font-semibold text-[14px] mt-6 mb-3">Supplier info</h3>
                  <table className="w-full">
                    {[['Kind', party?.kind || '—'], ['Ordering status', party?.ordering_status || '—']].map(([k, v]) => (
                      <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                    ))}
                  </table>
                </>
              )}
              {isLead && (
                <>
                  <h3 className="font-semibold text-[14px] mt-6 mb-3">Lead info</h3>
                  <table className="w-full">
                    {[['Status', party?.status || '—'], ['Lead source', party?.lead_source || '—'], ['Lead type', party?.lead_type || '—'], ['First contact', fmtDate(party?.first_contact_at)], ['Next follow-up', fmtDate(party?.next_follow_up_at)]].map(([k, v]) => (
                      <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2 font-medium">{v}</td></tr>
                    ))}
                  </table>
                </>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[14px] mb-3">Metadata</h3>
              <table className="w-full">
                {[['Source table', source], ['Added', fmtDate(party?.created_at)], ['Updated', fmtDate(party?.updated_at)], ['Roles', displayRoles.join(', ')]].map(([k, v]) => (
                  <tr key={k} className="border-b border-surface-dim"><td className="py-2 text-on-surface-variant w-1/3">{k}</td><td className="py-2">{v}</td></tr>
                ))}
              </table>
              <h3 className="font-semibold text-[14px] mt-6 mb-3">Attachments</h3>
              <div className="text-on-surface-variant">None</div>
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
              <button className="text-[13px] font-semibold text-primary hover:underline flex items-center gap-1" onClick={() => setTab('notes')}><span className="material-symbols-outlined text-[16px]">add</span>Add note</button>
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
                    <p className="text-[12px] text-on-surface-variant mt-1">No tasks to do right now.</p>
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
        </>
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
                <input className="field-input" placeholder="e.g. Follow up" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
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
                </div>
                <div className="text-[12px]">
                  <span className="text-primary font-medium">{roleLabel}</span><br />
                  <span className="text-on-surface-variant">{displayName}</span>
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
              <h3 className="text-[18px] font-medium text-on-surface">Edit {roleLabel.toLowerCase()}</h3>
              <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => setEditOpen(false)}><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
              <section>
                <h3 className="font-semibold text-[14px] mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">badge</span>Name and contact</h3>
                {isCustomer || isVendor ? (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2"><label className="field-label">{isVendor ? 'Legal name' : 'Company / display name'}</label><input className="field-input" value={edit.company || edit.name} onChange={e => setEdit({ ...edit, company: e.target.value, name: e.target.value })} /></div>
                    <div><label className="field-label">Email</label><input className="field-input" type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></div>
                    <div><label className="field-label">Phone</label><input className="field-input" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2"><label className="field-label">Name</label><input className="field-input" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
                    <div><label className="field-label">Email</label><input className="field-input" type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></div>
                    <div><label className="field-label">Phone</label><input className="field-input" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></div>
                  </div>
                )}
                {isCustomer && (
                  <div>
                    <h3 className="font-semibold text-[14px] mt-4 mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">location_on</span>Billing address</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="col-span-2"><label className="field-label">Street address</label><input className="field-input" value={edit.address_line1} onChange={e => setEdit({ ...edit, address_line1: e.target.value })} /></div>
                      <div><label className="field-label">City</label><input className="field-input" value={edit.city} onChange={e => setEdit({ ...edit, city: e.target.value })} /></div>
                      <div><label className="field-label">State</label><input className="field-input" value={edit.state} onChange={e => setEdit({ ...edit, state: e.target.value })} /></div>
                      <div><label className="field-label">ZIP</label><input className="field-input" value={edit.postal_code} onChange={e => setEdit({ ...edit, postal_code: e.target.value })} /></div>
                      <div><label className="field-label">Country</label><input className="field-input" value={edit.country} onChange={e => setEdit({ ...edit, country: e.target.value })} /></div>
                    </div>
                  </div>
                )}
              </section>
            </div>
            <div className="h-16 border-t border-surface-dim px-6 flex items-center justify-between shrink-0 bg-white">
              <button className="h-9 px-4 border border-error text-error rounded text-[13px] font-semibold hover:bg-error-container" onClick={handleArchive}>Archive</button>
              <button className="h-9 px-6 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

/* Stage changer — inline PATCH to /api/crm/customers/[id] (customer-only). */
function StageChanger({ partyId, source, current, onToast, onSaved }: {
  partyId: string; source: string; current: string;
  onToast: (m: string) => void; onSaved: () => void;
}) {
  if (source !== 'crm_customers') return null;
  const stages = ['lead', 'new_customer', 'active', 'vip'];
  async function change(stage: string) {
    const res = await fetchJson(`/api/crm/customers/${partyId}`, { method: 'PATCH', body: JSON.stringify({ lifecycle_stage: stage }) });
    if (res.ok) { onToast(`Stage → ${stage}`); onSaved(); }
    else onToast(`Save failed`);
  }
  return (
    <div className="flex gap-2">
      {stages.map(stage => (
        <button key={stage} className={`h-7 px-3 rounded text-label-sm border ${current === stage ? 'bg-primary text-white border-primary' : 'border-surface-dim hover:bg-surface-container-low'}`} onClick={() => change(stage)}>
          {stage.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}
