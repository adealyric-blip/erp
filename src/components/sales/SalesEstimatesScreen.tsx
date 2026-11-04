'use client';

import './sales.css';
import { useState, useMemo, useRef, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { SalesScreenProps, SALES_NAV } from './types';

type EstimateStatus =
  | 'Draft'
  | 'Sent'
  | 'Viewed'
  | 'Accepted'
  | 'Declined'
  | 'Expired'
  | 'Converted';

type TabKey = 'All' | EstimateStatus;

interface EstimateLine {
  desc: string;
  qty: string;
  rate: string;
  amt: string;
}

interface DrawerLine extends EstimateLine {
  id: string;
}

interface Estimate {
  id: string;
  no: string;
  customer: string;
  email: string;
  avatarLetter: string;
  avatarClass: string;
  sent: string;
  expires: string;
  amount: number;
  amountDisplay: string;
  status: EstimateStatus;
  convertedInvoiceNo?: string;
  date: string;
  expiry: string;
  subtotal: string;
  total: string;
  lines: EstimateLine[];
}

const TABS: TabKey[] = [
  'All',
  'Draft',
  'Sent',
  'Accepted',
  'Declined',
  'Expired',
  'Converted',
];

const INITIAL_ESTIMATES: Estimate[] = [
  {
    id: '0221',
    no: '0221',
    customer: 'Orion Apparel',
    email: 'hello@orionapparel.com',
    avatarLetter: 'O',
    avatarClass: 'bg-qb-navy',
    sent: '10/26/2026',
    expires: '11/26/2026',
    amount: 3600,
    amountDisplay: '$3,600.00',
    status: 'Sent',
    date: '2026-10-26',
    expiry: '2026-11-26',
    subtotal: '$3,600.00',
    total: '$3,600.00',
    lines: [
      { desc: 'Custom apparel — 40 units', qty: '40', rate: '80.00', amt: '$3,200.00' },
      { desc: 'Rush fee', qty: '1', rate: '400.00', amt: '$400.00' },
    ],
  },
  {
    id: '0219',
    no: '0219',
    customer: 'Lakeside Design',
    email: 'hello@lakeside.design',
    avatarLetter: 'L',
    avatarClass: 'bg-qb-blue',
    sent: '10/18/2026',
    expires: '11/18/2026',
    amount: 4200,
    amountDisplay: '$4,200.00',
    status: 'Viewed',
    date: '2026-10-18',
    expiry: '2026-11-18',
    subtotal: '$4,200.00',
    total: '$4,200.00',
    lines: [{ desc: 'Website redesign', qty: '1', rate: '4,200.00', amt: '$4,200.00' }],
  },
  {
    id: '0214',
    no: '0214',
    customer: 'Northwind Labs',
    email: 'finance@northwind.io',
    avatarLetter: 'N',
    avatarClass: 'bg-qb-teal',
    sent: '10/12/2026',
    expires: '11/12/2026',
    amount: 1440,
    amountDisplay: '$1,440.00',
    status: 'Viewed',
    date: '2026-10-12',
    expiry: '2026-11-12',
    subtotal: '$1,440.00',
    total: '$1,440.00',
    lines: [{ desc: 'Consulting — 12 hours', qty: '12', rate: '120.00', amt: '$1,440.00' }],
  },
  {
    id: '0212',
    no: '0212',
    customer: 'Acme Corp',
    email: 'ap@acme.com',
    avatarLetter: 'A',
    avatarClass: 'bg-qb-blue',
    sent: '10/05/2026',
    expires: '11/05/2026',
    amount: 4800,
    amountDisplay: '$4,800.00',
    status: 'Accepted',
    date: '2026-10-05',
    expiry: '2026-11-05',
    subtotal: '$4,800.00',
    total: '$4,800.00',
    lines: [{ desc: 'Brand identity package', qty: '1', rate: '4,800.00', amt: '$4,800.00' }],
  },
  {
    id: '0207',
    no: '0207',
    customer: 'Orion Apparel',
    email: 'hello@orionapparel.com',
    avatarLetter: 'O',
    avatarClass: 'bg-qb-navy',
    sent: '09/18/2026',
    expires: '10/18/2026',
    amount: 2600,
    amountDisplay: '$2,600.00',
    status: 'Declined',
    date: '2026-09-18',
    expiry: '2026-10-18',
    subtotal: '$2,600.00',
    total: '$2,600.00',
    lines: [{ desc: 'Spring collection — 30 units', qty: '30', rate: '86.67', amt: '$2,600.00' }],
  },
  {
    id: '0224',
    no: '0224',
    customer: 'Maple Supply',
    email: 'ar@maplesupply.io',
    avatarLetter: 'M',
    avatarClass: 'bg-qb-maroon',
    sent: '—',
    expires: '12/01/2026',
    amount: 2200,
    amountDisplay: '$2,200.00',
    status: 'Draft',
    date: '2026-10-28',
    expiry: '2026-12-01',
    subtotal: '$2,200.00',
    total: '$2,200.00',
    lines: [{ desc: 'Custom supply order', qty: '1', rate: '2,200.00', amt: '$2,200.00' }],
  },
  {
    id: '0201',
    no: '0201',
    customer: 'Blue Ridge Co.',
    email: 'billing@blueridge.co',
    avatarLetter: 'B',
    avatarClass: 'bg-qb-green',
    sent: '08/15/2026',
    expires: '09/15/2026',
    amount: 3100,
    amountDisplay: '$3,100.00',
    status: 'Expired',
    date: '2026-08-15',
    expiry: '2026-09-15',
    subtotal: '$3,100.00',
    total: '$3,100.00',
    lines: [{ desc: 'Fall collection — 25 units', qty: '25', rate: '124.00', amt: '$3,100.00' }],
  },
  {
    id: '0198',
    no: '0198',
    customer: 'Acme Corp',
    email: 'ap@acme.com',
    avatarLetter: 'A',
    avatarClass: 'bg-qb-blue',
    sent: '08/12/2026',
    expires: '09/12/2026',
    amount: 2400,
    amountDisplay: '$2,400.00',
    status: 'Converted',
    convertedInvoiceNo: '1002',
    date: '2026-08-12',
    expiry: '2026-09-12',
    subtotal: '$2,400.00',
    total: '$2,400.00',
    lines: [{ desc: 'Design retainer', qty: '1', rate: '2,400.00', amt: '$2,400.00' }],
  },
];

const NEW_ESTIMATE_TEMPLATE: Estimate = {
  id: '0225',
  no: '0225',
  customer: '',
  email: '',
  avatarLetter: 'N',
  avatarClass: 'bg-qb-blue',
  sent: '—',
  expires: '12/01/2026',
  amount: 0,
  amountDisplay: '$0.00',
  status: 'Draft',
  date: '2026-11-01',
  expiry: '2026-12-01',
  subtotal: '$0.00',
  total: '$0.00',
  lines: [{ desc: '', qty: '', rate: '', amt: '$0.00' }],
};

function statusPillClass(s: EstimateStatus): string {
  switch (s) {
    case 'Draft':
      return 'est draft';
    case 'Sent':
      return 'est sent';
    case 'Viewed':
      return 'est viewed';
    case 'Accepted':
      return 'est accepted';
    case 'Declined':
      return 'est declined';
    case 'Expired':
      return 'est expired';
    case 'Converted':
      return 'est converted';
  }
}

function statusLabel(e: Estimate): string {
  if (e.status === 'Converted' && e.convertedInvoiceNo) {
    return `Converted → ${e.convertedInvoiceNo}`;
  }
  return e.status;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SalesEstimatesScreen({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: SalesScreenProps) {
  const [estimates, setEstimates] = useState<Estimate[]>(INITIAL_ESTIMATES);
  const [activeTab, setActiveTab] = useState<TabKey>('All');
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [currentRow, setCurrentRow] = useState<Estimate | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentEstimate, setCurrentEstimate] = useState<Estimate | null>(null);
  const [drawerLines, setDrawerLines] = useState<DrawerLine[]>([]);

  const [convertOpen, setConvertOpen] = useState(false);

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuPos, setNewMenuPos] = useState({ top: 0, left: 0 });
  const newSplitBtnRef = useRef<HTMLButtonElement | null>(null);
  const lineCounter = useRef(0);

  // Outside click closes row ⋯ menu and new split menu.
  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (!t.closest('#row-menu') && !t.closest('.row-menu-trigger')) {
        setRowMenuOpen(false);
      }
      if (!t.closest('#new-menu') && !t.closest('.new-split-btn')) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return estimates.filter((e) => {
      const tabOk = activeTab === 'All' || e.status === activeTab;
      if (!tabOk) return false;
      if (!q) return true;
      return (
        e.no.toLowerCase().includes(q) ||
        e.customer.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q)
      );
    });
  }, [estimates, activeTab, searchText]);

  const total = estimates.length;
  const shown = filtered.length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const selectedCount = filtered.filter((e) => selected.has(e.id)).length;

  function toggleRowSelection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(e: ChangeEvent<HTMLInputElement>) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.target.checked) {
        filtered.forEach((x) => next.add(x.id));
      } else {
        filtered.forEach((x) => next.delete(x.id));
      }
      return next;
    });
  }

  function openDrawer(est: Estimate | null) {
    const target = est ?? NEW_ESTIMATE_TEMPLATE;
    setCurrentEstimate(target);
    setDrawerLines(target.lines.map((l) => ({ ...l, id: makeLineId() })));
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setCurrentEstimate(null);
    setDrawerLines([]);
  }

  function makeLineId(): string {
    lineCounter.current += 1;
    return `drawer-line-${lineCounter.current}`;
  }

  function handleRowClick(est: Estimate, e: MouseEvent) {
    if ((e.target as HTMLElement).closest('input,button')) return;
    openDrawer(est);
  }

  function handleRowMenuBtnClick(est: Estimate, e: MouseEvent) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    if (rowMenuOpen && currentRow?.id === est.id) {
      setRowMenuOpen(false);
      return;
    }
    const r = btn.getBoundingClientRect();
    setRowMenuPos({ top: r.bottom + 4, left: Math.min(r.right - 250, window.innerWidth - 270) });
    setCurrentRow(est);
    setRowMenuOpen(true);
  }

  function updateRowStatus(id: string, status: EstimateStatus, convertedInvoiceNo?: string) {
    setEstimates((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status, ...(convertedInvoiceNo ? { convertedInvoiceNo } : {}) }
          : e
      )
    );
  }

  function handleRowMenuAction(action: string) {
    const est = currentRow;
    setRowMenuOpen(false);
    if (!est) return;
    switch (action) {
      case 'view':
      case 'edit':
        openDrawer(est);
        break;
      case 'duplicate': {
        const clone: Estimate = {
          ...est,
          id: `${est.id}-dup-${Date.now()}`,
          no: `${est.no}-dup`,
          lines: est.lines.map((l) => ({ ...l })),
        };
        setEstimates((prev) => {
          const idx = prev.findIndex((x) => x.id === est.id);
          const arr = [...prev];
          arr.splice(idx + 1, 0, clone);
          return arr;
        });
        onToast(`Duplicated estimate ${est.no}`);
        break;
      }
      case 'send':
        updateRowStatus(est.id, 'Sent');
        onToast(`Sent estimate ${est.no}`);
        break;
      case 'remind':
        onToast(`Reminder sent for estimate ${est.no}`);
        break;
      case 'print':
        onToast(`Printing estimate ${est.no}`);
        break;
      case 'convert':
        openDrawer(est);
        setConvertOpen(true);
        break;
      case 'mark-accepted':
        updateRowStatus(est.id, 'Accepted');
        onToast(`Estimate ${est.no} marked accepted`);
        break;
      case 'mark-declined':
        updateRowStatus(est.id, 'Declined');
        onToast(`Estimate ${est.no} marked declined`);
        break;
      case 'delete':
        setEstimates((prev) => prev.filter((x) => x.id !== est.id));
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(est.id);
          return next;
        });
        onToast(`Estimate ${est.no} deleted`);
        break;
    }
  }

  function handleBulkAction(action: string) {
    if (action === 'close') {
      setSelected(new Set());
      return;
    }
    const ids = filtered.filter((e) => selected.has(e.id)).map((e) => e.id);
    const n = ids.length;
    if (action === 'delete') {
      setEstimates((prev) => prev.filter((e) => !selected.has(e.id)));
    }
    onToast(`${titleCase(action)} on ${n} estimate${n !== 1 ? 's' : ''}`);
    setSelected(new Set());
  }

  function handleNewSplitClick(e: MouseEvent) {
    e.stopPropagation();
    if (!newSplitBtnRef.current) return;
    if (newMenuOpen) {
      setNewMenuOpen(false);
      return;
    }
    const r = newSplitBtnRef.current.getBoundingClientRect();
    setNewMenuPos({ top: r.bottom + 4, left: Math.min(r.right - 220, window.innerWidth - 240) });
    setNewMenuOpen(true);
  }

  function handleNewMenuAction(kind: 'estimate' | 'template' | 'import') {
    setNewMenuOpen(false);
    if (kind === 'estimate') {
      onCreate('Estimate');
    } else if (kind === 'template') {
      onToast('New from template');
    } else {
      onToast('Import estimates');
    }
  }

  function handleDrawerSend() {
    onToast('Estimate sent to customer');
    if (currentEstimate) updateRowStatus(currentEstimate.id, 'Sent');
    closeDrawer();
  }

  function handleDrawerSave() {
    onToast('Estimate saved');
    closeDrawer();
  }

  function handleDrawerConvert() {
    setConvertOpen(true);
  }

  function handleConfirmConvert() {
    setConvertOpen(false);
    if (currentEstimate) {
      const invoiceNo = '10' + (Math.floor(Math.random() * 90) + 10);
      updateRowStatus(currentEstimate.id, 'Converted', invoiceNo);
    }
    closeDrawer();
    onToast('Estimate converted to invoice');
    const [domain, screenId] = SALES_NAV.invoices();
    onNavigate(domain, screenId);
  }

  function addLine() {
    setDrawerLines((prev) => [
      ...prev,
      { id: makeLineId(), desc: '', qty: '', rate: '', amt: '$0.00' },
    ]);
  }

  function removeLine(idx: number) {
    setDrawerLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  const menuStatus = currentRow?.status;
  const showSend = menuStatus === 'Draft';
  const showRemind = menuStatus === 'Sent' || menuStatus === 'Viewed';
  const showConvert = menuStatus === 'Accepted' || menuStatus === 'Viewed';
  const showMarkAccepted = menuStatus === 'Sent' || menuStatus === 'Viewed';
  const showMarkDeclined = menuStatus === 'Sent' || menuStatus === 'Viewed';

  return (
    <div className="bg-background font-sans text-body-md text-on-surface antialiased">
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Customer Hub</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Estimates</span>
        </div>
        <div className="text-label-sm text-on-surface-variant">Preview · standalone</div>
      </div>

      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div>
            <h1 className="text-headline-lg">Estimates</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Quotes sent to customers · convert to invoice when accepted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                onClick={() => onCreate('Estimate')}
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>New estimate
              </button>
              <button
                ref={newSplitBtnRef}
                onClick={handleNewSplitClick}
                className="new-split-btn h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <button
              onClick={() => onToast('Exporting estimates…')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export
            </button>
            <button
              onClick={() => onToast('Customize panel')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>Customize
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Open estimates</div>
            <div className="text-headline-sm mt-1 tabular-nums">3</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">$9,240 · awaiting response</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Sent this month</div>
            <div className="text-headline-sm mt-1 tabular-nums">5</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">$14,800 total</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Acceptance rate</div>
            <div className="text-headline-sm mt-1 tabular-nums text-secondary">42%</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">Last 30 days</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Converted to invoice</div>
            <div className="text-headline-sm mt-1 tabular-nums">2</div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">$5,040 this month</div>
          </div>
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">Create actions:</span>
          <button
            onClick={() => onCreate('Estimate')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">request_quote</span>Estimate
          </button>
          <button
            onClick={() => onCreate('Invoice')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>Invoice
          </button>
          <button
            onClick={() => onCreate('Customer')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>Customer
          </button>
          <button
            onClick={() => onToast('New from template')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>From template
          </button>
          <button
            onClick={() => onOpenCreateFlyout()}
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">
          {/* Status tabs */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`h-full px-3 text-label-md tab-underline ${
                  activeTab === t ? 'active' : 'text-on-surface-variant'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary"
                placeholder="Filter by estimate, customer…"
              />
            </div>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>Date range
            </button>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            <span className="ml-auto text-[11px] text-on-surface-variant">
              {shown} of {total}
            </span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar ${selectedCount > 0 ? 'show' : ''}`}>
            <span className="text-[12px] font-semibold">{selectedCount} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => handleBulkAction('send')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">send</span>Send
            </button>
            <button onClick={() => handleBulkAction('remind')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">notifications_active</span>Remind
            </button>
            <button onClick={() => handleBulkAction('convert')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">sync_alt</span>Convert to invoice
            </button>
            <button onClick={() => handleBulkAction('print')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">print</span>Print
            </button>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => handleBulkAction('delete')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete
            </button>
            <button className="ml-auto" onClick={() => handleBulkAction('close')}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          {/* Estimate table */}
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-2">Estimate</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={(ev) => handleRowClick(e, ev)}
                  className="hover:bg-surface-container-low cursor-pointer"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="row-check"
                      checked={selected.has(e.id)}
                      onChange={() => toggleRowSelection(e.id)}
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  </td>
                  <td className={`px-3 py-2 font-medium ${e.status === 'Expired' ? 'text-on-surface-variant' : ''}`}>
                    {e.no}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className={`est-avatar ${e.avatarClass}`}>{e.avatarLetter}</div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.customer}</div>
                        <div className="text-[11px] text-on-surface-variant">{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-on-surface-variant">{e.sent}</td>
                  <td className={`px-3 py-2 ${e.status === 'Expired' ? 'text-error' : 'text-on-surface-variant'}`}>
                    {e.expires}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.amountDisplay}</td>
                  <td className="px-3 py-2">
                    <span className={statusPillClass(e.status)}>{statusLabel(e)}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={(ev) => handleRowMenuBtnClick(e, ev)}
                      className="row-menu-trigger w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-on-surface-variant">
                    No estimates match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* New estimate split menu */}
      <div
        id="new-menu"
        className={`row-menu ${newMenuOpen ? 'open' : ''}`}
        style={{ top: newMenuPos.top, left: newMenuPos.left }}
      >
        <div className="menu-header">New estimate</div>
        <button onClick={() => handleNewMenuAction('estimate')}>
          <span className="material-symbols-outlined">request_quote</span>New estimate
        </button>
        <button onClick={() => handleNewMenuAction('template')}>
          <span className="material-symbols-outlined">content_copy</span>New from template
        </button>
        <button onClick={() => handleNewMenuAction('import')}>
          <span className="material-symbols-outlined">download</span>Import estimates
        </button>
      </div>

      {/* Row ⋯ menu */}
      <div
        id="row-menu"
        className={`row-menu ${rowMenuOpen ? 'open' : ''}`}
        style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
      >
        <div className="menu-header">This estimate</div>
        <button onClick={() => handleRowMenuAction('view')}>
          <span className="material-symbols-outlined">open_in_new</span>Open estimate
        </button>
        <button onClick={() => handleRowMenuAction('edit')}>
          <span className="material-symbols-outlined">edit</span>Edit
        </button>
        <button onClick={() => handleRowMenuAction('duplicate')}>
          <span className="material-symbols-outlined">content_copy</span>Duplicate
        </button>
        <div className="sep"></div>
        <div className="menu-header">Send</div>
        {showSend && (
          <button onClick={() => handleRowMenuAction('send')}>
            <span className="material-symbols-outlined">send</span>Send
          </button>
        )}
        {showRemind && (
          <button onClick={() => handleRowMenuAction('remind')}>
            <span className="material-symbols-outlined">notifications_active</span>Send reminder
          </button>
        )}
        <button onClick={() => handleRowMenuAction('print')}>
          <span className="material-symbols-outlined">print</span>Print / download PDF
        </button>
        <div className="sep"></div>
        <div className="menu-header">Close the deal</div>
        {showConvert && (
          <button onClick={() => handleRowMenuAction('convert')}>
            <span className="material-symbols-outlined">sync_alt</span>Convert to invoice
          </button>
        )}
        {showMarkAccepted && (
          <button onClick={() => handleRowMenuAction('mark-accepted')}>
            <span className="material-symbols-outlined">check_circle</span>Mark accepted
          </button>
        )}
        {showMarkDeclined && (
          <button onClick={() => handleRowMenuAction('mark-declined')}>
            <span className="material-symbols-outlined">cancel</span>Mark declined
          </button>
        )}
        <div className="sep"></div>
        <button className="danger" onClick={() => handleRowMenuAction('delete')}>
          <span className="material-symbols-outlined">delete</span>Delete
        </button>
      </div>

      {/* Drawer scrim + drawer */}
      <div
        className={`drawer-scrim ${drawerOpen ? 'open' : ''}`}
        onClick={closeDrawer}
      />
      <div className={`drawer ${drawerOpen ? 'open' : ''}`}>
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">request_quote</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate">
                Estimate {currentEstimate?.no ?? ''}
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {currentEstimate
                  ? `${currentEstimate.customer || 'New estimate'} · ${currentEstimate.status}`
                  : '—'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
              title="Download"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
            </button>
            <button
              onClick={closeDrawer}
              className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Customer */}
          <div className="bg-surface-container-low rounded-lg p-3">
            <div className="text-[10px] text-on-surface-variant uppercase font-bold">Customer</div>
            <div className="text-headline-sm mt-1">{currentEstimate?.customer || '—'}</div>
            <div className="text-[11px] text-on-surface-variant">{currentEstimate?.email || '—'}</div>
          </div>

          {/* Estimate details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Estimate no.</label>
              <input className="field-input" defaultValue={currentEstimate?.no ?? ''} />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select className="field-input" defaultValue={currentEstimate?.status ?? 'Draft'}>
                <option>Draft</option>
                <option>Sent</option>
                <option>Viewed</option>
                <option>Accepted</option>
                <option>Declined</option>
                <option>Expired</option>
                <option>Converted</option>
              </select>
            </div>
            <div>
              <label className="field-label">Estimate date</label>
              <input className="field-input" type="date" defaultValue={currentEstimate?.date ?? ''} />
            </div>
            <div>
              <label className="field-label">Expires</label>
              <input className="field-input" type="date" defaultValue={currentEstimate?.expiry ?? ''} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Line items</div>
              <button
                onClick={addLine}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                + Add line
              </button>
            </div>
            <div
              className="est-line"
              style={{
                background: '#f4f3f7',
                borderRadius: '4px 4px 0 0',
                font: '700 10px Inter',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: '#5a6355',
                padding: '6px 8px',
                gridTemplateColumns: '24px 1fr 70px 90px 100px 24px',
              }}
            >
              <span>#</span>
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
              <span></span>
            </div>
            <div>
              {drawerLines.map((l, i) => (
                <div className="est-line" key={l.id}>
                  <span className="text-[11px] text-on-surface-variant">{i + 1}</span>
                  <input defaultValue={l.desc} />
                  <input className="num" defaultValue={l.qty} />
                  <input className="num" defaultValue={l.rate} />
                  <input className="num" defaultValue={l.amt} readOnly />
                  <button
                    onClick={() => removeLine(i)}
                    className="w-5 h-5 rounded hover:bg-error-container flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="tabular-nums">{currentEstimate?.subtotal ?? '$0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Tax (est.)</span>
                <span className="tabular-nums">$0.00</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-surface-dim font-semibold">
                <span>Estimate total</span>
                <span className="tabular-nums">{currentEstimate?.total ?? '$0.00'}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-surface-dim pt-3">
            <label className="field-label">Note to customer</label>
            <textarea
              className="field-input"
              style={{ height: '56px', padding: '8px 10px', fontFamily: 'inherit' }}
              defaultValue="Thanks for the opportunity — let us know if you have questions."
              placeholder="Optional note visible to the customer"
            />
          </div>

          {/* Activity */}
          <div className="border-t border-surface-dim pt-3">
            <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Activity</div>
            <div className="space-y-2 text-body-sm">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary mt-0.5">send</span>
                <div>
                  <div className="font-medium">Sent to customer</div>
                  <div className="text-[11px] text-on-surface-variant">10/26/2026 · 9:42 AM</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[14px] text-tertiary mt-0.5">visibility</span>
                <div>
                  <div className="font-medium">Viewed by customer</div>
                  <div className="text-[11px] text-on-surface-variant">10/28/2026 · 3:15 PM</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer footer */}
        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button
            onClick={closeDrawer}
            className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDrawerSend}
              className="h-8 px-3 border border-surface-dim rounded text-body-md font-semibold hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">send</span>Send
            </button>
            <div className="split-btn flex">
              <button
                onClick={handleDrawerSave}
                className="h-8 px-3 border border-surface-dim text-body-md font-semibold hover:bg-surface-container-low split-btn-main"
              >
                Save
              </button>
              <button className="h-8 px-1.5 border border-surface-dim hover:bg-surface-container-low split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <div className="split-btn flex">
              <button
                onClick={handleDrawerConvert}
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main"
              >
                Convert to invoice
              </button>
              <button className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Convert confirmation modal */}
      <div
        className={`modal-scrim ${convertOpen ? 'open' : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setConvertOpen(false);
        }}
      >
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-secondary-container flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[28px] text-on-secondary-container">sync_alt</span>
            </div>
            <h2 className="text-headline-sm mb-1">Convert estimate to invoice?</h2>
            <p className="text-body-sm text-on-surface-variant mb-4">
              {currentEstimate
                ? `Estimate ${currentEstimate.no} · ${currentEstimate.customer || '—'} · ${currentEstimate.total}`
                : '—'}
            </p>
            <div className="text-left bg-surface-container-low rounded-lg p-3 mb-4 text-[11px] text-on-surface-variant space-y-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary">check</span>
                Customer, line items, and totals carry over
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary">check</span>
                Estimate marked Converted with a link to the invoice
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-secondary">check</span>
                Invoice starts as Draft — send when you&apos;re ready
              </div>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={() => setConvertOpen(false)}
              className="flex-1 h-9 border border-surface-dim rounded text-body-md hover:bg-surface-container-low"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmConvert}
              className="flex-1 h-9 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px] align-middle mr-1">sync_alt</span>Convert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
