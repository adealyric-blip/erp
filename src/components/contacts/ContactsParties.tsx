'use client';
/* ContactsParties — 1:1 port of upload/Contacts_extracted/Contacts/parties.html
   Global CSS classes from marketing.css + contacts.css.
   Row click → peek (View details). Name/avatar click → full profile view.
   DATA: unified /api/parties (Supabase: crm_customers + acct_vendors +
   suppliers + crm_leads). Cache-first — renders instantly, refreshes in
   the background, hits Supabase only when the user saves. */
import { useMemo, useState } from 'react';
import { exportToCsv } from '@/lib/csvExport';
import { useParties, fetchJson, type UnifiedParty } from '@/hooks/useCrmApi';
import PartyFormDrawer from './PartyFormDrawer';
import PartyProfile from './PartyProfile';

interface ContactsPartiesProps {
  onToast: (m: string) => void;
  onNavigate?: (d: string, s: string) => void;
  initialRole?: string;
  onCreate?: (label: string) => void;
}

/* ─── helpers ─── */
function fmt(n: number) { return (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function initials(name: string) { return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??'; }

/* ─── data ─── */
const ALL_ROLES = ['Customer', 'Vendor', 'Supplier', 'Contact', 'Lead'];

interface Party {
  id: string; source: string; name: string; email: string; phone: string;
  roles: string[]; balance: number; added: string; address: string;
}

/* Map the unified Supabase shape to the render shape (roles capitalized
   so every `roles.includes('Customer')` check keeps working). */
function toParty(p: UnifiedParty): Party {
  return {
    id: p.id,
    source: p.source,
    name: p.name,
    email: p.email || '',
    phone: p.phone || '',
    roles: p.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)),
    balance: p.balance,
    added: (p.addedAt || '').slice(0, 10),
    address: [p.company !== p.name ? p.company : null, p.city, p.state].filter(Boolean).join(', '),
  };
}

interface SavedView { id: string; name: string; tab: string; q: string; roles: string[]; }

const INITIAL_VIEWS: SavedView[] = [
  { id: 'sv-1', name: 'Customers', tab: 'Customers', q: '', roles: ['Customer'] },
  { id: 'sv-2', name: 'Suppliers', tab: 'Suppliers', q: '', roles: ['Supplier'] },
];

function rolePill(r: string) {
  const cls = r === 'Customer' ? 'customer' : r === 'Vendor' ? 'vendor' : r === 'Supplier' ? 'supplier' : r === 'Lead' ? 'contact' : 'contact';
  return <span key={r} className={`pill role ${cls}`}>{r}</span>;
}
function avatarClass(roles: string[]) {
  if (roles.includes('Vendor')) return 'vendor';
  if (roles.includes('Supplier')) return 'supplier';
  if (roles.includes('Contact')) return 'contact';
  return '';
}

export default function ContactsParties({ onToast, onNavigate, initialRole, onCreate }: ContactsPartiesProps) {
  /* Unified party list from Supabase — cache-first: first render is instant
     (cached or empty), data fills in from the background refresh. */
  const { data: rawParties, refresh } = useParties();
  const items: Party[] = useMemo(() => rawParties.map(toParty), [rawParties]);
  const [savedViews, setSavedViews] = useState<SavedView[]>(INITIAL_VIEWS);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(initialRole ? (initialRole + 's') : 'All');
  const [roles, setRoles] = useState<Set<string>>(new Set(initialRole ? [initialRole] : ALL_ROLES));
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set(ALL_ROLES));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPreselect, setDrawerPreselect] = useState<string | undefined>(undefined);
  const [rowMenuForId, setRowMenuForId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [popRoleOpen, setPopRoleOpen] = useState(false);
  const [popSavedOpen, setPopSavedOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  // profileId: when set, render the full CustomersScreen profile view for this party.
  // Every party type (Customer, Vendor, Supplier, Contact) opens the same profile
  // because they're all parties with different role tags.
  const [profileId, setProfileId] = useState<string | null>(null);

  const filtered = useMemo(() => items.filter(p => {
    const ql = q.toLowerCase();
    const qOK = !ql || (p.name + ' ' + p.email + ' ' + p.phone).toLowerCase().includes(ql);
    let tabOK = true;
    if (tab !== 'All') {
      const targetRole = tab.slice(0, -1);
      tabOK = p.roles.includes(targetRole) || p.roles.includes(tab);
    }
    const roleOK = p.roles.some(r => roles.has(r));
    return qOK && tabOK && roleOK;
  }), [items, q, tab, roles]);

  // Full profile view — the unified PartyProfile page (same one the Customers,
  // Vendors, Suppliers lists open). Every party type uses this one page.
  if (profileId) {
    const profile = items.find(p => p.id === profileId);
    if (!profile) return null;
    return (
      <PartyProfile
        partyId={profile.id}
        source={profile.source}
        summary={{ name: profile.name, roles: profile.roles, balance: profile.balance, email: profile.email, phone: profile.phone }}
        onToast={onToast}
        onBack={() => setProfileId(null)}
        onCreate={onCreate ? (label: string) => onCreate(label) : undefined}
      />
    );
  }

  const totalParties = items.length;
  const customerCount = items.filter(p => p.roles.includes('Customer')).length;
  const vendorCount = items.filter(p => p.roles.includes('Vendor') || p.roles.includes('Supplier')).length;
  const totalBalance = items.reduce((s, p) => s + p.balance, 0);
  const filtersActive = !!q || tab !== 'All' || roles.size !== ALL_ROLES.length;
  const allChecked = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someChecked = filtered.some(p => selected.has(p.id));

  function openPeek(id: string) { setPeekId(id); }
  function closePeek() { setPeekId(null); }

  function openDrawer(id: string | null, preselectRole?: string) {
    setEditingId(id);
    setDrawerPreselect(id ? undefined : preselectRole);
    setDrawerOpen(true);
    setPeekId(null);
    setRowMenuForId(null);
    setCreateMenuOpen(false);
  }
  function closeDrawer() { setDrawerOpen(false); setEditingId(null); setDrawerPreselect(undefined); }

  function drawerSaved(partyName: string, mode: 'created' | 'updated') {
    onToast(mode === 'created' ? `Party "${partyName}" created` : `Party "${partyName}" updated`);
    refresh();
  }

  async function rowAction(act: string, p: Party) {
    setRowMenuForId(null);
    switch (act) {
      case 'edit': openDrawer(p.id); break;
      case 'view': openPeek(p.id); break;
      case 'email': onToast(`Composing email to ${p.email}`); break;
      case 'add-role': openDrawer(p.id); break;
      case 'archive': {
        if (!confirm(`Archive "${p.name}"?`)) break;
        const res = await fetchJson(`/api/parties/${p.id}?source=${p.source}`, { method: 'DELETE' });
        onToast(res.ok ? `Archived: ${p.name}` : `Archive failed: ${res.error}`);
        refresh();
        break;
      }
    }
  }

  async function bulkAction(act: string) {
    if (act === 'close') { setSelected(new Set()); return; }
    const sel = [...selected]; const n = sel.length;
    if (act === 'email') { onToast(`Composing bulk email to ${n} parties`); }
    else if (act === 'merge') { onToast(`Merge ${n} parties… (requires selection of 2+)`); }
    else if (act === 'archive' || act === 'delete') {
      let done = 0;
      for (const id of sel) {
        const party = items.find(x => x.id === id);
        if (!party) continue;
        const res = await fetchJson(`/api/parties/${id}?source=${party.source}`, { method: 'DELETE' });
        if (res.ok) done++;
      }
      onToast(`Archived ${done} of ${n} parties`);
      refresh();
    }
    setSelected(new Set());
  }

  function toggleRow(id: string) { setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { if (allChecked) setSelected(new Set()); else setSelected(new Set(filtered.map(p => p.id))); }
  function clearAllFilters() { setQ(''); setTab('All'); setRoles(new Set(ALL_ROLES)); setDraftRoles(new Set(ALL_ROLES)); }

  function applyView(v: SavedView) {
    setTab(v.tab); setQ(v.q); setRoles(new Set(v.roles));
    setPopSavedOpen(false);
    onToast('Applied view: ' + v.name);
  }
  function saveCurrentView() {
    const name = saveViewName.trim();
    if (!name) { onToast('Name is required'); return; }
    setSavedViews(prev => [...prev, { id: 'sv-' + Date.now(), name, tab, q, roles: [...roles] }]);
    setSaveViewOpen(false); setSaveViewName('');
    onToast('Saved view: ' + name);
  }

  function handleExport() {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'id', label: 'Party ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' }, { key: 'roles', label: 'Roles' }, { key: 'balance', label: 'Balance' },
      { key: 'address', label: 'Address' }, { key: 'added', label: 'Added' },
    ], 'parties');
    onToast(`Exported ${filtered.length} parties`);
  }

  const peek = peekId ? items.find(p => p.id === peekId) : null;
  const editing = editingId ? items.find(p => p.id === editingId) : null;

  return (
    <main className="px-6 pb-12">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-4 mb-2">
        <span>Contacts</span><span className="text-outline">/</span>
        <span className="text-on-surface font-semibold">Parties</span>
      </div>

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between gap-4 py-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg">Parties</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">One unified list for Customers, Vendors, Suppliers, and Contacts. Filter by role.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={handleExport}><span className="material-symbols-outlined text-[16px]">download</span>Export</button>
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={() => onToast('Customize panel')}><span className="material-symbols-outlined text-[16px]">tune</span>Customize</button>
          <div className="flex">
            <button className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main" onClick={() => openDrawer(null)}><span className="material-symbols-outlined text-[16px]">add</span>New party</button>
            <button className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow" onClick={() => setCreateMenuOpen(v => !v)}><span className="material-symbols-outlined text-[16px]">expand_more</span></button>
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Total parties</div>
          <div className="text-headline-sm mt-1 tabular-nums">{totalParties}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">Across all roles</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Customers</div>
          <div className="text-headline-sm mt-1 tabular-nums text-secondary">{customerCount}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">Active in CRM</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Vendors &amp; Suppliers</div>
          <div className="text-headline-sm mt-1 tabular-nums text-qb-blue">{vendorCount}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">Bills &amp; purchasing</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Outstanding balance</div>
          <div className="text-headline-sm mt-1 tabular-nums text-error">{fmt(totalBalance)}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">AR + AP combined</div>
        </div>
      </div>

      {/* CREATE ACTIONS ROW */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">Create actions:</span>
        {[
          { role: 'Customer', icon: 'person_add', label: 'Add customer' },
          { role: 'Vendor', icon: 'storefront', label: 'Add vendor' },
          { role: 'Supplier', icon: 'factory', label: 'Add supplier' },
          { role: 'Contact', icon: 'contacts', label: 'Add contact' },
          { role: 'Lead', icon: 'flag', label: 'Add lead' },
        ].map(a => (
          <button key={a.role} className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5" onClick={() => openDrawer(null, a.role)}>
            <span className="material-symbols-outlined text-[16px]">{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* LIST CARD */}
      <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden mb-4">
        {/* Role Tabs */}
        <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
          {['All', 'Customers', 'Vendors', 'Suppliers', 'Contacts', 'Leads'].map(t => (
            <button key={t} className={`h-full px-3 text-label-md tab-underline ${tab === t ? 'active' : 'text-on-surface-variant'}`} onClick={() => { setTab(t); setSelected(new Set()); }}>{t}</button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
          <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
            <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
            <input className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Filter by name, email, phone…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {/* Role popover */}
          <div className="relative">
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1" onClick={e => { e.stopPropagation(); setPopRoleOpen(v => !v); setPopSavedOpen(false); }}>
              <span className="material-symbols-outlined text-[14px]">badge</span>Roles
            </button>
            {popRoleOpen && (
              <div className="row-menu open" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 200 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">Filter by role</div>
                {ALL_ROLES.map(r => (
                  <label key={r} className="flex items-center gap-2 px-2 py-1 text-body-sm">
                    <input type="checkbox" checked={draftRoles.has(r)} onChange={() => { const n = new Set(draftRoles); if (n.has(r)) n.delete(r); else n.add(r); setDraftRoles(n); }} />{r}
                  </label>
                ))}
                <div className="sep"></div>
                <div className="flex justify-end gap-2 px-2 py-1">
                  <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low" onClick={() => { setDraftRoles(new Set(ALL_ROLES)); }}>Clear</button>
                  <button className="h-7 px-2 bg-primary text-white rounded text-label-sm font-semibold hover:bg-primary-container" onClick={() => { setRoles(new Set(draftRoles)); setPopRoleOpen(false); }}>Apply</button>
                </div>
              </div>
            )}
          </div>
          {/* Saved views */}
          <div className="relative">
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1" onClick={e => { e.stopPropagation(); setPopSavedOpen(v => !v); setPopRoleOpen(false); }}>
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            {popSavedOpen && (
              <div className="row-menu open" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, minWidth: 240 }} onClick={e => e.stopPropagation()}>
                <div className="menu-header">Saved views</div>
                <div className="max-h-[220px] overflow-y-auto">
                  {savedViews.length === 0 ? (
                    <div className="px-3 py-2 text-[11px] text-on-surface-variant">No saved views yet.</div>
                  ) : savedViews.map(v => (
                    <div key={v.id} className="w-full px-3 py-1.5 hover:bg-surface-container-low flex items-center gap-2">
                      <button className="flex-1 text-left flex items-center gap-2" onClick={() => applyView(v)}>
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">bookmark</span>
                        <span className="truncate">{v.name}</span>
                      </button>
                      <button className="w-5 h-5 rounded hover:bg-surface-container flex items-center justify-center" onClick={e => { e.stopPropagation(); setSavedViews(prev => prev.filter(x => x.id !== v.id)); onToast('View deleted'); }}><span className="material-symbols-outlined text-[14px] text-outline">close</span></button>
                    </div>
                  ))}
                </div>
                <div className="sep"></div>
                <button className="w-full text-left px-3 py-1.5 text-body-sm hover:bg-surface-container-low flex items-center gap-2 text-primary font-semibold" onClick={() => { setPopSavedOpen(false); setSaveViewName(''); setSaveViewOpen(true); }}>
                  <span className="material-symbols-outlined text-[16px]">bookmark_add</span>Save current view…
                </button>
              </div>
            )}
          </div>
          <button className={`h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1 ${filtersActive ? '' : 'hidden-imp'}`} onClick={clearAllFilters}>
            <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>Clear all
          </button>
          <span className="ml-auto text-[11px] text-on-surface-variant">{filtered.length} of {items.length}</span>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bulk-bar show">
            <span className="text-[12px] font-semibold">{selected.size} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => bulkAction('email')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">mail</span>Email</button>
            <button onClick={() => bulkAction('merge')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">call_merge</span>Merge</button>
            <button onClick={() => bulkAction('archive')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">archive</span>Archive</button>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => bulkAction('delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" onClick={() => bulkAction('close')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-surface-container-low flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[28px] text-outline">groups</span>
            </div>
            <h3 className="text-headline-sm mb-1">No parties match</h3>
            <p className="text-body-sm text-on-surface-variant mb-3">Clear filters or add a new party.</p>
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={clearAllFilters}>Clear filters</button>
          </div>
        ) : (
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={toggleAll} /></th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Roles</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2 text-right">Open balance</th>
                <th className="px-3 py-2">Added</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => openPeek(p.id)}>
                  <td className="px-3 py-2"><input type="checkbox" className="row-check" checked={selected.has(p.id)} onClick={e => e.stopPropagation()} onChange={() => toggleRow(p.id)} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <button className={`avatar ${avatarClass(p.roles)} hover:opacity-80`} onClick={e => { e.stopPropagation(); setProfileId(p.id); }} title="Open profile">{initials(p.name)}</button>
                      <div className="min-w-0">
                        <button className="font-medium truncate text-primary hover:underline block text-left" onClick={e => { e.stopPropagation(); setProfileId(p.id); }} title="Open profile">{p.name}</button>
                        <div className="text-[11px] text-on-surface-variant truncate">{p.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{p.roles.map(r => rolePill(r))}</div></td>
                  <td className="px-3 py-2">
                    <div className="text-[12px] truncate">{p.email}</div>
                    <div className="text-[11px] text-on-surface-variant">{p.phone}</div>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${p.balance > 0 ? 'text-error' : p.balance < 0 ? 'text-qb-blue' : 'text-on-surface'}`}>{p.balance !== 0 ? fmt(p.balance) : '—'}</td>
                  <td className="px-3 py-2 text-[11px]">{p.added}</td>
                  <td className="px-2 py-2 text-right relative">
                    <button className="w-7 h-7 rounded border border-surface-dim hover:bg-surface-container flex items-center justify-center mx-auto" onClick={e => { e.stopPropagation(); setRowMenuForId(rowMenuForId === p.id ? null : p.id); }} title="Row actions"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span></button>
                    {rowMenuForId === p.id && (
                      <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4 }} onClick={e => e.stopPropagation()}>
                        <div className="menu-header">This party</div>
                        <button onClick={() => rowAction('edit', p)}><span className="material-symbols-outlined">edit</span>Edit party</button>
                        <button onClick={() => rowAction('view', p)}><span className="material-symbols-outlined">visibility</span>View details</button>
                        <button onClick={() => { setRowMenuForId(null); setProfileId(p.id); }}><span className="material-symbols-outlined">account_circle</span>Open profile</button>
                        <button onClick={() => rowAction('email', p)}><span className="material-symbols-outlined">mail</span>Email</button>
                        <div className="sep"></div>
                        <div className="menu-header">Roles</div>
                        <button onClick={() => rowAction('add-role', p)}><span className="material-symbols-outlined">add</span>Add role…</button>
                        <div className="sep"></div>
                        <button className="danger" onClick={() => rowAction('archive', p)}><span className="material-symbols-outlined">archive</span>Archive</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="px-4 py-2 flex items-center justify-between border-t border-surface-dim text-[11px] text-on-surface-variant">
          <span>Rows per page:
            <select className="border border-surface-dim rounded px-1 py-0.5 bg-white" onChange={() => onToast('Rows per page updated')}><option>25</option><option>50</option><option>75</option><option>100</option></select>
          </span>
          <div className="flex items-center gap-2">
            <button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => onToast('Previous page')}><span className="material-symbols-outlined text-[16px]">chevron_left</span></button>
            <span>Page 1 of 1</span>
            <button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => onToast('Next page')}><span className="material-symbols-outlined text-[16px]">chevron_right</span></button>
          </div>
        </div>
      </div>

      {/* Click-away for row menu */}
      {rowMenuForId && <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setRowMenuForId(null)} />}

      {/* Create split menu */}
      {createMenuOpen && (
        <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4 }} onClick={() => setCreateMenuOpen(false)}>
          <div className="menu-header">New party</div>
          {ALL_ROLES.map(r => (
            <button key={r} onClick={() => openDrawer(null, r)}>
              <span className="material-symbols-outlined">{r === 'Customer' ? 'person_add' : r === 'Vendor' ? 'storefront' : r === 'Supplier' ? 'factory' : r === 'Lead' ? 'flag' : 'contacts'}</span>{r}
            </button>
          ))}
        </div>
      )}

      {/* Peek drawer */}
      {peek && (
        <>
          <div className="drawer-scrim open" onClick={() => setPeekId(null)} />
          <div className="peek open">
            <div className="flex items-center justify-between px-4 h-12 border-b border-surface-dim bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
                <span className="text-headline-sm truncate">{peek.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="h-7 px-2.5 rounded bg-primary text-white text-label-sm hover:bg-primary-container flex items-center gap-1" onClick={() => { const id = peek.id; setPeekId(null); setProfileId(id); }}><span className="material-symbols-outlined text-[14px]">account_circle</span>Open</button>
                <button className="h-7 px-2.5 rounded border border-surface-dim text-label-sm hover:bg-surface-container-low flex items-center gap-1" onClick={() => { const id = peek.id; setPeekId(null); openDrawer(id); }}><span className="material-symbols-outlined text-[14px]">edit</span>Edit</button>
                <button className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center" onClick={() => setPeekId(null)}><span className="material-symbols-outlined text-[18px]">close</span></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-body-sm">
              <div className="mb-4 flex items-center gap-2">{peek.roles.map(r => rolePill(r))}</div>
              <dl className="text-body-sm mb-4">
                <div className="kv"><dt>Company</dt><dd>{peek.name}</dd></div>
                <div className="kv"><dt>Contact name</dt><dd>{peek.name}</dd></div>
                <div className="kv"><dt>Email</dt><dd><a href={`mailto:${peek.email}`} className="text-primary hover:underline">{peek.email}</a></dd></div>
                <div className="kv"><dt>Phone</dt><dd>{peek.phone}</dd></div>
                <div className="kv"><dt>Address</dt><dd className="text-right">{peek.address}</dd></div>
                <div className="kv"><dt>Open balance</dt><dd className={peek.balance > 0 ? 'text-error' : peek.balance < 0 ? 'text-qb-blue' : ''}>{peek.balance !== 0 ? fmt(peek.balance) : '—'}</dd></div>
                <div className="kv"><dt>Added</dt><dd>{peek.added}</dd></div>
              </dl>
              <div className="mt-4 pt-3 border-t border-surface-dim grid grid-cols-2 gap-2">
                <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container flex items-center justify-center gap-1" onClick={() => { const id = peek.id; setPeekId(null); setProfileId(id); }}><span className="material-symbols-outlined text-[16px]">account_circle</span>Open profile</button>
                <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center justify-center gap-1" onClick={() => { const id = peek.id; setPeekId(null); openDrawer(id); }}><span className="material-symbols-outlined text-[16px]">edit</span>Edit</button>
                <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center justify-center gap-1 col-span-2" onClick={() => onToast(`Composing email to ${peek.email}`)}><span className="material-symbols-outlined text-[16px]">mail</span>Email</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Party Drawer — the ONE canonical create/edit experience, shared
          with the CRM overview, Customers, Vendors and Suppliers screens. */}
      <PartyFormDrawer
        open={drawerOpen}
        editing={editingId ? (() => {
          const p = items.find(x => x.id === editingId);
          return p ? { id: p.id, source: p.source, name: p.name, email: p.email, phone: p.phone, address: p.address, roles: p.roles } : null;
        })() : null}
        preselectRole={drawerPreselect}
        onClose={closeDrawer}
        onSaved={drawerSaved}
        onToast={onToast}
      />

      {/* Save view modal */}
      {saveViewOpen && (
        <div className="modal-scrim open" onClick={() => setSaveViewOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-headline-sm mb-1">Save current view</h3>
            <p className="text-body-sm text-on-surface-variant mb-3">Name this combination of filters so you can reuse it.</p>
            <input className="field-input mb-3" placeholder="e.g. Vendors with open bills" value={saveViewName} onChange={e => setSaveViewName(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={() => setSaveViewOpen(false)}>Cancel</button>
              <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container" onClick={saveCurrentView}>Save view</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
