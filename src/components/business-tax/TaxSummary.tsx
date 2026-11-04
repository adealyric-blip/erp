'use client';
import './business-tax.css';
import { useState, useMemo, useRef, useEffect } from 'react';
import { BusinessTaxScreenProps, TAX_NAV } from './types';

/* ─────────────────────────────────────────────────────────────
   Data model
   ───────────────────────────────────────────────────────────── */

type RowKind = 'mapped' | 'unmapped' | 'excluded';
type RowCategory = 'income' | 'deductions' | 'assets';
type TabKey = 'all' | 'income' | 'deductions' | 'assets' | 'unmapped';
type MappedFilter = '' | 'mapped' | 'unmapped';
type MenuPos = { top: number; left: number };

interface TaxRow {
  id: string;
  section: string;
  name: string;
  formLine: string;
  amount: string;
  ytd: string;
  category: RowCategory;
  kind: RowKind;
  mapping: string;
  flagged: boolean;
}

interface SectionDef {
  id: string;
  label: string;
  totalLabel: string;
  category: RowCategory;
  totalAmount: string;
  totalYtd: string;
}

const TOTAL_ACCOUNTS = 34;

const SECTIONS: SectionDef[] = [
  { id: 'income', label: 'Income', totalLabel: 'Total income', category: 'income', totalAmount: '$11,734.00', totalYtd: '$89,324.00' },
  { id: 'cogs', label: 'Cost of goods sold', totalLabel: 'Total COGS', category: 'deductions', totalAmount: '$3,990.00', totalYtd: '$25,380.00' },
  { id: 'operating', label: 'Operating expenses', totalLabel: 'Total operating expenses', category: 'deductions', totalAmount: '$1,538.69', totalYtd: '$12,911.88' },
  { id: 'assets', label: 'Business assets', totalLabel: 'Total business assets', category: 'assets', totalAmount: '$7,200.00', totalYtd: '$7,200.00' },
];

const INITIAL_ROWS: TaxRow[] = [
  // Income
  { id: 'inc-sales-apparel', section: 'income', name: 'Sales — Apparel', formLine: 'Form 1120, Line 1a · Gross receipts', amount: '$8,420.00', ytd: '$62,180.00', category: 'income', kind: 'mapped', mapping: 'Gross receipts', flagged: false },
  { id: 'inc-shipping', section: 'income', name: 'Shipping income', formLine: 'Form 1120, Line 1a · Gross receipts', amount: '$1,204.00', ytd: '$8,204.00', category: 'income', kind: 'mapped', mapping: 'Gross receipts', flagged: false },
  { id: 'inc-sales-wallart', section: 'income', name: 'Sales — Wall Art', formLine: 'Form 1120, Line 1a · Gross receipts', amount: '$2,110.00', ytd: '$18,940.00', category: 'income', kind: 'mapped', mapping: 'Gross receipts', flagged: false },
  { id: 'inc-freight', section: 'income', name: 'Freight income', formLine: 'Needs tax line mapping', amount: '$—', ytd: '$0.00', category: 'income', kind: 'unmapped', mapping: 'Unmapped', flagged: false },
  // COGS
  { id: 'cogs-apparel', section: 'cogs', name: 'COGS — Apparel', formLine: 'Form 1120, Line 2 · Cost of goods sold', amount: '$3,120.00', ytd: '$18,140.00', category: 'deductions', kind: 'mapped', mapping: 'COGS', flagged: false },
  { id: 'cogs-wallart', section: 'cogs', name: 'COGS — Wall Art', formLine: 'Form 1120, Line 2 · Cost of goods sold', amount: '$870.00', ytd: '$7,240.00', category: 'deductions', kind: 'mapped', mapping: 'COGS', flagged: false },
  // Operating expenses
  { id: 'op-office-supplies', section: 'operating', name: 'Office supplies', formLine: 'Form 1120, Line 18 · Office expense', amount: '$142.50', ytd: '$1,418.00', category: 'deductions', kind: 'mapped', mapping: 'Office', flagged: false },
  { id: 'op-software', section: 'operating', name: 'Software & subscriptions', formLine: 'Form 1120, Line 18 · Office expense', amount: '$59.99', ytd: '$719.88', category: 'deductions', kind: 'mapped', mapping: 'Software', flagged: false },
  { id: 'op-shipping', section: 'operating', name: 'Shipping & delivery', formLine: 'Form 1120, Line 18 · Office expense', amount: '$84.20', ytd: '$1,410.00', category: 'deductions', kind: 'mapped', mapping: 'Shipping', flagged: false },
  { id: 'op-advertising', section: 'operating', name: 'Advertising', formLine: 'Form 1120, Line 18 · Advertising', amount: '$1,240.00', ytd: '$9,240.00', category: 'deductions', kind: 'mapped', mapping: 'Advertising', flagged: false },
  { id: 'op-bank-fees', section: 'operating', name: 'Bank fees', formLine: 'Form 1120, Line 18 · Office expense', amount: '$12.00', ytd: '$124.00', category: 'deductions', kind: 'mapped', mapping: 'Office', flagged: false },
  { id: 'op-marketing-contractors', section: 'operating', name: 'Marketing — Contractors', formLine: 'Needs tax line mapping', amount: '$—', ytd: '$0.00', category: 'deductions', kind: 'unmapped', mapping: 'Unmapped', flagged: false },
  { id: 'op-warehouse-utilities', section: 'operating', name: 'Warehouse utilities', formLine: 'Needs tax line mapping', amount: '$—', ytd: '$0.00', category: 'deductions', kind: 'unmapped', mapping: 'Unmapped', flagged: false },
  // Assets
  { id: 'asset-equipment', section: 'assets', name: 'Equipment — Konva workstation', formLine: 'Form 4562 · §179 deduction', amount: '$2,400.00', ytd: '$2,400.00', category: 'assets', kind: 'mapped', mapping: '§179 asset', flagged: false },
  { id: 'asset-vehicle', section: 'assets', name: 'Vehicle — delivery van', formLine: 'Form 4562 · MACRS 5yr', amount: '$4,800.00', ytd: '$4,800.00', category: 'assets', kind: 'mapped', mapping: 'MACRS 5yr', flagged: false },
];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'income', label: 'Income by category' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'assets', label: 'Business assets' },
  { key: 'unmapped', label: 'Unmapped only' },
];

const TAX_LINE_GROUPS: { group: string; options: string[] }[] = [
  { group: 'Income', options: ['Gross receipts', 'Returns and allowances', 'Other income'] },
  { group: 'Deductions', options: ['Cost of goods sold', 'Compensation of officers', 'Contract labor', 'Advertising', 'Office expense', 'Utilities', 'Rent or lease', 'Shipping & delivery', 'Software', 'Other deductions'] },
  { group: 'Assets', options: ['§179 asset', 'MACRS 5yr', 'MACRS 7yr', 'Bonus depreciation'] },
];

/* ─────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────── */

export default function TaxSummary({ onNavigate, onToast, onCreate, onOpenCreateFlyout }: BusinessTaxScreenProps) {
  const [rows, setRows] = useState<TaxRow[]>(INITIAL_ROWS);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [filterText, setFilterText] = useState('');
  const [filterMapped, setFilterMapped] = useState<MappedFilter>('');
  const [year, setYear] = useState('2026');

  /* Export menu */
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuPos, setExportMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
  const exportSplitRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  /* Mapping drawer */
  const [mapOpen, setMapOpen] = useState(false);
  const [currentRowId, setCurrentRowId] = useState<string | null>(null);
  const [mapLine, setMapLine] = useState('');

  /* Row ⋯ menu */
  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuRowId, setRowMenuRowId] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState<MenuPos>({ top: 0, left: 0 });
  const rowMenuRef = useRef<HTMLDivElement>(null);

  const currentRow = useMemo(() => rows.find(r => r.id === currentRowId) ?? null, [rows, currentRowId]);
  const currentMenuRow = useMemo(() => rows.find(r => r.id === rowMenuRowId) ?? null, [rows, rowMenuRowId]);

  const unmappedCount = useMemo(() => rows.filter(r => r.kind === 'unmapped').length, [rows]);
  const mappedCount = TOTAL_ACCOUNTS - unmappedCount;

  /* Filtering */
  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return rows.filter(r => {
      if (r.kind === 'excluded') return false;
      if (activeTab === 'unmapped' && r.kind !== 'unmapped') return false;
      if (activeTab === 'income' && r.category !== 'income') return false;
      if (activeTab === 'deductions' && r.category !== 'deductions') return false;
      if (activeTab === 'assets' && r.category !== 'assets') return false;
      if (filterMapped === 'mapped' && r.kind !== 'mapped') return false;
      if (filterMapped === 'unmapped' && r.kind !== 'unmapped') return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, activeTab, filterMapped, filterText]);

  const visibleBySection = useMemo(() => {
    const map = new Map<string, TaxRow[]>();
    for (const r of filteredRows) {
      if (!map.has(r.section)) map.set(r.section, []);
      map.get(r.section)!.push(r);
    }
    return map;
  }, [filteredRows]);

  const shownCount = filteredRows.length;
  // Count like the original: every visible non-section row (data + section totals + final row)
  const visibleSections = SECTIONS.filter(s => (visibleBySection.get(s.id) ?? []).length > 0).length;
  const shownTotal = shownCount + visibleSections + 1; // +1 for the final Taxable profit row
  const totalCount = rows.length + SECTIONS.length + 1; // 15 data + 4 totals + 1 final = 20

  /* Outside-click to close menus */
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      const targetEl = target as HTMLElement;

      if (exportMenuOpen) {
        const inMenu = exportMenuRef.current?.contains(target);
        const inSplit = exportSplitRef.current?.contains(target);
        if (!inMenu && !inSplit) setExportMenuOpen(false);
      }

      if (rowMenuOpen) {
        const inMenu = rowMenuRef.current?.contains(target);
        const inRowBtn = targetEl.closest('[data-row-menu-btn]') !== null;
        if (!inMenu && !inRowBtn) setRowMenuOpen(false);
      }
    }
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [exportMenuOpen, rowMenuOpen]);

  /* Handlers */

  function handleExportSplitClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const menuWidth = 240;
    setExportMenuPos({
      top: r.bottom + 4,
      left: Math.min(r.right - menuWidth, window.innerWidth - 260),
    });
    setExportMenuOpen(o => !o);
  }

  function handleExportItem(fmt: string) {
    setExportMenuOpen(false);
    onToast(`Exporting as ${fmt.toUpperCase()}…`);
  }

  function openMapDrawer(row: TaxRow) {
    setCurrentRowId(row.id);
    setMapLine('');
    setMapOpen(true);
  }

  function closeMapDrawer() {
    setMapOpen(false);
    setCurrentRowId(null);
    setMapLine('');
  }

  function saveMapping(andNext: boolean) {
    if (!mapLine) {
      onToast('Select a tax line');
      return;
    }
    if (!currentRow) return;
    const savedName = currentRow.name;
    const savedRowId = currentRow.id;
    setRows(prev => prev.map(r => r.id === savedRowId ? { ...r, kind: 'mapped', mapping: mapLine } : r));
    onToast(`${savedName} mapped to "${mapLine}"`);

    if (andNext) {
      const next = rows.find(r => r.kind === 'unmapped' && r.id !== savedRowId);
      if (next) {
        setCurrentRowId(next.id);
        setMapLine('');
        return;
      }
    }
    setMapOpen(false);
    setCurrentRowId(null);
    setMapLine('');
  }

  function openRowMenu(row: TaxRow, btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    const menuWidth = 240;
    setRowMenuPos({
      top: r.bottom + 4,
      left: Math.min(r.right - menuWidth, window.innerWidth - 260),
    });
    setRowMenuRowId(row.id);
    setRowMenuOpen(true);
  }

  function handleRowMenuBtnClick(row: TaxRow, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    openRowMenu(row, e.currentTarget);
  }

  function handleRowMenuAction(action: string) {
    setRowMenuOpen(false);
    if (!currentMenuRow) return;
    const row = currentMenuRow;
    switch (action) {
      case 'remap':
        openMapDrawer(row);
        break;
      case 'view-register':
        onToast(`Register → ${row.name}`);
        break;
      case 'run-report':
        onToast(`Run report for ${row.name}`);
        break;
      case 'view-transactions':
        onToast(`Viewing transactions for ${row.name}`);
        break;
      case 'export-line':
        onToast(`Exporting line: ${row.name}`);
        break;
      case 'flag-review': {
        const name = row.name;
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, flagged: true } : r));
        onToast(`${name} flagged for accountant review`);
        break;
      }
      case 'exclude': {
        const name = row.name;
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, kind: 'excluded' } : r));
        onToast(`${name} excluded from tax summary`);
        break;
      }
    }
  }

  function handleRowClick(row: TaxRow, e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('button, select, a')) return;
    openMapDrawer(row);
  }

  function accountTypeLabel(row: TaxRow | null): string {
    if (!row) return '—';
    if (row.category === 'income') return 'Income account';
    if (row.category === 'assets') return 'Asset account';
    return 'Expense account';
  }

  /* ─────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────── */

  return (
    <>
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Business Tax</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Tax summary</span>
        </div>
      </div>

      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div>
            <h1 className="text-headline-lg">Tax summary</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Tax year 2026 · ManageKube LLC · Accrual basis</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-label-sm text-on-surface-variant">Tax year</span>
              <select
                className="h-8 px-2 border border-surface-dim rounded text-body-sm bg-white"
                value={year}
                onChange={e => { setYear(e.target.value); onToast(`Tax year changed to ${e.target.value}`); }}
              >
                <option>2026</option>
                <option>2025</option>
                <option>2024</option>
              </select>
            </div>
            <div className="flex split-btn">
              <button
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
                onClick={() => onToast('Tax summary exported as PDF')}
              >
                <span className="material-symbols-outlined text-[16px]">download</span>Export
              </button>
              <button
                ref={exportSplitRef}
                className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
                onClick={handleExportSplitClick}
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              onClick={() => onToast('Sending tax summary to print…')}
            >
              <span className="material-symbols-outlined text-[16px]">print</span>Print
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="kpi-card">
            <div className="kpi-label">Gross income</div>
            <div className="kpi-val">$89,324.00</div>
            <div className="text-[11px] text-on-surface-variant mt-1">36 invoices · accrual</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Deductions</div>
            <div className="kpi-val">$38,291.88</div>
            <div className="text-[11px] text-on-surface-variant mt-1">COGS + operating</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Taxable profit</div>
            <div className="kpi-val text-qb-blue">$51,032.12</div>
            <div className="text-[11px] text-on-surface-variant mt-1">Before estimated tax</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Mapping health</div>
            <div className="kpi-val"><span>{mappedCount}</span> / {TOTAL_ACCOUNTS}</div>
            {unmappedCount === 0 ? (
              <div className="text-[11px] text-secondary mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>All accounts mapped
              </div>
            ) : (
              <div className="text-[11px] text-error mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                {unmappedCount} account{unmappedCount !== 1 ? 's' : ''} unmapped
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-3 border-b border-surface-dim overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`px-3 py-2 text-label-md tab-underline ${activeTab === t.key ? 'active' : 'text-on-surface-variant'}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
            <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
            <input
              className="w-full h-7 pl-7 pr-2 bg-white border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary"
              placeholder="Filter accounts…"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <label className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1 bg-white">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">tune</span>
            <span className="text-on-surface-variant">Show:</span>
            <select
              className="bg-transparent border-none text-label-sm text-on-surface focus:outline-none"
              value={filterMapped}
              onChange={e => setFilterMapped(e.target.value as MappedFilter)}
            >
              <option value="">All</option>
              <option value="mapped">Mapped only</option>
              <option value="unmapped">Unmapped only</option>
            </select>
          </label>
          <div className="flex-1"></div>
          <span className="text-[11px] text-on-surface-variant">{shownTotal} of {totalCount}</span>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden max-h-[640px] overflow-y-auto">
          <table className="tax-table">
            <thead>
              <tr>
                <th style={{ width: '36%' }}>Account / Tax line</th>
                <th className="right" style={{ width: '14%' }}>Amount</th>
                <th className="right" style={{ width: '14%' }}>YTD</th>
                <th style={{ width: '22%' }}>Tax mapping</th>
                <th style={{ width: '14%' }}></th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(section => {
                const visibleRows = visibleBySection.get(section.id) ?? [];
                if (visibleRows.length === 0) return null;
                return (
                  <SectionBlock
                    key={section.id}
                    section={section}
                    rows={visibleRows}
                    onRemap={openMapDrawer}
                    onRowClick={handleRowClick}
                    onRowMenuBtnClick={handleRowMenuBtnClick}
                  />
                );
              })}

              {/* Taxable profit final row */}
              <tr className="final">
                <td>Taxable profit (before estimated tax)</td>
                <td className="right">$12,195.31</td>
                <td className="right">$51,032.12</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="mapping-badge mapped !text-[10px]">
              <span className="material-symbols-outlined text-[10px]">check_circle</span>Mapped
            </span>
            Account is mapped to a tax line
          </span>
          <span className="flex items-center gap-1">
            <span className="mapping-badge unmapped !text-[10px]">
              <span className="material-symbols-outlined text-[10px]">error</span>Unmapped
            </span>
            Requires mapping before filing
          </span>
        </div>
      </main>

      {/* ═══════════ EXPORT MENU ═══════════ */}
      <div
        ref={exportMenuRef}
        className={`menu ${exportMenuOpen ? 'open' : ''}`}
        style={{ top: exportMenuPos.top, left: exportMenuPos.left }}
      >
        <div className="menu-header">Export as</div>
        <button onClick={() => handleExportItem('pdf')}><span className="material-symbols-outlined">picture_as_pdf</span>PDF</button>
        <button onClick={() => handleExportItem('xlsx')}><span className="material-symbols-outlined">table_chart</span>Excel (XLSX)</button>
        <button onClick={() => handleExportItem('csv')}><span className="material-symbols-outlined">table_view</span>CSV</button>
        <div className="sep"></div>
        <div className="menu-header">Send to accountant</div>
        <button onClick={() => handleExportItem('email')}><span className="material-symbols-outlined">mail</span>Email with PDF</button>
        <button onClick={() => handleExportItem('share')}><span className="material-symbols-outlined">share</span>Share link</button>
      </div>

      {/* ═══════════ MAPPING DRAWER ═══════════ */}
      <div className={`drawer-scrim ${mapOpen ? 'open' : ''}`} onClick={closeMapDrawer} />
      <div className={`drawer ${mapOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate">Map tax line</div>
              <div className="text-[11px] text-on-surface-variant">Tax line mapping</div>
            </div>
          </div>
          <button
            className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
            onClick={closeMapDrawer}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-surface-container-low rounded-lg p-3">
            <div className="text-[10px] text-on-surface-variant uppercase font-bold">Account</div>
            <div className="text-headline-sm mt-1">{currentRow ? currentRow.name : '—'}</div>
            <div className="text-[11px] text-on-surface-variant mt-1">{accountTypeLabel(currentRow)}</div>
          </div>

          <div>
            <label className="field-label">Form 1120 tax line</label>
            <select
              className="field-input"
              value={mapLine}
              onChange={e => setMapLine(e.target.value)}
            >
              <option value="">— Select tax line —</option>
              {TAX_LINE_GROUPS.map(grp => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Detail notes (optional)</label>
            <textarea
              className="field-input"
              style={{ height: '64px', padding: '8px 10px', fontFamily: 'inherit' }}
              placeholder="e.g. reconciled against Q3 contractor invoices"
            />
          </div>

          <div>
            <label className="field-label">Apply to similar accounts</label>
            <div className="flex flex-col gap-2 mt-1">
              <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" /> All accounts with same suffix pattern</label>
              <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" className="row-check" /> All Contractor expense accounts</label>
            </div>
          </div>

          <div className="bg-qb-blue/5 border border-qb-blue/30 rounded-lg p-3 text-[11px] text-qb-blue flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
            <div>Mapping is reversible. Unmapped accounts are excluded from tax estimates and flagged on filing.</div>
          </div>
        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button
            className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low"
            onClick={closeMapDrawer}
          >Cancel</button>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                className="h-8 px-3 bg-white border border-surface-dim text-body-md font-semibold hover:bg-surface-container-low split-btn-main"
                onClick={() => saveMapping(true)}
              >Save and next</button>
              <button className="h-8 px-1.5 bg-white border border-surface-dim hover:bg-surface-container-low split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <div className="flex split-btn">
              <button
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main"
                onClick={() => saveMapping(false)}
              >Save mapping</button>
              <button className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow">
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ ROW ⋯ MENU ═══════════ */}
      <div
        ref={rowMenuRef}
        className={`menu ${rowMenuOpen ? 'open' : ''}`}
        style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
      >
        <div className="menu-header">This account</div>
        <button onClick={() => handleRowMenuAction('remap')}><span className="material-symbols-outlined">tune</span>Remap tax line</button>
        <button onClick={() => handleRowMenuAction('view-register')}><span className="material-symbols-outlined">receipt_long</span>View register</button>
        <button onClick={() => handleRowMenuAction('run-report')}><span className="material-symbols-outlined">assessment</span>Run report for account</button>
        <div className="sep"></div>
        <div className="menu-header">Drill down</div>
        <button onClick={() => handleRowMenuAction('view-transactions')}><span className="material-symbols-outlined">list</span>View transactions</button>
        <button onClick={() => handleRowMenuAction('export-line')}><span className="material-symbols-outlined">download</span>Export this line</button>
        <div className="sep"></div>
        <div className="menu-header">Flags</div>
        <button onClick={() => handleRowMenuAction('flag-review')}><span className="material-symbols-outlined">flag</span>Flag for accountant review</button>
        <button className="danger" onClick={() => handleRowMenuAction('exclude')}><span className="material-symbols-outlined">block</span>Exclude from tax summary</button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Section block sub-component (keeps the table render readable)
   ───────────────────────────────────────────────────────────── */

interface SectionBlockProps {
  section: SectionDef;
  rows: TaxRow[];
  onRemap: (row: TaxRow) => void;
  onRowClick: (row: TaxRow, e: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowMenuBtnClick: (row: TaxRow, e: React.MouseEvent<HTMLButtonElement>) => void;
}

function SectionBlock({ section, rows, onRemap, onRowClick, onRowMenuBtnClick }: SectionBlockProps) {
  return (
    <>
      <tr className="section"><td colSpan={5}>{section.label}</td></tr>
      {rows.map(row => {
        const isUnmapped = row.kind === 'unmapped';
        const rowCls = [
          'clickable',
          isUnmapped ? 'unmapped' : '',
          row.flagged ? 'flagged' : '',
        ].filter(Boolean).join(' ');
        return (
          <tr key={row.id} className={rowCls} onClick={e => onRowClick(row, e)}>
            <td>
              {row.name}
              <div className="text-[11px] text-on-surface-variant">{row.formLine}</div>
            </td>
            <td className="right">{row.amount}</td>
            <td className="right">{row.ytd}</td>
            <td>
              <span className={`mapping-badge ${row.kind === 'unmapped' ? 'unmapped' : 'mapped'}`}>
                <span className="material-symbols-outlined text-[11px]">
                  {row.kind === 'unmapped' ? 'error' : 'check_circle'}
                </span>
                {row.mapping}
              </span>
            </td>
            <td className="text-right">
              <button
                className="text-[11px] font-semibold text-primary hover:underline"
                onClick={e => { e.stopPropagation(); onRemap(row); }}
              >
                {isUnmapped ? 'Map now' : 'Remap'}
              </button>
              <button
                data-row-menu-btn
                className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-surface-container"
                onClick={e => onRowMenuBtnClick(row, e)}
              >
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant">more_horiz</span>
              </button>
            </td>
          </tr>
        );
      })}
      <tr className="total">
        <td>{section.totalLabel}</td>
        <td className="right">{section.totalAmount}</td>
        <td className="right">{section.totalYtd}</td>
        <td colSpan={2}></td>
      </tr>
    </>
  );
}
