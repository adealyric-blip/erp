'use client';
/**
 * CustomersSupabase — Customers LIST screen wired to Supabase.
 * Real data from crm_customers table via /api/crm/customers.
 * Search, status tabs, row click → PartyProfile (the SAME profile page
 * every party type opens — customers, vendors, suppliers, leads all use it).
 */
import { useState, useMemo } from 'react';
import {
  useCrmCustomers,
  type CrmCustomer,
} from '@/hooks/useCrmApi';
import PartyFormDrawer from './PartyFormDrawer';
import PartyProfile from './PartyProfile';

interface CustomersSupabaseProps {
  onToast: (m: string) => void;
  onNavigate?: (d: string, s: string) => void;
  onCreate?: (label: string, prefill?: { customerName?: string; customerId?: string }) => void;
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
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Fetch by stage filter — the API supports lifecycle_status, but we also
  // filter by lifecycle_stage client-side for the tabs.
  const statusParam = tab === 'archived' ? 'archived' : 'all';
  const { data: customers, loaded, refresh: refetch } = useCrmCustomers(search, statusParam);

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

  // Row click opens the unified PartyProfile — the SAME page that
  // Parties/Vendors/Suppliers lists open. Customers are just parties with
  // role=customer, so they get the same profile.
  if (profileId) {
    const c = customers.find(x => x.id === profileId);
    return (
      <PartyProfile
        partyId={profileId}
        source="crm_customers"
        summary={{
          name: c ? fullName(c) : undefined,
          roles: ['customer'],
          balance: c?.outstanding_balance,
          email: c?.email,
          phone: c?.phone,
        }}
        onToast={onToast}
        onBack={() => setProfileId(null)}
        onNavigate={onNavigate}
        onCreate={onCreate}
      />
    );
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
              {!loaded && customers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-on-surface-variant/60">Fetching from Supabase…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-on-surface-variant">No customers found.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => setProfileId(c.id)}>
                    <td className="px-3 py-2" onClick={e => { e.stopPropagation(); toggleRow(c.id); }}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="avatar w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-[11px] font-bold text-on-surface-variant">{initials(c.first_name, c.last_name, c.company_name)}</div>
                        <div className="min-w-0">
                          <button className="font-medium truncate text-left hover:text-primary hover:underline" onClick={e => { e.stopPropagation(); setProfileId(c.id); }}>{fullName(c)}</button>
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

      {/* Create — the canonical PartyFormDrawer (same as Parties/overview) */}
      <PartyFormDrawer
        open={showCreate}
        preselectRole="Customer"
        onClose={() => setShowCreate(false)}
        onSaved={(_name, mode) => { refetch(); if (mode === 'created') setShowCreate(false); }}
        onToast={onToast}
      />
    </main>
  );
}
