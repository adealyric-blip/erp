'use client';

/**
 * Marketing shared primitives — reusable components for all marketing screens.
 * These mirror the patterns from the HTML files: page header, KPI strip,
 * resource table (list card with status tabs + filter + bulk bar + table),
 * peek drawer, editor drawer, modal, split button, view toggle.
 *
 * All components use CSS module classes from MarketingPrimitives.module.css.
 * No inline styles (except dynamic values like bar widths and avatar colors).
 */
import { useState, type ReactNode } from 'react';
import styles from './MarketingPrimitives.module.css';

// ── Page header ──
export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
}: {
  breadcrumb?: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      {breadcrumb && (
        <div className={styles.breadcrumb}>
          {breadcrumb.map((crumb, i) => (
            <span key={i} className={i === breadcrumb.length - 1 ? styles.breadcrumbActive : ''}>
              {i > 0 && <span style={{ margin: '0 4px' }}>/</span>}
              {crumb}
            </span>
          ))}
        </div>
      )}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className={styles.headerActions}>{actions}</div>}
      </div>
    </div>
  );
}

// ── KPI strip ──
export interface KpiItem {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'pos' | 'neg' | 'neutral';
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className={styles.kpiStrip}>
      {items.map((kpi, i) => (
        <div key={i} className={styles.kpiCard}>
          <span className={styles.kpiLabel}>{kpi.label}</span>
          <span className={styles.kpiValue}>{kpi.value}</span>
          {kpi.delta && (
            <span
              className={`${styles.kpiDelta} ${
                kpi.deltaTone === 'pos'
                  ? styles.kpiDeltaPos
                  : kpi.deltaTone === 'neg'
                    ? styles.kpiDeltaNeg
                    : styles.kpiDeltaNeutral
              }`}
            >
              {kpi.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── View toggle ──
export function ViewToggle<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className={styles.viewToggle}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.viewTab} ${active === tab.id ? styles.viewTabActive : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Status pill ──
export function StatusPill({ status, tone }: { status: string; tone: 'green' | 'blue' | 'orange' | 'red' | 'gray' | 'purple' }) {
  const toneClass = {
    green: styles.pillGreen,
    blue: styles.pillBlue,
    orange: styles.pillOrange,
    red: styles.pillRed,
    gray: styles.pillGray,
    purple: styles.pillPurple,
  }[tone];
  return <span className={`${styles.pill} ${toneClass}`}>{status}</span>;
}

// ── Resource table (list card) ──
export interface TableColumn {
  key: string;
  label: string;
  right?: boolean;
}

export interface ResourceTableProps {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
  statusTabs?: { id: string; label: string; count: number }[];
  activeStatusTab?: string;
  onStatusTabChange?: (id: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  selectedIds?: Set<number>;
  onToggleSelect?: (idx: number) => void;
  onToggleSelectAll?: () => void;
  bulkActions?: { label: string; icon?: string; danger?: boolean; onClick: () => void }[];
  onRowClick?: (row: Record<string, unknown>, idx: number) => void;
  rowMenuItems?: (row: Record<string, unknown>, idx: number) => { label: string; icon?: string; onClick: () => void }[];
  pagination?: { page: number; totalPages: number; totalRows: number; onPageChange: (p: number) => void };
  emptyTitle?: string;
  emptyText?: string;
  exportFn?: () => void;
}

export function ResourceTable({
  columns,
  rows,
  statusTabs,
  activeStatusTab,
  onStatusTabChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  bulkActions,
  onRowClick,
  pagination,
  emptyTitle,
  emptyText,
  exportFn,
}: ResourceTableProps) {
  const [rowMenuOpen, setRowMenuOpen] = useState<number | null>(null);
  const hasSelection = selectedIds && selectedIds.size > 0;

  return (
    <div className={styles.listCard}>
      {statusTabs && (
        <div className={styles.statusTabs}>
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.statusTab} ${activeStatusTab === tab.id ? styles.statusTabActive : ''}`}
              onClick={() => onStatusTabChange?.(tab.id)}
            >
              {tab.label}
              <span className={styles.statusTabCount}>{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.filterBar}>
        {onSearchChange && (
          <input
            className={styles.filterInput}
            type="text"
            placeholder={searchPlaceholder || 'Search…'}
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        )}
        {exportFn && (
          <button type="button" className={styles.filterPill} onClick={exportFn}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export
          </button>
        )}
      </div>

      {hasSelection && bulkActions && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds!.size} selected</span>
          {bulkActions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.bulkAction} ${action.danger ? styles.bulkActionDanger : ''}`}
              onClick={action.onClick}
            >
              {action.icon && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{action.icon}</span>}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={`material-symbols-outlined ${styles.emptyStateIcon}`}>inbox</span>
          <h3>{emptyTitle || 'No records found'}</h3>
          <p>{emptyText || 'Try adjusting your filters or create a new record.'}</p>
        </div>
      ) : (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {onToggleSelect && (
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds?.size === rows.length && rows.length > 0}
                    onChange={() => onToggleSelectAll?.()}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={col.right ? styles.alignRight : ''}>{col.label}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} onClick={() => onRowClick?.(row, idx)}>
                {onToggleSelect && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(idx) || false}
                      onChange={() => onToggleSelect(idx)}
                    />
                  </td>
                )}
                {columns.map((col) => {
                  const val = row[col.key];
                  return (
                    <td key={col.key} className={col.right ? styles.alignRight : ''}>
                      {col.key === 'status' && typeof val === 'string' ? (
                        <StatusPill status={val} tone="gray" />
                      ) : (
                        String(val ?? '')
                      )}
                    </td>
                  );
                })}
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.btnIcon}
                    onClick={() => setRowMenuOpen(rowMenuOpen === idx ? null : idx)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_horiz</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.totalRows} records
          </span>
          <div className={styles.paginationBtns}>
            <button
              type="button"
              className={`${styles.paginationBtn} ${pagination.page <= 1 ? styles.paginationBtnDisabled : ''}`}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              ←
            </button>
            <button
              type="button"
              className={`${styles.paginationBtn} ${pagination.page >= pagination.totalPages ? styles.paginationBtnDisabled : ''}`}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Peek drawer ──
export interface PeekField {
  label: string;
  value: string;
}

export function PeekDrawer({
  open,
  onClose,
  title,
  fields,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: PeekField[];
}) {
  return (
    <>
      <div className={`${styles.peekScrim} ${open ? styles.peekScrimOpen : ''}`} onClick={onClose} />
      <div className={`${styles.peekDrawer} ${open ? styles.peekDrawerOpen : ''}`}>
        <div className={styles.peekHeader}>
          <h3>{title}</h3>
          <button type="button" className={styles.btnIcon} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.peekBody}>
          {fields.map((f, i) => (
            <div key={i} className={styles.peekRow}>
              <span className={styles.peekLabel}>{f.label}</span>
              <span className={styles.peekValue}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Editor drawer ──
export function EditorDrawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className={`${styles.editorScrim} ${open ? styles.editorScrimOpen : ''}`} onClick={onClose} />
      <div className={`${styles.editorDrawer} ${open ? styles.editorDrawerOpen : ''}`}>
        <div className={styles.editorHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.btnIcon} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.editorBody}>{children}</div>
        {footer && <div className={styles.editorFooter}>{footer}</div>}
      </div>
    </>
  );
}

// ── Modal ──
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className={styles.modalScrim} onClick={onClose}>
      <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{title}</h2>
          <button type="button" className={styles.btnIcon} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Split button ──
export function SplitButton({
  mainLabel,
  mainIcon,
  onMainClick,
  menuItems,
}: {
  mainLabel: string;
  mainIcon?: string;
  onMainClick: () => void;
  menuItems: { label: string; icon?: string; onClick: () => void }[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.splitBtn} style={{ position: 'relative' }}>
      <button type="button" className={styles.splitMain} onClick={onMainClick}>
        {mainIcon && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{mainIcon}</span>}
        {mainLabel}
      </button>
      <button type="button" className={styles.splitArrow} onClick={() => setMenuOpen(!menuOpen)}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
      </button>
      {menuOpen && (
        <div className={`${styles.splitArrowMenu} ${styles.open}`}>
          {menuItems.map((item, i) => (
            <button
              key={i}
              type="button"
              className={styles.splitArrowMenuItem}
              onClick={() => {
                item.onClick();
                setMenuOpen(false);
              }}
            >
              {item.icon && <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick actions grid ──
export function QuickActions({
  actions,
}: {
  actions: { title: string; desc: string; icon: string; onClick: () => void }[];
}) {
  return (
    <div className={styles.quickActions}>
      {actions.map((action, i) => (
        <div key={i} className={styles.quickActionCard} onClick={action.onClick}>
          <div className={styles.quickActionIcon}>
            <span className="material-symbols-outlined">{action.icon}</span>
          </div>
          <div className={styles.quickActionTitle}>{action.title}</div>
          <div className={styles.quickActionDesc}>{action.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ── Create actions row ──
export function CreateActionsRow({
  actions,
  onShowAll,
}: {
  actions: { label: string; icon: string; onClick: () => void }[];
  onShowAll?: () => void;
}) {
  return (
    <div className={styles.createActions}>
      <span className={styles.createActionsLabel}>Create actions:</span>
      {actions.map((action, i) => (
        <button key={i} type="button" className={styles.createActionChip} onClick={action.onClick}>
          <span className="material-symbols-outlined">{action.icon}</span>
          {action.label}
        </button>
      ))}
      {onShowAll && (
        <button type="button" className={styles.createActionChip} onClick={onShowAll}>
          <span className="material-symbols-outlined">apps</span>
          Show all
        </button>
      )}
    </div>
  );
}
