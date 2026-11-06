'use client';

/**
 * Promotions & Discounts — minimalist management.
 * Real bulk Deactivate/Duplicate/Delete + working editor drawer (create/edit).
 */
import { useState } from 'react';
import styles from './Promotions.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface PromotionsScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Active' | 'Scheduled' | 'Expired' | 'Inactive';

interface Promo {
  id: string;
  code: string;
  name: string;
  type: string;
  value: string;
  uses: number;
  revenue: number;
  status: Status;
  expires: string;
}

const INITIAL: Promo[] = [
  { id: 'p1', code: 'HOLIDAY20', name: 'Holiday 20% off', type: 'Percentage', value: '20%', uses: 142, revenue: 3408, status: 'Active', expires: 'Dec 31' },
  { id: 'p2', code: 'FREESHIP', name: 'Free shipping over $50', type: 'Free shipping', value: '—', uses: 86, revenue: 4128, status: 'Active', expires: 'Dec 31' },
  { id: 'p3', code: 'BLACKFRIDAY', name: 'Black Friday 30% off', type: 'Percentage', value: '30%', uses: 0, revenue: 0, status: 'Scheduled', expires: 'Nov 29' },
  { id: 'p4', code: 'WELCOME10', name: 'Welcome 10% off', type: 'Percentage', value: '10%', uses: 320, revenue: 8640, status: 'Active', expires: '—' },
  { id: 'p5', code: 'SUMMER25', name: 'Summer clearance 25%', type: 'Percentage', value: '25%', uses: 64, revenue: 1152, status: 'Expired', expires: 'Sep 30' },
  { id: 'p6', code: 'BUNDLE15', name: 'Bundle save 15%', type: 'Percentage', value: '15%', uses: 28, revenue: 672, status: 'Active', expires: '—' },
];

const TABS = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'expired', label: 'Expired' }, { id: 'inactive', label: 'Inactive' }];

function pill(s: Status) {
  switch (s) {
    case 'Active': return <span className={`${styles.pill} ${styles.pillGreen}`}>Active</span>;
    case 'Scheduled': return <span className={`${styles.pill} ${styles.pillBlue}`}>Scheduled</span>;
    case 'Expired': return <span className={`${styles.pill} ${styles.pillGray}`}>Expired</span>;
    case 'Inactive': return <span className={`${styles.pill} ${styles.pillOrange}`}>Inactive</span>;
  }
}

const EMPTY_FORM = { name: '', code: '', type: 'Percentage', value: '', start: '', end: '', maxUses: '', maxPerCustomer: '1' };

export default function PromotionsScreen({ onToast }: PromotionsScreenProps) {
  const [promos, setPromos] = useState<Promo[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Promo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const filtered = promos.filter((p) => {
    const tabMatch = activeTab === 'all' || p.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((p) => selected.has(p.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((p) => p.id))); };

  const bulk = (fn: (prev: Promo[]) => Promo[], verb: string) => {
    setPromos(fn);
    onToast(`${verb} ${selected.size} promo${selected.size === 1 ? '' : 's'}.`);
    setSelected(new Set());
  };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'code', label: 'Code' }, { key: 'name', label: 'Promotion' }, { key: 'type', label: 'Type' }, { key: 'value', label: 'Value' }, { key: 'uses', label: 'Uses' }, { key: 'revenue', label: 'Revenue' }, { key: 'expires', label: 'Expires' }, { key: 'status', label: 'Status' },
    ], 'promotions');
    onToast(`Exported ${filtered.length} promos.`);
  };

  const openNew = () => { setEditId(null); setForm(EMPTY_FORM); setEditorOpen(true); };
  const openEdit = (p: Promo) => {
    setEditId(p.id);
    setForm({ name: p.name, code: p.code, type: p.type, value: p.value === '—' ? '' : p.value, start: '', end: p.expires === '—' ? '' : p.expires, maxUses: '', maxPerCustomer: '1' });
    setPeek(null);
    setEditorOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.code.trim()) { onToast('Promotion name and code are required.'); return; }
    if (editId) {
      setPromos((prev) => prev.map((p) => p.id === editId ? { ...p, name: form.name, code: form.code.toUpperCase(), type: form.type, value: form.value || '—' } : p));
      onToast(`Promotion "${form.name}" saved.`);
    } else {
      const np: Promo = { id: `p${Date.now()}`, code: form.code.toUpperCase(), name: form.name, type: form.type, value: form.value || '—', uses: 0, revenue: 0, status: 'Active', expires: form.end || '—' };
      setPromos((prev) => [np, ...prev]);
      onToast(`Promotion "${form.name}" created.`);
    }
    setEditorOpen(false);
  };

  const dup = (p: Promo) => {
    const copy: Promo = { ...p, id: `p${Date.now()}`, code: `${p.code}_COPY`, name: `${p.name} (copy)`, uses: 0, revenue: 0, status: 'Inactive' };
    setPromos((prev) => [copy, ...prev]);
    setPeek(null);
    onToast(`Duplicated "${p.name}".`);
  };
  const del = (p: Promo) => {
    setPromos((prev) => prev.filter((x) => x.id !== p.id));
    setPeek(null);
    setSelected((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    onToast(`Deleted "${p.name}".`);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Promotions &amp; Discounts</h1>
          <p className={styles.toolbarSub}>Manage discount codes and promotional rules.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New promotion</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}<span className={styles.tabCount}>{t.id === 'all' ? promos.length : promos.filter((p) => p.status.toLowerCase() === t.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}>
          <input className={styles.search} type="text" placeholder="Search by code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => bulk((prev) => prev.map((p) => selected.has(p.id) ? { ...p, status: 'Inactive' } : p), 'Deactivated')}><span className="material-symbols-outlined">pause</span> Deactivate</button>
            <button type="button" className={styles.bulkAction} onClick={() => { const copies = promos.filter((p) => selected.has(p.id)).map((p) => ({ ...p, id: `p${Date.now()}-${p.id}`, code: `${p.code}_COPY`, name: `${p.name} (copy)`, uses: 0, revenue: 0, status: 'Inactive' as Status })); setPromos((prev) => [...copies, ...prev]); onToast(`Duplicated ${selected.size} promo${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => { setPromos((prev) => prev.filter((p) => !selected.has(p.id))); onToast(`Deleted ${selected.size} promo${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">local_offer</span><h3>No promotions</h3><p>Adjust your filters or create a new promotion.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))} onChange={toggleAll} /></th>
                <th>Code</th><th>Promotion</th><th>Type</th><th className={styles.right}>Value</th><th className={styles.right}>Uses</th><th className={styles.right}>Revenue</th><th>Expires</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => setPeek(p)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td><span className={styles.code}>{p.code}</span></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.type}</td>
                    <td className={styles.right}>{p.value}</td>
                    <td className={styles.right}>{p.uses}</td>
                    <td className={styles.right}>${p.revenue.toLocaleString()}</td>
                    <td style={{ color: 'var(--mut)' }}>{p.expires}</td>
                    <td>{pill(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Peek */}
      {peek && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeek(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                <p className={styles.peekHeadSub}><span className={styles.code}>{peek.code}</span></p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Type</span><span className={styles.peekValue}>{peek.type}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Value</span><span className={styles.peekValue}>{peek.value}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Uses</span><span className={styles.peekValue}>{peek.uses}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Revenue</span><span className={styles.peekValue}>${peek.revenue.toLocaleString()}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Expires</span><span className={styles.peekValue}>{peek.expires}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Promo ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => dup(peek)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openEdit(peek)}><span className="material-symbols-outlined">edit</span> Edit</button>
            </div>
          </div>
        </>
      )}

      {/* Editor drawer */}
      {editorOpen && (
        <>
          <div className={styles.editorScrim} onClick={() => setEditorOpen(false)} />
          <div className={`${styles.editorDrawer} ${styles.editorDrawerOpen}`}>
            <div className={styles.editorHead}>
              <h2>{editId ? 'Edit promotion' : 'New promotion'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Basics</span>
                <div className={styles.field}><label className={styles.label}>Promotion name</label><input className={styles.input} type="text" placeholder="e.g. Holiday 20% off" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Discount code</label><input className={styles.input} type="text" placeholder="HOLIDAY20" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Type</label><select className={styles.select} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}><option>Percentage</option><option>Fixed amount</option><option>Free shipping</option><option>Buy X get Y</option></select></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Value</span>
                <div className={styles.field}><label className={styles.label}>{form.type === 'Percentage' ? 'Discount value (%)' : form.type === 'Fixed amount' ? 'Discount amount ($)' : '—'}</label><input className={styles.input} type="text" placeholder={form.type === 'Percentage' ? '20' : form.type === 'Fixed amount' ? '10.00' : 'n/a'} value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} disabled={form.type === 'Free shipping' || form.type === 'Buy X get Y'} /></div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Schedule</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Start date</label><input className={styles.input} type="date" value={form.start} onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>End date</label><input className={styles.input} type="date" value={form.end} onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))} /></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Limits</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Max uses (total)</label><input className={styles.input} type="number" placeholder="0 = unlimited" value={form.maxUses} onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Max uses per customer</label><input className={styles.input} type="number" value={form.maxPerCustomer} onChange={(e) => setForm((p) => ({ ...p, maxPerCustomer: e.target.value }))} /></div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Create promotion'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
