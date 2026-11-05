'use client';

import './expenses-bills.css';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ExpensesBillsScreenProps } from './types';
import { EBL_NAV } from './types';

/* ════════════════════════════════════════════════════════════════
   Vendors screen — 1:1 conversion of upload/Vendors.html
   ════════════════════════════════════════════════════════════════ */

type W9Status = 'on' | 'off' | 'pending' | 'missing' | 'na';
type VendorRole = 'Supplier' | 'Contractor' | 'Consultant' | 'Utility' | 'Vendor';
type ViewTab = 'All' | 'Suppliers' | 'Contractors' | '1099' | 'missing-w9';

interface VendorRow {
  name: string;
  email: string;
  role: VendorRole;
  roleLabel?: string;
  w9: W9Status;
  is1099: boolean;
  openBills: string;
  ytdPaid: string;
  openBillsError?: boolean;
  avatarColor: string;
  initial: string;
}

interface VendorForm {
  company: string;
  display: string;
  first: string;
  middle: string;
  last: string;
  email: string;
  phone: string;
  website: string;
  checkname: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  terms: string;
  account: string;
  method: string;
  achAccount: string;
  achRouting: string;
  achEnabled: boolean;
  taxid: string;
  type: string;
  is1099: boolean;
  w9: boolean;
  notes: string;
}

const INITIAL_VENDORS: VendorRow[] = [
  { name: 'Printful', email: 'billing@printful.com', role: 'Supplier', w9: 'on', is1099: true, openBills: '$2,880.00', ytdPaid: '$12,410.00', avatarColor: 'bg-qb-blue', initial: 'P' },
  { name: 'Gelato', email: 'billing@gelato.com', role: 'Supplier', w9: 'on', is1099: true, openBills: '$1,200.00', ytdPaid: '$6,240.00', avatarColor: 'bg-qb-green', initial: 'G' },
  { name: 'Printify', email: 'accounts@printify.com', role: 'Supplier', w9: 'pending', is1099: true, openBills: '$640.00', ytdPaid: '$4,180.00', openBillsError: true, avatarColor: 'bg-qb-maroon', initial: 'P' },
  { name: 'Lakeside Design', email: 'hello@lakeside.design', role: 'Contractor', w9: 'on', is1099: true, openBills: '$0.00', ytdPaid: '$1,850.00', avatarColor: 'bg-qb-teal', initial: 'L' },
  { name: 'Raj Patel Consulting', email: 'raj@rpc.dev', role: 'Contractor', w9: 'off', is1099: false, openBills: '$0.00', ytdPaid: '$740.00', avatarColor: 'bg-qb-navy', initial: 'R' },
  { name: 'Adobe', email: 'billing@adobe.com', role: 'Consultant', roleLabel: 'Software', w9: 'on', is1099: false, openBills: '$0.00', ytdPaid: '$719.88', avatarColor: 'bg-qb-maroon', initial: 'A' },
  { name: 'Knoxville Utilities Board', email: 'billing@kub.org', role: 'Utility', w9: 'na', is1099: false, openBills: '$0.00', ytdPaid: '$384.00', avatarColor: 'bg-qb-green', initial: 'K' },
  { name: 'Elena Sokolov', email: 'elena@sokolov.studio', role: 'Contractor', w9: 'missing', is1099: true, openBills: '$0.00', ytdPaid: '$2,400.00', avatarColor: 'bg-qb-blue', initial: 'E' },
];

const VENDOR_DATA: Record<string, VendorForm> = {
  Printful: { company: 'Printful, Inc.', display: 'Printful', first: '', middle: '', last: '', email: 'billing@printful.com', phone: '+1 (704) 802-5600', website: 'printful.com', checkname: 'Printful, Inc.', street: '3335 Ringsby Court', city: 'Charlotte', state: 'NC', zip: '28206', terms: 'Net 30', account: 'COGS', method: 'ACH', achAccount: '•••• •••• 7712', achRouting: '•••• •••• 0042', achEnabled: true, taxid: '••-••• 1103', type: 'Corporation', is1099: true, w9: true, notes: '' },
  Gelato: { company: 'Gelato', display: 'Gelato', first: '', middle: '', last: '', email: 'billing@gelato.com', phone: '+47 23 96 30 50', website: 'gelato.com', checkname: 'Gelato', street: 'Drammensveien 145', city: 'Oslo', state: 'NO', zip: '0277', terms: 'Net 30', account: 'COGS', method: 'Wire', achAccount: '', achRouting: '', achEnabled: false, taxid: '••-••• 0841', type: 'Corporation', is1099: true, w9: true, notes: '' },
  Printify: { company: 'Printify, Inc.', display: 'Printify', first: '', middle: '', last: '', email: 'accounts@printify.com', phone: '+1 (415) 562-4100', website: 'printify.com', checkname: 'Printify, Inc.', street: '600 California St', city: 'San Francisco', state: 'CA', zip: '94108', terms: 'Net 15', account: 'COGS', method: 'ACH', achAccount: '', achRouting: '', achEnabled: false, taxid: '', type: 'Corporation', is1099: true, w9: false, notes: '' },
  'Lakeside Design': { company: 'Lakeside Design LLC', display: 'Lakeside Design', first: 'Ben', middle: '', last: 'Ortiz', email: 'hello@lakeside.design', phone: '+1 (615) 220-4433', website: 'lakeside.design', checkname: 'Lakeside Design LLC', street: '1024 Elm St', city: 'Nashville', state: 'TN', zip: '37207', terms: 'Net 30', account: 'Contract labor', method: 'Check', achAccount: '', achRouting: '', achEnabled: false, taxid: '••-••• 5544', type: 'LLC', is1099: true, w9: true, notes: '' },
  'Raj Patel Consulting': { company: 'Raj Patel Consulting', display: 'Raj Patel', first: 'Raj', middle: '', last: 'Patel', email: 'raj@rpc.dev', phone: '+1 (404) 550-9822', website: 'rpc.dev', checkname: 'Raj Patel', street: '180 Peachtree', city: 'Atlanta', state: 'GA', zip: '30303', terms: 'Net 30', account: 'Contract labor', method: 'Check', achAccount: '', achRouting: '', achEnabled: false, taxid: '', type: 'Individual', is1099: false, w9: false, notes: '' },
  Adobe: { company: 'Adobe Inc.', display: 'Adobe', first: '', middle: '', last: '', email: 'billing@adobe.com', phone: '+1 (800) 833-6687', website: 'adobe.com', checkname: 'Adobe Inc.', street: '345 Park Ave', city: 'San Jose', state: 'CA', zip: '95110', terms: 'Due on receipt', account: 'Software', method: 'Credit card', achAccount: '', achRouting: '', achEnabled: false, taxid: '••-••• 0011', type: 'Corporation', is1099: false, w9: true, notes: '' },
  'Knoxville Utilities Board': { company: 'Knoxville Utilities Board', display: 'KUB', first: '', middle: '', last: '', email: 'billing@kub.org', phone: '+1 (865) 524-2911', website: 'kub.org', checkname: 'KUB', street: 'P.O. Box 59017', city: 'Knoxville', state: 'TN', zip: '37950', terms: 'Net 15', account: 'Utilities', method: 'ACH', achAccount: '•••• •••• 2201', achRouting: '•••• •••• 1102', achEnabled: true, taxid: '', type: 'Corporation', is1099: false, w9: false, notes: '' },
  'Elena Sokolov': { company: 'Sokolov Studio', display: 'Elena Sokolov', first: 'Elena', middle: '', last: 'Sokolov', email: 'elena@sokolov.studio', phone: '+1 (512) 441-7788', website: 'sokolov.studio', checkname: 'Elena Sokolov', street: '800 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', terms: 'Net 30', account: 'Contract labor', method: 'Check', achAccount: '', achRouting: '', achEnabled: false, taxid: '', type: 'Sole proprietor', is1099: true, w9: false, notes: '' },
};

const EMPTY_FORM: VendorForm = {
  company: '', display: '', first: '', middle: '', last: '', email: '', phone: '', website: '', checkname: '',
  street: '', city: '', state: '', zip: '', terms: 'Net 30', account: 'Office supplies', method: 'Check',
  achAccount: '', achRouting: '', achEnabled: false, taxid: '', type: 'LLC', is1099: false, w9: false, notes: '',
};

const AVATAR_COLORS: Record<VendorRole, string> = {
  Supplier: 'bg-qb-blue',
  Contractor: 'bg-qb-maroon',
  Consultant: 'bg-qb-green',
  Utility: 'bg-qb-teal',
  Vendor: 'bg-qb-navy',
};

const ROLE_OPTIONS: string[] = ['Customer', 'Vendor', 'Supplier', 'Contractor', 'Contact'];

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Suppliers', label: 'Suppliers' },
  { id: 'Contractors', label: 'Contractors' },
  { id: '1099', label: '1099 eligible' },
  { id: 'missing-w9', label: 'Missing W-9' },
];

export default function Vendors({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: ExpensesBillsScreenProps) {
  /* ── Toast ── */
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((m: string) => setToastMsg(m), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 1800);
    return () => window.clearTimeout(t);
  }, [toastMsg]);
  /* Mirror local toast up to the shell (matches sibling pattern) */
  useEffect(() => {
    if (toastMsg) onToast(toastMsg);
  }, [toastMsg, onToast]);

  /* ── Vendors list / filters ── */
  const [vendors, setVendors] = useState<VendorRow[]>(INITIAL_VENDORS);
  const [viewTab, setViewTab] = useState<ViewTab>('All');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vendors.filter((v) => {
      const nameOk = !q || v.name.toLowerCase().includes(q);
      let tabOk = true;
      if (viewTab === 'Suppliers') tabOk = v.role === 'Supplier';
      else if (viewTab === 'Contractors') tabOk = v.role === 'Contractor';
      else if (viewTab === '1099') tabOk = v.is1099;
      else if (viewTab === 'missing-w9') tabOk = v.w9 === 'off' || v.w9 === 'pending' || v.w9 === 'missing';
      return nameOk && tabOk;
    });
  }, [vendors, search, viewTab]);

  const countText = `1–${filtered.length} of ${vendors.length}`;

  /* ── Selection / bulk bar ── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allChecked = filtered.length > 0 && filtered.every((v) => selected.has(v.name));

  /* ── Vendor drawer ── */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVendor, setDrawerVendor] = useState<string | null>(null);
  const [drawerRole, setDrawerRole] = useState<string>('Vendor');
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(new Set(['Vendor']));

  const isNewVendor = drawerVendor === null;
  const drawerTitle = isNewVendor ? `New ${drawerRole}` : form.display || drawerVendor;
  const drawerSub = isNewVendor
    ? 'Party record · §B2'
    : `${form.company || '—'} · ${vendors.find((v) => v.name === drawerVendor)?.role || 'Vendor'}`;

  /* ── New split menu ── */
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuPos, setNewMenuPos] = useState({ top: 0, left: 0 });

  /* ── Row ⋯ menu ── */
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuVendor, setRowMenuVendor] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });

  /* ── Deactivated (opacity) ── */
  const [deactivated, setDeactivated] = useState<Set<string>>(new Set());

  /* ═══════════ Actions ═══════════ */

  const openVendorDrawer = useCallback((row: VendorRow | null, role?: string) => {
    if (row) {
      const data = VENDOR_DATA[row.name] || EMPTY_FORM;
      setForm({ ...EMPTY_FORM, ...data, notes: '' });
      setDrawerVendor(row.name);
      const roles = new Set<string>();
      roles.add(row.role);
      if (row.role !== 'Vendor') roles.add('Vendor');
      setActiveRoles(roles);
    } else {
      setForm(EMPTY_FORM);
      setDrawerVendor(null);
      setDrawerRole(role || 'Vendor');
      setActiveRoles(new Set<string>([role || 'Vendor']));
    }
    setDrawerOpen(true);
  }, []);

  const closeVendorDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleRoleChipToggle = (r: string) => {
    setActiveRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const handleUploadW9 = () => {
    setForm((f) => ({ ...f, w9: true }));
    showToast('W-9 uploaded — marked as on file');
  };

  const updateField = (patch: Partial<VendorForm>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const saveVendor = (andNew: boolean) => {
    const company = form.company.trim();
    const display = form.display.trim() || company;
    const email = form.email.trim();
    if (!company) {
      showToast('Company name is required');
      return;
    }
    const is1099 = form.is1099;
    const hasW9 = form.w9;
    const primaryRole = (['Supplier', 'Contractor'].find((r) => activeRoles.has(r)) || 'Vendor') as VendorRole;

    if (drawerVendor) {
      // editing existing — source updates: name, email, role chip text+class, w9 badge
      setVendors((prev) =>
        prev.map((v) =>
          v.name === drawerVendor
            ? {
                ...v,
                name: display,
                email: email || '—',
                role: primaryRole,
                roleLabel: undefined, // source sets chip text to primaryRole
                w9: hasW9 ? 'on' : 'off',
                is1099,
              }
            : v,
        ),
      );
      showToast(`"${display}" saved`);
    } else {
      // new row at top of list
      const initial = (display[0] || '?').toUpperCase();
      const newRow: VendorRow = {
        name: display,
        email: email || '—',
        role: primaryRole,
        w9: hasW9 ? 'on' : 'off',
        is1099,
        openBills: '$0.00',
        ytdPaid: '$0.00',
        avatarColor: AVATAR_COLORS[primaryRole],
        initial,
      };
      setVendors((prev) => [newRow, ...prev]);
      showToast(`"${display}" added`);
    }

    if (andNew) {
      openVendorDrawer(null, primaryRole);
    } else {
      setDrawerOpen(false);
    }
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
    openVendorDrawer(null, kind);
  };

  /* ── Create action chips ── */
  const handleCreateChip = (kind: string) => openVendorDrawer(null, kind);

  /* ── Top action buttons ── */
  const handleRequestW9 = () => showToast('Request W-9 batch — 2 vendors missing or pending');
  const handleShowAll = () => onOpenCreateFlyout();
  const handleExport = () => showToast('Exporting vendor list…');
  const handleCustomize = () => showToast('Customize panel — Data / Visual tabs');

  /* ── Row click + ⋯ menu ── */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, v: VendorRow) => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && tgt.closest('input,button,[data-row-menu]')) return;
    openVendorDrawer(v);
  };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, v: VendorRow) => {
    e.stopPropagation();
    setRowMenuVendor(v.name);
    const r = e.currentTarget.getBoundingClientRect();
    setRowMenuPos({
      top: r.bottom + 4,
      left: Math.min(r.right - 250, window.innerWidth - 270),
    });
    setRowMenuOpen(true);
  };

  const closeRowMenu = () => {
    setRowMenuOpen(false);
    setRowMenuVendor(null);
  };

  const handleRowAction = (act: string) => {
    if (!rowMenuVendor) return;
    const name = rowMenuVendor;
    const v = vendors.find((x) => x.name === name);
    closeRowMenu();
    if (!v) return;
    switch (act) {
      case 'view':
      case 'edit':
        openVendorDrawer(v);
        break;
      case 'view-bills':
        onNavigate(...EBL_NAV.bills());
        showToast(`Bills list filtered to ${name}`);
        break;
      case 'create-bill':
        onCreate('Bill');
        showToast(`Create bill for ${name}`);
        break;
      case 'request-w9':
        showToast(`W-9 request sent to ${name}`);
        break;
      case 'view-w9':
        showToast(`Opening W-9 for ${name}`);
        break;
      case 'toggle-1099': {
        const eligible = v.is1099;
        setVendors((prev) => prev.map((x) => (x.name === name ? { ...x, is1099: !eligible } : x)));
        showToast(`${name} ${eligible ? 'removed from' : 'marked for'} 1099`);
        break;
      }
      case 'pay-bills':
        onNavigate(...EBL_NAV.payBills());
        showToast(`Pay bills workspace — ${name}`);
        break;
      case 'ach':
        showToast(`ACH setup for ${name}`);
        break;
      case 'deactivate':
        setDeactivated((prev) => {
          const next = new Set(prev);
          next.add(name);
          return next;
        });
        showToast(`${name} made inactive`);
        break;
      default:
        break;
    }
  };

  /* ── Selection ── */
  const toggleRowCheck = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) filtered.forEach((v) => next.add(v.name));
      else filtered.forEach((v) => next.delete(v.name));
      return next;
    });
  };

  const handleBulk = (act: string) => {
    const n = selected.size;
    if (act === 'close') {
      setSelected(new Set());
      return;
    }
    if (act === 'delete') {
      setVendors((prev) => prev.filter((v) => !selected.has(v.name)));
    }
    const label = act.charAt(0).toUpperCase() + act.slice(1);
    showToast(`${label} on ${n} vendor${n !== 1 ? 's' : ''}`);
    setSelected(new Set());
  };

  /* ── Outside click + Escape (closes any open menu/drawer) ── */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('#row-menu') && !target.closest('[data-row-menu]')) {
        setRowMenuOpen(false);
        setRowMenuVendor(null);
      }
      if (!target.closest('#new-menu') && !target.closest('[data-new-split]')) {
        setNewMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNewMenuOpen(false);
        setRowMenuOpen(false);
        setRowMenuVendor(null);
        setDrawerOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* ═══════════ Render helpers ═══════════ */

  const renderW9 = (v: VendorRow) => {
    switch (v.w9) {
      case 'on':
        return (
          <span className="w9 on">
            <span className="material-symbols-outlined text-[10px]">check</span>On file
          </span>
        );
      case 'off':
        return (
          <span className="w9 off">
            <span className="material-symbols-outlined text-[10px]">warning</span>Missing
          </span>
        );
      case 'pending':
        return (
          <span className="w9 pending">
            <span className="material-symbols-outlined text-[10px]">schedule</span>Requested
          </span>
        );
      case 'missing':
        return (
          <span className="w9 off">
            <span className="material-symbols-outlined text-[10px]">warning</span>Missing
          </span>
        );
      case 'na':
        return <span className="w9 na">N/A</span>;
      default:
        return null;
    }
  };

  const render1099 = (v: VendorRow) => {
    if (v.w9 === 'pending') {
      return (
        <span className="text-[11px] text-tertiary flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">schedule</span>Blocked
        </span>
      );
    }
    if (v.w9 === 'off' || v.w9 === 'missing') {
      return (
        <span className="text-[11px] text-error flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">error</span>Blocked
        </span>
      );
    }
    if (v.is1099) {
      return (
        <span className="text-[11px] text-secondary flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">check_circle</span>Eligible
        </span>
      );
    }
    return (
      <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
        <span className="material-symbols-outlined text-[12px]">remove</span>Not eligible
      </span>
    );
  };

  const rowMenuVendorData = rowMenuVendor ? vendors.find((v) => v.name === rowMenuVendor) || null : null;

  /* ═══════════ Render ═══════════ */
  return (
    <div className="vendors-page">
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Expenses &amp; Bills</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Vendors</span>
        </div>
      </div>

      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div>
            <h1 className="text-headline-lg">Vendors</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Party list · role=Vendor / Supplier / Contractor · §B2</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
                data-new-vendor
                onClick={() => openVendorDrawer(null, 'Vendor')}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>New vendor
              </button>
              <button
                type="button"
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
              data-export
              onClick={handleExport}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export
            </button>
            <button
              type="button"
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              data-customize
              onClick={handleCustomize}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>Customize
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="eb-kpi-card">
            <div className="eb-kpi-label">Total vendors</div>
            <div className="eb-kpi-val">42</div>
            <div className="text-[11px] text-on-surface-variant mt-1">6 with open bills</div>
          </div>
          <div className="eb-kpi-card">
            <div className="eb-kpi-label">W-9 on file</div>
            <div className="eb-kpi-val">36</div>
            <div className="text-[11px] text-on-surface-variant mt-1">86% complete</div>
          </div>
          <div className="eb-kpi-card">
            <div className="eb-kpi-label">1099 eligible</div>
            <div className="eb-kpi-val">6</div>
            <div className="text-[11px] text-tertiary mt-1">Filing due Jan 31, 2027</div>
          </div>
          <div className="eb-kpi-card">
            <div className="eb-kpi-label">YTD spend</div>
            <div className="eb-kpi-val">$24,967</div>
            <div className="text-[11px] text-on-surface-variant mt-1">5 top vendors · 36 bills</div>
          </div>
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">Create actions:</span>
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            data-new="Vendor"
            onClick={() => handleCreateChip('Vendor')}
          >
            <span className="material-symbols-outlined text-[16px]">domain_add</span>Vendor
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            data-new="Supplier"
            onClick={() => handleCreateChip('Supplier')}
          >
            <span className="material-symbols-outlined text-[16px]">factory</span>Supplier
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            data-new="Contractor"
            onClick={() => handleCreateChip('Contractor')}
          >
            <span className="material-symbols-outlined text-[16px]">engineering</span>Contractor
          </button>
          <button
            type="button"
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            data-request-w9
            onClick={handleRequestW9}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>Request W-9
          </button>
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
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`h-full px-3 text-label-md tab-underline ${viewTab === tab.id ? 'active' : 'text-on-surface-variant'}`}
                data-viewtab={tab.id}
                onClick={() => setViewTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input
                className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary"
                placeholder="Filter by name, email…"
                data-filter
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="button" className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">filter_list</span>Filter
            </button>
            <button type="button" className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            <span className="ml-auto text-[11px] text-on-surface-variant" data-v-count>
              {countText}
            </span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar ${selected.size > 0 ? 'show' : ''}`} data-bulk-bar>
            <span className="text-[12px] font-semibold" data-bulk-count>
              {selected.size} selected
            </span>
            <span className="w-px h-4 bg-white/30"></span>
            <button type="button" data-bulk="request-w9" onClick={() => handleBulk('request-w9')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">badge</span>Request W-9
            </button>
            <button type="button" data-bulk="email" onClick={() => handleBulk('email')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">mail</span>Email
            </button>
            <button type="button" data-bulk="merge" onClick={() => handleBulk('merge')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">merge</span>Merge
            </button>
            <span className="w-px h-4 bg-white/30"></span>
            <button type="button" data-bulk="delete" onClick={() => handleBulk('delete')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete
            </button>
            <button type="button" className="ml-auto" data-bulk="close" onClick={() => handleBulk('close')}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" className="row-check" data-check-all checked={allChecked} onChange={handleCheckAll} />
                </th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 text-right">Open bills</th>
                <th className="px-3 py-2 text-right">YTD paid</th>
                <th className="px-3 py-2">W-9</th>
                <th className="px-3 py-2">1099</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim" data-v-tbody>
              {filtered.map((v) => (
                <tr
                  key={v.name}
                  className="hover:bg-surface-container-low cursor-pointer v-row"
                  style={{ opacity: deactivated.has(v.name) ? 0.4 : 1 }}
                  onClick={(e) => handleRowClick(e, v)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="row-check v-check"
                      checked={selected.has(v.name)}
                      onChange={() => toggleRowCheck(v.name)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`v-avatar ${v.avatarColor}`}>{v.initial}</div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{v.name}</div>
                        <div className="text-[11px] text-on-surface-variant truncate">{v.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`role ${v.role.toLowerCase()}`}>{v.roleLabel || v.role}</span>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${v.openBillsError ? 'text-error' : ''}`}>
                    {v.openBills}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.ytdPaid}</td>
                  <td className="px-3 py-2">{renderW9(v)}</td>
                  <td className="px-3 py-2">{render1099(v)}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center"
                      data-row-menu
                      onClick={(e) => openRowMenu(e, v)}
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ═══════════ NEW SPLIT MENU ═══════════ */}
      <div
        className={`row-menu ${newMenuOpen ? 'open' : ''}`}
        id="new-menu"
        style={{ top: newMenuPos.top, left: newMenuPos.left }}
      >
        <div className="menu-header">New party</div>
        <button type="button" data-new-kind="Vendor" onClick={() => handleNewMenuKind('Vendor')}>
          <span className="material-symbols-outlined">domain_add</span>Vendor
        </button>
        <button type="button" data-new-kind="Supplier" onClick={() => handleNewMenuKind('Supplier')}>
          <span className="material-symbols-outlined">factory</span>Supplier
        </button>
        <button type="button" data-new-kind="Contractor" onClick={() => handleNewMenuKind('Contractor')}>
          <span className="material-symbols-outlined">engineering</span>Contractor
        </button>
        <div className="sep"></div>
        <div className="menu-header">From existing</div>
        <button type="button" data-new-kind="Import CSV" onClick={() => handleNewMenuKind('Import CSV')}>
          <span className="material-symbols-outlined">upload</span>Import from CSV
        </button>
        <button type="button" data-new-kind="From customer" onClick={() => handleNewMenuKind('From customer')}>
          <span className="material-symbols-outlined">person</span>Promote from customer
        </button>
      </div>

      {/* ═══════════ ROW ⋯ MENU ═══════════ */}
      <div
        className={`row-menu ${rowMenuOpen ? 'open' : ''}`}
        id="row-menu"
        style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
      >
        <div className="menu-header">This vendor</div>
        <button type="button" data-action="view" onClick={() => handleRowAction('view')}>
          <span className="material-symbols-outlined">open_in_new</span>Open vendor
        </button>
        <button type="button" data-action="edit" onClick={() => handleRowAction('edit')}>
          <span className="material-symbols-outlined">edit</span>Edit
        </button>
        <button type="button" data-action="view-bills" onClick={() => handleRowAction('view-bills')}>
          <span className="material-symbols-outlined">receipt_long</span>View bills
        </button>
        <button type="button" data-action="create-bill" onClick={() => handleRowAction('create-bill')}>
          <span className="material-symbols-outlined">description</span>Create bill
        </button>
        <div className="sep"></div>
        <div className="menu-header">Compliance</div>
        {(!rowMenuVendorData || rowMenuVendorData.w9 !== 'on') && (
          <button type="button" data-action="request-w9" onClick={() => handleRowAction('request-w9')}>
            <span className="material-symbols-outlined">badge</span>Request W-9…
          </button>
        )}
        {rowMenuVendorData && rowMenuVendorData.w9 === 'on' && (
          <button type="button" data-action="view-w9" onClick={() => handleRowAction('view-w9')}>
            <span className="material-symbols-outlined">description</span>View W-9 on file
          </button>
        )}
        <button type="button" data-action="toggle-1099" onClick={() => handleRowAction('toggle-1099')}>
          <span className="material-symbols-outlined">tune</span>
          {rowMenuVendorData && rowMenuVendorData.is1099 ? 'Disable 1099' : 'Enable 1099'}
        </button>
        <div className="sep"></div>
        <div className="menu-header">Pay</div>
        <button type="button" data-action="pay-bills" onClick={() => handleRowAction('pay-bills')}>
          <span className="material-symbols-outlined">account_balance_wallet</span>Pay bills…
        </button>
        <button type="button" data-action="ach" onClick={() => handleRowAction('ach')}>
          <span className="material-symbols-outlined">account_balance</span>Set up ACH…
        </button>
        <div className="sep"></div>
        <button type="button" className="danger" data-action="deactivate" onClick={() => handleRowAction('deactivate')}>
          <span className="material-symbols-outlined">visibility_off</span>Make inactive
        </button>
      </div>

      {/* ═══════════ VENDOR DRAWER (§B2) ═══════════ */}
      <div className={`drawer-scrim ${drawerOpen ? 'open' : ''}`} id="vendor-scrim" onClick={closeVendorDrawer}></div>
      <div className={`drawer w-560 ${drawerOpen ? 'open' : ''}`} id="vendor-drawer">
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">domain</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate" data-v-title>
                {drawerTitle}
              </div>
              <div className="text-[11px] text-on-surface-variant" data-v-sub>
                {drawerSub}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" title="Maximize">
              <span className="material-symbols-outlined text-[18px]">open_in_full</span>
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
              data-close-vendor
              onClick={closeVendorDrawer}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Role chips */}
          <div>
            <label className="field-label">Role</label>
            <div className="flex flex-wrap gap-1.5" data-role-chips>
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`role-chip ${activeRoles.has(r) ? 'active' : ''}`}
                  data-role={r}
                  onClick={() => handleRoleChipToggle(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">Roles stack — one party can be both vendor and supplier.</p>
          </div>

          {/* Names and contact */}
          <div className="pt-2">
            <div className="section-h">Names and contact</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Company name</label>
                  <input className="field-input" data-f-company value={form.company} onChange={(e) => updateField({ company: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Display name</label>
                  <input className="field-input" data-f-display value={form.display} onChange={(e) => updateField({ display: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label">First name</label>
                  <input className="field-input" data-f-first value={form.first} onChange={(e) => updateField({ first: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Middle</label>
                  <input className="field-input" data-f-middle value={form.middle} onChange={(e) => updateField({ middle: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Last name</label>
                  <input className="field-input" data-f-last value={form.last} onChange={(e) => updateField({ last: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Email</label>
                  <input className="field-input" type="email" data-f-email value={form.email} onChange={(e) => updateField({ email: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input className="field-input" type="tel" data-f-phone value={form.phone} onChange={(e) => updateField({ phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label">Website</label>
                <input className="field-input" data-f-website value={form.website} onChange={(e) => updateField({ website: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Name to print on checks</label>
                <input className="field-input" data-f-checkname value={form.checkname} onChange={(e) => updateField({ checkname: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="pt-2">
            <div className="section-h">Address</div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Street</label>
                <input className="field-input" data-f-street value={form.street} onChange={(e) => updateField({ street: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="field-label">City</label>
                  <input className="field-input" data-f-city value={form.city} onChange={(e) => updateField({ city: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">State</label>
                  <input className="field-input" data-f-state value={form.state} onChange={(e) => updateField({ state: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">ZIP</label>
                  <input className="field-input" data-f-zip value={form.zip} onChange={(e) => updateField({ zip: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Vendor-specific fields */}
          <div className="pt-2" data-vendor-fields>
            <div className="section-h">Vendor terms &amp; payment</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Terms</label>
                  <select className="field-input" data-f-terms value={form.terms} onChange={(e) => updateField({ terms: e.target.value })}>
                    <option>Net 30</option>
                    <option>Net 15</option>
                    <option>Net 60</option>
                    <option>Due on receipt</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Default expense account</label>
                  <select className="field-input" data-f-default-account value={form.account} onChange={(e) => updateField({ account: e.target.value })}>
                    <option>Office supplies</option>
                    <option>Shipping</option>
                    <option>Software</option>
                    <option>COGS</option>
                    <option>Advertising</option>
                    <option>Contract labor</option>
                    <option>Utilities</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Payment method</label>
                <select className="field-input" data-f-payment-method value={form.method} onChange={(e) => updateField({ method: e.target.value })}>
                  <option>Check</option>
                  <option>ACH</option>
                  <option>Credit card</option>
                  <option>Wire</option>
                </select>
              </div>
              <div className="border-t border-surface-dim pt-3">
                <div className="section-h">Bill Pay ACH info</div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Account number</label>
                      <input
                        className="field-input"
                        placeholder="•••• •••• 4421"
                        data-f-ach-account
                        value={form.achAccount}
                        onChange={(e) => updateField({ achAccount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label">Routing number</label>
                      <input
                        className="field-input"
                        placeholder="•••• •••• 9910"
                        data-f-ach-routing
                        value={form.achRouting}
                        onChange={(e) => updateField({ achRouting: e.target.value })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-body-sm">
                    <input
                      type="checkbox"
                      className="row-check"
                      data-f-ach-enabled
                      checked={form.achEnabled}
                      onChange={(e) => updateField({ achEnabled: e.target.checked })}
                    />{' '}
                    Enable ACH payments
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Tax info / 1099 */}
          <div className="pt-2">
            <div className="section-h">Tax &amp; 1099</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Tax ID (EIN/SSN)</label>
                  <input
                    className="field-input"
                    placeholder="••-••• ••••"
                    data-f-taxid
                    value={form.taxid}
                    onChange={(e) => updateField({ taxid: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label">Business type</label>
                  <select className="field-input" data-f-business-type value={form.type} onChange={(e) => updateField({ type: e.target.value })}>
                    <option>LLC</option>
                    <option>Corporation</option>
                    <option>Sole proprietor</option>
                    <option>Partnership</option>
                    <option>Individual</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="row-check"
                  data-f-1099
                  checked={form.is1099}
                  onChange={(e) => updateField({ is1099: e.target.checked })}
                />{' '}
                Track for 1099-NEC
              </label>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="row-check"
                  data-f-w9
                  checked={form.w9}
                  onChange={(e) => updateField({ w9: e.target.checked })}
                />{' '}
                W-9 on file
              </label>
              <div>
                <label className="field-label">W-9 attachment</label>
                <button
                  type="button"
                  className="w-full h-16 border-2 border-dashed border-surface-dim rounded-lg text-[11px] text-primary font-semibold hover:bg-surface-container-low flex flex-col items-center justify-center gap-1"
                  data-upload-w9
                  onClick={handleUploadW9}
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>Upload W-9 (PDF)
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-2">
            <div className="section-h">Notes and attachments</div>
            <textarea
              className="field-input"
              style={{ height: 72, padding: '8px 10px', fontFamily: 'inherit' }}
              placeholder="Internal notes visible to staff only"
              value={form.notes}
              onChange={(e) => updateField({ notes: e.target.value })}
            ></textarea>
          </div>
        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low"
            data-close-vendor
            onClick={closeVendorDrawer}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-white border border-surface-dim text-body-md font-semibold hover:bg-surface-container-low split-btn-main"
                data-save-new
                onClick={() => saveVendor(true)}
              >
                Save and new
              </button>
              <button type="button" className="h-8 px-1.5 bg-white border border-surface-dim hover:bg-surface-container-low split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <div className="flex split-btn">
              <button
                type="button"
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main"
                data-save-vendor
                onClick={() => saveVendor(false)}
              >
                Save and close
              </button>
              <button type="button" className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
