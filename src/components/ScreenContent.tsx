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
import AccountingOverview from './accounting/AccountingOverview';
import ExpensesBillsOverview from './expenses-bills/ExpensesBillsOverview';
import Bills from './expenses-bills/Bills';
import PayBills from './expenses-bills/PayBills';
import Vendors from './expenses-bills/Vendors';
import PurchaseOrder from './expenses-bills/PurchaseOrder';
import BankTransactions from './accounting/BankTransactions';
import ChartOfAccounts from './accounting/ChartOfAccounts';
import Reports from './accounting/Reports';
import BankRules from './accounting/BankRules';
import Receipts from './accounting/Receipts';
import ReconcileScreen from './finance/ReconcileScreen';
import BusinessTaxOverview from './business-tax/BusinessTaxOverview';
import TaxSummary from './business-tax/TaxSummary';
import YearEndFiling from './business-tax/YearEndFiling';
import SalesOverview from './sales/SalesOverview';
import SalesTransactions from './sales/SalesTransactions';
import InvoicesScreen from './sales/InvoicesScreen';
import SalesEstimatesScreen from './sales/SalesEstimatesScreen';
import PaymentLinksScreen from './sales/PaymentLinksScreen';
import ProductsServicesScreen from './sales/ProductsServicesScreen';
import ContactsParties from './contacts/ContactsParties';
import Statements from './statements/Statements';
import OrdersOverview from './orders/OrdersOverview';
import OrdersList from './orders/OrdersList';
import PurchaseOrders from './orders/PurchaseOrders';
import ReturnsClaims from './orders/ReturnsClaims';
import FulfillmentQueue from './orders/FulfillmentQueue';
import BatchSlips from './orders/BatchSlips';
import ShippingSettings from './orders/ShippingSettings';
import InventoryView from './orders/InventoryView';
import styles from './ScreenContent.module.css';

interface ScreenContentProps {
  openTabs: WorkspaceTab[];
  activeTabKey: string;
  dashboardController: DashboardController;
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onNavigateFinanceScreen: (screenId: string) => void;
  onCapCreate: (label: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
  sideRailCollapsed: boolean;
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
}: {
  cfg: ListScreenConfig;
  domainLabel: string;
  groupName: string;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
}) {
  const allRows = DEMO_ROWS[cfg.key] || [];
  const tabs = cfg.tabs || ['All'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [rowSearch, setRowSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [splitOpen, setSplitOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement | null>(null);

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

  const rowMenuItems = (row: DemoRow, idx: number): import('@/components/ListPrimitives').RowMenuItem[] => [
    {
      label: 'View',
      icon: 'open_in_new',
      onClick: () => onOpenPeek(row, cfg.family),
    },
    {
      label: 'Edit',
      icon: 'edit',
      onClick: () => onToast(`Editing ${cfg.newLabel}`),
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
      onClick: () => onToast('Printing…'),
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
        onToast(`Exported ${selectedArray.length} records`);
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
            onClick={() => onToast('Export started — CSV will download')}
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
              {filtered.map((row, idx) => (
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
              ))}
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
  onNavigateFinanceScreen,
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
  onNavigateFinanceScreen: (screenId: string) => void;
  onCapCreate: (label: string) => void;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
  onOpenPeek: (row: DemoRow, family: string) => void;
  onToast: (message: string) => void;
}) {
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

  if (domain === 'finance' && CAP_TABLE_SCREEN_IDS.has(screenId)) {
    return (
      <CapTableScreenRenderer
        screenId={screenId}
        onGotoScreen={onNavigateFinanceScreen}
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
      <Bills
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
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
      <PurchaseOrder
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'accounting') {
    return (
      <AccountingOverview
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'bank') {
    return (
      <BankTransactions
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'coa') {
    return (
      <ChartOfAccounts
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'reports') {
    return (
      <Reports
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'rules') {
    return (
      <BankRules
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'receipts') {
    return (
      <Receipts
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
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
    return (
      <SalesEstimatesScreen
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
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
    return (
      <ContactsParties
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
  }

  if (screenId === 'statements') {
    return (
      <Statements
        onNavigate={onNavigate}
        onToast={onToast}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
      />
    );
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
    />
  );
}

export default function ScreenContent({
  openTabs,
  activeTabKey,
  dashboardController,
  onNavigate,
  onNavigateFinanceScreen,
  onCapCreate,
  onCreate,
  onOpenCreateFlyout,
  onOpenPeek,
  onToast,
  sideRailCollapsed,
}: ScreenContentProps) {
  return (
    <div className={`${styles.contentOffset} ${sideRailCollapsed ? styles.contentOffsetCollapsed : ''}`}>
      <main id="screen" className={styles.screenMain}>
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
                onNavigateFinanceScreen={onNavigateFinanceScreen}
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
