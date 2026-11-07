'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DOMAINS,
  DRAWER_FIELDS,
  DemoRow,
  DomainKey,
  PINNED,
  findScreen,
  screensOf,
} from '@/data/shellData';
import Header, { WorkspaceTab } from './Header';
import MainRail from './MainRail';
import SideRail from './SideRail';
import ScreenContent from './ScreenContent';
import Toast from './Toast';
import {
  DashboardOverlays,
  useDashboardController,
} from './dashboard/DashboardScreens';
import { useDesignCanvas } from '@/lib/designCanvasStore';

// Type-only imports for types that live alongside the lazy components.
import type { DocTabType } from './DocumentEngine';
import type { PinMode as PinModeType, BookmarkEntry as BookmarkEntryType } from './FavoritesFlyout';

// Lazy-load heavy overlay/flyout components so they don't all compile on
// initial page load (OOM protection on memory-constrained dev boxes).
const PeekDrawer = dynamic(() => import('./PeekDrawer'), { ssr: false }) as ComponentType<{ open: boolean; onClose: () => void; recordId: string | null }>;
const RecordDrawer = dynamic(() => import('./RecordDrawer'), { ssr: false }) as ComponentType<{ open: boolean; onClose: () => void; recordId: string | null; onToast: (m: string) => void }>;
const StudioDrawer = dynamic(() => import('./StudioDrawer'), { ssr: false }) as ComponentType<{ open: boolean; onClose: () => void; onToast: (m: string) => void }>;
const DocumentEngine = dynamic(() => import('./DocumentEngine'), { ssr: false }) as ComponentType<Record<string, unknown>>;
const CreateFlyout = dynamic(() => import('./CreateFlyout'), { ssr: false }) as ComponentType<{ open: boolean; onClose: () => void; onNavigate: (d: DomainKey, s: string) => void }>;
const NavigationHubFlyout = dynamic(() => import('./NavigationHubFlyout'), { ssr: false }) as ComponentType<Record<string, unknown>>;
const QuickActionsDrawer = dynamic(() => import('./QuickActionsDrawer').then(m => ({ default: m.QuickActionsDrawer })), { ssr: false }) as ComponentType<Record<string, unknown>>;
const FavoritesFlyout = dynamic(() => import('./FavoritesFlyout').then(m => ({ default: m.FavoritesFlyout })), { ssr: false }) as ComponentType<Record<string, unknown>>;

// Constants loaded once at runtime via a static import below the lazy setup.
// (These are small pure-data exports, safe to import statically.)
import { DEFAULT_FAVORITE_IDS, FAVORITES_STORAGE_KEY } from './QuickActionsDrawer';
import type { PinMode, BookmarkEntry } from './FavoritesFlyout';

function buildWorkspaceTab(domain: DomainKey, screenId: string): WorkspaceTab {
  const scr = findScreen(domain, screenId);
  const label = scr.label === 'Overview' ? `${scr.group} · Overview` : scr.label;
  return {
    key: `${domain}:${scr.id}`,
    domain,
    screenId: scr.id,
    label,
  };
}

function createInitialOpenGroups(): Record<DomainKey, string[]> {
  const initial = {} as Record<DomainKey, string[]>;
  for (const key of PINNED) {
    initial[key] = [DOMAINS[key].groups[0].name];
  }
  initial.dashboard = ['Overview', 'Analytics', 'Queues'];
  initial.finance = [
    'Accounting',
    'Sales',
    'Expenses & Bills',
    'Business Tax',
    'Cap Table',
  ];
  initial.design = [
    'Studio',
    'Catalog',
    'My products',
    'My orders',
    'Create wizard',
  ];
  return initial;
}

// ── Dual pin (bookmark | favorite) persistence ──
const PIN_MODE_STORAGE_KEY = 'unsaid.rail.pinmode.v1';
const BOOKMARKS_STORAGE_KEY = 'unsaid.rail.bookmarks.v1';

const DEFAULT_BOOKMARKS: BookmarkEntry[] = [
  { domain: 'dashboard', screen: 'ops' },
  { domain: 'orders', screen: 'orders' },
  { domain: 'reports', screen: 'reports-overview' },
  { domain: 'finance', screen: 'coa' },
];

function loadPinMode(): PinMode {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(PIN_MODE_STORAGE_KEY);
      if (saved === 'bookmarks' || saved === 'favorites') return saved;
    } catch {
      // ignore
    }
  }
  return 'bookmarks';
}

function loadBookmarks(): BookmarkEntry[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (b): b is BookmarkEntry =>
              b &&
              typeof b.domain === 'string' &&
              typeof b.screen === 'string' &&
              !!DOMAINS[b.domain as DomainKey]
          );
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_BOOKMARKS;
}

export default function GlobalShell() {
  const dashboardController = useDashboardController();
  const {
    closeSetupWizard,
    setCustomizeCreateOpen,
    setContractorModalOpen,
    setQuickTaskModalOpen,
  } = dashboardController;
  const [activeDomain, setActiveDomain] = useState<DomainKey>('dashboard');
  const [activeScreen, setActiveScreen] = useState<string>('ops');
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => [
    buildWorkspaceTab('dashboard', 'ops'),
  ]);
  const [openGroupsByDomain, setOpenGroupsByDomain] = useState<
    Record<DomainKey, string[]>
  >(createInitialOpenGroups);
  const [sideFilter, setSideFilter] = useState<string>('');
  const [sideRailCollapsed, setSideRailCollapsed] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'business' | 'accountant'>('business');

  // Full-screen focus mode — frees the page from sidebar + tab bar.
  const [focusMode, setFocusMode] = useState<boolean>(false);

  // Overlays & Drawers
  const [peekOpen, setPeekOpen] = useState<boolean>(false);
  const [peekRow, setPeekRow] = useState<DemoRow | null>(null);

  const [recordDrawerOpen, setRecordDrawerOpen] = useState<boolean>(false);
  const [recordKind, setRecordKind] = useState<string>('Invoice');
  const [recordSessionKey, setRecordSessionKey] = useState<number>(0);
  // Design studio tool drawers (Upload / AI / Add text / …) — sidebar items
  // of type 'drawer' open these instead of workspace tabs.
  const [studioDrawerOpen, setStudioDrawerOpen] = useState<boolean>(false);
  const [studioDrawerKind, setStudioDrawerKind] = useState<string>('Upload');

  const [docEngineOpen, setDocEngineOpen] = useState<boolean>(false);
  const [docTab, setDocTab] = useState<DocTabType>('edit');

  const [createFlyoutOpen, setCreateFlyoutOpen] = useState<boolean>(false);
  const [navigationHubOpen, setNavigationHubOpen] = useState<boolean>(false);
  const [quickActionsDrawerOpen, setQuickActionsDrawerOpen] = useState<boolean>(false);
  const [favoritesFlyoutOpen, setFavoritesFlyoutOpen] = useState<boolean>(false);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_FAVORITE_IDS;
  });

  // Dual pin — which side the user chose (bookmark | favorite) + saved bookmarks.
  const [pinMode, setPinMode] = useState<PinMode>(loadPinMode);
  const [railBookmarks, setRailBookmarks] = useState<BookmarkEntry[]>(loadBookmarks);

  // Toast
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (createFlyoutOpen || docEngineOpen || quickActionsDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else if (!recordDrawerOpen && !studioDrawerOpen && !peekOpen) {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [createFlyoutOpen, navigationHubOpen, docEngineOpen, quickActionsDrawerOpen, recordDrawerOpen, studioDrawerOpen, peekOpen]);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      void e;
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // When a top-bar category is clicked (sets supplierCategory in the store),
  // open the StudioDrawer with the Supplier inspector kind.
  useEffect(() => {
    const unsub = useDesignCanvas.subscribe((state) => {
      if (state.supplierCategory && !studioDrawerOpen) {
        setStudioDrawerKind('Supplier');
        setStudioDrawerOpen(true);
      }
    });
    return () => unsub();
  }, [studioDrawerOpen]);

  // When the Design Queue button is clicked on the canvas top bar,
  // open the StudioDrawer with the Queue kind.
  useEffect(() => {
    const handler = () => {
      setStudioDrawerKind('Queue');
      setStudioDrawerOpen(true);
    };
    window.addEventListener('open-studio-queue', handler);
    return () => window.removeEventListener('open-studio-queue', handler);
  }, []);

  // When a queued product is clicked in the queue drawer, switch the
  // drawer kind to 'Supplier' (variant drawer).
  useEffect(() => {
    const handler = (e: Event) => {
      const kind = (e as CustomEvent).detail as string;
      setStudioDrawerKind(kind);
    };
    window.addEventListener('switch-studio-kind', handler);
    return () => window.removeEventListener('switch-studio-kind', handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const anyOverlayOpen =
          createFlyoutOpen ||
          navigationHubOpen ||
          quickActionsDrawerOpen ||
          favoritesFlyoutOpen ||
          docEngineOpen ||
          recordDrawerOpen ||
          studioDrawerOpen ||
          peekOpen;
        setCreateFlyoutOpen(false);
        setNavigationHubOpen(false);
        setQuickActionsDrawerOpen(false);
        setFavoritesFlyoutOpen(false);
        setDocEngineOpen(false);
        setRecordDrawerOpen(false);
        setStudioDrawerOpen(false);
        setPeekOpen(false);
        closeSetupWizard();
        setCustomizeCreateOpen(false);
        setContractorModalOpen(false);
        setQuickTaskModalOpen(false);
        // Esc exits focus mode only when no overlay was open on top of it.
        if (!anyOverlayOpen) {
          setFocusMode(false);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCreateFlyoutOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    closeSetupWizard,
    setContractorModalOpen,
    setCustomizeCreateOpen,
    setQuickTaskModalOpen,
    createFlyoutOpen,
    navigationHubOpen,
    quickActionsDrawerOpen,
    favoritesFlyoutOpen,
    docEngineOpen,
    recordDrawerOpen,
    studioDrawerOpen,
    peekOpen,
  ]);

  const openOrActivateTab = useCallback((domain: DomainKey, screenId: string) => {
    const nextTab = buildWorkspaceTab(domain, screenId);
    const targetScreen = findScreen(domain, nextTab.screenId);
    setActiveDomain(domain);
    setActiveScreen(nextTab.screenId);
    setOpenGroupsByDomain((prev) => {
      const current = prev[domain] || [];
      if (current.includes(targetScreen.group)) return prev;
      return {
        ...prev,
        [domain]: [...current, targetScreen.group],
      };
    });
    setOpenTabs((prev) => {
      if (prev.some((t) => t.key === nextTab.key)) return prev;
      return [...prev, nextTab];
    });
  }, []);

  // Boot from URL — standalone page view: /?view=<domain>:<screen>&focus=1
  // One-time hydration-time init from window.location (server HTML always
  // boots the default screen, then the effect swaps in the requested view).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view) {
      const sep = view.indexOf(':');
      if (sep > 0) {
        const d = view.slice(0, sep) as DomainKey;
        const s = view.slice(sep + 1);
        if (DOMAINS[d] && screensOf(DOMAINS[d]).some((scr) => scr.id === s && scr.type !== 'drawer')) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time URL boot
          openOrActivateTab(d, s);
        }
      }
    }
    if (params.get('focus') === '1') {
      setFocusMode(true);
    }
  }, [openOrActivateTab]);

  const handleSelectDomain = useCallback(
    (domain: DomainKey) => {
      const existingInDomain = [...openTabs]
        .reverse()
        .find((t) => t.domain === domain);
      if (existingInDomain) {
        openOrActivateTab(domain, existingInDomain.screenId);
      } else {
        // First tabbable screen — drawer-type items open tool panels, not tabs.
        const all = screensOf(DOMAINS[domain]);
        const firstScreen = all.find((s) => s.type !== 'drawer') ?? all[0];
        openOrActivateTab(domain, firstScreen.id);
      }
    },
    [openTabs, openOrActivateTab]
  );

  const handleSelectScreen = useCallback(
    (screenId: string) => {
      // Drawer-type sidebar items (design studio tools) open the StudioDrawer
      // overlay — the one that aligns with the global theme (RecordDrawer,
      // Bills drawer, etc.). Same drawer everywhere; no canvas-rail swap.
      const screen = screensOf(DOMAINS[activeDomain]).find((s) => s.id === screenId);
      if (screen?.type === 'drawer') {
        setStudioDrawerKind(screen.label);
        setStudioDrawerOpen(true);
        return;
      }
      openOrActivateTab(activeDomain, screenId);
    },
    [activeDomain, openOrActivateTab]
  );

  const handleSelectTab = useCallback(
    (tab: WorkspaceTab) => {
      openOrActivateTab(tab.domain, tab.screenId);
    },
    [openOrActivateTab]
  );

  const handleCloseTab = useCallback(
    (tabKey: string) => {
      const activeKey = `${activeDomain}:${activeScreen}`;
      const idx = openTabs.findIndex((t) => t.key === tabKey);
      if (idx === -1) return;

      const remaining = openTabs.filter((t) => t.key !== tabKey);
      if (remaining.length === 0) {
        const fallback =
          tabKey === 'dashboard:ops'
            ? buildWorkspaceTab('finance', 'accounting')
            : buildWorkspaceTab('dashboard', 'ops');
        setOpenTabs([fallback]);
        setActiveDomain(fallback.domain);
        setActiveScreen(fallback.screenId);
        return;
      }

      setOpenTabs(remaining);
      if (tabKey === activeKey) {
        const nextActive = remaining[Math.min(idx, remaining.length - 1)];
        setActiveDomain(nextActive.domain);
        setActiveScreen(nextActive.screenId);
      }
    },
    [activeDomain, activeScreen, openTabs]
  );

  const handleToggleGroup = useCallback(
    (groupName: string) => {
      setOpenGroupsByDomain((prev) => {
        const current = prev[activeDomain] || [];
        const exists = current.includes(groupName);
        const nextGroups = exists
          ? current.filter((g) => g !== groupName)
          : [...current, groupName];
        return {
          ...prev,
          [activeDomain]: nextGroups,
        };
      });
    },
    [activeDomain]
  );

  const openDocEngine = useCallback(() => {
    setDocTab('edit');
    setDocEngineOpen(true);
  }, []);

  const openRecordDrawer = useCallback((kind: string) => {
    setRecordKind(kind);
    setRecordSessionKey((c) => c + 1);
    setRecordDrawerOpen(true);
  }, []);

  const handleCapCreate = useCallback(
    (label: string) => {
      if (label === 'Share issuance' || label === 'Option grant') {
        openRecordDrawer(label === 'Share issuance' ? 'Invoice' : 'Product');
      } else {
        showToast(`Cap Table → Create ${label}`);
      }
    },
    [openRecordDrawer, showToast]
  );

  const handleCreate = useCallback(
    (rawLabel: string) => {
      setCreateFlyoutOpen(false);

      // ── Normalize: map all quick-action / create-registry labels to canonical keys ──
      // Both the CreateFlyout (CREATE_REGISTRY) and QuickActionsDrawer (ALL_ACTION_GROUPS)
      // use different label strings for the same action. Normalize them here so EVERY
      // action gets wired to a real behavior — no dead links.
      const normalizeMap: Record<string, string> = {
        // Customers
        'Create invoice': 'Invoice',
        'Create estimate': 'Estimate',
        'Create sales receipt': 'Sales receipt',
        'Create statement': 'Statement',
        'Create payment link': 'Payment link',
        'Create recurring payment': 'Recurring payment',
        'Recurring sales receipt': 'Recurring sales receipt',
        'Record payment': 'Receive payment',
        'Get paid online': 'Receive payment',
        'Add customer': 'Add customer',
        // Vendors
        'Record expense': 'Expense',
        'Create check': 'Check',
        'Create bill': 'Bill',
        'Pay bills': 'Pay bills',
        'Add vendor': 'Add vendor',
        'Print checks': 'Print checks',
        'Recurring bill': 'Recurring bill',
        'Upload multiple bills': 'Upload multiple bills',
        'Schedule online payment': 'Schedule online payment',
        'Create vendor credit': 'Vendor credit',
        // Team
        'Add employee': 'Add employee',
        'Add time entry': 'Time entry',
        // Other (books)
        'Get Live Bookkeeping': 'Live bookkeeping',
        'Add bank deposit': 'Bank deposit',
        'Add product or service': 'Add product/service',
        'Create journal entry': 'Journal entry',
        // Tax
        'Create tax return': 'Tax return',
        'Bookkeeper tax review': 'Tax review',
        'Download tax summary': 'Download tax summary',
        // Inventory / Catalog
        'Add inventory item': 'Product',
        'Design Studio': 'Design',
        'Open Support Ticket': 'Ticket',
        'Publish Design': 'Publish design',
        'Create Social Post': 'Post',
      };
      const label = normalizeMap[rawLabel] || rawLabel;

      // ── Navigation: action → screen ──
      const navigateMap: Record<string, [DomainKey, string]> = {
        Estimate: ['finance', 'estimates'],
        Estimates: ['finance', 'estimates'],
        'Payment link': ['finance', 'payment-links'],
        'Pay bills': ['finance', 'bill-payments'],
        Reconcile: ['finance', 'reconcile'],
        'Bank deposit': ['finance', 'accounting'],
        'Upload multiple bills': ['finance', 'bills'],
        'Schedule online payment': ['finance', 'bill-payments'],
        'Tax return': ['finance', 'tax-return'],
        'Tax review': ['finance', 'tax-overview'],
        'Download tax summary': ['finance', 'download-tax-summary'],
        'Recurring bill': ['finance', 'bills'],
        'Recurring sales receipt': ['finance', 'sales-transactions'],
        'Recurring payment': ['finance', 'invoices'],
        'Live bookkeeping': ['finance', 'accounting'],
      };
      const navTarget = navigateMap[label];
      if (navTarget) {
        openOrActivateTab(navTarget[0], navTarget[1]);
        return;
      }

      // ── Document engine: transaction forms ──
      const docEngineLabels = new Set([
        'Invoice',
        'Sales receipt',
        'Credit memo',
        'Statement',
        'Sales order',
        'Bill',
        'Check',
        'Expense',
        'Vendor credit',
        'Receive payment',
        'Journal entry',
        'Transfer',
        'Settlement',
        'Return/RMA',
        'Void',
        'Print checks',
      ]);
      if (docEngineLabels.has(label)) {
        openDocEngine();
        return;
      }

      // ── Record drawers: party / entity forms ──
      if (label === 'Add customer' || label === 'Customer') {
        openRecordDrawer('Customer');
        return;
      }
      if (label === 'Add vendor' || label === 'Vendor' || label === 'Add supplier' || label === 'Supplier') {
        openRecordDrawer('Vendor');
        return;
      }
      if (label === 'Add product/service' || label === 'Product') {
        openRecordDrawer('Product');
        return;
      }
      if (label === 'Add contractor' || label === 'Contractor') {
        setContractorModalOpen(true);
        return;
      }
      if (label === 'Task' || label === 'Add note') {
        setQuickTaskModalOpen(true);
        return;
      }
      if (label === 'Add employee') {
        openRecordDrawer('Customer'); // reuse party drawer for employee
        return;
      }
      if (label === 'Time entry') {
        setQuickTaskModalOpen(true);
        return;
      }
      if (label === 'Add account') {
        openRecordDrawer('Product'); // reuse drawer for CoA account
        return;
      }
      if (label === 'Purchase order' || label === 'Purchase orders') {
        openOrActivateTab('finance', 'purchase-orders');
        return;
      }

      // ── Catalog & marketing actions → doc engine or drawer ──
      const catalogLabels = new Set([
        'Design',
        'Collection',
        'Category',
        'Banner',
        'Popup',
        'Discount code',
        'Campaign',
        'Post',
        'Newsletter',
        'Publish design',
        'Ticket',
      ]);
      if (catalogLabels.has(label)) {
        openDocEngine();
        return;
      }

      // ── Fallback: if DRAWER_FIELDS has it, open drawer ──
      if (DRAWER_FIELDS[label]) {
        openRecordDrawer(label);
        return;
      }

      showToast(`Create → ${label}`);
    },
    [
      openDocEngine,
      openOrActivateTab,
      openRecordDrawer,
      setContractorModalOpen,
      setQuickTaskModalOpen,
      showToast,
    ]
  );

  const handleRailAction = useCallback(
    (id: string) => {
      if (id === 'allapps') {
        // All apps → Enterprise Navigation Hub (routing), NOT create.
        setNavigationHubOpen(true);
      } else if (id === 'customize' || id === 'favorites') {
        // The star (favorites/bookmarks) pin toggles the favorites flyout.
        setFavoritesFlyoutOpen((prev) => !prev);
      } else if (id === 'reports') {
        // Reports is its own standalone, cross-module view — NOT tied to
        // accounting/finance. Broken down by every module inside the reports
        // domain.
        openOrActivateTab('reports', 'reports-overview');
      } else if (id === 'inbox') {
        // Inbox → Support omnichannel inbox (real screen).
        openOrActivateTab('support', 'messages');
      } else if (id === 'tasks') {
        // Tasks & calendar → opens the Tasks & Projects page (full screen).
        openOrActivateTab('dashboard', 'tasks');
      } else if (id === 'home') {
        openOrActivateTab('dashboard', 'ops');
      } else {
        showToast(`Rail → ${id}`);
      }
    },
    [openOrActivateTab, showToast]
  );

  const handleUtilAction = useCallback(
    (id: string) => {
      if (id === 'settings') {
        openOrActivateTab('settings', 'ws-home');
        setCreateFlyoutOpen(false);
      } else {
        showToast(`Utility → ${id}`);
      }
    },
    [openOrActivateTab, showToast]
  );

  // ── Page-level view controls (below the tab bar, on every page) ──
  const handleOpenStandalone = useCallback(() => {
    window.open(`/?view=${activeDomain}:${activeScreen}&focus=1`, '_blank');
  }, [activeDomain, activeScreen]);

  const handleToggleFocus = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      showToast(next ? 'Full screen — press Esc to exit' : 'Exited full screen');
      return next;
    });
  }, [showToast]);

  // ── Dual pin handlers ──
  const handlePinModeChange = useCallback((mode: PinMode) => {
    setPinMode(mode);
    try {
      localStorage.setItem(PIN_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const handleAddBookmark = useCallback((domain: DomainKey, screen: string) => {
    setRailBookmarks((prev) => {
      if (prev.some((b) => b.domain === domain && b.screen === screen)) return prev;
      const next = [...prev, { domain, screen }];
      try {
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleRemoveBookmark = useCallback((domain: DomainKey, screen: string) => {
    setRailBookmarks((prev) => {
      const next = prev.filter((b) => !(b.domain === domain && b.screen === screen));
      try {
        localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const activeTabKey = `${activeDomain}:${activeScreen}`;

  return (
    <>
      <Header
        openTabs={openTabs}
        activeTabKey={activeTabKey}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onOpenCreateFlyout={() => setCreateFlyoutOpen(true)}
        onOpenNavigationHub={() => setNavigationHubOpen(true)}
        onOpenSettings={(screenId) => openOrActivateTab('settings', screenId ?? 'ws-home')}
        viewMode={viewMode}
        onChangeViewMode={(mode) => {
          setViewMode(mode);
          showToast(`Switched to ${mode} view`);
        }}
        onToast={showToast}
        hideTabs={focusMode}
      />

      {!focusMode && (
        <MainRail
          activeDomain={activeDomain}
          onSelectDomain={handleSelectDomain}
          onOpenCreateFlyout={() => setCreateFlyoutOpen(true)}
          onRailAction={handleRailAction}
          onUtilAction={handleUtilAction}
          favoritesCount={favoriteIds.length}
          pinMode={pinMode}
          bookmarksCount={railBookmarks.length}
          favoritesOpen={favoritesFlyoutOpen}
          onToggleFavorites={() => setFavoritesFlyoutOpen((prev) => !prev)}
        />
      )}

      {!focusMode && activeDomain !== 'dashboard' && (
        <SideRail
          activeDomain={activeDomain}
          activeScreen={activeScreen}
          openGroups={openGroupsByDomain[activeDomain] || []}
          sideFilter={sideFilter}
          onSideFilterChange={setSideFilter}
          onToggleGroup={handleToggleGroup}
          onSelectScreen={handleSelectScreen}
          collapsed={sideRailCollapsed}
          onToggleCollapse={() => setSideRailCollapsed((prev) => !prev)}
          screenBadges={dashboardController.queueBadges}
        />
      )}

      <ScreenContent
        openTabs={openTabs}
        activeTabKey={activeTabKey}
        dashboardController={dashboardController}
        onNavigate={openOrActivateTab}
        onCapCreate={handleCapCreate}
        onCreate={handleCreate}
        onOpenCreateFlyout={() => setCreateFlyoutOpen(true)}
        onOpenPeek={(row) => {
          setPeekRow(row);
          setPeekOpen(true);
        }}
        onToast={showToast}
        sideRailCollapsed={activeDomain === 'dashboard' ? true : sideRailCollapsed}
        focusMode={focusMode}
        onToggleFocus={handleToggleFocus}
        onOpenStandalone={handleOpenStandalone}
      />

      <DashboardOverlays controller={dashboardController} onToast={showToast} />

      <PeekDrawer
        open={peekOpen}
        row={peekRow}
        onClose={() => setPeekOpen(false)}
        onOpenFull={() => {
          setPeekOpen(false);
          openDocEngine();
        }}
      />

      <RecordDrawer
        open={recordDrawerOpen}
        kind={recordKind}
        sessionKey={recordSessionKey}
        onClose={() => setRecordDrawerOpen(false)}
        onToast={showToast}
      />

      <DocumentEngine
        open={docEngineOpen}
        activeTab={docTab}
        onSelectTab={setDocTab}
        onClose={() => setDocEngineOpen(false)}
        onToast={showToast}
      />

      <CreateFlyout
        open={createFlyoutOpen}
        onClose={() => setCreateFlyoutOpen(false)}
        onSelectCreate={handleCreate}
      />

      <NavigationHubFlyout
        open={navigationHubOpen}
        onClose={() => setNavigationHubOpen(false)}
        onNavigate={openOrActivateTab}
        onToast={showToast}
        onCreate={handleCreate}
      />

      <StudioDrawer
        open={studioDrawerOpen}
        kind={studioDrawerKind}
        onClose={() => setStudioDrawerOpen(false)}
        onToast={showToast}
      />
      <QuickActionsDrawer
        open={quickActionsDrawerOpen}
        onClose={() => setQuickActionsDrawerOpen(false)}
        selectedActionIds={favoriteIds}
        onSelectedActionIdsChange={(newIds) => {
          setFavoriteIds(newIds);
          try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newIds));
          } catch {
            // ignore
          }
        }}
        onToast={showToast}
        onSelectAction={(actionName) => {
          handleCreate(actionName);
        }}
      />

      <FavoritesFlyout
        open={favoritesFlyoutOpen}
        pinMode={pinMode}
        onPinModeChange={handlePinModeChange}
        bookmarks={railBookmarks}
        activeDomain={activeDomain}
        activeScreen={activeScreen}
        onAddBookmark={handleAddBookmark}
        onRemoveBookmark={handleRemoveBookmark}
        onNavigateBookmark={openOrActivateTab}
        favoriteIds={favoriteIds}
        onClose={() => setFavoritesFlyoutOpen(false)}
        onSelectAction={(actionName) => {
          handleCreate(actionName);
        }}
        onOpenCustomize={() => {
          setFavoritesFlyoutOpen(false);
          setQuickActionsDrawerOpen(true);
        }}
        onToast={showToast}
      />

      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
