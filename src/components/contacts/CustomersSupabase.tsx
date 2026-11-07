'use client';
/**
 * CustomersSupabase — Customers list screen wired to Supabase.
 * Real data from crm_customers table via /api/crm/customers.
 * Search, status tabs, row click → detail drawer, Create button.
 */
import { useState, useMemo } from 'react';
import {
  useCrmCustomers,
  useCrmMutations,
  type CrmCustomer,
} from '@/hooks/useCrmApi';

interface CustomersSupabaseProps {
  onToast: (m: string) => void;
  onNavigate?: (d: string, s: string) => void;
  onCreate?: (label: string) => void;
}

const money = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function initials(first: string | null, last: string | null, company: string | null) {
  const a = first?.[0] || '';
  const b = last?.[0] || '';
  if (a || b) return (a + b).toUpperCase();
  return (company?.[0] || '?').toUpperCase();
}
function fullName(c: CrmCustomer) {
  if (c.first_name && c.last_name) return `${c.first_name} ${c.last_name}`;
  return c.first_name || c.company_name || c.email || 'Unnamed';
}
function daysSince(iso: string | null): number {
  if (!iso) return 9999;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'new_customer', label: 'New' },
  { id: 'vip', label: 'VIP' },
  { id: 'archived', label: 'Archived' },
];

export default function CustomersSupabase({ onToast, onNavigate, onCreate }: CustomersSupabaseProps) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Fetch by stage filter — the API supports lifecycle_status, but we also
  // filter by lifecycle_stage client-side for the tabs.
  const statusParam = tab === 'archived' ? 'archived' : 'all';
  const { data: customers, loading, refetch } = useCrmCustomers(search, statusParam);

  const filtered = useMemo(() => {
    if (tab === 'all' || tab === 'archived') return customers;
    return customers.filter(c => c.lifecycle_stage === tab);
  }, [customers, tab]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: customers.length };
    STATUS_TABS.forEach(t => {
      if (t.id === 'all') return;
      if (t.id === 'archived') counts[t.id] = customers.filter(c => c.archived_at).length;
      else counts[t.id] = customers.filter(c => c.lifecycle_stage === t.id).length;
    });
    return counts;
  }, [customers]);

  // Summary KPIs
  const totalAR = filtered.reduce((s, c) => s + (c.outstanding_balance || 0), 0);
  const totalLTV = filtered.reduce((s, c) => s + (c.lifetime_value || 0), 0);

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  }

  const drawerCustomer = drawerId ? customers.find(c => c.id === drawerId) : null;

  const { updateCustomer, archiveCustomer, createNote, createTask } = useCrmMutations();
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');

  async function handleAddNote() {
    if (!drawerCustomer || !noteBody.trim()) return;
    try {
      await createNote({ customer_id: drawerCustomer.id, body: noteBody, note_type: 'general' });
      onToast('Note added');
      setNoteBody('');
      refetch();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleAddTask() {
    if (!drawerCustomer || !taskTitle.trim()) return;
    try {
      await createTask({
        customer_id: drawerCustomer.id,
        title: taskTitle,
        task_type: 'follow_up',
        priority: 'medium',
        status: 'open',
        due_at: taskDue || null,
      });
      onToast('Task created');
      setTaskTitle('');
      setTaskDue('');
      refetch();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleArchive(id: string) {
    try {
      await archiveCustomer(id);
      onToast('Customer archived');
      setDrawerId(null);
      refetch();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  async function handleStageChange(id: string, stage: string) {
    try {
      await updateCustomer(id, { lifecycle_stage: stage });
      onToast(`Stage updated to ${stage}`);
      refetch();
    } catch (e: any) { onToast(`Error: ${e.message}`); }
  }

  return (
    <main className="px-6 pb-12 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-headline-lg">Customers</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">From Supabase crm_customers · {customers.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={() => onToast('Exporting…')}>
            <span className="material-symbols-outlined text-[16px]">download</span>Export
          </button>
          <button className="h-8 px-3 bg-primary text-white text-body-md font-semibold rounded hover:bg-primary-container flex items-center gap-1" onClick={() => setShowCreate(true)}>
            <span className="material-symbols-outlined text-[16px]">add</span>New customer
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Customers</div>
          <div className="text-headline-sm tabular-nums">{filtered.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Open AR</div>
          <div className="text-headline-sm tabular-nums text-secondary">{money(totalAR)}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Lifetime value</div>
          <div className="text-headline-sm tabular-nums text-primary">{money(totalLTV)}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase font-bold">Avg days since activity</div>
          <div className="text-headline-sm tabular-nums">
            {filtered.length > 0 ? Math.round(filtered.reduce((s, c) => s + daysSince(c.last_activity_at), 0) / filtered.length) : 0}
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-surface-dim">
        {STATUS_TABS.map(t => (
          <button key={t.id} className={`px-3 py-2 text-label-md tab-underline ${tab === t.id ? 'active' : 'text-on-surface-variant'}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="text-on-surface-variant">({tabCounts[t.id] || 0})</span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-2 top-1.5 text-[16px] text-on-surface-variant">search</span>
          <input className="w-full h-8 pl-8 pr-3 border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Search by name, email, phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-dim overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-3 py-2 w-8"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2 text-right">AR</th>
                <th className="px-3 py-2 text-right">LTV</th>
                <th className="px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-on-surface-variant"><span className="material-symbols-outlined animate-spin inline-block mr-2">progress_activity</span>Loading from Supabase…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-on-surface-variant">No customers found.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => setDrawerId(c.id)}>
                    <td className="px-3 py-2" onClick={e => { e.stopPropagation(); toggleRow(c.id); }}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="avatar w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-[11px] font-bold text-on-surface-variant">{initials(c.first_name, c.last_name, c.company_name)}</div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{fullName(c)}</div>
                          {c.company_name && <div className="text-[11px] text-on-surface-variant truncate">{c.company_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px]">{c.customer_type}</td>
                    <td className="px-3 py-2"><span className={`pill role ${c.lifecycle_stage === 'vip' ? 'vendor' : c.lifecycle_stage === 'new_customer' ? 'customer' : 'contact'}`}>{c.lifecycle_stage}</span></td>
                    <td className="px-3 py-2"><div className="text-[12px]">{c.email || '—'}</div><div className="text-[11px] text-on-surface-variant">{c.phone || ''}</div></td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(c.outstanding_balance || 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(c.lifetime_value || 0)}</td>
                    <td className="px-3 py-2 text-[11px] text-on-surface-variant">{c.last_activity_at ? `${daysSince(c.last_activity_at)}d ago` : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-surface-dim text-[11px] text-on-surface-variant flex items-center justify-between">
          <span>{filtered.length} of {customers.length} customers</span>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span>{selected.size} selected</span>
              <button className="h-6 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low" onClick={() => onToast(`Bulk action on ${selected.size} customers`)}>Tag</button>
              <button className="h-6 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low" onClick={() => onToast(`Bulk archive ${selected.size}`)}>Archive</button>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {drawerCustomer && (
        <>
          <div className="drawer-scrim open" onClick={() => setDrawerId(null)} />
          <div className="drawer open" style={{ width: 640 }}>
            <div className="flex items-center justify-between px-4 h-12 border-b border-surface-dim bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2">
                <div className="avatar w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-[13px] font-bold">{initials(drawerCustomer.first_name, drawerCustomer.last_name, drawerCustomer.company_name)}</div>
                <div>
                  <div className="text-headline-sm">{fullName(drawerCustomer)}</div>
                  <div className="text-[11px] text-on-surface-variant">{drawerCustomer.customer_type} · {drawerCustomer.lifecycle_stage}</div>
                </div>
              </div>
              <button className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => setDrawerId(null)}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Contact info */}
              <div className="bg-surface-container-low rounded-lg p-4">
                <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-2">Contact</div>
                <div className="grid grid-cols-2 gap-2 text-body-sm">
                  <div><span className="text-on-surface-variant">Email:</span> {drawerCustomer.email || '—'}</div>
                  <div><span className="text-on-surface-variant">Phone:</span> {drawerCustomer.phone || '—'}</div>
                  <div><span className="text-on-surface-variant">Address:</span> {[drawerCustomer.address_line1, drawerCustomer.city, drawerCustomer.state, drawerCustomer.postal_code].filter(Boolean).join(', ') || '—'}</div>
                  <div><span className="text-on-surface-variant">Country:</span> {drawerCustomer.country}</div>
                </div>
              </div>

              {/* Financials */}
              <div className="bg-surface-container-low rounded-lg p-4">
                <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-2">Financials</div>
                <div className="grid grid-cols-4 gap-2 text-body-sm">
                  <div><div className="text-[10px] text-on-surface-variant">AR</div><div className="font-semibold text-error">{money(drawerCustomer.outstanding_balance || 0)}</div></div>
                  <div><div className="text-[10px] text-on-surface-variant">LTV</div><div className="font-semibold text-secondary">{money(drawerCustomer.lifetime_value || 0)}</div></div>
                  <div><div className="text-[10px] text-on-surface-variant">Visits</div><div className="font-semibold">{drawerCustomer.total_visits || 0}</div></div>
                  <div><div className="text-[10px] text-on-surface-variant">30d spend</div><div className="font-semibold">{money(drawerCustomer.total_spend_30d || 0)}</div></div>
                </div>
              </div>

              {/* Stage changer */}
              <div>
                <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-2">Lifecycle stage</div>
                <div className="flex gap-2">
                  {['lead', 'new_customer', 'active', 'vip'].map(stage => (
                    <button key={stage} className={`h-7 px-3 rounded text-label-sm border ${drawerCustomer.lifecycle_stage === stage ? 'bg-primary text-white border-primary' : 'border-surface-dim hover:bg-surface-container-low'}`} onClick={() => handleStageChange(drawerCustomer.id, stage)}>
                      {stage.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-2">Notes ({drawerCustomer.notes?.length || 0})</div>
                <div className="space-y-2 mb-2">
                  {(drawerCustomer.notes || []).map(n => (
                    <div key={n.id} className="bg-surface-container-low rounded p-2 text-body-sm">
                      <div>{n.body}</div>
                      <div className="text-[10px] text-on-surface-variant mt-1">{n.created_at?.slice(0, 10)}</div>
                    </div>
                  ))}
                  {(drawerCustomer.notes || []).length === 0 && <div className="text-body-sm text-on-surface-variant">No notes yet.</div>}
                </div>
                <div className="flex gap-2">
                  <input className="field-input flex-1" placeholder="Add a note…" value={noteBody} onChange={e => setNoteBody(e.target.value)} />
                  <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold" onClick={handleAddNote}>Add</button>
                </div>
              </div>

              {/* Tasks */}
              <div>
                <div className="text-[11px] text-on-surface-variant uppercase font-bold mb-2">Tasks ({drawerCustomer.tasks?.length || 0})</div>
                <div className="space-y-2 mb-2">
                  {(drawerCustomer.tasks || []).map(t => (
                    <div key={t.id} className="bg-surface-container-low rounded p-2 text-body-sm flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">task_alt</span>
                      <div className="flex-1">
                        <div>{t.title}</div>
                        <div className="text-[10px] text-on-surface-variant">{t.status} · due {t.due_at?.slice(0, 10) || '—'}</div>
                      </div>
                    </div>
                  ))}
                  {(drawerCustomer.tasks || []).length === 0 && <div className="text-body-sm text-on-surface-variant">No tasks yet.</div>}
                </div>
                <div className="flex gap-2">
                  <input className="field-input flex-1" placeholder="Task title…" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                  <input className="field-input w-32" type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
                  <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold" onClick={handleAddTask}>Add</button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="h-12 border-t border-surface-dim px-4 flex items-center justify-between shrink-0 bg-white">
              <button className="h-8 px-3 border border-error text-error rounded text-body-md hover:bg-error-container" onClick={() => handleArchive(drawerCustomer.id)}>Archive</button>
              <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold" onClick={() => { onCreate?.('Invoice'); }}>Create invoice</button>
            </div>
          </div>
        </>
      )}

      {/* Create modal */}
      {showCreate && <CreateCustomerModalInline onToast={onToast} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </main>
  );
}

function CreateCustomerModalInline({ onToast, onClose, onCreated }: { onToast: (m: string) => void; onClose: () => void; onCreated: () => void }) {
  const { createCustomer } = useCrmMutations();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      await createCustomer({
        first_name: first || null,
        last_name: last || null,
        email: email || null,
        phone: phone || null,
        company_name: company || null,
        customer_type: company ? 'Wholesale' : 'Retail',
        lifecycle_stage: 'new_customer',
        lifecycle_status: 'active',
        lead_status: 'converted',
      });
      onToast(`Customer "${first || company}" created in Supabase`);
      onCreated();
    } catch (e: any) {
      onToast(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scrim open" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-headline-sm mb-1">Add customer</h3>
        <p className="text-body-sm text-on-surface-variant mb-4">Creates a record in Supabase crm_customers.</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">First name</label><input className="field-input" value={first} onChange={e => setFirst(e.target.value)} autoFocus /></div>
            <div><label className="field-label">Last name</label><input className="field-input" value={last} onChange={e => setLast(e.target.value)} /></div>
          </div>
          <div><label className="field-label">Email</label><input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className="field-label">Company (optional)</label><input className="field-input" value={company} onChange={e => setCompany(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={onClose}>Cancel</button>
          <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container disabled:opacity-40" onClick={handleCreate} disabled={(!first && !company) || saving}>
            {saving ? 'Creating…' : 'Create customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
