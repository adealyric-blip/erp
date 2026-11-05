'use client';
import './receipts.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountingScreenProps } from './types';

/* ────────── types ────────── */

type ViewTab = 'review' | 'reviewed' | 'all';
type RowStatus = 'review' | 'reviewed';
type RowAction = 'review' | 'reviewed' | 'expense-created' | 'matched';
type BulkAction = 'categorize' | 'attach' | 'create' | 'delete' | 'close';
type RowMenuAction =
  | 'view'
  | 'edit'
  | 'download'
  | 'create-expense'
  | 'create-bill'
  | 'attach'
  | 'match'
  | 'mark-reviewed'
  | 'unmark-reviewed'
  | 'delete';

interface ReceiptRow {
  receiptId: string;
  status: RowStatus;
  vendor: string;
  amount: string;
  tax: string;
  date: string;
  account: string;
  category: string;
  chipCls: string;
  chipIcon: string | null;
  chipLabel: string;
  action: RowAction;
  processing: boolean;
  fileName: string;
  checked: boolean;
  hidden: boolean;
  /** row injected by the fake OCR pipeline — mockup never adds the hover:bg class to it */
  dropped: boolean;
}

interface MenuState {
  open: boolean;
  top: number;
  left: number;
}

interface DrawerSnapshot {
  title: string;
  sub: string;
  vendor: string;
  date: string;
  amt: string;
  tax: string;
}

interface DrawerForm {
  vendor: string;
  date: string;
  amount: string;
  tax: string;
  account: string;
  category: string;
  notes: string;
}

/* ────────── constants ────────── */

const FWD_ADDRESS = 'receipts@managekube.unsaid.app';

const FAKE_VENDORS = ['Staples', 'FedEx', 'Adobe', 'Amazon Web Services', 'Google Workspace', 'UPS'];

const INITIAL_ROWS: ReceiptRow[] = [
  { receiptId: 'R-1042', status: 'review', vendor: 'Staples', amount: '$142.50', tax: '$8.55', date: '10/30/2026', account: 'Visa •4421', category: 'Office supplies', chipCls: 'cat-chip suggested', chipIcon: 'auto_awesome', chipLabel: 'Office supplies', action: 'review', processing: false, fileName: '', checked: false, hidden: false, dropped: false },
  { receiptId: 'R-1041', status: 'review', vendor: 'FedEx', amount: '$84.20', tax: '$5.05', date: '10/29/2026', account: 'Bank •9910', category: '', chipCls: 'cat-chip uncat', chipIcon: 'error', chipLabel: 'Needs category', action: 'review', processing: false, fileName: '', checked: false, hidden: false, dropped: false },
  { receiptId: 'R-1040', status: 'review', vendor: 'Adobe', amount: '$59.99', tax: '$3.60', date: '10/30/2026', account: 'Visa •4421', category: 'Software', chipCls: 'cat-chip suggested', chipIcon: 'auto_awesome', chipLabel: 'Software', action: 'review', processing: false, fileName: '', checked: false, hidden: false, dropped: false },
  { receiptId: 'R-1039', status: 'reviewed', vendor: 'UPS', amount: '$62.10', tax: '$3.73', date: '10/26/2026', account: 'Amex •2103', category: 'Shipping', chipCls: 'cat-chip done', chipIcon: 'check_circle', chipLabel: 'Shipping', action: 'reviewed', processing: false, fileName: '', checked: false, hidden: false, dropped: false },
  { receiptId: 'R-1038', status: 'reviewed', vendor: 'Google Workspace', amount: '$144.00', tax: '$0.00', date: '10/25/2026', account: 'Visa •4421', category: 'Software', chipCls: 'cat-chip done', chipIcon: 'check_circle', chipLabel: 'Software', action: 'reviewed', processing: false, fileName: '', checked: false, hidden: false, dropped: false },
];

const PICKER_SUGGESTED: { val: string; dot: string }[] = [
  { val: 'Office supplies', dot: '#0077c5' },
  { val: 'Shipping', dot: '#1e5a38' },
  { val: 'Software', dot: '#6b1e28' },
  { val: 'Advertising', dot: '#0e5e6f' },
];

const PICKER_ALL: { val: string; dot: string }[] = [
  { val: 'Meals & entertainment', dot: '#dad9dd' },
  { val: 'Travel', dot: '#dad9dd' },
  { val: 'Ask My Accountant', dot: '#ba1a1a' },
];

interface MatchItem {
  kind: 'bank' | 'bill';
  /** data-match-name — used verbatim in the toast */
  name: string;
  icon: string;
  iconCls: string;
  line1: string;
  line2: string;
  amt: string;
  amtCls: string;
}

const MATCH_BANK: MatchItem[] = [
  { kind: 'bank', name: 'FEDEX 001239847', icon: 'account_balance', iconCls: 'text-error', line1: 'FEDEX 001239847', line2: '10/29/2026 · Bank •9910', amt: '−$84.20', amtCls: 'text-error' },
  { kind: 'bank', name: 'STAPLES #0412', icon: 'account_balance', iconCls: 'text-error', line1: 'STAPLES #0412', line2: '10/30/2026 · Bank •9910', amt: '−$142.50', amtCls: 'text-error' },
  { kind: 'bank', name: 'AWS EMEA CHARGES', icon: 'account_balance', iconCls: 'text-error', line1: 'AWS EMEA CHARGES', line2: '10/27/2026 · Visa •4421', amt: '−$124.88', amtCls: 'text-error' },
];

const MATCH_BILLS: MatchItem[] = [
  { kind: 'bill', name: 'Bill PF-9211 — Printful', icon: 'description', iconCls: 'text-qb-maroon', line1: 'Bill PF-9211 · Printful', line2: 'Due 11/10/2026', amt: '$2,880.00', amtCls: 'text-on-surface-variant' },
];

function toISO(usDate: string): string {
  const m = (usDate || '').match(/(\d+)\/(\d+)\/(\d+)/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
}

/* ═══════════════ component ═══════════════ */

export default function Receipts(_props: AccountingScreenProps) {
  const [rows, setRows] = useState<ReceiptRow[]>(INITIAL_ROWS);
  const [viewTab, setViewTab] = useState<ViewTab>('review');
  const [filterText, setFilterText] = useState('');
  const [checkAll, setCheckAll] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  /* positioned dropdowns */
  const [catPicker, setCatPicker] = useState<MenuState>({ open: false, top: 0, left: 0 });
  const [rowMenu, setRowMenu] = useState<MenuState>({ open: false, top: 0, left: 0 });
  const [matchMenu, setMatchMenu] = useState<MenuState>({ open: false, top: 0, left: 0 });
  const [pickerReceiptId, setPickerReceiptId] = useState<string | null>(null);
  const [menuReceiptId, setMenuReceiptId] = useState<string | null>(null);

  /* receipt preview drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReceiptId, setDrawerReceiptId] = useState<string | null>(null);
  const [drawerSnap, setDrawerSnap] = useState<DrawerSnapshot | null>(null);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>({ vendor: '', date: '', amount: '', tax: '', account: '', category: '', notes: '' });

  const toastTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const fakeIdCounter = useRef(1050);
  const timeouts = useRef<Set<number>>(new Set());

  /* ────────── utils ────────── */
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 1800);
  }, []);

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeouts.current.delete(id);
      fn();
    }, ms);
    timeouts.current.add(id);
  }, []);

  const closeAllMenus = useCallback(() => {
    setCatPicker((m) => ({ ...m, open: false }));
    setRowMenu((m) => ({ ...m, open: false }));
    setMatchMenu((m) => ({ ...m, open: false }));
  }, []);

  /* clear pending timers on unmount */
  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current.clear();
  }, []);

  /* global close on outside click — only armed while a menu is open */
  useEffect(() => {
    if (!catPicker.open && !rowMenu.open && !matchMenu.open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (!t.closest('#cat-picker')) setCatPicker((m) => ({ ...m, open: false }));
      if (!t.closest('#row-menu')) setRowMenu((m) => ({ ...m, open: false }));
      if (!t.closest('#match-menu')) setMatchMenu((m) => ({ ...m, open: false }));
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [catPicker.open, rowMenu.open, matchMenu.open]);

  /* derived counts (mockup's updateCounts) */
  const reviewCount = rows.filter((r) => r.status === 'review').length;
  const visibleCount = rows.filter((r) => !r.hidden).length;
  const countText = `1–${visibleCount} of ${rows.length}`;
  const checkedCount = rows.filter((r) => r.checked).length;
  const menuRow = menuReceiptId !== null ? rows.find((r) => r.receiptId === menuReceiptId) ?? null : null;
  const menuReviewed = menuRow !== null && menuRow.status === 'reviewed';

  /* ────────── Receipt drawer ────────── */
  const openReceiptRow = (row: ReceiptRow) => {
    const vendor = row.vendor || 'Unknown';
    const id = row.receiptId || 'R-0000';
    const status = row.status === 'review' ? 'For review' : 'Reviewed';
    setDrawerReceiptId(row.receiptId);
    setDrawerSnap({
      title: `Receipt — ${vendor}`,
      sub: `${id} · ${status}`,
      vendor,
      date: row.date || '',
      amt: (row.amount || '').replace('$', ''),
      tax: (row.tax || '').replace('$', ''),
    });
    /* notes is never repopulated by the mockup — keep whatever is there */
    setDrawerForm((f) => ({
      ...f,
      vendor: row.vendor || '',
      date: toISO(row.date),
      amount: row.amount || '',
      tax: row.tax || '',
      account: row.account || 'Visa •4421',
      category: row.category || '',
    }));
    setDrawerOpen(true);
  };

  const closeReceipt = useCallback(() => setDrawerOpen(false), []);

  const handleCreateExpense = () => {
    if (drawerReceiptId !== null) {
      setRows((rs) => rs.map((r) => (r.receiptId === drawerReceiptId ? { ...r, status: 'reviewed', action: 'expense-created' } : r)));
    }
    toast('Expense created from receipt');
    closeReceipt();
  };

  const handleMatchBtn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setCatPicker((m) => ({ ...m, open: false }));
    setRowMenu((m) => ({ ...m, open: false }));
    const r = e.currentTarget.getBoundingClientRect();
    setMatchMenu({ open: true, top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 360) });
  };

  /* ────────── Handle dropped/picked files → fake OCR pipeline ────────── */
  const addProcessingRow = (file: File) => {
    const id = 'R-' + ++fakeIdCounter.current;
    const vendorGuess = FAKE_VENDORS[Math.floor(Math.random() * FAKE_VENDORS.length)];
    const amountGuess = '$' + (20 + Math.random() * 180).toFixed(2);
    const dateGuess = new Date().toLocaleDateString('en-US');
    const newRow: ReceiptRow = {
      receiptId: id,
      status: 'review',
      vendor: '',
      amount: '',
      tax: '',
      date: dateGuess,
      account: 'Visa •4421',
      category: '',
      chipCls: 'cat-chip uncat',
      chipIcon: 'error',
      chipLabel: 'Needs category',
      action: 'review',
      processing: true,
      fileName: file.name,
      checked: false,
      hidden: false,
      dropped: true,
    };
    setRows((rs) => [newRow, ...rs]);

    /* resolve after 1100ms */
    schedule(() => {
      const resolved: ReceiptRow = {
        ...newRow,
        processing: false,
        vendor: vendorGuess,
        amount: amountGuess,
        tax: '$' + (parseFloat(amountGuess.slice(1)) * 0.06).toFixed(2),
      };
      setRows((rs) => rs.map((r) => (r.receiptId === id ? resolved : r)));
      toast(`${vendorGuess} receipt extracted from ${file.name}`);
      openReceiptRow(resolved); /* auto-open preview per (a)+(b) */
    }, 1100);
  };

  const handleFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    files.forEach((file, idx) => {
      schedule(() => addProcessingRow(file), idx * 350);
    });
  };

  const triggerUpload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (uploadInputRef.current) uploadInputRef.current.click();
  };

  const triggerSnap = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (snapInputRef.current) snapInputRef.current.click();
  };

  /* ────────── Forwarding copy ────────── */
  const handleCopyFwd = async () => {
    const val = FWD_ADDRESS;
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = val;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    setCopyConfirm(true);
    copyTimer.current = window.setTimeout(() => setCopyConfirm(false), 1800);
  };

  /* ────────── View tabs ────────── */
  const handleViewTab = (st: ViewTab) => {
    setViewTab(st);
    setRows((rs) => rs.map((r) => ({ ...r, hidden: !(st === 'all' || r.status === st) })));
  };

  /* ────────── Row interactions ────────── */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, row: ReceiptRow) => {
    if ((e.target as HTMLElement).closest('input,button,[data-cat-picker],[data-row-menu]')) return;
    openReceiptRow(row);
  };

  const toggleRowCheck = (receiptId: string) => {
    setRows((rs) => rs.map((r) => (r.receiptId === receiptId ? { ...r, checked: !r.checked } : r)));
  };

  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCheckAll(e.target.checked);
    setRows((rs) => rs.map((r) => (r.processing ? r : { ...r, checked: e.target.checked })));
  };

  /* ────────── Bulk bar ────────── */
  const handleBulk = (act: BulkAction) => {
    if (act === 'close') {
      setRows((rs) => rs.map((r) => ({ ...r, checked: false })));
      setCheckAll(false);
      return;
    }
    const n = rows.filter((r) => r.checked).length;
    toast(`${act.charAt(0).toUpperCase() + act.slice(1)} on ${n} receipt${n !== 1 ? 's' : ''}`);
    if (act === 'delete') {
      setRows((rs) => rs.filter((r) => !r.checked));
    }
  };

  /* ────────── Category picker ────────── */
  const handleChipClick = (e: React.MouseEvent<HTMLButtonElement>, receiptId: string) => {
    e.stopPropagation();
    closeAllMenus();
    setPickerReceiptId(receiptId);
    const r = e.currentTarget.getBoundingClientRect();
    setCatPicker({ open: true, top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 300) });
  };

  const pickCategory = (val: string) => {
    if (pickerReceiptId !== null) {
      setRows((rs) => rs.map((r) => (r.receiptId === pickerReceiptId
        ? { ...r, category: val, chipCls: 'cat-chip', chipIcon: null, chipLabel: val }
        : r)));
    }
    setCatPicker((m) => ({ ...m, open: false }));
  };

  /* ────────── Row ⋯ menu ────────── */
  const handleRowMenuBtn = (e: React.MouseEvent<HTMLButtonElement>, receiptId: string) => {
    e.stopPropagation();
    closeAllMenus();
    setMenuReceiptId(receiptId);
    const r = e.currentTarget.getBoundingClientRect();
    setRowMenu({ open: true, top: r.bottom + 4, left: Math.min(r.right - 250, window.innerWidth - 270) });
  };

  const handleRowMenuAction = (e: React.MouseEvent<HTMLButtonElement>, action: RowMenuAction) => {
    e.stopPropagation();
    const id = menuReceiptId;
    setRowMenu((m) => ({ ...m, open: false }));
    if (id === null) return;
    switch (action) {
      case 'view':
      case 'edit': {
        const row = rows.find((r) => r.receiptId === id);
        if (row) openReceiptRow(row);
        break;
      }
      case 'download':
        toast('Download original receipt');
        break;
      case 'create-expense':
        setRows((rs) => rs.map((r) => (r.receiptId === id ? { ...r, status: 'reviewed', action: 'expense-created' } : r)));
        toast('Expense created from receipt');
        break;
      case 'create-bill':
        toast('Bill created from receipt');
        break;
      case 'attach':
        toast('Attach to existing — opens bill picker');
        break;
      case 'match': {
        const r = e.currentTarget.getBoundingClientRect();
        setMatchMenu({ open: true, top: r.bottom + 4, left: Math.min(r.left - 100, window.innerWidth - 360) });
        break;
      }
      case 'mark-reviewed':
        setRows((rs) => rs.map((r) => (r.receiptId === id ? { ...r, status: 'reviewed', action: 'reviewed' } : r)));
        toast('Marked as reviewed');
        break;
      case 'unmark-reviewed':
        setRows((rs) => rs.map((r) => (r.receiptId === id ? { ...r, status: 'review', action: 'review' } : r)));
        toast('Moved back to review');
        break;
      case 'delete':
        setRows((rs) => rs.filter((r) => r.receiptId !== id));
        toast('Receipt deleted');
        break;
    }
  };

  /* ────────── Match menu selection ────────── */
  const handleMatchSelect = (name: string) => {
    setMatchMenu((m) => ({ ...m, open: false }));
    if (menuReceiptId !== null) {
      setRows((rs) => rs.map((r) => (r.receiptId === menuReceiptId ? { ...r, status: 'reviewed', action: 'matched' } : r)));
    }
    closeReceipt();
    toast(`Receipt matched to "${name}"`);
  };

  /* ═══════════════ render ═══════════════ */

  return (
    <div className="receipts-page bg-background font-sans text-body-md text-on-surface antialiased">

      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Accounting</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Receipts</span>
        </div>
      </div>

      <main className="px-6 pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Receipts</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Intake inbox — forward, drop, snap. Extracted fields auto-fill.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" data-trigger-upload onClick={triggerUpload}>
              <span className="material-symbols-outlined text-[16px]">upload</span>Upload</button>
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" data-trigger-snap onClick={triggerSnap}>
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>Snap photo</button>
          </div>
        </div>

        {/* Forwarding address + drop zone */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
          <div className="xl:col-span-2">
            <div
              className={`drop-zone${dragOver ? ' dragover' : ''}`}
              id="drop-zone"
              data-drop-zone
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => { if (uploadInputRef.current) uploadInputRef.current.click(); }}
            >
              <span className="material-symbols-outlined text-[40px] text-primary">cloud_upload</span>
              <div className="text-body-md font-semibold mt-2">Drop receipts here</div>
              <div className="text-[11px] text-on-surface-variant mt-1">PDF, JPG, PNG · up to 20 MB each · multiple files supported</div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button className="h-8 px-3 bg-primary text-white rounded text-label-sm font-semibold hover:bg-primary-container flex items-center gap-1" data-trigger-upload onClick={triggerUpload}>
                  <span className="material-symbols-outlined text-[14px]">upload_file</span>Choose files</button>
                <button className="h-8 px-3 border border-surface-dim rounded text-label-sm hover:bg-white flex items-center gap-1" data-trigger-snap onClick={triggerSnap}>
                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>Snap</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px] text-qb-blue">mail</span>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Forward by email</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mb-3">Send receipts to this address — they'll appear here for review.</p>
            <div className="flex items-center gap-1">
              <input id="fwd-address" readOnly className="flex-1 h-8 px-2.5 border border-surface-dim rounded text-body-sm font-mono bg-surface-container-low" value={FWD_ADDRESS} />
              <button id="copy-fwd" className="h-8 px-2.5 border border-surface-dim rounded text-label-sm font-semibold hover:bg-surface-container-low flex items-center gap-1" data-copy-fwd onClick={handleCopyFwd}>
                <span className="material-symbols-outlined text-[14px]">content_copy</span>Copy</button>
            </div>
            <div className={`mt-2 text-[11px] text-secondary flex items-center gap-1${copyConfirm ? '' : ' hidden-imp'}`} data-copy-confirm>
              <span className="material-symbols-outlined text-[14px]">check_circle</span>Copied to clipboard
            </div>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            <button className={`h-full px-3 text-label-md tab-underline${viewTab === 'review' ? ' active' : ''}`} data-viewtab="review" onClick={() => handleViewTab('review')}>
              For review <span className="ml-1 px-1.5 py-0.5 rounded-full bg-qb-blue text-white text-[10px] font-bold" data-tab-review>{reviewCount}</span></button>
            <button className={`h-full px-3 text-label-md tab-underline text-on-surface-variant${viewTab === 'reviewed' ? ' active' : ''}`} data-viewtab="reviewed" onClick={() => handleViewTab('reviewed')}>Reviewed</button>
            <button className={`h-full px-3 text-label-md tab-underline text-on-surface-variant${viewTab === 'all' ? ' active' : ''}`} data-viewtab="all" onClick={() => handleViewTab('all')}>All</button>
          </div>

          {/* Filter bar */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Filter by vendor, amount…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            </div>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>Date range</button>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views</button>
            <span className="ml-auto text-[11px] text-on-surface-variant" data-rc-count>{countText}</span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar${checkedCount > 0 ? ' show' : ''}`} data-bulk-bar>
            <span className="text-[12px] font-semibold" data-bulk-count>{checkedCount} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <button data-bulk="categorize" onClick={() => handleBulk('categorize')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">category</span>Categorize</button>
            <button data-bulk="attach" onClick={() => handleBulk('attach')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">attach_file</span>Attach to bill</button>
            <button data-bulk="create" onClick={() => handleBulk('create')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt_long</span>Create expenses</button>
            <span className="w-px h-4 bg-white/30"></span>
            <button data-bulk="delete" onClick={() => handleBulk('delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" data-bulk="close" aria-label="Close" onClick={() => handleBulk('close')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>

          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" data-check-all checked={checkAll} onChange={handleCheckAll} /></th>
                <th className="px-3 py-2 w-12">Receipt</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Payment account</th>
                <th className="px-3 py-2 text-right">Amount / Tax</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Action</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim" data-rc-tbody>
              {rows.map((row) => {
                const rowCls = row.processing
                  ? 'rc-row processing-row cursor-pointer'
                  : row.dropped
                    ? 'rc-row cursor-pointer'
                    : 'hover:bg-surface-container-low cursor-pointer rc-row';
                return (
                  <tr
                    key={row.receiptId}
                    className={rowCls}
                    data-status={row.status}
                    data-vendor={row.vendor}
                    data-amount={row.amount}
                    data-tax={row.tax}
                    data-date={row.date}
                    data-account={row.account}
                    data-category={row.category}
                    data-receipt-id={row.receiptId}
                    style={row.hidden ? { display: 'none' } : undefined}
                    onClick={row.processing ? undefined : (e) => handleRowClick(e, row)}
                  >
                    <td className="px-3 py-2"><input type="checkbox" className="row-check rc-check" disabled={row.processing} checked={row.checked} onChange={() => toggleRowCheck(row.receiptId)} /></td>
                    <td className="px-3 py-2"><div className="receipt-thumb">{row.processing ? <div className="spinner"></div> : null}</div></td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className={row.processing ? 'px-3 py-2 font-medium italic text-on-surface-variant' : 'px-3 py-2 font-medium'}>{row.processing ? 'Extracting…' : row.vendor}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{row.processing ? row.fileName : row.account}</td>
                    <td className={row.processing ? 'px-3 py-2 text-right tabular-nums text-on-surface-variant' : 'px-3 py-2 text-right tabular-nums'}>
                      {row.processing ? '…' : (
                        <>
                          <div>{row.amount}</div>
                          <div className="text-[10px] text-on-surface-variant">Tax {row.tax}</div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.processing ? (
                        <span className="text-[11px] text-on-surface-variant flex items-center gap-1"><div className="spinner" style={{ width: '12px', height: '12px' }}></div>Processing</span>
                      ) : (
                        <button className={row.chipCls} data-cat-picker onClick={(e) => handleChipClick(e, row.receiptId)}>
                          {row.chipIcon ? <span className="material-symbols-outlined text-[12px]">{row.chipIcon}</span> : null}{row.chipLabel}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.processing ? (
                        <span className="text-[11px] text-on-surface-variant">—</span>
                      ) : row.action === 'review' ? (
                        <button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" data-action="review" onClick={(e) => { e.stopPropagation(); openReceiptRow(row); }}>Review</button>
                      ) : (
                        <span className="text-[11px] text-secondary flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">check</span>{row.action === 'expense-created' ? 'Expense created' : row.action === 'matched' ? 'Matched' : 'Reviewed'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center"
                        data-row-menu
                        aria-label="Receipt actions"
                        disabled={row.processing}
                        onClick={row.processing ? undefined : (e) => handleRowMenuBtn(e, row.receiptId)}
                      >
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </main>

      {/* Hidden inputs (real file pickers) */}
      <input type="file" id="file-input-upload" accept="image/*,application/pdf" multiple className="hidden-imp" ref={uploadInputRef} onChange={(e) => handleFiles(e.target.files)} />
      <input type="file" id="file-input-snap" accept="image/*" capture="environment" className="hidden-imp" ref={snapInputRef} onChange={(e) => handleFiles(e.target.files)} />

      {/* ═══════════ RECEIPT PREVIEW DRAWER ═══════════ */}
      <div className={`drawer-scrim${drawerOpen ? ' open' : ''}`} id="receipt-scrim" onClick={closeReceipt}></div>
      <div className={`drawer${drawerOpen ? ' open' : ''}`} id="receipt-drawer">
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate" data-receipt-title>{drawerSnap ? drawerSnap.title : 'Receipt — Vendor'}</div>
              <div className="text-[11px] text-on-surface-variant" data-receipt-sub>{drawerSnap ? drawerSnap.sub : 'R-0000 · For review'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" title="Download original" data-dl-orig aria-label="Download original" onClick={() => toast('Download original receipt')}>
              <span className="material-symbols-outlined text-[18px]">download</span></button>
            <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" data-close-receipt aria-label="Close" onClick={closeReceipt}>
              <span className="material-symbols-outlined text-[18px]">close</span></button>
          </div>
        </div>

        <div className="drawer-split">
          {/* Left: image viewer */}
          <div className="drawer-image">
            <div className="drawer-image-viewer" data-receipt-image>
              {/* fake receipt rendered here */}
              {drawerSnap && (
                <div className="fake-receipt">
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>{drawerSnap.vendor.toUpperCase()}</div>
                  <div style={{ textAlign: 'center', fontSize: '10px', color: '#5a6355' }}>Store #0412</div>
                  <div style={{ height: '1px', background: '#1a1c1e', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date</span><span>{drawerSnap.date}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Time</span><span>2:42 PM</span></div>
                  <div style={{ height: '1px', background: '#dad9dd', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Item 1</span><span>$18.44</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Item 2</span><span>$32.10</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Item 3</span><span>$44.90</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Item 4</span><span>$38.51</span></div>
                  <div style={{ height: '1px', background: '#dad9dd', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>${(Number(drawerSnap.amt) - Number(drawerSnap.tax)).toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax</span><span>${drawerSnap.tax || '0.00'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid #1a1c1e', paddingTop: '4px', marginTop: '4px' }}><span>TOTAL</span><span>${drawerSnap.amt}</span></div>
                  <div style={{ height: '1px', background: '#dad9dd', margin: '8px 0' }}></div>
                  <div style={{ fontSize: '9px', textAlign: 'center', color: '#5a6355' }}>VISA ****4421<br />Auth: 002847<br />Thank you!</div>
                </div>
              )}
            </div>
            <div className="border-t border-surface-dim p-2 flex items-center justify-center gap-2 bg-white">
              <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1" aria-label="Zoom in">
                <span className="material-symbols-outlined text-[14px]">zoom_in</span></button>
              <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1" aria-label="Zoom out">
                <span className="material-symbols-outlined text-[14px]">zoom_out</span></button>
              <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1" aria-label="Rotate">
                <span className="material-symbols-outlined text-[14px]">rotate_right</span></button>
              <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>Open</button>
            </div>
          </div>
          {/* Right: extracted fields */}
          <div className="drawer-fields">
            <div className="drawer-fields-body">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-3">Extracted fields</div>
              <div className="field-row">
                <div className="field-label">Vendor</div>
                <div className="field-value"><input data-field="vendor" value={drawerForm.vendor} onChange={(e) => setDrawerForm((f) => ({ ...f, vendor: e.target.value }))} /></div>
              </div>
              <div className="field-row">
                <div className="field-label">Date</div>
                <div className="field-value"><input data-field="date" type="date" value={drawerForm.date} onChange={(e) => setDrawerForm((f) => ({ ...f, date: e.target.value }))} /></div>
              </div>
              <div className="field-row">
                <div className="field-label">Amount</div>
                <div className="field-value"><input data-field="amount" value={drawerForm.amount} onChange={(e) => setDrawerForm((f) => ({ ...f, amount: e.target.value }))} /></div>
              </div>
              <div className="field-row">
                <div className="field-label">Tax</div>
                <div className="field-value"><input data-field="tax" value={drawerForm.tax} onChange={(e) => setDrawerForm((f) => ({ ...f, tax: e.target.value }))} /></div>
              </div>
              <div className="field-row">
                <div className="field-label">Payment account</div>
                <div className="field-value">
                  <select data-field="account" value={drawerForm.account} onChange={(e) => setDrawerForm((f) => ({ ...f, account: e.target.value }))}>
                    <option>Visa •4421</option><option>Bank •9910</option><option>Amex •2103</option>
                    <option>Cash</option><option>Personal funds — reimburse</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field-label">Category</div>
                <div className="field-value">
                  <select data-field="category" value={drawerForm.category} onChange={(e) => setDrawerForm((f) => ({ ...f, category: e.target.value }))}>
                    <option value="">— Select category —</option>
                    <option>Office supplies</option><option>Shipping</option><option>Software</option>
                    <option>Advertising</option><option>Meals & entertainment</option>
                    <option>Travel</option><option>Ask My Accountant</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field-label">Notes</div>
                <div className="field-value"><input data-field="notes" placeholder="Add a note…" value={drawerForm.notes} onChange={(e) => setDrawerForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
            </div>
            <div className="border-t border-surface-dim p-3 flex items-center justify-between shrink-0">
              <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" data-close-receipt onClick={closeReceipt}>Cancel</button>
              <div className="flex items-center gap-2">
                <button className="h-8 px-3 border border-surface-dim rounded text-body-md font-semibold hover:bg-surface-container-low flex items-center gap-1" data-match-receipt onClick={handleMatchBtn}>
                  <span className="material-symbols-outlined text-[16px]">link</span>Match to transaction</button>
                <div className="flex split-btn">
                  <button className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main" data-create-expense onClick={handleCreateExpense}>
                    Create expense</button>
                  <button className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow" aria-label="More create options">
                    <span className="material-symbols-outlined text-[16px]">expand_more</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ CATEGORY PICKER ═══════════ */}
      <div id="cat-picker" className={`cat-picker${catPicker.open ? ' open' : ''}`} style={{ top: catPicker.top, left: catPicker.left }}>
        <input placeholder="Search categories…" value={catSearch} onChange={(e) => setCatSearch(e.target.value)} />
        <div className="recent">Suggested</div>
        {PICKER_SUGGESTED.map((o) => (
          <div key={o.val} className="cat-opt" data-pick={o.val} onClick={() => pickCategory(o.val)}><span className="dot" style={{ background: o.dot }}></span>{o.val}</div>
        ))}
        <div className="cat-sep"></div>
        <div className="recent">All categories</div>
        {PICKER_ALL.map((o) => (
          <div key={o.val} className="cat-opt" data-pick={o.val} onClick={() => pickCategory(o.val)}><span className="dot" style={{ background: o.dot }}></span>{o.val}</div>
        ))}
      </div>

      {/* ═══════════ ROW ⋯ MENU — fully defined ═══════════ */}
      <div id="row-menu" className={`row-menu${rowMenu.open ? ' open' : ''}`} style={{ top: rowMenu.top, left: rowMenu.left }}>
        <div className="menu-header">This receipt</div>
        <button data-action="view" onClick={(e) => handleRowMenuAction(e, 'view')}><span className="material-symbols-outlined">open_in_new</span>View receipt</button>
        <button data-action="edit" onClick={(e) => handleRowMenuAction(e, 'edit')}><span className="material-symbols-outlined">edit</span>Edit extracted fields</button>
        <button data-action="download" onClick={(e) => handleRowMenuAction(e, 'download')}><span className="material-symbols-outlined">download</span>Download original</button>
        <div className="sep"></div>
        <div className="menu-header">Create from receipt</div>
        <button data-action="create-expense" onClick={(e) => handleRowMenuAction(e, 'create-expense')}><span className="material-symbols-outlined">credit_card</span>Create expense</button>
        <button data-action="create-bill" onClick={(e) => handleRowMenuAction(e, 'create-bill')}><span className="material-symbols-outlined">description</span>Create bill</button>
        <button data-action="attach" onClick={(e) => handleRowMenuAction(e, 'attach')}><span className="material-symbols-outlined">attach_file</span>Attach to existing…</button>
        <div className="sep"></div>
        <div className="menu-header">Match</div>
        <button data-action="match" onClick={(e) => handleRowMenuAction(e, 'match')}><span className="material-symbols-outlined">link</span>Match to transaction…</button>
        <div className="sep"></div>
        <div className="menu-header">State</div>
        <button data-action="mark-reviewed" style={{ display: menuReviewed ? 'none' : undefined }} onClick={(e) => handleRowMenuAction(e, 'mark-reviewed')}><span className="material-symbols-outlined">check_circle</span>Mark as reviewed</button>
        <button data-action="unmark-reviewed" data-hide="true" style={{ display: menuReviewed ? undefined : 'none' }} onClick={(e) => handleRowMenuAction(e, 'unmark-reviewed')}><span className="material-symbols-outlined">restart_alt</span>Move back to review</button>
        <button className="danger" data-action="delete" onClick={(e) => handleRowMenuAction(e, 'delete')}><span className="material-symbols-outlined">delete</span>Delete receipt</button>
      </div>

      {/* ═══════════ MATCH MENU — real, positioned ═══════════ */}
      <div id="match-menu" className={`match-menu${matchMenu.open ? ' open' : ''}`} style={{ top: matchMenu.top, left: matchMenu.left }}>
        <div className="mm-h">Unmatched bank transactions</div>
        {MATCH_BANK.map((it) => (
          <div key={it.name} className="mm-item" data-match-kind={it.kind} data-match-name={it.name} onClick={() => handleMatchSelect(it.name)}>
            <span className={`material-symbols-outlined text-[16px] ${it.iconCls} mt-0.5`}>{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-body-sm font-medium truncate">{it.line1}</div>
              <div className="mm-date">{it.line2}</div>
            </div>
            <span className={`mm-amt ${it.amtCls}`}>{it.amt}</span>
          </div>
        ))}
        <div className="mm-h">Open bills</div>
        {MATCH_BILLS.map((it) => (
          <div key={it.name} className="mm-item" data-match-kind={it.kind} data-match-name={it.name} onClick={() => handleMatchSelect(it.name)}>
            <span className={`material-symbols-outlined text-[16px] ${it.iconCls} mt-0.5`}>{it.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-body-sm font-medium truncate">{it.line1}</div>
              <div className="mm-date">{it.line2}</div>
            </div>
            <span className={`mm-amt ${it.amtCls}`}>{it.amt}</span>
          </div>
        ))}
      </div>

      <div id="toast" className={toastMsg ? 'toast show' : 'toast'}>{toastMsg}</div>
    </div>
  );
}
