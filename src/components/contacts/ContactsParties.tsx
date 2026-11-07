'use client';
/* ContactsParties — 1:1 port of upload/Contacts_extracted/Contacts/parties.html
   Global CSS classes from marketing.css + contacts.css.
   Row click → peek (View details). Name/avatar click → full profile view. */
import { useMemo, useState } from 'react';
import { exportToCsv } from '@/lib/csvExport';
import CustomersScreen from './CustomersScreen';

interface ContactsPartiesProps {
  onToast: (m: string) => void;
  onNavigate?: (d: string, s: string) => void;
}

/* ─── helpers ─── */
function fmt(n: number) { return (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function initials(name: string) { return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '??'; }

/* ─── data ─── */
const ALL_ROLES = ['Customer', 'Vendor', 'Supplier', 'Contact'];

interface Party {
  id: string; name: string; displayName: string; firstName: string; lastName: string;
  email: string; phone: string; roles: string[]; balance: number; added: string; address: string;
}

const INITIAL_PARTIES: Party[] = [
  { id: 'P-1001', name: 'Acme Corp', displayName: 'Acme', firstName: 'John', lastName: 'Doe', email: 'john@acme.com', phone: '+1 (555) 111-2222', roles: ['Customer'], balance: 1240.00, added: '2026-10-15', address: '123 Main St, Springfield, IL 62701' },
  { id: 'P-1002', name: 'Blue Ridge Co.', displayName: 'Blue Ridge', firstName: 'Sarah', lastName: 'Smith', email: 'sarah@blueridge.co', phone: '+1 (555) 333-4444', roles: ['Customer', 'Vendor'], balance: 0, added: '2026-08-02', address: '456 Ridge Rd, Asheville, NC 28801' },
  { id: 'P-1003', name: 'Printful Inc.', displayName: 'Printful', firstName: 'Print', lastName: 'Fulfillment', email: 'support@printful.com', phone: '+1 (555) 000-1111', roles: ['Supplier'], balance: -2880.00, added: '2026-01-10', address: '789 Print Ave, Charlotte, NC 28202' },
  { id: 'P-1004', name: 'Gelato Pty Ltd', displayName: 'Gelato', firstName: 'Gelato', lastName: 'Support', email: 'help@gelato.com', phone: '+61 2 8000 0000', roles: ['Supplier'], balance: -1200.00, added: '2026-03-22', address: '10 George St, Sydney NSW 2000, Australia' },
  { id: 'P-1005', name: 'Jane Miller', displayName: 'Jane', firstName: 'Jane', lastName: 'Miller', email: 'jane.miller@email.com', phone: '+1 (555) 777-8888', roles: ['Contact'], balance: 0, added: '2026-09-01', address: '101 Elm St, Austin, TX 78701' },
  { id: 'P-1006', name: 'Staples', displayName: 'Staples', firstName: 'Office', lastName: 'Supplies', email: 'billing@staples.com', phone: '+1 (800) 333-3333', roles: ['Vendor'], balance: -142.50, added: '2026-05-14', address: '500 Staples Dr, Framingham, MA 01702' },
];

interface SavedView { id: string; name: string; tab: string; q: string; roles: string[]; }

const INITIAL_VIEWS: SavedView[] = [
  { id: 'sv-1', name: 'Customers', tab: 'Customers', q: '', roles: ['Customer'] },
  { id: 'sv-2', name: 'Suppliers', tab: 'Suppliers', q: '', roles: ['Supplier'] },
];

function rolePill(r: string) {
  const cls = r === 'Customer' ? 'customer' : r === 'Vendor' ? 'vendor' : r === 'Supplier' ? 'supplier' : 'contact';
  return <span className={`pill role ${cls}`}>{r}</span>;
}
function avatarClass(roles: string[]) {
  if (roles.includes('Vendor')) return 'vendor';
  if (roles.includes('Supplier')) return 'supplier';
  if (roles.includes('Contact')) return 'contact';
  return '';
}

const EMPTY_FORM = { name: '', display: '', first: '', last: '', email: '', phone: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'United States', notes: '' };

export default function ContactsParties({ onToast }: ContactsPartiesProps) {
  const [items, setItems] = useState<Party[]>(INITIAL_PARTIES);
  const [savedViews, setSavedViews] = useState<SavedView[]>(INITIAL_VIEWS);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('All');
  const [roles, setRoles] = useState<Set<string>>(new Set(ALL_ROLES));
  const [draftRoles, setDraftRoles] = useState<Set<string>>(new Set(ALL_ROLES));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rowMenuForId, setRowMenuForId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [popRoleOpen, setPopRoleOpen] = useState(false);
  const [popSavedOpen, setPopSavedOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [currentDraftRoles, setCurrentDraftRoles] = useState<Set<string>>(new Set());
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

  // Full profile view — renders CustomersScreen in detail mode (full page, 8 tabs).
  // This must come AFTER all hooks (useState/useMemo) to satisfy React's rules-of-hooks.
  if (profileId) {
    return <CustomersScreen onToast={onToast} onNavigate={onNavigate} initialView="detail" />;
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
    const editing = id ? items.find(p => p.id === id) : null;
    setEditingId(id);
    setForm(editing ? { ...EMPTY_FORM, name: editing.name, display: editing.displayName, first: editing.firstName, last: editing.lastName, email: editing.email, phone: editing.phone, street1: editing.address } : EMPTY_FORM);
    setCurrentDraftRoles(new Set(preselectRole ? [preselectRole] : (editing ? editing.roles : [])));
    setDrawerOpen(true);
    setPeekId(null);
    setRowMenuForId(null);
    setCreateMenuOpen(false);
  }
  function closeDrawer() { setDrawerOpen(false); setEditingId(null); }

  function toggleDraftRole(role: string) {
    setCurrentDraftRoles(prev => { const n = new Set(prev); if (n.has(role)) n.delete(role); else n.add(role); return n; });
  }

  function collectParty(): Party | null {
    const name = form.name.trim();
    if (!name) { onToast('Company name is required'); return null; }
    if (currentDraftRoles.size === 0) { onToast('Select at least one role'); return null; }
    const editing = editingId ? items.find(p => p.id === editingId) : null;
    return {
      id: editing ? editing.id : 'P-' + String(items.length + 1001).slice(-4),
      name, displayName: form.display, firstName: form.first, lastName: form.last,
      email: form.email, phone: form.phone, roles: [...currentDraftRoles],
      address: form.street1 + (form.city ? ', ' + form.city : ''),
      balance: editing ? editing.balance : 0,
      added: editing ? editing.added : new Date().toISOString().slice(0, 10),
    };
  }
  function save() {
    const p = collectParty(); if (!p) return;
    setItems(prev => { if (editingId) { const i = prev.findIndex(x => x.id === editingId); if (i >= 0) { const n = [...prev]; n[i] = p; return n; } return prev; } return [p, ...prev]; });
    closeDrawer();
    onToast(editingId ? 'Party updated' : 'Party created');
  }
  function saveAndNew() {
    const p = collectParty(); if (!p) return;
    setItems(prev => { if (editingId) { const i = prev.findIndex(x => x.id === editingId); if (i >= 0) { const n = [...prev]; n[i] = p; return n; } return prev; } return [p, ...prev]; });
    setEditingId(null); setForm(EMPTY_FORM); setCurrentDraftRoles(new Set());
    onToast('Saved. New party form ready.');
  }

  function rowAction(act: string, p: Party) {
    setRowMenuForId(null);
    switch (act) {
      case 'edit': openDrawer(p.id); break;
      case 'view': openPeek(p.id); break;
      case 'email': onToast(`Composing email to ${p.email}`); break;
      case 'add-role': openDrawer(p.id); break;
      case 'archive': if (confirm(`Archive "${p.name}"?`)) { setItems(prev => prev.filter(x => x.id !== p.id)); onToast(`Archived: ${p.name}`); } break;
    }
  }

  function bulkAction(act: string) {
    if (act === 'close') { setSelected(new Set()); return; }
    const sel = [...selected]; const n = sel.length;
    if (act === 'email') { onToast(`Composing bulk email to ${n} parties`); }
    else if (act === 'merge') { onToast(`Merge ${n} parties… (requires selection of 2+)`); }
    else if (act === 'archive') { setItems(prev => prev.filter(p => !sel.includes(p.id))); onToast(`Archived ${n} parties`); }
    else if (act === 'delete') { if (confirm(`Delete ${n} parties?`)) { setItems(prev => prev.filter(p => !sel.includes(p.id))); onToast(`Deleted ${n} parties`); } }
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
          {['All', 'Customers', 'Vendors', 'Suppliers', 'Contacts'].map(t => (
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
              <span className="material-symbols-outlined">{r === 'Customer' ? 'person_add' : r === 'Vendor' ? 'storefront' : r === 'Supplier' ? 'factory' : 'contacts'}</span>{r}
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
                <div className="kv"><dt>Contact name</dt><dd>{peek.firstName} {peek.lastName}</dd></div>
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

      {/* Party Drawer */}
      {drawerOpen && (
        <>
          <div className="drawer-scrim open" onClick={closeDrawer} />
          <div className="drawer open">
            <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
                <div className="min-w-0">
                  <div className="text-headline-sm truncate">{editingId ? 'Edit party' : 'New party'}</div>
                  <div className="text-[11px] text-on-surface-variant">{editingId ? editingId : 'Add details and assign roles.'}</div>
                </div>
              </div>
              <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" onClick={closeDrawer}><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Role Chips */}
              <section>
                <div className="section-h">Roles</div>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map(r => (
                    <button key={r} className={`role-chip-btn ${currentDraftRoles.has(r) ? 'selected' : ''}`} onClick={() => toggleDraftRole(r)}>
                      <span className="material-symbols-outlined text-[16px]">{r === 'Customer' ? 'person' : r === 'Vendor' ? 'storefront' : r === 'Supplier' ? 'factory' : 'contacts'}</span>{r}
                    </button>
                  ))}
                </div>
              </section>

              {/* Names & Contact */}
              <section>
                <div className="section-h">Names &amp; contact</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Company name</label><input className="field-input" placeholder="e.g. Acme Corp" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                    <div><label className="field-label">Display name</label><input className="field-input" placeholder="e.g. Acme" value={form.display} onChange={e => setForm(p => ({ ...p, display: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">First name</label><input className="field-input" placeholder="First" value={form.first} onChange={e => setForm(p => ({ ...p, first: e.target.value }))} /></div>
                    <div><label className="field-label">Last name</label><input className="field-input" placeholder="Last" value={form.last} onChange={e => setForm(p => ({ ...p, last: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Email</label><input className="field-input" type="email" placeholder="name@company.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
                    <div><label className="field-label">Phone</label><input className="field-input" type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <div className="section-h">Address</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="field-label">Street 1</label><input className="field-input" placeholder="Street 1" value={form.street1} onChange={e => setForm(p => ({ ...p, street1: e.target.value }))} /></div>
                  <div><label className="field-label">Street 2</label><input className="field-input" placeholder="Street 2" value={form.street2} onChange={e => setForm(p => ({ ...p, street2: e.target.value }))} /></div>
                  <div><label className="field-label">City</label><input className="field-input" placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
                  <div><label className="field-label">State / Province</label><input className="field-input" placeholder="State" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
                  <div><label className="field-label">ZIP / Postal</label><input className="field-input" placeholder="ZIP" value={form.zip} onChange={e => setForm(p => ({ ...p, zip: e.target.value }))} /></div>
                  <div><label className="field-label">Country</label><select className="field-input" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}><option>United States</option><option>Canada</option><option>United Kingdom</option><option>Australia</option></select></div>
                </div>
              </section>

              {/* Role-specific sections */}
              {currentDraftRoles.has('Customer') && (
                <div className="role-section">
                  <div className="text-label-sm font-bold text-primary mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">person</span>Customer details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Terms</label><select className="field-input"><option>Net 30</option><option>Net 15</option><option>Due on receipt</option></select></div>
                    <div><label className="field-label">Credit limit</label><input className="field-input" placeholder="$0.00" /></div>
                  </div>
                  <label className="flex items-center gap-2 mt-3 text-body-sm"><input type="checkbox" className="row-check" /> Marketing consent</label>
                </div>
              )}
              {currentDraftRoles.has('Vendor') && (
                <div className="role-section">
                  <div className="text-label-sm font-bold text-qb-blue mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">storefront</span>Vendor details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Terms</label><select className="field-input"><option>Net 30</option><option>Net 15</option><option>Due on receipt</option></select></div>
                    <div><label className="field-label">Default expense account</label><input className="field-input" placeholder="Select account…" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><label className="field-label">Tax ID</label><input className="field-input code-mono" placeholder="XX-XXXXXXX" /></div>
                    <div className="flex items-end"><label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" /> Track for 1099</label></div>
                  </div>
                </div>
              )}
              {currentDraftRoles.has('Supplier') && (
                <div className="role-section">
                  <div className="text-label-sm font-bold text-error mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">factory</span>Supplier details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Account no.</label><input className="field-input code-mono" placeholder="SUP-000" /></div>
                    <div><label className="field-label">Lead time (days)</label><input className="field-input" placeholder="e.g. 7" /></div>
                  </div>
                  <div className="mt-3"><label className="field-label">Catalog / API URL</label><input className="field-input code-mono" placeholder="https://supplier.com/api" /></div>
                </div>
              )}
              {currentDraftRoles.has('Contact') && (
                <div className="role-section">
                  <div className="text-label-sm font-bold text-qb-maroon mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">contacts</span>Contact details</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="field-label">Company</label><input className="field-input" placeholder="Company name" /></div>
                    <div><label className="field-label">Title</label><input className="field-input" placeholder="Job title" /></div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <section>
                <div className="section-h">Notes &amp; attachments</div>
                <textarea className="field-textarea" placeholder="Add any notes about this party…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                <div className="mt-2 border border-dashed border-surface-dim rounded-lg p-3 text-center cursor-pointer hover:bg-surface-container-low" onClick={() => onToast('Attach a file — file picker')}>
                  <div className="text-[12px] font-semibold text-primary">Attach a file</div>
                </div>
              </section>
            </div>

            <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
              <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={closeDrawer}>Cancel</button>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 border border-surface-dim rounded text-body-md font-semibold hover:bg-surface-container-low" onClick={saveAndNew}>Save and new</button>
                <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container" onClick={save}>Save and close</button>
              </div>
            </div>
          </div>
        </>
      )}

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
