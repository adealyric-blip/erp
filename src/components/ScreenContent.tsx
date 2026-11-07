'use client';
// Business Tax + Sales screens wired here (tax-overview / tax-summary / tax-filing)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_ROWS,
  DOMAINS,
  DemoRow,
  DomainKey,
  GroupBgToken,
  ListScreenConfig,
  OverviewScreenConfig,
  SCREEN_DEFS,
  findScreen,
} from '@/data/shellData';
import { WorkspaceTab } from './Header';
import StatusPill from './StatusPill';
import CapTableScreenRenderer, {
  CAP_TABLE_SCREEN_IDS,
} from './cap-table/CapTableScreens';
import WorkspaceSettings, {
  WS_SCREEN_IDS,
} from './settings/WorkspaceSettings';
import RowMenu, { BulkBar } from './ListPrimitives';
import listStyles from './ListPrimitives.module.css';
import DashboardScreenRenderer, {
  DASHBOARD_SCREEN_IDS,
  DashboardController,
} from './dashboard/DashboardScreens';
import ExpensesBillsOverview from './expenses-bills/ExpensesBillsOverview';
import PayBills from './expenses-bills/PayBills';
import Vendors from './expenses-bills/Vendors';
// Finance — HTML 1:1 screens (spec: unsaid-component-functionality-spec.md §2–§5)
import AccountingOverviewScreen from './finance/AccountingOverviewScreen';
import BankTransactionsScreen from './finance/BankTransactionsScreen';
import ChartOfAccountsScreen from './finance/ChartOfAccountsScreen';
import BankRulesScreen from './finance/BankRulesScreen';
import ReceiptsScreen from './finance/ReceiptsScreen';
import BillsScreen from './finance/BillsScreen';
import EstimatesScreen from './finance/EstimatesScreen';
import PurchaseOrderScreen from './finance/PurchaseOrderScreen';
import ReportsScreen from './finance/ReportsScreen';
import CashFlowScreen from './finance/CashFlowScreen';
import ReconcileScreen from './finance/ReconcileScreen';
import BusinessTaxOverview from './business-tax/BusinessTaxOverview';
import TaxSummary from './business-tax/TaxSummary';
import YearEndFiling from './business-tax/YearEndFiling';
import SalesOverview from './sales/SalesOverview';
import SalesTransactions from './sales/SalesTransactions';
import InvoicesScreen from './sales/InvoicesScreen';
import PaymentLinksScreen from './sales/PaymentLinksScreen';
import ProductsServicesScreen from './sales/ProductsServicesScreen';
import ContactsParties from './contacts/ContactsParties';
import CrmOverviewScreen from './contacts/CrmOverviewScreen';
import CustomersScreen from './contacts/CustomersScreen';
import ContactsEstimatesScreen from './contacts/EstimatesScreen';
import StatementsScreen from './contacts/StatementsScreen';
import OrdersOverview from './orders/OrdersOverview';
import OrdersList from './orders/OrdersList';
import PurchaseOrders from './orders/PurchaseOrders';
import ReturnsClaims from './orders/ReturnsClaims';
import FulfillmentQueue from './orders/FulfillmentQueue';
import BatchSlips from './orders/BatchSlips';
import ShippingSettings from './orders/ShippingSettings';
import InventoryView from './orders/InventoryView';
import DesignCanvasScreen from './design/DesignCanvasScreen';
import DesignPreviewScreen from './design/DesignPreviewScreen';
import ProductPageScreen from './design/ProductPageScreen';
import ProductPageModal from './design/ProductPageModal';
import TasksProjectsScreen from './tasks/TasksProjectsScreen';
import PublishingOverviewScreen from './marketing/PublishingOverviewScreen';
import CreateContentScreen from './marketing/CreateContentScreen';
import OversightScreen from './marketing/OversightScreen';
import AdCenterScreen from './marketing/AdCenterScreen';
import CampaignsScreen from './marketing/CampaignsScreen';
import AdSetsScreen from './marketing/AdSetsScreen';
import CreativesScreen from './marketing/CreativesScreen';
import AudiencesScreen from './marketing/AudiencesScreen';
import PixelsScreen from './marketing/PixelsScreen';
import AdSpendScreen from './marketing/AdSpendScreen';
import AdvertisersScreen from './marketing/AdvertisersScreen';
import PromotionsScreen from './marketing/PromotionsScreen';
import NewsletterScreen from './marketing/NewsletterScreen';
import AutomationScreen from './marketing/AutomationScreen';
import { useDesignCanvas, CATALOG_PRODUCTS, type CatalogProduct } from '@/lib/designCanvasStore';
import { exportToCsv } from '@/lib/csvExport';
import styles from './ScreenContent.module.css';

interface ScreenContentProps {
  openTabs: WorkspaceTab[];
  activeTabKey: string;
  dashboardController: DashboardController;
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onCapCreate: (label: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
  sideRailCollapsed: boolean;
  /** Full-screen focus mode — page is free from sidebar & tab bar. */
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenStandalone: () => void;
}

// Maps a GroupBgToken to a concrete background-color class for child-pill icons.
function groupBgClass(bg: GroupBgToken): string {
  switch (bg) {
    case 'bg-qb-navy':
      return 'bg-[#1f2937]';
    case 'bg-qb-teal':
      return 'bg-[#0e5e6f]';
    case 'bg-qb-maroon':
      return 'bg-[#6b1e28]';
    case 'bg-qb-green':
      return 'bg-[#1e5a38]';
    case 'bg-error':
      return 'bg-[#ba1a1a]';
    case 'bg-primary':
      return 'bg-[#0a6400]';
    default:
      return 'bg-[#5a6355]';
  }
}

function ListView({
  cfg,
  domainLabel,
  groupName,
  onCreate,
  onOpenCreateFlyout,
  onOpenPeek,
  onToast,
  onNavigate,
}: {
  cfg: ListScreenConfig;
  domainLabel: string;
  groupName: string;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}) {
  const allRows = DEMO_ROWS[cfg.key] || [];
  const tabs = cfg.tabs || ['All'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [rowSearch, setRowSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [splitOpen, setSplitOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement | null>(null);
  // Product page modal — opens when a catalog thumbnail is clicked.
  const [activeProduct, setActiveProduct] = useState<CatalogProduct | null>(null);

  // Click-outside for split-button dropdown
  useEffect(() => {
    if (!splitOpen) return;
    function handleClick(e: MouseEvent) {
      if (splitRef.current && !splitRef.current.contains(e.target as Node)) {
        setSplitOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [splitOpen]);

  // Filter by tab + search. Tabs like "Open/Overdue/Paid" filter by status column.
  const filtered = allRows.filter((r) => {
    let tabMatch = true;
    if (activeTab !== 'All' && activeTab !== 'For review') {
      const status = String(r.status ?? '').toLowerCase();
      tabMatch = status === activeTab.toLowerCase();
    } else if (activeTab === 'For review') {
      tabMatch = String(r.status ?? '').toLowerCase() === 'for review';
    }
    if (!rowSearch.trim()) return tabMatch;
    const q = rowSearch.toLowerCase();
    const searchMatch = Object.values(r).some((v) =>
      String(v).toLowerCase().includes(q)
    );
    return tabMatch && searchMatch;
  });
  const hasData = filtered.length > 0;

  const toggleSelect = (idx: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((_, i) => i));
    });

  const selectedArray = Array.from(selectedIds);

  const isStudioCatalog =
    cfg.family === 'catalog' &&
    (cfg.key.startsWith('studio-') || cfg.key.startsWith('wizard-'));

  // Map a catalog row to its CATALOG_PRODUCTS entry (by product name).
  const productForRow = (row: DemoRow): CatalogProduct | undefined =>
    CATALOG_PRODUCTS.find((p) => p.name === String(row.product ?? ''));

  const rowMenuItems = (row: DemoRow, idx: number): import('@/components/ListPrimitives').RowMenuItem[] => [
    ...(isStudioCatalog
      ? [
          {
            label: 'Add to designer',
            icon: 'palette',
            onClick: () => {
              // Open the product page modal — user reviews supplier/variants,
              // then clicks "Start designing" to load the canvas.
              const prod = productForRow(row);
              if (prod) {
                setActiveProduct(prod);
              } else {
                // Fallback: load a blank directly.
                const productName = String(row.product ?? '').toLowerCase();
                const blankKey = productName.includes('mug')
                  ? 'mug'
                  : productName.includes('hoodie') || productName.includes('crewneck')
                    ? 'hoodie'
                    : 'tee';
                useDesignCanvas.getState().loadBlank(blankKey);
                onNavigate('design', 'new-design');
                onToast(`${row.product ?? 'Product'} added to designer.`);
              }
            },
          },
          {
            label: 'View',
            icon: 'open_in_new',
            onClick: () => onOpenPeek(row, cfg.family),
          },
        ]
      : [
          {
            label: 'View',
            icon: 'open_in_new',
            onClick: () => onOpenPeek(row, cfg.family),
          },
        ]),
    {
      label: 'Edit',
      icon: 'edit',
      onClick: () => onOpenPeek(row, cfg.family),
    },
    {
      label: 'Duplicate',
      icon: 'content_copy',
      onClick: () => onToast(`Duplicated ${cfg.newLabel}`),
    },
    {
      label: 'Print',
      icon: 'print',
      dividerBefore: true,
      onClick: () => {
        if (typeof window !== 'undefined') window.print();
      },
    },
    {
      label: 'Delete',
      icon: 'delete',
      danger: true,
      onClick: () => {
        onToast(`Deleted record`);
        toggleSelect(idx);
      },
    },
  ];

  const bulkActions: import('@/components/ListPrimitives').BulkAction[] = [
    {
      label: 'Export selected',
      icon: 'download',
      onClick: () => {
        const cols = cfg.cols.map((c) => ({ key: c.key, label: c.label }));
        const selectedRows = selectedArray
          .map((i) => filtered[i])
          .filter(Boolean) as unknown as Record<string, unknown>[];
        exportToCsv(selectedRows, cols, `${cfg.key || 'export'}-selected`);
        onToast(`Exported ${selectedArray.length} records to CSV`);
        setSelectedIds(new Set());
      },
    },
    {
      label: 'Delete selected',
      icon: 'delete',
      danger: true,
      onClick: () => {
        onToast(`Deleted ${selectedArray.length} records`);
        setSelectedIds(new Set());
      },
    },
  ];

  // Per-family create options for the split-button dropdown
  const familyCreates = cfg.createActionsRow
    ? cfg.createActionsRow.map(([label]) => label)
    : [cfg.newLabel];

  return (
    <div className={styles.screenContainer}>
      <div className={styles.listHeader}>
        <div>
          <div className={styles.breadcrumb}>
            <span>{domainLabel}</span>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{groupName}</span>
          </div>
          <h1 className={styles.pageTitle}>{cfg.title}</h1>
          <p className={styles.pageSubtitle}>{cfg.subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.splitBtn} ref={splitRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className={styles.splitBtnPrimaryMain}
              data-new={cfg.newLabel}
              onClick={() => onCreate(cfg.newLabel)}
            >
              <span className={`material-symbols-outlined ${styles.icon16}`}>add</span>
              New {cfg.newLabel.toLowerCase()}
            </button>
            <button
              type="button"
              className={styles.splitBtnPrimaryArrow}
              aria-expanded={splitOpen}
              onClick={() => setSplitOpen((prev) => !prev)}
            >
              <span className={`material-symbols-outlined ${styles.icon16}`}>expand_more</span>
            </button>
            {splitOpen && (
              <div className={listStyles.splitDropdown} role="menu">
                {familyCreates.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={listStyles.splitDropdownItem}
                    onClick={() => {
                      setSplitOpen(false);
                      onCreate(label);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                    {label}
                  </button>
                ))}
                <div className={listStyles.rowMenuDivider} />
                <button
                  type="button"
                  className={listStyles.splitDropdownItem}
                  onClick={() => {
                    setSplitOpen(false);
                    onOpenCreateFlyout();
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>apps</span>
                  Show all create options
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-export
            onClick={() => {
              const cols = cfg.cols.map((c) => ({ key: c.key, label: c.label }));
              exportToCsv(filtered as unknown as Record<string, unknown>[], cols, cfg.key || 'export');
              onToast(`Exported ${filtered.length} records to CSV`);
            }}
          >
            <span className={`material-symbols-outlined ${styles.icon16}`}>download</span>
            Export
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-customize
            onClick={() => onToast('Customize panel — Data / Visual tabs')}
          >
            <span className={`material-symbols-outlined ${styles.icon16}`}>tune</span>
            Customize
          </button>
        </div>
      </div>

      {cfg.createActionsRow && (
        <div className={styles.createActionsRow}>
          <span className={styles.createActionsLabel}>Create actions:</span>
          {cfg.createActionsRow.map(([label, icon]) => (
            <button
              key={label}
              type="button"
              className={styles.createActionChip}
              data-new={label}
              onClick={() => onCreate(label)}
            >
              <span className={`material-symbols-outlined ${styles.icon16}`}>{icon}</span>
              {label}
            </button>
          ))}
          <button
            type="button"
            className={styles.showAllBtn}
            data-open-create
            onClick={onOpenCreateFlyout}
          >
            <span className={`material-symbols-outlined ${styles.icon16}`}>apps</span>
            Show all
          </button>
        </div>
      )}

      <div className={styles.tableCard}>
        <div className={styles.viewTabsBar}>
          {tabs.map((tab) => {
            const isTabActive = activeTab === tab;
            const count =
              tab === 'All'
                ? allRows.length
                : allRows.filter(
                    (r) => String(r.status ?? '').toLowerCase() === tab.toLowerCase()
                  ).length;
            return (
              <button
                key={tab}
                type="button"
                data-viewtab={tab}
                className={`${styles.viewTab} ${isTabActive ? styles.viewTabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {count > 0 && <span className={styles.viewTabCount}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className={styles.filterToolbar}>
          <div className={styles.rowFilterWrap}>
            <span className={`material-symbols-outlined ${styles.icon15Search}`}>search</span>
            <input
              className={styles.rowFilterInput}
              placeholder="Filter rows…"
              type="text"
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
            />
          </div>
          <button type="button" className={styles.filterToolBtn}>
            <span className={`material-symbols-outlined ${styles.icon14}`}>filter_list</span>
            Filter
          </button>
          <button type="button" className={styles.filterToolBtn}>
            <span className={`material-symbols-outlined ${styles.icon14}`}>calendar_today</span>
            Date range
          </button>
          <button type="button" className={styles.filterToolBtn}>
            <span className={`material-symbols-outlined ${styles.icon14}`}>bookmark</span>
            Saved views
          </button>
          <span className={styles.rowCountText}>
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `1–${filtered.length} of ${filtered.length}`}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <BulkBar
            selectedIds={selectedArray.map(String)}
            onClear={() => setSelectedIds(new Set())}
            actions={bulkActions}
          />
        )}

        {hasData ? (
          <table className={styles.dataTable}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.checkColHeader}>
                  <input
                    type="checkbox"
                    className={styles.rowCheck}
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                {isStudioCatalog && <th className={styles.thumbColHeader} />}
                {cfg.cols.map((col) => (
                  <th
                    key={col.key}
                    className={`${styles.colHeader} ${col.right ? styles.alignRight : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className={styles.actionColHeader} />
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {filtered.map((row, idx) => {
                const prod = isStudioCatalog ? productForRow(row) : undefined;
                const thumbImg = prod
                  ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e8e8e8"/><path d="M30 30 L30 90 L45 90 L45 50 L50 40 L55 50 L55 90 L70 90 L70 30 Z" fill="%23fff" stroke="%23ccc"/></svg>'
                  : null;
                return (
                <tr
                  key={idx}
                  className={`${styles.tableRow} ${selectedIds.has(idx) ? styles.tableRowSelected : ''}`}
                  onClick={() => onOpenPeek(row, cfg.family)}
                >
                  <td className={styles.cell}>
                    <input
                      type="checkbox"
                      className={styles.rowCheck}
                      checked={selectedIds.has(idx)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(idx)}
                    />
                  </td>
                  {isStudioCatalog && (
                    <td className={styles.thumbCell}>
                      {thumbImg && prod && (
                        <button
                          type="button"
                          className={styles.thumbBtn}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('blank-type', prod.blankKey);
                            e.dataTransfer.setData('catalog-product-id', prod.id);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          title={`${prod.name} — drag to canvas or click for product page`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveProduct(prod);
                          }}
                        >
                          <img src={thumbImg} alt={prod.name} />
                        </button>
                      )}
                    </td>
                  )}
                  {cfg.cols.map((col) => {
                    const val = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`${styles.cell} ${col.right ? styles.alignRight : ''}`}
                      >
                        {col.key === 'status' ? (
                          <StatusPill status={String(val)} />
                        ) : (
                          String(val ?? '')
                        )}
                      </td>
                    );
                  })}
                  <td className={styles.actionCell}>
                    <RowMenu items={rowMenuItems(row, idx)} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIconCircle}>
              <span className={`material-symbols-outlined ${styles.icon32Outline}`}>inbox</span>
            </div>
            <h3 className={styles.emptyTitle}>
              {cfg.emptyTitle || `No ${cfg.title.toLowerCase()} yet`}
            </h3>
            <p className={styles.emptyDesc}>
              {cfg.emptySteps || 'Create your first record or import from a CSV.'}
            </p>
            <div className={styles.emptyActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                data-import
                onClick={() => onToast('Import dialog — select a CSV file')}
              >
                <span className={`material-symbols-outlined ${styles.icon16}`}>upload</span>
                Import
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                data-new={cfg.newLabel}
                onClick={() => onCreate(cfg.newLabel)}
              >
                <span className={`material-symbols-outlined ${styles.icon16}`}>add</span>
                {cfg.newLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product page modal — opens when a catalog thumbnail is clicked. */}
      {activeProduct && (
        <ProductPageModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
          onEnterStudio={() => {
            onNavigate('design', 'new-design');
            onToast(`${activeProduct.name} loaded into the studio.`);
          }}
        />
      )}
    </div>
  );
}

function OverviewView({
  cfg,
  domain,
  domainLabel,
  groupName,
  activeScreenId,
  onCreate,
  onOpenCreateFlyout,
  onNavigate,
}: {
  cfg: OverviewScreenConfig;
  domain: DomainKey;
  domainLabel: string;
  groupName: string;
  activeScreenId: string;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}) {
  const kpis = cfg.kpis || [];
  const actions = cfg.actions || [];

  // Build the child strip: all screens across all groups in this domain.
  const childScreens = useMemo(() => {
    const dom = DOMAINS[domain];
    if (!dom) return [];
    return dom.groups.flatMap((g) =>
      g.screens.map((s) => ({
        ...s,
        group: g.name,
        groupIcon: g.icon,
        groupBg: g.bg,
      }))
    );
  }, [domain]);

  // Hover-arrows navigation for the child strip (replaces scrollbar).
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
  }, [childScreens, updateArrows]);

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 200), behavior: 'smooth' });
  };

  return (
    <div className={styles.screenContainer}>
      {/* Domain child strip — hover-arrow navigation (no scrollbar) */}
      {childScreens.length > 1 && (
        <div
          className={styles.childStripWrap}
          onMouseEnter={updateArrows}
        >
          {canLeft && (
            <button
              type="button"
              className={`${styles.childStripArrow} ${styles.childStripArrowLeft}`}
              onClick={() => scrollBy(-1)}
              aria-label="Scroll left"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_left
              </span>
            </button>
          )}
          {canRight && (
            <button
              type="button"
              className={`${styles.childStripArrow} ${styles.childStripArrowRight}`}
              onClick={() => scrollBy(1)}
              aria-label="Scroll right"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_right
              </span>
            </button>
          )}
          <div
            ref={stripRef}
            className={styles.childStrip}
            onScroll={updateArrows}
          >
            {childScreens.map((s) => {
              const active = s.id === activeScreenId;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.childPill} ${active ? styles.childPillActive : ''}`}
                  onClick={() => onNavigate(domain, s.id)}
                  title={s.label}
                >
                  <span
                    className={`${styles.childPillIcon} ${groupBgClass(s.groupBg)}`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                      {s.groupIcon}
                    </span>
                  </span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.overviewHeader}>
        <div className={styles.breadcrumb}>
          <span>{domainLabel}</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span>{groupName}</span>
        </div>
        <h1 className={styles.pageTitle}>{cfg.title}</h1>
        <p className={styles.pageSubtitle}>{cfg.subtitle}</p>
      </div>

      <div className={styles.kpiGrid}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{kpi.label}</span>
            <div className={styles.kpiValue}>{kpi.value}</div>
            <div
              className={
                kpi.delta?.startsWith('+') ? styles.kpiDeltaPos : styles.kpiDeltaNeg
              }
            >
              {kpi.delta || ''}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.createActionsRow}>
        <span className={styles.createActionsLabel}>Create actions:</span>
        {actions.map(([label, icon]) => (
          <button
            key={label}
            type="button"
            className={styles.createActionChip}
            data-new={label}
            onClick={() => onCreate(label)}
          >
            <span className={`material-symbols-outlined ${styles.icon16}`}>{icon}</span>
            {label}
          </button>
        ))}
        <button
          type="button"
          className={styles.showAllBtn}
          data-open-create
          onClick={onOpenCreateFlyout}
        >
          <span className={`material-symbols-outlined ${styles.icon16}`}>apps</span>
          Show all
        </button>
      </div>

      <div className={styles.panelCard}>
        <h2 className={styles.panelTitle}>{cfg.panelTitle || 'Business at a glance'}</h2>
        <p className={styles.panelText}>
          {cfg.panelText ||
            'Insight cards and suggestions live here. Setup checklist card until company setup is complete.'}
        </p>
      </div>
    </div>
  );
}

function TabScreenRenderer({
  domain,
  screenId,
  dashboardController,
  onNavigate,
  onCapCreate,
  onCreate,
  onOpenCreateFlyout,
  onOpenPeek,
  onToast,
}: {
  domain: DomainKey;
  screenId: string;
  dashboardController: DashboardController;
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onCapCreate: (label: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
}) {
  // Peek adapter: finance screens call onOpenPeek(title, details).
  const peekTitled = useCallback(
    (title: string, details: Record<string, string | number>) => {
      onOpenPeek({ title, ...details }, 'finance');
    },
    [onOpenPeek]
  );

  if (domain === 'dashboard' && DASHBOARD_SCREEN_IDS.has(screenId)) {
    return (
      <DashboardScreenRenderer
        screenId={screenId}
        controller={dashboardController}
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  // Cap Table screens now live inside the finance domain (executive decision).
  if (domain === 'finance' && CAP_TABLE_SCREEN_IDS.has(screenId)) {
    return (
      <CapTableScreenRenderer
        screenId={screenId}
        onGotoScreen={(scrId) => onNavigate(domain, scrId)}
        onCapCreate={onCapCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
        onToast={onToast}
      />
    );
  }

  if (domain === 'settings' && WS_SCREEN_IDS.has(screenId)) {
    return (
      <WorkspaceSettings
        screenId={screenId}
        onGotoScreen={(id) => onNavigate('settings', id)}
        onToast={onToast}
      />
    );
  }

  // ── Orders module pages ──
  if (domain === 'orders') {
    const ordersProps = {
      onNavigate,
      onToast,
      onCreate,
      onOpenCreateFlyout,
      onOpenPeek: peekTitled,
    };
    switch (screenId) {
      case 'orders-overview':
        return <OrdersOverview {...ordersProps} />;
      case 'orders':
        return <OrdersList {...ordersProps} />;
      case 'purchase-orders':
        return <PurchaseOrders {...ordersProps} />;
      case 'returns':
        return <ReturnsClaims {...ordersProps} />;
      case 'fulfillment-queue':
        return <FulfillmentQueue {...ordersProps} />;
      case 'batch-slips':
        return <BatchSlips {...ordersProps} />;
      case 'shipping-settings':
        return <ShippingSettings {...ordersProps} />;
      case 'inventory':
        return <InventoryView {...ordersProps} />;
      default:
        // Fall through to existing screen-specific renderers below
        break;
    }
  }

  // ── Design Studio: New design canvas (spec: upload/canvas.html) ──
  if (screenId === 'new-design') {
    return <DesignCanvasScreen onToast={onToast} onNavigate={onNavigate} />;
  }

  // ── Tasks & Projects (spec: upload/task-projects.html) ──
  if (screenId === 'tasks') {
    return <TasksProjectsScreen onToast={onToast} />;
  }

  // ── Marketing screens ──
  const mktProps = { onToast, onNavigate };
  switch (screenId) {
    case 'mkt-publishing-overview': return <PublishingOverviewScreen {...mktProps} />;
    case 'mkt-create-content': return <CreateContentScreen {...mktProps} />;
    case 'mkt-oversight': return <OversightScreen onToast={onToast} />;
    case 'mkt-promotions': return <PromotionsScreen onToast={onToast} />;
    case 'mkt-newsletter': return <NewsletterScreen onToast={onToast} />;
    case 'mkt-automation': return <AutomationScreen onToast={onToast} />;
    case 'mkt-adcenter': return <AdCenterScreen {...mktProps} />;
    case 'mkt-campaigns': return <CampaignsScreen onToast={onToast} />;
    case 'mkt-adsets': return <AdSetsScreen onToast={onToast} />;
    case 'mkt-creatives': return <CreativesScreen onToast={onToast} />;
    case 'mkt-audiences': return <AudiencesScreen onToast={onToast} />;
    case 'mkt-pixels': return <PixelsScreen onToast={onToast} />;
    case 'mkt-adspend': return <AdSpendScreen {...mktProps} />;
    case 'mkt-advertisers': return <AdvertisersScreen onToast={onToast} />;
    default: break;
  }

  // ── Design Studio: Product page (spec: upload/productguide.html) ──
  // A full screen (not a modal) for viewing product details + Start designing.
  if (screenId === 'product-page') {
    return <ProductPageScreen onToast={onToast} onNavigate={onNavigate} />;
  }

  // ── Design Studio: Preview & Publish page (spec: upload/mockup preview.html) ──
  if (screenId === 'design-preview') {
    return <DesignPreviewScreen onToast={onToast} onNavigate={onNavigate} />;
  }

  // ── Finance: Expenses & Bills (spec §3) ──
  if (screenId === 'bills-overview') {
    return (
      <ExpensesBillsOverview
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'bills') {
    return (
      <BillsScreen
        onPayBills={() => onNavigate('finance', 'bill-payments')}
        onCreateBill={() => onCreate('Bill')}
        onOpenPeek={peekTitled}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'bill_payments' || screenId === 'bill-payments') {
    return (
      <PayBills
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'vendors') {
    return (
      <Vendors
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'purchase-orders') {
    return (
      <PurchaseOrderScreen onToast={onToast} />
    );
  }

  // ── Finance: Accounting (spec §2) ──
  if (screenId === 'accounting') {
    return (
      <AccountingOverviewScreen
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={peekTitled}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'bank') {
    return (
      <BankTransactionsScreen
        onNavigate={onNavigate}
        onOpenPeek={peekTitled}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'coa') {
    return (
      <ChartOfAccountsScreen
        onNavigate={onNavigate}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'cash-flow') {
    return (
      <CashFlowScreen
        onNavigate={onNavigate}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'quick-view') {
    return (
      <ReportsScreen
        onNavigate={onNavigate}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'rules') {
    return (
      <BankRulesScreen
        onNavigate={onNavigate}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'receipts') {
    return (
      <ReceiptsScreen
        onNavigate={onNavigate}
        onOpenPeek={peekTitled}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'reconcile') {
    return (
      <ReconcileScreen
        onNavigate={onNavigate}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'tax-overview') {
    return (
      <BusinessTaxOverview
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'tax-summary') {
    return (
      <TaxSummary
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'tax-filing') {
    return (
      <YearEndFiling
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'sales-overview') {
    return (
      <SalesOverview
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'sales-transactions') {
    return (
      <SalesTransactions
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
      />
    );
  }

  if (screenId === 'invoices') {
    return (
      <InvoicesScreen
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
      />
    );
  }

  if (screenId === 'estimates') {
    return <ContactsEstimatesScreen onToast={onToast} />;
  }

  if (screenId === 'payment-links') {
    return (
      <PaymentLinksScreen
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={onOpenPeek}
      />
    );
  }

  if (screenId === 'products') {
    return (
      <ProductsServicesScreen
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'parties') {
    return <ContactsParties onToast={onToast} onNavigate={onNavigate as (d: string, s: string) => void} />;
  }

  if (screenId === 'crm-overview') {
    return <CrmOverviewScreen onToast={onToast} onNavigate={onNavigate as (d: string, s: string) => void} />;
  }

  if (screenId === 'customers') {
    return <CustomersScreen onToast={onToast} onNavigate={onNavigate as (d: string, s: string) => void} />;
  }

  if (screenId === 'statements') {
    return <StatementsScreen onToast={onToast} />;
  }

  // ── Published Items & SKUs — merge store-published products into the
  //    catalog rows. Designs published from the Studio go live here.
  if (screenId === 'published-skus') {
    const published = useDesignCanvas.getState().published;
    if (published.length > 0) {
      const existing = DEMO_ROWS['published-skus'] || [];
      const publishedRows = published.map((p) => ({
        product: p.name,
        brand: p.brand,
        color: p.color,
        sizes: p.sizes.join('/'),
        supplier: p.supplier,
        status: 'Live',
      }));
      // Prepend published rows that aren't already in the list.
      const existingNames = new Set(existing.map((r: DemoRow) => String(r.product)));
      const newRows = publishedRows.filter((r) => !existingNames.has(r.product));
      if (newRows.length > 0) {
        DEMO_ROWS['published-skus'] = [...newRows, ...existing];
      }
    }
  }

  const screen = findScreen(domain, screenId);
  const domainLabel = DOMAINS[domain].label;
  const def = SCREEN_DEFS[screen.id] || SCREEN_DEFS[screen.id.replace(/-/g, '_')];

  let resolvedConfig: ListScreenConfig | OverviewScreenConfig;
  if (def) {
    resolvedConfig = def;
  } else if (screen.type === 'overview') {
    resolvedConfig = {
      mode: 'overview',
      title: screen.label,
      subtitle: 'Overview screen.',
      kpis: [],
      actions: [],
    };
  } else {
    resolvedConfig = {
      mode: 'list',
      key: '__empty',
      title: screen.label,
      subtitle: 'List screen — view tabs, filter bar, bulk bar, row menu, right peek drawer.',
      family: 'generic',
      newLabel: 'Create',
      cols: [{ key: 'name', label: 'Name' }],
      tabs: ['All'],
      emptyTitle: `No ${screen.label.toLowerCase()} yet`,
      emptySteps: 'Import from a file or create your first record to get started.',
    };
  }

  return resolvedConfig.mode === 'overview' ? (
    <OverviewView
      cfg={resolvedConfig}
      domain={domain}
      domainLabel={domainLabel}
      groupName={screen.group}
      activeScreenId={screenId}
      onCreate={onCreate}
      onOpenCreateFlyout={onOpenCreateFlyout}
      onNavigate={onNavigate}
    />
  ) : (
    <ListView
      cfg={resolvedConfig}
      domainLabel={domainLabel}
      groupName={screen.group}
      onCreate={onCreate}
      onOpenCreateFlyout={onOpenCreateFlyout}
      onOpenPeek={onOpenPeek}
      onToast={onToast}
      onNavigate={onNavigate}
    />
  );
}

export default function ScreenContent({
  openTabs,
  activeTabKey,
  dashboardController,
  onNavigate,
  onCapCreate,
  onCreate,
  onOpenCreateFlyout,
  onOpenPeek,
  onToast,
  sideRailCollapsed,
  focusMode,
  onToggleFocus,
  onOpenStandalone,
}: ScreenContentProps) {
  const offsetClass = focusMode
    ? styles.contentOffsetFocus
    : sideRailCollapsed
      ? styles.contentOffsetCollapsed
      : '';
  return (
    <div className={`${styles.contentOffset} ${offsetClass}`}>
      <main
        id="screen"
        className={`${styles.screenMain} ${focusMode ? styles.screenMainFocus : ''}`}
      >
        {/* Page view controls — below the tab bar, on every page */}
        <div className={styles.focusBar} role="toolbar" aria-label="Page view controls">
          <button
            type="button"
            className={styles.focusBtn}
            data-standalone-open
            title="Open this page in a new tab"
            aria-label="Open this page in a new tab"
            onClick={onOpenStandalone}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              open_in_new
            </span>
          </button>
          <button
            type="button"
            className={`${styles.focusBtn} ${focusMode ? styles.focusBtnActive : ''}`}
            data-focus-toggle
            title={
              focusMode
                ? 'Exit full screen'
                : 'Full screen — hide sidebar & tabs'
            }
            aria-label={
              focusMode
                ? 'Exit full screen'
                : 'Full screen — hide sidebar & tabs'
            }
            aria-pressed={focusMode}
            onClick={onToggleFocus}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
              {focusMode ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>
        </div>
        {openTabs.map((tab) => {
          const isActive = tab.key === activeTabKey;
          return (
            <div
              key={tab.key}
              className={isActive ? styles.tabPaneActive : styles.tabPaneHidden}
            >
              <TabScreenRenderer
                domain={tab.domain}
                screenId={tab.screenId}
                dashboardController={dashboardController}
                onNavigate={onNavigate}
                onCapCreate={onCapCreate}
                onCreate={onCreate}
                onOpenCreateFlyout={onOpenCreateFlyout}
                onOpenPeek={onOpenPeek}
                onToast={onToast}
              />
            </div>
          );
        })}
      </main>
    </div>
  );
}
