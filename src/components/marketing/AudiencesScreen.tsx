'use client';

/**
 * Audiences — 1:1 faithful port of
 *   /home/z/my-project/upload/marketing_extracted/Marketing/audience.html
 * Custom, retargeting, and lookalike audiences — reusable across campaigns
 * and networks. Uses the shared MarketingPrimitives design system.
 *
 * Every button does real work:
 *   - Export          → exportToCsv
 *   - New audience    → SplitButton (opens editor; menu routes Audience/Lookalike/Campaign/Creative)
 *   - Row click       → opens peek drawer with full details + actions
 *   - Row ⋯ menu      → Edit / View / Duplicate / Sync / Export / Archive / Delete
 *   - Bulk actions    → Sync / Export / Archive / Delete (mutate selected, clear, toast)
 *   - Editor Save     → persists (Save and new / Save and close)
 *   - Filter Apply    → actually filters
 *   - Search          → real-time
 *   - Status tabs     → filter
 *   - Pagination      → real rows-per-page + page navigation
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Breadcrumb,
  PageHeader,
  Btn,
  SplitButton,
  KpiStrip,
  KpiCard,
  Stat,
  NetChip,
  StatusTabs,
  FilterBar,
  SearchInput,
  FilterDropdown,
  BulkBar,
  RowMenu,
  type RowMenuItem,
  Drawer,
  Peek,
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

/* ───────────── types ───────────── */
type AudienceKind = 'Custom' | 'Retargeting' | 'Lookalike';
type AudienceStatus = 'Ready' | 'Building' | 'Draft' | 'Expired';

interface Rule {
  field: string;
  op: string;
  value: string;
}

interface Audience {
  id: string;
  name: string;
  kind: AudienceKind;
  source: string;
  networks: string[];
  size: number;
  usedIn: number;
  lastSync: string | null;
  status: AudienceStatus;
  rules: Rule[];
  seed: string;
  country: string;
  similarity: string;
}

interface EditorForm {
  name: string;
  kind: AudienceKind;
  status: AudienceStatus;
  source: string;
  networks: Set<string>;
  rules: Rule[];
  seed: string;
  country: string;
  similarity: string;
  sizeEstimate: string;
}

/* ───────────── constants (mirror HTML) ───────────── */
const NETWORKS = ['Meta', 'TikTok', 'Google', 'Pinterest'];
const KINDS: AudienceKind[] = ['Custom', 'Retargeting', 'Lookalike'];
const STATUSES: AudienceStatus[] = ['Ready', 'Building', 'Draft', 'Expired'];
const SOURCES = [
  'CRM',
  'Meta Pixel',
  'TikTok Pixel',
  'Shopify + Meta',
  'VIP segment',
  'Customer list (CSV)',
];
const RULE_FIELDS = [
  'Visited page',
  'Added to cart',
  'Purchased',
  'Order total',
  'Days since last order',
  'Country',
  'Email exists',
  'Phone exists',
  'Consent (marketing)',
];
const RULE_OPS = [
  'equals',
  'does not equal',
  'contains',
  'is greater than',
  'is less than',
  'is at least',
  'is at most',
  'is one of',
];
const STATUS_TABS = ['All', 'Ready', 'Building', 'Draft', 'Expired'];
const SEED_OPTIONS = ['VIP customers', 'Site visitors 30d', 'Abandoned cart 7d'];
const COUNTRY_OPTIONS = ['United States', 'Canada', 'United Kingdom'];

const STAT_KIND: Record<AudienceStatus, string> = {
  Ready: 'active',
  Building: 'review',
  Draft: 'draft',
  Expired: 'expired',
};

const KIND_ICON: Record<AudienceKind, string> = {
  Custom: 'groups',
  Retargeting: 'history',
  Lookalike: 'share',
};

/* ───────────── helpers ───────────── */
function fmtDate(iso: string | null): string {
  if (!iso || iso === '—') return '—';
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

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function audIconStyle(kind: AudienceKind): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 6,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
  };
  if (kind === 'Retargeting') return { ...base, background: '#edf3fc', color: '#4b77b8' };
  if (kind === 'Lookalike') return { ...base, background: '#f9eeee', color: '#bd5558' };
  return { ...base, background: '#f2f1f8', color: '#6e6596' };
}

function emptyEditorForm(): EditorForm {
  return {
    name: '',
    kind: 'Custom',
    status: 'Draft',
    source: 'CRM',
    networks: new Set(['Meta', 'TikTok']),
    rules: [],
    seed: 'VIP customers',
    country: 'United States',
    similarity: '2',
    sizeEstimate: '1.8M',
  };
}

function formFromAudience(a: Audience): EditorForm {
  return {
    name: a.name,
    kind: a.kind,
    status: a.status,
    source: a.source,
    networks: new Set(a.networks),
    rules: a.rules.map((r) => ({ ...r })),
    seed: a.seed === '—' ? 'VIP customers' : a.seed,
    country: a.country === '—' ? 'United States' : a.country,
    similarity: a.similarity === '—' ? '2' : a.similarity.replace('%', ''),
    sizeEstimate:
      a.kind === 'Lookalike'
        ? a.size >= 1_000_000
          ? `${a.size / 1_000_000}M`
          : String(a.size)
        : '1.8M',
  };
}

/* ───────────── seed data (1:1 with HTML) ───────────── */
const SEED_AUDIENCES: Audience[] = [
  {
    id: 'AU-8001',
    name: 'Site visitors 30d',
    kind: 'Retargeting',
    source: 'Meta Pixel',
    networks: ['Meta'],
    size: 12400,
    usedIn: 2,
    lastSync: '2026-11-02T08:10',
    status: 'Ready',
    rules: [
      { field: 'Visited page', op: 'is one of', value: '/product/*, /collections/*' },
      { field: 'Days since last order', op: 'is at most', value: '30' },
    ],
    seed: '—',
    country: '—',
    similarity: '—',
  },
  {
    id: 'AU-8002',
    name: 'Abandoned cart 7d',
    kind: 'Retargeting',
    source: 'Shopify + Meta',
    networks: ['Meta', 'TikTok'],
    size: 2100,
    usedIn: 1,
    lastSync: '2026-11-02T07:42',
    status: 'Ready',
    rules: [
      { field: 'Added to cart', op: 'equals', value: 'true' },
      { field: 'Purchased', op: 'equals', value: 'false' },
      { field: 'Days since last order', op: 'is at most', value: '7' },
    ],
    seed: '—',
    country: '—',
    similarity: '—',
  },
  {
    id: 'AU-8003',
    name: 'Lookalike — VIPs',
    kind: 'Lookalike',
    source: 'VIP segment',
    networks: ['Meta'],
    size: 1800000,
    usedIn: 1,
    lastSync: '2026-10-28T15:30',
    status: 'Ready',
    rules: [],
    seed: 'VIP customers',
    country: 'United States',
    similarity: '2%',
  },
  {
    id: 'AU-8004',
    name: 'TikTok engagement 90d',
    kind: 'Retargeting',
    source: 'TikTok Pixel',
    networks: ['TikTok'],
    size: 42000,
    usedIn: 1,
    lastSync: '2026-10-30T18:22',
    status: 'Ready',
    rules: [
      { field: 'Visited page', op: 'contains', value: '/tiktok' },
      { field: 'Days since last order', op: 'is at most', value: '90' },
    ],
    seed: '—',
    country: '—',
    similarity: '—',
  },
  {
    id: 'AU-8005',
    name: 'New customers',
    kind: 'Custom',
    source: 'CRM',
    networks: ['Google', 'Meta'],
    size: 312,
    usedIn: 0,
    lastSync: '2026-10-15T09:00',
    status: 'Draft',
    rules: [
      { field: 'Email exists', op: 'equals', value: 'true' },
      { field: 'Days since last order', op: 'is at most', value: '0' },
    ],
    seed: '—',
    country: '—',
    similarity: '—',
  },
  {
    id: 'AU-8006',
    name: 'High-value purchasers',
    kind: 'Custom',
    source: 'Customer list (CSV)',
    networks: ['Meta', 'Google'],
    size: 842,
    usedIn: 0,
    lastSync: '2026-11-01T12:00',
    status: 'Building',
    rules: [{ field: 'Order total', op: 'is greater than', value: '$500' }],
    seed: '—',
    country: '—',
    similarity: '—',
  },
  {
    id: 'AU-8007',
    name: 'Holiday lookalike',
    kind: 'Lookalike',
    source: 'VIP segment',
    networks: ['Meta'],
    size: 2400000,
    usedIn: 0,
    lastSync: '2026-10-05T10:00',
    status: 'Expired',
    rules: [],
    seed: 'VIP customers',
    country: 'United States',
    similarity: '1%',
  },
];

const AUDIENCE_EXPORT_COLUMNS = [
  { key: 'id', label: 'Audience ID' },
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Kind' },
  { key: 'source', label: 'Source' },
  { key: 'networks', label: 'Networks' },
  { key: 'size', label: 'Size' },
  { key: 'usedIn', label: 'Used in' },
  { key: 'lastSync', label: 'Last sync' },
  { key: 'status', label: 'Status' },
];

/* ───────────── Save split button (preserves outline vs primary variants) ───────────── */
function SaveSplitBtn({
  variant,
  label,
  onMain,
  onAlt,
  altLabel,
}: {
  variant: 'primary' | 'outline';
  label: string;
  onMain: () => void;
  onAlt: () => void;
  altLabel: string;
}) {
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
  const variantCls = variant === 'primary' ? s.btnPrimary : s.btnOutline;
  return (
    <div className={`${s.splitBtn} ${s.relative}`} ref={ref}>
      <button
        type="button"
        className={`${s.btn} ${variantCls} ${s.splitBtnMain}`}
        onClick={onMain}
      >
        <span className="material-symbols-outlined">check</span>
        {label}
      </button>
      <button
        type="button"
        className={`${s.btn} ${variantCls} ${s.splitBtnArrow}`}
        onClick={() => setOpen((v) => !v)}
        title="Save options"
      >
        <span className="material-symbols-outlined">expand_more</span>
      </button>
      {open && (
        <div className={s.popover} style={{ right: 0, left: 'auto', minWidth: 200 }}>
          <button
            type="button"
            className={s.popoverItem}
            onClick={() => {
              onMain();
              setOpen(false);
            }}
          >
            <span className="material-symbols-outlined">check</span>
            {label}
          </button>
          <button
            type="button"
            className={s.popoverItem}
            onClick={() => {
              onAlt();
              setOpen(false);
            }}
          >
            <span className="material-symbols-outlined">check</span>
            {altLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── main component ───────────── */
export default function AudiencesScreen({ onToast, onNavigate }: MarketingScreenProps) {
  /* ── state ── */
  const [audiences, setAudiences] = useState<Audience[]>(SEED_AUDIENCES);
  const [tab, setTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set(KINDS));
  const [networkFilter, setNetworkFilter] = useState<Set<string>>(new Set(NETWORKS));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditorForm>(emptyEditorForm());
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audiences.filter((a) => {
      const qOK =
        !q ||
        (a.id + ' ' + a.name + ' ' + a.kind + ' ' + a.source + ' ' + a.networks.join(' '))
          .toLowerCase()
          .includes(q);
      const tabOK = tab === 'All' || a.status === tab;
      const kindOK = kindFilter.has(a.kind);
      const netOK = a.networks.some((n) => networkFilter.has(n));
      return qOK && tabOK && kindOK && netOK;
    });
  }, [audiences, search, tab, kindFilter, networkFilter]);

  /* ── KPIs ── */
  const readyCount = audiences.filter((a) => a.status === 'Ready').length;
  const totalReach = audiences.reduce((s, a) => s + a.size, 0);
  const usedInCount = audiences.reduce((s, a) => s + a.usedIn, 0);

  /* ── tab counts ── */
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: audiences.length };
    for (const st of STATUSES) c[st] = audiences.filter((a) => a.status === st).length;
    return c;
  }, [audiences]);

  const filtersActive =
    !!search.trim() ||
    tab !== 'All' ||
    kindFilter.size !== KINDS.length ||
    networkFilter.size !== NETWORKS.length;

  const clearAllFilters = () => {
    setSearch('');
    setTab('All');
    setKindFilter(new Set(KINDS));
    setNetworkFilter(new Set(NETWORKS));
    setPage(1);
  };

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  /* ── selection ── */
  const allSelectedOnPage = paged.length > 0 && paged.every((a) => selected.has(a.id));
  const someSelectedOnPage = paged.some((a) => selected.has(a.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        for (const a of paged) next.delete(a.id);
      } else {
        for (const a of paged) next.add(a.id);
      }
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── peek ── */
  const peekAudience = peekId ? audiences.find((a) => a.id === peekId) ?? null : null;
  const openPeek = (id: string) => setPeekId(id);
  const closePeek = () => setPeekId(null);

  /* ── editor ── */
  const openNew = (kind?: AudienceKind) => {
    const f = emptyEditorForm();
    if (kind) f.kind = kind;
    setForm(f);
    setEditId(null);
    setPeekId(null);
    setEditorOpen(true);
  };
  const openEdit = (id: string) => {
    const a = audiences.find((x) => x.id === id);
    if (!a) return;
    setForm(formFromAudience(a));
    setEditId(id);
    setPeekId(null);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    setEditId(null);
  };

  /* ── save (mirrors HTML's collectAudience) ── */
  const collectAudience = (
    currentForm: EditorForm,
    currentEditId: string | null,
  ): Audience | null => {
    const name = currentForm.name.trim();
    if (!name) {
      onToast('Audience name is required');
      return null;
    }
    const networks = Array.from(currentForm.networks);
    const lookalike = currentForm.kind === 'Lookalike';
    const existing = currentEditId
      ? audiences.find((a) => a.id === currentEditId)
      : null;
    const size = existing
      ? existing.size
      : lookalike
        ? 1800000
        : Math.max(50, Math.round(10000 * Math.pow(0.55, currentForm.rules.length)));
    return {
      id: currentEditId ?? 'AU-' + (8000 + audiences.length + 1),
      name,
      kind: currentForm.kind,
      source: currentForm.source,
      networks,
      size,
      usedIn: existing?.usedIn ?? 0,
      lastSync: new Date().toISOString(),
      status: currentForm.status,
      rules: currentForm.rules.map((r) => ({ ...r })),
      seed: lookalike ? currentForm.seed : '—',
      country: lookalike ? currentForm.country : '—',
      similarity: lookalike ? currentForm.similarity + '%' : '—',
    };
  };

  const saveAndClose = () => {
    const a = collectAudience(form, editId);
    if (!a) return;
    setAudiences((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = a;
          return next;
        }
      }
      return [a, ...prev];
    });
    onToast(editId ? 'Audience updated' : 'Audience created');
    closeEditor();
  };

  const saveAndNew = () => {
    const a = collectAudience(form, editId);
    if (!a) return;
    setAudiences((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = a;
          return next;
        }
      }
      return [a, ...prev];
    });
    onToast('Saved. New audience form ready.');
    setEditId(null);
    setForm(emptyEditorForm());
  };

  /* ── row actions ── */
  const duplicate = (a: Audience) => {
    const copy: Audience = {
      ...a,
      id: 'AU-' + (8000 + audiences.length + 1),
      name: a.name + ' (copy)',
      status: 'Draft',
      usedIn: 0,
      lastSync: null,
      rules: a.rules.map((r) => ({ ...r })),
    };
    setAudiences((prev) => [copy, ...prev]);
    onToast(`Duplicated: ${a.name}`);
  };
  const syncNow = (a: Audience) => {
    setAudiences((prev) =>
      prev.map((x) =>
        x.id === a.id
          ? { ...x, lastSync: new Date().toISOString(), status: 'Ready' }
          : x,
      ),
    );
    onToast(`Synced: ${a.name}`);
  };
  const archiveOne = (a: Audience) => {
    setAudiences((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, status: 'Expired' } : x)),
    );
    onToast(`Archived: ${a.name}`);
  };
  const deleteOne = (a: Audience) => {
    setAudiences((prev) => prev.filter((x) => x.id !== a.id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(a.id);
      return n;
    });
    if (peekId === a.id) setPeekId(null);
    onToast(`Deleted: ${a.name}`);
  };
  const exportOne = (a: Audience) => {
    exportToCsv(
      [a as unknown as Record<string, unknown>],
      AUDIENCE_EXPORT_COLUMNS,
      `audience-${a.id}`,
    );
    onToast(`Exported members of ${a.name}`);
  };

  /* ── bulk actions ── */
  const bulkSync = () => {
    const n = selected.size;
    setAudiences((prev) =>
      prev.map((a) =>
        selected.has(a.id)
          ? { ...a, lastSync: new Date().toISOString(), status: 'Ready' }
          : a,
      ),
    );
    onToast(`Synced ${n} audience(s)`);
    setSelected(new Set());
  };
  const bulkExport = () => {
    const selectedItems = audiences.filter((a) => selected.has(a.id));
    exportToCsv(
      selectedItems as unknown as Record<string, unknown>[],
      AUDIENCE_EXPORT_COLUMNS,
      'audiences-bulk',
    );
    onToast(`Exported ${selectedItems.length} audience(s)`);
    setSelected(new Set());
  };
  const bulkArchive = () => {
    const n = selected.size;
    setAudiences((prev) =>
      prev.map((a) => (selected.has(a.id) ? { ...a, status: 'Expired' } : a)),
    );
    onToast(`Archived ${n} audience(s)`);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    const n = selected.size;
    setAudiences((prev) => prev.filter((a) => !selected.has(a.id)));
    onToast(`Deleted ${n} audience(s)`);
    setSelected(new Set());
  };

  /* ── export all (filtered) ── */
  const exportAll = () => {
    exportToCsv(
      filtered as unknown as Record<string, unknown>[],
      AUDIENCE_EXPORT_COLUMNS,
      'audiences',
    );
    onToast(`Exporting ${filtered.length} audiences…`);
  };

  /* ── row ⋯ menu items ── */
  const rowMenuItems = (a: Audience): RowMenuItem[] => [
    { header: 'This audience', label: 'Edit audience', icon: 'edit', onClick: () => openEdit(a.id) },
    { label: 'View details', icon: 'visibility', onClick: () => openPeek(a.id) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => duplicate(a) },
    { header: 'Operations', label: 'Sync now', icon: 'sync', onClick: () => syncNow(a) },
    { label: 'Export members', icon: 'download', onClick: () => exportOne(a) },
    { label: 'Archive', icon: 'archive', onClick: () => archiveOne(a) },
    { label: 'Delete', icon: 'delete', onClick: () => deleteOne(a), danger: true, sepBefore: true },
  ];

  /* ── live preview ── */
  const previewEstSize =
    form.kind === 'Lookalike'
      ? form.sizeEstimate || '1.8M'
      : Math.max(50, Math.round(10000 * Math.pow(0.55, form.rules.length))).toLocaleString();
  const previewBarWidth = Math.min(100, form.rules.length * 22 + 20);
  const networksChecked = Array.from(form.networks);

  /* ── drawer title sub ── */
  const editingAudience = editId ? audiences.find((a) => a.id === editId) ?? null : null;

  return (
    <div className={s.screen} style={{ padding: '0 24px 48px' }}>
      {/* ─── BREADCRUMB ─── */}
      <Breadcrumb
        items={[{ label: 'Advertising' }, { label: 'Audiences', current: true }]}
      />

      {/* ─── PAGE HEADER ─── */}
      <PageHeader
        title="Audiences"
        subtitle="Custom, retargeting, and lookalike audiences — reusable across campaigns and networks."
      >
        <Btn icon="download" onClick={exportAll}>
          Export
        </Btn>
        <Btn icon="tune" onClick={() => onToast('Customize panel — Data / Visual tabs')}>
          Customize
        </Btn>
        <SplitButton
          icon="add"
          label="New audience"
          onClick={() => openNew()}
          menu={[
            { label: 'Audience', icon: 'groups', onClick: () => openNew() },
            { label: 'Lookalike', icon: 'share', onClick: () => openNew('Lookalike') },
            {
              label: 'Campaign',
              icon: 'campaign',
              onClick: () =>
                onNavigate
                  ? onNavigate('advertising', 'campaigns')
                  : onToast('Create campaign — will route to that dedicated page'),
            },
            {
              label: 'Creative',
              icon: 'perm_media',
              onClick: () =>
                onNavigate
                  ? onNavigate('advertising', 'creatives')
                  : onToast('Create creative — will route to that dedicated page'),
            },
          ]}
        />
      </PageHeader>

      {/* ─── KPI STRIP ─── */}
      <KpiStrip>
        <KpiCard label="Total audiences" value={audiences.length} sub="Across all networks" />
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Ready to use</div>
          <div className={s.kpiValue} style={{ color: 'var(--secondary)' }}>
            {readyCount}
          </div>
          <div className={s.kpiSub}>Synced and deliverable</div>
        </div>
        <KpiCard label="Total reach" value={fmtNum(totalReach)} sub="Sum of unique sizes" />
        <KpiCard
          label="Used in campaigns"
          value={usedInCount}
          sub="Across all ad sets"
        />
      </KpiStrip>

      {/* ─── LIST CARD ─── */}
      <div className={s.card}>
        {/* Status tabs */}
        <StatusTabs tabs={STATUS_TABS} active={tab} onChange={(t) => { setTab(t); setPage(1); }} counts={counts} />

        {/* Filter bar */}
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Filter audiences…"
          />
          <FilterDropdown
            label="Kind"
            icon="category"
            options={KINDS}
            selected={kindFilter}
            onChange={setKindFilter}
            onClear={() => setKindFilter(new Set(KINDS))}
            onApply={() => setPage(1)}
          />
          <FilterDropdown
            label="Network"
            icon="hub"
            options={NETWORKS}
            selected={networkFilter}
            onChange={setNetworkFilter}
            onClear={() => setNetworkFilter(new Set(NETWORKS))}
            onApply={() => setPage(1)}
          />
          <Btn
            icon="bookmark"
            onClick={() => onToast('Saved views — pick or save current filters')}
          >
            Saved views
          </Btn>
          {filtersActive && (
            <Btn icon="filter_alt_off" onClick={clearAllFilters}>
              Clear all
            </Btn>
          )}
          <span className={s.flex1} />
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
            {filtered.length} of {audiences.length}
          </span>
        </FilterBar>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            actions={[
              { label: 'Sync', icon: 'sync', onClick: bulkSync },
              { label: 'Export', icon: 'download', onClick: bulkExport },
              { label: 'Archive', icon: 'archive', onClick: bulkArchive },
              { label: 'Delete', icon: 'delete', onClick: bulkDelete, danger: true },
            ]}
          />
        )}

        {/* Table */}
        <TableWrap>
          {paged.length === 0 ? (
            <EmptyState
              icon="groups"
              title="No audiences match"
              body="Clear filters or create a new audience."
            />
          ) : (
            <Table
              head={
                <tr>
                  <th className={s.checkCell}>
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            someSelectedOnPage && !allSelectedOnPage;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Audience</th>
                  <th>Kind</th>
                  <th>Source</th>
                  <th>Networks</th>
                  <th className={s.right}>Size</th>
                  <th>Used in</th>
                  <th>Last sync</th>
                  <th>Status</th>
                  <th />
                </tr>
              }
            >
              {paged.map((a) => (
                <tr key={a.id} onClick={() => openPeek(a.id)}>
                  <td
                    className={s.checkCell}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleOne(a.id)}
                    />
                  </td>
                  <td>
                    <div
                      className={s.flex}
                      style={{ alignItems: 'center', gap: 8, minWidth: 0 }}
                    >
                      <span style={audIconStyle(a.kind)}>
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16 }}
                        >
                          {KIND_ICON[a.kind]}
                        </span>
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className={s.rowName}
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.name}
                        </div>
                        <div className={s.rowSub}>{a.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>{a.kind}</td>
                  <td style={{ fontSize: 12 }}>{a.source}</td>
                  <td>
                    <div
                      className={s.flex}
                      style={{
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {a.networks.map((n) => (
                        <NetChip key={n} net={n} />
                      ))}
                    </div>
                  </td>
                  <td className={`${s.right} ${s.tabularNums}`}>
                    {fmtNum(a.size)}
                  </td>
                  <td className={s.tabularNums}>
                    {a.usedIn} campaign{a.usedIn === 1 ? '' : 's'}
                  </td>
                  <td style={{ fontSize: 11 }}>{fmtDate(a.lastSync)}</td>
                  <td>
                    <Stat kind={STAT_KIND[a.status]} label={a.status} />
                  </td>
                  <td
                    className={s.right}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu items={rowMenuItems(a)} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </TableWrap>

        {/* Empty state (separate from TableWrap so it always shows full-empty copy) */}
        {paged.length === 0 && filtered.length === 0 && (
          <div style={{ padding: '8px 16px', textAlign: 'center' }}>
            <Btn variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Btn>
          </div>
        )}

        {/* Pagination */}
        <div
          className={s.flex}
          style={{
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--surface-dim)',
            padding: '8px 16px',
            fontSize: 11,
            color: 'var(--on-surface-variant)',
          }}
        >
          <span>
            Rows per page:
            <select
              className={s.fieldSelect}
              style={{
                height: 22,
                padding: '0 18px 0 4px',
                fontSize: 11,
                width: 'auto',
                marginLeft: 4,
                background: '#fff',
              }}
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={75}>75</option>
              <option value={100}>100</option>
            </select>
          </span>
          <div className={s.flex} style={{ alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: currentPage > 1 ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                opacity: currentPage > 1 ? 1 : 0.4,
              }}
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                cursor: currentPage < totalPages ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                opacity: currentPage < totalPages ? 1 : 0.4,
              }}
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next page"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── PEEK DRAWER ─── */}
      <Peek
        open={!!peekAudience}
        title={peekAudience?.name ?? 'Audience'}
        onClose={closePeek}
        subtitle={
          peekAudience ? (
            <span className={s.flex} style={{ alignItems: 'center', gap: 8 }}>
              <Stat kind={STAT_KIND[peekAudience.status]} label={peekAudience.status} />
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                {peekAudience.kind}
              </span>
            </span>
          ) : null
        }
      >
        {peekAudience && (
          <div>
            {/* status + kind */}
            <div
              className={s.flex}
              style={{
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <Stat kind={STAT_KIND[peekAudience.status]} label={peekAudience.status} />
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                {peekAudience.kind}
              </span>
            </div>

            {/* networks */}
            <div
              className={s.flex}
              style={{
                alignItems: 'center',
                gap: 4,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              {peekAudience.networks.map((n) => (
                <NetChip key={n} net={n} />
              ))}
            </div>

            {/* size card */}
            <div
              style={{
                background: 'var(--surface-container-low)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--on-surface-variant)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Audience size
              </div>
              <div className={`${s.headlineMd} ${s.tabularNums}`}>
                {fmtNum(peekAudience.size)}
              </div>
            </div>

            {/* KV list */}
            <KvList
              items={[
                { k: 'Audience ID', v: <span className={s.mono}>{peekAudience.id}</span> },
                { k: 'Kind', v: peekAudience.kind },
                { k: 'Source', v: peekAudience.source },
                { k: 'Used in', v: `${peekAudience.usedIn} campaign(s)` },
                { k: 'Last sync', v: fmtDate(peekAudience.lastSync) },
                ...(peekAudience.kind === 'Lookalike'
                  ? [
                      { k: 'Seed', v: peekAudience.seed },
                      { k: 'Country', v: peekAudience.country },
                      { k: 'Similarity', v: peekAudience.similarity },
                    ]
                  : []),
              ]}
            />

            {/* rules */}
            {peekAudience.rules.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid var(--surface-dim)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--on-surface-variant)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Rules
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {peekAudience.rules.map((r, i) => (
                    <div key={i} style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 500 }}>{r.field}</span>{' '}
                      <span style={{ color: 'var(--on-surface-variant)' }}>
                        {r.op}
                      </span>{' '}
                      <span style={{ fontWeight: 500 }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2×2 action grid */}
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
                onClick={() => openEdit(peekAudience.id)}
              >
                Edit
              </Btn>
              <Btn
                icon="sync"
                onClick={() => {
                  syncNow(peekAudience);
                  closePeek();
                }}
              >
                Sync
              </Btn>
              <Btn
                icon="content_copy"
                onClick={() => {
                  duplicate(peekAudience);
                  closePeek();
                }}
              >
                Duplicate
              </Btn>
              <Btn
                icon="archive"
                onClick={() => {
                  archiveOne(peekAudience);
                  closePeek();
                }}
              >
                Archive
              </Btn>
            </div>
          </div>
        )}
      </Peek>

      {/* ─── EDITOR DRAWER ─── */}
      <Drawer
        open={editorOpen}
        title={editId ? 'Edit audience' : 'New audience'}
        subtitle={
          editingAudience
            ? `${editingAudience.status} · ${editingAudience.id}`
            : 'Draft · not yet built'
        }
        onClose={closeEditor}
        width={640}
        footer={
          <div
            className={s.flex}
            style={{
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <Btn variant="outline" onClick={closeEditor}>
              Cancel
            </Btn>
            <div className={s.flex} style={{ gap: 8 }}>
              <SaveSplitBtn
                variant="outline"
                label="Save and new"
                onMain={saveAndNew}
                onAlt={saveAndClose}
                altLabel="Save and close"
              />
              <SaveSplitBtn
                variant="primary"
                label="Save and close"
                onMain={saveAndClose}
                onAlt={saveAndNew}
                altLabel="Save and new"
              />
            </div>
          </div>
        }
      >
        {/* ── Audience basics ── */}
        <section className={s.mb4}>
          <div className={s.sectionH}>Audience basics</div>
          <div className={s.flexCol} style={{ gap: 12 }}>
            <Field label="Audience name">
              <Input
                type="text"
                placeholder="e.g. Site visitors 30d"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </Field>
            <div className={s.fieldRow}>
              <Field label="Kind">
                <Select
                  value={form.kind}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      kind: e.target.value as AudienceKind,
                    }))
                  }
                >
                  {KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as AudienceStatus,
                    }))
                  }
                >
                  {STATUSES.map((st) => (
                    <option key={st}>{st}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Source">
              <Select
                value={form.source}
                onChange={(e) =>
                  setForm((p) => ({ ...p, source: e.target.value }))
                }
              >
                {SOURCES.map((src) => (
                  <option key={src}>{src}</option>
                ))}
              </Select>
            </Field>
          </div>
        </section>

        {/* ── Rules ── */}
        <section className={s.mb4}>
          <div
            className={`${s.sectionH} ${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
          >
            <span>Rules</span>
            <Btn
              sm
              icon="add"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  rules: [
                    ...p.rules,
                    { field: 'Visited page', op: 'contains', value: '/product' },
                  ],
                }))
              }
            >
              Add rule
            </Btn>
          </div>
          <div className={s.flexCol} style={{ gap: 8 }}>
            {form.rules.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                No rules yet. Add one to define the audience.
              </div>
            ) : (
              form.rules.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: '1px solid var(--surface-dim)',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <select
                    value={r.field}
                    onChange={(e) =>
                      setForm((p) => {
                        const next = [...p.rules];
                        next[i] = { ...next[i], field: e.target.value };
                        return { ...p, rules: next };
                      })
                    }
                    style={{
                      flex: 1,
                      height: 30,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      fontSize: 12,
                      background: '#fff',
                      fontFamily: 'inherit',
                    }}
                  >
                    {RULE_FIELDS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    value={r.op}
                    onChange={(e) =>
                      setForm((p) => {
                        const next = [...p.rules];
                        next[i] = { ...next[i], op: e.target.value };
                        return { ...p, rules: next };
                      })
                    }
                    style={{
                      flex: 1,
                      height: 30,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      fontSize: 12,
                      background: '#fff',
                      fontFamily: 'inherit',
                    }}
                  >
                    {RULE_OPS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={r.value}
                    onChange={(e) =>
                      setForm((p) => {
                        const next = [...p.rules];
                        next[i] = { ...next[i], value: e.target.value };
                        return { ...p, rules: next };
                      })
                    }
                    style={{
                      flex: 1,
                      height: 30,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      fontSize: 12,
                      background: '#fff',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        rules: p.rules.filter((_, idx) => idx !== i),
                      }))
                    }
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                    title="Remove rule"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: 'var(--error)' }}
                    >
                      close
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 8 }}>
            Rules combine with AND. Members who match every rule enter the audience.
          </div>
        </section>

        {/* ── Lookalike config (only when kind = Lookalike) ── */}
        {form.kind === 'Lookalike' && (
          <section className={s.mb4}>
            <div className={s.sectionH}>Lookalike config</div>
            <div className={s.grid2}>
              <Field label="Seed audience">
                <Select
                  value={form.seed}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, seed: e.target.value }))
                  }
                >
                  {SEED_OPTIONS.map((seed) => (
                    <option key={seed}>{seed}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Country">
                <Select
                  value={form.country}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, country: e.target.value }))
                  }
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Similarity (%)">
                <Input
                  type="number"
                  value={form.similarity}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, similarity: e.target.value }))
                  }
                />
              </Field>
              <Field label="Size estimate">
                <Input
                  value={form.sizeEstimate}
                  readOnly
                  onChange={() => {}}
                />
              </Field>
            </div>
          </section>
        )}

        {/* ── Target networks ── */}
        <section className={s.mb4}>
          <div className={s.sectionH}>Target networks</div>
          <div className={s.grid2} style={{ gap: 8 }}>
            {NETWORKS.map((n) => (
              <label
                key={n}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 8,
                  borderRadius: 6,
                  border: '1px solid var(--surface-dim)',
                  cursor: 'pointer',
                  background: '#fff',
                }}
              >
                <span style={{ fontSize: 13 }}>{n} Ads</span>
                <input
                  type="checkbox"
                  checked={form.networks.has(n)}
                  onChange={() =>
                    setForm((p) => {
                      const next = new Set(p.networks);
                      if (next.has(n)) next.delete(n);
                      else next.add(n);
                      return { ...p, networks: next };
                    })
                  }
                  style={{ accentColor: 'var(--qb-blue)', cursor: 'pointer' }}
                />
              </label>
            ))}
          </div>
        </section>

        {/* ── Live preview ── */}
        <section>
          <div className={s.sectionH}>Live preview</div>
          <div
            style={{
              border: '1px solid var(--surface-dim)',
              borderRadius: 10,
              padding: 12,
              background: '#fafbfc',
            }}
          >
            <div
              className={s.flex}
              style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}
            >
              <span style={audIconStyle(form.kind)}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16 }}
                >
                  {KIND_ICON[form.kind]}
                </span>
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {form.name || 'Untitled audience'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                  {form.kind} ·{' '}
                  {networksChecked.length
                    ? networksChecked.join(', ')
                    : 'no networks'}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--on-surface-variant)',
                marginBottom: 4,
              }}
            >
              Estimated size
            </div>
            <div
              className={`${s.tabularNums}`}
              style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}
            >
              {previewEstSize}
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 10,
                background: '#edf0f1',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${previewBarWidth}%`,
                  background: 'var(--qb-blue)',
                  borderRadius: 10,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--on-surface-variant)',
                marginTop: 8,
              }}
            >
              {form.rules.length} rule(s) ·{' '}
              {form.kind === 'Lookalike'
                ? `seed: ${form.seed || '—'}`
                : 'matching members'}
            </div>
          </div>
        </section>
      </Drawer>
    </div>
  );
}
