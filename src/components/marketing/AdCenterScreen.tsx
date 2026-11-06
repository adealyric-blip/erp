'use client';

/**
 * AdCenterScreen — 1:1 faithful port of adcenter.html.
 *
 * Source HTML: /home/z/my-project/upload/marketing_extracted/Marketing/adcenter.html
 * 1376 lines — the LARGEST marketing HTML. Every section, button, menu item,
 * column, KPI, dropdown option, modal field and drawer field replicated.
 *
 * Sections replicated (in DOM order):
 *   1. Domain tabstrip (12 marketing tabs — "Advertising" active)
 *   2. Header (breadcrumb Marketing/Advertising, title, subtitle, view
 *      toggle Overview/Campaigns/Creatives/Audiences, Export button,
 *      Tracking pixels button, New campaign split button)
 *   3. KPI strip (4 cards: Spend 30d, ROAS, Impressions 30d, Active campaigns)
 *   4. Create actions row (Campaign / Ad set / Creative / Audience / Pixel / Show all)
 *   5. OVERVIEW VIEW
 *      - Spend & revenue card (3 mini KPIs, spend/revenue bars, CPC/CPM/Conv rate,
 *        30d/7d/90d range toggle)
 *      - Spend by network card (per-network bars)
 *      - Top-performing ad sets table (7 cols, ranked by revenue, click → peek)
 *   6. CAMPAIGNS VIEW
 *      - Status tabs (All/Active/Paused/In review/Draft/Ended)
 *      - Filter bar (search, Network dropdown, Date range, Saved views, count)
 *      - Active filter chips row
 *      - Bulk bar (navy: Pause/Resume/Duplicate/Archive/Clear)
 *      - Table (checkbox, Campaign, Network, Objective, Budget/daily,
 *        Spend/30d, ROAS, Schedule, Status, ⋯)
 *      - Empty state with Clear filters + New campaign
 *      - Pagination (rows-per-page select 75/100/150, prev/next, page label)
 *   7. CREATIVES VIEW
 *      - Header (search, type select All/Image/Video/Carousel, Upload)
 *      - Responsive grid (2/3/4 cols) of creative cards
 *   8. AUDIENCES VIEW
 *      - Header (subtitle, New audience button)
 *      - Table (Audience, Type, Source, Size, Used in, Updated, ⋯)
 *   9. PEEK drawer (status pill + network logo, mini 3-cell KPI, KV list,
 *      action grid Edit/Duplicate/Pause/Resume)
 *  10. Row ⋯ menu (Edit campaign / View details / Duplicate / Pause / Resume / Delete)
 *  11. Campaign editor drawer (basics w/ network picker grid, budget & schedule,
 *      ad sets w/ inline audience/placement/bid selects, creative selection w/
 *      picker modal, Save and new + Save and close split footer)
 *  12. Creative picker modal (search, checkbox list)
 *  13. Pixels modal (Meta/TikTok/Google/Pinterest — installed status or Install button)
 *  14. Other-create modal (generic for Ad set/Creative/Audience/Pixel targets)
 *  15. Date range modal (from/to date inputs)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { exportToCsv } from '@/lib/csvExport';
import {
  Breadcrumb,
  PageHeader,
  Btn,
  IconBtn,
  SplitButton,
  KpiStrip,
  KpiCard,
  FilterDropdown,
  Scrim,
  Modal,
  Field,
  Input,
  Select as FieldSelect,
  MarketingScreenProps,
} from './MarketingPrimitives';
import s from './MarketingPrimitives.module.css';

/* ─────────────────────── types ─────────────────────── */
type Status = 'Active' | 'Paused' | 'In review' | 'Draft' | 'Ended';
type Network = 'Meta' | 'TikTok' | 'Google' | 'Pinterest';
type View = 'overview' | 'campaigns' | 'creatives' | 'audiences';
type PerfRange = '30' | '7' | '90';
type CreativeType = 'Image' | 'Video' | 'Carousel';
type BudgetType = 'Daily' | 'Lifetime';

interface AdSet {
  name: string;
  audience: string;
  placement: string;
  bid: string;
}

interface Creative {
  id: string;
  name: string;
  type: CreativeType;
  dimensions: string;
  usedIn: number;
}

interface Audience {
  id: string;
  name: string;
  type: string;
  source: string;
  size: string;
  usedIn: number;
  updated: string;
}

interface Campaign {
  id: string;
  name: string;
  network: Network;
  objective: string;
  budget: number;
  budgetType: BudgetType;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  schedule: string;
  start: string | null;
  end: string | null;
  status: Status;
  adSets: number;
  creatives: string[];
}

/* ─────────────────────── constants ─────────────────────── */
const DOMAIN_TABS: { id: string; label: string }[] = [
  { id: 'overview',   label: 'Publishing Overview' },
  { id: 'calendar',   label: 'Calendar' },
  { id: 'queue',      label: 'Queue' },
  { id: 'create',     label: 'Create Content' },
  { id: 'library',    label: 'Content Library' },
  { id: 'channels',   label: 'Connected Channels' },
  { id: 'performance', label: 'Performance' },
  { id: 'oversight',  label: 'Oversight' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'automation', label: 'Automation' },
  { id: 'advertising', label: 'Advertising' },
];

const NETWORKS: Network[] = ['Meta', 'TikTok', 'Google', 'Pinterest'];

const NETWORK_PROVIDER: Record<
  Network,
  { letter: string; bg: string; fg: string; name: string; blurb: string }
> = {
  Meta:      { letter: 'M', bg: '#edf3fc', fg: '#4b77b8', name: 'Meta Ads',      blurb: 'Facebook + Instagram' },
  TikTok:    { letter: 'T', bg: '#eef1f2', fg: '#27353a', name: 'TikTok Ads',    blurb: 'In-feed, Spark' },
  Google:    { letter: 'G', bg: '#f8f0ee', fg: '#c45c5b', name: 'Google Ads',    blurb: 'Search, Shopping, PMax' },
  Pinterest: { letter: 'P', bg: '#f9eeee', fg: '#bd5558', name: 'Pinterest Ads', blurb: 'Promoted Pins' },
};

const OBJECTIVE_OPTIONS = [
  'Conversions',
  'Traffic',
  'Awareness',
  'Engagement',
  'Lead generation',
  'Catalog sales',
];

const AUDIENCES_LIST = [
  'Site visitors 30d',
  'Abandoned cart 7d',
  'Lookalike — VIPs',
  'TikTok engagement 90d',
  'New customers',
];

const PLACEMENTS = ['Auto', 'Feed', 'Stories / Reels', 'Search'];
const BIDS = ['Lowest cost', 'Cost cap', 'ROAS goal'];
const BUDGET_TYPES: BudgetType[] = ['Daily', 'Lifetime'];
const TABS = ['All', 'Active', 'Paused', 'In review', 'Draft', 'Ended'];
const CREATIVE_TYPE_OPTIONS = ['All types', 'Image', 'Video', 'Carousel'];
const ROWS_PER_PAGE_OPTIONS = [75, 100, 150];

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 'ac1', name: 'Fall launch — Prospecting', network: 'Meta', objective: 'Conversions', budget: 250, budgetType: 'Daily', spend: 8620, revenue: 36720, roas: 4.26, ctr: 2.1, schedule: '2026-10-15 → 2026-11-30', start: '2026-10-15T00:00', end: '2026-11-30T23:59', status: 'Active', adSets: 3, creatives: ['cr-001', 'cr-002'] },
  { id: 'ac2', name: 'TikTok creator drop', network: 'TikTok', objective: 'Engagement', budget: 180, budgetType: 'Daily', spend: 4210, revenue: 12890, roas: 3.06, ctr: 3.4, schedule: '2026-10-20 → 2026-11-20', start: '2026-10-20T00:00', end: '2026-11-20T23:59', status: 'Active', adSets: 2, creatives: ['cr-003'] },
  { id: 'ac3', name: 'Brand search — Non-brand', network: 'Google', objective: 'Traffic', budget: 120, budgetType: 'Daily', spend: 2310, revenue: 9280, roas: 4.02, ctr: 5.2, schedule: '2026-10-01 → 2026-12-31', start: '2026-10-01T00:00', end: '2026-12-31T23:59', status: 'Active', adSets: 1, creatives: ['cr-004'] },
  { id: 'ac4', name: 'Holiday capsule lookalike', network: 'Meta', objective: 'Conversions', budget: 300, budgetType: 'Daily', spend: 3280, revenue: 14840, roas: 4.53, ctr: 2.8, schedule: '2026-11-05 → 2026-12-24', start: '2026-11-05T00:00', end: '2026-12-24T23:59', status: 'In review', adSets: 2, creatives: ['cr-005'] },
  { id: 'ac5', name: 'Pinterest — Evergreen inspo', network: 'Pinterest', objective: 'Awareness', budget: 80, budgetType: 'Daily', spend: 0, revenue: 0, roas: 0, ctr: 0, schedule: '—', start: null, end: null, status: 'Draft', adSets: 0, creatives: [] },
  { id: 'ac6', name: 'Summer clearance (ended)', network: 'Meta', objective: 'Conversions', budget: 200, budgetType: 'Daily', spend: 12400, revenue: 38210, roas: 3.08, ctr: 1.9, schedule: '2026-08-01 → 2026-09-15', start: '2026-08-01T00:00', end: '2026-09-15T23:59', status: 'Ended', adSets: 4, creatives: ['cr-006', 'cr-007'] },
];

const CREATIVES: Creative[] = [
  { id: 'cr-001', name: 'Fall hero — 1x1', type: 'Image', dimensions: '1080x1080', usedIn: 1 },
  { id: 'cr-002', name: 'Fall hero — 4x5', type: 'Image', dimensions: '1080x1350', usedIn: 1 },
  { id: 'cr-003', name: 'TikTok drop — vertical', type: 'Video', dimensions: '1080x1920 · 15s', usedIn: 1 },
  { id: 'cr-004', name: 'Search text — brand', type: 'Image', dimensions: '1200x628', usedIn: 1 },
  { id: 'cr-005', name: 'Holiday capsule teaser', type: 'Video', dimensions: '1080x1080 · 6s', usedIn: 0 },
  { id: 'cr-006', name: 'Summer CTA', type: 'Image', dimensions: '1080x1080', usedIn: 1 },
  { id: 'cr-007', name: 'Summer carousel', type: 'Carousel', dimensions: '1080x1080 x3', usedIn: 1 },
  { id: 'cr-008', name: 'Evergreen tote', type: 'Image', dimensions: '1080x1350', usedIn: 0 },
];

const AUDIENCES: Audience[] = [
  { id: 'au1', name: 'Site visitors 30d', type: 'Retargeting', source: 'Meta Pixel', size: '~ 12.4K', usedIn: 2, updated: '2026-11-01' },
  { id: 'au2', name: 'Abandoned cart 7d', type: 'Retargeting', source: 'Shopify + Meta', size: '~ 2.1K', usedIn: 1, updated: '2026-11-02' },
  { id: 'au3', name: 'Lookalike — VIPs', type: 'Lookalike 2%', source: 'VIP segment', size: '~ 1.8M', usedIn: 1, updated: '2026-10-28' },
  { id: 'au4', name: 'TikTok engagement 90d', type: 'Retargeting', source: 'TikTok Pixel', size: '~ 42K', usedIn: 1, updated: '2026-10-30' },
  { id: 'au5', name: 'New customers', type: 'Custom', source: 'CRM', size: '~ 312', usedIn: 0, updated: '2026-10-15' },
];

const AD_STATUS: Record<Status, { bg: string; fg: string; icon: string }> = {
  Active:     { bg: '#e9f5ef', fg: '#388064', icon: 'play_arrow' },
  Paused:     { bg: '#fbf5ec', fg: '#98713e', icon: 'pause' },
  Draft:      { bg: '#f2f1f8', fg: '#6e6596', icon: 'edit' },
  Ended:      { bg: '#f1f3f4', fg: '#68747b', icon: 'flag' },
  'In review':{ bg: '#eaf3fb', fg: '#4e7b9d', icon: 'schedule' },
};

/* ─────────────────────── helpers ─────────────────────── */
function ProviderLogo({ net, size = 32 }: { net: Network; size?: number }) {
  const p = NETWORK_PROVIDER[net];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: p.bg,
        color: p.fg,
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.round(size * 0.375),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {p.letter}
    </div>
  );
}

function AdStatusPill({ status }: { status: Status }) {
  const cfg = AD_STATUS[status] || AD_STATUS.Draft;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
        {cfg.icon}
      </span>
      {status}
    </span>
  );
}

function creativeIcon(t: CreativeType): string {
  return t === 'Video' ? 'movie' : t === 'Carousel' ? 'view_carousel' : 'image';
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString();
}

function fmtSchedule(start: string, end: string | null): string {
  if (!start) return '—';
  const s = start.slice(0, 10);
  return end ? `${s} → ${end.slice(0, 10)}` : `${s} → ongoing`;
}

/* ─────────────────────── Local row menu ─────────────────────── */
interface LocalRowMenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  sepBefore?: boolean;
  header?: string;
}

function LocalRowMenu({ items }: { items: LocalRowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className={s.relative} ref={ref} style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Actions"
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}
        >
          more_horiz
        </span>
      </button>
      {open && (
        <div
          className={s.popover}
          style={{ right: 0, left: 'auto', minWidth: 220 }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((it, i) => (
            <div key={i}>
              {it.header && <div className={s.menuHeader}>{it.header}</div>}
              {it.sepBefore && <div className={s.popoverSep} />}
              {it.label && (
                <button
                  type="button"
                  className={`${s.popoverItem} ${it.danger ? 'danger' : ''}`}
                  onClick={() => {
                    it.onClick?.();
                    setOpen(false);
                  }}
                >
                  {it.icon && <span className="material-symbols-outlined">{it.icon}</span>}
                  {it.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── main component ─────────────────────── */
export default function AdCenterScreen({ onToast, onNavigate }: MarketingScreenProps) {
  /* ─── data state ─── */
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);

  /* ─── view state ─── */
  const [view, setView] = useState<View>('overview');
  const [perfRange, setPerfRange] = useState<PerfRange>('30');

  /* ─── creatives filter state (Creatives view) ─── */
  const [creativeSearch, setCreativeSearch] = useState('');
  const [creativeTypeFilter, setCreativeTypeFilter] = useState<string>('All types');

  /* ─── campaign filters state ─── */
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('All');
  const [netFilter, setNetFilter] = useState<Set<string>>(new Set(NETWORKS));
  const [draftNetFilter, setDraftNetFilter] = useState<Set<string>>(new Set(NETWORKS));
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  /* ─── selection state ─── */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ─── peek state ─── */
  const [peekId, setPeekId] = useState<string | null>(null);

  /* ─── drawer state ─── */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftNetwork, setDraftNetwork] = useState<Network | null>(null);
  const [draftObjective, setDraftObjective] = useState<string>('Conversions');
  const [draftBudgetType, setDraftBudgetType] = useState<BudgetType>('Daily');
  const [draftBudget, setDraftBudget] = useState<number>(250);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [draftAdSets, setDraftAdSets] = useState<AdSet[]>([]);
  const [draftCreatives, setDraftCreatives] = useState<string[]>([]);

  /* ─── creative picker modal ─── */
  const [creativeModalOpen, setCreativeModalOpen] = useState(false);
  const [creativePickerSearch, setCreativePickerSearch] = useState('');
  const [creativePickerSel, setCreativePickerSel] = useState<Set<string>>(new Set());

  /* ─── pixels modal ─── */
  const [pixelsOpen, setPixelsOpen] = useState(false);
  const [installedPixels, setInstalledPixels] = useState<Set<string>>(
    new Set(['Meta', 'Google']),
  );

  /* ─── other-create modal ─── */
  const [otherCreateOpen, setOtherCreateOpen] = useState(false);
  const [otherCreateTarget, setOtherCreateTarget] = useState<string>('');

  /* ─── date range modal ─── */
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateFromDraft, setDateFromDraft] = useState('');
  const [dateToDraft, setDateToDraft] = useState('');

  /* ─── pagination ─── */
  const [rowsPerPage, setRowsPerPage] = useState<number>(75);
  const [page, setPage] = useState<number>(1);

  /* ─── derived: filtered campaigns ─── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      const qOK =
        !q || (c.name + ' ' + c.network + ' ' + c.objective).toLowerCase().includes(q);
      const tabOK = tab === 'All' || c.status === tab;
      const netOK = netFilter.has(c.network);
      const dateOK =
        (!dateFrom || (c.start !== null && c.start.slice(0, 10) >= dateFrom)) &&
        (!dateTo || (c.end !== null && c.end.slice(0, 10) <= dateTo));
      return qOK && tabOK && netOK && dateOK;
    });
  }, [campaigns, query, tab, netFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: campaigns.length };
    for (const t of TABS) {
      if (t === 'All') continue;
      c[t] = campaigns.filter((x) => x.status === t).length;
    }
    return c;
  }, [campaigns]);

  const activeCampaignCount = campaigns.filter((c) => c.status === 'Active').length;

  const networkBars = useMemo(() => {
    return NETWORKS.map((n) => {
      const list = campaigns.filter((c) => c.network === n);
      const spend = list.reduce((sum, c) => sum + c.spend, 0);
      return { name: n, spend };
    });
  }, [campaigns]);

  const maxNetworkSpend = Math.max(1, ...networkBars.map((n) => n.spend));

  const topAdSets = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.spend > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [campaigns]);

  const filteredCreatives = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    return CREATIVES.filter((c) => {
      const qOK = !q || c.name.toLowerCase().includes(q);
      const tOK = creativeTypeFilter === 'All types' || c.type === creativeTypeFilter;
      return qOK && tOK;
    });
  }, [creativeSearch, creativeTypeFilter]);

  /* filter chips */
  const chips = useMemo(() => {
    const list: { k: string; label: string }[] = [];
    if (query) list.push({ k: 'q', label: `Search: "${query}"` });
    if (tab !== 'All') list.push({ k: 'tab', label: `Tab: ${tab}` });
    if (netFilter.size !== NETWORKS.length)
      list.push({
        k: 'networks',
        label: `Network: ${[...netFilter].join(', ') || 'none'}`,
      });
    if (dateFrom || dateTo)
      list.push({ k: 'date', label: `Date: ${dateFrom || '…'} → ${dateTo || '…'}` });
    return list;
  }, [query, tab, netFilter, dateFrom, dateTo]);

  const filtersActive = chips.length > 0;

  /* ─── selection helpers ─── */
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const allVisibleChecked =
    pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));
  const someVisibleChecked =
    pageRows.some((c) => selected.has(c.id)) && !allVisibleChecked;
  const toggleAllVisible = (on: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const c of pageRows) {
        if (on) n.add(c.id);
        else n.delete(c.id);
      }
      return n;
    });
  };

  /* ─── peek ─── */
  const openPeek = (id: string) => setPeekId(id);
  const closePeek = () => setPeekId(null);
  const peekCampaign = peekId
    ? campaigns.find((c) => c.id === peekId) ?? null
    : null;

  /* ─── drawer open/close ─── */
  const openCampDrawer = (id: string | null) => {
    setEditingId(id);
    const editing = id ? campaigns.find((c) => c.id === id) ?? null : null;
    if (editing) {
      setDraftName(editing.name);
      setDraftNetwork(editing.network);
      setDraftObjective(editing.objective);
      setDraftBudgetType(editing.budgetType);
      setDraftBudget(editing.budget);
      setDraftStart(editing.start ? editing.start.slice(0, 16) : '');
      setDraftEnd(editing.end ? editing.end.slice(0, 16) : '');
      setDraftAdSets(
        Array.from({ length: editing.adSets }, (_, i) => ({
          name: 'Ad set ' + (i + 1),
          audience: AUDIENCES_LIST[i % AUDIENCES_LIST.length],
          placement: 'Auto',
          bid: 'Lowest cost',
        })),
      );
      setDraftCreatives([...editing.creatives]);
    } else {
      setDraftName('');
      setDraftNetwork(null);
      setDraftObjective('Conversions');
      setDraftBudgetType('Daily');
      setDraftBudget(250);
      const now = new Date().toISOString().slice(0, 16);
      setDraftStart(now);
      setDraftEnd('');
      setDraftAdSets([]);
      setDraftCreatives([]);
    }
    setPeekId(null);
    setDrawerOpen(true);
  };
  const closeCampDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
  };

  /* ─── ad set editing (inline in drawer) ─── */
  const addAdSet = () => {
    setDraftAdSets((prev) => [
      ...prev,
      {
        name: 'Ad set ' + (prev.length + 1),
        audience: AUDIENCES_LIST[0],
        placement: 'Auto',
        bid: 'Lowest cost',
      },
    ]);
  };
  const removeAdSet = (idx: number) => {
    setDraftAdSets((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateAdSet = (idx: number, patch: Partial<AdSet>) => {
    setDraftAdSets((prev) => {
      const n = [...prev];
      n[idx] = { ...n[idx], ...patch };
      return n;
    });
  };

  /* ─── creative picker ─── */
  const openCreativeModal = () => {
    setCreativePickerSel(new Set(draftCreatives));
    setCreativePickerSearch('');
    setCreativeModalOpen(true);
  };
  const toggleCreativePicker = (id: string) => {
    setCreativePickerSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const confirmCreativePicker = () => {
    setDraftCreatives([...creativePickerSel]);
    setCreativeModalOpen(false);
  };
  const filteredPickerCreatives = useMemo(() => {
    const q = creativePickerSearch.trim().toLowerCase();
    if (!q) return CREATIVES;
    return CREATIVES.filter((c) => c.name.toLowerCase().includes(q));
  }, [creativePickerSearch]);

  /* ─── save ─── */
  const collectCampaign = (): Campaign | null => {
    if (!draftName.trim()) {
      onToast('Campaign name is required');
      return null;
    }
    const network: Network = draftNetwork ?? 'Meta';
    const start = draftStart;
    const end = draftEnd || null;
    const editing = editingId
      ? campaigns.find((c) => c.id === editingId) ?? null
      : null;
    return {
      id: editing ? editing.id : 'ac' + Date.now(),
      name: draftName.trim(),
      network,
      objective: draftObjective,
      budget: draftBudget || 0,
      budgetType: draftBudgetType,
      spend: editing ? editing.spend : 0,
      revenue: editing ? editing.revenue : 0,
      roas: editing ? editing.roas : 0,
      ctr: editing ? editing.ctr : 0,
      schedule: start ? fmtSchedule(start, end) : '—',
      start: start || null,
      end,
      status: editing ? editing.status : 'In review',
      adSets: draftAdSets.length,
      creatives: [...draftCreatives],
    };
  };
  const saveAndClose = () => {
    const c = collectCampaign();
    if (!c) return;
    setCampaigns((prev) => {
      if (editingId) {
        const idx = prev.findIndex((x) => x.id === editingId);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = c;
          return n;
        }
      }
      return [c, ...prev];
    });
    closeCampDrawer();
    onToast(editingId ? 'Campaign updated' : 'Campaign created');
  };
  const saveAndNew = () => {
    const c = collectCampaign();
    if (!c) return;
    setCampaigns((prev) => {
      if (editingId) {
        const idx = prev.findIndex((x) => x.id === editingId);
        if (idx >= 0) {
          const n = [...prev];
          n[idx] = c;
          return n;
        }
      }
      return [c, ...prev];
    });
    // reset draft for another new campaign
    setEditingId(null);
    setDraftName('');
    setDraftNetwork(null);
    setDraftObjective('Conversions');
    setDraftBudgetType('Daily');
    setDraftBudget(250);
    const now = new Date().toISOString().slice(0, 16);
    setDraftStart(now);
    setDraftEnd('');
    setDraftAdSets([]);
    setDraftCreatives([]);
    onToast('Saved. New campaign form ready.');
  };

  /* ─── row actions ─── */
  const duplicateCampaign = (c: Campaign) => {
    const copy: Campaign = {
      ...c,
      id: 'ac' + Date.now(),
      name: c.name + ' (copy)',
      status: 'Draft',
      spend: 0,
      revenue: 0,
      roas: 0,
      ctr: 0,
      schedule: '—',
      start: null,
      end: null,
    };
    setCampaigns((prev) => [copy, ...prev]);
    onToast('Duplicated');
  };
  const setStatus = (id: string, status: Status, verb: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    setCampaigns((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status } : x)),
    );
    onToast(verb);
  };
  const deleteCampaign = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    if (!window.confirm('Delete campaign?')) return;
    setCampaigns((prev) => prev.filter((x) => x.id !== id));
    onToast('Deleted');
  };

  const rowMenuItems = (c: Campaign): LocalRowMenuItem[] => [
    { header: c.id },
    { label: 'Edit campaign', icon: 'edit', onClick: () => openCampDrawer(c.id) },
    { label: 'View details', icon: 'visibility', onClick: () => openPeek(c.id) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => duplicateCampaign(c) },
    { label: 'Pause', icon: 'pause_circle', sepBefore: true, onClick: () => setStatus(c.id, 'Paused', 'Paused') },
    { label: 'Resume', icon: 'play_circle', onClick: () => setStatus(c.id, 'Active', 'Resumed') },
    { label: 'Delete', icon: 'delete', danger: true, sepBefore: true, onClick: () => deleteCampaign(c.id) },
  ];

  /* ─── bulk actions ─── */
  const bulkPause = () => {
    const ids = [...selected];
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Paused' as Status } : c)),
    );
    onToast(`Pause · ${ids.length} campaign(s)`);
    setSelected(new Set());
  };
  const bulkResume = () => {
    const ids = [...selected];
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Active' as Status } : c)),
    );
    onToast(`Resume · ${ids.length} campaign(s)`);
    setSelected(new Set());
  };
  const bulkDuplicate = () => {
    const copies: Campaign[] = [];
    let seq = Date.now();
    for (const c of campaigns) {
      if (!selected.has(c.id)) continue;
      copies.push({
        ...c,
        id: 'ac' + seq++,
        name: c.name + ' (copy)',
        status: 'Draft',
        spend: 0,
        revenue: 0,
        roas: 0,
        ctr: 0,
        schedule: '—',
        start: null,
        end: null,
      });
    }
    setCampaigns((prev) => [...copies, ...prev]);
    onToast(`Duplicate · ${copies.length} campaign(s)`);
    setSelected(new Set());
  };
  const bulkArchive = () => {
    const ids = [...selected];
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Ended' as Status } : c)),
    );
    onToast(`Archive · ${ids.length} campaign(s)`);
    setSelected(new Set());
  };

  /* ─── peek action grid ─── */
  const onPeekAction = (act: 'open' | 'duplicate' | 'pause' | 'resume') => {
    if (!peekCampaign) return;
    const c = peekCampaign;
    if (act === 'open') {
      closePeek();
      openCampDrawer(c.id);
    } else if (act === 'duplicate') {
      duplicateCampaign(c);
      closePeek();
    } else if (act === 'pause') {
      setStatus(c.id, 'Paused', 'Paused');
      closePeek();
    } else if (act === 'resume') {
      setStatus(c.id, 'Active', 'Resumed');
      closePeek();
    }
  };

  /* ─── export ─── */
  const handleExport = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.name,
      network: c.network,
      objective: c.objective,
      budget: `$${c.budget}/d`,
      spend: c.spend,
      roas: c.roas ? c.roas.toFixed(2) + 'x' : '—',
      schedule: c.schedule,
      status: c.status,
    }));
    const columns = [
      { key: 'id', label: 'Campaign ID' },
      { key: 'name', label: 'Campaign' },
      { key: 'network', label: 'Network' },
      { key: 'objective', label: 'Objective' },
      { key: 'budget', label: 'Budget (daily)' },
      { key: 'spend', label: 'Spend (30d)' },
      { key: 'roas', label: 'ROAS' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'status', label: 'Status' },
    ];
    exportToCsv(rows, columns, 'ad-campaigns');
    onToast(`Exported ${filtered.length} campaigns`);
  };

  /* ─── filter helpers ─── */
  const removeChip = (k: string) => {
    if (k === 'q') setQuery('');
    if (k === 'tab') setTab('All');
    if (k === 'networks') setNetFilter(new Set(NETWORKS));
    if (k === 'date') {
      setDateFrom(null);
      setDateTo(null);
    }
    setPage(1);
  };
  const clearAllFilters = () => {
    setQuery('');
    setTab('All');
    setNetFilter(new Set(NETWORKS));
    setDraftNetFilter(new Set(NETWORKS));
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
  };

  /* ─── network dropdown apply/clear ─── */
  const openNetDropdown = () => setDraftNetFilter(new Set(netFilter));
  const applyNetFilter = () => {
    setNetFilter(new Set(draftNetFilter));
    setPage(1);
  };
  const clearNetFilter = () => {
    setDraftNetFilter(new Set(NETWORKS));
    setNetFilter(new Set(NETWORKS));
    setPage(1);
  };

  /* ─── date range modal ─── */
  const openDateModal = () => {
    setDateFromDraft(dateFrom || '');
    setDateToDraft(dateTo || '');
    setDateModalOpen(true);
  };
  const applyDateRange = () => {
    setDateFrom(dateFromDraft || null);
    setDateTo(dateToDraft || null);
    setDateModalOpen(false);
    setPage(1);
  };

  /* ─── pixels install ─── */
  const installPixel = (net: Network) => {
    setInstalledPixels((prev) => new Set(prev).add(net));
    onToast(`${NETWORK_PROVIDER[net].name} pixel installed`);
  };

  /* ─── other-create modal ─── */
  const openOtherCreate = (target: string) => {
    setOtherCreateTarget(target);
    setOtherCreateOpen(true);
  };

  /* ─── view change ─── */
  const switchView = (v: View) => {
    setView(v);
    setPage(1);
  };

  /* ─── new campaign split menu ─── */
  const createMenu = [
    { label: 'Campaign', icon: 'campaign', onClick: () => openCampDrawer(null) },
    { label: 'Ad set', icon: 'tune', onClick: () => openOtherCreate('ad set') },
    { label: 'Creative', icon: 'perm_media', onClick: () => openOtherCreate('creative') },
    { label: 'Audience', icon: 'groups', onClick: () => openOtherCreate('audience') },
  ];

  /* ─── scrim behavior (drawer takes priority over peek) ─── */
  const onScrimClick = () => {
    if (drawerOpen) closeCampDrawer();
    else if (peekId) closePeek();
  };

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <div className={s.screen}>
      <main style={{ padding: '0 24px 48px' }}>
        {/* ─── DOMAIN TABSTRIP (Marketing) ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 16,
            marginBottom: 4,
            borderBottom: '1px solid var(--surface-dim)',
            overflowX: 'auto',
          }}
        >
          {DOMAIN_TABS.map((t) => {
            const on = t.id === 'advertising';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  onNavigate
                    ? onNavigate('marketing', 'mkt-' + t.id)
                    : onToast('Navigate → ' + t.id)
                }
                style={{
                  height: 36,
                  padding: '0 12px',
                  fontSize: 12,
                  lineHeight: '16px',
                  fontWeight: 500,
                  color: on ? 'var(--qb-blue)' : 'var(--on-surface-variant)',
                  background: 'none',
                  border: 0,
                  borderBottom: `2px solid ${on ? 'var(--qb-blue)' : 'transparent'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ─── HEADER ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '16px 0',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Breadcrumb
              items={[
                { label: 'Marketing' },
                { label: 'Advertising', current: true },
              ]}
            />
            <h1 className={s.headlineLg} style={{ margin: 0 }}>
              Ad Center
            </h1>
            <p
              style={{
                fontSize: 12,
                color: 'var(--on-surface-variant)',
                marginTop: 2,
                margin: '2px 0 0',
              }}
            >
              Create, target, and measure paid campaigns across connected ad networks.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* View toggle */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--surface-dim)',
                borderRadius: 6,
                padding: 2,
                gap: 2,
              }}
            >
              {(
                [
                  { id: 'overview', label: 'Overview' },
                  { id: 'campaigns', label: 'Campaigns' },
                  { id: 'creatives', label: 'Creatives' },
                  { id: 'audiences', label: 'Audiences' },
                ] as { id: View; label: string }[]
              ).map((v) => {
                const on = view === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => switchView(v.id)}
                    style={{
                      padding: '3px 9px',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      color: on ? '#fff' : 'var(--on-surface-variant)',
                      background: on ? 'var(--qb-blue)' : 'transparent',
                      border: 0,
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Export */}
            <Btn variant="outline" icon="download" onClick={handleExport}>
              Export
            </Btn>

            {/* Tracking pixels */}
            <Btn variant="outline" icon="sensors" onClick={() => setPixelsOpen(true)}>
              Tracking pixels
            </Btn>

            {/* New campaign split */}
            <SplitButton
              icon="add"
              label="New campaign"
              onClick={() => openCampDrawer(null)}
              menu={createMenu}
            />
          </div>
        </div>

        {/* ─── KPI STRIP ─── */}
        <KpiStrip>
          <KpiCard
            label="Spend (30d)"
            value={fmtMoney(
              campaigns.reduce((sum, c) => sum + c.spend, 0),
            )}
            sub="+14% vs prior period"
            subTone="pos"
          />
          <KpiCard
            label="ROAS"
            value={(() => {
              const spend = campaigns.reduce((s, c) => s + c.spend, 0);
              const rev = campaigns.reduce((s, c) => s + c.revenue, 0);
              return spend ? (rev / spend).toFixed(1) + '×' : '—';
            })()}
            sub="Target 3.5× · Above"
            subTone="pos"
          />
          <KpiCard label="Impressions (30d)" value="2.4M" sub="CTR 1.8% · CPC $0.42" />
          <KpiCard
            label="Active campaigns"
            value={activeCampaignCount}
            sub="2 paused · 1 review · 1 draft"
          />
        </KpiStrip>

        {/* ─── CREATE ACTIONS ROW ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--on-surface-variant)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 700,
              marginRight: 4,
            }}
          >
            Create actions:
          </span>
          {[
            { label: 'Campaign', icon: 'campaign', target: 'Campaign' },
            { label: 'Ad set', icon: 'tune', target: 'Ad set' },
            { label: 'Creative', icon: 'perm_media', target: 'Creative' },
            { label: 'Audience', icon: 'groups', target: 'Audience' },
            { label: 'Pixel', icon: 'sensors', target: 'Pixel' },
          ].map((b) => {
            const isCampaign = b.target === 'Campaign';
            return (
              <button
                key={b.target}
                type="button"
                onClick={() =>
                  isCampaign
                    ? openCampDrawer(null)
                    : openOtherCreate(b.target.toLowerCase())
                }
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid var(--surface-dim)',
                  color: 'var(--on-surface)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {b.icon}
                </span>
                {b.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onToast('Open global create flyout')}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              background: 'var(--surface-container)',
              border: 'none',
              color: 'var(--on-surface)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              apps
            </span>
            Show all
          </button>
        </div>

        {/* ═══════════════════ OVERVIEW VIEW ═══════════════════ */}
        {view === 'overview' && (
          <section>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 12,
                }}
                className="ad-overview-grid"
              >
                <style>{`
                  @media (min-width: 1280px) {
                    .ad-overview-grid { grid-template-columns: 2fr 1fr !important; }
                  }
                `}</style>
                {/* Spend & revenue */}
                <div
                  className={s.card}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--surface-dim)',
                    }}
                  >
                    <div>
                      <h2 className={s.headlineSm} style={{ margin: 0 }}>
                        Spend &amp; revenue
                      </h2>
                      <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                        Last 30 days · all networks
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'inline-flex',
                        background: 'var(--surface-container-low)',
                        border: '1px solid var(--surface-dim)',
                        borderRadius: 6,
                        padding: 2,
                        gap: 2,
                      }}
                    >
                      {(
                        [
                          { id: '30', label: '30d' },
                          { id: '7', label: '7d' },
                          { id: '90', label: '90d' },
                        ] as { id: PerfRange; label: string }[]
                      ).map((r) => {
                        const on = perfRange === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setPerfRange(r.id);
                              onToast('Range → last ' + r.id + ' days');
                            }}
                            style={{
                              padding: '3px 9px',
                              fontSize: 10,
                              fontWeight: 600,
                              color: on ? '#fff' : 'var(--on-surface-variant)',
                              background: on ? 'var(--qb-blue)' : 'transparent',
                              border: 0,
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    {/* 3 mini KPIs */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--on-surface-variant)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            fontWeight: 700,
                          }}
                        >
                          Spend
                        </div>
                        <div
                          className={s.headlineMd}
                          style={{
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          $18,420
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--on-surface-variant)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            fontWeight: 700,
                          }}
                        >
                          Attributed revenue
                        </div>
                        <div
                          className={s.headlineMd}
                          style={{
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          $77,364
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--on-surface-variant)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            fontWeight: 700,
                          }}
                        >
                          ROAS
                        </div>
                        <div
                          className={s.headlineMd}
                          style={{
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          4.2×
                        </div>
                      </div>
                    </div>
                    {/* Spend vs revenue bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>Spend</span>
                          <span
                            style={{
                              color: 'var(--on-surface-variant)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            $18,420
                          </span>
                        </div>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 10,
                            background: '#edf0f1',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              display: 'block',
                              height: '100%',
                              width: '24%',
                              background: 'var(--primary)',
                              borderRadius: 10,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 11,
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>Attributed revenue</span>
                          <span
                            style={{
                              color: 'var(--on-surface-variant)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            $77,364
                          </span>
                        </div>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 10,
                            background: '#edf0f1',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              display: 'block',
                              height: '100%',
                              width: '100%',
                              background: 'var(--primary)',
                              borderRadius: 10,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Footer: CPC / CPM / Conv rate */}
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid var(--surface-dim)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 12,
                        fontSize: 11,
                        color: 'var(--on-surface-variant)',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          CPC
                        </div>
                        <div
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--on-surface)',
                            marginTop: 4,
                          }}
                        >
                          $0.42
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          CPM
                        </div>
                        <div
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--on-surface)',
                            marginTop: 4,
                          }}
                        >
                          $7.68
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          Conv. rate
                        </div>
                        <div
                          style={{
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--on-surface)',
                            marginTop: 4,
                          }}
                        >
                          2.1%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spend by network */}
                <div className={s.card} style={{ overflow: 'visible' }}>
                  <div
                    style={{
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--surface-dim)',
                    }}
                  >
                    <h2 className={s.headlineSm} style={{ margin: 0 }}>
                      Spend by network
                    </h2>
                    <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                      Last 30 days
                    </div>
                  </div>
                  <div style={{ padding: 20 }}>
                    {networkBars.map((n) => (
                      <div key={n.name} style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <ProviderLogo net={n.name as Network} />
                          <div
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {n.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--on-surface-variant)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            ${n.spend.toLocaleString()}
                          </div>
                        </div>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 10,
                            background: '#edf0f1',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              display: 'block',
                              height: '100%',
                              width: `${(n.spend / maxNetworkSpend * 100).toFixed(1)}%`,
                              background: 'var(--primary)',
                              borderRadius: 10,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Top-performing ad sets */}
            <div className={s.card}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--surface-dim)',
                }}
              >
                <div>
                  <h2 className={s.headlineSm} style={{ margin: 0 }}>
                    Top-performing ad sets
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    Ranked by attributed revenue
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => switchView('campaigns')}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    border: '1px solid var(--surface-dim)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#fff',
                    color: 'var(--on-surface)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  View all campaigns
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table} style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Ad set</th>
                      <th>Network</th>
                      <th className={s.right}>Spend</th>
                      <th className={s.right}>Revenue</th>
                      <th className={s.right}>ROAS</th>
                      <th className={s.right}>CTR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAdSets.map((c) => (
                      <tr key={c.id} onClick={() => openPeek(c.id)}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProviderLogo net={c.network} />
                            <span style={{ fontSize: 11 }}>{c.network}</span>
                          </div>
                        </td>
                        <td className={`${s.right} ${s.tabularNums}`}>
                          ${c.spend.toLocaleString()}
                        </td>
                        <td className={`${s.right} ${s.tabularNums}`}>
                          ${c.revenue.toLocaleString()}
                        </td>
                        <td className={`${s.right} ${s.tabularNums}`}>
                          {c.roas.toFixed(2)}×
                        </td>
                        <td className={`${s.right} ${s.tabularNums}`}>
                          {c.ctr.toFixed(1)}%
                        </td>
                        <td>
                          <AdStatusPill status={c.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════ CAMPAIGNS VIEW ═══════════════════ */}
        {view === 'campaigns' && (
          <section>
            <div className={s.card}>
              {/* Status tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 16px',
                  height: 44,
                  borderBottom: '1px solid var(--surface-dim)',
                  overflowX: 'auto',
                }}
              >
                {TABS.map((t) => {
                  const on = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        setPage(1);
                      }}
                      style={{
                        height: '100%',
                        padding: '0 12px',
                        fontSize: 12,
                        fontWeight: on ? 600 : 500,
                        color: on ? 'var(--qb-blue)' : 'var(--on-surface-variant)',
                        background: 'none',
                        border: 0,
                        borderBottom: `2px solid ${on ? 'var(--qb-blue)' : 'transparent'}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {/* Filter bar */}
              <div
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid var(--surface-dim)',
                  flexWrap: 'wrap',
                }}
              >
                {/* search */}
                <div
                  className={s.relative}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: 1,
                    maxWidth: 384,
                    minWidth: 180,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: 'absolute',
                      left: 8,
                      fontSize: 15,
                      color: 'var(--outline)',
                      pointerEvents: 'none',
                    }}
                  >
                    search
                  </span>
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Filter campaigns, ad sets, networks…"
                    style={{
                      width: '100%',
                      height: 28,
                      padding: '0 8px 0 28px',
                      background: 'var(--surface-container-low)',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      fontSize: 12,
                      color: 'var(--on-surface)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Network dropdown */}
                <FilterDropdown
                  label="Network"
                  icon="hub"
                  options={NETWORKS}
                  selected={draftNetFilter}
                  onChange={(next) => setDraftNetFilter(next)}
                  onClear={clearNetFilter}
                  onApply={applyNetFilter}
                />

                {/* Date range */}
                <button
                  type="button"
                  onClick={openDateModal}
                  className={s.filterBtn}
                >
                  <span className="material-symbols-outlined">calendar_today</span>
                  Date range
                </button>

                {/* Saved views */}
                <button
                  type="button"
                  onClick={() => onToast('Saved views')}
                  className={s.filterBtn}
                >
                  <span className="material-symbols-outlined">bookmark</span>
                  Saved views
                </button>

                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                  {filtered.length
                    ? `1–${filtered.length} of ${filtered.length}`
                    : '0 of 0'}
                </span>
              </div>

              {/* Active filter chips */}
              {chips.length > 0 && (
                <div
                  style={{
                    padding: '6px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    borderBottom: '1px solid var(--surface-dim)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontWeight: 700,
                      color: 'var(--outline)',
                    }}
                  >
                    Active:
                  </span>
                  {chips.map((c) => (
                    <span
                      key={c.k}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: 'var(--surface-container)',
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {c.label}
                      <button
                        type="button"
                        onClick={() => removeChip(c.k)}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 12 }}
                        >
                          close
                        </span>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      color: 'var(--primary)',
                      fontWeight: 500,
                      background: 'none',
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Bulk bar */}
              {selected.size > 0 && (
                <div
                  style={{
                    background: '#1f2937',
                    color: '#fff',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 13,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
                  <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
                  <button
                    type="button"
                    onClick={bulkPause}
                    style={{
                      color: '#fff',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      pause_circle
                    </span>
                    Pause
                  </button>
                  <button
                    type="button"
                    onClick={bulkResume}
                    style={{
                      color: '#fff',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      play_circle
                    </span>
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={bulkDuplicate}
                    style={{
                      color: '#fff',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      content_copy
                    </span>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={bulkArchive}
                    style={{
                      color: '#fff',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      archive
                    </span>
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    style={{
                      marginLeft: 'auto',
                      color: '#fff',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                      close
                    </span>
                    Clear
                  </button>
                </div>
              )}

              {/* Table or Empty */}
              {pageRows.length === 0 ? (
                <div style={{ padding: '64px 32px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      margin: '0 auto 16px',
                      borderRadius: '50%',
                      background: 'var(--surface-container-low)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 32, color: 'var(--outline)' }}
                    >
                      campaign
                    </span>
                  </div>
                  <h3 className={s.headlineSm} style={{ margin: '0 0 4px' }}>
                    No campaigns match your filters
                  </h3>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--on-surface-variant)',
                      margin: '0 0 16px',
                      maxWidth: 380,
                      marginLeft: 'auto',
                      marginRight: 'auto',
                    }}
                  >
                    Clear filters or start a new ad campaign.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      style={{
                        height: 32,
                        padding: '0 12px',
                        border: '1px solid var(--surface-dim)',
                        borderRadius: 4,
                        fontSize: 14,
                        background: '#fff',
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        filter_alt_off
                      </span>
                      Clear filters
                    </button>
                    <button
                      type="button"
                      onClick={() => openCampDrawer(null)}
                      style={{
                        height: 32,
                        padding: '0 12px',
                        background: 'var(--primary)',
                        color: '#fff',
                        border: 0,
                        borderRadius: 4,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'inherit',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        add
                      </span>
                      New campaign
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={s.table} style={{ minWidth: 1180 }}>
                    <thead>
                      <tr>
                        <th className={s.checkCell}>
                          <input
                            type="checkbox"
                            checked={allVisibleChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = someVisibleChecked;
                            }}
                            onChange={(e) => toggleAllVisible(e.target.checked)}
                          />
                        </th>
                        <th>Campaign</th>
                        <th>Network</th>
                        <th>Objective</th>
                        <th className={s.right}>Budget (daily)</th>
                        <th className={s.right}>Spend (30d)</th>
                        <th className={s.right}>ROAS</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th style={{ width: 32 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((c) => (
                        <tr key={c.id} onClick={() => openPeek(c.id)}>
                          <td
                            className={s.checkCell}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggleSelected(c.id)}
                            />
                          </td>
                          <td>
                            <div className={s.rowName}>{c.name}</div>
                            <div className={s.rowSub}>
                              {c.adSets} ad set(s) · {c.creatives.length} creative(s)
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <ProviderLogo net={c.network} />
                              <span style={{ fontSize: 11 }}>{c.network}</span>
                            </div>
                          </td>
                          <td>{c.objective}</td>
                          <td className={`${s.right} ${s.tabularNums}`}>${c.budget}/d</td>
                          <td className={`${s.right} ${s.tabularNums}`}>
                            ${c.spend.toLocaleString()}
                          </td>
                          <td className={`${s.right} ${s.tabularNums}`}>
                            {c.roas ? c.roas.toFixed(2) + '×' : '—'}
                          </td>
                          <td style={{ fontSize: 11 }}>{c.schedule}</td>
                          <td>
                            <AdStatusPill status={c.status} />
                          </td>
                          <td
                            onClick={(e) => e.stopPropagation()}
                            style={{ textAlign: 'right' }}
                          >
                            <LocalRowMenu items={rowMenuItems(c)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              <div
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--surface-dim)',
                  fontSize: 11,
                  color: 'var(--on-surface-variant)',
                }}
              >
                <span>
                  Rows per page:{' '}
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 4,
                      padding: '2px 4px',
                      background: '#fff',
                      fontSize: 11,
                    }}
                  >
                    {ROWS_PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: currentPage <= 1 ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      chevron_left
                    </span>
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      border: 'none',
                      background: 'transparent',
                      cursor: currentPage >= totalPages ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════ CREATIVES VIEW ═══════════════════ */}
        {view === 'creatives' && (
          <section>
            <div className={s.card}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--surface-dim)',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2 className={s.headlineSm} style={{ margin: 0 }}>
                    Ad creatives
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    Images, videos, and copy used across ad sets.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={creativeSearch}
                    onChange={(e) => setCreativeSearch(e.target.value)}
                    placeholder="Search creatives…"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  />
                  <select
                    value={creativeTypeFilter}
                    onChange={(e) => setCreativeTypeFilter(e.target.value)}
                    style={{
                      height: 28,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 4,
                      fontSize: 12,
                      background: '#fff',
                      fontFamily: 'inherit',
                    }}
                  >
                    {CREATIVE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onToast('Upload creative — file picker')}
                    style={{
                      height: 28,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#fff',
                      color: 'var(--on-surface)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      upload
                    </span>
                    Upload
                  </button>
                </div>
              </div>
              {filteredCreatives.length === 0 ? (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    color: 'var(--on-surface-variant)',
                    gridColumn: '1 / -1',
                  }}
                >
                  No creatives match.
                </div>
              ) : (
                <div
                  style={{
                    padding: 20,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 12,
                  }}
                >
                  <style>{`
                    @media (min-width: 768px) {
                      .ad-creatives-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                    }
                    @media (min-width: 1280px) {
                      .ad-creatives-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
                    }
                  `}</style>
                  {filteredCreatives.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        border: '1px solid var(--surface-dim)',
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: 110,
                          background: 'var(--surface-container-low)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 28, color: 'var(--on-surface-variant)' }}
                        >
                          {creativeIcon(c.type)}
                        </span>
                      </div>
                      <div style={{ padding: 10 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                          {c.type} · {c.dimensions}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              fontWeight: 700,
                              color: 'var(--on-surface-variant)',
                            }}
                          >
                            {c.usedIn} use{c.usedIn === 1 ? '' : 's'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToast('Edit creative ' + c.id)}
                            style={{
                              height: 24,
                              padding: '0 8px',
                              border: '1px solid var(--surface-dim)',
                              borderRadius: 4,
                              fontSize: 11,
                              background: '#fff',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════ AUDIENCES VIEW ═══════════════════ */}
        {view === 'audiences' && (
          <section>
            <div className={s.card}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--surface-dim)',
                  gap: 12,
                }}
              >
                <div>
                  <h2 className={s.headlineSm} style={{ margin: 0 }}>
                    Audiences
                  </h2>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    Reusable custom and lookalike audiences across networks.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openOtherCreate('audience')}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 0,
                    borderRadius: 4,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    add
                  </span>
                  New audience
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className={s.table} style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Audience</th>
                      <th>Type</th>
                      <th>Source</th>
                      <th className={s.right}>Size</th>
                      <th>Used in</th>
                      <th>Updated</th>
                      <th style={{ width: 32 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {AUDIENCES.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.name}</td>
                        <td>{a.type}</td>
                        <td style={{ fontSize: 11 }}>{a.source}</td>
                        <td className={`${s.right} ${s.tabularNums}`}>{a.size}</td>
                        <td className={s.tabularNums}>{a.usedIn}</td>
                        <td style={{ fontSize: 11 }}>{a.updated}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => onToast('Audience ' + a.id)}
                            title="Actions"
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}
                            >
                              more_horiz
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ═══════════════════ OVERLAYS ═══════════════════ */}

      {/* Scrim (peek/drawer share; drawer has priority) */}
      {(peekId || drawerOpen) &&
        !creativeModalOpen &&
        !pixelsOpen &&
        !otherCreateOpen &&
        !dateModalOpen && <Scrim onClose={onScrimClick} />}

      {/* PEEK drawer */}
      {peekCampaign && (
        <div className={s.peek} style={{ width: 460 }}>
          <div
            className={s.peekHead}
            style={{ background: 'var(--surface-container-low)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}
              >
                campaign
              </span>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {peekCampaign.name}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => onPeekAction('open')}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 4,
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  open_in_full
                </span>
                Open
              </button>
              <IconBtn icon="close" onClick={closePeek} />
            </div>
          </div>
          <div className={s.peekBody} style={{ fontSize: 13 }}>
            {/* status + network */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <AdStatusPill status={peekCampaign.status} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                }}
              >
                <ProviderLogo net={peekCampaign.network} size={20} />
                {peekCampaign.network}
              </div>
            </div>

            {/* mini 3-cell KPI */}
            <div
              style={{
                background: 'var(--surface-container-low)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                textAlign: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--on-surface-variant)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}
                >
                  Spend
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${peekCampaign.spend.toLocaleString()}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--on-surface-variant)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}
                >
                  Revenue
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${peekCampaign.revenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--on-surface-variant)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                  }}
                >
                  ROAS
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {peekCampaign.roas ? peekCampaign.roas.toFixed(2) + '×' : '—'}
                </div>
              </div>
            </div>

            {/* KV list */}
            <dl style={{ margin: 0 }}>
              {[
                { k: 'Objective', v: peekCampaign.objective },
                {
                  k: 'Budget',
                  v: (
                    <span className={s.tabularNums}>
                      ${peekCampaign.budget}/d
                    </span>
                  ),
                },
                { k: 'Schedule', v: peekCampaign.schedule },
                { k: 'Ad sets', v: String(peekCampaign.adSets) },
                { k: 'Creatives', v: String(peekCampaign.creatives.length) },
                {
                  k: 'CTR',
                  v: (
                    <span className={s.tabularNums}>
                      {peekCampaign.ctr ? peekCampaign.ctr.toFixed(1) + '%' : '—'}
                    </span>
                  ),
                },
              ].map((row) => (
                <div
                  key={row.k}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--surface-dim)',
                    fontSize: 13,
                  }}
                >
                  <dt style={{ color: 'var(--on-surface-variant)' }}>{row.k}</dt>
                  <dd style={{ margin: 0, fontWeight: 500, textAlign: 'right' }}>
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>

            {/* action grid */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--surface-dim)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => onPeekAction('open')}
                style={{
                  height: 32,
                  padding: '0 12px',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 0,
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  edit
                </span>
                Edit
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('duplicate')}
                style={{
                  height: 32,
                  padding: '0 12px',
                  background: '#fff',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  content_copy
                </span>
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('pause')}
                style={{
                  height: 32,
                  padding: '0 12px',
                  background: '#fff',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  pause_circle
                </span>
                Pause
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('resume')}
                style={{
                  height: 32,
                  padding: '0 12px',
                  background: '#fff',
                  color: 'var(--on-surface)',
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  play_circle
                </span>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN DRAWER (editor) */}
      {drawerOpen && (
        <div className={s.drawer} style={{ width: 600 }}>
          {/* Header */}
          <div className={s.drawerHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: 'var(--primary)' }}
              >
                campaign
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  className={s.headlineSm}
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {editingId ? 'Edit campaign' : 'New campaign'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                  {editingId
                    ? `${
                        campaigns.find((c) => c.id === editingId)?.status ?? ''
                      } · ${editingId}`
                    : 'Draft · not yet published'}
                </div>
              </div>
            </div>
            <IconBtn icon="close" onClick={closeCampDrawer} />
          </div>

          {/* Body */}
          <div
            className={s.drawerBody}
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {/* Campaign basics */}
            <section>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Campaign basics
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Campaign name">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Fall launch — Prospecting"
                  />
                </Field>
                <Field label="Network">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}
                  >
                    {NETWORKS.map((n) => {
                      const on = draftNetwork === n;
                      const p = NETWORK_PROVIDER[n];
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraftNetwork(n)}
                          style={{
                            border: `1px solid ${
                              on ? 'var(--primary)' : 'var(--surface-dim)'
                            }`,
                            borderRadius: 8,
                            padding: 10,
                            background: on
                              ? 'var(--surface-container-low)'
                              : '#fff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <ProviderLogo net={n} />
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'var(--on-surface-variant)',
                                }}
                              >
                                {p.blurb}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Objective">
                  <FieldSelect
                    value={draftObjective}
                    onChange={(e) => setDraftObjective(e.target.value)}
                  >
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>
              </div>
            </section>

            {/* Budget & schedule */}
            <section
              style={{
                paddingTop: 16,
                borderTop: '1px solid var(--surface-dim)',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                Budget &amp; schedule
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <Field label="Budget type">
                  <FieldSelect
                    value={draftBudgetType}
                    onChange={(e) =>
                      setDraftBudgetType(e.target.value as BudgetType)
                    }
                  >
                    {BUDGET_TYPES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>
                <Field label="Amount">
                  <div style={{ display: 'flex' }}>
                    <span
                      style={{
                        height: 36,
                        padding: '0 8px',
                        border: '1px solid var(--surface-dim)',
                        borderRight: 0,
                        borderRadius: '6px 0 0 6px',
                        background: 'var(--surface-container-low)',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      value={draftBudget}
                      onChange={(e) =>
                        setDraftBudget(Number(e.target.value) || 0)
                      }
                      style={{
                        flex: 1,
                        height: 36,
                        padding: '0 10px',
                        border: '1px solid var(--surface-dim)',
                        borderRadius: '0 6px 6px 0',
                        fontSize: 13,
                        background: '#fff',
                        color: 'var(--on-surface)',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                </Field>
                <Field label="Start">
                  <Input
                    type="datetime-local"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                  />
                </Field>
                <Field label="End (optional)">
                  <Input
                    type="datetime-local"
                    value={draftEnd}
                    onChange={(e) => setDraftEnd(e.target.value)}
                  />
                </Field>
              </div>
            </section>

            {/* Ad sets */}
            <section
              style={{
                paddingTop: 16,
                borderTop: '1px solid var(--surface-dim)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>Ad sets</div>
                <button
                  type="button"
                  onClick={addAdSet}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    border: '1px solid var(--surface-dim)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#fff',
                    color: 'var(--on-surface)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    add
                  </span>
                  Add ad set
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftAdSets.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    No ad sets yet. Add one to begin.
                  </div>
                ) : (
                  draftAdSets.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid var(--surface-dim)',
                        borderRadius: 10,
                        background: '#fff',
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            flex: 1,
                          }}
                        >
                          {a.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAdSet(i)}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 14, color: 'var(--error)' }}
                          >
                            close
                          </span>
                        </button>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: 8,
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 10,
                              color: 'var(--on-surface-variant)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            Audience
                          </label>
                          <select
                            value={a.audience}
                            onChange={(e) =>
                              updateAdSet(i, { audience: e.target.value })
                            }
                            style={{
                              width: '100%',
                              height: 32,
                              padding: '0 8px',
                              border: '1px solid var(--surface-dim)',
                              borderRadius: 4,
                              fontSize: 12,
                              background: '#fff',
                              fontFamily: 'inherit',
                            }}
                          >
                            {AUDIENCES_LIST.map((au) => (
                              <option key={au} value={au}>
                                {au}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 10,
                              color: 'var(--on-surface-variant)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            Placement
                          </label>
                          <select
                            value={a.placement}
                            onChange={(e) =>
                              updateAdSet(i, { placement: e.target.value })
                            }
                            style={{
                              width: '100%',
                              height: 32,
                              padding: '0 8px',
                              border: '1px solid var(--surface-dim)',
                              borderRadius: 4,
                              fontSize: 12,
                              background: '#fff',
                              fontFamily: 'inherit',
                            }}
                          >
                            {PLACEMENTS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            style={{
                              display: 'block',
                              fontSize: 10,
                              color: 'var(--on-surface-variant)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              fontWeight: 700,
                              marginBottom: 4,
                            }}
                          >
                            Bid strategy
                          </label>
                          <select
                            value={a.bid}
                            onChange={(e) =>
                              updateAdSet(i, { bid: e.target.value })
                            }
                            style={{
                              width: '100%',
                              height: 32,
                              padding: '0 8px',
                              border: '1px solid var(--surface-dim)',
                              borderRadius: 4,
                              fontSize: 12,
                              background: '#fff',
                              fontFamily: 'inherit',
                            }}
                          >
                            {BIDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Creative selection */}
            <section
              style={{
                paddingTop: 16,
                borderTop: '1px solid var(--surface-dim)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Creative selection
                </div>
                <button
                  type="button"
                  onClick={openCreativeModal}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    border: '1px solid var(--surface-dim)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: '#fff',
                    color: 'var(--on-surface)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    perm_media
                  </span>
                  Pick creative
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {draftCreatives.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    No creatives selected yet.
                  </div>
                ) : (
                  draftCreatives.map((id) => {
                    const c = CREATIVES.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <div
                        key={id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--outline-variant)',
                          background: 'var(--surface-container-low)',
                          fontSize: 13,
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16, color: 'var(--primary)' }}
                        >
                          {creativeIcon(c.type)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {c.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--on-surface-variant)',
                            }}
                          >
                            {c.type} · {c.dimensions}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftCreatives((prev) =>
                              prev.filter((x) => x !== id),
                            )
                          }
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 14 }}
                          >
                            close
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div
            className={s.drawerFoot}
            style={{ justifyContent: 'space-between' }}
          >
            <button
              type="button"
              onClick={closeCampDrawer}
              style={{
                height: 32,
                padding: '0 12px',
                border: '1px solid var(--surface-dim)',
                borderRadius: 4,
                fontSize: 14,
                background: '#fff',
                color: 'var(--on-surface)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={s.splitBtn}>
                <button
                  type="button"
                  onClick={saveAndNew}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    background: '#fff',
                    border: '1px solid var(--surface-dim)',
                    borderRadius: '4px 0 0 4px',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--on-surface)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Save and new
                </button>
                <button
                  type="button"
                  onClick={saveAndNew}
                  style={{
                    height: 32,
                    width: 28,
                    padding: 0,
                    background: '#fff',
                    border: '1px solid var(--surface-dim)',
                    borderLeft: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '0 4px 4px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    expand_more
                  </span>
                </button>
              </div>
              <div className={s.splitBtn}>
                <button
                  type="button"
                  onClick={saveAndClose}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 0,
                    borderRadius: '4px 0 0 4px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Save and close
                </button>
                <button
                  type="button"
                  onClick={saveAndClose}
                  style={{
                    height: 32,
                    width: 28,
                    padding: 0,
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 0,
                    borderLeft: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '0 4px 4px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    expand_more
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATIVE PICKER MODAL */}
      <Modal
        open={creativeModalOpen}
        title="Pick creatives"
        onClose={() => setCreativeModalOpen(false)}
        size="md"
        footer={
          <>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => setCreativeModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={confirmCreativePicker}
            >
              Add to campaign
            </button>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          Select one or more creatives from the Content Library.
        </p>
        <Input
          value={creativePickerSearch}
          onChange={(e) => setCreativePickerSearch(e.target.value)}
          placeholder="Search creatives…"
          style={{ marginBottom: 8 }}
        />
        <div
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            border: '1px solid var(--surface-dim)',
            borderRadius: 4,
          }}
        >
          {filteredPickerCreatives.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--on-surface-variant)' }}>
              No creatives match.
            </div>
          ) : (
            filteredPickerCreatives.map((c) => (
              <label
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--surface-dim)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={creativePickerSel.has(c.id)}
                  onChange={() => toggleCreativePicker(c.id)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg,#e7f1ef,#d9e4e3)',
                    display: 'grid',
                    placeItems: 'center',
                    color: '#648783',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    {creativeIcon(c.type)}
                  </span>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    {c.type} · {c.dimensions}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--on-surface-variant)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.usedIn} use{c.usedIn === 1 ? '' : 's'}
                </span>
              </label>
            ))
          )}
        </div>
      </Modal>

      {/* PIXELS MODAL */}
      <Modal
        open={pixelsOpen}
        title="Tracking pixels"
        onClose={() => setPixelsOpen(false)}
        size="md"
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: 0 }}>
          Fire conversion events from your site to ad networks.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(
            [
              { net: 'Meta' as Network,     name: 'Meta Pixel',     id: 'ID 1029••••4471',  notInstalledMsg: 'Not installed' },
              { net: 'TikTok' as Network,   name: 'TikTok Pixel',   id: 'Not installed',     notInstalledMsg: 'Not installed' },
              { net: 'Google' as Network,   name: 'Google Ads tag', id: 'AW-•••••••',        notInstalledMsg: 'Not installed' },
              { net: 'Pinterest' as Network,name: 'Pinterest Tag', id: 'Not installed',     notInstalledMsg: 'Not installed' },
            ]
          ).map((p) => {
            const installed = installedPixels.has(p.net);
            return (
              <div
                key={p.net}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 12,
                  borderRadius: 4,
                  border: '1px solid var(--surface-dim)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    {installed ? p.id : 'Not installed'}
                  </div>
                </div>
                {installed ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 600,
                      background: '#e9f5ef',
                      color: '#388064',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                      check
                    </span>
                    Installed
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => installPixel(p.net)}
                    style={{
                      height: 28,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#fff',
                      color: 'var(--on-surface)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Install
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* OTHER CREATE MODAL */}
      <Modal
        open={otherCreateOpen}
        title={`Create ${otherCreateTarget}`}
        onClose={() => setOtherCreateOpen(false)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => setOtherCreateOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={() => {
                onToast(`Opened ${otherCreateTarget} create surface`);
                setOtherCreateOpen(false);
              }}
            >
              Open create
            </button>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: 0 }}>
          This opens the {otherCreateTarget} create surface.
        </p>
      </Modal>

      {/* DATE RANGE MODAL */}
      <Modal
        open={dateModalOpen}
        title="Date range"
        onClose={() => setDateModalOpen(false)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => setDateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={applyDateRange}
            >
              Apply
            </button>
          </>
        }
      >
        <Field label="From">
          <Input
            type="date"
            value={dateFromDraft}
            onChange={(e) => setDateFromDraft(e.target.value)}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={dateToDraft}
            onChange={(e) => setDateToDraft(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
