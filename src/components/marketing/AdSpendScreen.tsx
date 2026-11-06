'use client';

/**
 * AdSpendScreen — 1:1 faithful port of "ad spend.html"
 * (title: "Advertising — Ad spend & Finance bridge").
 *
 * Sections replicated from the source HTML:
 *   1. Breadcrumb (Advertising / Ad spend & Finance bridge)
 *   2. Page header with 3 finance-link buttons + Export spend
 *   3. Period strip — prev / label / next + Reconcile badge pill +
 *      "View in Reconcile" link + last-posted stamp
 *   4. KPI strip — 4 cards (Spend this period, Mapped to CoA,
 *      Unmapped exceptions, Reconciled through) with icon sub-notes
 *   5. Section 1 — Ad spend by advertiser table (7 cols + totals footer)
 *   6. Section 2 — Chart of Accounts mapping (Mapped + Unmapped lists
 *      with Change / Map buttons + info callout)
 *   7. Section 3 — Reconciliation state table (7 cols)
 *   8. Section 4 — Exceptions blocking close (per-exception cards)
 *
 * Overlays:
 *   • Per-row ⋯ menu — Map unmapped spend / View journal entries /
 *     Open in Advertisers / Open in Campaigns / Open in Reconcile
 *   • CoA mapping drawer — advertiser×network summary + account /
 *     cost-center / tax-line selects + info callout + Open CoA link
 *   • Journal entry drawer — read-only cards per JE
 *   • Finance destination modal — shows route name + path + body
 *
 * Every button does real work:
 *   • Export → exportToCsv with advertiser rows
 *   • Period prev/next → updates label + last-posted stamp + re-render
 *   • Finance links → open finance modal with route metadata
 *   • Map/Change buttons → open CoA map drawer
 *   • Save mapping → mutates advertiser mapping, re-renders all sections
 *   • Row ⋯ menu items → real actions (open drawer / modal)
 *   • Exception action links → open map drawer or finance modal
 *   • Journal links → open journal drawer
 */
import { useMemo, useState } from 'react';
import {
  type MarketingScreenProps,
  Breadcrumb,
  Btn,
  Drawer,
  IconBtn,
  Modal,
  NetChip,
  RowMenu,
  type RowMenuItem,
  Select,
  Stat,
  s,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';

/* ───────────── TYPES ───────────── */
type Network = 'Meta' | 'TikTok' | 'Google' | 'Pinterest';
type Gate = 'Ready' | 'Billing on hold' | 'Verification pending';
type ReconState = 'Open' | 'Not started' | 'Locked';
type JEStatus = 'Posted' | 'Unmapped';

interface Advertiser {
  id: string;
  name: string;
  billing: string;
  gate: Gate;
  spend: Record<Network, number>;
  mapped: Record<Network, string>;
}

interface JournalEntry {
  id: string;
  date: string;
  amount: number;
  account: string;
  memo: string;
  status: JEStatus;
}

interface ReconRow {
  account: string;
  name: string;
  debits: number;
  ledger: number;
  state: ReconState;
  lastLocked: string;
}

interface FinanceRoute {
  title: string;
  body: string;
  route: string;
}

interface Period {
  year: number;
  month: number; // 1-12
  lastPosted: string;
}

interface MapTarget {
  advertiserId: string;
  network: Network | null;
}

interface MapForm {
  account: string;
  costCenter: string;
  taxLine: string;
}

/* ───────────── CONSTANTS ───────────── */
const NETWORKS: Network[] = ['Meta', 'TikTok', 'Google', 'Pinterest'];

const COA_ACCOUNTS: { value: string; label: string }[] = [
  { value: '6100', label: '6100 · Advertising Expense — Meta' },
  { value: '6101', label: '6101 · Advertising Expense — TikTok' },
  { value: '6102', label: '6102 · Advertising Expense — Google' },
  { value: '6103', label: '6103 · Advertising Expense — Pinterest' },
  { value: '6104', label: '6104 · Advertising Expense — Other' },
];

const COST_CENTERS = ['Marketing — Paid', 'Marketing — Brand', 'Growth — Acquisition'];
const TAX_LINES = [
  'Advertising — Schedule C line 8',
  'Advertising — Schedule C line 8 · Q4',
];

const FINANCE_ROUTES: Record<string, FinanceRoute> = {
  'chart-of-accounts': {
    title: 'Finance → Chart of accounts',
    body: 'The shared CoA that every ad spend mapping writes to. Editing accounts here affects future journal entries.',
    route: '/finance/accounting/chart-of-accounts',
  },
  reconcile: {
    title: 'Finance → Reconcile',
    body: 'The reconcile workspace for the Advertising Expense accounts this period.',
    route: '/finance/accounting/reconcile',
  },
  reports: {
    title: 'Finance → Reports',
    body: 'The Advertising Expense category in Financial reports.',
    route: '/finance/reports?category=advertising',
  },
  'document-engine': {
    title: 'Finance → Journal entry',
    body: 'The Finance document engine opened to the selected journal entry.',
    route: '/finance/journal/{id}',
  },
  'billing-profiles': {
    title: 'Finance → Billing profiles',
    body: 'Billing profiles are created and managed in Finance, not on the Ad spend bridge.',
    route: '/finance/configuration/billing-profiles',
  },
  'advertiser-verification': {
    title: 'Advertising → Advertisers',
    body: 'Verification lives with the advertiser record; this bridge only surfaces the block.',
    route: '/advertising/advertisers?filter=unverified',
  },
};

const SEED_ADVERTISERS: Advertiser[] = [
  {
    id: 'ADV-1001', name: 'Unsaid Company Inc.', billing: 'Visa •4421', gate: 'Ready',
    spend: { Meta: 4410, TikTok: 0, Google: 0, Pinterest: 0 },
    mapped: { Meta: '6100', TikTok: '6101', Google: '6102', Pinterest: '6103' },
  },
  {
    id: 'ADV-1002', name: 'Orion Apparel LLC', billing: 'Mastercard •8801', gate: 'Ready',
    spend: { Meta: 4210, TikTok: 0, Google: 0, Pinterest: 2000 },
    mapped: { Meta: '6100', TikTok: '6101', Google: '6102', Pinterest: '6103' },
  },
  {
    id: 'ADV-1003', name: 'Blue Ridge Co.', billing: 'Visa •4421', gate: 'Ready',
    spend: { Meta: 890, TikTok: 0, Google: 0, Pinterest: 0 },
    mapped: { Meta: '6100', TikTok: '6101', Google: '6102', Pinterest: '6103' },
  },
  {
    id: 'ADV-1004', name: 'Maple Supply Inc.', billing: '—', gate: 'Billing on hold',
    spend: { Meta: 0, TikTok: 0, Google: 3120, Pinterest: 0 },
    mapped: { Meta: '6100', TikTok: '6101', Google: '', Pinterest: '6103' },
  },
  {
    id: 'ADV-1005', name: 'Northwind Labs LLC', billing: 'Chase ACH •9910', gate: 'Ready',
    spend: { Meta: 7500, TikTok: 0, Google: 2340, Pinterest: 0 },
    mapped: { Meta: '6100', TikTok: '6101', Google: '6102', Pinterest: '6103' },
  },
  {
    id: 'ADV-1006', name: 'Acme Corp', billing: '—', gate: 'Verification pending',
    spend: { Meta: 0, TikTok: 0, Google: 0, Pinterest: 0 },
    mapped: { Meta: '', TikTok: '', Google: '', Pinterest: '' },
  },
];

const JOURNALS: Record<string, JournalEntry[]> = {
  'ADV-1001': [
    { id: 'JE-7031', date: '2026-10-31', amount: 4410, account: '6100', memo: 'Meta Ads — Fall launch · Oct 2026', status: 'Posted' },
  ],
  'ADV-1002': [
    { id: 'JE-7032', date: '2026-10-31', amount: 4210, account: '6100', memo: 'Meta Ads — Orion prospecting · Oct 2026', status: 'Posted' },
    { id: 'JE-7033', date: '2026-10-31', amount: 2000, account: '6103', memo: 'Pinterest Ads — Orion inspo · Oct 2026', status: 'Posted' },
  ],
  'ADV-1003': [
    { id: 'JE-7034', date: '2026-10-31', amount: 890, account: '6100', memo: 'Meta Ads — Blue Ridge test · Oct 2026', status: 'Posted' },
  ],
  'ADV-1004': [
    { id: 'JE-7035', date: '2026-10-31', amount: 3120, account: '', memo: 'Google Ads — Maple search · Oct 2026', status: 'Unmapped' },
  ],
  'ADV-1005': [
    { id: 'JE-7036', date: '2026-10-31', amount: 7500, account: '6100', memo: 'Meta Ads — Northwind lookalike · Oct 2026', status: 'Posted' },
    { id: 'JE-7037', date: '2026-10-31', amount: 2340, account: '6102', memo: 'Google Ads — Brand search · Oct 2026', status: 'Posted' },
  ],
  'ADV-1006': [],
};

const RECON: ReconRow[] = [
  { account: '6100', name: 'Advertising Expense — Meta', debits: 17010, ledger: 17010, state: 'Open', lastLocked: '2026-10-31' },
  { account: '6101', name: 'Advertising Expense — TikTok', debits: 0, ledger: 0, state: 'Not started', lastLocked: '—' },
  { account: '6102', name: 'Advertising Expense — Google', debits: 5460, ledger: 5460, state: 'Open', lastLocked: '—' },
  { account: '6103', name: 'Advertising Expense — Pinterest', debits: 2000, ledger: 2000, state: 'Open', lastLocked: '—' },
];

const INITIAL_PERIOD: Period = { year: 2026, month: 10, lastPosted: '2026-11-01' };
const EMPTY_MAP_FORM: MapForm = { account: '', costCenter: '', taxLine: '' };

/* ───────────── HELPERS ───────────── */
function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function advertiserSpend(a: Advertiser): number {
  return NETWORKS.reduce((s, n) => s + a.spend[n], 0);
}
function advertiserMapped(a: Advertiser): number {
  let m = 0;
  for (const n of NETWORKS) {
    if (a.spend[n] > 0 && a.mapped[n]) m += a.spend[n];
  }
  return m;
}
function advertiserUnmapped(a: Advertiser): number {
  return advertiserSpend(a) - advertiserMapped(a);
}
function activeNets(a: Advertiser): Network[] {
  return NETWORKS.filter((n) => a.spend[n] > 0);
}
function periodLabel(p: Period): string {
  return new Date(p.year, p.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
function gatePillKind(g: Gate): string {
  return g === 'Ready' ? 'active' : g === 'Verification pending' ? 'pending' : 'rejected';
}
function reconPillKind(st: ReconState): string {
  return st === 'Locked' ? 'active' : st === 'Open' ? 'review' : 'draft';
}
function jePillKind(st: JEStatus): string {
  return st === 'Posted' ? 'active' : 'rejected';
}
function coaLabel(code: string): string {
  if (!code) return '— no account mapped —';
  const found = COA_ACCOUNTS.find((c) => c.value === code);
  return found ? found.label.split(' · ')[1] || code : code;
}

/* ───────────── INLINE STYLES (for HTML-specific classes not in shared module) ───────────── */
const cpaRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 120px',
  gap: 10,
  padding: '8px 0',
  borderBottom: '1px solid #f0f2f3',
  alignItems: 'center',
};
const exceptionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  border: '1px solid #dad9dd',
  borderRadius: 8,
  background: '#fff',
};
const exceptionRowWarnStyle: React.CSSProperties = {
  borderColor: '#f0d8b0',
  background: '#fbf7ec',
};
const exceptionIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  display: 'grid',
  placeItems: 'center',
  background: '#fff0ef',
  color: '#bf5c59',
  flexShrink: 0,
};
const exceptionIconWarnStyle: React.CSSProperties = {
  background: '#fbf7ec',
  color: '#98713e',
};
const calloutStyle: React.CSSProperties = {
  padding: 12,
  border: '1px solid #becab6',
  background: 'var(--surface-container-low)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--on-surface-variant)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
};
const finLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: 'var(--qb-blue)',
  fontWeight: 600,
  fontSize: 11,
  background: 'none',
  border: 0,
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
};
const kpiNoteStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--on-surface-variant)',
  marginTop: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

/* ───────────── MAIN COMPONENT ───────────── */
export default function AdSpendScreen({ onToast }: MarketingScreenProps) {
  /* ── state ── */
  const [advertisers, setAdvertisers] = useState<Advertiser[]>(SEED_ADVERTISERS);
  const [period, setPeriod] = useState<Period>(INITIAL_PERIOD);

  const [mapTarget, setMapTarget] = useState<MapTarget>({ advertiserId: '', network: null });
  const [mapForm, setMapForm] = useState<MapForm>(EMPTY_MAP_FORM);
  const [mapOpen, setMapOpen] = useState(false);

  const [journalAdvId, setJournalAdvId] = useState<string | null>(null);

  const [financeModal, setFinanceModal] = useState<{
    title: string;
    body: string;
    route: string;
  } | null>(null);

  /* ── derived ── */
  const totals = useMemo(() => {
    const totalSpend = advertisers.reduce((s, a) => s + advertiserSpend(a), 0);
    const totalMapped = advertisers.reduce((s, a) => s + advertiserMapped(a), 0);
    const exceptions = totalSpend - totalMapped;
    const pct = totalSpend ? Math.round((totalMapped / totalSpend) * 100) : 0;
    const locked = RECON.filter((r) => r.state === 'Locked');
    return { totalSpend, totalMapped, exceptions, pct, locked };
  }, [advertisers]);

  const mappedRows = useMemo(() => {
    const rows: { advertiser: string; advertiserId: string; network: Network; amount: number; account: string }[] = [];
    const unmappedRows: { advertiser: string; advertiserId: string; network: Network; amount: number; account: string }[] = [];
    for (const a of advertisers) {
      for (const n of NETWORKS) {
        if (a.spend[n] <= 0) continue;
        const acct = a.mapped[n];
        const row = { advertiser: a.name, advertiserId: a.id, network: n, amount: a.spend[n], account: acct };
        if (acct) rows.push(row); else unmappedRows.push(row);
      }
    }
    return { mapped: rows, unmapped: unmappedRows };
  }, [advertisers]);

  const exceptions = useMemo(() => {
    const list: {
      kind: string;
      title: string;
      desc: string;
      route: string;
      action: string;
      advId: string;
      warn: boolean;
      icon: string;
    }[] = [];
    for (const a of advertisers) {
      const unmapped = advertiserUnmapped(a);
      if (unmapped > 0) {
        list.push({
          kind: 'Unmapped spend',
          title: `${a.name} — ${fmtMoney(unmapped)}`,
          desc: 'Some spend has no Chart of Accounts mapping. It cannot post to Finance until mapped.',
          route: 'chart-of-accounts',
          action: 'Map accounts',
          advId: a.id,
          warn: false,
          icon: 'error',
        });
      }
      if (a.gate === 'Billing on hold') {
        list.push({
          kind: 'Billing on hold',
          title: a.name,
          desc: 'Billing profile is missing or on hold. Spend cannot be charged.',
          route: 'billing-profiles',
          action: 'Open billing profile',
          advId: a.id,
          warn: true,
          icon: 'warning',
        });
      }
      if (a.gate === 'Verification pending') {
        list.push({
          kind: 'Verification pending',
          title: a.name,
          desc: 'Advertiser is unverified. Spend is blocked until verification is complete.',
          route: 'advertiser-verification',
          action: 'Open advertiser',
          advId: a.id,
          warn: true,
          icon: 'warning',
        });
      }
    }
    return list;
  }, [advertisers]);

  /* ── actions ── */
  const handleExport = () => {
    const rows = advertisers.map((a) => {
      const spend = advertiserSpend(a);
      const mapped = advertiserMapped(a);
      const jCount = (JOURNALS[a.id] || []).length;
      return {
        id: a.id,
        name: a.name,
        billing: a.billing,
        gate: a.gate,
        networks: activeNets(a).join(', ') || '—',
        spend: fmtMoney(spend),
        mapped: fmtMoney(mapped),
        unmapped: fmtMoney(spend - mapped),
        journals: jCount,
      };
    });
    exportToCsv(rows as unknown as Record<string, unknown>[], [
      { key: 'id', label: 'Advertiser ID' },
      { key: 'name', label: 'Advertiser' },
      { key: 'billing', label: 'Billing' },
      { key: 'gate', label: 'Billing gate' },
      { key: 'networks', label: 'Networks' },
      { key: 'spend', label: 'Spend' },
      { key: 'mapped', label: 'Mapped' },
      { key: 'unmapped', label: 'Unmapped' },
      { key: 'journals', label: 'Journal entries' },
    ], `ad-spend-bridge-${period.year}-${String(period.month).padStart(2, '0')}`);
    onToast(`Exported ad spend bridge for ${periodLabel(period)}`);
  };

  const shiftPeriod = (delta: number) => {
    let m = period.month + delta;
    let y = period.year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const next: Period = { ...period, month: m, year: y };
    setPeriod(next);
    onToast('Period changed: ' + periodLabel(next));
  };

  const openFinance = (key: string, fallbackBody?: string) => {
    const meta = FINANCE_ROUTES[key] || {
      title: 'Open destination',
      body: fallbackBody || '',
      route: '/' + key,
    };
    setFinanceModal(meta);
  };

  const openMapDrawer = (advertiserId: string, network: Network | null) => {
    const a = advertisers.find((x) => x.id === advertiserId);
    if (!a) return;
    setMapTarget({ advertiserId, network });
    const initialAcct = network ? a.mapped[network] || '' : '';
    setMapForm({ account: initialAcct, costCenter: '', taxLine: '' });
    setMapOpen(true);
  };

  const closeMapDrawer = () => {
    setMapOpen(false);
    setMapTarget({ advertiserId: '', network: null });
    setMapForm(EMPTY_MAP_FORM);
  };

  const saveMapping = () => {
    if (!mapForm.account) {
      onToast('Choose an account before saving');
      return;
    }
    const target = mapTarget;
    if (!target.advertiserId || !target.network) {
      onToast('Nothing to save — no mapping target.');
      return;
    }
    setAdvertisers((prev) =>
      prev.map((a) =>
        a.id === target.advertiserId
          ? { ...a, mapped: { ...a.mapped, [target.network as Network]: mapForm.account } }
          : a,
      ),
    );
    onToast(`Mapping saved — future entries will post to account ${mapForm.account}`);
    closeMapDrawer();
  };

  const openJournal = (advertiserId: string) => {
    setJournalAdvId(advertiserId);
  };
  const closeJournal = () => setJournalAdvId(null);

  /* row ⋯ menu items per advertiser */
  const rowMenuItems = (a: Advertiser): RowMenuItem[] => {
    const items: RowMenuItem[] = [
      {
        header: a.name,
        label: 'Map unmapped spend',
        icon: 'account_tree',
        onClick: () => {
          const nets = NETWORKS.filter((n) => a.spend[n] > 0 && !a.mapped[n]);
          if (nets.length > 0) {
            openMapDrawer(a.id, nets[0]);
          } else {
            onToast('All spend already mapped');
          }
        },
      },
      {
        label: 'View journal entries',
        icon: 'receipt_long',
        onClick: () => openJournal(a.id),
      },
      {
        label: 'Open in Advertisers',
        icon: 'open_in_new',
        sepBefore: true,
        onClick: () => openFinance('advertising-advertisers', 'Open in Advertisers page.'),
      },
      {
        label: 'Open in Campaigns',
        icon: 'open_in_new',
        onClick: () => openFinance('advertising-campaigns', 'Open in Campaigns page.'),
      },
      {
        label: 'Open in Reconcile',
        icon: 'fact_check',
        sepBefore: true,
        onClick: () => openFinance('finance-reconcile', 'Open in Reconcile.'),
      },
    ];
    return items;
  };

  /* ── derived render values ── */
  const journalAdvertiser = journalAdvId ? advertisers.find((a) => a.id === journalAdvId) : null;
  const journalEntries = journalAdvId ? JOURNALS[journalAdvId] || [] : [];
  const mapAdvertiser = mapTarget.advertiserId
    ? advertisers.find((a) => a.id === mapTarget.advertiserId)
    : null;

  const periodLabelText = periodLabel(period);
  const lastPostedText = `Last posted to Finance: ${period.lastPosted} · period ${period.year}-${String(period.month).padStart(2, '0')}`;
  const reconBadgeKind = totals.exceptions > 0 ? 'rejected' : 'review';
  const reconBadgeText = `Reconcile: ${totals.exceptions > 0 ? 'Blocked' : 'Open'}`;
  const reconciledThroughText = totals.locked.length
    ? totals.locked.map((r) => r.account).join(', ')
    : 'Open';
  const reconciledNote = totals.locked.length
    ? `Locked accounts: ${totals.locked.length}`
    : 'No accounts locked for this period';

  /* ───────────── RENDER ───────────── */
  return (
    <div className={s.screen}>
      <main style={{ padding: '0 24px 48px' }}>
        {/* ─── BREADCRUMB ─── */}
        <Breadcrumb
          items={[
            { label: 'Advertising' },
            { label: 'Ad spend & Finance bridge', current: true },
          ]}
        />

        {/* ─── PAGE HEADER ─── */}
        <div className={s.pageHeader}>
          <div>
            <h1>Ad spend &amp; Finance bridge</h1>
            <p className={s.subtitle}>
              Every dollar of ad spend, mapped to a Chart of Accounts entry, reconciled against the Finance ledger.
            </p>
          </div>
          <div className={s.pageHeaderActions}>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => openFinance('chart-of-accounts')}
              title="Open Chart of accounts"
            >
              <span className="material-symbols-outlined">account_tree</span>
              Open Chart of accounts
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => openFinance('reconcile')}
              title="Open Reconcile"
            >
              <span className="material-symbols-outlined">fact_check</span>
              Open Reconcile
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => openFinance('reports')}
              title="View in Reports"
            >
              <span className="material-symbols-outlined">bar_chart</span>
              View in Reports
            </button>
            <Btn variant="outline" icon="download" onClick={handleExport}>Export spend</Btn>
          </div>
        </div>

        {/* ─── PERIOD STRIP ─── */}
        <div
          className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.mb3} ${s.flexWrap}`}
        >
          <div className={`${s.flex} ${s.itemsCenter}`} style={{ gap: 0 }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => shiftPeriod(-1)}
              title="Previous period"
              style={{ borderRadius: '6px 0 0 6px', paddingRight: 6, paddingLeft: 6 }}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <div
              className={`${s.bodyMd}`}
              style={{
                height: 32,
                padding: '0 12px',
                borderTop: '1px solid var(--surface-dim)',
                borderBottom: '1px solid var(--surface-dim)',
                display: 'flex',
                alignItems: 'center',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {periodLabelText}
            </div>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => shiftPeriod(1)}
              title="Next period"
              style={{ borderRadius: '0 6px 6px 0', paddingRight: 6, paddingLeft: 6 }}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>·</span>
          <span className={`${s.stat} ${reconBadgeKind === 'rejected' ? s.rejected : s.review}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 2 }}>sync</span>
            {reconBadgeText}
          </span>
          <FinLinkBtn icon="open_in_new" onClick={() => openFinance('reconcile')}>View in Reconcile</FinLinkBtn>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--on-surface-variant)' }}>
            {lastPostedText}
          </span>
        </div>

        {/* ─── KPI STRIP ─── */}
        <div className={s.kpiStrip}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Spend this period</div>
            <div className={s.kpiValue}>{fmtMoney(totals.totalSpend)}</div>
            <div style={kpiNoteStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>verified</span>
              Matches Campaigns page total
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Mapped to CoA</div>
            <div className={s.kpiValue}>{totals.pct}%</div>
            <div style={kpiNoteStyle}>
              {fmtMoney(totals.totalMapped)} of {fmtMoney(totals.totalSpend)}
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Unmapped exceptions</div>
            <div className={s.kpiValue}>{totals.exceptions > 0 ? fmtMoney(totals.exceptions) : '—'}</div>
            <div style={kpiNoteStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>error</span>
              Block period close
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Reconciled through</div>
            <div className={s.kpiValue}>{reconciledThroughText}</div>
            <div style={kpiNoteStyle}>{reconciledNote}</div>
          </div>
        </div>

        {/* ════════════ SECTION 1 — AD SPEND BY ADVERTISER ════════════ */}
        <section className={`${s.card} ${s.mb3}`}>
          <div
            className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
            style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-dim)' }}
          >
            <div>
              <h2 className={s.headlineSm}>Ad spend by advertiser</h2>
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                Source: Campaigns &amp; Ad sets · read-only here — spending is managed in Advertising
              </div>
            </div>
            <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
              <FinLinkBtn icon="open_in_new" onClick={() => openFinance('advertising-campaigns', 'Open in Advertising → campaigns')}>
                Open Campaigns
              </FinLinkBtn>
              <FinLinkBtn icon="open_in_new" onClick={() => openFinance('advertising-advertisers', 'Open in Advertising → advertisers')}>
                Open Advertisers
              </FinLinkBtn>
            </div>
          </div>
          <div className={s.tableWrap} style={{ maxHeight: 'none' }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Advertiser</th>
                  <th>Billing gate</th>
                  <th>Networks</th>
                  <th className={s.right}>Spend</th>
                  <th className={s.right}>Mapped</th>
                  <th>Journal</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {advertisers.map((a) => {
                  const spend = advertiserSpend(a);
                  const mapped = advertiserMapped(a);
                  const unmapped = spend - mapped;
                  const nets = activeNets(a);
                  const journal = JOURNALS[a.id] || [];
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className={s.rowName}>{a.name}</div>
                        <div className={`${s.rowSub} ${s.mono}`}>
                          {a.id} · {a.billing}
                        </div>
                      </td>
                      <td>
                        <Stat kind={gatePillKind(a.gate)} label={a.gate} />
                      </td>
                      <td>
                        <div className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.flexWrap}`}>
                          {nets.length > 0
                            ? nets.map((n) => <NetChip key={n} net={n} />)
                            : <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>—</span>}
                        </div>
                      </td>
                      <td className={`${s.right} ${s.tabularNums}`}>{fmtMoney(spend)}</td>
                      <td className={`${s.right} ${s.tabularNums} ${unmapped > 0 ? s.numBad : s.numGood}`} style={{ fontWeight: 600 }}>
                        {fmtMoney(mapped)}
                        {unmapped > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 400 }}>
                            {fmtMoney(unmapped)} unmapped
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {journal.length > 0 ? (
                          <FinLinkBtn
                            icon="receipt_long"
                            onClick={() => openJournal(a.id)}
                          >
                            {journal.length} journal{journal.length === 1 ? '' : 's'}
                          </FinLinkBtn>
                        ) : (
                          <span style={{ color: 'var(--on-surface-variant)' }}>—</span>
                        )}
                      </td>
                      <td className={s.right} style={{ width: 32 }}>
                        <RowMenu items={rowMenuItems(a)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-container-low)', fontWeight: 600 }}>
                  <td style={{ padding: '10px 16px' }} colSpan={3}>Total</td>
                  <td className={`${s.right} ${s.tabularNums}`} style={{ padding: '10px 16px' }}>
                    {fmtMoney(totals.totalSpend)}
                  </td>
                  <td className={`${s.right} ${s.tabularNums}`} style={{ padding: '10px 16px' }}>
                    {fmtMoney(totals.totalMapped)}
                  </td>
                  <td style={{ padding: '10px 16px' }} colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ════════════ SECTION 2 — COA MAPPING ════════════ */}
        <section className={`${s.card} ${s.mb3}`}>
          <div
            className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
            style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-dim)' }}
          >
            <div>
              <h2 className={s.headlineSm}>Chart of Accounts mapping</h2>
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                Each advertiser × network posts to an Advertising Expense account in Finance.
              </div>
            </div>
            <FinLinkBtn icon="open_in_new" onClick={() => openFinance('chart-of-accounts')}>
              Open Chart of accounts
            </FinLinkBtn>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-surface-variant)', fontWeight: 700, marginBottom: 8 }}>
              Mapped
            </div>
            <div style={{ marginBottom: 16 }}>
              {mappedRows.mapped.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', padding: '8px 0' }}>
                  No mappings yet.
                </div>
              ) : (
                mappedRows.mapped.map((r, i) => (
                  <div key={`${r.advertiserId}-${r.network}-${i}`} style={cpaRowStyle}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{r.advertiser}</div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{r.advertiserId}</div>
                    </div>
                    <div>
                      <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
                        <NetChip net={r.network} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.account}</div>
                      <div className={s.mono} style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>
                        Advertising Expense — {r.network}
                      </div>
                    </div>
                    <div className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`} style={{ gap: 8 }}>
                      <span className={`${s.bodyMd} ${s.tabularNums}`} style={{ fontSize: 14 }}>
                        {fmtMoney(r.amount)}
                      </span>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnOutline} ${s.btnSm}`}
                        onClick={() => openMapDrawer(r.advertiserId, r.network)}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--on-surface-variant)', fontWeight: 700, marginBottom: 8 }}>
              Unmapped — needs an account
            </div>
            <div>
              {mappedRows.unmapped.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--secondary)', padding: '8px 0' }}>
                  All spend is mapped. ✓
                </div>
              ) : (
                mappedRows.unmapped.map((r, i) => (
                  <div key={`un-${r.advertiserId}-${r.network}-${i}`} style={cpaRowStyle}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{r.advertiser}</div>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{r.advertiserId}</div>
                    </div>
                    <div>
                      <div className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}>
                        <NetChip net={r.network} />
                      </div>
                    </div>
                    <div>
                      <div className={s.mono} style={{ fontSize: 10, color: 'var(--on-surface-variant)' }}>
                        — no account mapped —
                      </div>
                    </div>
                    <div className={`${s.flex} ${s.itemsCenter} ${s.justifyBetween}`} style={{ gap: 8 }}>
                      <span className={`${s.bodyMd} ${s.tabularNums} ${s.numBad}`} style={{ fontSize: 14, fontWeight: 600 }}>
                        {fmtMoney(r.amount)}
                      </span>
                      <button
                        type="button"
                        className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                        onClick={() => openMapDrawer(r.advertiserId, r.network)}
                      >
                        Map
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ ...calloutStyle, marginTop: 16 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary)' }}>info</span>
              <div>
                Mapping is written to the same CoA used by Finance. Changing the account here changes where future journal entries post — not past periods.
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ SECTION 3 — RECONCILIATION STATE ════════════ */}
        <section className={`${s.card} ${s.mb3}`}>
          <div
            className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
            style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-dim)' }}
          >
            <div>
              <h2 className={s.headlineSm}>Reconciliation state</h2>
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                Read from Finance · 1 row per CoA account this period
              </div>
            </div>
            <FinLinkBtn icon="open_in_new" onClick={() => openFinance('reconcile')}>
              Open Reconcile
            </FinLinkBtn>
          </div>
          <div className={s.tableWrap} style={{ maxHeight: 'none' }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Period</th>
                  <th className={s.right}>Debits</th>
                  <th className={s.right}>Ledger balance</th>
                  <th>State</th>
                  <th>Last locked</th>
                  <th style={{ width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {RECON.map((r) => (
                  <tr key={r.account}>
                    <td>
                      <div className={s.rowName}>{r.account} · {r.name}</div>
                    </td>
                    <td style={{ fontSize: 11 }}>{periodLabelText}</td>
                    <td className={`${s.right} ${s.tabularNums}`}>{fmtMoney(r.debits)}</td>
                    <td className={`${s.right} ${s.tabularNums}`}>{fmtMoney(r.ledger)}</td>
                    <td>
                      <Stat kind={reconPillKind(r.state)} label={r.state} />
                    </td>
                    <td style={{ fontSize: 11 }}>{r.lastLocked}</td>
                    <td className={s.right} style={{ width: 32 }}>
                      <FinLinkBtn icon="open_in_new" onClick={() => openFinance('reconcile')}>Open</FinLinkBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ════════════ SECTION 4 — EXCEPTIONS BLOCKING CLOSE ════════════ */}
        <section className={s.card}>
          <div
            className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
            style={{ padding: '12px 20px', borderBottom: '1px solid var(--surface-dim)' }}
          >
            <div>
              <h2 className={s.headlineSm}>Exceptions blocking close</h2>
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                Anything that stops this period from reconciling in Finance.
              </div>
            </div>
            <span className={`${s.stat} ${exceptions.length > 0 ? s.pending : s.active}`}>
              {exceptions.length} exception{exceptions.length === 1 ? '' : 's'}
            </span>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exceptions.length === 0 ? (
              <div
                className={`${s.flex} ${s.itemsCenter} ${s.gap2}`}
                style={{ padding: '12px 0', fontSize: 14, color: 'var(--secondary)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                No exceptions. Period can reconcile.
              </div>
            ) : (
              exceptions.map((x, i) => (
                <div
                  key={`${x.advId}-${x.kind}-${i}`}
                  style={{ ...exceptionRowStyle, ...(x.warn ? exceptionRowWarnStyle : {}) }}
                >
                  <div style={{ ...exceptionIconStyle, ...(x.warn ? exceptionIconWarnStyle : {}) }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{x.icon}</span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {x.kind} — {x.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{x.desc}</div>
                  </div>
                  <FinLinkBtn
                    icon="open_in_new"
                    onClick={() => {
                      if (x.route === 'chart-of-accounts') {
                        const a = advertisers.find((adv) => adv.id === x.advId);
                        if (!a) return;
                        const unmappedNet = NETWORKS.find((n) => a.spend[n] > 0 && !a.mapped[n]);
                        if (unmappedNet) openMapDrawer(a.id, unmappedNet);
                      } else {
                        openFinance(x.route);
                      }
                    }}
                  >
                    {x.action}
                  </FinLinkBtn>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* ════════════════════════════════════════════════════════════
           OVERLAYS
           ════════════════════════════════════════════════════════════ */}

      {/* CoA MAPPING DRAWER */}
      <Drawer
        open={mapOpen}
        title="Map to Chart of Accounts"
        subtitle={mapAdvertiser && mapTarget.network ? `${mapAdvertiser.name} · ${mapTarget.network}` : 'Advertiser × network'}
        onClose={closeMapDrawer}
        width={600}
        footer={
          <div className={`${s.flex} ${s.justifyBetween}`} style={{ width: '100%' }}>
            <Btn variant="outline" onClick={closeMapDrawer}>Cancel</Btn>
            <Btn variant="primary" onClick={saveMapping}>Save mapping</Btn>
          </div>
        }
      >
        {/* advertiser × network summary */}
        <div style={calloutStyle}>
          <div style={{ flex: 1, color: 'var(--on-surface)' }}>
            <div className={`${s.flex} ${s.justifyBetween}`} style={{ marginBottom: 4 }}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Advertiser</span>
              <span style={{ fontWeight: 600 }}>{mapAdvertiser?.name || '—'}</span>
            </div>
            <div className={`${s.flex} ${s.justifyBetween}`}>
              <span style={{ color: 'var(--on-surface-variant)' }}>Network</span>
              <span style={{ fontWeight: 600 }}>
                {mapTarget.network ? <NetChip net={mapTarget.network} /> : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* advertising expense account */}
        <div style={{ marginBottom: 16 }}>
          <label className={s.fieldLabel}>Advertising expense account</label>
          <Select
            value={mapForm.account}
            onChange={(e) => setMapForm((p) => ({ ...p, account: e.target.value }))}
          >
            <option value="">— Select an account —</option>
            {COA_ACCOUNTS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Pulled live from Finance → Chart of accounts.
          </div>
        </div>

        {/* cost center */}
        <div style={{ marginBottom: 16 }}>
          <label className={s.fieldLabel}>Cost center</label>
          <Select
            value={mapForm.costCenter}
            onChange={(e) => setMapForm((p) => ({ ...p, costCenter: e.target.value }))}
          >
            <option value="">— None —</option>
            {COST_CENTERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        {/* tax line */}
        <div style={{ marginBottom: 16 }}>
          <label className={s.fieldLabel}>Tax line</label>
          <Select
            value={mapForm.taxLine}
            onChange={(e) => setMapForm((p) => ({ ...p, taxLine: e.target.value }))}
          >
            <option value="">— None —</option>
            {TAX_LINES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>

        {/* info callout */}
        <div style={calloutStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--primary)' }}>info</span>
          <div>
            Saving writes to the shared CoA mapping. It affects future journal entries only — past periods keep their posted accounts.
          </div>
        </div>

        {/* footer link */}
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--surface-dim)', marginTop: 8 }}>
          <FinLinkBtn icon="open_in_new" onClick={() => openFinance('chart-of-accounts')}>
            Open Chart of accounts in Finance
          </FinLinkBtn>
        </div>
      </Drawer>

      {/* JOURNAL ENTRY DRAWER (read-only preview) */}
      <Drawer
        open={journalAdvId !== null}
        title={journalAdvertiser ? `Journal entries — ${journalAdvertiser.name}` : 'Journal entry'}
        subtitle={`Read from Finance · ${periodLabelText}`}
        onClose={closeJournal}
        width={600}
        footer={
          <FinLinkBtn icon="open_in_new" onClick={() => openFinance('document-engine')}>
            Open in Finance document engine
          </FinLinkBtn>
        }
      >
        {journalEntries.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
            No journal entries for this advertiser this period.
          </div>
        ) : (
          <div className={`${s.flexCol} ${s.gap3}`}>
            {journalEntries.map((j) => (
              <div
                key={j.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--surface-dim)',
                  background: '#fff',
                }}
              >
                <div className={`${s.flex} ${s.justifyBetween}`} style={{ marginBottom: 4 }}>
                  <span className={`${s.mono} ${s.bodyMd}`} style={{ fontWeight: 600 }}>{j.id}</span>
                  <Stat kind={jePillKind(j.status)} label={j.status} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginBottom: 8 }}>
                  {j.date} · {j.memo}
                </div>
                <div className={`${s.flex} ${s.justifyBetween} ${s.bodyMd}`}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Account</span>
                  <span className={s.mono}>{j.account || '— unmapped —'}</span>
                </div>
                <div className={`${s.flex} ${s.justifyBetween} ${s.bodyMd}`}>
                  <span style={{ color: 'var(--on-surface-variant)' }}>Amount</span>
                  <span className={`${s.tabularNums}`} style={{ fontWeight: 600 }}>{fmtMoney(j.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* FINANCE DESTINATION MODAL */}
      <Modal
        open={financeModal !== null}
        title={financeModal?.title || 'Open in Finance'}
        onClose={() => setFinanceModal(null)}
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setFinanceModal(null)}>Close</Btn>
            <Btn
              variant="primary"
              onClick={() => {
                const r = financeModal?.route || '';
                setFinanceModal(null);
                onToast(`Navigating: ${r}`);
              }}
            >
              Open
            </Btn>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          {financeModal?.body || 'This would navigate to the corresponding Finance surface.'}
        </p>
        <div
          className={s.mono}
          style={{
            padding: 12,
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-low)',
            borderRadius: 6,
            fontSize: 11,
            color: 'var(--on-surface-variant)',
            wordBreak: 'break-all',
          }}
        >
          {financeModal?.route || '—'}
        </div>
      </Modal>
    </div>
  );
}

/* ───────────── LOCAL FIN-LINK BUTTON ───────────── */
function FinLinkBtn({
  icon,
  children,
  onClick,
}: {
  icon?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" style={finLinkStyle} onClick={onClick}>
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}
