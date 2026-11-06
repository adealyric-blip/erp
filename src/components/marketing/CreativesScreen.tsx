'use client';

/**
 * CreativesScreen — 1:1 port of creatives.html.
 *
 * Replicates: breadcrumb, page header (Export / Customize / New-creative
 * split button with create menu), 4-card KPI strip, status tabs (All / Live /
 * In review / Draft / Rejected / Archived), filter bar (search + Type dropdown
 * + Network dropdown + Saved views + Clear all + count), bulk bar
 * (Publish / Archive / Duplicate / Delete), full 11-column table with row
 * click → peek, row ⋯ menu (Edit / View / Duplicate / Publish / Archive /
 * Delete), pagination, peek drawer with preview + 3-stat grid + KV list +
 * 2×2 action grid, creative editor drawer (basics / asset upload / copy /
 * allowed networks) with split Save-and-new + Save-and-close buttons, and a
 * preview modal. Customize-columns modal + Saved-views modal do real work.
 */
import { useMemo, useRef, useState } from 'react';
import {
  type MarketingScreenProps,
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
  BulkBar,
  RowMenu,
  type RowMenuItem,
  Scrim,
  Modal,
  TableWrap,
  Table,
  Field,
  Input,
  Textarea,
  Select,
  KvList,
  EmptyState,
  s,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';

/* ───────────── TYPES ───────────── */
type CreativeType = 'Image' | 'Video' | 'Carousel' | 'Text';
type CreativeStatus = 'Live' | 'In review' | 'Draft' | 'Rejected' | 'Archived';

interface Creative {
  id: string;
  name: string;
  type: CreativeType;
  dimensions: string;
  networks: string[];
  usedIn: number;
  impressions: number;
  ctr: number;
  roas: number;
  status: CreativeStatus;
  headline: string;
  primary: string;
  cta: string;
  url: string;
}

interface EditorForm {
  name: string;
  type: CreativeType;
  status: CreativeStatus;
  dimensions: string;
  headline: string;
  primary: string;
  cta: string;
  url: string;
  networks: string[];
  fileName: string;
}

interface SavedView {
  name: string;
  tab: string;
  q: string;
  types: string[];
  networks: string[];
}

/* ───────────── CONSTANTS ───────────── */
const NETWORKS = ['Meta', 'TikTok', 'Google', 'Pinterest'] as const;
const TYPES: CreativeType[] = ['Image', 'Video', 'Carousel', 'Text'];
const STATUS_TABS = ['All', 'Live', 'In review', 'Draft', 'Rejected', 'Archived'];
const TYPE_OPTIONS: CreativeType[] = ['Image', 'Video', 'Carousel', 'Text'];
const STATUS_OPTIONS: CreativeStatus[] = ['Draft', 'In review', 'Live', 'Rejected', 'Archived'];
const CTA_OPTIONS = ['Shop now', 'Learn more', 'Sign up', 'Get offer', 'Download'];

const TYPE_ICON: Record<CreativeType, string> = {
  Image: 'image',
  Video: 'movie',
  Carousel: 'view_carousel',
  Text: 'text_fields',
};

const TYPE_THUMB_GRADIENT: Record<CreativeType, string> = {
  Image: 'linear-gradient(135deg,#0077c5,#1f2937)',
  Video: 'linear-gradient(135deg,#6b1e28,#1a1c1e)',
  Carousel: 'linear-gradient(135deg,#0e5e6f,#1e5a38)',
  Text: 'linear-gradient(135deg,#0a6400,#108000)',
};

const PREVIEW_GRADIENT = 'linear-gradient(135deg, #0077c5, #1f2937)';

const NETWORK_LABEL: Record<string, string> = {
  Meta: 'Meta Ads',
  TikTok: 'TikTok Ads',
  Google: 'Google Ads',
  Pinterest: 'Pinterest Ads',
};

const CUSTOMIZE_COLS: { key: string; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'creative', label: 'Creative' },
  { key: 'type', label: 'Type' },
  { key: 'networks', label: 'Networks' },
  { key: 'usedin', label: 'Used in' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'ctr', label: 'CTR' },
  { key: 'roas', label: 'ROAS' },
  { key: 'status', label: 'Status' },
];

const EMPTY_FORM: EditorForm = {
  name: '',
  type: 'Image',
  status: 'Draft',
  dimensions: '',
  headline: '',
  primary: '',
  cta: 'Shop now',
  url: '',
  networks: ['Meta', 'TikTok'],
  fileName: '',
};

/* ───────────── SEED DATA (matches HTML's CREATIVES array) ───────────── */
const SEED: Creative[] = [
  { id: 'CR-001', name: 'Fall hero — 1x1', type: 'Image', dimensions: '1080x1080', networks: ['Meta'], usedIn: 2, impressions: 842000, ctr: 2.1, roas: 4.26, status: 'Live', headline: 'Meet the fall capsule', primary: 'A considered collection built around what you asked for.', cta: 'Shop now', url: 'https://unsaid.app/fall' },
  { id: 'CR-002', name: 'Fall hero — 4x5', type: 'Image', dimensions: '1080x1350', networks: ['Meta', 'Pinterest'], usedIn: 1, impressions: 412000, ctr: 1.8, roas: 3.94, status: 'Live', headline: 'Meet the fall capsule', primary: 'A considered collection built around what you asked for.', cta: 'Shop now', url: 'https://unsaid.app/fall' },
  { id: 'CR-003', name: 'TikTok drop — vertical', type: 'Video', dimensions: '1080x1920 · 15s', networks: ['TikTok'], usedIn: 1, impressions: 1860000, ctr: 3.4, roas: 3.06, status: 'Live', headline: 'Behind the drop', primary: 'A 15s look at how the capsule came together.', cta: 'Learn more', url: 'https://unsaid.app/drop' },
  { id: 'CR-004', name: 'Search text — brand', type: 'Text', dimensions: '1200x628', networks: ['Google'], usedIn: 1, impressions: 94000, ctr: 5.2, roas: 4.02, status: 'Live', headline: 'Unsaid — official site', primary: 'Free shipping on orders over $50.', cta: 'Learn more', url: 'https://unsaid.app' },
  { id: 'CR-005', name: 'Holiday capsule teaser', type: 'Video', dimensions: '1080x1080 · 6s', networks: ['Meta'], usedIn: 0, impressions: 0, ctr: 0, roas: 0, status: 'In review', headline: 'Something cozy is coming', primary: 'A sneak peek before launch.', cta: 'Learn more', url: 'https://unsaid.app/holiday' },
  { id: 'CR-006', name: 'Summer CTA', type: 'Image', dimensions: '1080x1080', networks: ['Meta'], usedIn: 1, impressions: 1240000, ctr: 1.9, roas: 3.08, status: 'Archived', headline: 'Last chance', primary: 'Summer clearance — final week.', cta: 'Shop now', url: 'https://unsaid.app/summer' },
  { id: 'CR-007', name: 'Summer carousel', type: 'Carousel', dimensions: '1080x1080 x3', networks: ['Meta'], usedIn: 1, impressions: 682000, ctr: 1.6, roas: 2.84, status: 'Archived', headline: 'Three looks, one story', primary: 'Swipe through the summer edit.', cta: 'Shop now', url: 'https://unsaid.app/summer' },
  { id: 'CR-008', name: 'Evergreen tote', type: 'Image', dimensions: '1080x1350', networks: ['Pinterest'], usedIn: 0, impressions: 0, ctr: 0, roas: 0, status: 'Draft', headline: 'The everyday tote', primary: 'Canvas, ready for anything.', cta: 'Shop now', url: 'https://unsaid.app/tote' },
];

/* ───────────── MAIN COMPONENT ───────────── */
export default function CreativesScreen({ onToast }: MarketingScreenProps) {
  /* ── state ── */
  const [creatives, setCreatives] = useState<Creative[]>(SEED);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('All');
  const [typeSel, setTypeSel] = useState<Set<string>>(new Set(TYPES));
  const [netSel, setNetSel] = useState<Set<string>>(new Set(NETWORKS));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [previewCreative, setPreviewCreative] = useState<Creative | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ ids: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── derived ── */
  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      const q = query.toLowerCase();
      const qOK = !q || (c.id + ' ' + c.name + ' ' + c.type + ' ' + c.networks.join(' ')).toLowerCase().includes(q);
      const tabOK = tab === 'All' || c.status === tab;
      const typeOK = typeSel.has(c.type);
      const netOK = c.networks.some((n) => netSel.has(n));
      return qOK && tabOK && typeOK && netOK;
    });
  }, [creatives, query, tab, typeSel, netSel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const liveCreatives = creatives.filter((c) => c.status === 'Live');
  const avgCtr = liveCreatives.length ? liveCreatives.reduce((sum, c) => sum + c.ctr, 0) / liveCreatives.length : 0;
  const best = [...liveCreatives].sort((a, b) => b.ctr - a.ctr)[0];

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { All: creatives.length };
    STATUS_TABS.forEach((t) => {
      if (t !== 'All') counts[t] = creatives.filter((c) => c.status === t).length;
    });
    return counts;
  }, [creatives]);

  const filtersActive = !!query || tab !== 'All' || typeSel.size !== TYPES.length || netSel.size !== NETWORKS.length;

  const allChecked = pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));
  const someChecked = pageRows.some((c) => selected.has(c.id)) && !allChecked;

  const peekCreative = peekId ? creatives.find((c) => c.id === peekId) ?? null : null;

  /* ── helpers ── */
  const nextId = () => 'CR-' + String(creatives.length + 1).padStart(3, '0');

  /* ── editor ── */
  const openEditor = (id: string | null) => {
    if (id) {
      const c = creatives.find((x) => x.id === id);
      if (!c) return;
      setEditingId(id);
      setForm({
        name: c.name,
        type: c.type,
        status: c.status,
        dimensions: c.dimensions,
        headline: c.headline,
        primary: c.primary,
        cta: c.cta,
        url: c.url,
        networks: [...c.networks],
        fileName: '',
      });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    }
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId(null);
  };

  const collectFromForm = (): Creative | null => {
    const name = form.name.trim();
    if (!name) {
      onToast('Creative name is required');
      return null;
    }
    const existing = editingId ? creatives.find((c) => c.id === editingId) : null;
    return {
      id: editingId ?? nextId(),
      name,
      type: form.type,
      dimensions: form.dimensions || '—',
      networks: form.networks,
      usedIn: existing?.usedIn ?? 0,
      impressions: existing?.impressions ?? 0,
      ctr: existing?.ctr ?? 0,
      roas: existing?.roas ?? 0,
      status: form.status,
      headline: form.headline,
      primary: form.primary,
      cta: form.cta,
      url: form.url,
    };
  };

  const saveAndClose = () => {
    const c = collectFromForm();
    if (!c) return;
    if (editingId) {
      setCreatives((p) => p.map((x) => (x.id === editingId ? c : x)));
      onToast('Creative updated');
    } else {
      setCreatives((p) => [c, ...p]);
      onToast('Creative created');
    }
    closeEditor();
  };

  const saveAndNew = () => {
    const c = collectFromForm();
    if (!c) return;
    if (editingId) {
      setCreatives((p) => p.map((x) => (x.id === editingId ? c : x)));
    } else {
      setCreatives((p) => [c, ...p]);
    }
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    onToast('Saved. New creative form ready.');
  };

  /* ── single-row actions ── */
  const duplicate = (id: string) => {
    const c = creatives.find((x) => x.id === id);
    if (!c) return;
    const copy: Creative = {
      ...c,
      id: nextId(),
      name: c.name + ' (copy)',
      status: 'Draft',
      usedIn: 0,
      impressions: 0,
      ctr: 0,
      roas: 0,
    };
    setCreatives((p) => [copy, ...p]);
    setPeekId(null);
    onToast(`Duplicated: ${c.name}`);
  };

  const publish = (id: string) => {
    const c = creatives.find((x) => x.id === id);
    if (!c) return;
    setCreatives((p) => p.map((x) => (x.id === id ? { ...x, status: 'In review' as CreativeStatus } : x)));
    onToast(`Submitted: ${c.name}`);
  };

  const archiveCreative = (id: string) => {
    const c = creatives.find((x) => x.id === id);
    if (!c) return;
    setCreatives((p) => p.map((x) => (x.id === id ? { ...x, status: 'Archived' as CreativeStatus } : x)));
    setPeekId(null);
    onToast(`Archived: ${c.name}`);
  };

  const deleteCreative = (id: string) => {
    setConfirmDel({ ids: [id] });
  };

  /* ── row ⋯ menu items ── */
  const rowMenuItems = (c: Creative): RowMenuItem[] => [
    { header: 'This creative', label: 'Edit creative', icon: 'edit', onClick: () => { setPeekId(null); openEditor(c.id); } },
    { label: 'View details', icon: 'visibility', onClick: () => setPeekId(c.id) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => duplicate(c.id) },
    { sepBefore: true, header: 'Status', label: 'Publish', icon: 'publish', onClick: () => publish(c.id) },
    { label: 'Archive', icon: 'archive', onClick: () => archiveCreative(c.id) },
    { sepBefore: true, label: 'Delete', icon: 'delete', danger: true, onClick: () => deleteCreative(c.id) },
  ];

  /* ── selection ── */
  const toggleSelect = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (allChecked) {
      setSelected((p) => {
        const n = new Set(p);
        pageRows.forEach((c) => n.delete(c.id));
        return n;
      });
    } else {
      setSelected((p) => {
        const n = new Set(p);
        pageRows.forEach((c) => n.add(c.id));
        return n;
      });
    }
  };

  /* ── bulk actions ── */
  const bulkPublish = () => {
    const n = selected.size;
    setCreatives((p) => p.map((c) => (selected.has(c.id) ? { ...c, status: 'In review' as CreativeStatus } : c)));
    onToast(`Submitted ${n} creative(s)`);
    setSelected(new Set());
  };
  const bulkArchive = () => {
    const n = selected.size;
    setCreatives((p) => p.map((c) => (selected.has(c.id) ? { ...c, status: 'Archived' as CreativeStatus } : c)));
    onToast(`Archived ${n} creative(s)`);
    setSelected(new Set());
  };
  const bulkDuplicate = () => {
    const n = selected.size;
    const copies: Creative[] = creatives
      .filter((c) => selected.has(c.id))
      .map((c, i) => ({
        ...c,
        id: 'CR-' + String(creatives.length + 1 + i).padStart(3, '0'),
        name: c.name + ' (copy)',
        status: 'Draft' as CreativeStatus,
        usedIn: 0,
        impressions: 0,
        ctr: 0,
        roas: 0,
      }));
    setCreatives((p) => [...copies, ...p]);
    onToast(`Duplicated ${n} creative(s)`);
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
    setCreatives((p) => p.filter((c) => !ids.has(c.id)));
    setSelected((p) => {
      const next = new Set(p);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setPeekId(null);
    onToast(`Deleted ${n} creative(s)`);
    setConfirmDel(null);
  };

  /* ── export ── */
  const handleExport = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      dimensions: c.dimensions,
      networks: c.networks.join('; '),
      usedIn: c.usedIn,
      impressions: c.impressions,
      ctr: c.ctr,
      roas: c.roas,
      status: c.status,
      headline: c.headline,
      primary: c.primary,
      cta: c.cta,
      url: c.url,
    }));
    exportToCsv(rows, [
      { key: 'id', label: 'Creative ID' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'dimensions', label: 'Dimensions' },
      { key: 'networks', label: 'Networks' },
      { key: 'usedIn', label: 'Used in' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'ctr', label: 'CTR' },
      { key: 'roas', label: 'ROAS' },
      { key: 'status', label: 'Status' },
      { key: 'headline', label: 'Headline' },
      { key: 'primary', label: 'Primary text' },
      { key: 'cta', label: 'CTA' },
      { key: 'url', label: 'Destination URL' },
    ], 'creatives');
    onToast(`Exported ${rows.length} creatives.`);
  };

  /* ── clear all ── */
  const clearAll = () => {
    setQuery('');
    setTab('All');
    setTypeSel(new Set(TYPES));
    setNetSel(new Set(NETWORKS));
    setPage(1);
  };

  /* ── saved views ── */
  const saveView = () => {
    const name = viewName.trim();
    if (!name) {
      onToast('View name is required');
      return;
    }
    if (savedViews.some((v) => v.name === name)) {
      onToast(`View "${name}" already exists`);
      return;
    }
    setSavedViews((p) => [...p, { name, tab, q: query, types: [...typeSel], networks: [...netSel] }]);
    setViewName('');
    onToast(`Saved view "${name}"`);
  };
  const loadView = (v: SavedView) => {
    setTab(v.tab);
    setQuery(v.q);
    setTypeSel(new Set(v.types));
    setNetSel(new Set(v.networks));
    setPage(1);
    setSavedViewsOpen(false);
    onToast(`Loaded view "${v.name}"`);
  };
  const deleteView = (name: string) => {
    setSavedViews((p) => p.filter((v) => v.name !== name));
    onToast(`Deleted view "${name}"`);
  };

  /* ── pagination ── */
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  /* ───────────── RENDER ───────────── */
  return (
    <div className={s.screen}>
      <main style={{ padding: '0 24px 48px' }}>
        {/* BREADCRUMB */}
        <Breadcrumb items={[{ label: 'Advertising' }, { label: 'Creatives', current: true }]} />

        {/* PAGE HEADER */}
        <PageHeader
          title="Creatives"
          subtitle="Every ad creative across campaigns — images, videos, carousels, and text assets."
        >
          <Btn variant="outline" icon="download" onClick={handleExport}>Export</Btn>
          <Btn variant="outline" icon="tune" onClick={() => setCustomizeOpen(true)}>Customize</Btn>
          <SplitButton
            icon="add"
            label="New creative"
            onClick={() => openEditor(null)}
            menu={[
              { label: 'Creative', icon: 'perm_media', onClick: () => openEditor(null) },
              { label: 'Campaign', icon: 'campaign', onClick: () => onToast('Create campaign — will route to that dedicated page') },
              { label: 'Ad set', icon: 'tune', onClick: () => onToast('Create ad set — will route to that dedicated page') },
              { label: 'Audience', icon: 'groups', onClick: () => onToast('Create audience — will route to that dedicated page') },
            ]}
          />
        </PageHeader>

        {/* KPI STRIP */}
        <KpiStrip>
          <KpiCard label="Total creatives" value={creatives.length} sub="Across all campaigns" />
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Live in ads</div>
            <div className={s.kpiValue} style={{ color: 'var(--secondary)' }}>{liveCreatives.length}</div>
            <div className={s.kpiSub}>Currently delivering</div>
          </div>
          <KpiCard label="Avg. CTR" value={`${avgCtr.toFixed(2)}%`} sub="Across live creatives" />
          <KpiCard label="Best performer" value={best ? `${best.ctr.toFixed(1)}%` : '—'} sub={best ? best.name : '—'} />
        </KpiStrip>

        {/* LIST CARD */}
        <div className={s.card}>
          <StatusTabs
            tabs={STATUS_TABS}
            active={tab}
            onChange={(t) => { setTab(t); setPage(1); }}
            counts={tabCounts}
          />

          <FilterBar>
            <SearchInput
              value={query}
              onChange={(v) => { setQuery(v); setPage(1); }}
              placeholder="Filter creatives…"
            />
            <FilterDropdown
              label="Type"
              icon="category"
              options={TYPES}
              selected={typeSel}
              onChange={setTypeSel}
              onClear={() => setTypeSel(new Set(TYPES))}
              onApply={() => setPage(1)}
            />
            <FilterDropdown
              label="Network"
              icon="hub"
              options={NETWORKS as unknown as string[]}
              selected={netSel}
              onChange={setNetSel}
              onClear={() => setNetSel(new Set(NETWORKS))}
              onApply={() => setPage(1)}
            />
            <button
              type="button"
              className={s.filterBtn}
              onClick={() => setSavedViewsOpen(true)}
              title="Saved views"
            >
              <span className="material-symbols-outlined">bookmark</span>Saved views
            </button>
            {filtersActive && (
              <button
                type="button"
                className={s.filterBtn}
                onClick={clearAll}
                title="Clear all filters"
              >
                <span className="material-symbols-outlined">filter_alt_off</span>Clear all
              </button>
            )}
            <span className={s.flex1} />
            <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              {filtered.length} of {creatives.length}
            </span>
          </FilterBar>

          {selected.size > 0 && (
            <BulkBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              actions={[
                { label: 'Publish', icon: 'publish', onClick: bulkPublish },
                { label: 'Archive', icon: 'archive', onClick: bulkArchive },
                { label: 'Duplicate', icon: 'content_copy', onClick: bulkDuplicate },
                { label: 'Delete', icon: 'delete', onClick: bulkDelete, danger: true },
              ]}
            />
          )}

          {pageRows.length === 0 ? (
            <EmptyState
              icon="perm_media"
              title="No creatives match"
              body="Clear filters or upload a new creative."
            />
          ) : (
            <TableWrap>
              <Table
                head={(
                  <tr>
                    <th className={s.checkCell}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={toggleAll}
                      />
                    </th>
                    {!hiddenCols.has('preview') && <th style={{ width: 56 }}>Preview</th>}
                    {!hiddenCols.has('creative') && <th>Creative</th>}
                    {!hiddenCols.has('type') && <th>Type</th>}
                    {!hiddenCols.has('networks') && <th>Networks</th>}
                    {!hiddenCols.has('usedin') && <th>Used in</th>}
                    {!hiddenCols.has('impressions') && <th className={s.right}>Impressions</th>}
                    {!hiddenCols.has('ctr') && <th className={s.right}>CTR</th>}
                    {!hiddenCols.has('roas') && <th className={s.right}>ROAS</th>}
                    {!hiddenCols.has('status') && <th>Status</th>}
                    <th style={{ width: 32 }} />
                  </tr>
                )}
              >
                {pageRows.map((c) => (
                  <tr key={c.id} onClick={() => setPeekId(c.id)}>
                    <td className={s.checkCell} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    {!hiddenCols.has('preview') && (
                      <td>
                        <span
                          className={s.thumb}
                          style={{
                            width: 48,
                            height: 48,
                            background: TYPE_THUMB_GRADIENT[c.type],
                            color: '#fff',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                            {TYPE_ICON[c.type]}
                          </span>
                        </span>
                      </td>
                    )}
                    {!hiddenCols.has('creative') && (
                      <td>
                        <div className={s.rowName}>{c.name}</div>
                        <div className={s.rowSub}>{c.id} · {c.dimensions}</div>
                      </td>
                    )}
                    {!hiddenCols.has('type') && <td>{c.type}</td>}
                    {!hiddenCols.has('networks') && (
                      <td>
                        <div className={s.chipRow}>
                          {c.networks.map((n) => (
                            <NetChip key={n} net={n} />
                          ))}
                        </div>
                      </td>
                    )}
                    {!hiddenCols.has('usedin') && (
                      <td className={s.tabularNums}>
                        {c.usedIn} campaign{c.usedIn === 1 ? '' : 's'}
                      </td>
                    )}
                    {!hiddenCols.has('impressions') && (
                      <td className={s.right}>{c.impressions.toLocaleString()}</td>
                    )}
                    {!hiddenCols.has('ctr') && (
                      <td className={s.right}>
                        {c.ctr ? `${c.ctr.toFixed(1)}%` : '—'}
                      </td>
                    )}
                    {!hiddenCols.has('roas') && (
                      <td className={s.right}>
                        {c.roas ? `${c.roas.toFixed(2)}×` : '—'}
                      </td>
                    )}
                    {!hiddenCols.has('status') && (
                      <td><StatusPill status={c.status} /></td>
                    )}
                    <td onClick={(e) => e.stopPropagation()}>
                      <RowMenu items={rowMenuItems(c)} />
                    </td>
                  </tr>
                ))}
              </Table>
            </TableWrap>
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
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span>
              Rows per page:
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                style={{
                  height: 22,
                  width: 'auto',
                  padding: '0 18px 0 4px',
                  fontSize: 11,
                  marginLeft: 6,
                  border: '1px solid var(--surface-dim)',
                  borderRadius: 4,
                  background: 'var(--surface-container-lowest)',
                  color: 'var(--on-surface)',
                  appearance: 'none',
                  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235a6355' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 4px center',
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={75}>75</option>
                <option value={100}>100</option>
              </select>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className={s.btnIcon}
                style={{ width: 24, height: 24, border: 0, background: 'transparent' }}
                onClick={goPrev}
                disabled={currentPage <= 1}
                title="Previous page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className={s.btnIcon}
                style={{ width: 24, height: 24, border: 0, background: 'transparent' }}
                onClick={goNext}
                disabled={currentPage >= totalPages}
                title="Next page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════ OVERLAYS ═══════════════════════ */}

      {/* PEEK DRAWER */}
      {peekCreative && (
        <>
          <Scrim onClose={() => setPeekId(null)} />
          <div className={s.peek}>
            <div className={s.peekHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 18, color: 'var(--on-surface-variant)' }}
                >
                  perm_media
                </span>
                <span
                  className={s.headlineSm}
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {peekCreative.name}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary} ${s.btnSm}`}
                  onClick={() => { const id = peekCreative.id; setPeekId(null); openEditor(id); }}
                >
                  <span className="material-symbols-outlined">edit</span>Edit
                </button>
                <IconBtn icon="close" onClick={() => setPeekId(null)} />
              </div>
            </div>
            <div className={s.peekBody}>
              {/* status + networks */}
              <div className={`${s.flex} ${s.itemsCenter} ${s.gap2} ${s.mb3}`}>
                <StatusPill status={peekCreative.status} />
                {peekCreative.networks.map((n) => (
                  <NetChip key={n} net={n} />
                ))}
              </div>

              {/* preview */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '4 / 3',
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  color: '#fff',
                  background: PREVIEW_GRADIENT,
                  position: 'relative',
                  marginBottom: 12,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 64, opacity: 0.8 }}
                >
                  {TYPE_ICON[peekCreative.type]}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(255,255,255,.9)',
                    color: 'var(--on-surface)',
                  }}
                >
                  {peekCreative.type} · {peekCreative.dimensions}
                </span>
              </div>

              {/* 3-stat grid */}
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
                  <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    Impressions
                  </div>
                  <div className={`${s.bodyMd} ${s.tabularNums}`} style={{ fontWeight: 600 }}>
                    {peekCreative.impressions.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    CTR
                  </div>
                  <div className={`${s.bodyMd} ${s.tabularNums}`} style={{ fontWeight: 600 }}>
                    {peekCreative.ctr ? `${peekCreative.ctr.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                    ROAS
                  </div>
                  <div className={`${s.bodyMd} ${s.tabularNums}`} style={{ fontWeight: 600 }}>
                    {peekCreative.roas ? `${peekCreative.roas.toFixed(2)}×` : '—'}
                  </div>
                </div>
              </div>

              {/* KV list */}
              <KvList
                items={[
                  { k: 'Creative ID', v: <span className={s.mono}>{peekCreative.id}</span> },
                  { k: 'Type', v: peekCreative.type },
                  { k: 'Dimensions', v: peekCreative.dimensions },
                  { k: 'Used in', v: `${peekCreative.usedIn} campaign(s)` },
                  { k: 'Headline', v: peekCreative.headline },
                  { k: 'CTA', v: peekCreative.cta },
                ]}
              />

              {/* Primary text */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--surface-dim)' }}>
                <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: 4 }}>
                  Primary text
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{peekCreative.primary}</div>
              </div>

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
                <button
                  type="button"
                  className={`${s.btn} ${s.btnPrimary}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { const id = peekCreative.id; setPeekId(null); openEditor(id); }}
                >
                  <span className="material-symbols-outlined">edit</span>Edit
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setPreviewCreative(peekCreative)}
                >
                  <span className="material-symbols-outlined">visibility</span>Preview
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => duplicate(peekCreative.id)}
                >
                  <span className="material-symbols-outlined">content_copy</span>Duplicate
                </button>
                <button
                  type="button"
                  className={`${s.btn} ${s.btnOutline}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => archiveCreative(peekCreative.id)}
                >
                  <span className="material-symbols-outlined">archive</span>Archive
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* CREATIVE EDITOR DRAWER */}
      {editorOpen && (
        <>
          <Scrim onClose={closeEditor} />
          <div className={s.drawer} style={{ width: 680 }}>
            <div className={s.drawerHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, color: 'var(--primary)' }}
                >
                  perm_media
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    className={s.headlineSm}
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {editingId ? 'Edit creative' : 'New creative'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    {editingId ? `${form.status} · ${editingId}` : 'Draft · not yet live'}
                  </div>
                </div>
              </div>
              <IconBtn icon="close" onClick={closeEditor} />
            </div>

            <div className={s.drawerBody}>
              {/* BASICS */}
              <section className={s.mb4}>
                <div className={s.sectionH}>Creative basics</div>
                <Field label="Creative name">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Fall hero — 1x1"
                  />
                </Field>
                <div className={s.fieldRow}>
                  <div>
                    <label className={s.fieldLabel}>Type</label>
                    <Select
                      value={form.type}
                      onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as CreativeType }))}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className={s.fieldLabel}>Status</label>
                    <Select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CreativeStatus }))}
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <Field label="Dimensions">
                  <Input
                    value={form.dimensions}
                    onChange={(e) => setForm((p) => ({ ...p, dimensions: e.target.value }))}
                    placeholder="e.g. 1080x1080"
                  />
                </Field>
              </section>

              {/* ASSET */}
              <section className={s.mb4}>
                <div className={s.sectionH}>Asset</div>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: '1.5px dashed var(--outline-variant)',
                    background: 'var(--surface-container-low)',
                    borderRadius: 8,
                    padding: 18,
                    textAlign: 'center' as const,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 24, color: 'var(--primary)' }}
                  >
                    cloud_upload
                  </span>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginTop: 4 }}>
                    Upload or replace asset
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                    Images (JPG, PNG, WEBP), videos (MP4) · max 500 MB
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setForm((p) => ({
                          ...p,
                          fileName: `Selected: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`,
                        }));
                        onToast(`Attached ${f.name}`);
                      }
                    }}
                  />
                </div>
                {form.fileName && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--on-surface-variant)' }}>
                    {form.fileName}
                  </div>
                )}
              </section>

              {/* COPY */}
              <section className={s.mb4}>
                <div className={s.sectionH}>Copy</div>
                <Field label="Headline">
                  <Input
                    value={form.headline}
                    onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                    placeholder="e.g. Meet the fall capsule"
                  />
                </Field>
                <Field label="Primary text">
                  <Textarea
                    value={form.primary}
                    onChange={(e) => setForm((p) => ({ ...p, primary: e.target.value }))}
                    placeholder="The main copy shown above your image"
                  />
                </Field>
                <div className={s.fieldRow}>
                  <div>
                    <label className={s.fieldLabel}>Call to action</label>
                    <Select
                      value={form.cta}
                      onChange={(e) => setForm((p) => ({ ...p, cta: e.target.value }))}
                    >
                      {CTA_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className={s.fieldLabel}>Destination URL</label>
                    <Input
                      value={form.url}
                      onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://unsaid.app/fall"
                    />
                  </div>
                </div>
              </section>

              {/* ALLOWED NETWORKS */}
              <section className={s.mb4}>
                <div className={s.sectionH}>Allowed networks</div>
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
                      }}
                    >
                      <span style={{ fontSize: 13 }}>{NETWORK_LABEL[n]}</span>
                      <input
                        type="checkbox"
                        checked={form.networks.includes(n)}
                        onChange={() =>
                          setForm((p) => ({
                            ...p,
                            networks: p.networks.includes(n)
                              ? p.networks.filter((x) => x !== n)
                              : [...p.networks, n],
                          }))
                        }
                        style={{ accentColor: 'var(--qb-blue)' }}
                      />
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <div className={s.drawerFoot}>
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Btn variant="outline" onClick={closeEditor}>Cancel</Btn>
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
                      tabIndex={-1}
                      title="More save options"
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
                      tabIndex={-1}
                      title="More save options"
                    >
                      <span className="material-symbols-outlined">expand_more</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* PREVIEW MODAL */}
      <Modal
        open={!!previewCreative}
        title="Creative preview"
        onClose={() => setPreviewCreative(null)}
      >
        {previewCreative && (
          <>
            <div
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                background: PREVIEW_GRADIENT,
                position: 'relative',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 64, opacity: 0.8 }}
              >
                {TYPE_ICON[previewCreative.type]}
              </span>
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  padding: '2px 8px',
                  borderRadius: 20,
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,.9)',
                  color: 'var(--on-surface)',
                }}
              >
                {previewCreative.type} · {previewCreative.dimensions}
              </span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Headline
                </div>
                <div style={{ marginTop: 2, fontWeight: 500 }}>
                  {previewCreative.headline || '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Primary text
                </div>
                <div style={{ marginTop: 2 }}>{previewCreative.primary || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CTA
                </div>
                <div style={{ marginTop: 2 }}>{previewCreative.cta || '—'}</div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* CUSTOMIZE COLUMNS MODAL */}
      <Modal
        open={customizeOpen}
        title="Customize columns"
        onClose={() => setCustomizeOpen(false)}
        footer={(
          <>
            <Btn variant="outline" onClick={() => setCustomizeOpen(false)}>Close</Btn>
            <Btn
              variant="primary"
              onClick={() => {
                setCustomizeOpen(false);
                onToast('Columns updated');
              }}
            >
              Apply
            </Btn>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CUSTOMIZE_COLS.map((col) => (
            <label key={col.key} className={s.popoverCheckRow}>
              <input
                type="checkbox"
                checked={!hiddenCols.has(col.key)}
                onChange={() =>
                  setHiddenCols((p) => {
                    const n = new Set(p);
                    if (n.has(col.key)) n.delete(col.key);
                    else n.add(col.key);
                    return n;
                  })
                }
              />
              {col.label}
            </label>
          ))}
        </div>
      </Modal>

      {/* SAVED VIEWS MODAL */}
      <Modal
        open={savedViewsOpen}
        title="Saved views"
        onClose={() => setSavedViewsOpen(false)}
        footer={<Btn variant="outline" onClick={() => setSavedViewsOpen(false)}>Close</Btn>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Field label="View name">
              <Input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Live fall creatives"
              />
            </Field>
            <div style={{ marginTop: 4 }}>
              <Btn variant="primary" onClick={saveView}>Save current filters</Btn>
            </div>
          </div>
          <div>
            <div className={s.sectionH}>Saved</div>
            {savedViews.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                No saved views yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedViews.map((v) => (
                  <div
                    key={v.name}
                    style={{
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      padding: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className={s.popoverItem}
                      style={{ flex: 1, padding: '4px 6px' }}
                      onClick={() => loadView(v)}
                      title={`Load view "${v.name}"`}
                    >
                      <span className="material-symbols-outlined">bookmark</span>
                      <span style={{ fontWeight: 600 }}>{v.name}</span>
                    </button>
                    <button
                      type="button"
                      className={s.btnIcon}
                      style={{ width: 24, height: 24, border: 0 }}
                      title="Delete view"
                      onClick={() => deleteView(v.name)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <Modal
        open={!!confirmDel}
        title="Delete creative(s)?"
        onClose={() => setConfirmDel(null)}
        footer={(
          <>
            <Btn variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={confirmDelete}>Delete</Btn>
          </>
        )}
      >
        <p style={{ margin: 0, fontSize: 13 }}>
          {confirmDel && confirmDel.ids.length === 1
            ? `Delete creative "${creatives.find((c) => c.id === confirmDel.ids[0])?.name ?? ''}"? This cannot be undone.`
            : `Delete ${confirmDel?.ids.length ?? 0} creative(s)? This cannot be undone.`}
        </p>
      </Modal>
    </div>
  );
}
