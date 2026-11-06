'use client';

/**
 * Ad Sets — minimalist management. Uses shared AdList CSS.
 * Real bulk Pause/Resume/Duplicate/Delete + working editor.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface AdSetsScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Active' | 'Paused' | 'Draft';

interface AdSet {
  id: string;
  name: string;
  campaign: string;
  network: 'Meta' | 'TikTok' | 'Google';
  budget: string;
  spend: string;
  roas: string;
  status: Status;
}

const INITIAL: AdSet[] = [
  { id: 'a1', name: 'Holiday Tee — Lookalike 1%', campaign: 'Holiday Tee Launch', network: 'Meta', budget: '$50/day', spend: '$1,240', roas: '4.2x', status: 'Active' },
  { id: 'a2', name: 'Mug — Retarget cart', campaign: 'Mug Collection Q4', network: 'Meta', budget: '$30/day', spend: '$860', roas: '3.8x', status: 'Active' },
  { id: 'a3', name: 'TikTok — Broad reach', campaign: 'Brand Awareness', network: 'TikTok', budget: '$40/day', spend: '$680', roas: '2.1x', status: 'Active' },
  { id: 'a4', name: 'Crewneck — Broad', campaign: 'Holiday Crewneck', network: 'Meta', budget: '$20/day', spend: '$420', roas: '5.1x', status: 'Paused' },
  { id: 'a5', name: 'Retarget — abandoners', campaign: 'Retarget', network: 'Meta', budget: '$15/day', spend: '$340', roas: '6.2x', status: 'Active' },
];

const NET_COLOR: Record<string, string> = { Meta: '#0077c5', TikTok: '#010101', Google: '#1e5a38' };
const TABS = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }, { id: 'draft', label: 'Drafts' }];

function pill(s: Status) {
  switch (s) {
    case 'Active': return <span className={`${styles.pill} ${styles.pillGreen}`}>Active</span>;
    case 'Paused': return <span className={`${styles.pill} ${styles.pillGray}`}>Paused</span>;
    case 'Draft': return <span className={`${styles.pill} ${styles.pillBlue}`}>Draft</span>;
  }
}

const EMPTY = { name: '', campaign: 'Holiday Tee Launch', network: 'Meta', dailyBudget: '', bid: 'Lowest cost', placement: 'Automatic placements' };

export default function AdSetsScreen({ onToast }: AdSetsScreenProps) {
  const [items, setItems] = useState<AdSet[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<AdSet | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  const filtered = items.filter((a) => {
    const tabMatch = activeTab === 'all' || a.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || a.name.toLowerCase().includes(s) || a.campaign.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((a) => selected.has(a.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((a) => a.id))); };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Ad set' }, { key: 'campaign', label: 'Campaign' }, { key: 'network', label: 'Network' }, { key: 'budget', label: 'Budget' }, { key: 'spend', label: 'Spend' }, { key: 'roas', label: 'ROAS' }, { key: 'status', label: 'Status' }], 'ad-sets');
    onToast(`Exported ${filtered.length} ad sets.`);
  };

  const setStatus = (a: AdSet, s: Status) => { setItems((p) => p.map((x) => x.id === a.id ? { ...x, status: s } : x)); setPeek(null); onToast(`"${a.name}" ${s === 'Active' ? 'resumed' : s.toLowerCase()}.`); };
  const dup = (a: AdSet) => { const copy = { ...a, id: `a${Date.now()}`, name: `${a.name} (copy)`, status: 'Draft' as Status, spend: '$0', roas: '—' }; setItems((p) => [copy, ...p]); setPeek(null); onToast(`Duplicated "${a.name}".`); };
  const del = (a: AdSet) => { setItems((p) => p.filter((x) => x.id !== a.id)); setPeek(null); setSelected((p) => { const n = new Set(p); n.delete(a.id); return n; }); onToast(`Deleted "${a.name}".`); };

  const bulkStatus = (s: Status) => { setItems((p) => p.map((a) => selected.has(a.id) ? { ...a, status: s } : a)); onToast(`${s === 'Active' ? 'Resumed' : 'Paused'} ${selected.size} ad set${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDup = () => { const copies = items.filter((a) => selected.has(a.id)).map((a) => ({ ...a, id: `a${Date.now()}-${a.id}`, name: `${a.name} (copy)`, status: 'Draft' as Status, spend: '$0', roas: '—' })); setItems((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} ad set${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };
  const bulkDel = () => { setItems((p) => p.filter((a) => !selected.has(a.id))); onToast(`Deleted ${selected.size} ad set${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (a: AdSet) => { setEditId(a.id); setForm({ name: a.name, campaign: a.campaign, network: a.network, dailyBudget: a.budget.replace('/day', '').replace('$', ''), bid: 'Lowest cost', placement: 'Automatic placements' }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim()) { onToast('Ad set name is required.'); return; }
    const budget = form.dailyBudget ? `$${form.dailyBudget}/day` : '—';
    if (editId) {
      setItems((p) => p.map((a) => a.id === editId ? { ...a, name: form.name, campaign: form.campaign, network: form.network as AdSet['network'], budget } : a));
      onToast(`Ad set "${form.name}" saved.`);
    } else {
      const na: AdSet = { id: `a${Date.now()}`, name: form.name, campaign: form.campaign, network: form.network as AdSet['network'], budget, spend: '$0', roas: '—', status: 'Draft' };
      setItems((p) => [na, ...p]);
      onToast(`Ad set "${form.name}" created.`);
    }
    setEditorOpen(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Ad Sets</h1>
          <p className={styles.toolbarSub}>Manage ad set budgets, placements, and bidding.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New ad set</button>
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
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search ad sets…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => bulkStatus('Paused')}><span className="material-symbols-outlined">pause</span> Pause</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkStatus('Active')}><span className="material-symbols-outlined">play_arrow</span> Resume</button>
            <button type="button" className={styles.bulkAction} onClick={bulkDup}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={bulkDel}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">tune</span><h3>No ad sets</h3><p>Adjust your filters or create a new ad set.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((a) => selected.has(a.id))} onChange={toggleAll} /></th>
                <th>Ad set</th><th>Campaign</th><th>Network</th><th className={styles.right}>Budget</th><th className={styles.right}>Spend</th><th className={styles.right}>ROAS</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} onClick={() => setPeek(a)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} /></td>
                    <td><strong>{a.name}</strong></td>
                    <td style={{ color: 'var(--mut)' }}>{a.campaign}</td>
                    <td><span className={styles.netDot} style={{ background: NET_COLOR[a.network] }} />{a.network}</td>
                    <td className={styles.right}>{a.budget}</td>
                    <td className={styles.right}>{a.spend}</td>
                    <td className={`${styles.right} ${styles.roas}`}>{a.roas}</td>
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
              <div>
                <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                <p className={styles.peekHeadSub}>{peek.campaign}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Campaign</span><span className={styles.peekValue}>{peek.campaign}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Network</span><span className={styles.peekValue}><span className={styles.netDot} style={{ background: NET_COLOR[peek.network] }} />{peek.network}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Budget</span><span className={styles.peekValue}>{peek.budget}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Spend</span><span className={styles.peekValue}>{peek.spend}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>ROAS</span><span className={styles.peekValue} style={{ color: 'var(--ok)' }}>{peek.roas}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Ad set ID</span><span className={styles.peekValue}>{peek.id}</span></div>
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
              <h2>{editId ? 'Edit ad set' : 'New ad set'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Basics</span>
                <div className={styles.field}><label className={styles.label}>Ad set name</label><input className={styles.input} type="text" placeholder="e.g. Holiday Tee — Lookalike 1%" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Campaign</label><select className={styles.select} value={form.campaign} onChange={(e) => setForm((p) => ({ ...p, campaign: e.target.value }))}><option>Holiday Tee Launch</option><option>Mug Collection Q4</option><option>Brand Awareness</option><option>Retarget</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Network</label><select className={styles.select} value={form.network} onChange={(e) => setForm((p) => ({ ...p, network: e.target.value }))}><option>Meta</option><option>TikTok</option><option>Google</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Budget &amp; Bidding</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Daily budget ($)</label><input className={styles.input} type="number" placeholder="50" value={form.dailyBudget} onChange={(e) => setForm((p) => ({ ...p, dailyBudget: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Bid strategy</label><select className={styles.select} value={form.bid} onChange={(e) => setForm((p) => ({ ...p, bid: e.target.value }))}><option>Lowest cost</option><option>Cost cap</option><option>Bid cap</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Placements</span>
                <div className={styles.field}><label className={styles.label}>Placement type</label><select className={styles.select} value={form.placement} onChange={(e) => setForm((p) => ({ ...p, placement: e.target.value }))}><option>Automatic placements</option><option>Manual placements</option></select></div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Create ad set'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
