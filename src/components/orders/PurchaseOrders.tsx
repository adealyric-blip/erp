'use client';

import { useState, useMemo } from 'react';
import { DomainKey } from '@/data/shellData';
import { PURCHASE_ORDERS, PO_TABS, PurchaseOrderRow } from '@/data/ordersData';
import RowMenu, { RowMenuItem, BulkBar } from '@/components/ListPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './OrdersPages.module.css';

interface OrdersScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast: (msg: string) => void;
  onCreate?: (label: string) => void;
  onOpenCreateFlyout?: () => void;
  onOpenPeek?: (title: string, details: Record<string, string | number>) => void;
}

const AVATAR_COLORS: Record<string, string> = {
  P: styles.avatarBlue,
  G: styles.avatarGreen,
};

export function PurchaseOrders({ onToast, onCreate, onOpenCreateFlyout, onOpenPeek }: OrdersScreenProps) {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return PURCHASE_ORDERS.filter((row) => {
      if (activeTab !== 'All' && row.status !== activeTab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return row.id.toLowerCase().includes(q) || row.supplier.toLowerCase().includes(q);
    });
  }, [activeTab, search]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((r) => r.id));
    });

  const rowMenuItems = (row: PurchaseOrderRow): RowMenuItem[] => [
    { label: 'View PO', icon: 'open_in_new', onClick: () => (onOpenPeek ? onOpenPeek(`PO ${row.id} — ${row.supplier}`, {
      'PO No.': row.id,
      Supplier: row.supplier,
      Items: row.items,
      Ordered: row.ordered,
      Expected: row.expected,
      Total: row.total,
      Status: row.status,
    }) : onToast(`Viewing ${row.id}`)) },
    { label: 'Edit', icon: 'edit', onClick: () => onToast(`Editing ${row.id}`) },
    { label: 'Duplicate', icon: 'content_copy', onClick: () => onToast(`Duplicated ${row.id}`) },
    { label: 'Send to supplier', icon: 'send', dividerBefore: true, onClick: () => onToast(`Sending ${row.id} to ${row.supplier}`) },
    { label: 'Receive items…', icon: 'inventory', onClick: () => onToast(`Receiving items for ${row.id}`) },
    { label: 'Print PO', icon: 'print', onClick: () => onToast(`Printing ${row.id}`) },
    { label: 'Report a problem…', icon: 'report_problem', dividerBefore: true, onClick: () => onToast(`Reporting problem with ${row.id}`) },
    { label: 'Cancel PO', icon: 'block', danger: true, onClick: () => onToast(`Cancelled ${row.id}`) },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.contextHeader}>
        <div className={styles.contextLeft}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#5a6355' }}>local_shipping</span>
          <span className={styles.contextLabel}>Orders</span>
          <span className={styles.contextSep}>/</span>
          <span className={styles.contextActive}>Purchase orders</span>
        </div>
      </div>

      <div className={styles.pageBody}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Purchase orders</h1>
            <p className={styles.pageSubtitle}>Restock inventory from suppliers · receive against open POs</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.splitBtn}>
              <button className={styles.splitBtnMain} onClick={() => (onCreate ? onCreate('Purchase order') : onToast('New PO — opening drawer'))}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                New PO
              </button>
              <button className={styles.splitBtnArrow} onClick={() => onToast('PO options: Blank PO / From restock / From sales orders')}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
              </button>
            </div>
            <button className={styles.btnSecondary} onClick={() => (onCreate ? onCreate('Restock suggestions') : onToast('Restock suggestions — opening'))}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
              Restock
            </button>
            <button className={styles.btnSecondary} onClick={() => (onCreate ? onCreate('Receive items') : onToast('Receive items — opening'))}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory</span>
              Receive items
            </button>
            <button className={styles.btnSecondary} onClick={() => {
              const cols = [
                { key: 'id', label: 'PO' },
                { key: 'supplier', label: 'Supplier' },
                { key: 'items', label: 'Items' },
                { key: 'ordered', label: 'Ordered' },
                { key: 'expected', label: 'Expected' },
                { key: 'total', label: 'Total' },
                { key: 'status', label: 'Status' },
              ];
              exportToCsv(filtered as unknown as Record<string, unknown>[], cols, 'purchase-orders');
              onToast(`Exported ${filtered.length} records to CSV`);
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Export
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        <div className={styles.kpiGrid}>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into open POs')}>
            <div className={styles.kpiValue}>3</div>
            <div className={styles.kpiLabel}>Open POs</div>
            <div className={styles.kpiDelta}>$4,180 committed</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into expected this week')}>
            <div className={styles.kpiValue}>2</div>
            <div className={styles.kpiLabel}>Expected this week</div>
            <div className={styles.kpiDelta}>$1,940 in transit</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into overdue receiving')}>
            <div className={styles.kpiValue} style={{ color: '#ba1a1a' }}>1</div>
            <div className={styles.kpiLabel}>Overdue receiving</div>
            <div className={styles.kpiDelta} style={{ color: '#ba1a1a' }}>Printify — 3 days late</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into received 30d')}>
            <div className={styles.kpiValue} style={{ color: '#1e5a38' }}>$12,340</div>
            <div className={styles.kpiLabel}>Received (30d)</div>
            <div className={styles.kpiDelta}>6 POs fulfilled</div>
          </button>
        </div>

        {/* Create actions */}
        <div className={styles.createActionsRow}>
          <span className={styles.createActionsLabel}>Create actions:</span>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Purchase order') : onToast('New PO — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>shopping_bag</span>Purchase order</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Restock suggestions') : onToast('Restock suggestions — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>Restock suggestions</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Receive items') : onToast('Receive items — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory</span>Receive items</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Add supplier') : onToast('Add supplier — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>factory</span>Add supplier</button>
          <button className={styles.showAllChip} onClick={() => (onOpenCreateFlyout ? onOpenCreateFlyout() : onToast('Show all create options'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>apps</span>Show all</button>
        </div>

        {/* Table */}
        <div className={styles.tableCard}>
          <div className={styles.viewTabsBar}>
            {PO_TABS.map((tab) => (
              <button
                key={tab}
                className={`${styles.viewTab} ${activeTab === tab ? styles.viewTabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterInputWrap}>
              <span className={`material-symbols-outlined ${styles.filterInputIcon}`}>search</span>
              <input
                className={styles.filterInput}
                placeholder="Filter by PO #, supplier…"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={styles.filterSelect} defaultValue="All">
              <option>All</option>
              <option>Printful</option>
              <option>Gelato</option>
              <option>Printify</option>
            </select>
            <button className={styles.filterBtn}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bookmark</span>
              Saved views
            </button>
            <span className={styles.filterCount}>
              {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} of ${PURCHASE_ORDERS.length}`}
            </span>
          </div>

          {selected.size > 0 && (
            <BulkBar
              selectedIds={Array.from(selected)}
              onClear={() => setSelected(new Set())}
              actions={[
                { label: 'Send to supplier', icon: 'send', onClick: () => { onToast(`Sending ${selected.size} POs`); setSelected(new Set()); } },
                { label: 'Receive', icon: 'inventory', onClick: () => { onToast(`Receiving ${selected.size} POs`); setSelected(new Set()); } },
                { label: 'Print', icon: 'print', onClick: () => { onToast(`Printing ${selected.size} POs`); setSelected(new Set()); } },
                { label: 'Cancel POs', icon: 'block', danger: true, onClick: () => { onToast(`Cancelling ${selected.size} POs`); setSelected(new Set()); } },
              ]}
            />
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkCell}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} /></th>
                <th>PO</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Ordered</th>
                <th>Expected</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th className={styles.actionCell}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={`${styles.tableRow} ${selected.has(row.id) ? styles.tableRowSelected : ''}`} onClick={() => (onOpenPeek ? onOpenPeek(`PO ${row.id} — ${row.supplier}`, {
                  'PO No.': row.id,
                  Supplier: row.supplier,
                  Items: row.items,
                  Ordered: row.ordered,
                  Expected: row.expected,
                  Total: row.total,
                  Status: row.status,
                }) : onToast(`Viewing ${row.id}`))}>
                  <td className={styles.checkCell}><input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                  <td><strong>{row.id}</strong></td>
                  <td>
                    <div className={styles.cellName}>
                      <span className={`${styles.avatar} ${AVATAR_COLORS[row.supplierInitial] || styles.avatarBlue}`}>{row.supplierInitial}</span>
                      {row.supplier}
                    </div>
                  </td>
                  <td>{row.items}</td>
                  <td>{row.ordered}</td>
                  <td style={{ color: row.expectedOverdue ? '#ba1a1a' : '#1a1c1e', fontWeight: row.expectedOverdue ? 700 : 400 }}>{row.expected}</td>
                  <td style={{ textAlign: 'right', color: row.expectedOverdue ? '#ba1a1a' : '#1a1c1e' }}>{row.total}</td>
                  <td>
                    <span className={styles.statusPill} data-status={row.status}>
                      {row.status === 'Overdue' && <span className="material-symbols-outlined" style={{ fontSize: 10, marginRight: 2 }}>warning</span>}
                      {row.status}
                    </span>
                  </td>
                  <td className={styles.actionCell}><RowMenu items={rowMenuItems(row)} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className={styles.emptyState}>No purchase orders match the current filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PurchaseOrders;
