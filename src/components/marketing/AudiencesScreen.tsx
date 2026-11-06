'use client';

/**
 * Audiences — custom, lookalike, retargeting audience management.
 * Uses shared AdList CSS. Real bulk Archive/Duplicate/Delete + working editor.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface AudiencesScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Ready' | 'Building' | 'Archived';

interface Audience {
  id: string;
  name: string;
  type: 'Lookalike' | 'Retargeting' | 'Engagement' | 'Custom' | 'Saved';
  source: string;
  size: string;
  status: Status;
}

const INITIAL: Audience[] = [
  { id: 'au1', name: 'Lookalike — Holiday Buyers 1%', type: 'Lookalike', source: 'Purchase event', size: '2.4M', status: 'Ready' },
  { id: 'au2', name: 'Retarget — Cart abandoners 30d', type: 'Retargeting', source: 'Add to cart', size: '12.4K', status: 'Ready' },
  { id: 'au3', name: 'Engaged — Video viewers 50%', type: 'Engagement', source: 'Video view', size: '89K', status: 'Ready' },
  { id: 'au4', name: 'Lookalike — Email subscribers', type: 'Lookalike', source: 'Email list upload', size: '1.8M', status: 'Building' },
  { id: 'au5', name: 'Custom — Past purchasers 90d', type: 'Custom', source: 'Purchase event', size: '8.2K', status: 'Ready' },
  { id: 'au6', name: 'Broad — US 18-35', type: 'Saved', source: 'Demographic', size: '120M', status: 'Ready' },
];

const TYPE_ICON: Record<Audience['type'], string> = { Lookalike: 'group_work', Retargeting: 'replay', Engagement: 'visibility', Custom: 'group', Saved: 'bookmark' };
const TABS = [{ id: 'all', label: 'All' }, { id: 'ready', label: 'Ready' }, { id: 'building', label: 'Building' }, { id: 'archived', label: 'Archived' }];

function pill(s: Status) {
  switch (s) {
    case 'Ready': return <span className={`${styles.pill} ${styles.pillGreen}`}>Ready</span>;
    case 'Building': return <span className={`${styles.pill} ${styles.pillOrange}`}>Building</span>;
    case 'Archived': return <span className={`${styles.pill} ${styles.pillGray}`}>Archived</span>;
  }
}

const EMPTY = { name: '', type: 'Custom', source: 'Purchase event', similarity: '1', country: 'United States' };

export default function AudiencesScreen({ onToast }: AudiencesScreenProps) {
  const [items, setItems] = useState<Audience[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Audience | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = items.filter((a) => {
    const tabMatch = activeTab === 'all' || a.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || a.name.toLowerCase().includes(s) || a.type.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((a) => selected.has(a.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((a) => a.id))); };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Audience' }, { key: 'type', label: 'Type' }, { key: 'source', label: 'Source' }, { key: 'size', label: 'Size' }, { key: 'status', label: 'Status' }], 'audiences');
    onToast(`Exported ${filtered.length} audiences.`);
  };

  const dup = (a: Audience) => { const copy = { ...a, id: `au${Date.now()}`, name: `${a.name} (copy)`, status: 'Building' as Status }; setItems((p) => [copy, ...p]); setPeek(null); onToast(`Duplicated "${a.name}".`); };
  const del = (a: Audience) => { setItems((p) => p.filter((x) => x.id !== a.id)); setPeek(null); setSelected((p) => { const n = new Set(p); n.delete(a.id); return n; }); onToast(`Deleted "${a.name}".`); };
  const archive = (a: Audience) => { setItems((p) => p.map((x) => x.id === a.id ? { ...x, status: 'Archived' } : x)); setPeek(null); onToast(`Archived "${a.name}".`); };

  const bulkArchive = () => { setItems((p) => p.map((a) => selected.has(a.id) ? { ...a, status: 'Archived' } : a)); onToast(`Archived ${selected.size} audience${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDup = () => { const copies = items.filter((a) => selected.has(a.id)).map((a) => ({ ...a, id: `au${Date.now()}-${a.id}`, name: `${a.name} (copy)`, status: 'Building' as Status })); setItems((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} audience${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDel = () => { setItems((p) => p.filter((a) => !selected.has(a.id))); onToast(`Deleted ${selected.size} audience${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (a: Audience) => { setEditId(a.id); setForm({ name: a.name, type: a.type, source: a.source, similarity: '1', country: 'United States' }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim()) { onToast('Audience name is required.'); return; }
    if (editId) {
      setItems((p) => p.map((a) => a.id === editId ? { ...a, name: form.name, type: form.type as Audience['type'], source: form.source } : a));
      onToast(`Audience "${form.name}" saved.`);
    } else {
      const na: Audience = { id: `au${Date.now()}`, name: form.name, type: form.type as Audience['type'], source: form.source, size: '—', status: 'Building' };
      setItems((p) => [na, ...p]);
      onToast(`Audience "${form.name}" created (building).`);
    }
    setEditorOpen(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Audiences</h1>
          <p className={styles.toolbarSub}>Manage custom, lookalike, and retargeting audiences.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New audience</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}<span className={styles.tabCount}>{t.id === 'all' ? items.length : items.filter((a) => a.status.toLowerCase() === t.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search audiences…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={bulkDup}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={styles.bulkAction} onClick={bulkArchive}><span className="material-symbols-outlined">archive</span> Archive</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={bulkDel}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">group</span><h3>No audiences</h3><p>Adjust your filters or create a new audience.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((a) => selected.has(a.id))} onChange={toggleAll} /></th>
                <th>Audience</th><th>Type</th><th>Source</th><th className={styles.right}>Size</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} onClick={() => setPeek(a)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--mut)' }}>{TYPE_ICON[a.type]}</span><strong>{a.name}</strong></div></td>
                    <td>{a.type}</td>
                    <td style={{ color: 'var(--mut)' }}>{a.source}</td>
                    <td className={styles.right}>{a.size}</td>
                    <td>{pill(a.status)}</td>
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--mut)' }}>{TYPE_ICON[peek.type]}</span>
                <div>
                  <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                  <p className={styles.peekHeadSub}>{peek.type}</p>
                </div>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Type</span><span className={styles.peekValue}>{peek.type}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Source</span><span className={styles.peekValue}>{peek.source}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Size</span><span className={styles.peekValue}>{peek.size}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Audience ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => archive(peek)}><span className="material-symbols-outlined">archive</span> Archive</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => dup(peek)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
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
              <h2>{editId ? 'Edit audience' : 'New audience'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Audience details</span>
                <div className={styles.field}><label className={styles.label}>Audience name</label><input className={styles.input} type="text" placeholder="e.g. Lookalike — Holiday Buyers" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Type</label><select className={styles.select} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}><option>Custom</option><option>Lookalike</option><option>Retargeting</option><option>Engagement</option><option>Saved</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Source</label><select className={styles.select} value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}><option>Purchase event</option><option>Add to cart</option><option>Video view</option><option>Email list upload</option><option>Demographic</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Lookalike config</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Similarity (%)</label><input className={styles.input} type="number" value={form.similarity} onChange={(e) => setForm((p) => ({ ...p, similarity: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Target country</label><select className={styles.select} value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}><option>United States</option><option>Canada</option><option>United Kingdom</option></select></div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Create audience'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
