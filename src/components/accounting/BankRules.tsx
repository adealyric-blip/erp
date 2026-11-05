'use client';
import { useEffect, useRef, useState } from 'react';
import type { AccountingScreenProps } from './types';
import './bank-rules.css';

/* Sample transactions used in the preview (verbatim from the mockup) */
const SAMPLE_TXNS = [
  { desc: 'STAPLES #0412', date: '10/30/2026', amt: -142.5 },
  { desc: 'STAPLES #0418', date: '10/22/2026', amt: -88.15 },
  { desc: 'STAPLES #0412', date: '10/12/2026', amt: -210.0 },
  { desc: 'STAPLES.COM', date: '09/28/2026', amt: -45.99 },
  { desc: 'ADOBE CREATIVE', date: '10/26/2026', amt: -59.99 },
  { desc: 'ADOBE SYSTEMS', date: '09/26/2026', amt: -59.99 },
  { desc: 'STRIPE PAYOUT', date: '10/28/2026', amt: 1842.6 },
  { desc: 'STRIPE FEE', date: '10/28/2026', amt: -52.11 },
  { desc: 'AWS EMEA CHARGES', date: '10/27/2026', amt: -124.88 },
  { desc: 'AWS EMEA CHARGES', date: '09/27/2026', amt: -118.44 },
  { desc: 'UBER TRIP', date: '10/15/2026', amt: -22.4 },
  { desc: 'UBER EATS', date: '10/18/2026', amt: -34.55 },
];

type RuleStatus = 'active' | 'paused';

interface RuleRow {
  id: number;
  /** Text rendered in the "Rule name" cell */
  name: string;
  /** Value of the row's data-name attribute (edit-drawer prefill + toasts) */
  dataName: string;
  /** Uppercase keyword rendered inside contains "…" */
  keyword: string;
  category: string;
  /** Tailwind classes of the category pill */
  catClass: string;
  matched: number;
  status: RuleStatus;
  /** Extra clause in the "When" cell, e.g. 'and amount > $0' */
  extraWhen?: string;
}

interface CondRow {
  id: number;
  /** 'first' = the original condition row — its input carries data-cond-val and drives the preview */
  kind: 'first' | 'added';
  field: string;
  op: string;
  value: string;
}

interface RowMenuState {
  rowId: number;
  top: number;
  left: number;
  /** paused state captured when the menu opened (the mockup sets item visibility at open time) */
  paused: boolean;
}

/* Option sets differ between the initial condition row and rows added via "Add condition" (verbatim from the mockup script) */
const FIRST_FIELD_OPTIONS = ['Bank description', 'Payee', 'Amount', 'Type (deposit / payment)'];
const FIRST_OP_OPTIONS = ['Contains', 'Does not contain', 'Equals', 'Starts with', 'Ends with'];
const ADDED_FIELD_OPTIONS = ['Bank description', 'Payee', 'Amount', 'Type'];
const ADDED_OP_OPTIONS = ['Contains', 'Does not contain', 'Equals', 'Greater than'];

const INITIAL_RULES: RuleRow[] = [
  { id: 1, name: 'Staples → Office supplies', dataName: 'Staples → Office supplies', keyword: 'STAPLES', category: 'Office supplies', catClass: 'bg-qb-blue/10 text-qb-blue', matched: 11, status: 'active' },
  { id: 2, name: 'Adobe → Software', dataName: 'Adobe → Software', keyword: 'ADOBE', category: 'Software', catClass: 'bg-qb-maroon/10 text-qb-maroon', matched: 6, status: 'active' },
  { id: 3, name: 'Stripe payouts → Stripe clearing', dataName: 'Stripe payouts → Stripe clearing', keyword: 'STRIPE', category: 'Stripe clearing', catClass: 'bg-qb-green/10 text-qb-green', matched: 8, status: 'active', extraWhen: 'and amount > $0' },
  { id: 4, name: 'AWS → Software', dataName: 'AWS → Software', keyword: 'AWS', category: 'Software', catClass: 'bg-qb-maroon/10 text-qb-maroon', matched: 3, status: 'active' },
  { id: 5, name: 'Uber → Travel', dataName: 'Uber → Travel (paused)', keyword: 'UBER', category: 'Travel', catClass: 'bg-qb-teal/10 text-qb-teal', matched: 0, status: 'paused' },
];

/* (n<0?"−":"+")+"$"+… — note the U+2212 minus sign, exactly as in the mockup */
const money = (n: number) =>
  (n < 0 ? '−' : '+') + '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function BankRules(_props: AccountingScreenProps) {
  /* ── Table state ── */
  const [rows, setRows] = useState<RuleRow[]>(INITIAL_RULES);
  const [viewTab, setViewTab] = useState<'all' | 'active' | 'paused'>('all');
  const [rlCount, setRlCount] = useState(`1–${INITIAL_RULES.length} of ${INITIAL_RULES.length}`);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [checkAll, setCheckAll] = useState(false);
  const [filterText, setFilterText] = useState('');

  /* ── Row ⋯ menu ── */
  const [menu, setMenu] = useState<RowMenuState | null>(null);

  /* ── Rule editor drawer ── */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<RuleRow | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [thenCategory, setThenCategory] = useState('');
  const [matchMode, setMatchMode] = useState('Match ALL conditions');
  const [bankAccount, setBankAccount] = useState('All accounts');
  const [turnOnRule, setTurnOnRule] = useState(true);
  const [condRows, setCondRows] = useState<CondRow[]>([
    { id: 1, kind: 'first', field: 'Bank description', op: 'Contains', value: '' },
  ]);

  /* ── Toast ── */
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<number | null>(null);

  const nextRowId = useRef(INITIAL_RULES.length + 1);
  const nextCondId = useRef(2);

  const toast = (m: string) => {
    setToastMsg(m);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 1800);
  };
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    []
  );

  /* ── KPIs (mockup updateKpis: active/paused counts + "1–N of N" label) ── */
  const kpiActive = rows.filter(r => r.status === 'active').length;
  const kpiPaused = rows.filter(r => r.status === 'paused').length;
  const updateKpis = (rs: RuleRow[]) => setRlCount(`1–${rs.length} of ${rs.length}`);

  /* ── Live preview (mockup updatePreview: reads the first condition's keyword input) ── */
  const firstCond = condRows.find(c => c.kind === 'first');
  const previewKw = (firstCond?.value || '').toUpperCase().trim();
  const previewMatches = previewKw
    ? SAMPLE_TXNS.filter(t => t.desc.toUpperCase().includes(previewKw))
    : [];

  const visibleRows = viewTab === 'all' ? rows : rows.filter(r => r.status === viewTab);
  const menuRow = menu ? rows.find(r => r.id === menu.rowId) || null : null;

  /* ── Drawer open/close ── */
  const openDrawer = (rule: RuleRow | null) => {
    if (rule) {
      setEditingRow(rule);
      setRuleName(rule.dataName);
      setCondRows(cs => cs.map(c => (c.kind === 'first' ? { ...c, value: rule.keyword } : c)));
      setThenCategory(rule.category);
    } else {
      setEditingRow(null);
      setRuleName('');
      setCondRows(cs => cs.map(c => (c.kind === 'first' ? { ...c, value: '' } : c)));
      setThenCategory('');
    }
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  /* ── Condition builder ── */
  const updateCond = (id: number, patch: Partial<CondRow>) => {
    setCondRows(cs => cs.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };
  const addCond = () => {
    setCondRows(cs => [
      ...cs,
      { id: nextCondId.current++, kind: 'added', field: 'Bank description', op: 'Contains', value: '' },
    ]);
  };
  const removeCond = (id: number) => {
    // don't remove the last condition
    setCondRows(cs => (cs.length > 1 ? cs.filter(c => c.id !== id) : cs));
  };

  /* ── Save ── */
  const saveRule = (andClose: boolean) => {
    const name = ruleName.trim();
    if (!name) {
      toast('Rule name required');
      return;
    }
    const kw = (firstCond?.value || '').trim();
    if (!kw) {
      toast('Add a description keyword');
      return;
    }
    const cat = thenCategory;
    if (!cat) {
      toast('Pick a category');
      return;
    }

    const tr: RuleRow = {
      id: nextRowId.current++,
      name,
      dataName: name,
      keyword: kw.toUpperCase(),
      category: cat,
      catClass: 'bg-qb-blue/10 text-qb-blue',
      matched: 0,
      status: 'active',
    };
    const next = [tr, ...rows];
    setRows(next);
    updateKpis(next);
    toast(`Rule "${name}" saved`);
    if (andClose) {
      setDrawerOpen(false);
    } else {
      setRuleName('');
      setCondRows(cs => cs.map(c => (c.kind === 'first' ? { ...c, value: '' } : c)));
      setThenCategory('');
    }
  };

  /* ── Row click + row menu + toggle ── */
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, row: RuleRow) => {
    if ((e.target as Element).closest('input,button,.switch')) return;
    openDrawer(row);
  };

  const toggleRule = (row: RuleRow) => {
    const isOn = row.status !== 'active'; // status after the flip
    const next = rows.map(r =>
      r.id === row.id ? { ...r, status: (isOn ? 'active' : 'paused') as RuleStatus } : r
    );
    setRows(next);
    updateKpis(next);
    toast(isOn ? 'Rule activated' : 'Rule paused');
  };

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, row: RuleRow) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({
      rowId: row.id,
      top: r.bottom + 4,
      left: Math.min(r.right - 260, window.innerWidth - 280),
      paused: row.status === 'paused',
    });
  };

  const handleMenuAction = (action: string, tr: RuleRow) => {
    setMenu(null);
    switch (action) {
      case 'edit':
      case 'duplicate':
        openDrawer(tr);
        break;
      case 'apply-existing': {
        const matched = Math.floor(Math.random() * 8) + 3;
        toast(`Applied to ${matched} past transactions`);
        setRows(rows.map(r => (r.id === tr.id ? { ...r, matched: r.matched + matched } : r)));
        break;
      }
      case 'view-matched':
        toast(`Showing transactions matched by "${tr.dataName}"`);
        break;
      case 'pause': {
        const next = rows.map(r => (r.id === tr.id ? { ...r, status: 'paused' as RuleStatus } : r));
        setRows(next);
        updateKpis(next);
        toast('Rule paused');
        break;
      }
      case 'activate': {
        const next = rows.map(r => (r.id === tr.id ? { ...r, status: 'active' as RuleStatus } : r));
        setRows(next);
        updateKpis(next);
        toast('Rule activated');
        break;
      }
      case 'delete': {
        const next = rows.filter(r => r.id !== tr.id);
        setRows(next);
        updateKpis(next);
        toast('Rule deleted');
        break;
      }
    }
  };

  /* ── View tabs ── */
  const handleViewTab = (st: 'all' | 'active' | 'paused') => {
    setViewTab(st);
    const shown = st === 'all' ? rows.length : rows.filter(r => r.status === st).length;
    setRlCount(`1–${shown} of ${rows.length}`);
  };
  const tabClassName = (key: 'all' | 'active' | 'paused', variant: boolean) =>
    `h-full px-3 text-label-md tab-underline${variant ? ' text-on-surface-variant' : ''}${
      viewTab === key ? ' active' : ''
    }`;

  /* ── Bulk bar ── */
  const toggleSelected = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCheckAll = (checked: boolean) => {
    setCheckAll(checked);
    setSelectedIds(checked ? new Set(rows.map(r => r.id)) : new Set());
  };

  const handleBulk = (act: string) => {
    if (act === 'close') {
      setSelectedIds(new Set());
      setCheckAll(false);
      return;
    }
    const n = selectedIds.size;
    if (act === 'delete') {
      const next = rows.filter(r => !selectedIds.has(r.id));
      setRows(next);
      updateKpis(next);
    }
    if (act === 'activate') {
      const next = rows.map(r =>
        selectedIds.has(r.id) ? { ...r, status: 'active' as RuleStatus } : r
      );
      setRows(next);
      updateKpis(next);
    }
    if (act === 'pause') {
      const next = rows.map(r =>
        selectedIds.has(r.id) ? { ...r, status: 'paused' as RuleStatus } : r
      );
      setRows(next);
      updateKpis(next);
    }
    toast(`${act.charAt(0).toUpperCase() + act.slice(1)} on ${n} rule${n !== 1 ? 's' : ''}`);
    setSelectedIds(new Set());
    setCheckAll(false);
  };

  /* Global click outside closes menus (mockup document click listener) */
  useEffect(() => {
    if (!menu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || !target.closest('#row-menu')) setMenu(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menu]);

  return (
    <div className="bank-rules-page bg-background font-sans text-body-md text-on-surface antialiased">

      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Accounting</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Rules</span>
        </div>
      </div>

      <main className="px-6 pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Bank rules</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Auto-categorize repeating transactions — when the bank description matches, apply the category.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" data-export>
              <span className="material-symbols-outlined text-[16px]">download</span>Export</button>
            <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container flex items-center gap-1" data-new-rule onClick={() => openDrawer(null)}>
              <span className="material-symbols-outlined text-[16px]">add</span>New rule</button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Active rules</span>
            <div className="text-headline-sm mt-1 tabular-nums" data-kpi-active>{kpiActive}</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Auto-categorized (30d)</span>
            <div className="text-headline-sm mt-1 tabular-nums">28</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Paused</span>
            <div className="text-headline-sm mt-1 tabular-nums" data-kpi-paused>{kpiPaused}</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-3">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Match rate</span>
            <div className="text-headline-sm mt-1 tabular-nums">94%</div>
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">

          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            <button className={tabClassName('all', false)} data-viewtab="all" onClick={() => handleViewTab('all')}>All rules</button>
            <button className={tabClassName('active', true)} data-viewtab="active" onClick={() => handleViewTab('active')}>Active</button>
            <button className={tabClassName('paused', true)} data-viewtab="paused" onClick={() => handleViewTab('paused')}>Paused</button>
          </div>

          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Filter rules…" value={filterText} onChange={e => setFilterText(e.target.value)} />
            </div>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views</button>
            <span className="ml-auto text-[11px] text-on-surface-variant" data-rl-count>{rlCount}</span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar${selectedIds.size > 0 ? ' show' : ''}`} data-bulk-bar>
            <span className="text-[12px] font-semibold" data-bulk-count>{selectedIds.size} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <button data-bulk="activate" onClick={() => handleBulk('activate')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">play_arrow</span>Activate</button>
            <button data-bulk="pause" onClick={() => handleBulk('pause')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">pause</span>Pause</button>
            <button data-bulk="run" onClick={() => handleBulk('run')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">play_circle</span>Apply to existing</button>
            <span className="w-px h-4 bg-white/30"></span>
            <button data-bulk="delete" onClick={() => handleBulk('delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" data-bulk="close" aria-label="Close" onClick={() => handleBulk('close')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>

          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" data-check-all checked={checkAll} onChange={e => handleCheckAll(e.target.checked)} /></th>
                <th className="px-3 py-2">Rule name</th>
                <th className="px-3 py-2">When (description)</th>
                <th className="px-3 py-2">Then (category)</th>
                <th className="px-3 py-2 text-right">Matched (30d)</th>
                <th className="px-3 py-2">Active</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim" data-rl-tbody>
              {visibleRows.map(row => (
                <tr key={row.id} className={`hover:bg-surface-container-low cursor-pointer rl-row${row.status === 'paused' ? ' opacity-70' : ''}`} data-status={row.status} data-name={row.dataName} data-category={row.category} onClick={e => handleRowClick(e, row)}>
                  <td className="px-3 py-2"><input type="checkbox" className="row-check rl-check" checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-on-surface-variant"><span className="px-1.5 py-0.5 rounded bg-surface-container text-[11px] font-mono">contains "{row.keyword}"</span>{row.extraWhen ? <> {' '}<span className="text-[11px]">{row.extraWhen}</span></> : null}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] ${row.catClass} font-medium`}>{row.category}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.matched}</td>
                  <td className="px-3 py-2"><div className={`switch${row.status === 'active' ? ' on' : ''}`} data-toggle onClick={e => { e.stopPropagation(); toggleRule(row); }} /></td>
                  <td className="px-2 py-2 text-right"><button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" data-row-menu aria-label="Rule actions" onClick={e => { e.stopPropagation(); openRowMenu(e, row); }}><span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>

      {/* ═══════════ RULE EDITOR DRAWER ═══════════ */}
      <div className={drawerOpen ? 'drawer-scrim open' : 'drawer-scrim'} id="rule-scrim" onClick={closeDrawer} />
      <div className={drawerOpen ? 'drawer open' : 'drawer'} id="rule-drawer">
        <div className="flex items-center justify-between px-5 h-14 border-b border-surface-dim shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[20px] text-primary">tune</span>
            <div className="min-w-0">
              <div className="text-headline-sm truncate" data-rule-title>{editingRow ? 'Edit rule' : 'New bank rule'}</div>
              <div className="text-[11px] text-on-surface-variant">When the bank description matches, categorize</div>
            </div>
          </div>
          <button className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center" data-close-rule aria-label="Close" onClick={closeDrawer}>
            <span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Rule name */}
          <div>
            <label className="field-label">Rule name</label>
            <input className="field-input" value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Staples → Office supplies" data-rule-name />
          </div>

          {/* WHEN */}
          <div className="border-t border-surface-dim pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">When (conditions)</div>
              <select className="text-[11px] bg-transparent border border-surface-dim rounded px-1.5 py-0.5" value={matchMode} onChange={e => setMatchMode(e.target.value)}>
                <option>Match ALL conditions</option>
                <option>Match ANY condition</option>
              </select>
            </div>
            <div data-conditions>
              {condRows.map(c => (
                <div className="cond-row" key={c.id}>
                  <span className="cond-prefix">{c.kind === 'first' ? 'When' : 'And'}</span>
                  <select className="cond-select" value={c.field} onChange={e => updateCond(c.id, { field: e.target.value })}>
                    {(c.kind === 'first' ? FIRST_FIELD_OPTIONS : ADDED_FIELD_OPTIONS).map(o => <option key={o}>{o}</option>)}
                  </select>
                  <select className="cond-select" value={c.op} onChange={e => updateCond(c.id, { op: e.target.value })}>
                    {(c.kind === 'first' ? FIRST_OP_OPTIONS : ADDED_OP_OPTIONS).map(o => <option key={o}>{o}</option>)}
                  </select>
                  <input className="cond-input" placeholder={c.kind === 'first' ? 'e.g. STAPLES' : 'e.g. $0'} data-cond-val={c.kind === 'first' ? '' : undefined} value={c.value} onChange={e => updateCond(c.id, { value: e.target.value })} />
                  <button className="cond-remove" data-remove-cond aria-label="Remove condition" onClick={() => removeCond(c.id)}>
                    <span className="material-symbols-outlined text-[16px]">close</span></button>
                </div>
              ))}
            </div>
            <button className="h-7 px-2 mt-2 border border-dashed border-surface-dim rounded text-[11px] font-semibold text-primary hover:bg-surface-container-low flex items-center gap-1" data-add-cond onClick={addCond}>
              <span className="material-symbols-outlined text-[14px]">add</span>Add condition</button>
          </div>

          {/* THEN */}
          <div className="border-t border-surface-dim pt-4">
            <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mb-2">Then (apply)</div>
            <div className="space-y-3">
              <div>
                <label className="field-label">Category</label>
                <select className="field-input" data-then-category value={thenCategory} onChange={e => setThenCategory(e.target.value)}>
                  <option value="">— Select category —</option>
                  <option>Office supplies</option>
                  <option>Shipping</option>
                  <option>Software</option>
                  <option>Advertising</option>
                  <option>Meals &amp; entertainment</option>
                  <option>Travel</option>
                  <option>Stripe clearing</option>
                  <option>Ask My Accountant</option>
                </select>
              </div>
              <div>
                <label className="field-label">Apply to bank account</label>
                <select className="field-input" value={bankAccount} onChange={e => setBankAccount(e.target.value)}>
                  <option>All accounts</option>
                  <option>Chase •9910</option>
                  <option>Visa •4421</option>
                  <option>Amex •2103</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="row-check" checked={turnOnRule} onChange={e => setTurnOnRule(e.target.checked)} />
                <span className="text-body-sm">Turn on rule</span>
              </div>
            </div>
          </div>

          {/* PREVIEW — which past transactions this rule would have matched */}
          <div className="border-t border-surface-dim pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Would have matched</div>
              <span className="text-[11px] text-on-surface-variant"><span data-preview-count>{previewMatches.length}</span> recent transactions</span>
            </div>
            <div className="border border-surface-dim rounded-lg overflow-hidden" data-preview-list>
              {!previewKw ? (
                <div className="text-[11px] text-on-surface-variant text-center py-4">Enter a description keyword to preview matched transactions.</div>
              ) : previewMatches.length === 0 ? (
                <div className="text-[11px] text-on-surface-variant text-center py-4">No recent transactions match "<strong>{previewKw}</strong>".</div>
              ) : (
                previewMatches.slice(0, 6).map((t, i) => (
                  <div className="preview-txn" key={i}>
                    <span className="text-[11px] text-on-surface-variant w-20">{t.date}</span>
                    <span className="flex-1 font-medium truncate">{t.desc}</span>
                    <span className={`amt ${t.amt < 0 ? 'text-error' : 'text-secondary'}`}>{money(t.amt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        <div className="h-14 border-t border-surface-dim px-4 flex items-center justify-between shrink-0">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" data-close-rule onClick={closeDrawer}>Cancel</button>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button className="h-8 px-3 bg-white border border-surface-dim text-body-md font-semibold hover:bg-surface-container-low split-btn-main" data-save-new onClick={() => saveRule(false)}>Save and new</button>
              <button className="h-8 px-1.5 bg-white border border-surface-dim hover:bg-surface-container-low split-btn-arrow" aria-label="Save and new options">
                <span className="material-symbols-outlined text-[16px]">expand_more</span></button>
            </div>
            <div className="flex split-btn">
              <button className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container split-btn-main" data-save-rule onClick={() => saveRule(true)}>Save rule</button>
              <button className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow" aria-label="Save rule options">
                <span className="material-symbols-outlined text-[16px]">expand_more</span></button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ ROW ⋯ MENU ═══════════ */}
      {menu && menuRow && (
        <div className="row-menu open" id="row-menu" style={{ top: menu.top, left: menu.left }}>
          <div className="menu-header">This rule</div>
          <button data-action="edit" onClick={() => handleMenuAction('edit', menuRow)}><span className="material-symbols-outlined">edit</span>Edit rule</button>
          <button data-action="duplicate" onClick={() => handleMenuAction('duplicate', menuRow)}><span className="material-symbols-outlined">content_copy</span>Duplicate</button>
          <div className="sep"></div>
          <div className="menu-header">Run</div>
          <button data-action="apply-existing" onClick={() => handleMenuAction('apply-existing', menuRow)}><span className="material-symbols-outlined">play_circle</span>Apply to existing</button>
          <button data-action="view-matched" onClick={() => handleMenuAction('view-matched', menuRow)}><span className="material-symbols-outlined">list</span>View matched transactions</button>
          <div className="sep"></div>
          <div className="menu-header">State</div>
          {!menu.paused && (
            <button data-action="pause" onClick={() => handleMenuAction('pause', menuRow)}><span className="material-symbols-outlined">pause</span>Pause rule</button>
          )}
          {menu.paused && (
            <button data-action="activate" data-hide="true" onClick={() => handleMenuAction('activate', menuRow)}><span className="material-symbols-outlined">play_arrow</span>Activate rule</button>
          )}
          <button className="danger" data-action="delete" onClick={() => handleMenuAction('delete', menuRow)}><span className="material-symbols-outlined">delete</span>Delete rule</button>
        </div>
      )}

      <div className={toastMsg ? 'toast show' : 'toast'} id="toast">{toastMsg}</div>
    </div>
  );
}
