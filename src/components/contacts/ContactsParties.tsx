'use client';

import './contacts.css';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ContactsScreenProps } from './types';
import { CONTACTS_NAV } from './types';

/* ════════════════════════════════════════════════════════════════
   Parties — 1:1 conversion of upload/customer hub Parties.html
   Single source of truth for customer/vendor/contractor/contact data
   ════════════════════════════════════════════════════════════════ */

type RoleKey = 'customer' | 'vendor' | 'supplier' | 'contractor' | 'contact';
type ViewTab = 'all' | RoleKey;

interface Party {
  name: string;
  email: string;
  initials: string;
  color: string;
  roles: RoleKey[];
  orders: number;
  ltv: number;
  balance: number;
  lastOrder: string;
  consent: 'yes' | 'no' | 'unknown';
  status: string;
  source: string;
  openBills: number;
  ytdPaid: number;
  w9: 'on' | 'pending' | 'missing' | 'na';
  tax1099: boolean;
  sla: string;
}

interface PartyFormData {
  company: string;
  display: string;
  first: string;
  middle: string;
  last: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  roles: RoleKey[];
}

interface Column {
  key: string;
  label: string;
  right?: boolean;
  money?: boolean;
}

/* ════════════════════════════════════════════════════════════════
   PARTY DATA — single source (verbatim from source HTML)
   ════════════════════════════════════════════════════════════════ */
const PARTIES: Party[] = [
  // Customer + multi-role examples
  { name: 'Acme Corp', email: 'ap@acme.com', initials: 'A', color: 'bg-qb-blue', roles: ['customer'], orders: 12, ltv: 18240, balance: 1240, lastOrder: '11/01/2026', consent: 'yes', status: 'active', source: 'Referral', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
  { name: 'Blue Ridge Co.', email: 'billing@blueridge.co', initials: 'B', color: 'bg-qb-green', roles: ['customer'], orders: 5, ltv: 9810, balance: 0, lastOrder: '10/28/2026', consent: 'yes', status: 'recurring', source: 'Website', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
  { name: 'Maple Supply', email: 'ar@maplesupply.io', initials: 'M', color: 'bg-qb-maroon', roles: ['customer', 'supplier'], orders: 2, ltv: 1780, balance: 890, lastOrder: '10/15/2026', consent: 'no', status: 'followup', source: 'Marketplace', openBills: 1200, ytdPaid: 4100, w9: 'on', tax1099: true, sla: '98.9%' },
  { name: 'Northwind Labs', email: 'finance@northwind.io', initials: 'N', color: 'bg-qb-teal', roles: ['customer'], orders: 4, ltv: 7420, balance: 2100, lastOrder: '10/02/2026', consent: 'yes', status: 'active', source: 'Outbound', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
  { name: 'Orion Apparel', email: 'hello@orionapparel.com', initials: 'O', color: 'bg-qb-navy', roles: ['customer'], orders: 3, ltv: 3890, balance: 0, lastOrder: '09/20/2026', consent: 'unknown', status: 'inactive', source: 'Referral', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
  { name: 'Lakeside Design', email: 'hello@lakeside.design', initials: 'L', color: 'bg-qb-blue', roles: ['customer', 'contractor'], orders: 1, ltv: 1850, balance: 1850, lastOrder: '09/05/2026', consent: 'yes', status: 'active', source: 'Website', openBills: 0, ytdPaid: 1850, w9: 'on', tax1099: true, sla: '—' },
  { name: 'Sokolov Studio', email: 'elena@sokolov.studio', initials: 'S', color: 'bg-qb-green', roles: ['customer', 'contractor'], orders: 1, ltv: 2400, balance: 0, lastOrder: '11/01/2026', consent: 'yes', status: 'new', source: 'Referral', openBills: 0, ytdPaid: 2400, w9: 'missing', tax1099: true, sla: '—' },
  // Vendors
  { name: 'Printful', email: 'billing@printful.com', initials: 'P', color: 'bg-qb-blue', roles: ['supplier', 'vendor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Integration', openBills: 2880, ytdPaid: 12410, w9: 'on', tax1099: true, sla: '99.1%' },
  { name: 'Gelato', email: 'billing@gelato.com', initials: 'G', color: 'bg-qb-green', roles: ['supplier', 'vendor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Integration', openBills: 1200, ytdPaid: 6240, w9: 'on', tax1099: true, sla: '98.4%' },
  { name: 'Printify', email: 'accounts@printify.com', initials: 'P', color: 'bg-qb-maroon', roles: ['supplier', 'vendor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Integration', openBills: 640, ytdPaid: 4180, w9: 'pending', tax1099: true, sla: '99.6%' },
  { name: 'Adobe', email: 'billing@adobe.com', initials: 'A', color: 'bg-qb-maroon', roles: ['vendor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Integration', openBills: 719, ytdPaid: 719, w9: 'on', tax1099: false, sla: '—' },
  { name: 'Knoxville Utilities Board', email: 'billing@kub.org', initials: 'K', color: 'bg-qb-green', roles: ['vendor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'no', status: 'active', source: 'Manual', openBills: 0, ytdPaid: 384, w9: 'na', tax1099: false, sla: '—' },
  // Contractors
  { name: 'Dana Whitfield', email: 'dana@whitfield.dev', initials: 'D', color: 'bg-qb-teal', roles: ['contractor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Referral', openBills: 0, ytdPaid: 3200, w9: 'on', tax1099: true, sla: '—' },
  { name: 'Raj Patel Consulting', email: 'raj@rpc.dev', initials: 'R', color: 'bg-qb-navy', roles: ['contractor'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Referral', openBills: 0, ytdPaid: 740, w9: 'missing', tax1099: false, sla: '—' },
  // Contacts
  { name: 'Marcus Lee', email: 'marcus@managekube.io', initials: 'M', color: 'bg-qb-blue', roles: ['contact'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Internal', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
  { name: 'Priya Nair', email: 'priya@managekube.io', initials: 'P', color: 'bg-qb-green', roles: ['contact'], orders: 0, ltv: 0, balance: 0, lastOrder: '—', consent: 'yes', status: 'active', source: 'Internal', openBills: 0, ytdPaid: 0, w9: 'na', tax1099: false, sla: '—' },
];

const PARTY_DATA: Record<string, PartyFormData> = {
  'Acme Corp': { company: 'Acme Corp', display: 'Acme Corp', first: '', middle: '', last: '', email: 'ap@acme.com', phone: '+1 (415) 220-9100', website: 'acme.com', street: '1 Market St', city: 'San Francisco', state: 'CA', zip: '94105', roles: ['customer'] },
  'Blue Ridge Co.': { company: 'Blue Ridge Co.', display: 'Blue Ridge Co.', first: '', middle: '', last: '', email: 'billing@blueridge.co', phone: '+1 (828) 550-1234', website: 'blueridge.co', street: '22 Park Ave', city: 'Asheville', state: 'NC', zip: '28801', roles: ['customer'] },
  'Maple Supply': { company: 'Maple Supply', display: 'Maple Supply', first: '', middle: '', last: '', email: 'ar@maplesupply.io', phone: '+1 (416) 555-0180', website: 'maplesupply.io', street: '100 King St', city: 'Toronto', state: 'ON', zip: 'M5X 1A9', roles: ['customer', 'supplier'] },
  'Northwind Labs': { company: 'Northwind Labs', display: 'Northwind Labs', first: '', middle: '', last: '', email: 'finance@northwind.io', phone: '+1 (206) 550-9090', website: 'northwind.io', street: '400 5th Ave', city: 'Seattle', state: 'WA', zip: '98104', roles: ['customer'] },
  'Orion Apparel': { company: 'Orion Apparel', display: 'Orion Apparel', first: '', middle: '', last: '', email: 'hello@orionapparel.com', phone: '+1 (212) 440-7722', website: 'orionapparel.com', street: '75 Broadway', city: 'New York', state: 'NY', zip: '10006', roles: ['customer'] },
  'Lakeside Design': { company: 'Lakeside Design LLC', display: 'Lakeside Design', first: '', middle: '', last: '', email: 'hello@lakeside.design', phone: '+1 (615) 220-4433', website: 'lakeside.design', street: '1024 Elm St', city: 'Nashville', state: 'TN', zip: '37207', roles: ['customer', 'contractor'] },
  'Sokolov Studio': { company: 'Sokolov Studio', display: 'Sokolov Studio', first: '', middle: '', last: '', email: 'elena@sokolov.studio', phone: '+1 (512) 441-7788', website: 'sokolov.studio', street: '800 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', roles: ['customer', 'contractor'] },
  'Printful': { company: 'Printful, Inc.', display: 'Printful', first: '', middle: '', last: '', email: 'billing@printful.com', phone: '+1 (704) 802-5600', website: 'printful.com', street: '3335 Ringsby Court', city: 'Charlotte', state: 'NC', zip: '28206', roles: ['supplier', 'vendor'] },
  'Gelato': { company: 'Gelato', display: 'Gelato', first: '', middle: '', last: '', email: 'billing@gelato.com', phone: '+47 23 96 30 50', website: 'gelato.com', street: 'Drammensveien 145', city: 'Oslo', state: 'NO', zip: '0277', roles: ['supplier', 'vendor'] },
  'Printify': { company: 'Printify, Inc.', display: 'Printify', first: '', middle: '', last: '', email: 'accounts@printify.com', phone: '+1 (415) 562-4100', website: 'printify.com', street: '600 California St', city: 'San Francisco', state: 'CA', zip: '94108', roles: ['supplier', 'vendor'] },
  'Adobe': { company: 'Adobe Inc.', display: 'Adobe', first: '', middle: '', last: '', email: 'billing@adobe.com', phone: '+1 (800) 833-6687', website: 'adobe.com', street: '345 Park Ave', city: 'San Jose', state: 'CA', zip: '95110', roles: ['vendor'] },
  'Knoxville Utilities Board': { company: 'Knoxville Utilities Board', display: 'KUB', first: '', middle: '', last: '', email: 'billing@kub.org', phone: '+1 (865) 524-2911', website: 'kub.org', street: 'P.O. Box 59017', city: 'Knoxville', state: 'TN', zip: '37950', roles: ['vendor'] },
  'Dana Whitfield': { company: '', display: 'Dana Whitfield', first: 'Dana', middle: '', last: 'Whitfield', email: 'dana@whitfield.dev', phone: '', website: '', street: '', city: '', state: '', zip: '', roles: ['contractor'] },
  'Raj Patel Consulting': { company: 'Raj Patel Consulting', display: 'Raj Patel', first: '', middle: '', last: '', email: 'raj@rpc.dev', phone: '+1 (404) 550-9822', website: 'rpc.dev', street: '180 Peachtree', city: 'Atlanta', state: 'GA', zip: '30303', roles: ['contractor'] },
  'Marcus Lee': { company: '', display: 'Marcus Lee', first: 'Marcus', middle: '', last: 'Lee', email: 'marcus@managekube.io', phone: '', website: '', street: '', city: '', state: '', zip: '', roles: ['contact'] },
  'Priya Nair': { company: '', display: 'Priya Nair', first: 'Priya', middle: '', last: 'Nair', email: 'priya@managekube.io', phone: '', website: '', street: '', city: '', state: '', zip: '', roles: ['contact'] },
};

const EMPTY_FORM: PartyFormData = {
  company: '', display: '', first: '', middle: '', last: '', email: '', phone: '', website: '',
  street: '', city: '', state: '', zip: '', roles: [],
};

const COLUMNS: Record<ViewTab, Column[]> = {
  all: [
    { key: 'name', label: 'Party' },
    { key: 'roles', label: 'Roles' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'lastOrder', label: 'Last activity' },
  ],
  customer: [
    { key: 'name', label: 'Customer' },
    { key: 'email', label: 'Email' },
    { key: 'orders', label: 'Orders', right: true },
    { key: 'ltv', label: 'LTV', right: true, money: true },
    { key: 'balance', label: 'Balance', right: true, money: true },
    { key: 'lastOrder', label: 'Last order' },
    { key: 'consent', label: 'Consent' },
    { key: 'source', label: 'Source' },
    { key: 'status', label: 'Status' },
  ],
  vendor: [
    { key: 'name', label: 'Vendor' },
    { key: 'roles', label: 'Roles' },
    { key: 'openBills', label: 'Open bills', right: true, money: true },
    { key: 'ytdPaid', label: 'YTD paid', right: true, money: true },
    { key: 'w9', label: 'W-9' },
    { key: 'tax1099', label: '1099' },
  ],
  supplier: [
    { key: 'name', label: 'Supplier' },
    { key: 'email', label: 'Email' },
    { key: 'openBills', label: 'Open bills', right: true, money: true },
    { key: 'ytdPaid', label: 'YTD paid', right: true, money: true },
    { key: 'sla', label: 'SLA', right: true },
  ],
  contractor: [
    { key: 'name', label: 'Contractor' },
    { key: 'email', label: 'Email' },
    { key: 'ytdPaid', label: 'YTD paid', right: true, money: true },
    { key: 'w9', label: 'W-9' },
    { key: 'tax1099', label: '1099' },
  ],
  contact: [
    { key: 'name', label: 'Contact' },
    { key: 'email', label: 'Email' },
    { key: 'roles', label: 'Roles' },
    { key: 'source', label: 'Source' },
    { key: 'status', label: 'Status' },
  ],
};

const ROLE_HINTS: Record<ViewTab, string> = {
  all: 'Showing all parties. Pick a role tab to see role-specific columns.',
  customer: 'Customer columns: Orders, LTV, Balance, Consent, Source.',
  vendor: 'Vendor columns: Open bills, YTD paid, W-9, 1099.',
  supplier: 'Supplier columns: Open bills, YTD paid, SLA.',
  contractor: 'Contractor columns: YTD paid, W-9, 1099.',
  contact: 'Contact columns: Roles, Source, Status.',
};

const ROLE_CAP: Record<RoleKey, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  supplier: 'Supplier',
  contractor: 'Contractor',
  contact: 'Contact',
};

const TABS: { id: ViewTab; label: string; count: number }[] = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'customer', label: 'Customers', count: 142 },
  { id: 'vendor', label: 'Vendors', count: 42 },
  { id: 'supplier', label: 'Suppliers', count: 12 },
  { id: 'contractor', label: 'Contractors', count: 8 },
  { id: 'contact', label: 'Contacts', count: 4 },
];

function money(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

function statusClass(s: string): 'active' | 'inactive' | 'new' {
  if (s === 'active') return 'active';
  if (s === 'inactive') return 'inactive';
  return 'new';
}

function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ContactsParties({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: ContactsScreenProps) {
  /* ── Toast ── */
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((m: string) => setToastMsg(m), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 1800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);
  useEffect(() => {
    if (toastMsg) onToast(toastMsg);
  }, [toastMsg, onToast]);

  /* ── Parties list + filters ── */
  const [parties, setParties] = useState<Party[]>(PARTIES);
  const [viewTab, setViewTab] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return parties.filter((p) => {
      const tabOk = viewTab === 'all' || p.roles.includes(viewTab);
      const qOk = !q || (p.name + ' ' + p.email).toLowerCase().includes(q);
      return tabOk && qOk;
    });
  }, [parties, viewTab, search]);

  const countText = `${filtered.length} of ${parties.length}`;
  const cols = COLUMNS[viewTab];

  /* ── Selection / bulk bar ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.name));
  const selectedCount = filtered.filter((p) => selected.has(p.name)).length;

  /* ── Party drawer ── */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPartyName, setDrawerPartyName] = useState<string | null>(null);
  const [form, setForm] = useState<PartyFormData>(EMPTY_FORM);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set());

  /* ── New split menu ── */
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuPos, setNewMenuPos] = useState({ top: 0, left: 0 });
  const newSplitRef = useRef<HTMLButtonElement | null>(null);

  /* ── Row ⋯ menu ── */
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuParty, setRowMenuParty] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });

  const isNewParty = drawerPartyName === null;
  const drawerTitle = isNewParty ? 'New party' : form.display || drawerPartyName;
  const drawerSub = isNewParty
    ? 'Party record · §B2 · role chips stackable'
    : `${form.company || form.display || drawerPartyName} · roles: ${form.roles.map((r) => ROLE_CAP[r]).join(' + ')}`;

  /* ═══════════ Actions ═══════════ */

  const openPartyDrawer = useCallback((name: string | null, preselectRole?: RoleKey) => {
    setDrawerPartyName(name);
    if (name) {
      const d = PARTY_DATA[name] || EMPTY_FORM;
      setForm({ ...EMPTY_FORM, ...d });
      setActiveRoles(new Set<string>(d.roles.map((r) => ROLE_CAP[r])));
    } else {
      setForm(EMPTY_FORM);
      setActiveRoles(preselectRole ? new Set<string>([ROLE_CAP[preselectRole]]) : new Set<string>());
    }
    setDrawerOpen(true);
  }, []);

  const closePartyDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleRoleChipToggle = (role: string) => {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const updateField = (patch: Partial<PartyFormData>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const saveParty = (andNew: boolean) => {
    const company = form.company.trim();
    const display = form.display.trim() || company;
    const email = form.email.trim();
    const activeRolesArr = Array.from(activeRoles).map((r) => r.toLowerCase() as RoleKey);
    if (!display) {
      showToast('Display name required');
      return;
    }
    if (activeRolesArr.length === 0) {
      showToast('Select at least one role');
      return;
    }

    if (drawerPartyName) {
      setParties((prev) =>
        prev.map((p) =>
          p.name === drawerPartyName
            ? { ...p, name: display, email, roles: activeRolesArr }
            : p,
        ),
      );
      showToast(`"${display}" saved`);
    } else {
      const initials = display
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      const newRow: Party = {
        name: display,
        email,
        initials,
        color: 'bg-qb-blue',
        roles: activeRolesArr,
        orders: 0,
        ltv: 0,
        balance: 0,
        lastOrder: '—',
        consent: 'yes',
        status: 'new',
        source: 'Manual',
        openBills: 0,
        ytdPaid: 0,
        w9: 'na',
        tax1099: false,
        sla: '—',
      };
      setParties((prev) => [newRow, ...prev]);
      showToast(`"${display}" added`);
    }

    if (andNew) {
      openPartyDrawer(null);
    } else {
      setDrawerOpen(false);
    }
  };

  /* ── Tab switching ── */
  const handleTab = (tab: ViewTab) => {
    setViewTab(tab);
    setSelected(new Set());
  };

  /* ── KPI clicks → tab (multirole → 'all') ── */
  const handleKpi = (kpi: string) => {
    const tab: ViewTab = kpi === 'multirole' ? 'all' : (kpi as ViewTab);
    if (COLUMNS[tab]) handleTab(tab);
  };

  /* ── New split menu ── */
  const handleNewSplit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setNewMenuPos({
      top: r.bottom + 4,
      left: Math.min(r.right - 240, window.innerWidth - 260),
    });
    setNewMenuOpen((v) => !v);
  };

  const handleNewMenuKind = (kind: string) => {
    setNewMenuOpen(false);
    if (kind === 'Import CSV') {
      showToast('Import parties from CSV');
      return;
    }
    const roleKey = kind.toLowerCase() as RoleKey;
    openPartyDrawer(null, roleKey);
  };

  /* ── Create action chips ── */
  const handleCreateChip = (kind: string) => {
    const roleKey = kind.toLowerCase() as RoleKey;
    openPartyDrawer(null, roleKey);
  };

  /* ── Top action buttons ── */
  const handleExport = () => showToast('Exporting parties…');
  const handleCustomize = () => showToast('Customize panel — Data / Visual tabs');
  const handleShowAll = () => onOpenCreateFlyout();

  /* ── Filter bar (no source handler) ── */
  const handleFilterBtn = () => showToast('Filter panel…');
  const handleSavedViews = () => showToast('Saved views…');

  /* ── Row click + ⋯ menu ── */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, p: Party) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.closest('input,button,[data-row-menu]')) return;
    openPartyDrawer(p.name);
  };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, p: Party) => {
    e.stopPropagation();
    setRowMenuParty(p.name);
    const r = e.currentTarget.getBoundingClientRect();
    setRowMenuPos({
      top: r.bottom + 4,
      left: Math.min(r.right - 250, window.innerWidth - 270),
    });
    setRowMenuOpen(true);
  };

  const handleRowAction = (act: string) => {
    const name = rowMenuParty;
    setRowMenuOpen(false);
    if (!name) return;
    switch (act) {
      case 'view':
      case 'edit':
      case 'add-role':
        openPartyDrawer(name);
        break;
      case 'create-invoice':
        onCreate('Invoice');
        showToast(`New invoice for ${name}`);
        break;
      case 'create-estimate':
        onCreate('Estimate');
        showToast(`New estimate for ${name}`);
        break;
      case 'create-bill':
        onCreate('Bill');
        showToast(`New bill for ${name}`);
        break;
      case 'email':
        showToast(`Email ${name}`);
        break;
      case 'note':
        showToast(`Note added to ${name}`);
        break;
      case 'delete': {
        setParties((prev) => prev.filter((x) => x.name !== name));
        showToast(`${name} deleted`);
        break;
      }
      default:
        break;
    }
  };

  /* ── Selection / bulk ── */
  const toggleRow = (name: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filtered.map((p) => p.name)));
    } else {
      setSelected(new Set());
    }
  };

  const handleBulk = (act: string) => {
    if (act === 'close') {
      setSelected(new Set());
      return;
    }
    const n = selectedCount;
    const noun = n !== 1 ? 'parties' : 'party';
    const label = act.charAt(0).toUpperCase() + act.slice(1);
    if (act === 'delete') {
      setParties((prev) => prev.filter((p) => !selected.has(p.name)));
      showToast(`Delete on ${n} ${noun}`);
      setSelected(new Set());
      return;
    }
    showToast(`${label} on ${n} ${noun}`);
    setSelected(new Set());
  };

  /* ── data-goto links (Customers / Vendors) — navigate, don't toast ── */
  const handleGoto = (target: 'customers' | 'vendors') => {
    if (target === 'customers') {
      onNavigate(...CONTACTS_NAV.customers());
    } else {
      onNavigate(...CONTACTS_NAV.vendors());
    }
  };

  /* ── Outside click + Escape ── */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (!tgt) return;
      if (rowMenuOpen && !tgt.closest('#row-menu') && !tgt.closest('[data-row-menu]')) {
        setRowMenuOpen(false);
      }
      if (newMenuOpen && !tgt.closest('#new-menu') && !tgt.closest('[data-new-split]')) {
        setNewMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawerOpen) setDrawerOpen(false);
        if (rowMenuOpen) setRowMenuOpen(false);
        if (newMenuOpen) setNewMenuOpen(false);
      }
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [drawerOpen, rowMenuOpen, newMenuOpen]);

  /* ═══════════ Cell renderers ═══════════ */

  const renderCell = (p: Party, c: Column): React.ReactNode => {
    switch (c.key) {
      case 'name':
        return (
          <div className="flex items-center gap-2">
            <div className={`p-avatar ${p.color}`}>{p.initials}</div>
            <div className="min-w-0">
              <div className="font-medium truncate">{p.name}</div>
            </div>
          </div>
        );
      case 'roles':
        return (
          <>
            {p.roles.map((r) => (
              <span key={r} className={`role-chip ${r}`}>
                {r}
              </span>
            ))}
          </>
        );
      case 'status':
        return (
          <span className={`pstatus ${statusClass(p.status)}`}>{statusLabel(p.status)}</span>
        );
      case 'consent':
        if (p.consent === 'yes')
          return (
            <span className="consent yes">
              <span className="material-symbols-outlined text-[10px]">check</span>Opted in
            </span>
          );
        if (p.consent === 'no')
          return (
            <span className="consent no">
              <span className="material-symbols-outlined text-[10px]">close</span>Opted out
            </span>
          );
        return <span className="consent unknown">Unknown</span>;
      case 'w9':
        if (p.w9 === 'on')
          return (
            <span className="consent yes">
              <span className="material-symbols-outlined text-[10px]">check</span>On file
            </span>
          );
        if (p.w9 === 'pending')
          return (
            <span className="consent unknown" style={{ background: '#fff4dc', color: '#8a5a00' }}>
              Requested
            </span>
          );
        if (p.w9 === 'missing')
          return (
            <span className="consent no">
              <span className="material-symbols-outlined text-[10px]">warning</span>Missing
            </span>
          );
        return <span className="consent unknown">N/A</span>;
      case 'tax1099':
        return p.tax1099 ? (
          <span className="text-[11px] text-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">check_circle</span>Eligible
          </span>
        ) : (
          <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">remove</span>Not eligible
          </span>
        );
      default: {
        const raw = (p as unknown as Record<string, unknown>)[c.key];
        if (c.money && typeof raw === 'number') return money(raw);
        return raw as React.ReactNode;
      }
    }
  };

  const isMutedCol = (key: string) =>
    key === 'email' || key === 'lastOrder' || key === 'source';

  /* ═══════════ Render ═══════════ */

  return (
    <div className="contacts-page bg-background font-sans text-body-md text-on-surface antialiased">
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">groups</span>
          <span className="text-label-md font-semibold">Contacts</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Parties</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">All</span>
        </div>
      </div>

      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-headline-lg">Parties</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                <span className="material-symbols-outlined text-[11px]">hub</span>Master list
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Every person or company in the books — one record, stackable roles · §B2
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
                onClick={() => openPartyDrawer(null)}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>New party
              </button>
              <button
                type="button"
                ref={newSplitRef}
                className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
                data-new-split
                onClick={handleNewSplit}
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <button
              type="button"
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              onClick={handleExport}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export
            </button>
            <button
              type="button"
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              onClick={handleCustomize}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>Customize
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5">
          {(
            [
              { kpi: 'all', label: 'Total parties', value: '184' },
              { kpi: 'customer', label: 'Customers', value: '142' },
              { kpi: 'vendor', label: 'Vendors', value: '42' },
              { kpi: 'contractor', label: 'Contractors', value: '8' },
              { kpi: 'multirole', label: 'Multi-role', value: '6' },
            ] as const
          ).map((card) => (
            <button
              type="button"
              key={card.kpi}
              className="text-left bg-white rounded-xl border border-surface-dim p-4 hover:border-primary"
              data-kpi={card.kpi}
              onClick={() => handleKpi(card.kpi)}
            >
              <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                {card.label}
              </div>
              <div className="text-headline-sm mt-1 tabular-nums">{card.value}</div>
            </button>
          ))}
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">
            Create actions:
          </span>
          {(
            [
              { kind: 'Customer', icon: 'person_add' },
              { kind: 'Vendor', icon: 'domain_add' },
              { kind: 'Supplier', icon: 'factory' },
              { kind: 'Contractor', icon: 'engineering' },
              { kind: 'Contact', icon: 'badge' },
            ] as const
          ).map((chip) => (
            <button
              type="button"
              key={chip.kind}
              className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
              data-new={chip.kind}
              onClick={() => handleCreateChip(chip.kind)}
            >
              <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>
              {chip.kind}
            </button>
          ))}
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
            data-open-create
            onClick={handleShowAll}
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">
          {/* ROLE TABS */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`h-full px-3 text-label-md tab-underline ${
                  viewTab === t.id ? 'active' : 'text-on-surface-variant'
                }`}
                data-viewtab={t.id}
                onClick={() => handleTab(t.id)}
              >
                {t.label}
                {t.id !== 'all' && (
                  <span className="ml-1 text-[10px] text-outline">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Role-specific action strip */}
          <div className="px-4 py-2 bg-surface-container-low border-b border-surface-dim flex items-center gap-3 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] text-qb-blue">info</span>
            <span>{ROLE_HINTS[viewTab]}</span>
          </div>

          {/* Filter bar */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary"
                placeholder="Filter by name, email…"
              />
            </div>
            <button
              type="button"
              className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1"
              onClick={handleFilterBtn}
            >
              <span className="material-symbols-outlined text-[14px]">filter_list</span>Filter
            </button>
            <button
              type="button"
              className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1"
              onClick={handleSavedViews}
            >
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            <span className="ml-auto text-[11px] text-on-surface-variant">{countText}</span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar${selectedCount > 0 ? ' show' : ''}`} data-bulk-bar>
            <span className="text-[12px] font-semibold">
              {selectedCount} selected
            </span>
            <span className="w-px h-4 bg-white/30"></span>
            <button type="button" data-bulk="tag" onClick={() => handleBulk('tag')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">label</span>
              Tag
            </button>
            <button type="button" data-bulk="email" onClick={() => handleBulk('email')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">mail</span>
              Email
            </button>
            <button type="button" data-bulk="merge" onClick={() => handleBulk('merge')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">merge</span>
              Merge
            </button>
            <button type="button" data-bulk="add-role" onClick={() => handleBulk('add-role')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">group_add</span>
              Add role
            </button>
            <span className="w-px h-4 bg-white/30"></span>
            <button type="button" data-bulk="delete" onClick={() => handleBulk('delete')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>
              Delete
            </button>
            <button type="button" className="ml-auto" data-bulk="close" onClick={() => handleBulk('close')}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          {/* TABLE */}
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                {cols.map((c) => (
                  <th key={c.key} className={`px-3 py-2 ${c.right ? 'text-right' : ''}`}>
                    {c.label}
                  </th>
                ))}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {filtered.map((p) => {
                const isSel = selected.has(p.name);
                return (
                  <tr
                    key={p.name}
                    className="hover:bg-surface-container-low cursor-pointer"
                    onClick={(e) => handleRowClick(e, p)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="row-check p-check"
                        checked={isSel}
                        onChange={(e) => toggleRow(p.name, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2 ${c.right ? 'text-right tabular-nums' : ''} ${
                          isMutedCol(c.key) ? 'text-on-surface-variant' : ''
                        }`}
                      >
                        {renderCell(p, c)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center"
                        data-row-menu
                        onClick={(e) => openRowMenu(e, p)}
                      >
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                          more_horiz
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>
            This is the master party list.{' '}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              data-goto="customers"
              onClick={() => handleGoto('customers')}
            >
              Customers
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              data-goto="vendors"
              onClick={() => handleGoto('vendors')}
            >
              Vendors
            </button>{' '}
            are the same data filtered by role. A party can hold multiple roles — e.g. Printful is
            both a Supplier and a Vendor.
          </span>
        </div>
      </main>

      {/* New split menu */}
      <div
        className={`row-menu${newMenuOpen ? ' open' : ''}`}
        id="new-menu"
        style={newMenuOpen ? { top: newMenuPos.top, left: newMenuPos.left } : undefined}
      >
        <div className="menu-header">New party</div>
        {(
          [
            { kind: 'Customer', icon: 'person_add' },
            { kind: 'Vendor', icon: 'domain_add' },
            { kind: 'Supplier', icon: 'factory' },
            { kind: 'Contractor', icon: 'engineering' },
            { kind: 'Contact', icon: 'badge' },
          ] as const
        ).map((m) => (
          <button
            type="button"
            key={m.kind}
            data-new-kind={m.kind}
            onClick={() => handleNewMenuKind(m.kind)}
          >
            <span className="material-symbols-outlined">{m.icon}</span>
            {m.kind}
          </button>
        ))}
        <div className="sep"></div>
        <div className="menu-header">From existing</div>
        <button
          type="button"
          data-new-kind="Import CSV"
          onClick={() => handleNewMenuKind('Import CSV')}
        >
          <span className="material-symbols-outlined">upload</span>Import from CSV
        </button>
      </div>

      {/* Row ⋯ menu */}
      <div
        className={`row-menu${rowMenuOpen ? ' open' : ''}`}
        id="row-menu"
        style={rowMenuOpen ? { top: rowMenuPos.top, left: rowMenuPos.left } : undefined}
      >
        <div className="menu-header">This party</div>
        <button type="button" data-action="view" onClick={() => handleRowAction('view')}>
          <span className="material-symbols-outlined">open_in_new</span>Open party
        </button>
        <button type="button" data-action="edit" onClick={() => handleRowAction('edit')}>
          <span className="material-symbols-outlined">edit</span>Edit
        </button>
        <button type="button" data-action="add-role" onClick={() => handleRowAction('add-role')}>
          <span className="material-symbols-outlined">group_add</span>Add another role…
        </button>
        <div className="sep"></div>
        <div className="menu-header">Sell / buy</div>
        <button
          type="button"
          data-action="create-invoice"
          onClick={() => handleRowAction('create-invoice')}
        >
          <span className="material-symbols-outlined">receipt_long</span>Create invoice
        </button>
        <button
          type="button"
          data-action="create-estimate"
          onClick={() => handleRowAction('create-estimate')}
        >
          <span className="material-symbols-outlined">request_quote</span>Create estimate
        </button>
        <button
          type="button"
          data-action="create-bill"
          onClick={() => handleRowAction('create-bill')}
        >
          <span className="material-symbols-outlined">description</span>Create bill
        </button>
        <div className="sep"></div>
        <div className="menu-header">Communicate</div>
        <button type="button" data-action="email" onClick={() => handleRowAction('email')}>
          <span className="material-symbols-outlined">mail</span>Email
        </button>
        <button type="button" data-action="note" onClick={() => handleRowAction('note')}>
          <span className="material-symbols-outlined">note_add</span>Add note
        </button>
        <div className="sep"></div>
        <button
          type="button"
          className="danger"
          data-action="delete"
          onClick={() => handleRowAction('delete')}
        >
          <span className="material-symbols-outlined">delete</span>Delete party
        </button>
      </div>

      {/* §B2 Party drawer */}
      <div
        className={`drawer-scrim${drawerOpen ? ' open' : ''}`}
        id="party-scrim"
        onClick={closePartyDrawer}
      ></div>
      <div className={`drawer${drawerOpen ? ' open' : ''}`} id="party-drawer">
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate">{drawerTitle}</div>
              <div className="text-[11px] text-on-surface-variant">{drawerSub}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
              title="Maximize"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_full</span>
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
              onClick={closePartyDrawer}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="field-label">Roles</label>
            <div className="flex flex-wrap gap-1.5">
              {(['Customer', 'Vendor', 'Supplier', 'Contractor', 'Contact'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`role-chip-btn${activeRoles.has(r) ? ' active' : ''}`}
                  data-role={r}
                  onClick={() => handleRoleChipToggle(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Roles stack — one party can hold multiple roles.
            </p>
          </div>

          <div className="pt-2">
            <div className="section-h">Names and contact</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Company name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.company}
                    onChange={(e) => updateField({ company: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Display name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.display}
                    onChange={(e) => updateField({ display: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label">First name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.first}
                    onChange={(e) => updateField({ first: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Middle</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.middle}
                    onChange={(e) => updateField({ middle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Last name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.last}
                    onChange={(e) => updateField({ last: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Email</label>
                  <input
                    type="email"
                    className="field-input"
                    value={form.email}
                    onChange={(e) => updateField({ email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input
                    type="tel"
                    className="field-input"
                    value={form.phone}
                    onChange={(e) => updateField({ phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Website</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.website}
                  onChange={(e) => updateField({ website: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="section-h">Address</div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Street</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.street}
                  onChange={(e) => updateField({ street: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="field-label">City</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.city}
                    onChange={(e) => updateField({ city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">State</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.state}
                    onChange={(e) => updateField({ state: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">ZIP</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.zip}
                    onChange={(e) => updateField({ zip: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="section-h">Notes and attachments</div>
            <textarea
              className="field-input"
              style={{ height: '72px', padding: '8px 10px', fontFamily: 'inherit' }}
              placeholder="Internal notes visible to staff only"
            ></textarea>
          </div>
        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low"
            onClick={closePartyDrawer}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-white border border-surface-dim text-body-md font-semibold hover:bg-surface-container-low split-btn-main"
                data-save-new
                onClick={() => saveParty(true)}
              >
                Save and new
              </button>
              <button
                type="button"
                className="h-8 px-1.5 bg-white border border-surface-dim hover:bg-surface-container-low split-btn-arrow"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main"
                data-save-party
                onClick={() => saveParty(false)}
              >
                Save and close
              </button>
              <button
                type="button"
                className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
