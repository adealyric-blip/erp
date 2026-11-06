'use client';

/**
 * CampaignsScreen — 1:1 faithful port of caimpaigns.html.
 *
 * Sections replicated:
 *   • Breadcrumb (Advertising / Campaigns)
 *   • Page header (title, subtitle, Export / Customize / New campaign split)
 *   • KPI strip (4 cards: Active, Spend 30d, Revenue, Blended ROAS)
 *   • List card with:
 *       - Status tabs (All / Active / Paused / In review / Draft / Ended)
 *       - Filter bar (search, Network dropdown, Objective dropdown,
 *         Saved views, Clear all, count label)
 *       - Bulk bar (Pause / Resume / Duplicate / Archive / Delete / close)
 *       - Table (checkbox, Campaign, Network, Objective, Budget/daily,
 *         Spend/30d, ROAS, Schedule, Status, ⋯)
 *       - Empty state
 *       - Pagination (rows-per-page select, prev/next, page label)
 *   • Create split menu (Campaign / Ad set / Creative / Audience)
 *   • Row ⋯ menu (Edit / View / Duplicate / Pause / Resume / Archive / Delete)
 *   • Peek drawer (status + net chip, KPI grid, KV list, action grid)
 *   • Campaign editor drawer (basics, budget & schedule, ad sets, creatives)
 *   • Creative picker modal
 *   • Ad set editor modal
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
  StatusPill,
  NetChip,
  StatusTabs,
  FilterBar,
  SearchInput,
  FilterDropdown,
  Scrim,
  Modal,
  Table,
  Field,
  Input,
  Select as FieldSelect,
  KvList,
  MarketingScreenProps,
} from './MarketingPrimitives';
import s from './MarketingPrimitives.module.css';

/* ──────────────── types ──────────────── */
type Status = 'Active' | 'Paused' | 'In review' | 'Draft' | 'Ended';
type Network = 'Meta' | 'TikTok' | 'Google' | 'Pinterest';
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
  type: 'Image' | 'Video' | 'Carousel';
  dimensions: string;
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

/* ──────────────── constants ──────────────── */
const NETWORKS: Network[] = ['Meta', 'TikTok', 'Google', 'Pinterest'];
const NETWORK_LABELS: Record<Network, string> = {
  Meta: 'Meta Ads',
  TikTok: 'TikTok Ads',
  Google: 'Google Ads',
  Pinterest: 'Pinterest Ads',
};
const NETWORK_BLURBS: Record<Network, string> = {
  Meta: 'Facebook + Instagram',
  TikTok: 'In-feed, Spark',
  Google: 'Search, Shopping, PMax',
  Pinterest: 'Promoted Pins',
};
const OBJECTIVES = ['Conversions', 'Traffic', 'Awareness', 'Engagement', 'Lead generation'];
const OBJECTIVE_OPTIONS = [
  'Conversions',
  'Traffic',
  'Awareness',
  'Engagement',
  'Lead generation',
  'Catalog sales',
];
const AUDIENCES = ['Site visitors 30d', 'Abandoned cart 7d', 'Lookalike — VIPs', 'New customers'];
const PLACEMENTS = ['Auto', 'Feed', 'Stories / Reels', 'Search'];
const BIDS = ['Lowest cost', 'Cost cap', 'ROAS goal'];
const BUDGET_TYPES: BudgetType[] = ['Daily', 'Lifetime'];
const TABS = ['All', 'Active', 'Paused', 'In review', 'Draft', 'Ended'];
const ROWS_PER_PAGE_OPTIONS = [25, 50, 75, 100];

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 'CMP-3001', name: 'Fall launch — Prospecting', network: 'Meta', objective: 'Conversions', budget: 250, budgetType: 'Daily', spend: 8620, revenue: 36720, roas: 4.26, ctr: 2.1, schedule: '2026-10-15 → 2026-11-30', start: '2026-10-15T00:00', end: '2026-11-30T23:59', status: 'Active', adSets: 3, creatives: ['CR-001', 'CR-002'] },
  { id: 'CMP-3002', name: 'TikTok creator drop', network: 'TikTok', objective: 'Engagement', budget: 180, budgetType: 'Daily', spend: 4210, revenue: 12890, roas: 3.06, ctr: 3.4, schedule: '2026-10-20 → 2026-11-20', start: '2026-10-20T00:00', end: '2026-11-20T23:59', status: 'Active', adSets: 2, creatives: ['CR-003'] },
  { id: 'CMP-3003', name: 'Brand search — Non-brand', network: 'Google', objective: 'Traffic', budget: 120, budgetType: 'Daily', spend: 2310, revenue: 9280, roas: 4.02, ctr: 5.2, schedule: '2026-10-01 → 2026-12-31', start: '2026-10-01T00:00', end: '2026-12-31T23:59', status: 'Active', adSets: 1, creatives: ['CR-004'] },
  { id: 'CMP-3004', name: 'Holiday capsule lookalike', network: 'Meta', objective: 'Conversions', budget: 300, budgetType: 'Daily', spend: 3280, revenue: 14840, roas: 4.53, ctr: 2.8, schedule: '2026-11-05 → 2026-12-24', start: '2026-11-05T00:00', end: '2026-12-24T23:59', status: 'In review', adSets: 2, creatives: ['CR-005'] },
  { id: 'CMP-3005', name: 'Pinterest — Evergreen inspo', network: 'Pinterest', objective: 'Awareness', budget: 80, budgetType: 'Daily', spend: 0, revenue: 0, roas: 0, ctr: 0, schedule: '—', start: null, end: null, status: 'Draft', adSets: 0, creatives: [] },
  { id: 'CMP-3006', name: 'Summer clearance (ended)', network: 'Meta', objective: 'Conversions', budget: 200, budgetType: 'Daily', spend: 12400, revenue: 38210, roas: 3.08, ctr: 1.9, schedule: '2026-08-01 → 2026-09-15', start: '2026-08-01T00:00', end: '2026-09-15T23:59', status: 'Ended', adSets: 4, creatives: ['CR-006', 'CR-007'] },
];

const CREATIVES: Creative[] = [
  { id: 'CR-001', name: 'Fall hero — 1x1', type: 'Image', dimensions: '1080x1080' },
  { id: 'CR-002', name: 'Fall hero — 4x5', type: 'Image', dimensions: '1080x1350' },
  { id: 'CR-003', name: 'TikTok drop — vertical', type: 'Video', dimensions: '1080x1920 · 15s' },
  { id: 'CR-004', name: 'Search text — brand', type: 'Image', dimensions: '1200x628' },
  { id: 'CR-005', name: 'Holiday capsule teaser', type: 'Video', dimensions: '1080x1080 · 6s' },
  { id: 'CR-006', name: 'Summer CTA', type: 'Image', dimensions: '1080x1080' },
  { id: 'CR-007', name: 'Summer carousel', type: 'Carousel', dimensions: '1080x1080 x3' },
  { id: 'CR-008', name: 'Evergreen tote', type: 'Image', dimensions: '1080x1350' },
];

/* ──────────────── helpers ──────────────── */
function nextCampaignId(existing: Campaign[]): string {
  return 'CMP-' + (3000 + existing.length + 1);
}

function fmtSchedule(start: string, end: string | null): string {
  if (!start) return '—';
  const s = start.slice(0, 10);
  return end ? `${s} → ${end.slice(0, 10)}` : `${s} → ongoing`;
}

function creativeIcon(type: Creative['type']): string {
  return type === 'Video' ? 'movie' : type === 'Carousel' ? 'view_carousel' : 'image';
}

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString();
}

/* ──────────────── Local Row Menu (handles header-only items) ──────────────── */
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
        className={s.btnIcon}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Actions"
        style={{ width: 28, height: 28, border: 'none', background: 'transparent' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--on-surface-variant)' }}>more_horiz</span>
      </button>
      {open && (
        <div
          className={s.popover}
          style={{ right: 0, left: 'auto', minWidth: 250 }}
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
                  onClick={() => { it.onClick?.(); setOpen(false); }}
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

/* ──────────────── component ──────────────── */
export default function CampaignsScreen({ onToast }: MarketingScreenProps) {
  /* ─── data state ─── */
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);

  /* ─── filter state ─── */
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('All');
  const [netFilter, setNetFilter] = useState<Set<string>>(new Set(NETWORKS));
  const [objFilter, setObjFilter] = useState<Set<string>>(new Set(OBJECTIVES));

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

  /* ─── ad set modal ─── */
  const [adsetModalOpen, setAdsetModalOpen] = useState(false);
  const [editingAdSetIdx, setEditingAdSetIdx] = useState<number | null>(null);
  const [adsetName, setAdsetName] = useState('');
  const [adsetAudience, setAdsetAudience] = useState<string>(AUDIENCES[0]);
  const [adsetPlacement, setAdsetPlacement] = useState<string>('Auto');
  const [adsetBid, setAdsetBid] = useState<string>('Lowest cost');

  /* ─── creative picker modal ─── */
  const [creativeModalOpen, setCreativeModalOpen] = useState(false);
  const [creativeSearch, setCreativeSearch] = useState('');
  const [creativePickerSel, setCreativePickerSel] = useState<Set<string>>(new Set());

  /* ─── pagination ─── */
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  /* ─── derived: filtered rows ─── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      const qOK = !q || (c.id + ' ' + c.name + ' ' + c.network + ' ' + c.objective).toLowerCase().includes(q);
      const tabOK = tab === 'All' || c.status === tab;
      const netOK = netFilter.has(c.network);
      const objOK = objFilter.has(c.objective);
      return qOK && tabOK && netOK && objOK;
    });
  }, [campaigns, query, tab, netFilter, objFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pageRows = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: campaigns.length };
    for (const t of TABS) {
      if (t === 'All') continue;
      c[t] = campaigns.filter((x) => x.status === t).length;
    }
    return c;
  }, [campaigns]);

  const kpis = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'Active').length;
    const spend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const revenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const roas = spend ? revenue / spend : 0;
    return { active, spend, revenue, roas };
  }, [campaigns]);

  const filtersActive =
    !!query ||
    tab !== 'All' ||
    netFilter.size !== NETWORKS.length ||
    objFilter.size !== OBJECTIVES.length;

  /* ─── selection helpers ─── */
  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const allVisibleChecked = pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));
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
  const peekCampaign = peekId ? campaigns.find((c) => c.id === peekId) ?? null : null;

  /* ─── drawer open / close ─── */
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
          audience: AUDIENCES[i % AUDIENCES.length],
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

  /* ─── ad set modal ─── */
  const openAdSetModal = (idx: number | null) => {
    setEditingAdSetIdx(idx);
    if (idx !== null) {
      const a = draftAdSets[idx];
      setAdsetName(a.name);
      setAdsetAudience(a.audience);
      setAdsetPlacement(a.placement);
      setAdsetBid(a.bid);
    } else {
      setAdsetName('Ad set ' + (draftAdSets.length + 1));
      setAdsetAudience(AUDIENCES[0]);
      setAdsetPlacement('Auto');
      setAdsetBid('Lowest cost');
    }
    setAdsetModalOpen(true);
  };
  const confirmAdSet = () => {
    const newAdSet: AdSet = {
      name: adsetName || 'Ad set',
      audience: adsetAudience,
      placement: adsetPlacement,
      bid: adsetBid,
    };
    setDraftAdSets((prev) => {
      if (editingAdSetIdx !== null) {
        const n = [...prev];
        n[editingAdSetIdx] = newAdSet;
        return n;
      }
      return [...prev, newAdSet];
    });
    setAdsetModalOpen(false);
    setEditingAdSetIdx(null);
  };

  /* ─── creative picker ─── */
  const openCreativeModal = () => {
    setCreativePickerSel(new Set(draftCreatives));
    setCreativeSearch('');
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
  const filteredCreatives = useMemo(() => {
    const q = creativeSearch.trim().toLowerCase();
    if (!q) return CREATIVES;
    return CREATIVES.filter((c) => c.name.toLowerCase().includes(q));
  }, [creativeSearch]);

  /* ─── save ─── */
  const collectCampaign = (): Campaign | null => {
    if (!draftName.trim()) {
      onToast('Campaign name is required');
      return null;
    }
    const network: Network = draftNetwork ?? 'Meta';
    const start = draftStart;
    const end = draftEnd || null;
    const editing = editingId ? campaigns.find((c) => c.id === editingId) ?? null : null;
    return {
      id: editing ? editing.id : nextCampaignId(campaigns),
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
      status: editing ? editing.status : 'Draft',
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
      id: nextCampaignId(campaigns),
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
    onToast(`Duplicated: ${c.name}`);
  };
  const setStatus = (id: string, status: Status, verb: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    setCampaigns((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
    onToast(`${verb}: ${c.name}`);
  };
  const deleteCampaign = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    if (!window.confirm(`Delete campaign "${c.name}"?`)) return;
    setCampaigns((prev) => prev.filter((x) => x.id !== id));
    onToast(`Deleted: ${c.name}`);
  };

  const rowMenuItems = (c: Campaign): LocalRowMenuItem[] => [
    { header: 'This campaign', label: 'Edit campaign', icon: 'edit', onClick: () => openCampDrawer(c.id) },
    { label: 'View details', icon: 'visibility', onClick: () => openPeek(c.id) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => duplicateCampaign(c) },
    { header: 'Status', sepBefore: true, label: 'Pause', icon: 'pause_circle', onClick: () => setStatus(c.id, 'Paused', 'Paused') },
    { label: 'Resume', icon: 'play_circle', onClick: () => setStatus(c.id, 'Active', 'Resumed') },
    { label: 'Archive', icon: 'archive', onClick: () => setStatus(c.id, 'Ended', 'Archived') },
    { label: 'Delete', icon: 'delete', danger: true, sepBefore: true, onClick: () => deleteCampaign(c.id) },
  ];

  /* ─── bulk actions ─── */
  const selectedList = useMemo(
    () => campaigns.filter((c) => selected.has(c.id)),
    [campaigns, selected],
  );
  const bulkPause = () => {
    const n = selected.size;
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Paused' as Status } : c)),
    );
    onToast(`Paused ${n} campaign(s)`);
    setSelected(new Set());
  };
  const bulkResume = () => {
    const n = selected.size;
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Active' as Status } : c)),
    );
    onToast(`Resumed ${n} campaign(s)`);
    setSelected(new Set());
  };
  const bulkDuplicate = () => {
    let nextIdNum = 3000 + campaigns.length + 1;
    const copies: Campaign[] = selectedList.map((c) => {
      const copy: Campaign = {
        ...c,
        id: 'CMP-' + nextIdNum,
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
      nextIdNum++;
      return copy;
    });
    setCampaigns((prev) => [...copies, ...prev]);
    onToast(`Duplicated ${selected.size} campaign(s)`);
    setSelected(new Set());
  };
  const bulkArchive = () => {
    const n = selected.size;
    setCampaigns((prev) =>
      prev.map((c) => (selected.has(c.id) ? { ...c, status: 'Ended' as Status } : c)),
    );
    onToast(`Archived ${n} campaign(s)`);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    const n = selected.size;
    if (!window.confirm(`Delete ${n} campaign(s)?`)) return;
    setCampaigns((prev) => prev.filter((c) => !selected.has(c.id)));
    onToast(`Deleted ${n} campaign(s)`);
    setSelected(new Set());
  };

  /* ─── export ─── */
  const handleExport = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.name,
      network: c.network,
      objective: c.objective,
      budget: `$${c.budget}/${c.budgetType === 'Daily' ? 'd' : 'L'}`,
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
    exportToCsv(rows, columns, 'campaigns');
    onToast('Exported campaigns');
  };

  const clearAllFilters = () => {
    setQuery('');
    setTab('All');
    setNetFilter(new Set(NETWORKS));
    setObjFilter(new Set(OBJECTIVES));
    setPage(1);
  };

  const createMenu = [
    { label: 'Campaign', icon: 'campaign', onClick: () => openCampDrawer(null) },
    { label: 'Ad set', icon: 'tune', onClick: () => onToast('Create ad set — will route to that dedicated page') },
    { label: 'Creative', icon: 'perm_media', onClick: () => onToast('Create creative — will route to that dedicated page') },
    { label: 'Audience', icon: 'groups', onClick: () => onToast('Create audience — will route to that dedicated page') },
  ];

  /* ─── peek body actions ─── */
  const onPeekAction = (act: 'edit' | 'duplicate' | 'pause' | 'resume') => {
    if (!peekCampaign) return;
    const c = peekCampaign;
    if (act === 'edit') openCampDrawer(c.id);
    else if (act === 'duplicate') {
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

  /* ─── ad set / creative remove ─── */
  const removeAdSet = (idx: number) => {
    setDraftAdSets((prev) => prev.filter((_, i) => i !== idx));
  };
  const removeCreative = (id: string) => {
    setDraftCreatives((prev) => prev.filter((x) => x !== id));
  };

  /* ─── scrim behavior (drawer takes priority over peek) ─── */
  const onScrimClick = () => {
    if (drawerOpen) closeCampDrawer();
    else if (peekId) closePeek();
  };

  /* ──────────────── RENDER ──────────────── */
  return (
    <div className={s.screen}>
      <main style={{ padding: '0 24px 48px' }}>
        {/* BREADCRUMB */}
        <Breadcrumb items={[{ label: 'Advertising' }, { label: 'Campaigns', current: true }]} />

        {/* PAGE HEADER */}
        <PageHeader
          title="Campaigns"
          subtitle="Every ad campaign across connected networks — budgets, pacing, performance, and scheduling."
        >
          <Btn variant="outline" icon="download" onClick={handleExport}>Export</Btn>
          <Btn variant="outline" icon="tune" onClick={() => onToast('Customize panel — Data / Visual tabs')}>Customize</Btn>
          <SplitButton
            icon="add"
            label="New campaign"
            onClick={() => openCampDrawer(null)}
            menu={createMenu}
          />
        </PageHeader>

        {/* KPI STRIP */}
        <KpiStrip>
          <KpiCard label="Active campaigns" value={kpis.active} sub="Currently spending" />
          <KpiCard label="Total spend (30d)" value={fmtMoney(kpis.spend)} sub="+14% vs prior period" subTone="pos" />
          <KpiCard label="Attributed revenue" value={fmtMoney(kpis.revenue)} sub="Across all networks" />
          <KpiCard label="Blended ROAS" value={kpis.roas.toFixed(2) + '×'} sub="Target 3.50×" />
        </KpiStrip>

        {/* LIST CARD */}
        <div className={s.card}>
          {/* Status tabs */}
          <StatusTabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); setPage(1); }} counts={counts} />

          {/* Filter bar */}
          <FilterBar>
            <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Filter campaigns…" />
            <FilterDropdown
              label="Network"
              icon="hub"
              options={NETWORKS.map((n) => NETWORK_LABELS[n])}
              selected={new Set([...netFilter].map((n) => NETWORK_LABELS[n as Network] || n))}
              onChange={(next) => {
                const mapped = new Set<string>();
                for (const label of next) {
                  for (const n of NETWORKS) {
                    if (NETWORK_LABELS[n] === label) mapped.add(n);
                  }
                }
                setNetFilter(mapped);
              }}
              onClear={() => setNetFilter(new Set(NETWORKS))}
              onApply={() => setPage(1)}
            />
            <FilterDropdown
              label="Objective"
              icon="flag"
              options={OBJECTIVES}
              selected={objFilter}
              onChange={(next) => setObjFilter(next)}
              onClear={() => setObjFilter(new Set(OBJECTIVES))}
              onApply={() => setPage(1)}
            />
            <button
              type="button"
              className={s.filterBtn}
              onClick={() => onToast('Saved views — pick or save current filters')}
            >
              <span className="material-symbols-outlined">bookmark</span>Saved views
            </button>
            {filtersActive && (
              <button
                type="button"
                className={s.filterBtn}
                onClick={clearAllFilters}
              >
                <span className="material-symbols-outlined">filter_alt_off</span>Clear all
              </button>
            )}
            <span className={s.flex1} />
            <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              {filtered.length} of {campaigns.length}
            </span>
          </FilterBar>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className={s.bulkBar}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{selected.size} selected</span>
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
              <button type="button" onClick={bulkPause}><span className="material-symbols-outlined">pause_circle</span>Pause</button>
              <button type="button" onClick={bulkResume}><span className="material-symbols-outlined">play_circle</span>Resume</button>
              <button type="button" onClick={bulkDuplicate}><span className="material-symbols-outlined">content_copy</span>Duplicate</button>
              <button type="button" onClick={bulkArchive}><span className="material-symbols-outlined">archive</span>Archive</button>
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
              <button type="button" onClick={bulkDelete}><span className="material-symbols-outlined">delete</span>Delete</button>
              <button type="button" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          )}

          {/* Table or Empty */}
          {pageRows.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  margin: '0 auto 12px',
                  borderRadius: '50%',
                  background: 'var(--surface-container-low)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--outline)' }}>campaign</span>
              </div>
              <h3 className={s.headlineSm} style={{ margin: '0 0 4px' }}>No campaigns match</h3>
              <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
                Clear filters or start a new campaign.
              </p>
              <Btn variant="outline" onClick={clearAllFilters}>Clear filters</Btn>
            </div>
          ) : (
            <Table
              head={
                <tr>
                  <th className={s.checkCell}>
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      ref={(el) => { if (el) el.indeterminate = someVisibleChecked; }}
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
              }
            >
              {pageRows.map((c) => (
                <tr key={c.id} onClick={() => openPeek(c.id)}>
                  <td className={s.checkCell} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelected(c.id)}
                    />
                  </td>
                  <td>
                    <div className={s.rowName}>{c.name}</div>
                    <div className={s.rowSub}>{c.adSets} ad set(s) · {c.creatives.length} creative(s)</div>
                  </td>
                  <td><NetChip net={c.network} /></td>
                  <td>{c.objective}</td>
                  <td className={`${s.right} ${s.tabularNums}`}>${c.budget}/d</td>
                  <td className={`${s.right} ${s.tabularNums}`}>${c.spend.toLocaleString()}</td>
                  <td className={`${s.right} ${s.tabularNums}`}>
                    {c.roas ? c.roas.toFixed(2) + '×' : '—'}
                  </td>
                  <td style={{ fontSize: 11 }}>{c.schedule}</td>
                  <td><StatusPill status={c.status} /></td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                    <LocalRowMenu items={rowMenuItems(c)} />
                  </td>
                </tr>
              ))}
            </Table>
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
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  padding: '2px 4px',
                  background: '#fff',
                  fontSize: 11,
                }}
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
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
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <span>Page {currentPage} of {totalPages}</span>
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
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════ OVERLAYS ═══════════════════ */}

      {/* Scrim (peek/drawer share it; drawer has priority) */}
      {(peekId || drawerOpen) && !adsetModalOpen && !creativeModalOpen && (
        <Scrim onClose={onScrimClick} />
      )}

      {/* PEEK drawer */}
      {peekCampaign && (
        <div className={s.peek}>
          <div
            className={s.peekHead}
            style={{ background: 'var(--surface-container-low)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}>campaign</span>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {peekCampaign.name}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => onPeekAction('edit')}
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
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>Edit
              </button>
              <IconBtn icon="close" onClick={closePeek} />
            </div>
          </div>
          <div className={s.peekBody}>
            {/* Status + network */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <StatusPill status={peekCampaign.status} />
              <NetChip net={peekCampaign.network} />
            </div>

            {/* Mini 3-cell KPI */}
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
                <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Spend</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(peekCampaign.spend)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Revenue</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(peekCampaign.revenue)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>ROAS</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {peekCampaign.roas ? peekCampaign.roas.toFixed(2) + '×' : '—'}
                </div>
              </div>
            </div>

            {/* KV list */}
            <KvList
              items={[
                { k: 'Campaign ID', v: <span className={s.mono}>{peekCampaign.id}</span> },
                { k: 'Objective', v: peekCampaign.objective },
                { k: 'Budget', v: <span className={s.tabularNums}>${peekCampaign.budget} / {peekCampaign.budgetType}</span> },
                { k: 'Schedule', v: peekCampaign.schedule },
                { k: 'Ad sets', v: String(peekCampaign.adSets) },
                { k: 'Creatives', v: String(peekCampaign.creatives.length) },
                { k: 'CTR', v: <span className={s.tabularNums}>{peekCampaign.ctr ? peekCampaign.ctr.toFixed(1) + '%' : '—'}</span> },
              ]}
            />

            {/* Action grid */}
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
                onClick={() => onPeekAction('edit')}
                className={`${s.btn} ${s.btnPrimary}`}
              >
                <span className="material-symbols-outlined">edit</span>Edit
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('duplicate')}
                className={`${s.btn} ${s.btnOutline}`}
              >
                <span className="material-symbols-outlined">content_copy</span>Duplicate
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('pause')}
                className={`${s.btn} ${s.btnOutline}`}
              >
                <span className="material-symbols-outlined">pause_circle</span>Pause
              </button>
              <button
                type="button"
                onClick={() => onPeekAction('resume')}
                className={`${s.btn} ${s.btnOutline}`}
              >
                <span className="material-symbols-outlined">play_circle</span>Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPAIGN DRAWER (editor) */}
      {drawerOpen && (
        <div className={s.drawer}>
          {/* Header */}
          <div className={s.drawerHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>campaign</span>
              <div style={{ minWidth: 0 }}>
                <div className={s.headlineSm} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editingId ? 'Edit campaign' : 'New campaign'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                  {editingId
                    ? `${campaigns.find((c) => c.id === editingId)?.status ?? ''} · ${editingId}`
                    : 'Draft · not yet published'}
                </div>
              </div>
            </div>
            <IconBtn icon="close" onClick={closeCampDrawer} />
          </div>

          {/* Body */}
          <div className={s.drawerBody} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Campaign basics */}
            <section>
              <div className={s.sectionH}>Campaign basics</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Campaign name">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Fall launch — Prospecting"
                  />
                </Field>
                <Field label="Network">
                  <div className={s.grid2}>
                    {NETWORKS.map((n) => {
                      const on = draftNetwork === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraftNetwork(n)}
                          style={{
                            border: `1px solid ${on ? 'var(--primary)' : 'var(--surface-dim)'}`,
                            borderRadius: 8,
                            padding: 8,
                            background: on ? 'var(--surface-container-low)' : '#fff',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <NetChip net={n} />
                            <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{NETWORK_BLURBS[n]}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Objective">
                  <FieldSelect value={draftObjective} onChange={(e) => setDraftObjective(e.target.value)}>
                    {OBJECTIVE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </FieldSelect>
                </Field>
              </div>
            </section>

            {/* Budget & schedule */}
            <section>
              <div className={s.sectionH}>Budget &amp; schedule</div>
              <div className={s.grid2}>
                <Field label="Budget type">
                  <FieldSelect
                    value={draftBudgetType}
                    onChange={(e) => setDraftBudgetType(e.target.value as BudgetType)}
                  >
                    {BUDGET_TYPES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </FieldSelect>
                </Field>
                <Field label="Amount">
                  <Input
                    type="number"
                    value={draftBudget}
                    onChange={(e) => setDraftBudget(Number(e.target.value) || 0)}
                  />
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
            <section>
              <div className={s.sectionH} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Ad sets</span>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline} ${s.btnSm}`}
                  onClick={() => openAdSetModal(null)}
                >
                  <span className="material-symbols-outlined">add</span>Add ad set
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftAdSets.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>No ad sets yet.</div>
                ) : (
                  draftAdSets.map((a, i) => (
                    <div key={i} className={s.adsetCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{a.name}</div>
                        <button
                          type="button"
                          onClick={() => openAdSetModal(i)}
                          style={{
                            height: 24,
                            padding: '0 8px',
                            border: '1px solid var(--surface-dim)',
                            borderRadius: 4,
                            fontSize: 11,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
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
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--error)' }}>close</span>
                        </button>
                      </div>
                      <div className={s.grid3} style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                        <div>
                          <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>Audience</span>
                          <div style={{ color: 'var(--on-surface)', marginTop: 2 }}>{a.audience}</div>
                        </div>
                        <div>
                          <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>Placement</span>
                          <div style={{ color: 'var(--on-surface)', marginTop: 2 }}>{a.placement}</div>
                        </div>
                        <div>
                          <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>Bid</span>
                          <div style={{ color: 'var(--on-surface)', marginTop: 2 }}>{a.bid}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Creatives */}
            <section>
              <div className={s.sectionH} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Creative selection</span>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline} ${s.btnSm}`}
                  onClick={openCreativeModal}
                >
                  <span className="material-symbols-outlined">perm_media</span>Pick creatives
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draftCreatives.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>No creatives selected.</div>
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
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary)' }}>
                          {creativeIcon(c.type)}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{c.type} · {c.dimensions}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCreative(c.id)}
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
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className={s.drawerFoot} style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={closeCampDrawer}
            >
              Cancel
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={s.splitBtn}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline} ${s.splitBtnMain}`}
                  onClick={saveAndNew}
                >
                  Save and new
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline} ${s.splitBtnArrow}`}
                  onClick={saveAndNew}
                >
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
              </div>
              <div className={s.splitBtn}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary} ${s.splitBtnMain}`}
                  onClick={saveAndClose}
                >
                  Save and close
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary} ${s.splitBtnArrow}`}
                  onClick={saveAndClose}
                >
                  <span className="material-symbols-outlined">expand_more</span>
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
          value={creativeSearch}
          onChange={(e) => setCreativeSearch(e.target.value)}
          placeholder="Search creatives…"
          style={{ marginBottom: 8 }}
        />
        <div
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid var(--surface-dim)',
            borderRadius: 6,
          }}
        >
          {filteredCreatives.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--on-surface-variant)' }}>No creatives match.</div>
          ) : (
            filteredCreatives.map((c) => (
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
                  style={{ accentColor: 'var(--qb-blue)' }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{c.type} · {c.dimensions}</div>
                </div>
              </label>
            ))
          )}
        </div>
      </Modal>

      {/* AD SET EDITOR MODAL */}
      <Modal
        open={adsetModalOpen}
        title="Ad set"
        onClose={() => setAdsetModalOpen(false)}
        size="sm"
        footer={
          <>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline}`}
              onClick={() => setAdsetModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary}`}
              onClick={confirmAdSet}
            >
              {editingAdSetIdx !== null ? 'Save ad set' : 'Add ad set'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '0 0 12px' }}>
          Define audience, placement, and bid strategy for this ad set.
        </p>
        <Field label="Name">
          <Input
            value={adsetName}
            onChange={(e) => setAdsetName(e.target.value)}
            placeholder="Ad set name"
          />
        </Field>
        <Field label="Audience">
          <FieldSelect value={adsetAudience} onChange={(e) => setAdsetAudience(e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </FieldSelect>
        </Field>
        <Field label="Placement">
          <FieldSelect value={adsetPlacement} onChange={(e) => setAdsetPlacement(e.target.value)}>
            {PLACEMENTS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </FieldSelect>
        </Field>
        <Field label="Bid strategy">
          <FieldSelect value={adsetBid} onChange={(e) => setAdsetBid(e.target.value)}>
            {BIDS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </FieldSelect>
        </Field>
      </Modal>
    </div>
  );
}
