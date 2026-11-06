'use client';

/**
 * Creatives — ad creative management. Uses shared AdList CSS.
 * Real bulk Archive/Duplicate/Delete + working editor with file upload.
 */
import { useRef, useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface CreativesScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Live' | 'In review' | 'Draft' | 'Archived';

interface Creative {
  id: string;
  name: string;
  type: 'Image' | 'Video' | 'Carousel' | 'Dynamic';
  campaign: string;
  format: string;
  status: Status;
}

const INITIAL: Creative[] = [
  { id: 'cr1', name: 'Holiday Tee — Hero Image', type: 'Image', campaign: 'Holiday Tee Launch', format: '1080×1080', status: 'Live' },
  { id: 'cr2', name: 'Mug Collection — Carousel', type: 'Carousel', campaign: 'Mug Collection Q4', format: '1080×1080', status: 'Live' },
  { id: 'cr3', name: 'Brand Video — 15s', type: 'Video', campaign: 'Brand Awareness', format: '1080×1920', status: 'Live' },
  { id: 'cr4', name: 'Crewneck — Lifestyle', type: 'Image', campaign: 'Holiday Crewneck', format: '1080×1080', status: 'In review' },
  { id: 'cr5', name: 'Retarget — Dynamic', type: 'Dynamic', campaign: 'Retarget', format: 'Auto', status: 'Live' },
  { id: 'cr6', name: 'Black Friday — Teaser', type: 'Video', campaign: 'Black Friday', format: '1080×1920', status: 'Draft' },
];

const TYPE_ICON: Record<Creative['type'], string> = { Image: 'image', Video: 'movie', Carousel: 'view_carousel', Dynamic: 'auto_awesome' };
const TABS = [{ id: 'all', label: 'All' }, { id: 'live', label: 'Live' }, { id: 'inreview', label: 'In Review' }, { id: 'draft', label: 'Drafts' }, { id: 'archived', label: 'Archived' }];

function pill(s: Status) {
  switch (s) {
    case 'Live': return <span className={`${styles.pill} ${styles.pillGreen}`}>Live</span>;
    case 'In review': return <span className={`${styles.pill} ${styles.pillOrange}`}>In review</span>;
    case 'Draft': return <span className={`${styles.pill} ${styles.pillBlue}`}>Draft</span>;
    case 'Archived': return <span className={`${styles.pill} ${styles.pillGray}`}>Archived</span>;
  }
}

const EMPTY = { name: '', type: 'Image', campaign: 'Holiday Tee Launch', fileName: '' };

export default function CreativesScreen({ onToast }: CreativesScreenProps) {
  const [items, setItems] = useState<Creative[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Creative | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((c) => {
    const tabId = c.status.toLowerCase().replace(' ', '');
    const tabMatch = activeTab === 'all' || tabId === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || c.name.toLowerCase().includes(s) || c.campaign.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((c) => selected.has(c.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((c) => c.id))); };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Creative' }, { key: 'type', label: 'Type' }, { key: 'campaign', label: 'Campaign' }, { key: 'format', label: 'Format' }, { key: 'status', label: 'Status' }], 'creatives');
    onToast(`Exported ${filtered.length} creatives.`);
  };

  const dup = (c: Creative) => { const copy = { ...c, id: `cr${Date.now()}`, name: `${c.name} (copy)`, status: 'Draft' as Status }; setItems((p) => [copy, ...p]); setPeek(null); onToast(`Duplicated "${c.name}".`); };
  const del = (c: Creative) => { setItems((p) => p.filter((x) => x.id !== c.id)); setPeek(null); setSelected((p) => { const n = new Set(p); n.delete(c.id); return n; }); onToast(`Deleted "${c.name}".`); };
  const archive = (c: Creative) => { setItems((p) => p.map((x) => x.id === c.id ? { ...x, status: 'Archived' } : x)); setPeek(null); onToast(`Archived "${c.name}".`); };

  const bulkArchive = () => { setItems((p) => p.map((c) => selected.has(c.id) ? { ...c, status: 'Archived' } : c)); onToast(`Archived ${selected.size} creative${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDup = () => { const copies = items.filter((c) => selected.has(c.id)).map((c) => ({ ...c, id: `cr${Date.now()}-${c.id}`, name: `${c.name} (copy)`, status: 'Draft' as Status })); setItems((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} creative${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDel = () => { setItems((p) => p.filter((c) => !selected.has(c.id))); onToast(`Deleted ${selected.size} creative${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (c: Creative) => { setEditId(c.id); setForm({ name: c.name, type: c.type, campaign: c.campaign, fileName: '' }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim()) { onToast('Creative name is required.'); return; }
    if (editId) {
      setItems((p) => p.map((c) => c.id === editId ? { ...c, name: form.name, type: form.type as Creative['type'], campaign: form.campaign } : c));
      onToast(`Creative "${form.name}" saved.`);
    } else {
      const nc: Creative = { id: `cr${Date.now()}`, name: form.name, type: form.type as Creative['type'], campaign: form.campaign, format: form.type === 'Video' ? '1080×1920' : '1080×1080', status: 'Draft' };
      setItems((p) => [nc, ...p]);
      onToast(`Creative "${form.name}" created.`);
    }
    setEditorOpen(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Creatives</h1>
          <p className={styles.toolbarSub}>Manage ad creatives — images, videos, carousels, and dynamic ads.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New creative</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}<span className={styles.tabCount}>{t.id === 'all' ? items.length : items.filter((c) => c.status.toLowerCase().replace(' ', '') === t.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search creatives…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
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
            <div className={styles.empty}><span className="material-symbols-outlined">image</span><h3>No creatives</h3><p>Adjust your filters or create a new creative.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))} onChange={toggleAll} /></th>
                <th>Creative</th><th>Type</th><th>Campaign</th><th>Format</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setPeek(c)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--mut)' }}>{TYPE_ICON[c.type]}</span><strong>{c.name}</strong></div></td>
                    <td>{c.type}</td>
                    <td style={{ color: 'var(--mut)' }}>{c.campaign}</td>
                    <td style={{ color: 'var(--mut)' }}>{c.format}</td>
                    <td>{pill(c.status)}</td>
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
                  <p className={styles.peekHeadSub}>{peek.campaign}</p>
                </div>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Type</span><span className={styles.peekValue}>{peek.type}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Campaign</span><span className={styles.peekValue}>{peek.campaign}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Format</span><span className={styles.peekValue}>{peek.format}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Creative ID</span><span className={styles.peekValue}>{peek.id}</span></div>
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
              <h2>{editId ? 'Edit creative' : 'New creative'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Creative details</span>
                <div className={styles.field}><label className={styles.label}>Creative name</label><input className={styles.input} type="text" placeholder="e.g. Holiday Tee — Hero Image" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Type</label><select className={styles.select} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}><option>Image</option><option>Video</option><option>Carousel</option><option>Dynamic</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Campaign</label><select className={styles.select} value={form.campaign} onChange={(e) => setForm((p) => ({ ...p, campaign: e.target.value }))}><option>Holiday Tee Launch</option><option>Mug Collection Q4</option><option>Brand Awareness</option><option>Retarget</option><option>Black Friday</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Upload</span>
                <div className={styles.field}>
                  {form.fileName && <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--pri)' }}>attach_file</span>{form.fileName}</div>}
                  <div style={{ border: '1px dashed var(--line)', borderRadius: 8, background: 'var(--lo)', padding: 20, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setForm((p) => ({ ...p, fileName: f.name })); onToast(`Attached ${f.name}.`); } }} />
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--pri)' }}>cloud_upload</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>Drop creative here or browse</div>
                    <div style={{ fontSize: 11, color: 'var(--mut)' }}>JPG, PNG, MP4 · Max 30 MB</div>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Create creative'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
