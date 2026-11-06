'use client';

/**
 * Ad Spend & Finance Bridge — reconcile ad spend with accounting ledger.
 * Uses shared AdList CSS. Working map-to-CoA modal that actually maps entries.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface AdSpendScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

interface SpendEntry {
  id: string;
  date: string;
  network: 'Meta' | 'TikTok' | 'Google';
  campaign: string;
  amount: string;
  coa: string;
  status: 'Mapped' | 'Unmapped';
}

const INITIAL: SpendEntry[] = [
  { id: 's1', date: 'Nov 1', network: 'Meta', campaign: 'Holiday Tee Launch', amount: '$50.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { id: 's2', date: 'Nov 1', network: 'TikTok', campaign: 'Brand Awareness', amount: '$40.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { id: 's3', date: 'Oct 31', network: 'Meta', campaign: 'Mug Collection Q4', amount: '$30.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { id: 's4', date: 'Oct 31', network: 'Google', campaign: 'Google Search — Brand', amount: '$15.00', coa: '—', status: 'Unmapped' },
  { id: 's5', date: 'Oct 30', network: 'Meta', campaign: 'Retarget', amount: '$15.00', coa: 'Advertising — Digital', status: 'Mapped' },
];

const NET_COLOR: Record<string, string> = { Meta: '#0077c5', TikTok: '#010101', Google: '#1e5a38' };
const COA_OPTIONS = ['Advertising — Digital', 'Advertising — Social Media', 'Marketing — General', 'Uncategorized'];

export default function AdSpendScreen({ onToast, onNavigate }: AdSpendScreenProps) {
  const [items, setItems] = useState<SpendEntry[]>(INITIAL);
  const [search, setSearch] = useState('');
  const [peek, setPeek] = useState<SpendEntry | null>(null);
  const [mapEntry, setMapEntry] = useState<SpendEntry | null>(null);
  const [mapCoa, setMapCoa] = useState(COA_OPTIONS[0]);

  const filtered = items.filter((s) => !search || s.campaign.toLowerCase().includes(search.toLowerCase()) || s.network.toLowerCase().includes(search.toLowerCase()));

  const unmappedCount = items.filter((s) => s.status === 'Unmapped').length;

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'date', label: 'Date' }, { key: 'network', label: 'Network' }, { key: 'campaign', label: 'Campaign' }, { key: 'amount', label: 'Amount' }, { key: 'coa', label: 'Chart of Accounts' }, { key: 'status', label: 'Status' }], 'ad-spend');
    onToast(`Exported ${filtered.length} entries.`);
  };

  const openMap = (entry: SpendEntry) => { setMapEntry(entry); setMapCoa(entry.coa !== '—' ? entry.coa : COA_OPTIONS[0]); setPeek(null); };
  const confirmMap = () => {
    if (!mapEntry) return;
    setItems((prev) => prev.map((s) => s.id === mapEntry.id ? { ...s, coa: mapCoa, status: 'Mapped' } : s));
    onToast(`Mapped "${mapEntry.campaign}" to ${mapCoa}.`);
    setMapEntry(null);
  };

  const mapAllUnmapped = () => {
    const first = items.find((s) => s.status === 'Unmapped');
    if (!first) { onToast('No unmapped entries to map.'); return; }
    setMapEntry(first);
    setMapCoa(COA_OPTIONS[0]);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Ad Spend &amp; Finance Bridge</h1>
          <p className={styles.toolbarSub}>Reconcile ad spend with your accounting ledger.</p>
        </div>
        <div className={styles.toolbarRight}>
          {unmappedCount > 0 && <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={mapAllUnmapped}><span className="material-symbols-outlined">link</span> Map {unmappedCount} unmapped</button>}
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('finance', 'coa')}><span className="material-symbols-outlined">account_balance</span> Chart of Accounts</button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('finance', 'reconcile')}><span className="material-symbols-outlined">sync</span> Reconcile</button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search spend entries…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">account_balance_wallet</span><h3>No spend entries</h3><p>Adjust your filters or wait for new ad invoices.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Date</th><th>Network</th><th>Campaign</th><th className={styles.right}>Amount</th><th>Chart of Accounts</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => setPeek(s)}>
                    <td style={{ color: 'var(--mut)' }}>{s.date}</td>
                    <td><span className={styles.netDot} style={{ background: NET_COLOR[s.network] }} />{s.network}</td>
                    <td><strong>{s.campaign}</strong></td>
                    <td className={styles.right}>{s.amount}</td>
                    <td style={{ color: s.status === 'Unmapped' ? 'var(--warn)' : 'var(--mut)' }}>{s.coa}</td>
                    <td>{s.status === 'Mapped' ? <span className={`${styles.pill} ${styles.pillGreen}`}>Mapped</span> : <span className={`${styles.pill} ${styles.pillOrange}`}>Unmapped</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {peek && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeek(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peek.campaign}</h3>
                <p className={styles.peekHeadSub}><span className={styles.netDot} style={{ background: NET_COLOR[peek.network] }} />{peek.network} · {peek.date}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{peek.status === 'Mapped' ? <span className={`${styles.pill} ${styles.pillGreen}`}>Mapped</span> : <span className={`${styles.pill} ${styles.pillOrange}`}>Unmapped</span>}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Date</span><span className={styles.peekValue}>{peek.date}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Network</span><span className={styles.peekValue}>{peek.network}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Campaign</span><span className={styles.peekValue}>{peek.campaign}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Amount</span><span className={styles.peekValue}>{peek.amount}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Chart of Accounts</span><span className={styles.peekValue}>{peek.coa}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Entry ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              {peek.status === 'Unmapped' && <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openMap(peek)}><span className="material-symbols-outlined">link</span> Map to CoA</button>}
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('finance', 'reconcile')}><span className="material-symbols-outlined">sync</span> View in reconcile</button>
            </div>
          </div>
        </>
      )}

      {mapEntry && (
        <div className={styles.modalScrim} onClick={() => setMapEntry(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Map to Chart of Accounts</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setMapEntry(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}><label className={styles.label}>Spend entry</label><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{mapEntry.campaign}</div><div style={{ fontSize: 11, color: 'var(--mut)' }}>{mapEntry.date} · {mapEntry.network} · {mapEntry.amount}</div></div>
              <div className={styles.field}><label className={styles.label}>Chart of Accounts account</label><select className={styles.select} value={mapCoa} onChange={(e) => setMapCoa(e.target.value)}>{COA_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setMapEntry(null)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={confirmMap}><span className="material-symbols-outlined">link</span> Map</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
