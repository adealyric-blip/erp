'use client';

import { useState } from 'react';
import {
  DEMO_ROWS,
  DOMAINS,
  DemoRow,
  DomainKey,
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
import DashboardScreenRenderer, {
  DASHBOARD_SCREEN_IDS,
  DashboardController,
} from './dashboard/DashboardScreens';
import PurchaseOrderScreen from './finance/PurchaseOrderScreen';
import EstimatesScreen from './finance/EstimatesScreen';
import BillsScreen from './finance/BillsScreen';
import AccountingOverviewScreen from './finance/AccountingOverviewScreen';
import BankTransactionsScreen from './finance/BankTransactionsScreen';
import ChartOfAccountsScreen from './finance/ChartOfAccountsScreen';
import ReportsScreen from './finance/ReportsScreen';
import BankRulesScreen from './finance/BankRulesScreen';
import ReceiptsScreen from './finance/ReceiptsScreen';
import ReconcileScreen from './finance/ReconcileScreen';
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
  const rows = DEMO_ROWS[cfg.key] || [];
  const tabs = cfg.tabs || ['All'];
  const [activeTab, setActiveTab] = useState<string>(tabs[0]);
  const [rowSearch, setRowSearch] = useState<string>('');

  const filtered = rows.filter((r) => {
    if (!rowSearch.trim()) return true;
    const q = rowSearch.toLowerCase();
    return Object.values(r).some((v) => String(v).toLowerCase().includes(q));
  });
  const hasData = filtered.length > 0;

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
          <div className={styles.splitBtn}>
            <button
              type="button"
              className={styles.splitBtnPrimaryMain}
              data-new={cfg.newLabel}
              onClick={() => onCreate(cfg.newLabel)}
            >
              <span className={`material-symbols-outlined ${styles.icon16}`}>add</span>
              New transaction
            </button>
            <button type="button" className={styles.splitBtnPrimaryArrow}>
              <span className={`material-symbols-outlined ${styles.icon16}`}>expand_more</span>
            </button>
          </div>
          <button
            type="button"
            className={styles.secondaryBtn}
            data-export
            onClick={() => onToast('Exported')}
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
            return (
              <button
                key={tab}
                type="button"
                data-viewtab={tab}
                className={`${styles.viewTab} ${isTabActive ? styles.viewTabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
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
            1–{filtered.length} of {filtered.length}
          </span>
        </div>

        {hasData ? (
          <table className={styles.dataTable}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.checkColHeader}>
                  <input type="checkbox" className={styles.rowCheck} />
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
                  className={styles.tableRow}
                  onClick={() => onOpenPeek(row, cfg.family)}
                >
                  <td className={styles.cell}>
                    <input
                      type="checkbox"
                      className={styles.rowCheck}
                      onClick={(e) => e.stopPropagation()}
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
                    <button
                      type="button"
                      className={styles.rowMenuBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToast('Row actions menu');
                      }}
                    >
                      <span className={`material-symbols-outlined ${styles.icon16Muted}`}>
                        more_horiz
                      </span>
                    </button>
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
                onClick={() => onToast('Import dialog')}
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
  domainLabel,
  groupName,
  onCreate,
  onOpenCreateFlyout,
}: {
  cfg: OverviewScreenConfig;
  domainLabel: string;
  groupName: string;
  onCreate: (label: string) => void;
  onOpenCreateFlyout: () => void;
}) {
  const kpis = cfg.kpis || [];
  const actions = cfg.actions || [];

  return (
    <div className={styles.screenContainer}>
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

  if (screenId === 'purchase-orders') {
    return (
      <PurchaseOrderScreen
        onClose={() => onNavigate(domain, 'bills-overview')}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'estimates') {
    return (
      <EstimatesScreen
        onCreateInvoice={() => onCreate('Invoice')}
        onCreateCustomer={() => onCreate('Customer')}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'bills') {
    return (
      <BillsScreen
        onPayBills={() => onNavigate(domain, 'bill_payments')}
        onCreateBill={() => onCreate('Bill')}
        onOpenPeek={(title, details) => {
          onOpenPeek(
            {
              id: title,
              name: title,
              ...details,
            },
            'bills'
          );
        }}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'accounting') {
    return (
      <AccountingOverviewScreen
        onNavigate={onNavigate}
        onCreate={onCreate}
        onOpenCreateFlyout={onOpenCreateFlyout}
        onOpenPeek={(title, details) => {
          onOpenPeek(
            {
              id: title,
              name: title,
              ...details,
            },
            'receipts'
          );
        }}
        onToast={onToast}
      />
    );
  }

  if (screenId === 'bank') {
    return (
      <BankTransactionsScreen
        onNavigate={onNavigate}
        onOpenPeek={(title, details) => {
          onOpenPeek(
            {
              id: title,
              name: title,
              ...details,
            },
            'bank'
          );
        }}
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

  if (screenId === 'reports') {
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
        onCreateExpense={() => onCreate('Expense')}
        onOpenPeek={(title, details) => {
          onOpenPeek(
            {
              id: title,
              name: title,
              ...details,
            },
            'receipts'
          );
        }}
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
      domainLabel={domainLabel}
      groupName={screen.group}
      onCreate={onCreate}
      onOpenCreateFlyout={onOpenCreateFlyout}
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
}: ScreenContentProps) {
  return (
    <div className={styles.contentOffset}>
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
