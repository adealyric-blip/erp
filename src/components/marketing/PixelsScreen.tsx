'use client';

/**
 * Pixels — 1:1 faithful port of
 *   /home/z/my-project/upload/marketing_extracted/Marketing/pixels.html
 * Ad-network conversion pixels installed on the storefront, and the events
 * they fire into Meta / TikTok / Google Ads / Pinterest. Uses the shared
 * MarketingPrimitives design system.
 *
 * Every button does real work:
 *   - Event volume in Reports → opens destination modal (Finance → Reports)
 *   - Export events          → exportToCsv of RECENT_EVENTS
 *   - New pixel (Split)      → opens editor drawer; menu items: Pixel / Pick from network
 *   - Row click              → opens peek drawer with full details + actions
 *   - Row ⋯ menu             → Edit / View / Self-test / Copy snippet / Pause / Resume / Delete
 *   - Bulk actions           → Pause / Resume / Self-test / Delete (mutate selected, clear, toast)
 *   - Editor Save            → persists (Save and new / Save and close)
 *   - Filter Apply           → actually filters
 *   - Search                 → real-time
 *   - Status tabs            → filter
 *   - Pagination             → real rows-per-page + page navigation
 *   - Self-test modal        → animated 3-step badge flow that mutates pixel event counts
 *   - Recent events stream   → simulates auto-refresh (3s) + manual refresh
 *   - Saved views            → Save current view modal + apply/delete
 *   - Network filter dropdown → actually filters by network
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
  StatusTabs,
  FilterBar,
  SearchInput,
  FilterDropdown,
  BulkBar,
  RowMenu,
  type RowMenuItem,
  Drawer,
  Peek,
  Modal,
  TableWrap,
  Table,
  Field,
  Input,
  Textarea,
  Select,
  KvList,
  EmptyState,
  type MarketingScreenProps,
  s,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';

/* ───────────── types ───────────── */
type Network = 'Meta' | 'TikTok' | 'GoogleAds' | 'Pinterest';
type PixelStatus = 'Live' | 'Paused' | 'Error';
type InstallMethod =
  | 'Script in <head>'
  | 'GTM container'
  | 'Shopify app'
  | 'Server-side (CAPI / Events API)';

interface PixelEvent {
  name: string;
  kind: 'standard';
  valueField?: string;
}

interface Pixel {
  id: string;
  name: string;
  network: Network;
  pixelId: string;
  install: InstallMethod;
  status: PixelStatus;
  events24: number;
  events30: number;
  lastEvent: string | null;
  events: PixelEvent[];
}

interface RecentEvent {
  at: string;
  pixel: string;
  event: string;
  value: number | null;
  ok: boolean;
  err?: string;
  flash?: boolean;
}

interface SavedView {
  id: string;
  name: string;
  tab: string;
  q: string;
  networks: Network[];
}

interface EditorForm {
  name: string;
  status: PixelStatus;
  install: InstallMethod;
  pixelId: string;
  network: Network;
  events: PixelEvent[];
}

type SelfTestStep = 'pending' | 'ok' | 'bad';
interface SelfTestState {
  step1: SelfTestStep;
  step2: SelfTestStep;
  step3: SelfTestStep;
}

/* ───────────── constants (mirror HTML) ───────────── */
const NETWORKS: Network[] = ['Meta', 'TikTok', 'GoogleAds', 'Pinterest'];
const NETWORK_LABEL: Record<Network, string> = {
  Meta: 'Meta',
  TikTok: 'TikTok',
  GoogleAds: 'Google Ads',
  Pinterest: 'Pinterest',
};
const STATUS_TABS = ['All', 'Live', 'Paused', 'Error'];
const INSTALL_METHODS: InstallMethod[] = [
  'Script in <head>',
  'GTM container',
  'Shopify app',
  'Server-side (CAPI / Events API)',
];
const PIXEL_STATUSES: PixelStatus[] = ['Live', 'Paused', 'Error'];

const STATUS_KIND: Record<PixelStatus, string> = {
  Live: 'active',
  Paused: 'paused',
  Error: 'rejected',
};

const NETWORK_TILE: Record<
  Network,
  { initials: string; label: string; sub: string; gradient: string }
> = {
  Meta: {
    initials: 'ME',
    label: 'Meta Pixel',
    sub: 'Facebook + Instagram',
    gradient: 'linear-gradient(135deg,#4b77b8,#1f2937)',
  },
  TikTok: {
    initials: 'TI',
    label: 'TikTok Pixel',
    sub: 'TikTok Ads',
    gradient: 'linear-gradient(135deg,#27353a,#0e5e6f)',
  },
  GoogleAds: {
    initials: 'GA',
    label: 'Google Ads tag',
    sub: 'gtag / AW-… · not GA4',
    gradient: 'linear-gradient(135deg,#c45c5b,#6b1e28)',
  },
  Pinterest: {
    initials: 'PI',
    label: 'Pinterest Tag',
    sub: 'Pinterest Ads',
    gradient: 'linear-gradient(135deg,#bd5558,#6b1e28)',
  },
};

const EVENTS_EXPORT_COLUMNS = [
  { key: 'at', label: 'at' },
  { key: 'pixel', label: 'pixel' },
  { key: 'pixel_name', label: 'pixel_name' },
  { key: 'event', label: 'event' },
  { key: 'value', label: 'value' },
  { key: 'ok', label: 'ok' },
  { key: 'error', label: 'error' },
];

const PIXELS_EXPORT_COLUMNS = [
  { key: 'id', label: 'id' },
  { key: 'name', label: 'name' },
  { key: 'network', label: 'network' },
  { key: 'pixelId', label: 'pixel_id' },
  { key: 'install', label: 'install' },
  { key: 'status', label: 'status' },
  { key: 'events24', label: 'events_24h' },
  { key: 'events30', label: 'events_30d' },
  { key: 'lastEvent', label: 'last_event' },
];

/* ───────────── helpers ───────────── */
function fmtNum(n: number): string {
  return (n || 0).toLocaleString('en-US');
}

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

function nowIso(): string {
  return new Date().toISOString();
}

function netLabel(n: Network): string {
  return NETWORK_LABEL[n];
}

function netChipClass(n: Network): string {
  return `net-${n}`;
}

function installClass(install: InstallMethod): string {
  if (install.startsWith('Server')) return 'var(--qb-teal)';
  if (install === 'GTM container') return 'var(--qb-blue)';
  return 'var(--on-surface)';
}

function pxIconStyle(network: Network): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    background: NETWORK_TILE[network].gradient,
  };
}

/* snippet templates — mirrored from HTML <template> blocks */
function buildSnippet(network: Network, pixelId: string): string {
  const id = pixelId || 'XXXX';
  switch (network) {
    case 'Meta':
      return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`;
    case 'TikTok':
      return `<!-- TikTok Pixel Code -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
  ttq.load('${id}');
  ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel Code -->`;
    case 'GoogleAds':
      return `<!-- Google Ads tag (AW-…) — note: not GA4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');
</script>
<!-- End Google Ads tag -->`;
    case 'Pinterest':
      return `<!-- Pinterest Tag -->
<script>
!function(e){if(!window.pintrk){window.pintrk = function () {
window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
  n=window.pintrk;n.queue=[],n.version="3.0";var
  t=document.createElement("script");t.async=!0;t.src=e;var
  r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '${id}');
pintrk('page');
</script>
<noscript>
<img height="1" width="1" style="display:none;" alt="" src="https://ct.pinterest.com/v3/?event=init&tid=${id}&noscript=1" />
</noscript>
<!-- End Pinterest Tag -->`;
  }
}

function emptyEditorForm(): EditorForm {
  return {
    name: '',
    status: 'Live',
    install: 'Script in <head>',
    pixelId: '',
    network: 'Meta',
    events: [
      { name: 'PageView', kind: 'standard' },
      { name: 'Purchase', kind: 'standard', valueField: 'value' },
    ],
  };
}

function formFromPixel(p: Pixel): EditorForm {
  return {
    name: p.name,
    status: p.status,
    install: p.install,
    pixelId: p.pixelId,
    network: p.network,
    events: p.events.map((e) => ({ ...e })),
  };
}

/* ───────────── seed data (1:1 with HTML) ───────────── */
const SEED_PIXELS: Pixel[] = [
  {
    id: 'PX-101',
    name: 'Meta Pixel — Storefront',
    network: 'Meta',
    pixelId: '1029XXXX4471',
    install: 'Script in <head>',
    status: 'Live',
    events24: 1240,
    events30: 38420,
    lastEvent: '2026-11-03T09:42:11',
    events: [
      { name: 'PageView', kind: 'standard' },
      { name: 'ViewContent', kind: 'standard' },
      { name: 'AddToCart', kind: 'standard' },
      { name: 'InitiateCheckout', kind: 'standard' },
      { name: 'Purchase', kind: 'standard', valueField: 'value' },
    ],
  },
  {
    id: 'PX-102',
    name: 'TikTok Pixel — Storefront',
    network: 'TikTok',
    pixelId: 'C4XXXXT9',
    install: 'Script in <head>',
    status: 'Live',
    events24: 412,
    events30: 9821,
    lastEvent: '2026-11-03T09:40:02',
    events: [
      { name: 'Pageview', kind: 'standard' },
      { name: 'ViewContent', kind: 'standard' },
      { name: 'AddToCart', kind: 'standard' },
      { name: 'CompletePayment', kind: 'standard', valueField: 'value' },
    ],
  },
  {
    id: 'PX-103',
    name: 'Google Ads tag',
    network: 'GoogleAds',
    pixelId: 'AW-XXXXXX',
    install: 'GTM container',
    status: 'Live',
    events24: 588,
    events30: 14620,
    lastEvent: '2026-11-03T09:39:55',
    events: [
      { name: 'page_view', kind: 'standard' },
      { name: 'view_item', kind: 'standard' },
      { name: 'add_to_cart', kind: 'standard' },
      { name: 'purchase', kind: 'standard', valueField: 'value' },
    ],
  },
  {
    id: 'PX-104',
    name: 'Pinterest Tag',
    network: 'Pinterest',
    pixelId: '2617XXXX',
    install: 'Script in <head>',
    status: 'Paused',
    events24: 0,
    events30: 2140,
    lastEvent: '2026-10-28T14:10:00',
    events: [
      { name: 'PageVisit', kind: 'standard' },
      { name: 'AddToCart', kind: 'standard' },
      { name: 'Checkout', kind: 'standard' },
    ],
  },
  {
    id: 'PX-105',
    name: 'Server-side events (CAPI)',
    network: 'Meta',
    pixelId: 'CAPI-XXXX',
    install: 'Server-side (CAPI / Events API)',
    status: 'Error',
    events24: 0,
    events30: 0,
    lastEvent: null,
    events: [{ name: 'Purchase', kind: 'standard', valueField: 'value' }],
  },
];

const SEED_EVENTS: RecentEvent[] = [
  { at: '2026-11-03T09:42:11', pixel: 'PX-101', event: 'PageView', value: null, ok: true },
  { at: '2026-11-03T09:41:52', pixel: 'PX-103', event: 'view_item', value: null, ok: true },
  { at: '2026-11-03T09:41:31', pixel: 'PX-101', event: 'AddToCart', value: 18.0, ok: true },
  { at: '2026-11-03T09:41:02', pixel: 'PX-102', event: 'AddToCart', value: 24.0, ok: true },
  { at: '2026-11-03T09:40:02', pixel: 'PX-102', event: 'ViewContent', value: null, ok: true },
  { at: '2026-11-03T09:39:55', pixel: 'PX-103', event: 'page_view', value: null, ok: true },
  { at: '2026-11-03T09:39:21', pixel: 'PX-101', event: 'Purchase', value: 58.0, ok: true },
  { at: '2026-11-03T09:38:40', pixel: 'PX-103', event: 'purchase', value: 58.0, ok: true },
  {
    at: '2026-11-03T09:37:12',
    pixel: 'PX-105',
    event: 'Purchase',
    value: null,
    ok: false,
    err: 'Server-side token expired',
  },
  { at: '2026-11-03T09:36:09', pixel: 'PX-101', event: 'InitiateCheckout', value: null, ok: true },
];

const SEED_VIEWS: SavedView[] = [
  { id: 'sv-1', name: 'Live Meta', tab: 'Live', q: '', networks: ['Meta'] },
  { id: 'sv-2', name: 'Error pixels', tab: 'Error', q: '', networks: [...NETWORKS] },
];

/* destinations table (mirror HTML DESTS) */
interface Destination {
  title: string;
  body: string;
  route: string;
  nav?: { domain: string; screenId: string };
}
const DESTS: Record<string, Destination> = {
  reports: {
    title: 'Finance → Reports',
    body: 'Event volume rolls into the Advertising performance report.',
    route: '/finance/reports?category=advertising',
    nav: { domain: 'finance', screenId: 'reports' },
  },
  'pick-from-network': {
    title: 'Pick from network',
    body: "Fetch an existing pixel from the advertiser's connected network account.",
    route: '/advertising/pixels/from-network',
  },
  integrations: {
    title: 'Settings → Integrations',
    body: 'Install GA4, PostHog, Clarity, Hotjar, Segment, or GTM containers — those live in Integrations, not Advertising.',
    route: '/settings/integrations',
    nav: { domain: 'settings', screenId: 'integrations' },
  },
  'event-volume': {
    title: 'Finance → Reports',
    body: 'Event volume by pixel and period.',
    route: '/finance/reports?metric=events',
    nav: { domain: 'finance', screenId: 'reports' },
  },
};

/* ───────────── main component ───────────── */
export default function PixelsScreen({ onToast, onNavigate }: MarketingScreenProps) {
  /* ── state ── */
  const [pixels, setPixels] = useState<Pixel[]>(SEED_PIXELS);
  const [events, setEvents] = useState<RecentEvent[]>(SEED_EVENTS);
  const [savedViews, setSavedViews] = useState<SavedView[]>(SEED_VIEWS);

  const [tab, setTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [networkFilter, setNetworkFilter] = useState<Set<string>>(
    new Set(NETWORKS as string[]),
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<EditorForm>(emptyEditorForm());

  const [selftestId, setSelftestId] = useState<string | null>(null);
  const [selftestState, setSelftestState] = useState<SelfTestState>({
    step1: 'pending',
    step2: 'pending',
    step3: 'pending',
  });
  const selftestTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [destKey, setDestKey] = useState<string | null>(null);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);

  const [autoStream, setAutoStream] = useState(true);
  const streamTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── filtered list ── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pixels.filter((p) => {
      const qOK =
        !q ||
        (p.id + ' ' + p.name + ' ' + p.network + ' ' + p.pixelId)
          .toLowerCase()
          .includes(q);
      const tabOK = tab === 'All' || p.status === tab;
      const netOK = networkFilter.has(p.network);
      return qOK && tabOK && netOK;
    });
  }, [pixels, search, tab, networkFilter]);

  /* ── KPIs (mirror HTML syncCounts) ── */
  const liveCount = pixels.filter((p) => p.status === 'Live').length;
  const errorCount = pixels.filter((p) => p.status === 'Error').length;
  const ev24 = pixels.reduce((sum, p) => sum + p.events24, 0);
  const ev30 = pixels.reduce((sum, p) => sum + p.events30, 0);
  const activePixels = pixels.filter((p) => p.events30 > 0).length;
  const lastEventIso = pixels.reduce<string | null>(
    (m, p) => (!m || (p.lastEvent && p.lastEvent > m) ? p.lastEvent : m),
    null,
  );

  /* ── tab counts ── */
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: pixels.length };
    for (const st of STATUS_TABS) {
      if (st === 'All') continue;
      c[st] = pixels.filter((p) => p.status === st).length;
    }
    return c;
  }, [pixels]);

  const filtersActive =
    !!search.trim() ||
    tab !== 'All' ||
    networkFilter.size !== NETWORKS.length;

  const clearAllFilters = () => {
    setSearch('');
    setTab('All');
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
  const allSelectedOnPage = paged.length > 0 && paged.every((p) => selected.has(p.id));
  const someSelectedOnPage = paged.some((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        for (const p of paged) next.delete(p.id);
      } else {
        for (const p of paged) next.add(p.id);
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
  const peekPixel = peekId ? pixels.find((p) => p.id === peekId) ?? null : null;
  const openPeek = (id: string) => setPeekId(id);
  const closePeek = () => setPeekId(null);

  /* ── editor ── */
  const openNew = () => {
    setForm(emptyEditorForm());
    setEditId(null);
    setPeekId(null);
    setEditorOpen(true);
  };
  const openEdit = (id: string) => {
    const p = pixels.find((x) => x.id === id);
    if (!p) return;
    setForm(formFromPixel(p));
    setEditId(id);
    setPeekId(null);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    setEditId(null);
  };

  /* ── collect pixel (mirror HTML collectPixel) ── */
  const collectPixel = (): Pixel | null => {
    const name = form.name.trim();
    if (!name) {
      onToast('Pixel name is required');
      return null;
    }
    const pid = form.pixelId.trim();
    if (!pid) {
      onToast('Pixel ID is required');
      return null;
    }
    const existing = editId ? pixels.find((p) => p.id === editId) : null;
    return {
      id: editId ?? 'PX-' + String(pixels.length + 101).slice(-3),
      name,
      network: form.network,
      pixelId: pid,
      install: form.install,
      status: form.status,
      events24: existing?.events24 ?? 0,
      events30: existing?.events30 ?? 0,
      lastEvent: existing?.lastEvent ?? null,
      events: form.events.map((e) => ({ ...e })),
    };
  };

  const saveAndClose = () => {
    const p = collectPixel();
    if (!p) return;
    setPixels((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = p;
          return next;
        }
      }
      return [p, ...prev];
    });
    onToast(editId ? 'Pixel updated' : 'Pixel created');
    closeEditor();
  };

  const saveAndNew = () => {
    const p = collectPixel();
    if (!p) return;
    setPixels((prev) => {
      if (editId) {
        const idx = prev.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = p;
          return next;
        }
      }
      return [p, ...prev];
    });
    onToast('Saved. New pixel form ready.');
    setEditId(null);
    setForm(emptyEditorForm());
  };

  /* ── row actions ── */
  const pauseOne = (p: Pixel) => {
    setPixels((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: 'Paused' } : x)),
    );
    onToast(`Paused: ${p.name}`);
  };
  const resumeOne = (p: Pixel) => {
    setPixels((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: 'Live' } : x)),
    );
    onToast(`Resumed: ${p.name}`);
  };
  const deleteOne = (p: Pixel) => {
    if (!confirm(`Delete pixel "${p.name}"?`)) return;
    setPixels((prev) => prev.filter((x) => x.id !== p.id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(p.id);
      return n;
    });
    if (peekId === p.id) setPeekId(null);
    if (selftestId === p.id) closeSelftest();
    onToast(`Deleted: ${p.name}`);
  };
  const copySnippet = (p: Pixel) => {
    const snip = buildSnippet(p.network, p.pixelId);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(snip)
        .then(() => onToast('Snippet copied — paste into <head>'))
        .catch(() => onToast('Copy failed — select and copy manually'));
    } else {
      onToast('Clipboard unavailable. Snippet placed in editor.');
    }
  };

  /* ── bulk actions ── */
  const bulkPause = () => {
    const n = selected.size;
    setPixels((prev) =>
      prev.map((p) => (selected.has(p.id) ? { ...p, status: 'Paused' } : p)),
    );
    onToast(`Paused ${n} pixel(s)`);
    setSelected(new Set());
  };
  const bulkResume = () => {
    const n = selected.size;
    setPixels((prev) =>
      prev.map((p) => (selected.has(p.id) ? { ...p, status: 'Live' } : p)),
    );
    onToast(`Resumed ${n} pixel(s)`);
    setSelected(new Set());
  };
  const bulkSelftest = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    /* run self-test on first selected; toast about the rest */
    openSelftest(ids[0]);
    if (ids.length > 1) onToast(`Self-test queued for ${ids.length} pixel(s)`);
    setSelected(new Set());
  };
  const bulkDelete = () => {
    const n = selected.size;
    if (!confirm(`Delete ${n} pixel(s)?`)) return;
    setPixels((prev) => prev.filter((p) => !selected.has(p.id)));
    onToast(`Deleted ${n} pixel(s)`);
    setSelected(new Set());
  };

  /* ── export events ── */
  const exportEvents = () => {
    const rows = events.map((ev) => {
      const p = pixels.find((x) => x.id === ev.pixel);
      return {
        at: ev.at,
        pixel: ev.pixel,
        pixel_name: p ? p.name : '',
        event: ev.event,
        value: ev.value ?? '',
        ok: ev.ok,
        error: ev.err ?? '',
      };
    });
    exportToCsv(rows, EVENTS_EXPORT_COLUMNS, `pixel-events-${nowIso().slice(0, 10)}`);
    onToast('Exported events CSV');
  };

  /* ── export pixels ── */
  const exportPixels = () => {
    exportToCsv(
      filtered as unknown as Record<string, unknown>[],
      PIXELS_EXPORT_COLUMNS,
      'pixels',
    );
    onToast(`Exporting ${filtered.length} pixels…`);
  };

  /* ── open destination modal ── */
  const openDest = (key: string) => setDestKey(key);
  const dest = destKey ? DESTS[destKey] ?? null : null;
  const confirmDest = () => {
    if (!dest) return;
    const route = dest.route;
    setDestKey(null);
    if (dest.nav && onNavigate) {
      onNavigate(dest.nav.domain, dest.nav.screenId);
    } else {
      onToast(`Navigating: ${route}`);
    }
  };

  /* ── saved views ── */
  const applyView = (v: SavedView) => {
    setTab(v.tab);
    setSearch(v.q);
    setNetworkFilter(new Set(v.networks));
    setSavedViewsOpen(false);
    setPage(1);
    onToast('Applied view: ' + v.name);
  };
  const deleteView = (id: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    onToast('View deleted');
  };
  const saveCurrentView = () => {
    const name = saveViewName.trim();
    if (!name) {
      onToast('Name is required');
      return;
    }
    setSavedViews((prev) => [
      ...prev,
      {
        id: 'sv-' + Date.now(),
        name,
        tab,
        q: search,
        networks: Array.from(networkFilter) as Network[],
      },
    ]);
    setSaveViewOpen(false);
    setSaveViewName('');
    onToast('Saved view: ' + name);
  };

  /* ── self-test modal ── */
  const openSelftest = (id: string) => {
    setSelftestId(id);
    setSelftestState({ step1: 'pending', step2: 'pending', step3: 'pending' });
    runSelftest(id);
  };
  const closeSelftest = () => {
    selftestTimers.current.forEach((t) => clearTimeout(t));
    selftestTimers.current = [];
    setSelftestId(null);
  };
  const runSelftest = (id: string) => {
    /* clear pending timers */
    selftestTimers.current.forEach((t) => clearTimeout(t));
    selftestTimers.current = [];
    setSelftestState({ step1: 'pending', step2: 'pending', step3: 'pending' });
    const p = pixels.find((x) => x.id === id);
    if (!p) return;
    const t1 = setTimeout(() => {
      setSelftestState((prev) => ({ ...prev, step1: 'ok' }));
      const t2 = setTimeout(() => {
        if (p.status === 'Error') {
          setSelftestState({ step1: 'ok', step2: 'bad', step3: 'bad' });
          appendStreamEvent({
            at: nowIso(),
            pixel: p.id,
            event: 'PageView',
            value: null,
            ok: false,
            err: 'Self-test rejected — check install',
          });
        } else {
          setSelftestState((prev) => ({ ...prev, step2: 'ok' }));
          const t3 = setTimeout(() => {
            setSelftestState({ step1: 'ok', step2: 'ok', step3: 'ok' });
            setPixels((prev) =>
              prev.map((x) =>
                x.id === p.id
                  ? {
                      ...x,
                      events24: x.events24 + 1,
                      events30: x.events30 + 1,
                      lastEvent: nowIso(),
                    }
                  : x,
              ),
            );
            appendStreamEvent({
              at: nowIso(),
              pixel: p.id,
              event: 'PageView',
              value: null,
              ok: true,
            });
          }, 500);
          selftestTimers.current.push(t3);
        }
      }, 400);
      selftestTimers.current.push(t2);
    }, 300);
    selftestTimers.current.push(t1);
  };

  const selftestPixel = selftestId
    ? pixels.find((p) => p.id === selftestId) ?? null
    : null;

  /* ── live events stream ── */
  const appendStreamEvent = (ev: RecentEvent) => {
    setEvents((prev) => [{ ...ev, flash: true }, ...prev].slice(0, 20));
    /* clear flash flag after 1s */
    setTimeout(() => {
      setEvents((prev) => prev.map((e, i) => (i === 0 ? { ...e, flash: false } : e)));
    }, 1000);
  };

  const pushSyntheticEvent = () => {
    const live = pixels.filter((p) => p.status === 'Live');
    if (!live.length) return;
    const p = live[Math.floor(Math.random() * live.length)];
    const ev = p.events[Math.floor(Math.random() * p.events.length)];
    const value = ev.valueField
      ? Math.round((10 + Math.random() * 90) * 100) / 100
      : null;
    const isPurchase = /purchase|completepayment|add_to_cart|addtocart/i.test(ev.name);
    appendStreamEvent({ at: nowIso(), pixel: p.id, event: ev.name, value, ok: true });
    setPixels((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              events24: x.events24 + 1,
              events30: x.events30 + 1,
              lastEvent: nowIso(),
            }
          : x,
      ),
    );
    if (isPurchase)
      onToast(
        `${p.name} fired ${ev.name}${value != null ? ' · $' + value.toFixed(2) : ''}`,
      );
  };

  /* auto-stream effect */
  useEffect(() => {
    if (autoStream) {
      streamTimer.current = setInterval(() => {
        pushSyntheticEvent();
      }, 3000);
    }
    return () => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      streamTimer.current = null;
    };
  }, [autoStream, pixels]);

  /* clear selftest timers on unmount */
  useEffect(() => {
    return () => {
      selftestTimers.current.forEach((t) => clearTimeout(t));
      if (streamTimer.current) clearInterval(streamTimer.current);
    };
  }, []);

  /* ── row ⋯ menu items ── */
  const rowMenuItems = (p: Pixel): RowMenuItem[] => [
    { header: 'This pixel', label: 'Edit pixel', icon: 'edit', onClick: () => openEdit(p.id) },
    { label: 'View details', icon: 'visibility', onClick: () => openPeek(p.id) },
    { label: 'Run self-test', icon: 'science', onClick: () => openSelftest(p.id) },
    { label: 'Copy install snippet', icon: 'code', onClick: () => copySnippet(p) },
    { header: 'Status', label: 'Pause', icon: 'pause_circle', onClick: () => pauseOne(p) },
    { label: 'Resume', icon: 'play_circle', onClick: () => resumeOne(p) },
    {
      label: 'Delete',
      icon: 'delete',
      onClick: () => deleteOne(p),
      danger: true,
      sepBefore: true,
    },
  ];

  /* ── editor snippet preview ── */
  const snippetPreview = buildSnippet(form.network, form.pixelId || 'XXXX');

  /* ── editor subtitle ── */
  const editingPixel = editId ? pixels.find((p) => p.id === editId) ?? null : null;

  return (
    <div className={s.screen} style={{ padding: '0 24px 48px' }}>
      {/* ─── BREADCRUMB ─── */}
      <Breadcrumb items={[{ label: 'Advertising' }, { label: 'Pixels', current: true }]} />

      {/* ─── PAGE HEADER ─── */}
      <PageHeader
        title="Pixels"
        subtitle="Ad-network conversion pixels installed on your storefront, and the events they fire into Meta / TikTok / Google Ads / Pinterest."
      >
        <Btn icon="bar_chart" onClick={() => openDest('event-volume')}>
          Event volume in Reports
        </Btn>
        <Btn icon="download" onClick={exportEvents}>
          Export events
        </Btn>
        <SplitButton
          icon="add"
          label="New pixel"
          onClick={openNew}
          menu={[
            { label: 'Pixel', icon: 'sensors', onClick: openNew },
            {
              label: 'Pick from network',
              icon: 'download',
              onClick: () => openDest('pick-from-network'),
            },
          ]}
        />
      </PageHeader>

      {/* ─── INFO BANNER ─── */}
      <div
        className={s.card}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: 12,
          marginBottom: 16,
          background: 'var(--surface-container-low)',
          borderColor: 'var(--outline-variant)',
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: 'var(--primary)',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          info
        </span>
        <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', flex: 1 }}>
          <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
            Ad-network conversion pixels only.
          </span>{' '}
          This page manages the pixels that fire purchase and cart events back to{' '}
          <span style={{ fontWeight: 600 }}>
            Meta, TikTok, Google Ads, and Pinterest
          </span>{' '}
          for attribution and retargeting.
          <span style={{ display: 'block', marginTop: 4 }}>
            Installing{' '}
            <span style={{ fontWeight: 600 }}>
              GA4, PostHog, Microsoft Clarity, Hotjar, Segment, or GTM containers
            </span>{' '}
            is a <span style={{ fontWeight: 600 }}>product analytics</span> concern —
            those installs live in{' '}
            <button
              type="button"
              onClick={() => openDest('integrations')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--qb-blue)',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontFamily: 'inherit',
                padding: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                open_in_new
              </span>
              Settings → Integrations
            </button>
            .
          </span>
        </div>
      </div>

      {/* ─── KPI STRIP ─── */}
      <KpiStrip>
        <KpiCard
          label="Pixels installed"
          value={pixels.length}
          sub={`${liveCount} live · ${errorCount} error`}
        />
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Events (24h)</div>
          <div className={s.kpiValue} style={{ color: 'var(--secondary)' }}>
            {fmtNum(ev24)}
          </div>
          <div className={s.kpiSub}>Received by webhook</div>
        </div>
        <KpiCard
          label="Events (30d)"
          value={fmtNum(ev30)}
          sub={`Across ${activePixels} active pixels`}
        />
        <KpiCard
          label="Last self-test"
          value={lastEventIso ? fmtDate(lastEventIso) : 'Never'}
          sub={lastEventIso ? 'Most recent event' : 'Run self-test'}
        />
      </KpiStrip>

      {/* ─── PIXELS LIST CARD ─── */}
      <div className={s.card} style={{ marginBottom: 16 }}>
        {/* Status tabs */}
        <StatusTabs
          tabs={STATUS_TABS}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setPage(1);
          }}
          counts={counts}
        />

        {/* Filter bar */}
        <FilterBar>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Filter pixels…"
          />
          <FilterDropdown
            label="Network"
            icon="hub"
            options={NETWORKS.map(netLabel)}
            selected={new Set(Array.from(networkFilter).map((n) => netLabel(n as Network)))}
            onChange={(next) => {
              /* map labels back to Network keys */
              const inv: Record<string, Network> = {};
              for (const n of NETWORKS) inv[netLabel(n)] = n;
              const nextNets = new Set<string>();
              for (const lbl of Array.from(next)) {
                const k = inv[lbl];
                if (k) nextNets.add(k);
              }
              setNetworkFilter(nextNets);
            }}
            onClear={() => setNetworkFilter(new Set(NETWORKS))}
            onApply={() => setPage(1)}
          />
          {/* Saved views dropdown */}
          <div className={s.relative}>
            <button
              type="button"
              className={s.filterBtn}
              onClick={() => setSavedViewsOpen((v) => !v)}
            >
              <span className="material-symbols-outlined">bookmark</span>
              Saved views
            </button>
            {savedViewsOpen && (
              <div className={s.popover} style={{ minWidth: 240 }}>
                <div className={s.menuHeader}>Saved views</div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {savedViews.length === 0 ? (
                    <div
                      style={{
                        padding: '6px 12px',
                        fontSize: 11,
                        color: 'var(--on-surface-variant)',
                      }}
                    >
                      No saved views yet.
                    </div>
                  ) : (
                    savedViews.map((v) => (
                      <div
                        key={v.id}
                        className={`${s.flex} ${s.itemsCenter}`}
                        style={{
                          width: '100%',
                          padding: '6px 12px',
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          className={`${s.popoverItem} ${s.flex1}`}
                          style={{ flex: 1 }}
                          onClick={() => applyView(v)}
                        >
                          <span className="material-symbols-outlined">
                            bookmark
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {v.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteView(v.id);
                          }}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                          title="Delete view"
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 14, color: 'var(--outline)' }}
                          >
                            close
                          </span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className={s.popoverSep} />
                <button
                  type="button"
                  className={s.popoverItem}
                  style={{ color: 'var(--primary)', fontWeight: 600 }}
                  onClick={() => {
                    setSavedViewsOpen(false);
                    setSaveViewName('');
                    setSaveViewOpen(true);
                  }}
                >
                  <span className="material-symbols-outlined">bookmark_add</span>
                  Save current view…
                </button>
              </div>
            )}
          </div>
          {filtersActive && (
            <Btn icon="filter_alt_off" onClick={clearAllFilters}>
              Clear all
            </Btn>
          )}
          <span className={s.flex1} />
          <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
            {filtered.length} of {pixels.length}
          </span>
        </FilterBar>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            actions={[
              { label: 'Pause', icon: 'pause_circle', onClick: bulkPause },
              { label: 'Resume', icon: 'play_circle', onClick: bulkResume },
              { label: 'Run self-test', icon: 'science', onClick: bulkSelftest },
              { label: 'Delete', icon: 'delete', onClick: bulkDelete, danger: true },
            ]}
          />
        )}

        {/* Table */}
        <TableWrap>
          {paged.length === 0 ? (
            <EmptyState
              icon="sensors"
              title="No pixels match"
              body="Clear filters or install a new pixel."
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
                  <th>Pixel</th>
                  <th>Network</th>
                  <th>Pixel ID</th>
                  <th>Install</th>
                  <th className={s.right}>Events (24h)</th>
                  <th className={s.right}>Events (30d)</th>
                  <th>Last event</th>
                  <th>Status</th>
                  <th />
                </tr>
              }
            >
              {paged.map((p) => (
                <tr key={p.id} onClick={() => openPeek(p.id)}>
                  <td
                    className={s.checkCell}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleOne(p.id)}
                    />
                  </td>
                  <td>
                    <div
                      className={s.flex}
                      style={{ alignItems: 'center', gap: 8, minWidth: 0 }}
                    >
                      <span style={pxIconStyle(p.network)}>
                        {p.network.slice(0, 2).toUpperCase()}
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
                          {p.name}
                        </div>
                        <div className={s.rowSub}>{p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${s.netChip} ${netChipClass(p.network)}`}
                      style={{
                        background:
                          p.network === 'Meta'
                            ? '#edf3fc'
                            : p.network === 'TikTok'
                              ? '#eef1f2'
                              : p.network === 'GoogleAds'
                                ? '#f8f0ee'
                                : '#f9eeee',
                        color:
                          p.network === 'Meta'
                            ? '#4b77b8'
                            : p.network === 'TikTok'
                              ? '#27353a'
                              : p.network === 'GoogleAds'
                                ? '#c45c5b'
                                : '#bd5558',
                      }}
                    >
                      {netLabel(p.network)}
                    </span>
                  </td>
                  <td>
                    <span className={s.mono}>{p.pixelId}</span>
                  </td>
                  <td style={{ fontSize: 11, color: installClass(p.install) }}>
                    {p.install}
                  </td>
                  <td className={`${s.right} ${s.tabularNums}`}>
                    {p.events24 ? fmtNum(p.events24) : '—'}
                  </td>
                  <td className={`${s.right} ${s.tabularNums}`}>
                    {p.events30 ? fmtNum(p.events30) : '—'}
                  </td>
                  <td style={{ fontSize: 11 }}>{fmtDate(p.lastEvent)}</td>
                  <td>
                    <Stat kind={STATUS_KIND[p.status]} label={p.status} />
                  </td>
                  <td
                    className={s.right}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowMenu items={rowMenuItems(p)} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </TableWrap>

        {/* Empty state CTA */}
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

      {/* ─── RECENT EVENTS CARD ─── */}
      <div className={s.card}>
        <div
          className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--surface-dim)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Recent events
            </h2>
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              Live stream from the webhook. New events appear automatically while the
              page is open.
            </div>
          </div>
          <div className={s.flex} style={{ alignItems: 'center', gap: 8 }}>
            <label
              className={s.flex}
              style={{
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--on-surface-variant)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={autoStream}
                onChange={(e) => setAutoStream(e.target.checked)}
                style={{ accentColor: 'var(--qb-blue)' }}
              />
              Auto-refresh (3s)
            </label>
            <Btn
              sm
              icon="refresh"
              onClick={() => {
                setEvents((prev) => [...prev]);
                onToast('Events refreshed');
              }}
            >
              Refresh
            </Btn>
            <Btn sm icon="download" onClick={exportPixels}>
              Export pixels
            </Btn>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {events.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--on-surface-variant)',
                fontSize: 12,
              }}
            >
              No events received yet.
            </div>
          ) : (
            events.map((ev, idx) => {
              const p = pixels.find((x) => x.id === ev.pixel);
              const pixelName = p ? p.name : ev.pixel;
              return (
                <div
                  key={idx}
                  className={s.flex}
                  style={{
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom:
                      idx < events.length - 1
                        ? '1px solid #f0f2f3'
                        : 'none',
                    background: ev.flash ? '#8af5be' : 'transparent',
                    transition: 'background 1s',
                  }}
                >
                  <span
                    className={s.mono}
                    style={{
                      fontSize: 11,
                      color: 'var(--on-surface-variant)',
                      width: 130,
                      flexShrink: 0,
                    }}
                  >
                    {fmtDate(ev.at)}
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                      background: ev.ok ? '#f0f6f5' : '#fff0ef',
                      color: ev.ok ? '#0a6400' : '#bf5c59',
                    }}
                  >
                    {ev.ok ? 'ok' : 'error'}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.event}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--on-surface-variant)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                  >
                    {pixelName}
                  </span>
                  <span
                    className={s.tabularNums}
                    style={{ fontSize: 11 }}
                  >
                    {ev.value != null ? '$' + ev.value.toFixed(2) : ''}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--error)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}
                  >
                    {ev.err ?? ''}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── PEEK DRAWER ─── */}
      <Peek
        open={!!peekPixel}
        title={peekPixel?.name ?? 'Pixel'}
        onClose={closePeek}
        subtitle={
          peekPixel ? (
            <span className={s.flex} style={{ alignItems: 'center', gap: 6 }}>
              <Stat kind={STATUS_KIND[peekPixel.status]} label={peekPixel.status} />
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--on-surface-variant)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  sensors
                </span>
                Pixel
              </span>
            </span>
          ) : null
        }
      >
        {peekPixel && (
          <div>
            {/* status + network */}
            <div
              className={s.flex}
              style={{
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <Stat
                kind={STATUS_KIND[peekPixel.status]}
                label={peekPixel.status}
              />
              <span
                className={`${s.netChip} ${netChipClass(peekPixel.network)}`}
                style={{
                  background:
                    peekPixel.network === 'Meta'
                      ? '#edf3fc'
                      : peekPixel.network === 'TikTok'
                        ? '#eef1f2'
                        : peekPixel.network === 'GoogleAds'
                          ? '#f8f0ee'
                          : '#f9eeee',
                  color:
                    peekPixel.network === 'Meta'
                      ? '#4b77b8'
                      : peekPixel.network === 'TikTok'
                        ? '#27353a'
                        : peekPixel.network === 'GoogleAds'
                          ? '#c45c5b'
                          : '#bd5558',
                }}
              >
                {netLabel(peekPixel.network)}
              </span>
            </div>

            {/* 2× stats grid */}
            <div
              style={{
                background: 'var(--surface-container-low)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
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
                  Events (24h)
                </div>
                <div
                  className={`${s.tabularNums}`}
                  style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}
                >
                  {fmtNum(peekPixel.events24)}
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
                  Events (30d)
                </div>
                <div
                  className={`${s.tabularNums}`}
                  style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}
                >
                  {fmtNum(peekPixel.events30)}
                </div>
              </div>
            </div>

            {/* KV list */}
            <KvList
              items={[
                { k: 'Pixel ID', v: <span className={s.mono}>{peekPixel.pixelId}</span> },
                { k: 'Install method', v: peekPixel.install },
                { k: 'Last event', v: fmtDate(peekPixel.lastEvent) },
              ]}
            />

            {/* Events fired */}
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
                Events fired
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {peekPixel.events.map((ev, i) => (
                  <div
                    key={i}
                    className={s.flex}
                    style={{
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f2f3',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: '#f0f6f5',
                        color: '#0a6400',
                        flexShrink: 0,
                      }}
                    >
                      {ev.kind}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        flex: 1,
                      }}
                    >
                      {ev.name}
                    </span>
                    {ev.valueField && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--on-surface-variant)',
                        }}
                      >
                        value: <span className={s.mono}>{ev.valueField}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
              <Btn
                variant="primary"
                icon="edit"
                onClick={() => {
                  const id = peekPixel.id;
                  closePeek();
                  openEdit(id);
                }}
              >
                Edit
              </Btn>
              <Btn
                icon="science"
                onClick={() => openSelftest(peekPixel.id)}
              >
                Self-test
              </Btn>
              <Btn
                icon="code"
                onClick={() => copySnippet(peekPixel)}
              >
                Snippet
              </Btn>
              <Btn icon="bar_chart" onClick={() => openDest('reports')}>
                Reports
              </Btn>
            </div>
          </div>
        )}
      </Peek>

      {/* ─── EDITOR DRAWER ─── */}
      <Drawer
        open={editorOpen}
        title={editId ? 'Edit pixel' : 'New pixel'}
        subtitle={
          editingPixel
            ? `${editingPixel.status} · ${editingPixel.id}`
            : 'Draft · not yet installed'
        }
        onClose={closeEditor}
        width={660}
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
              <Btn variant="outline" onClick={saveAndNew}>
                Save and new
              </Btn>
              <Btn variant="primary" onClick={saveAndClose}>
                Save and close
              </Btn>
            </div>
          </div>
        }
      >
        {/* ── Network ── */}
        <section className={s.mb4}>
          <div className={s.sectionH}>Network</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {NETWORKS.map((n) => {
              const tile = NETWORK_TILE[n];
              const isSelected = form.network === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, network: n }))}
                  style={{
                    border: isSelected
                      ? '1px solid var(--primary)'
                      : '1px solid var(--surface-dim)',
                    borderRadius: 8,
                    padding: 10,
                    background: isSelected ? '#f4fbfa' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      background: tile.gradient,
                    }}
                  >
                    {tile.initials}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tile.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--on-surface-variant)',
                      }}
                    >
                      {tile.sub}
                    </div>
                  </div>
                </button>
              );
            })}
            {/* Disabled analytics tile */}
            <button
              type="button"
              title="GA4, PostHog, Clarity, Segment, GTM containers belong in Settings → Integrations."
              onClick={() => openDest('integrations')}
              style={{
                border: '1px solid var(--surface-dim)',
                borderRadius: 8,
                padding: 10,
                background: 'var(--surface-container-low)',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
                fontFamily: 'inherit',
                opacity: 0.55,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--on-surface-variant)',
                  background: '#f4f3f7',
                }}
              >
                +
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  Analytics pixels
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--on-surface-variant)',
                  }}
                >
                  GA4 / PostHog / Clarity → Settings
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* ── Pixel basics ── */}
        <section className={s.mb4}>
          <div className={s.sectionH}>Pixel basics</div>
          <div className={s.flexCol} style={{ gap: 12 }}>
            <Field label="Pixel name">
              <Input
                type="text"
                placeholder="e.g. Meta Pixel — Storefront"
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </Field>
            <div className={s.fieldRow}>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as PixelStatus,
                    }))
                  }
                >
                  {PIXEL_STATUSES.map((st) => (
                    <option key={st}>{st}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Install method">
                <Select
                  value={form.install}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      install: e.target.value as InstallMethod,
                    }))
                  }
                >
                  {INSTALL_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Pixel ID">
              <Input
                type="text"
                className={s.mono}
                placeholder="e.g. 1029XXXXXXXX4471"
                value={form.pixelId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pixelId: e.target.value }))
                }
              />
            </Field>
          </div>
        </section>

        {/* ── Events fired ── */}
        <section className={s.mb4}>
          <div
            className={`${s.sectionH} ${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
          >
            <span>Events fired</span>
            <Btn
              sm
              icon="add"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  events: [
                    ...p.events,
                    { name: 'NewEvent', kind: 'standard' as const },
                  ],
                }))
              }
            >
              Add event
            </Btn>
          </div>
          <div className={s.flexCol} style={{ gap: 4 }}>
            {form.events.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                No events configured.
              </div>
            ) : (
              form.events.map((ev, i) => (
                <div
                  key={i}
                  className={s.flex}
                  style={{ alignItems: 'center', gap: 8, padding: '4px 0' }}
                >
                  <input
                    type="text"
                    value={ev.name}
                    placeholder="Event name"
                    onChange={(e) =>
                      setForm((p) => {
                        const next = [...p.events];
                        next[i] = { ...next[i], name: e.target.value };
                        return { ...p, events: next };
                      })
                    }
                    style={{
                      flex: 1,
                      height: 32,
                      padding: '0 8px',
                      border: '1px solid var(--surface-dim)',
                      borderRadius: 6,
                      fontSize: 12,
                      background: '#fff',
                      fontFamily: 'inherit',
                    }}
                  />
                  <input
                    type="text"
                    value={ev.valueField ?? ''}
                    placeholder="value field (optional)"
                    onChange={(e) =>
                      setForm((p) => {
                        const next = [...p.events];
                        next[i] = { ...next[i], valueField: e.target.value };
                        return { ...p, events: next };
                      })
                    }
                    style={{
                      flex: 1,
                      height: 32,
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
                        events: p.events.filter((_, idx) => idx !== i),
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
                    title="Remove event"
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
            Purchase events are posted to Finance as a conversion and attached to the
            matching journal entry for the period.
          </div>
        </section>

        {/* ── Install snippet ── */}
        <section>
          <div className={s.sectionH}>Install snippet</div>
          <div className={s.flexCol} style={{ gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              Paste into the &lt;head&gt; of every page where the pixel should fire.
            </div>
            <Textarea
              readOnly
              rows={8}
              value={snippetPreview}
              style={{
                fontFamily:
                  "ui-monospace, 'SFMono-Regular', Menlo, monospace",
                fontSize: 12,
                minHeight: 140,
              }}
            />
            <div className={s.flex} style={{ alignItems: 'center', gap: 8 }}>
              <Btn
                sm
                icon="content_copy"
                onClick={() => {
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard
                      .writeText(snippetPreview)
                      .then(() => onToast('Snippet copied'))
                      .catch(() => onToast('Copy failed — select and copy manually'));
                  } else {
                    onToast('Clipboard unavailable');
                  }
                }}
              >
                Copy snippet
              </Btn>
              <Btn
                sm
                icon="science"
                onClick={() => {
                  if (editId) openSelftest(editId);
                  else onToast('Save the pixel first, then run a self-test');
                }}
              >
                Send test event
              </Btn>
            </div>
          </div>
        </section>
      </Drawer>

      {/* ─── SELF-TEST MODAL ─── */}
      <Modal
        open={!!selftestPixel}
        title="Self-test"
        onClose={closeSelftest}
        size="md"
        footer={
          <>
            <Btn variant="outline" onClick={closeSelftest}>
              Close
            </Btn>
            <Btn
              variant="primary"
              onClick={() => selftestPixel && runSelftest(selftestPixel.id)}
            >
              Run again
            </Btn>
          </>
        }
      >
        {selftestPixel && (
          <>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
              Sending a synthetic <span className={s.mono}>PageView</span> to{' '}
              <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>
                {selftestPixel.name}
              </span>
              …
            </p>
            <SelftestStep
              title="Step 1 — reachability"
              desc={`Contacting ${netLabel(selftestPixel.network)} endpoint for ${selftestPixel.pixelId}`}
              state={selftestState.step1}
            />
            <SelftestStep
              title="Step 2 — synthetic event"
              desc={<>Sending <span className={s.mono}>PageView</span></>}
              state={selftestState.step2}
            />
            <SelftestStep
              title="Step 3 — delivery"
              desc="Confirming the event was accepted by the network"
              state={selftestState.step3}
            />
          </>
        )}
      </Modal>

      {/* ─── DESTINATION MODAL ─── */}
      <Modal
        open={!!dest}
        title={dest?.title ?? 'Open destination'}
        onClose={() => setDestKey(null)}
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setDestKey(null)}>
              Close
            </Btn>
            <Btn variant="primary" onClick={confirmDest}>
              Open
            </Btn>
          </>
        }
      >
        {dest && (
          <>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
              {dest.body}
            </p>
            <div
              className={s.mono}
              style={{
                padding: 12,
                border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container-low)',
                fontSize: 11,
                borderRadius: 6,
                marginBottom: 0,
                wordBreak: 'break-all',
              }}
            >
              {dest.route}
            </div>
          </>
        )}
      </Modal>

      {/* ─── SAVE VIEW MODAL ─── */}
      <Modal
        open={saveViewOpen}
        title="Save current view"
        onClose={() => setSaveViewOpen(false)}
        size="sm"
        footer={
          <>
            <Btn variant="outline" onClick={() => setSaveViewOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={saveCurrentView}>
              Save view
            </Btn>
          </>
        }
      >
        <>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 12 }}>
            Name this combination of filters so you can reuse it.
          </p>
          <Input
            type="text"
            placeholder="e.g. Error pixels only"
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
            autoFocus
          />
        </>
      </Modal>
    </div>
  );
}

/* ───────────── Self-test step sub-component ───────────── */
function SelftestStep({
  title,
  desc,
  state,
}: {
  title: string;
  desc: React.ReactNode;
  state: SelfTestStep;
}) {
  const label =
    state === 'ok'
      ? title.includes('Step 1')
        ? '✓ reachable'
        : title.includes('Step 2')
          ? '✓ fired'
          : '✓ acknowledged'
      : state === 'bad'
        ? title.includes('Step 1')
          ? '✗ rejected'
          : title.includes('Step 2')
            ? '✗ rejected'
            : '✗ not delivered'
        : title.includes('Step 1')
          ? 'running…'
          : 'waiting…';
  const badgeBg =
    state === 'ok'
      ? '#e9f5ef'
      : state === 'bad'
        ? '#fff0ef'
        : '#fbf7ec';
  const badgeColor =
    state === 'ok'
      ? '#388064'
      : state === 'bad'
        ? '#bf5c59'
        : '#98713e';
  return (
    <div
      style={{
        padding: 12,
        border: '1px solid var(--outline-variant)',
        background: 'var(--surface-container-low)',
        borderRadius: 6,
        fontSize: 13,
        marginBottom: 8,
      }}
    >
      <div
        className={`${s.flex} ${s.justifyBetween} ${s.itemsCenter}`}
        style={{ marginBottom: 4 }}
      >
        <span style={{ color: 'var(--on-surface-variant)' }}>{title}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 700,
            background: badgeBg,
            color: badgeColor,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
        {desc}
      </div>
    </div>
  );
}
