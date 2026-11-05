'use client';
import './bank-transactions.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountingScreenProps } from './types';
import { ACCT_NAV } from './types';

type ViewTab = 'review' | 'categorized' | 'excluded' | 'all';
type TxStatus = 'review' | 'categorized' | 'excluded';
type TxType = 'expense' | 'income';
type BulkAction = 'match' | 'exclude' | 'receipt' | 'delete' | 'close';

interface CatChip {
  cls: string;
  icon?: string;
  label: string;
  /** chip carries data-cat-picker → opens the category picker */
  picker: boolean;
}

interface TxRow {
  id: number;
  status: TxStatus;
  type: TxType;
  date: string;
  desc: string;
  payee: string;
  amount: string;
  amountCls: string;
  chip: CatChip;
  matchBadge: string | null;
  rowExcluded: boolean;
  checked: boolean;
}

const INITIAL_ROWS: TxRow[] = [
  { id: 1, status: 'review', type: 'expense', date: '10/30/2026', desc: 'STAPLES #0412', payee: 'Staples', amount: '−$142.50', amountCls: 'text-error', chip: { cls: 'cat-chip suggested', icon: 'auto_awesome', label: 'Office supplies', picker: true }, matchBadge: null, rowExcluded: false, checked: false },
  { id: 2, status: 'review', type: 'expense', date: '10/29/2026', desc: 'FEDEX 001239847', payee: 'FedEx', amount: '−$84.20', amountCls: 'text-error', chip: { cls: 'cat-chip', icon: 'expand_more', label: 'Select category', picker: true }, matchBadge: 'Bill #PF-9211', rowExcluded: false, checked: false },
  { id: 3, status: 'review', type: 'income', date: '10/28/2026', desc: 'STRIPE PAYOUT', payee: 'Stripe', amount: '+$1,842.60', amountCls: 'text-secondary', chip: { cls: 'cat-chip suggested', icon: 'auto_awesome', label: 'Stripe clearing', picker: true }, matchBadge: null, rowExcluded: false, checked: false },
  { id: 4, status: 'review', type: 'expense', date: '10/27/2026', desc: 'AWS EMEA CHARGES', payee: 'Amazon Web Services', amount: '−$124.88', amountCls: 'text-error', chip: { cls: 'cat-chip suggested', icon: 'auto_awesome', label: 'Software', picker: true }, matchBadge: null, rowExcluded: false, checked: false },
  { id: 5, status: 'review', type: 'income', date: '10/27/2026', desc: 'ACME CORP — ACH', payee: 'Acme Corp', amount: '+$1,240.00', amountCls: 'text-secondary', chip: { cls: 'cat-chip suggested', icon: 'auto_awesome', label: 'Invoice 1002', picker: true }, matchBadge: 'Invoice 1002', rowExcluded: false, checked: false },
  { id: 6, status: 'categorized', type: 'expense', date: '10/26/2026', desc: 'ADOBE CREATIVE', payee: 'Adobe', amount: '−$59.99', amountCls: 'text-error', chip: { cls: 'cat-chip', label: 'Software', picker: true }, matchBadge: null, rowExcluded: false, checked: false },
  { id: 7, status: 'excluded', type: 'expense', date: '10/25/2026', desc: 'ATM WITHDRAWAL', payee: '—', amount: '−$200.00', amountCls: 'text-error', chip: { cls: 'cat-chip excluded', label: 'Excluded', picker: false }, matchBadge: null, rowExcluded: true, checked: false },
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
  { val: 'Stripe clearing', dot: '#0a6400' },
  { val: 'Ask My Accountant', dot: '#ba1a1a' },
];

export default function BankTransactions({ onNavigate }: AccountingScreenProps) {
  const [rows, setRows] = useState<TxRow[]>(INITIAL_ROWS);
  const [checkAll, setCheckAll] = useState(false);
  const [bulkCat, setBulkCat] = useState('');
  // viewTab 'review' is the initial active tab; tabTouched=false mirrors the static HTML
  // (before any tab click all 7 rows are visible and the count reads "1–5 of 5")
  const [viewTab, setViewTab] = useState<ViewTab>('review');
  const [tabTouched, setTabTouched] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [ruleBannerHidden, setRuleBannerHidden] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [catPickerPos, setCatPickerPos] = useState({ top: 0, left: 0 });
  const [pickerRowId, setPickerRowId] = useState<number | null>(null);
  const [catSearch, setCatSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const toastTimer = useRef<number | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 1800);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  // document click closes the category picker when clicking outside it
  useEffect(() => {
    if (!catPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCatPickerOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [catPickerOpen]);

  const checkedCount = rows.filter((r) => r.checked).length;

  const visibleCount = rows.filter(
    (r) => !tabTouched || viewTab === 'all' || r.status === viewTab
  ).length;
  const txCountText = tabTouched ? `1–${visibleCount} of ${rows.length}` : '1–5 of 5';

  /* View tabs */
  const handleViewTab = (st: ViewTab) => {
    setViewTab(st);
    setTabTouched(true);
  };

  /* Row interactions */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('input,button,.cat-chip')) return;
    toast('Row click → transaction detail drawer');
  };

  const toggleRowCheck = (id: number) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCheckAll(e.target.checked);
    setRows((rs) => rs.map((r) => ({ ...r, checked: e.target.checked })));
  };

  /* Bulk bar */
  const handleBulk = (act: BulkAction) => {
    if (act === 'close') {
      setRows((rs) => rs.map((r) => ({ ...r, checked: false })));
      setCheckAll(false);
      return;
    }
    const n = rows.filter((r) => r.checked).length;
    toast(`${act.charAt(0).toUpperCase() + act.slice(1)} on ${n} transaction${n !== 1 ? 's' : ''}`);
  };

  /* Category picker */
  const openCatPicker = (e: React.MouseEvent<HTMLButtonElement>, rowId: number) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setPickerRowId(rowId);
    setCatPickerPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 300) });
    setCatPickerOpen(true);
    setCatSearch('');
  };

  const pickCategory = (val: string) => {
    if (val === '__match__') {
      toast('Open match drawer');
      setCatPickerOpen(false);
      return;
    }
    if (val === '__exclude__') {
      if (pickerRowId !== null) {
        setRows((rs) =>
          rs.map((r) =>
            r.id === pickerRowId
              ? { ...r, chip: { cls: 'cat-chip excluded', label: 'Excluded', picker: r.chip.picker } }
              : r
          )
        );
      }
      toast('Transaction excluded');
      setCatPickerOpen(false);
      return;
    }
    if (pickerRowId !== null) {
      setRows((rs) =>
        rs.map((r) =>
          r.id === pickerRowId
            ? { ...r, chip: { cls: 'cat-chip', label: val, picker: r.chip.picker } }
            : r
        )
      );
    }
    toast(`Categorized as ${val}`);
    setCatPickerOpen(false);
  };

  return (
    <div className="bank-transactions-page bg-background font-sans text-body-md text-on-surface antialiased">

      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Accounting</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Bank transactions</span>
        </div>
      </div>

      <main className="px-6 pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Bank transactions</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">For review feed + bank rules · Chase •9910 · synced 2m ago</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">sync</span>Sync bank</button>
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" data-goto="rules" onClick={() => onNavigate(...ACCT_NAV.rules())}>
              <span className="material-symbols-outlined text-[16px]">tune</span>Rules</button>
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">download</span>Export</button>
          </div>
        </div>

        {/* Account tabs */}
        <div className="flex items-center gap-1 mb-3">
          <button className="h-8 px-3 rounded-lg bg-white border border-primary text-primary text-label-sm font-semibold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">account_balance</span>Chase •9910</button>
          <button className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-surface-container-low text-on-surface text-label-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">credit_card</span>Visa •4421</button>
          <button className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-surface-container-low text-on-surface text-label-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>Amex •2103</button>
          <button className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-surface-container-low text-on-surface-variant text-label-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">add</span>Connect account</button>
        </div>

        {/* Rule suggestion banner */}
        <div className="rule-banner" style={ruleBannerHidden ? { display: 'none' } : undefined}>
          <span className="material-symbols-outlined text-[20px] text-qb-blue">auto_awesome</span>
          <div className="flex-1">
            <div className="text-body-sm font-semibold">Rule suggestion</div>
            <div className="text-[11px] text-on-surface-variant">You've categorized 3 STAPLES transactions as <strong>Office supplies</strong>. Create a rule to auto-categorize future ones?</div>
          </div>
          <button className="h-7 px-2.5 border border-surface-dim rounded text-label-sm font-semibold hover:bg-white" data-create-rule onClick={() => toast('Rule created: STAPLES → Office supplies')}>Create rule</button>
          <button className="h-7 w-7 rounded hover:bg-white flex items-center justify-center" data-dismiss-rule aria-label="Dismiss rule suggestion" onClick={() => setRuleBannerHidden(true)}>
            <span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            <button className={`h-full px-3 text-label-md tab-underline${viewTab === 'review' ? ' active' : ''}`} data-viewtab="review" onClick={() => handleViewTab('review')}>
              For review <span className="ml-1 px-1.5 py-0.5 rounded-full bg-qb-blue text-white text-[10px] font-bold" data-tab-count>5</span></button>
            <button className={`h-full px-3 text-label-md tab-underline text-on-surface-variant${viewTab === 'categorized' ? ' active' : ''}`} data-viewtab="categorized" onClick={() => handleViewTab('categorized')}>Categorized</button>
            <button className={`h-full px-3 text-label-md tab-underline text-on-surface-variant${viewTab === 'excluded' ? ' active' : ''}`} data-viewtab="excluded" onClick={() => handleViewTab('excluded')}>Excluded</button>
            <button className={`h-full px-3 text-label-md tab-underline text-on-surface-variant${viewTab === 'all' ? ' active' : ''}`} data-viewtab="all" onClick={() => handleViewTab('all')}>All</button>
          </div>

          {/* Filter bar */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Filter by description, amount…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
            </div>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>Date range</button>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views</button>
            <span className="ml-auto text-[11px] text-on-surface-variant" data-tx-count>{txCountText}</span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar${checkedCount > 0 ? ' show' : ''}`} data-bulk-bar>
            <span className="text-[12px] font-semibold" data-bulk-count>{checkedCount} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <select data-bulk-cat value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
              <option value="">Categorize as…</option>
              <option>Office supplies</option>
              <option>Shipping</option>
              <option>Software</option>
              <option>Advertising</option>
              <option>Meals & entertainment</option>
              <option>Travel</option>
              <option>Stripe clearing</option>
              <option>Ask My Accountant</option>
            </select>
            <button data-bulk="match" onClick={() => handleBulk('match')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">link</span>Match</button>
            <button data-bulk="exclude" onClick={() => handleBulk('exclude')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">block</span>Exclude</button>
            <button data-bulk="receipt" onClick={() => handleBulk('receipt')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">receipt</span>Attach receipt</button>
            <span className="w-px h-4 bg-white/30"></span>
            <button data-bulk="delete" onClick={() => handleBulk('delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" data-bulk="close" aria-label="Close" onClick={() => handleBulk('close')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>

          {/* Table */}
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" data-check-all checked={checkAll} onChange={handleCheckAll} /></th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Payee</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Match</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim" data-tx-tbody>
              {rows.map((row) => {
                const vis = !tabTouched || viewTab === 'all' || row.status === viewTab;
                return (
                  <tr
                    key={row.id}
                    data-status={row.status}
                    data-type={row.type}
                    className={`hover:bg-surface-container-low cursor-pointer tx-row${row.rowExcluded ? ' row-excluded' : ''}`}
                    style={vis ? undefined : { display: 'none' }}
                    onClick={handleRowClick}
                  >
                    <td className="px-3 py-2"><input type="checkbox" className="row-check tx-check" checked={row.checked} onChange={() => toggleRowCheck(row.id)} /></td>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 font-medium">{row.desc}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{row.payee}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${row.amountCls}`}>{row.amount}</td>
                    <td className="px-3 py-2">
                      {row.chip.picker ? (
                        <button className={row.chip.cls} data-cat-picker onClick={(e) => openCatPicker(e, row.id)}>
                          {row.chip.icon ? <span className="material-symbols-outlined text-[12px]">{row.chip.icon}</span> : null}{row.chip.label}
                        </button>
                      ) : (
                        <button className={row.chip.cls}>{row.chip.label}</button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.matchBadge ? (
                        <span className="match-badge"><span className="material-symbols-outlined text-[11px]">link</span>{row.matchBadge}</span>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right"><button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" aria-label="Row actions"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </main>

      {/* Category picker (positioned dropdown) */}
      <div ref={pickerRef} id="cat-picker" className={catPickerOpen ? 'cat-picker open' : 'cat-picker'} style={{ top: catPickerPos.top, left: catPickerPos.left }}>
        <input placeholder="Search categories…" data-cat-search value={catSearch} onChange={(e) => setCatSearch(e.target.value)} />
        <div className="recent">Suggested</div>
        {PICKER_SUGGESTED.map((o) => (
          <div key={o.val} className="cat-opt" data-pick={o.val} onClick={() => pickCategory(o.val)}><span className="dot" style={{ background: o.dot }} />{o.val}</div>
        ))}
        <div className="cat-sep"></div>
        <div className="recent">All categories</div>
        {PICKER_ALL.map((o) => (
          <div key={o.val} className="cat-opt" data-pick={o.val} onClick={() => pickCategory(o.val)}><span className="dot" style={{ background: o.dot }} />{o.val}</div>
        ))}
        <div className="cat-sep"></div>
        <div className="cat-opt" data-pick="__match__" onClick={() => pickCategory('__match__')}><span className="material-symbols-outlined text-[16px] text-qb-blue">link</span>Match to existing…</div>
        <div className="cat-opt" data-pick="__exclude__" onClick={() => pickCategory('__exclude__')}><span className="material-symbols-outlined text-[16px] text-on-surface-variant">block</span>Exclude this transaction</div>
      </div>

      <div id="toast" className={toastMsg ? 'toast show' : 'toast'}>{toastMsg}</div>
    </div>
  );
}
