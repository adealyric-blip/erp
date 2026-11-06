'use client';

/**
 * Pixels — tracking pixel management. Uses shared AdList CSS.
 * Real Add pixel editor + self-test modal with per-event results.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface PixelsScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Live' | 'Paused' | 'Error';

interface Pixel {
  id: string;
  name: string;
  pixelId: string;
  network: 'Meta' | 'TikTok' | 'Google' | 'Pinterest';
  events: string;
  lastFired: string;
  status: Status;
}

const INITIAL: Pixel[] = [
  { id: 'px1', name: 'Meta Pixel', pixelId: '892345678901234', network: 'Meta', events: 'PageView, ViewContent, AddToCart, Purchase', lastFired: '2 min ago', status: 'Live' },
  { id: 'px2', name: 'TikTok Pixel', pixelId: 'C8K9M2N7P4Q1R6S3', network: 'TikTok', events: 'ViewContent, AddToCart, CompletePayment', lastFired: '15 min ago', status: 'Live' },
  { id: 'px3', name: 'Google Ads Tag', pixelId: 'AW-CONV-12345', network: 'Google', events: 'Purchase, Lead', lastFired: '1 hour ago', status: 'Paused' },
  { id: 'px4', name: 'Pinterest Tag', pixelId: 'PIN-TAG-98765', network: 'Pinterest', events: 'PageVisit, AddToCart', lastFired: '3 hours ago', status: 'Error' },
];

const NET_COLOR: Record<string, string> = { Meta: '#0077c5', TikTok: '#010101', Google: '#1e5a38', Pinterest: '#bd081c' };
const TEST_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'Purchase'];

function pill(s: Status) {
  switch (s) {
    case 'Live': return <span className={`${styles.pill} ${styles.pillGreen}`}>Live</span>;
    case 'Paused': return <span className={`${styles.pill} ${styles.pillGray}`}>Paused</span>;
    case 'Error': return <span className={`${styles.pill} ${styles.pillRed}`}>Error</span>;
  }
}

const EMPTY = { name: '', network: 'Meta', pixelId: '' };

export default function PixelsScreen({ onToast }: PixelsScreenProps) {
  const [items, setItems] = useState<Pixel[]>(INITIAL);
  const [search, setSearch] = useState('');
  const [peek, setPeek] = useState<Pixel | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [testPixel, setTestPixel] = useState<Pixel | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'passed' | 'failed'> | null>(null);

  const filtered = items.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.network.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Pixel' }, { key: 'pixelId', label: 'Pixel ID' }, { key: 'network', label: 'Network' }, { key: 'events', label: 'Tracked events' }, { key: 'lastFired', label: 'Last fired' }, { key: 'status', label: 'Status' }], 'pixels');
    onToast(`Exported ${filtered.length} pixels.`);
  };

  const del = (p: Pixel) => { setItems((prev) => prev.filter((x) => x.id !== p.id)); setPeek(null); onToast(`Deleted "${p.name}".`); };
  const toggleStatus = (p: Pixel) => { const ns: Status = p.status === 'Live' ? 'Paused' : 'Live'; setItems((prev) => prev.map((x) => x.id === p.id ? { ...x, status: ns } : x)); setPeek(null); onToast(`"${p.name}" ${ns === 'Live' ? 'resumed' : 'paused'}.`); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (p: Pixel) => { setEditId(p.id); setForm({ name: p.name, network: p.network, pixelId: p.pixelId }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim() || !form.pixelId.trim()) { onToast('Pixel name and ID are required.'); return; }
    if (editId) {
      setItems((prev) => prev.map((p) => p.id === editId ? { ...p, name: form.name, network: form.network as Pixel['network'], pixelId: form.pixelId } : p));
      onToast(`Pixel "${form.name}" saved.`);
    } else {
      const np: Pixel = { id: `px${Date.now()}`, name: form.name, network: form.network as Pixel['network'], pixelId: form.pixelId, events: 'PageView', lastFired: '—', status: 'Live' };
      setItems((prev) => [np, ...prev]);
      onToast(`Pixel "${form.name}" added.`);
    }
    setEditorOpen(false);
  };

  const runTest = (p: Pixel) => {
    setPeek(null);
    setTestPixel(p);
    setTestResults(null);
    setTimeout(() => {
      const results: Record<string, 'passed' | 'failed'> = {};
      TEST_EVENTS.forEach((ev) => { results[ev] = p.status === 'Error' && ev === 'AddToCart' ? 'failed' : 'passed'; });
      setTestResults(results);
      onToast(`Self-test complete for ${p.name}.`);
    }, 800);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Pixels</h1>
          <p className={styles.toolbarSub}>Manage tracking pixels for conversion attribution.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> Add pixel</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search pixels…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">code</span><h3>No pixels</h3><p>Add a tracking pixel to get started.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Pixel</th><th>Pixel ID</th><th>Network</th><th>Tracked events</th><th>Last fired</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => setPeek(p)}>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--mut)' }}>{p.pixelId}</td>
                    <td><span className={styles.netDot} style={{ background: NET_COLOR[p.network] }} />{p.network}</td>
                    <td style={{ color: 'var(--mut)', fontSize: 12 }}>{p.events}</td>
                    <td style={{ color: 'var(--mut)' }}>{p.lastFired}</td>
                    <td>{pill(p.status)}</td>
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
                <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                <p className={styles.peekHeadSub}><span className={styles.netDot} style={{ background: NET_COLOR[peek.network] }} />{peek.network}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Pixel ID</span><span className={styles.peekValue} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{peek.pixelId}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Network</span><span className={styles.peekValue}>{peek.network}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Tracked events</span><span className={styles.peekValue} style={{ fontSize: 11 }}>{peek.events}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Last fired</span><span className={styles.peekValue}>{peek.lastFired}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => toggleStatus(peek)}><span className="material-symbols-outlined">{peek.status === 'Live' ? 'pause' : 'play_arrow'}</span> {peek.status === 'Live' ? 'Pause' : 'Resume'}</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => runTest(peek)}><span className="material-symbols-outlined">bug_report</span> Self-test</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openEdit(peek)}><span className="material-symbols-outlined">edit</span> Edit</button>
            </div>
          </div>
        </>
      )}

      {editorOpen && (
        <>
          <div className={styles.editorScrim} onClick={() => setEditorOpen(false)} />
          <div className={styles.editorDrawer}>
            <div className={styles.editorHead}>
              <h2>{editId ? 'Edit pixel' : 'Add pixel'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Pixel details</span>
                <div className={styles.field}><label className={styles.label}>Pixel name</label><input className={styles.input} type="text" placeholder="e.g. Meta Pixel" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Network</label><select className={styles.select} value={form.network} onChange={(e) => setForm((p) => ({ ...p, network: e.target.value }))}><option>Meta</option><option>TikTok</option><option>Google</option><option>Pinterest</option><option>LinkedIn</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Pixel ID</label><input className={styles.input} type="text" placeholder="e.g. 892345678901234" value={form.pixelId} onChange={(e) => setForm((p) => ({ ...p, pixelId: e.target.value }))} /></div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Add pixel'}</button>
            </div>
          </div>
        </>
      )}

      {testPixel && (
        <div className={styles.modalScrim} onClick={() => { setTestPixel(null); setTestResults(null); }}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Self-test: {testPixel.name}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => { setTestPixel(null); setTestResults(null); }}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {testResults === null ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--mut)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>Firing test events…</p>
                </div>
              ) : (
                TEST_EVENTS.map((ev) => (
                  <div key={ev} className={styles.testRow}>
                    <span className={styles.testName}>{ev}</span>
                    {testResults[ev] === 'passed'
                      ? <span className={`${styles.pill} ${styles.pillGreen}`}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span> Passed</span>
                      : <span className={`${styles.pill} ${styles.pillRed}`}><span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span> Failed</span>}
                  </div>
                ))
              )}
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => { setTestPixel(null); setTestResults(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
