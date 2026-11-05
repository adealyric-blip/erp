'use client';
import './reports.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { AccountingScreenProps } from './types';

/* ═══════════════════════════════════════════════════════════ */
/* REPORT DATA                                                */
/* ═══════════════════════════════════════════════════════════ */

interface ReportRow {
  kind: 'section' | 'sub' | 'total' | 'final';
  cells: string[];
  label?: string;
}

interface ReportDef {
  title: string;
  range: string;
  rows: ReportRow[];
}

/* Keyed by the library card data-report ids. (The mockup's REPORTS object
   spelled the A/R aging entry "arain" while its card says data-report="araging";
   keyed here by the card id so the card's openReport action works.) */
const REPORTS: Record<string, ReportDef> = {
  pnl: {
    title: 'Profit and Loss',
    range: 'November 1 – 30, 2026',
    rows: [
      { kind: 'section', cells: ['Income', '', ''] },
      { kind: 'sub',     cells: ['Sales — Apparel', '$8,420.00', '$62,180.00'] },
      { kind: 'sub',     cells: ['Shipping income', '$1,204.00', '$8,204.00'] },
      { kind: 'sub',     cells: ['Sales — Wall Art', '$2,110.00', '$18,940.00'] },
      { kind: 'total',   label: 'Total income', cells: ['$11,734.00', '$89,324.00'] },
      { kind: 'section', cells: ['Cost of goods sold', '', ''] },
      { kind: 'sub',     cells: ['COGS — Apparel', '$3,120.00', '$18,140.00'] },
      { kind: 'sub',     cells: ['COGS — Wall Art', '$870.00', '$7,240.00'] },
      { kind: 'total',   label: 'Total COGS', cells: ['$3,990.00', '$25,380.00'] },
      { kind: 'total',   label: 'Gross profit', cells: ['$7,744.00', '$63,944.00'] },
      { kind: 'section', cells: ['Expenses', '', ''] },
      { kind: 'sub',     cells: ['Office supplies', '$142.50', '$1,418.00'] },
      { kind: 'sub',     cells: ['Software & subscriptions', '$59.99', '$719.88'] },
      { kind: 'sub',     cells: ['Shipping & delivery', '$84.20', '$1,410.00'] },
      { kind: 'sub',     cells: ['Advertising', '$1,240.00', '$9,240.00'] },
      { kind: 'sub',     cells: ['Bank fees', '$12.00', '$124.00'] },
      { kind: 'total',   label: 'Total expenses', cells: ['$1,538.69', '$12,911.88'] },
      { kind: 'final',   label: 'Net operating income', cells: ['$6,205.31', '$51,032.12'] },
    ],
  },
  bs: {
    title: 'Balance Sheet',
    range: 'As of November 30, 2026',
    rows: [
      { kind: 'section', cells: ['Assets', ''] },
      { kind: 'sub',     cells: ['Business checking', '$84,210.40'] },
      { kind: 'sub',     cells: ['Accounts receivable', '$8,420.00'] },
      { kind: 'sub',     cells: ['Stripe clearing', '$1,842.60'] },
      { kind: 'total',   label: 'Total assets', cells: ['$94,473.00'] },
      { kind: 'section', cells: ['Liabilities', ''] },
      { kind: 'sub',     cells: ['Accounts payable', '$4,080.00'] },
      { kind: 'sub',     cells: ['Sales tax payable', '$1,880.00'] },
      { kind: 'total',   label: 'Total liabilities', cells: ['$5,960.00'] },
      { kind: 'section', cells: ['Equity', ''] },
      { kind: 'sub',     cells: ["Owner's equity", '$66,010.00'] },
      { kind: 'sub',     cells: ['Retained earnings', '$22,503.00'] },
      { kind: 'total',   label: 'Total equity', cells: ['$88,513.00'] },
      { kind: 'final',   label: 'Total liabilities + equity', cells: ['$94,473.00'] },
    ],
  },
  cashflow: {
    title: 'Statement of Cash Flows',
    range: 'November 1 – 30, 2026',
    rows: [
      { kind: 'section', cells: ['Operating activities', ''] },
      { kind: 'sub',     cells: ['Net income', '$6,205.31'] },
      { kind: 'sub',     cells: ['Increase in A/R', '−$8,420.00'] },
      { kind: 'sub',     cells: ['Increase in A/P', '$4,080.00'] },
      { kind: 'total',   label: 'Net from operating', cells: ['$1,865.31'] },
      { kind: 'section', cells: ['Investing activities', ''] },
      { kind: 'sub',     cells: ['Purchase of equipment', '−$2,400.00'] },
      { kind: 'total',   label: 'Net from investing', cells: ['−$2,400.00'] },
      { kind: 'section', cells: ['Financing activities', ''] },
      { kind: 'sub',     cells: ['Owner contribution', '$5,000.00'] },
      { kind: 'total',   label: 'Net from financing', cells: ['$5,000.00'] },
      { kind: 'final',   label: 'Net change in cash', cells: ['$4,465.31'] },
    ],
  },
  araging: {
    title: 'A/R Aging Summary',
    range: 'As of November 30, 2026',
    rows: [
      { kind: 'section', cells: ['Customer', 'Current', '1–30', '31–60', '61+', 'Total'] },
      { kind: 'sub',     cells: ['Acme Corp', '$1,240.00', '—', '—', '—', '$1,240.00'] },
      { kind: 'sub',     cells: ['Maple Supply', '—', '$890.00', '—', '—', '$890.00'] },
      { kind: 'sub',     cells: ['Northwind Labs', '—', '—', '$2,100.00', '—', '$2,100.00'] },
      { kind: 'sub',     cells: ['Lakeside Design', '—', '—', '—', '$1,850.00', '$1,850.00'] },
      { kind: 'final',   label: 'Total', cells: ['$1,240.00', '$890.00', '$2,100.00', '$1,850.00', '$6,080.00'] },
    ],
  },
  salesbycustomer: {
    title: 'Sales by Customer Summary',
    range: 'November 1 – 30, 2026',
    rows: [
      { kind: 'section', cells: ['Customer', 'Revenue', '% of total'] },
      { kind: 'sub',     cells: ['Acme Corp', '$8,640.00', '34%'] },
      { kind: 'sub',     cells: ['Blue Ridge Co.', '$7,410.00', '29%'] },
      { kind: 'sub',     cells: ['Northwind Labs', '$4,240.00', '17%'] },
      { kind: 'sub',     cells: ['Orion Apparel', '$3,890.00', '15%'] },
      { kind: 'sub',     cells: ['Maple Supply', '$1,180.00', '5%'] },
      { kind: 'final',   label: 'Total', cells: ['$25,360.00', '100%'] },
    ],
  },
  expensesbyvendor: {
    title: 'Expenses by Vendor Summary',
    range: 'November 1 – 30, 2026',
    rows: [
      { kind: 'section', cells: ['Vendor', 'Expenses', 'Bills'] },
      { kind: 'sub',     cells: ['Printful', '$12,410.00', '8'] },
      { kind: 'sub',     cells: ['Gelato', '$6,240.00', '4'] },
      { kind: 'sub',     cells: ['Printify', '$4,180.00', '3'] },
      { kind: 'sub',     cells: ['Adobe', '$719.88', '12'] },
      { kind: 'sub',     cells: ['Staples', '$1,418.00', '9'] },
      { kind: 'final',   label: 'Total', cells: ['$24,967.88', '36'] },
    ],
  },
  gl: {
    title: 'General Ledger',
    range: 'November 1 – 30, 2026 · All accounts',
    rows: [
      { kind: 'section', cells: ['Date', 'Description', 'Account', 'Debit', 'Credit'] },
      { kind: 'sub',     cells: ['11/01/2026', 'Invoice 1002', 'Sales — Apparel', '—', '$1,240.00'] },
      { kind: 'sub',     cells: ['11/01/2026', 'Invoice 1002', 'A/R', '$1,240.00', '—'] },
      { kind: 'sub',     cells: ['11/03/2026', 'Staples receipt', 'Office supplies', '$142.50', '—'] },
      { kind: 'sub',     cells: ['11/03/2026', 'Staples receipt', 'Business checking', '—', '$142.50'] },
      { kind: 'sub',     cells: ['11/10/2026', 'Stripe payout', 'Business checking', '$1,842.60', '—'] },
      { kind: 'sub',     cells: ['11/10/2026', 'Stripe payout', 'Stripe clearing', '—', '$1,842.60'] },
      { kind: 'final',   label: 'Total for period', cells: ['', '', '$3,225.10', '$3,225.10'] },
    ],
  },
  tb: {
    title: 'Trial Balance',
    range: 'As of November 30, 2026',
    rows: [
      { kind: 'section', cells: ['Account', 'Debit', 'Credit'] },
      { kind: 'sub',     cells: ['1000 · Business checking', '$84,210.40', '—'] },
      { kind: 'sub',     cells: ['1100 · Accounts receivable', '$8,420.00', '—'] },
      { kind: 'sub',     cells: ['2000 · Accounts payable', '—', '$4,080.00'] },
      { kind: 'sub',     cells: ['2200 · Sales tax payable', '—', '$1,880.00'] },
      { kind: 'sub',     cells: ["3000 · Owner's equity", '—', '$66,010.00'] },
      { kind: 'sub',     cells: ['4000 · Sales — Apparel', '—', '$42,180.00'] },
      { kind: 'sub',     cells: ['5000 · COGS — Apparel', '$8,140.00', '—'] },
      { kind: 'final',   label: 'Total', cells: ['$100,770.40', '$114,150.00'] },
    ],
  },
  salestax: {
    title: 'Sales Tax Liability',
    range: 'November 1 – 30, 2026',
    rows: [
      { kind: 'section', cells: ['Jurisdiction', 'Collected', 'Paid', 'Owed'] },
      { kind: 'sub',     cells: ['Tennessee', '$1,410.00', '$920.00', '$490.00'] },
      { kind: 'sub',     cells: ['California', '$840.00', '$0.00', '$840.00'] },
      { kind: 'sub',     cells: ['New York', '$550.00', '$0.00', '$550.00'] },
      { kind: 'final',   label: 'Total', cells: ['$2,800.00', '$920.00', '$1,880.00'] },
    ],
  },
};

/* ── Library cards (data-report / data-category / data-title) ── */

interface ReportCardDef {
  id: string;
  category: string;
  dataTitle: string;
  title: string;
  sub: string;
  icon: string;
  iconBg: string;
  desc: string;
}

const REPORT_CARDS: ReportCardDef[] = [
  { id: 'pnl', category: 'financial', dataTitle: 'Profit and Loss', title: 'Profit and Loss', sub: 'Income and expenses', icon: 'trending_up', iconBg: 'bg-qb-blue', desc: 'Revenue minus costs, broken down by account.' },
  { id: 'bs', category: 'financial', dataTitle: 'Balance Sheet', title: 'Balance Sheet', sub: 'Assets = Liabilities + Equity', icon: 'balance', iconBg: 'bg-qb-teal', desc: 'Snapshot of what you own, owe, and are worth.' },
  { id: 'cashflow', category: 'financial', dataTitle: 'Statement of Cash Flows', title: 'Statement of Cash Flows', sub: 'Operating / investing / financing', icon: 'waterfall_chart', iconBg: 'bg-qb-green', desc: 'Where cash came from and where it went.' },
  { id: 'araging', category: 'sales', dataTitle: 'A/R Aging Summary', title: 'A/R Aging Summary', sub: 'Who owes you, and how long', icon: 'hourglass_top', iconBg: 'bg-qb-maroon', desc: 'Outstanding invoices by aging bucket.' },
  { id: 'salesbycustomer', category: 'sales', dataTitle: 'Sales by Customer Summary', title: 'Sales by Customer', sub: 'Ranked by revenue', icon: 'groups', iconBg: 'bg-qb-navy', desc: 'Revenue per customer for the period.' },
  { id: 'expensesbyvendor', category: 'expenses', dataTitle: 'Expenses by Vendor Summary', title: 'Expenses by Vendor', sub: 'Where money went', icon: 'receipt_long', iconBg: 'bg-qb-maroon', desc: 'Spend per vendor for the period.' },
  { id: 'gl', category: 'accounting', dataTitle: 'General Ledger', title: 'General Ledger', sub: 'Every posted transaction', icon: 'menu_book', iconBg: 'bg-qb-blue', desc: 'All account activity for the period.' },
  { id: 'tb', category: 'accounting', dataTitle: 'Trial Balance', title: 'Trial Balance', sub: 'Debits = Credits', icon: 'rule', iconBg: 'bg-qb-teal', desc: 'Account balances at a point in time.' },
  { id: 'salestax', category: 'tax', dataTitle: 'Sales Tax Liability', title: 'Sales Tax Liability', sub: 'What you owe the state', icon: 'gavel', iconBg: 'bg-qb-green', desc: 'Sales tax collected minus paid.' },
];

/* ── Customize drawer: column list (drag to reorder, toggle to show/hide) ── */

interface ColItem {
  col: string;
  label: string;
  checked: boolean;
}

const INITIAL_COLS: ColItem[] = [
  { col: 'account', label: 'Account', checked: true },
  { col: 'period', label: 'Nov 2026', checked: true },
  { col: 'ytd', label: 'Jan – Nov 2026 (YTD)', checked: true },
  { col: 'pct', label: '% of income', checked: false },
  { col: 'budget', label: 'Budget', checked: false },
  { col: 'variance', label: 'Variance', checked: false },
];

type CustTab = 'data' | 'visual' | 'saved';

export default function Reports({}: AccountingScreenProps) {
  /* Toast (mockup-local, 1800ms) */
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  /* Library: filter + open */
  const [view, setView] = useState<'library' | 'viewer'>('library');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [rptTab, setRptTab] = useState('all');

  /* Viewer: title / range text (two DOM spots, synced like the script) */
  const [viewerSub, setViewerSub] = useState('Nov 1 – Nov 30, 2026');
  const [reportRange, setReportRange] = useState('November 1 – 30, 2026');

  /* Date range */
  const [rangeFrom, setRangeFrom] = useState('2026-11-01');
  const [rangeTo, setRangeTo] = useState('2026-11-30');
  const [rangePreset, setRangePreset] = useState('Custom');

  /* Customize drawer state */
  const [custOpen, setCustOpen] = useState(false);
  const [custTab, setCustTab] = useState<CustTab>('data');
  const [cols, setCols] = useState<ColItem[]>(INITIAL_COLS);
  const [rowsSel, setRowsSel] = useState('All accounts');
  const [filterExcludeZero, setFilterExcludeZero] = useState(false);
  const [filterComparePrior, setFilterComparePrior] = useState(false);
  const [filterShowPct, setFilterShowPct] = useState(false);
  const [numFormat, setNumFormat] = useState('dollars');
  const [negFormat, setNegFormat] = useState('red');
  const [decimals, setDecimals] = useState('2');
  const [divideThousands, setDivideThousands] = useState(false);
  const [highlightNeg, setHighlightNeg] = useState(true);
  const [highlightCompare, setHighlightCompare] = useState(false);
  const [saveName, setSaveName] = useState('');

  /* Column drag reorder */
  const dragSrc = useRef<string | null>(null);
  const [draggingCol, setDraggingCol] = useState<string | null>(null);

  const currentReport = currentReportId ? REPORTS[currentReportId] : null;
  const activeTitle = currentReport ? currentReport.title : 'Profit and Loss';
  const breadcrumb = view === 'viewer' && currentReport ? currentReport.title : 'Reports';

  /* VIEWER: open a report */
  const openReport = (id: string) => {
    const r = REPORTS[id];
    if (!r) return;
    setCurrentReportId(id);
    setView('viewer');
    setViewerSub(r.range);
    setReportRange(r.range);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* Negative-value formatting (red / paren), minus sign is U+2212 like the mockup */
  const formatNeg = (v: string) => {
    if (!v || v === '—' || v === '') return v;
    if (negFormat === 'red' && v.startsWith('−')) return <span className="num-neg">{v}</span>;
    if (negFormat === 'paren' && v.startsWith('−')) return <span className="num-neg">{`(${v.slice(1)})`}</span>;
    return v;
  };

  /* Date range preset */
  const handlePresetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    setRangePreset(preset);
    let nextFrom = rangeFrom;
    let nextTo = rangeTo;
    if (preset === 'This month') { nextFrom = '2026-11-01'; nextTo = '2026-11-30'; }
    if (preset === 'Last month') { nextFrom = '2026-10-01'; nextTo = '2026-10-31'; }
    if (preset === 'This quarter') { nextFrom = '2026-10-01'; nextTo = '2026-12-31'; }
    if (preset === 'This year') { nextFrom = '2026-01-01'; nextTo = '2026-12-31'; }
    if (preset === 'Last year') { nextFrom = '2025-01-01'; nextTo = '2025-12-31'; }
    setRangeFrom(nextFrom);
    setRangeTo(nextTo);
    const rangeText = `${nextFrom} – ${nextTo}`;
    setViewerSub(rangeText);
    setReportRange(rangeText);
  };

  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setRangeFrom(v);
    const rangeText = `${v} – ${rangeTo}`;
    setViewerSub(rangeText);
    setReportRange(rangeText);
  };

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setRangeTo(v);
    const rangeText = `${rangeFrom} – ${v}`;
    setViewerSub(rangeText);
    setReportRange(rangeText);
  };

  /* Column drag reorder */
  const handleColDragStart = (col: string) => {
    dragSrc.current = col;
    setDraggingCol(col);
  };
  const handleColDragEnd = () => {
    setDraggingCol(null);
    dragSrc.current = null;
  };
  const handleColDragOver = (e: DragEvent<HTMLDivElement>, item: ColItem) => {
    e.preventDefault();
    if (!dragSrc.current || dragSrc.current === item.col) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const after = (e.clientY - rect.top) > rect.height / 2;
    setCols(prev => {
      const moved = prev.find(c => c.col === dragSrc.current);
      if (!moved) return prev;
      const rest = prev.filter(c => c !== moved);
      let insertAt = rest.indexOf(item);
      if (insertAt === -1) return prev;
      if (after) insertAt += 1;
      rest.splice(insertAt, 0, moved);
      return rest;
    });
  };
  const toggleCol = (col: string) => {
    setCols(prev => prev.map(c => (c.col === col ? { ...c, checked: !c.checked } : c)));
  };

  /* Save view */
  const handleSaveView = () => {
    const name = saveName.trim();
    if (!name) { toast('Name required'); return; }
    toast(`Saved view "${name}"`);
  };

  /* Apply customization (report body re-renders from state automatically) */
  const handleApplyCust = () => {
    setCustOpen(false);
    toast('Customization applied');
  };

  /* Library filtering (search matches the card's semibold title, tab matches category) */
  const q = reportSearch.toLowerCase();
  const isCardVisible = (card: ReportCardDef) => {
    const matchQ = !q || card.title.toLowerCase().includes(q);
    const matchTab = rptTab === 'all' || card.category === rptTab;
    return matchQ && matchTab;
  };

  return (
    <div className="reports-page bg-background font-sans text-body-md text-on-surface antialiased">

      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Accounting</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold" data-breadcrumb>{breadcrumb}</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VIEW 1 — REPORT LIBRARY                                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <main id="library-view" className={view === 'library' ? 'px-6 pb-12' : 'px-6 pb-12 hidden-imp'}>

        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Reports</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Standard reports, custom reports, saved views.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              data-new-report
              onClick={() => toast('Custom report builder — coming in diligence pass')}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>Custom report</button>
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              data-saved-views
              onClick={() => toast('Saved views drawer')}
            >
              <span className="material-symbols-outlined text-[16px]">bookmark</span>Saved views</button>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex items-center max-w-lg mb-5">
          <span className="material-symbols-outlined absolute left-3 text-[16px] text-outline">search</span>
          <input
            className="w-full h-9 pl-9 pr-3 bg-white border border-surface-dim rounded-lg text-body-sm focus:outline-none focus:border-primary"
            placeholder="Search reports…"
            data-report-search
            value={reportSearch}
            onChange={e => setReportSearch(e.target.value)}
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-surface-dim overflow-x-auto">
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'all' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="all" onClick={() => setRptTab('all')}>All</button>
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'financial' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="financial" onClick={() => setRptTab('financial')}>Financial statements</button>
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'sales' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="sales" onClick={() => setRptTab('sales')}>Sales & customers</button>
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'expenses' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="expenses" onClick={() => setRptTab('expenses')}>Expenses & vendors</button>
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'accounting' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="accounting" onClick={() => setRptTab('accounting')}>Accounting</button>
          <button className={`px-3 py-2 text-label-md tab-underline ${rptTab === 'tax' ? 'active' : 'text-on-surface-variant'}`} data-rpt-tab="tax" onClick={() => setRptTab('tax')}>Tax</button>
        </div>

        {/* Report grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-report-grid>

          {REPORT_CARDS.map(card => (
            <div
              key={card.id}
              className="report-card"
              data-report={card.id}
              data-category={card.category}
              data-title={card.dataTitle}
              style={{ display: isCardVisible(card) ? undefined : 'none' }}
              onClick={() => openReport(card.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`icon-wrap ${card.iconBg}`}><span className="material-symbols-outlined text-[20px]">{card.icon}</span></div>
                <div>
                  <div className="text-body-md font-semibold">{card.title}</div>
                  <div className="text-[11px] text-on-surface-variant">{card.sub}</div>
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant">{card.desc}</p>
            </div>
          ))}

        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* VIEW 2 — REPORT VIEWER                                     */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <main id="viewer-view" className={view === 'viewer' ? 'pb-12' : 'pb-12 hidden-imp'}>

        {/* Viewer header */}
        <div className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap border-b border-surface-dim bg-white">
          <div className="flex items-center gap-3">
            <button
              className="h-8 w-8 rounded hover:bg-surface-container-low flex items-center justify-center"
              data-back
              aria-label="Back"
              onClick={() => setView('library')}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span></button>
            <div>
              <div className="text-headline-sm" data-viewer-title>{activeTitle}</div>
              <div className="text-[11px] text-on-surface-variant" data-viewer-sub>{viewerSub}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="date-range">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">calendar_today</span>
              <input type="date" value={rangeFrom} data-range-from onChange={handleFromChange} />
              <span className="text-on-surface-variant text-[11px]">to</span>
              <input type="date" value={rangeTo} data-range-to onChange={handleToChange} />
              <select
                className="h-[30px] px-2 border border-surface-dim rounded text-[12px] bg-white"
                data-range-preset
                value={rangePreset}
                onChange={handlePresetChange}
              >
                <option>Custom</option>
                <option>This month</option>
                <option>Last month</option>
                <option>This quarter</option>
                <option>This year</option>
                <option>Last year</option>
              </select>
            </div>
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              data-customize
              onClick={() => setCustOpen(true)}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>Customize</button>
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              data-export
              onClick={() => toast('Export as PDF / XLSX — chooser opens')}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export ▾</button>
            <button
              className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container flex items-center gap-1"
              data-print
              onClick={() => toast('Sending to print…')}
            >
              <span className="material-symbols-outlined text-[16px]">print</span>Print</button>
          </div>
        </div>

        {/* Report body */}
        <div className="px-6 py-6">
          <div className="bg-white rounded-lg border border-surface-dim overflow-hidden max-w-5xl mx-auto">
            <div className="p-6 border-b border-surface-dim text-center">
              <div className="text-headline-md" data-report-company>ManageKube LLC</div>
              <div className="text-headline-sm mt-1" data-report-title>{activeTitle}</div>
              <div className="text-body-sm text-on-surface-variant mt-1" data-report-range>{reportRange}</div>
              <div className="text-body-sm text-on-surface-variant">Accrual basis</div>
            </div>

            <table className="w-full rpt-table" data-report-body>
              <tbody>
                {currentReport && currentReport.rows.map((row, ri) => {
                  if (row.kind === 'section') {
                    return (
                      <tr className="section" key={ri}>
                        {row.cells.map((c, ci) => <th key={ci}>{c}</th>)}
                      </tr>
                    );
                  }
                  if (row.kind === 'sub') {
                    return (
                      <tr className="sub" key={ri}>
                        {row.cells.map((c, ci) => <td key={ci} className={ci === 0 ? '' : 'right'}>{formatNeg(c)}</td>)}
                      </tr>
                    );
                  }
                  return (
                    <tr className="total" key={ri} style={row.kind === 'final' ? { background: '#f4f3f7' } : undefined}>
                      <td>{row.label || ''}</td>
                      {row.cells.map((c, ci) => <td key={ci} className="right">{formatNeg(c)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="p-4 border-t border-surface-dim bg-surface-container-low flex items-center justify-between text-[11px] text-on-surface-variant">
              <span data-report-updated>Last updated 2 minutes ago</span>
              <span>Categorized 94% · 6 accounts pending review</span>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CUSTOMIZE DRAWER (§A report-customizer — Data / Visual)    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className={custOpen ? 'drawer-scrim open' : 'drawer-scrim'} id="cust-scrim" onClick={() => setCustOpen(false)} />
      <div className={custOpen ? 'drawer open' : 'drawer'} id="cust-drawer">
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <div>
              <div className="text-headline-sm">Customize report</div>
              <div className="text-[11px] text-on-surface-variant">Data · Visual · Save as view</div>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
            data-close-cust
            aria-label="Close"
            onClick={() => setCustOpen(false)}
          >
            <span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        {/* Customize tabs */}
        <div className="cust-tab">
          <button className={custTab === 'data' ? 'active' : undefined} data-cust-tab="data" onClick={() => setCustTab('data')}>Data</button>
          <button className={custTab === 'visual' ? 'active' : undefined} data-cust-tab="visual" onClick={() => setCustTab('visual')}>Visual</button>
          <button className={custTab === 'saved' ? 'active' : undefined} data-cust-tab="saved" onClick={() => setCustTab('saved')}>Saved views</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* DATA tab */}
          <div className={custTab === 'data' ? undefined : 'hidden-imp'} data-cust-panel="data">
            <div className="px-4 py-3 border-b border-surface-dim">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Rows</div>
              <select className="w-full h-8 px-2 border border-surface-dim rounded text-[12px]" value={rowsSel} onChange={e => setRowsSel(e.target.value)}>
                <option>All accounts</option>
                <option>Income accounts only</option>
                <option>Expense accounts only</option>
                <option>Non-zero only</option>
              </select>
            </div>
            <div className="px-4 py-3 border-b border-surface-dim">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Columns</div>
              <p className="text-[11px] text-on-surface-variant mb-2">Drag to reorder. Toggle to show/hide.</p>
              {cols.map(item => (
                <div
                  key={item.col}
                  className={draggingCol === item.col ? 'col-item dragging' : 'col-item'}
                  draggable
                  data-col={item.col}
                  onDragStart={() => handleColDragStart(item.col)}
                  onDragEnd={handleColDragEnd}
                  onDragOver={e => handleColDragOver(e, item)}
                >
                  <span className="material-symbols-outlined drag">drag_indicator</span>
                  <input type="checkbox" className="row-check" checked={item.checked} onChange={() => toggleCol(item.col)} />
                  <span className="text-body-sm flex-1">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Filters</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" checked={filterExcludeZero} onChange={() => setFilterExcludeZero(v => !v)} /> Exclude zero rows</label>
                <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" checked={filterComparePrior} onChange={() => setFilterComparePrior(v => !v)} /> Compare to prior period</label>
                <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" checked={filterShowPct} onChange={() => setFilterShowPct(v => !v)} /> Show percentages</label>
              </div>
            </div>
          </div>

          {/* VISUAL tab */}
          <div className={custTab === 'visual' ? 'hidden-imp' : undefined} data-cust-panel="visual">
            <div className="px-4 py-4 border-b border-surface-dim">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Number format</div>
              <div className="seg" data-num-format>
                <button className={numFormat === 'dollars' ? 'active' : undefined} data-num="dollars" onClick={() => setNumFormat('dollars')}>1,234.56</button>
                <button className={numFormat === 'thousands' ? 'active' : undefined} data-num="thousands" onClick={() => setNumFormat('thousands')}>1.2K</button>
                <button className={numFormat === 'no-cents' ? 'active' : undefined} data-num="no-cents" onClick={() => setNumFormat('no-cents')}>1,235</button>
                <button className={numFormat === 'percent' ? 'active' : undefined} data-num="percent" onClick={() => setNumFormat('percent')}>12.3%</button>
              </div>
            </div>
            <div className="px-4 py-4 border-b border-surface-dim">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Negatives</div>
              <div className="seg" data-neg-format>
                <button className={negFormat === 'red' ? 'active' : undefined} data-neg="red" onClick={() => setNegFormat('red')}>Red</button>
                <button className={negFormat === 'paren' ? 'active' : undefined} data-neg="paren" onClick={() => setNegFormat('paren')}>(1,234)</button>
                <button className={negFormat === 'minus' ? 'active' : undefined} data-neg="minus" onClick={() => setNegFormat('minus')}>−1,234</button>
              </div>
            </div>
            <div className="px-4 py-4 border-b border-surface-dim">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Decimals</div>
              <div className="seg" data-decimals>
                <button className={decimals === '0' ? 'active' : undefined} data-dec="0" onClick={() => setDecimals('0')}>0</button>
                <button className={decimals === '2' ? 'active' : undefined} data-dec="2" onClick={() => setDecimals('2')}>2</button>
              </div>
            </div>
            <div className="px-4 py-4 border-b border-surface-dim">
              <label className="flex items-center gap-2 text-body-sm">
                <input type="checkbox" className="row-check" checked={divideThousands} onChange={() => setDivideThousands(v => !v)} />
                Divide by 1,000 (show in thousands)
              </label>
            </div>
            <div className="px-4 py-4">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Highlight</div>
              <label className="flex items-center gap-2 text-body-sm mb-2"><input type="checkbox" className="row-check" checked={highlightNeg} onChange={() => setHighlightNeg(v => !v)} /> Highlight negative values</label>
              <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" checked={highlightCompare} onChange={() => setHighlightCompare(v => !v)} /> Compare-to-column highlight</label>
            </div>
          </div>

          {/* SAVED tab */}
          <div className={custTab === 'saved' ? 'hidden-imp' : undefined} data-cust-panel="saved">
            <div className="px-4 py-4">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Save current configuration as</div>
              <input
                className="w-full h-8 px-2 border border-surface-dim rounded text-[12px] mb-2"
                placeholder="e.g. P&L — monthly mgmt"
                data-save-name
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
              />
              <button className="w-full h-8 bg-primary text-white rounded text-[12px] font-semibold hover:bg-primary-container mb-4" data-save-view onClick={handleSaveView}>
                <span className="material-symbols-outlined text-[14px] align-middle mr-1">bookmark_add</span>Save as view</button>

              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Existing views</div>
              <div className="text-[11px] text-on-surface-variant text-center py-4">No saved views yet.</div>
            </div>
          </div>
        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" data-close-cust onClick={() => setCustOpen(false)}>Cancel</button>
          <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container" data-apply-cust onClick={handleApplyCust}>Apply</button>
        </div>
      </div>

      <div className={toastMsg ? 'toast show' : 'toast'} id="toast">{toastMsg}</div>
    </div>
  );
}
