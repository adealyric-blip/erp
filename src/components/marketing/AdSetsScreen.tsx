'use client';

/**
 * AdSetsScreen — 1:1 faithful port of /upload/marketing_extracted/Marketing/adsets.html
 * Built on shared MarketingPrimitives. Every button, KPI, tab, filter, column,
 * row-menu item, peek field, and drawer field is replicated from the source.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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
  RowMenu,
  type RowMenuItem,
  Drawer,
  Peek,
  Modal,
  TableWrap,
  Table,
  Field,
  Input,
  Select,
  KvList,
  EmptyState,
  type MarketingScreenProps,
  s,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';

/* ───────────── TYPES ───────────── */
type Status = 'Active' | 'Paused' | 'In review' | 'Draft' | 'Ended';
type Placement = 'Auto' | 'Feed' | 'Stories / Reels' | 'Search';
type Bid = 'Lowest cost' | 'Cost cap' | 'ROAS goal';
type Network = 'Meta' | 'TikTok' | 'Google' | 'Pinterest';

interface Campaign {
  id: string;
  name: string;
  network: Network;
}

interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  network: Network;
  audience: string;
  placement: Placement;
  bid: Bid;
  budget: number;
  spend: number;
  revenue: number;
  roas: number;
  frequency: number;
  status: Status;
  start: string | null;
  end: string | null;
}

interface DrawerForm {
  name: string;
  campaignId: string;
  status: Status;
  audience: string;
  age: string;
  gender: string;
  locations: string;
  placement: Placement;
  bid: Bid;
  budget: number;
  frequency: number;
  start: string;
  end: string;
}

interface SavedView {
  name: string;
  tab: string;
  q: string;
  campaigns: string[];
  placements: string[];
  bids: string[];
}

/* ───────────── CONSTANTS ───────────── */
const PLACEMENTS: Placement[] = ['Auto', 'Feed', 'Stories / Reels', 'Search'];
const BIDS: Bid[] = ['Lowest cost', 'Cost cap', 'ROAS goal'];
const AUDIENCES = [
  'Site visitors 30d',
  'Abandoned cart 7d',
  'Lookalike — VIPs',
  'TikTok engagement 90d',
  'New customers',
];
const AGES = ['All ages', '18-24', '25-34', '35-44', '45-54', '55+'];
const GENDERS = ['All', 'Women', 'Men'];
const STATUSES: Status[] = ['Active', 'Paused', 'Draft', 'In review', 'Ended'];
const TABS = ['All', 'Active', 'Paused', 'In review', 'Draft', 'Ended'];

const CAMPAIGNS: Campaign[] = [
  { id: 'CMP-3001', name: 'Fall launch — Prospecting', network: 'Meta' },
  { id: 'CMP-3002', name: 'TikTok creator drop', network: 'TikTok' },
  { id: 'CMP-3003', name: 'Brand search — Non-brand', network: 'Google' },
  { id: 'CMP-3004', name: 'Holiday capsule lookalike', network: 'Meta' },
  { id: 'CMP-3005', name: 'Pinterest — Evergreen inspo', network: 'Pinterest' },
  { id: 'CMP-3006', name: 'Summer clearance (ended)', network: 'Meta' },
];

const INITIAL_ADSETS: AdSet[] = [
  { id: 'AS-5001', name: 'Fall — Retargeting 30d', campaignId: 'CMP-3001', campaignName: 'Fall launch — Prospecting', network: 'Meta', audience: 'Site visitors 30d', placement: 'Feed', bid: 'Lowest cost', budget: 120, spend: 4210, revenue: 18240, roas: 4.33, frequency: 2.1, status: 'Active', start: '2026-10-15T00:00', end: '2026-11-30T23:59' },
  { id: 'AS-5002', name: 'Fall — Lookalike 2%', campaignId: 'CMP-3001', campaignName: 'Fall launch — Prospecting', network: 'Meta', audience: 'Lookalike — VIPs', placement: 'Auto', bid: 'ROAS goal', budget: 130, spend: 4410, revenue: 18480, roas: 4.19, frequency: 2.8, status: 'Active', start: '2026-10-15T00:00', end: '2026-11-30T23:59' },
  { id: 'AS-5003', name: 'TikTok — Spark ads 25-44', campaignId: 'CMP-3002', campaignName: 'TikTok creator drop', network: 'TikTok', audience: 'TikTok engagement 90d', placement: 'Stories / Reels', bid: 'Lowest cost', budget: 180, spend: 4210, revenue: 12890, roas: 3.06, frequency: 3.4, status: 'Active', start: '2026-10-20T00:00', end: '2026-11-20T23:59' },
  { id: 'AS-5004', name: 'Search — Non-brand exact', campaignId: 'CMP-3003', campaignName: 'Brand search — Non-brand', network: 'Google', audience: 'New customers', placement: 'Search', bid: 'Cost cap', budget: 120, spend: 2310, revenue: 9280, roas: 4.02, frequency: 1.4, status: 'Active', start: '2026-10-01T00:00', end: '2026-12-31T23:59' },
  { id: 'AS-5005', name: 'Holiday — Lookalike 1%', campaignId: 'CMP-3004', campaignName: 'Holiday capsule lookalike', network: 'Meta', audience: 'Lookalike — VIPs', placement: 'Auto', bid: 'Lowest cost', budget: 300, spend: 3280, revenue: 14840, roas: 4.53, frequency: 2.4, status: 'In review', start: '2026-11-05T00:00', end: '2026-12-24T23:59' },
  { id: 'AS-5006', name: 'Pinterest — Evergreen', campaignId: 'CMP-3005', campaignName: 'Pinterest — Evergreen inspo', network: 'Pinterest', audience: 'Site visitors 30d', placement: 'Feed', bid: 'Lowest cost', budget: 80, spend: 0, revenue: 0, roas: 0, frequency: 0, status: 'Draft', start: null, end: null },
  { id: 'AS-5007', name: 'Summer — Retargeting cart', campaignId: 'CMP-3006', campaignName: 'Summer clearance (ended)', network: 'Meta', audience: 'Abandoned cart 7d', placement: 'Feed', bid: 'Lowest cost', budget: 200, spend: 12400, revenue: 38210, roas: 3.08, frequency: 5.8, status: 'Ended', start: '2026-08-01T00:00', end: '2026-09-15T23:59' },
];

/* ───────────── HELPERS ───────────── */
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function nextId(): string {
  return 'AS-' + (5000 + Math.floor(Math.random() * 95000));
}

function emptyForm(): DrawerForm {
  return {
    name: '',
    campaignId: CAMPAIGNS[0].id,
    status: 'Draft',
    audience: AUDIENCES[0],
    age: 'All ages',
    gender: 'All',
    locations: 'United States',
    placement: 'Auto',
    bid: 'Lowest cost',
    budget: 100,
    frequency: 2,
    start: new Date().toISOString().slice(0, 16),
    end: '',
  };
}

function formFromAdset(a: AdSet): DrawerForm {
  return {
    name: a.name,
    campaignId: a.campaignId,
    status: a.status,
    audience: a.audience,
    age: 'All ages',
    gender: 'All',
    locations: 'United States',
    placement: a.placement,
    bid: a.bid,
    budget: a.budget,
    frequency: a.frequency,
    start: a.start ? a.start.slice(0, 16) : '',
    end: a.end ? a.end.slice(0, 16) : '',
  };
}

/* ───────────── INLINE FILTER POPOVER ─────────────
   Matches HTML exactly: local draft state, deferred commit on Apply,
   Clear resets to all options and commits. */
function FilterPopover({
  label,
  icon,
  options,
  selected,
  minWidth = 220,
  onApply,
  onClear,
}: {
  label: string;
  icon?: string;
  options: string[];
  selected: Set<string>;
  minWidth?: number;
  onApply: (next: Set<string>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(selected);
  const ref = useRef<HTMLDivElement>(null);

  // Sync the draft to the parent's current selection at the moment of opening
  // (not inside useEffect — that triggers cascading renders per react-hooks rules).
  const handleToggle = () => {
    if (!open) setDraft(new Set(selected));
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const toggle = (v: string) => {
    const n = new Set(draft);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setDraft(n);
  };
  const hasFilter = draft.size > 0 && draft.size < options.length;

  return (
    <div className={s.relative} ref={ref}>
      <button
        type="button"
        className={`${s.filterBtn} ${hasFilter ? 'hasFilter' : ''}`}
        onClick={handleToggle}
      >
        {icon && <span className="material-symbols-outlined">{icon}</span>}
        {label}
        {hasFilter && <span style={{ marginLeft: 4, fontWeight: 700 }}>{draft.size}</span>}
      </button>
      {open && (
        <div className={s.popover} style={{ minWidth }}>
          <div className={s.menuHeader}>Filter by {label.toLowerCase()}</div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {options.map((o) => (
              <label key={o} className={s.popoverCheckRow}>
                <input type="checkbox" checked={draft.has(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
          <div className={s.popoverSep} />
          <div className={s.popoverFoot}>
            <button
              type="button"
              className={`${s.btn} ${s.btnOutline} ${s.btnSm}`}
              onClick={() => {
                const all = new Set(options);
                setDraft(all);
                onClear();
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── INLINE SAVED-VIEWS POPOVER ─────────────
   Real functional saved views: load a view to restore filters, save the
   current filter state under a typed name. */
function SavedViewsPopover({
  views,
  onLoad,
  onSave,
  onDelete,
}: {
  views: SavedView[];
  onLoad: (v: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
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
    <div className={s.relative} ref={ref}>
      <button
        type="button"
        className={`${s.filterBtn} ${views.length > 0 ? 'hasFilter' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined">bookmark</span>Saved views
      </button>
      {open && (
        <div className={s.popover} style={{ minWidth: 260 }}>
          <div className={s.menuHeader}>Saved views</div>
          {views.length === 0 ? (
            <div className={s.popoverItem} style={{ color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
              No saved views yet
            </div>
          ) : (
            views.map((v) => (
              <div
                key={v.name}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}
              >
                <button
                  type="button"
                  className={s.popoverItem}
                  style={{ flex: 1 }}
                  onClick={() => {
                    onLoad(v);
                    setOpen(false);
                  }}
                >
                  <span className="material-symbols-outlined">bookmark</span>
                  {v.name}
                </button>
                <button
                  type="button"
                  className={s.btnIcon}
                  style={{ width: 24, height: 24, border: 0 }}
                  title="Delete view"
                  onClick={() => onDelete(v.name)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    close
                  </span>
                </button>
              </div>
            ))
          )}
          <div className={s.popoverSep} />
          <div style={{ padding: 8, display: 'flex', gap: 6 }}>
            <input
              className={s.fieldInput}
              style={{ height: 30, fontSize: 12 }}
              placeholder="View name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
              disabled={!name.trim()}
              onClick={() => {
                onSave(name.trim());
                setName('');
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── MAIN SCREEN ───────────── */
export default function AdSetsScreen({ onToast, onNavigate }: MarketingScreenProps) {
  /* ── state ── */
  const [adsets, setAdsets] = useState<AdSet[]>(INITIAL_ADSETS);
  const [tab, setTab] = useState<string>('All');
  const [q, setQ] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<Set<string>>(
    new Set(CAMPAIGNS.map((c) => c.id)),
  );
  const [placementFilter, setPlacementFilter] = useState<Set<string>>(new Set(PLACEMENTS));
  const [bidFilter, setBidFilter] = useState<Set<string>>(new Set(BIDS));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DrawerForm>(emptyForm);
  const [confirmDel, setConfirmDel] = useState<{ ids: string[] } | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState<Record<string, boolean>>({
    campaign: true,
    audience: true,
    placement: true,
    bid: true,
    budget: true,
    spend: true,
    roas: true,
  });

  /* ── derived ── */
  const filtered = useMemo(() => {
    return adsets.filter((a) => {
      const ql = q.toLowerCase();
      const qOK =
        !ql ||
        (a.id + ' ' + a.name + ' ' + a.campaignName + ' ' + a.audience + ' ' + a.network)
          .toLowerCase()
          .includes(ql);
      const tabOK = tab === 'All' || a.status === tab;
      const campOK = campaignFilter.has(a.campaignId);
      const placeOK = placementFilter.has(a.placement);
      const bidOK = bidFilter.has(a.bid);
      return qOK && tabOK && campOK && placeOK && bidOK;
    });
  }, [adsets, q, tab, campaignFilter, placementFilter, bidFilter]);

  const activeSets = adsets.filter((a) => a.status === 'Active');
  const avgRoas = activeSets.length
    ? activeSets.reduce((sum, a) => sum + a.roas, 0) / activeSets.length
    : 0;
  const maxFreq = adsets.reduce((m, a) => Math.max(m, a.frequency || 0), 0);

  const allChecked = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someChecked = filtered.some((a) => selected.has(a.id));

  const peekAdset = peekId ? adsets.find((a) => a.id === peekId) : null;
  const editingAdset = editId ? adsets.find((a) => a.id === editId) ?? null : null;

  const hasActiveFilters =
    !!q ||
    tab !== 'All' ||
    campaignFilter.size !== CAMPAIGNS.length ||
    placementFilter.size !== PLACEMENTS.length ||
    bidFilter.size !== BIDS.length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  /* ── selection ── */
  const toggleAll = () => {
    if (allChecked) {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((a) => n.delete(a.id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        filtered.forEach((a) => n.add(a.id));
        return n;
      });
    }
  };
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  /* ── export ── */
  const handleExport = () => {
    exportToCsv(
      filtered.map((a) => ({
        id: a.id,
        name: a.name,
        campaign: a.campaignName,
        network: a.network,
        audience: a.audience,
        placement: a.placement,
        bid: a.bid,
        budget: a.budget,
        spend: a.spend,
        revenue: a.revenue,
        roas: a.roas,
        frequency: a.frequency,
        status: a.status,
        start: a.start ?? '',
        end: a.end ?? '',
      })),
      [
        { key: 'id', label: 'Ad set ID' },
        { key: 'name', label: 'Name' },
        { key: 'campaign', label: 'Campaign' },
        { key: 'network', label: 'Network' },
        { key: 'audience', label: 'Audience' },
        { key: 'placement', label: 'Placement' },
        { key: 'bid', label: 'Bid strategy' },
        { key: 'budget', label: 'Daily budget' },
        { key: 'spend', label: 'Spend (30d)' },
        { key: 'revenue', label: 'Revenue (30d)' },
        { key: 'roas', label: 'ROAS' },
        { key: 'frequency', label: 'Frequency' },
        { key: 'status', label: 'Status' },
        { key: 'start', label: 'Start' },
        { key: 'end', label: 'End' },
      ],
      'adsets',
    );
    onToast(`Exported ${filtered.length} ad set(s).`);
  };

  /* ── editor openers ── */
  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setEditorOpen(true);
    setPeekId(null);
  };
  const openEdit = (id: string) => {
    const a = adsets.find((x) => x.id === id);
    if (!a) return;
    setEditId(id);
    setForm(formFromAdset(a));
    setEditorOpen(true);
    setPeekId(null);
  };

  /* ── editor save ── */
  const collect = (): AdSet | null => {
    const name = form.name.trim();
    if (!name) {
      onToast('Ad set name is required');
      return null;
    }
    const campaign = CAMPAIGNS.find((c) => c.id === form.campaignId);
    const existing = editId ? adsets.find((a) => a.id === editId) : null;
    return {
      id: editId || nextId(),
      name,
      campaignId: form.campaignId,
      campaignName: campaign ? campaign.name : '—',
      network: campaign ? campaign.network : 'Meta',
      audience: form.audience,
      placement: form.placement,
      bid: form.bid,
      budget: form.budget,
      spend: existing ? existing.spend : 0,
      revenue: existing ? existing.revenue : 0,
      roas: existing ? existing.roas : 0,
      frequency: form.frequency,
      status: form.status,
      start: form.start || null,
      end: form.end || null,
    };
  };

  const saveAndClose = () => {
    const a = collect();
    if (!a) return;
    if (editId) {
      setAdsets((prev) => prev.map((x) => (x.id === editId ? a : x)));
      onToast('Ad set updated');
    } else {
      setAdsets((prev) => [a, ...prev]);
      onToast('Ad set created');
    }
    setEditorOpen(false);
    setEditId(null);
  };
  const saveAndNew = () => {
    const a = collect();
    if (!a) return;
    if (editId) {
      setAdsets((prev) => prev.map((x) => (x.id === editId ? a : x)));
    } else {
      setAdsets((prev) => [a, ...prev]);
    }
    setEditId(null);
    setForm(emptyForm());
    onToast('Saved. New ad set form ready.');
  };

  /* ── single-row actions ── */
  const duplicateAdset = (id: string) => {
    const a = adsets.find((x) => x.id === id);
    if (!a) return;
    const copy: AdSet = {
      ...a,
      id: nextId(),
      name: a.name + ' (copy)',
      status: 'Draft',
      spend: 0,
      revenue: 0,
      roas: 0,
      frequency: 0,
    };
    setAdsets((prev) => [copy, ...prev]);
    setPeekId(null);
    onToast(`Duplicated: ${a.name}`);
  };
  const pauseAdset = (id: string) => {
    const a = adsets.find((x) => x.id === id);
    if (!a) return;
    setAdsets((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'Paused' } : x)));
    setPeekId(null);
    onToast(`Paused: ${a.name}`);
  };
  const resumeAdset = (id: string) => {
    const a = adsets.find((x) => x.id === id);
    if (!a) return;
    setAdsets((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'Active' } : x)));
    setPeekId(null);
    onToast(`Resumed: ${a.name}`);
  };
  const archiveAdset = (id: string) => {
    const a = adsets.find((x) => x.id === id);
    if (!a) return;
    setAdsets((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'Ended' } : x)));
    setPeekId(null);
    onToast(`Archived: ${a.name}`);
  };
  const deleteAdset = (id: string) => {
    setConfirmDel({ ids: [id] });
  };

  /* ── bulk actions ── */
  const bulkPause = () => {
    const n = selected.size;
    setAdsets((prev) =>
      prev.map((x) => (selected.has(x.id) ? { ...x, status: 'Paused' as Status } : x)),
    );
    onToast(`Paused ${n} ad set(s)`);
    setSelected(new Set());
  };
  const bulkResume = () => {
    const n = selected.size;
    setAdsets((prev) =>
      prev.map((x) => (selected.has(x.id) ? { ...x, status: 'Active' as Status } : x)),
    );
    onToast(`Resumed ${n} ad set(s)`);
    setSelected(new Set());
  };
  const bulkDuplicate = () => {
    const n = selected.size;
    const copies: AdSet[] = adsets
      .filter((a) => selected.has(a.id))
      .map((a) => ({
        ...a,
        id: nextId(),
        name: a.name + ' (copy)',
        status: 'Draft',
        spend: 0,
        revenue: 0,
        roas: 0,
        frequency: 0,
      }));
    setAdsets((prev) => [...copies, ...prev]);
    onToast(`Duplicated ${n} ad set(s)`);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    if (selected.size === 0) return;
    setConfirmDel({ ids: [...selected] });
  };
  const confirmDelete = () => {
    if (!confirmDel) return;
    const ids = new Set(confirmDel.ids);
    const n = ids.size;
    setAdsets((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPeekId(null);
    onToast(`Deleted ${n} ad set(s)`);
    setConfirmDel(null);
  };

  /* ── filter helpers ── */
  const clearAll = () => {
    setQ('');
    setTab('All');
    setCampaignFilter(new Set(CAMPAIGNS.map((c) => c.id)));
    setPlacementFilter(new Set(PLACEMENTS));
    setBidFilter(new Set(BIDS));
    setPage(1);
  };

  /* ── saved views ── */
  const snapshotFilters = (): SavedView => ({
    name: '',
    tab,
    q,
    campaigns: [...campaignFilter],
    placements: [...placementFilter],
    bids: [...bidFilter],
  });
  const saveView = (name: string) => {
    if (savedViews.some((v) => v.name === name)) {
      onToast(`View "${name}" already exists`);
      return;
    }
    setSavedViews((prev) => [...prev, { ...snapshotFilters(), name }]);
    onToast(`Saved view "${name}"`);
  };
  const loadView = (v: SavedView) => {
    setTab(v.tab);
    setQ(v.q);
    setCampaignFilter(new Set(v.campaigns));
    setPlacementFilter(new Set(v.placements));
    setBidFilter(new Set(v.bids));
    setPage(1);
    onToast(`Loaded view "${v.name}"`);
  };
  const deleteView = (name: string) => {
    setSavedViews((prev) => prev.filter((v) => v.name !== name));
    onToast(`Deleted view "${name}"`);
  };

  /* ── row menu items ── */
  const rowMenuItems = (a: AdSet): RowMenuItem[] => [
    {
      header: 'This ad set',
      label: 'Edit ad set',
      icon: 'edit',
      onClick: () => openEdit(a.id),
    },
    { label: 'View details', icon: 'visibility', onClick: () => setPeekId(a.id) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => duplicateAdset(a.id) },
    {
      sepBefore: true,
      header: 'Status',
      label: 'Pause',
      icon: 'pause_circle',
      onClick: () => pauseAdset(a.id),
    },
    { label: 'Resume', icon: 'play_circle', onClick: () => resumeAdset(a.id) },
    { label: 'Archive', icon: 'archive', onClick: () => archiveAdset(a.id) },
    {
      sepBefore: true,
      label: 'Delete',
      icon: 'delete',
      onClick: () => deleteAdset(a.id),
      danger: true,
    },
  ];

  /* ── pagination handlers ── */
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  /* ───────────── RENDER ───────────── */
  return (
    <div className={s.screen}>
      <main style={{ padding: '0 24px 48px' }}>
        {/* BREADCRUMB */}
        <Breadcrumb items={[{ label: 'Advertising' }, { label: 'Ad sets', current: true }]} />

        {/* PAGE HEADER */}
        <PageHeader
          title="Ad sets"
          subtitle="Every ad set across campaigns — audiences, placements, bid strategies, and delivery."
        >
          <Btn variant="outline" icon="download" onClick={handleExport}>
            Export
          </Btn>
          <Btn variant="outline" icon="tune" onClick={() => setCustomizeOpen(true)}>
            Customize
          </Btn>
          <SplitButton
            icon="add"
            label="New ad set"
            onClick={openNew}
            menu={[
              { label: 'Ad set', icon: 'tune', onClick: openNew },
              {
                label: 'Campaign',
                icon: 'campaign',
                onClick: () => onNavigate?.('marketing', 'campaigns'),
              },
              {
                label: 'Creative',
                icon: 'perm_media',
                onClick: () => onNavigate?.('marketing', 'creatives'),
              },
              {
                label: 'Audience',
                icon: 'groups',
                onClick: () => onNavigate?.('marketing', 'audiences'),
              },
            ]}
          />
        </PageHeader>

        {/* KPI STRIP */}
        <KpiStrip>
          <KpiCard label="Total ad sets" value={adsets.length} sub="Across all campaigns" />
          <KpiCard label="Active delivery" value={activeSets.length} sub="Currently spending" />
          <KpiCard label="Avg. ROAS" value={`${avgRoas.toFixed(2)}×`} sub="Across active sets" />
          <KpiCard label="Audience saturation" value={`${maxFreq.toFixed(1)}×`} sub="Highest frequency" />
        </KpiStrip>

        {/* LIST CARD */}
        <div className={s.card}>
          {/* STATUS TABS */}
          <StatusTabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); setPage(1); }} />

          {/* FILTER BAR */}
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Filter ad sets…" />
            <FilterPopover
              label="Campaign"
              icon="campaign"
              options={CAMPAIGNS.map((c) => c.name)}
              selected={new Set(
                [...campaignFilter].map(
                  (id) => CAMPAIGNS.find((c) => c.id === id)?.name ?? '',
                ),
              )}
              minWidth={260}
              onApply={(next) => {
                const ids = new Set<string>();
                next.forEach((name) => {
                  const c = CAMPAIGNS.find((c) => c.name === name);
                  if (c) ids.add(c.id);
                });
                setCampaignFilter(ids);
                setPage(1);
              }}
              onClear={() => {
                setCampaignFilter(new Set(CAMPAIGNS.map((c) => c.id)));
                setPage(1);
              }}
            />
            <FilterPopover
              label="Placement"
              icon="grid_view"
              options={PLACEMENTS}
              selected={placementFilter}
              onApply={(next) => { setPlacementFilter(next); setPage(1); }}
              onClear={() => { setPlacementFilter(new Set(PLACEMENTS)); setPage(1); }}
            />
            <FilterPopover
              label="Bid"
              icon="price_change"
              options={BIDS}
              selected={bidFilter}
              onApply={(next) => { setBidFilter(next); setPage(1); }}
              onClear={() => { setBidFilter(new Set(BIDS)); setPage(1); }}
            />
            <SavedViewsPopover
              views={savedViews}
              onLoad={loadView}
              onSave={saveView}
              onDelete={deleteView}
            />
            {hasActiveFilters && (
              <Btn variant="outline" sm icon="filter_alt_off" onClick={clearAll}>
                Clear all
              </Btn>
            )}
            <span
              className={s.textMut}
              style={{ marginLeft: 'auto', fontSize: 11 }}
            >
              {filtered.length} of {adsets.length}
            </span>
          </FilterBar>

          {/* BULK BAR (only when there is a selection) */}
          {selected.size > 0 && (
            <div className={s.bulkBar}>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{selected.size} selected</span>
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
              <button type="button" onClick={bulkPause}>
                <span className="material-symbols-outlined">pause_circle</span>Pause
              </button>
              <button type="button" onClick={bulkResume}>
                <span className="material-symbols-outlined">play_circle</span>Resume
              </button>
              <button type="button" onClick={bulkDuplicate}>
                <span className="material-symbols-outlined">content_copy</span>Duplicate
              </button>
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
              <button type="button" onClick={bulkDelete}>
                <span className="material-symbols-outlined">delete</span>Delete
              </button>
              <button
                type="button"
                style={{ marginLeft: 'auto' }}
                onClick={() => setSelected(new Set())}
                title="Clear selection"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          )}

          {/* TABLE */}
          <TableWrap>
            {filtered.length === 0 ? (
              <div className={s.empty}>
                <span className="material-symbols-outlined">tune</span>
                <h3>No ad sets match</h3>
                <p>Clear filters or create a new ad set.</p>
                <div style={{ marginTop: 12 }}>
                  <Btn variant="outline" onClick={clearAll}>
                    Clear filters
                  </Btn>
                </div>
              </div>
            ) : (
              <Table
                head={
                  <tr>
                    <th className={s.checkCell}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked && !allChecked;
                        }}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Ad set</th>
                    {columns.campaign && <th>Campaign</th>}
                    {columns.audience && <th>Audience</th>}
                    {columns.placement && <th>Placement</th>}
                    {columns.bid && <th>Bid</th>}
                    {columns.budget && <th className={s.right}>Budget (daily)</th>}
                    {columns.spend && <th className={s.right}>Spend (30d)</th>}
                    {columns.roas && <th className={s.right}>ROAS</th>}
                    <th>Status</th>
                    <th />
                  </tr>
                }
              >
                {pageRows.map((a) => (
                  <tr key={a.id} onClick={() => setPeekId(a.id)}>
                    <td
                      className={s.checkCell}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleRow(a.id)}
                      />
                    </td>
                    <td>
                      <div className={s.rowName}>{a.name}</div>
                      <div className={s.rowSub}>{a.id}</div>
                    </td>
                    {columns.campaign && (
                      <td>
                        <div>{a.campaignName}</div>
                        <div className={s.rowSub}>
                          <NetChip net={a.network} />
                        </div>
                      </td>
                    )}
                    {columns.audience && <td>{a.audience}</td>}
                    {columns.placement && <td>{a.placement}</td>}
                    {columns.bid && <td>{a.bid}</td>}
                    {columns.budget && (
                      <td className={s.right + ' ' + s.tabularNums}>${a.budget}/d</td>
                    )}
                    {columns.spend && (
                      <td className={s.right + ' ' + s.tabularNums}>
                        ${a.spend.toLocaleString()}
                      </td>
                    )}
                    {columns.roas && (
                      <td className={s.right + ' ' + s.tabularNums}>
                        {a.roas ? a.roas.toFixed(2) + '×' : '—'}
                      </td>
                    )}
                    <td>
                      <StatusPill status={a.status} />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowMenu items={rowMenuItems(a)} />
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </TableWrap>

          {/* PAGINATION */}
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
                className={s.fieldSelect}
                style={{ height: 22, fontSize: 11, padding: '0 22px 0 6px', width: 'auto' }}
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(1);
                  onToast('Rows per page updated');
                }}
              >
                {[25, 50, 75, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className={s.btnIcon}
                style={{ width: 24, height: 24, border: 0 }}
                onClick={goPrev}
                disabled={currentPage <= 1}
                title="Previous page"
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
                className={s.btnIcon}
                style={{ width: 24, height: 24, border: 0 }}
                onClick={goNext}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ═════════════ PEEK DRAWER ═════════════ */}
      <Peek
        open={!!peekAdset}
        title={peekAdset?.name ?? 'Ad set'}
        subtitle={
          peekAdset ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <StatusPill status={peekAdset.status} />
              <NetChip net={peekAdset.network} />
            </span>
          ) : undefined
        }
        onClose={() => setPeekId(null)}
      >
        {peekAdset && (
          <>
            {/* mini-KPI grid */}
            <div
              className={s.card}
              style={{ background: 'var(--surface-container-low)', padding: 12, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}
            >
              <div>
                <div className={s.kpiLabel}>Spend</div>
                <div className={s.kpiValue} style={{ fontSize: 14 }}>
                  ${peekAdset.spend.toLocaleString()}
                </div>
              </div>
              <div>
                <div className={s.kpiLabel}>Revenue</div>
                <div className={s.kpiValue} style={{ fontSize: 14 }}>
                  ${peekAdset.revenue.toLocaleString()}
                </div>
              </div>
              <div>
                <div className={s.kpiLabel}>ROAS</div>
                <div className={s.kpiValue} style={{ fontSize: 14 }}>
                  {peekAdset.roas ? peekAdset.roas.toFixed(2) + '×' : '—'}
                </div>
              </div>
            </div>

            <KvList
              items={[
                { k: 'Ad set ID', v: <span className={s.mono}>{peekAdset.id}</span> },
                { k: 'Campaign', v: peekAdset.campaignName },
                { k: 'Audience', v: peekAdset.audience },
                { k: 'Placement', v: peekAdset.placement },
                { k: 'Bid strategy', v: peekAdset.bid },
                { k: 'Daily budget', v: <span className={s.tabularNums}>${peekAdset.budget}</span> },
                {
                  k: 'Frequency',
                  v: <span className={s.tabularNums}>{peekAdset.frequency.toFixed(1)}×</span>,
                },
                { k: 'Start', v: fmtDate(peekAdset.start) },
                { k: 'End', v: fmtDate(peekAdset.end) },
              ]}
            />

            {/* Action buttons — 2-col grid, matches HTML body grid */}
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
              <Btn
                variant="primary"
                icon="edit"
                onClick={() => peekAdset && openEdit(peekAdset.id)}
              >
                Edit
              </Btn>
              <Btn
                variant="outline"
                icon="content_copy"
                onClick={() => peekAdset && duplicateAdset(peekAdset.id)}
              >
                Duplicate
              </Btn>
              <Btn
                variant="outline"
                icon="pause_circle"
                onClick={() => peekAdset && pauseAdset(peekAdset.id)}
              >
                Pause
              </Btn>
              <Btn
                variant="outline"
                icon="play_circle"
                onClick={() => peekAdset && resumeAdset(peekAdset.id)}
              >
                Resume
              </Btn>
            </div>
          </>
        )}
      </Peek>

      {/* ═════════════ EDITOR DRAWER ═════════════ */}
      <Drawer
        open={editorOpen}
        title={editId ? 'Edit ad set' : 'New ad set'}
        subtitle={
          editingAdset ? (
            <span>
              {editingAdset.status} · {editingAdset.id}
            </span>
          ) : (
            'Draft · not yet active'
          )
        }
        onClose={() => {
          setEditorOpen(false);
          setEditId(null);
        }}
        width={640}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Btn
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                setEditId(null);
              }}
            >
              Cancel
            </Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Save and new — split (outline) */}
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
                  title="More save options"
                >
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
              </div>
              {/* Save and close — split (primary) */}
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
                  title="More save options"
                >
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
              </div>
            </div>
          </div>
        }
      >
        {/* BASICS */}
        <section style={{ marginBottom: 20 }}>
          <div className={s.sectionH}>Ad set basics</div>
          <div className={s.flexCol} style={{ gap: 12 }}>
            <Field label="Name">
              <Input
                placeholder="e.g. Site visitors — 30d — Fall"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </Field>
            <Field label="Campaign">
              <Select
                value={form.campaignId}
                onChange={(e) => setForm((p) => ({ ...p, campaignId: e.target.value }))}
              >
                {CAMPAIGNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Status }))}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        {/* AUDIENCE */}
        <section style={{ marginBottom: 20 }}>
          <div className={s.sectionH}>Audience</div>
          <div className={s.flexCol} style={{ gap: 12 }}>
            <Field label="Audience">
              <Select
                value={form.audience}
                onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}
              >
                {AUDIENCES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Field>
            <div className={s.fieldRow}>
              <Field label="Age">
                <Select
                  value={form.age}
                  onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                >
                  {AGES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Gender">
                <Select
                  value={form.gender}
                  onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Locations">
              <Input
                placeholder="e.g. United States, Canada"
                value={form.locations}
                onChange={(e) => setForm((p) => ({ ...p, locations: e.target.value }))}
              />
            </Field>
          </div>
        </section>

        {/* PLACEMENT & BID */}
        <section style={{ marginBottom: 20 }}>
          <div className={s.sectionH}>Placement &amp; bid</div>
          <div className={s.fieldRow}>
            <Field label="Placement">
              <Select
                value={form.placement}
                onChange={(e) =>
                  setForm((p) => ({ ...p, placement: e.target.value as Placement }))
                }
              >
                {PLACEMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bid strategy">
              <Select
                value={form.bid}
                onChange={(e) => setForm((p) => ({ ...p, bid: e.target.value as Bid }))}
              >
                {BIDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Daily budget">
              <Input
                type="number"
                value={form.budget}
                onChange={(e) =>
                  setForm((p) => ({ ...p, budget: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="Frequency cap">
              <Input
                type="number"
                value={form.frequency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, frequency: Number(e.target.value) || 0 }))
                }
              />
            </Field>
          </div>
        </section>

        {/* SCHEDULE */}
        <section>
          <div className={s.sectionH}>Schedule</div>
          <div className={s.fieldRow}>
            <Field label="Start">
              <Input
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
              />
            </Field>
            <Field label="End (optional)">
              <Input
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
              />
            </Field>
          </div>
        </section>
      </Drawer>

      {/* ═════════════ CONFIRM DELETE MODAL ═════════════ */}
      <Modal
        open={!!confirmDel}
        title="Delete ad set(s)?"
        onClose={() => setConfirmDel(null)}
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setConfirmDel(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" icon="delete" onClick={confirmDelete}>
              Delete
            </Btn>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          This will permanently delete {confirmDel?.ids.length ?? 0} ad set(s). This cannot be
          undone.
        </p>
      </Modal>

      {/* ═════════════ CUSTOMIZE COLUMNS MODAL ═════════════ */}
      <Modal
        open={customizeOpen}
        title="Customize columns"
        onClose={() => setCustomizeOpen(false)}
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setCustomizeOpen(false)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={() => {
                setCustomizeOpen(false);
                onToast('Columns updated');
              }}
            >
              Done
            </Btn>
          </>
        }
      >
        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--on-surface-variant)' }}>
          Toggle which columns appear in the ad sets table.
        </p>
        <div className={s.flexCol} style={{ gap: 4 }}>
          {Object.keys(columns).map((k) => (
            <label key={k} className={s.popoverCheckRow}>
              <input
                type="checkbox"
                checked={columns[k]}
                onChange={(e) => setColumns({ ...columns, [k]: e.target.checked })}
              />
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
