'use client';

import { useState, useMemo } from 'react';
import { DomainKey } from '@/data/shellData';
import { INVENTORY, INVENTORY_TABS, InventoryRow } from '@/data/ordersData';
import RowMenu, { RowMenuItem, BulkBar } from '@/components/ListPrimitives';
import styles from './OrdersPages.module.css';

interface OrdersScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast: (msg: string) => void;
  onCreate?: (label: string) => void;
  onOpenCreateFlyout?: () => void;
}

export function InventoryView({ onToast, onNavigate, onCreate, onOpenCreateFlyout }: OrdersScreenProps) {
  const [activeTab, setActiveTab] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [warehouse, setWarehouse] = useState('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return INVENTORY.filter(row => {
      if (activeTab !== 'All' && row.status !== activeTab) return false;
      if (warehouse !== 'All' && row.warehouse !== warehouse) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return row.sku.toLowerCase().includes(q) || row.product.toLowerCase().includes(q);
    });
  }, [activeTab, search, warehouse]);

  const toggleSelect = (sku: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });

  const rowMenuItems = (row: InventoryRow): RowMenuItem[] => [
    { label: 'View in Catalog', icon: 'open_in_new', onClick: () => onNavigate('catalog', 'products') },
    { label: 'Adjust stock', icon: 'tune', onClick: () => (onCreate ? onCreate('Stock adjustment') : onToast(`Adjusting ${row.product}`)) },
    { label: 'Transfer', icon: 'swap_horiz', onClick: () => onToast(`Transferring ${row.product}`) },
    { label: 'Stock history', icon: 'history', dividerBefore: true, onClick: () => onToast(`History for ${row.product}`) },
    { label: 'Start cycle count', icon: 'inventory_2', onClick: () => onToast(`Cycle count for ${row.product}`) },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.contextHeader}>
        <div className={styles.contextLeft}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#5a6355' }}>local_shipping</span>
          <span className={styles.contextLabel}>Orders</span>
          <span className={styles.contextSep}>/</span>
          <span className={styles.contextActive}>Inventory</span>
        </div>
      </div>

      <div className={styles.pageBody}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Inventory</h1>
            <p className={styles.pageSubtitle}>On-hand stock, bin locations, and reorder points across warehouses</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.splitBtn}>
              <button className={styles.splitBtnMain} onClick={() => (onCreate ? onCreate('Stock adjustment') : onToast('Adjust stock — opening drawer'))}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                Adjust stock
              </button>
              <button className={styles.splitBtnArrow} onClick={() => onToast('Options: Adjustment / Transfer / Cycle count / Reorder POs')}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
              </button>
            </div>
            <button className={styles.btnSecondary} onClick={() => onToast('Syncing from supplier…')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
              Sync from supplier
            </button>
          </div>
        </div>

        {/* KPI tiles */}
        <div className={styles.kpiGrid}>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into total SKUs')}>
            <div className={styles.kpiValue}>342</div>
            <div className={styles.kpiLabel}>Total SKUs</div>
            <div className={styles.kpiDelta}>Across 2 warehouses</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into in stock')}>
            <div className={styles.kpiValue} style={{ color: '#1e5a38' }}>298</div>
            <div className={styles.kpiLabel}>In stock</div>
            <div className={styles.kpiDelta}>87% healthy</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into low stock')}>
            <div className={styles.kpiValue} style={{ color: '#6b1e28' }}>32</div>
            <div className={styles.kpiLabel}>Low stock</div>
            <div className={styles.kpiDelta}>Below reorder point</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into out of stock')}>
            <div className={styles.kpiValue} style={{ color: '#ba1a1a' }}>12</div>
            <div className={styles.kpiLabel}>Out of stock</div>
            <div className={styles.kpiDelta}>3 on open orders</div>
          </button>
        </div>

        {/* Create actions */}
        <div className={styles.createActionsRow}>
          <span className={styles.createActionsLabel}>Create actions:</span>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Adjustment') : onToast('Adjustment — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>Adjustment</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Transfer') : onToast('Transfer — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>swap_horiz</span>Transfer</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Cycle count') : onToast('Cycle count — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>inventory_2</span>Cycle count</button>
          <button className={styles.createChip} onClick={() => (onCreate ? onCreate('Reorder POs') : onToast('Reorder POs — opening'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>shopping_bag</span>Reorder POs</button>
          <button className={styles.showAllChip} onClick={() => (onOpenCreateFlyout ? onOpenCreateFlyout() : onToast('Show all create options'))}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>apps</span>Show all</button>
        </div>

        {/* Table */}
        <div className={styles.tableCard}>
          <div className={styles.viewTabsBar}>
            {INVENTORY_TABS.map(tab => (
              <button key={tab} className={`${styles.viewTab} ${activeTab === tab ? styles.viewTabActive : ''}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.filterBar}>
            <div className={styles.filterInputWrap}>
              <span className={`material-symbols-outlined ${styles.filterInputIcon}`}>search</span>
              <input className={styles.filterInput} placeholder="Filter by SKU, product…" type="text" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className={styles.filterSelect} value={warehouse} onChange={e => setWarehouse(e.target.value)}>
              <option>All</option>
              <option>Charlotte</option>
              <option>Nashville</option>
            </select>
            <button className={styles.filterBtn}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>Filter</button>
            <span className={styles.filterCount}>{selected.size > 0 ? `${selected.size} selected` : `${filtered.length} of ${INVENTORY.length}`}</span>
          </div>

          {selected.size > 0 && (
            <BulkBar
              selectedIds={Array.from(selected)}
              onClear={() => setSelected(new Set())}
              actions={[
                { label: 'Create PO', icon: 'shopping_bag', onClick: () => { onToast(`Creating PO for ${selected.size} SKUs`); setSelected(new Set()); } },
                { label: 'Adjust', icon: 'tune', onClick: () => { onToast(`Adjusting ${selected.size} SKUs`); setSelected(new Set()); } },
                { label: 'Transfer', icon: 'swap_horiz', onClick: () => { onToast(`Transferring ${selected.size} SKUs`); setSelected(new Set()); } },
              ]}
            />
          )}

          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkCell}><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={() => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.sku)))} /></th>
                <th>SKU / Product</th>
                <th>Warehouse</th>
                <th>Bin</th>
                <th style={{ textAlign: 'right' }}>On hand</th>
                <th style={{ textAlign: 'right' }}>Committed</th>
                <th style={{ textAlign: 'right' }}>Available</th>
                <th style={{ textAlign: 'right' }}>Reorder pt</th>
                <th>Status</th>
                <th className={styles.actionCell}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.sku} className={`${styles.tableRow} ${selected.has(row.sku) ? styles.tableRowSelected : ''}`}>
                  <td className={styles.checkCell}><input type="checkbox" checked={selected.has(row.sku)} onChange={() => toggleSelect(row.sku)} /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.product}</div>
                    <div style={{ fontSize: 11, color: '#5a6355', fontFamily: 'monospace' }}>{row.sku}</div>
                  </td>
                  <td>{row.warehouse}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.bin}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.onHand}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.committed}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: row.available < 0 ? '#ba1a1a' : '#1a1c1e', fontWeight: row.available < 0 ? 700 : 400 }}>{row.available}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.reorderPoint}</td>
                  <td><span className={styles.statusPill} data-status={row.status}>{row.status}</span></td>
                  <td className={styles.actionCell}><RowMenu items={rowMenuItems(row)} /></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10} className={styles.emptyState}>No inventory items match the current filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default InventoryView;
