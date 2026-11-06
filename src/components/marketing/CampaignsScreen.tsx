'use client';

/**
 * Campaigns — advertising campaigns list.
 * Minimalist rebuild using shared AdList CSS. Real bulk actions + working editor.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface CampaignsScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Active' | 'Paused' | 'Draft' | 'Archived';

interface Campaign {
  id: string;
  name: string;
  network: 'Meta' | 'TikTok' | 'Google';
  objective: string;
  spend: string;
  roas: string;
  impressions: string;
  clicks: string;
  status: Status;
}

const INITIAL: Campaign[] = [
  { id: 'c1', name: 'Holiday Tee Launch', network: 'Meta', objective: 'Conversions', spend: '$1,240', roas: '4.2x', impressions: '45.2K', clicks: '1,402', status: 'Active' },
  { id: 'c2', name: 'Mug Collection Q4', network: 'Meta', objective: 'Conversions', spend: '$860', roas: '3.8x', impressions: '32.1K', clicks: '890', status: 'Active' },
  { id: 'c3', name: 'Brand Awareness — TikTok', network: 'TikTok', objective: 'Reach', spend: '$680', roas: '2.1x', impressions: '120K', clicks: '2,280', status: 'Active' },
  { id: 'c4', name: 'Holiday Crewneck', network: 'Meta', objective: 'Conversions', spend: '$420', roas: '5.1x', impressions: '18.5K', clicks: '668', status: 'Paused' },
  { id: 'c5', name: 'Retarget — Cart abandoners', network: 'Meta', objective: 'Conversions', spend: '$340', roas: '6.2x', impressions: '8.2K', clicks: '412', status: 'Active' },
  { id: 'c6', name: 'Google Search — Brand', network: 'Google', objective: 'Traffic', spend: '$280', roas: '3.4x', impressions: '12.4K', clicks: '480', status: 'Active' },
  { id: 'c7', name: 'Black Friday Teaser', network: 'TikTok', objective: 'Reach', spend: '$180', roas: '1.8x', impressions: '55K', clicks: '990', status: 'Draft' },
  { id: 'c8', name: 'Lookalike — Holiday Buyers', network: 'Meta', objective: 'Conversions', spend: '$0', roas: '—', impressions: '0', clicks: '0', status: 'Draft' },
];

const NET_COLOR: Record<string, string> = { Meta: '#0077c5', TikTok: '#010101', Google: '#1e5a38' };
const TABS = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }, { id: 'draft', label: 'Drafts' }, { id: 'archived', label: 'Archived' }];

function pill(s: Status) {
  switch (s) {
    case 'Active': return <span className={`${styles.pill} ${styles.pillGreen}`}>Active</span>;
    case 'Paused': return <span className={`${styles.pill} ${styles.pillGray}`}>Paused</span>;
    case 'Draft': return <span className={`${styles.pill} ${styles.pillBlue}`}>Draft</span>;
    case 'Archived': return <span className={`${styles.pill} ${styles.pillGray}`}>Archived</span>;
  }
}

const EMPTY = { name: '', network: 'Meta', objective: 'Conversions', dailyBudget: '', lifetimeBudget: '' };

export default function CampaignsScreen({ onToast }: CampaignsScreenProps) {
  const [items, setItems] = useState<Campaign[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Campaign | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = items.filter((c) => {
    const tabMatch = activeTab === 'all' || c.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || c.name.toLowerCase().includes(s) || c.network.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((c) => selected.has(c.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((c) => c.id))); };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Campaign' }, { key: 'network', label: 'Network' }, { key: 'objective', label: 'Objective' }, { key: 'spend', label: 'Spend' }, { key: 'roas', label: 'ROAS' }, { key: 'impressions', label: 'Impressions' }, { key: 'clicks', label: 'Clicks' }, { key: 'status', label: 'Status' }], 'campaigns');
    onToast(`Exported ${filtered.length} campaigns.`);
  };

  const setStatus = (c: Campaign, s: Status) => { setItems((p) => p.map((x) => x.id === c.id ? { ...x, status: s } : x)); setPeek(null); onToast(`"${c.name}" ${s === 'Active' ? 'resumed' : s.toLowerCase()}.`); };
  const dup = (c: Campaign) => { const copy = { ...c, id: `c${Date.now()}`, name: `${c.name} (copy)`, status: 'Draft' as Status, spend: '$0', roas: '—', impressions: '0', clicks: '0' }; setItems((p) => [copy, ...p]); setPeek(null); onToast(`Duplicated "${c.name}".`); };
  const del = (c: Campaign) => { setItems((p) => p.filter((x) => x.id !== c.id)); setPeek(null); setSelected((p) => { const n = new Set(p); n.delete(c.id); return n; }); onToast(`Deleted "${c.name}".`); };

  const bulkStatus = (s: Status) => { setItems((p) => p.map((c) => selected.has(c.id) ? { ...c, status: s } : c)); onToast(`${s === 'Active' ? 'Resumed' : s === 'Paused' ? 'Paused' : 'Archived'} ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDup = () => { const copies = items.filter((c) => selected.has(c.id)).map((c) => ({ ...c, id: `c${Date.now()}-${c.id}`, name: `${c.name} (copy)`, status: 'Draft' as Status, spend: '$0', roas: '—', impressions: '0', clicks: '0' })); setItems((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDel = () => { setItems((p) => p.filter((c) => !selected.has(c.id))); onToast(`Deleted ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (c: Campaign) => { setEditId(c.id); setForm({ name: c.name, network: c.network, objective: c.objective, dailyBudget: '', lifetimeBudget: '' }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim()) { onToast('Campaign name is required.'); return; }
    if (editId) {
      setItems((p) => p.map((c) => c.id === editId ? { ...c, name: form.name, network: form.network as Campaign['network'], objective: form.objective } : c));
      onToast(`Campaign "${form.name}" saved.`);
    } else {
      const nc: Campaign = { id: `c${Date.now()}`, name: form.name, network: form.network as Campaign['network'], objective: form.objective, spend: '$0', roas: '—', impressions: '0', clicks: '0', status: 'Draft' };
      setItems((p) => [nc, ...p]);
      onToast(`Campaign "${form.name}" created.`);
    }
    setEditorOpen(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Campaigns</h1>
          <p className={styles.toolbarSub}>Manage advertising campaigns across all networks.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New campaign</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}<span className={styles.tabCount}>{t.id === 'all' ? items.length : items.filter((c) => c.status.toLowerCase() === t.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => bulkStatus('Paused')}><span className="material-symbols-outlined">pause</span> Pause</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkStatus('Active')}><span className="material-symbols-outlined">play_arrow</span> Resume</button>
            <button type="button" className={styles.bulkAction} onClick={bulkDup}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkStatus('Archived')}><span className="material-symbols-outlined">archive</span> Archive</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={bulkDel}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">campaign</span><h3>No campaigns</h3><p>Adjust your filters or create a new campaign.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))} onChange={toggleAll} /></th>
                <th>Campaign</th><th>Network</th><th>Objective</th><th className={styles.right}>Spend</th><th className={styles.right}>ROAS</th><th className={styles.right}>Impressions</th><th className={styles.right}>Clicks</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setPeek(c)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td><strong>{c.name}</strong></td>
                    <td><span className={styles.netDot} style={{ background: NET_COLOR[c.network] }} />{c.network}</td>
                    <td style={{ color: 'var(--mut)' }}>{c.objective}</td>
                    <td className={styles.right}>{c.spend}</td>
                    <td className={`${styles.right} ${styles.roas}`}>{c.roas}</td>
                    <td className={styles.right}>{c.impressions}</td>
                    <td className={styles.right}>{c.clicks}</td>
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
              <div>
                <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                <p className={styles.peekHeadSub}><span className={styles.netDot} style={{ background: NET_COLOR[peek.network] }} />{peek.network} · {peek.objective}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Network</span><span className={styles.peekValue}>{peek.network}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Objective</span><span className={styles.peekValue}>{peek.objective}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Spend</span><span className={styles.peekValue}>{peek.spend}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>ROAS</span><span className={styles.peekValue} style={{ color: 'var(--ok)' }}>{peek.roas}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Impressions</span><span className={styles.peekValue}>{peek.impressions}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Clicks</span><span className={styles.peekValue}>{peek.clicks}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Campaign ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => dup(peek)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setStatus(peek, peek.status === 'Active' ? 'Paused' : 'Active')}><span className="material-symbols-outlined">{peek.status === 'Active' ? 'pause' : 'play_arrow'}</span> {peek.status === 'Active' ? 'Pause' : 'Resume'}</button>
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
              <h2>{editId ? 'Edit campaign' : 'New campaign'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Basics</span>
                <div className={styles.field}><label className={styles.label}>Campaign name</label><input className={styles.input} type="text" placeholder="e.g. Holiday Tee Launch" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Network</label><select className={styles.select} value={form.network} onChange={(e) => setForm((p) => ({ ...p, network: e.target.value }))}><option>Meta</option><option>TikTok</option><option>Google</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Objective</label><select className={styles.select} value={form.objective} onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))}><option>Conversions</option><option>Reach</option><option>Traffic</option><option>Brand awareness</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Budget</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Daily budget ($)</label><input className={styles.input} type="number" placeholder="50" value={form.dailyBudget} onChange={(e) => setForm((p) => ({ ...p, dailyBudget: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Lifetime budget ($)</label><input className={styles.input} type="number" placeholder="1000" value={form.lifetimeBudget} onChange={(e) => setForm((p) => ({ ...p, lifetimeBudget: e.target.value }))} /></div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Create campaign'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
