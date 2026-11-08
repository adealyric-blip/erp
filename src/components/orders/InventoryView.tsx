'use client';

import { useState, useMemo, useEffect } from 'react';
import { DomainKey } from '@/data/shellData';
import { INVENTORY_TABS } from '@/data/ordersData';
import { listInventory, type InventoryApiRow } from '@/lib/podApi';
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

  // Live inventory — products + product_variants. POD rows (fulfillment_type
  // 'POD') are trackInventory=false: they show the 'Made on demand' pill,
  // no on-hand number, and no stock actions. No seed rows here.
  const [rows, setRows] = useState<InventoryApiRow[]>([]);
  const [invStatus, setInvStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [invError, setInvError] = useState<string | null>(null);

  const load = () => {
    setInvStatus('loading');
    setInvError(null);
    listInventory()
      .then((res) => {
        setRows(res.rows);
        setInvStatus('ready');
      })
      .catch((e: Error) => {
        setInvError(e.message);
        setInvStatus('error');
      });
  };
  useEffect(load, []);

  const statusOf = (row: InventoryApiRow): string => {
    if (row.madeOnDemand) return 'Made on demand';
    if ((row.onHand ?? 0) === 0) return 'Out of stock';
    if ((row.onHand ?? 0) <= (row.reorderPoint ?? 0)) return 'Low stock';
    return 'In stock';
  };

  const filtered = useMemo(() => {
    return rows.filter(row => {
      const status = statusOf(row);
      if (activeTab !== 'All' && status !== activeTab) return false;
      if (warehouse !== 'All') return false; // Live rows carry no warehouse — only 'All' matches.
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return row.sku.toLowerCase().includes(q) || row.product.toLowerCase().includes(q);
    });
  }, [rows, activeTab, search, warehouse]);

  const trackedCount = rows.filter((r) => r.trackInventory).length;
  const madeOnDemandCount = rows.filter((r) => r.madeOnDemand).length;
  const inStockCount = rows.filter((r) => statusOf(r) === 'In stock').length;
  const lowStockCount = rows.filter((r) => statusOf(r) === 'Low stock').length;
  const outOfStockCount = rows.filter((r) => statusOf(r) === 'Out of stock').length;

  // POD rows can't be selected for stock actions — no Adjust / Cycle count.
  const toggleSelect = (row: InventoryApiRow) => {
    if (!row.trackInventory) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(row.variantId)) next.delete(row.variantId);
      else next.add(row.variantId);
      return next;
    });
  };

  const rowMenuItems = (row: InventoryApiRow): RowMenuItem[] => {
    if (row.madeOnDemand) {
      return [
        { label: 'View in Catalog', icon: 'open_in_new', onClick: () => onNavigate('catalog', 'products') },
      ];
    }
    return [
      { label: 'View in Catalog', icon: 'open_in_new', onClick: () => onNavigate('catalog', 'products') },
      { label: 'Adjust stock', icon: 'tune', onClick: () => (onCreate ? onCreate('Stock adjustment') : onToast(`Adjusting ${row.product}`)) },
      { label: 'Transfer', icon: 'swap_horiz', onClick: () => onToast(`Transferring ${row.product}`) },
      { label: 'Stock history', icon: 'history', dividerBefore: true, onClick: () => onToast(`History for ${row.product}`) },
      { label: 'Start cycle count', icon: 'inventory_2', onClick: () => onToast(`Cycle count for ${row.product}`) },
    ];
  };

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

        {/* KPI tiles — live counts from the inventory rows. */}
        <div className={styles.kpiGrid}>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into total SKUs')}>
            <div className={styles.kpiValue}>{invStatus === 'ready' ? trackedCount : '—'}</div>
            <div className={styles.kpiLabel}>Total SKUs</div>
            <div className={styles.kpiDelta}>{madeOnDemandCount} made on demand</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into in stock')}>
            <div className={styles.kpiValue} style={{ color: '#1e5a38' }}>{invStatus === 'ready' ? inStockCount : '—'}</div>
            <div className={styles.kpiLabel}>In stock</div>
            <div className={styles.kpiDelta}>Tracked stock only</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into low stock')}>
            <div className={styles.kpiValue} style={{ color: '#6b1e28' }}>{invStatus === 'ready' ? lowStockCount : '—'}</div>
            <div className={styles.kpiLabel}>Low stock</div>
            <div className={styles.kpiDelta}>Below reorder point</div>
          </button>
          <button className={styles.kpiTile} onClick={() => onToast('Drill into out of stock')}>
            <div className={styles.kpiValue} style={{ color: '#ba1a1a' }}>{invStatus === 'ready' ? outOfStockCount : '—'}</div>
            <div className={styles.kpiLabel}>Out of stock</div>
            <div className={styles.kpiDelta}>Tracked stock only</div>
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
            <span className={styles.filterCount}>
              {invStatus === 'loading'
                ? 'Loading inventory…'
                : invStatus === 'error'
                  ? `Could not load inventory — ${invError ?? 'unknown error'}`
                  : selected.size > 0
                    ? `${selected.size} selected`
                    : `${filtered.length} of ${rows.length}`}
            </span>
            {invStatus === 'error' && (
              <button className={styles.filterBtn} onClick={load}>Retry</button>
            )}
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
                <th className={styles.checkCell}><input type="checkbox" checked={selected.size === filtered.filter((r) => r.trackInventory).length && filtered.some((r) => r.trackInventory)} onChange={() => setSelected(prev => prev.size === filtered.filter((r) => r.trackInventory).length ? new Set() : new Set(filtered.filter((r) => r.trackInventory).map(r => r.variantId)))} /></th>
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
              {invStatus === 'loading' && (
                <tr><td colSpan={10} className={styles.emptyState}>Loading inventory…</td></tr>
              )}
              {invStatus === 'error' && (
                <tr><td colSpan={10} className={styles.emptyState}>Could not load inventory — {invError ?? 'unknown error'}. <button type="button" onClick={load}>Retry</button></td></tr>
              )}
              {invStatus === 'ready' && filtered.map(row => (
                <tr key={row.variantId} className={`${styles.tableRow} ${selected.has(row.variantId) ? styles.tableRowSelected : ''}`}>
                  <td className={styles.checkCell}><input type="checkbox" disabled={!row.trackInventory} checked={selected.has(row.variantId)} onChange={() => toggleSelect(row)} /></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.product}</div>
                    <div style={{ fontSize: 11, color: '#5a6355', fontFamily: 'monospace' }}>{row.sku}{row.size ? ` · ${row.size}` : ''}{row.color ? ` · ${row.color}` : ''}</div>
                  </td>
                  <td>—</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>—</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.madeOnDemand ? '—' : row.onHand}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>—</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.madeOnDemand ? '—' : row.reorderPoint}</td>
                  <td><span className={styles.statusPill} data-status={statusOf(row)}>{statusOf(row)}</span></td>
                  <td className={styles.actionCell}><RowMenu items={rowMenuItems(row)} /></td>
                </tr>
              ))}
              {invStatus === 'ready' && filtered.length === 0 && <tr><td colSpan={10} className={styles.emptyState}>No inventory items match the current filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default InventoryView;
