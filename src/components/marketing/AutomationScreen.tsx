'use client';

/**
 * Automation — trigger-based recipes + runs log.
 * Minimalist rebuild: Recipes/Runs toggle, real Pause/Resume/Duplicate,
 * working New recipe modal, row-click peek.
 */
import { useState } from 'react';
import styles from './Automation.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface AutomationScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Active' | 'Paused';

interface Recipe {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  status: Status;
  runs: number;
  icon: string;
}

interface Run {
  id: string;
  recipe: string;
  target: string;
  triggered: string;
  status: 'Completed' | 'Failed' | 'Running';
  result: string;
}

const INITIAL_RECIPES: Recipe[] = [
  { id: 'r1', name: 'Welcome series', trigger: 'New subscriber', condition: '—', action: 'Send welcome email', status: 'Active', runs: 142, icon: 'waving_hand' },
  { id: 'r2', name: 'Cart abandonment', trigger: 'Cart abandoned 1h', condition: 'Has items > $20', action: 'Send recovery email', status: 'Active', runs: 86, icon: 'shopping_cart' },
  { id: 'r3', name: 'Post-purchase follow-up', trigger: 'Order delivered', condition: '—', action: 'Send review request', status: 'Active', runs: 320, icon: 'rate_review' },
  { id: 'r4', name: 'Win-back inactive', trigger: 'No purchase 90d', condition: 'Was active', action: 'Send 15% off code', status: 'Active', runs: 48, icon: 'replay' },
  { id: 'r5', name: 'Birthday discount', trigger: 'Birthday today', condition: '—', action: 'Send birthday email', status: 'Paused', runs: 12, icon: 'cake' },
  { id: 'r6', name: 'VIP threshold', trigger: 'Total spend > $500', condition: '—', action: 'Add to VIP segment', status: 'Active', runs: 28, icon: 'workspace_premium' },
];

const INITIAL_RUNS: Run[] = [
  { id: 'u1', recipe: 'Welcome series', target: 'sarah@example.com', triggered: 'Nov 1 · 10:24 AM', status: 'Completed', result: 'Email sent' },
  { id: 'u2', recipe: 'Cart abandonment', target: 'john@example.com', triggered: 'Nov 1 · 9:15 AM', status: 'Completed', result: 'Email sent' },
  { id: 'u3', recipe: 'Post-purchase follow-up', target: 'alex@example.com', triggered: 'Oct 31 · 4:30 PM', status: 'Completed', result: 'Email sent' },
  { id: 'u4', recipe: 'Win-back inactive', target: 'lakeside@example.com', triggered: 'Oct 31 · 2:00 PM', status: 'Completed', result: 'Email sent' },
  { id: 'u5', recipe: 'VIP threshold', target: 'maple@example.com', triggered: 'Oct 30 · 5:00 PM', status: 'Completed', result: 'Segment updated' },
];

function rPill(s: Status) {
  return s === 'Active'
    ? <span className={`${styles.pill} ${styles.pillGreen}`}>Active</span>
    : <span className={`${styles.pill} ${styles.pillGray}`}>Paused</span>;
}

const TRIGGERS = ['New subscriber', 'Cart abandoned 1h', 'Order delivered', 'No purchase 90d', 'Birthday today', 'Total spend threshold'];
const ACTIONS = ['Send email', 'Add to segment', 'Send discount code', 'Tag customer', 'Notify team'];
const ICONS: Record<string, string> = { 'New subscriber': 'waving_hand', 'Cart abandoned 1h': 'shopping_cart', 'Order delivered': 'rate_review', 'No purchase 90d': 'replay', 'Birthday today': 'cake', 'Total spend threshold': 'workspace_premium' };

export default function AutomationScreen({ onToast }: AutomationScreenProps) {
  const [view, setView] = useState<'recipes' | 'runs'>('recipes');
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [runs, setRuns] = useState<Run[]>(INITIAL_RUNS);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekRecipe, setPeekRecipe] = useState<Recipe | null>(null);
  const [peekRun, setPeekRun] = useState<Run | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'New subscriber', condition: '', action: 'Send email' });

  const filteredRecipes = recipes.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredRuns = runs.filter((r) => !search || r.recipe.toLowerCase().includes(search.toLowerCase()) || r.target.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { const list = view === 'recipes' ? filteredRecipes : []; if (list.length > 0 && list.every((r) => selected.has(r.id))) setSelected(new Set()); else setSelected(new Set(list.map((r) => r.id))); };

  const handleExport = () => {
    if (view === 'recipes') {
      exportToCsv(filteredRecipes as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Recipe' }, { key: 'trigger', label: 'Trigger' }, { key: 'condition', label: 'Condition' }, { key: 'action', label: 'Action' }, { key: 'runs', label: 'Runs (30d)' }, { key: 'status', label: 'Status' }], 'automation-recipes');
      onToast(`Exported ${filteredRecipes.length} recipes.`);
    } else {
      exportToCsv(filteredRuns as unknown as Record<string, unknown>[], [{ key: 'recipe', label: 'Recipe' }, { key: 'target', label: 'Target' }, { key: 'triggered', label: 'Triggered' }, { key: 'result', label: 'Result' }, { key: 'status', label: 'Status' }], 'automation-runs');
      onToast(`Exported ${filteredRuns.length} runs.`);
    }
  };

  const setStatus = (r: Recipe, s: Status) => { setRecipes((p) => p.map((x) => x.id === r.id ? { ...x, status: s } : x)); setPeekRecipe(null); onToast(`"${r.name}" ${s === 'Active' ? 'resumed' : 'paused'}.`); };
  const dup = (r: Recipe) => { const c = { ...r, id: `r${Date.now()}`, name: `${r.name} (copy)`, runs: 0, status: 'Paused' as Status }; setRecipes((p) => [c, ...p]); setPeekRecipe(null); onToast(`Duplicated "${r.name}".`); };
  const del = (r: Recipe) => { setRecipes((p) => p.filter((x) => x.id !== r.id)); setPeekRecipe(null); setSelected((p) => { const n = new Set(p); n.delete(r.id); return n; }); onToast(`Deleted "${r.name}".`); };

  const bulk = (s: Status) => { setRecipes((p) => p.map((r) => selected.has(r.id) ? { ...r, status: s } : r)); onToast(`${s === 'Active' ? 'Resumed' : 'Paused'} ${selected.size} recipe${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); };

  const create = () => {
    if (!form.name.trim()) { onToast('Recipe name is required.'); return; }
    const nr: Recipe = { id: `r${Date.now()}`, name: form.name, trigger: form.trigger, condition: form.condition.trim() || '—', action: form.action, status: 'Active', runs: 0, icon: ICONS[form.trigger] || 'bolt' };
    setRecipes((p) => [nr, ...p]);
    setModalOpen(false);
    setForm({ name: '', trigger: 'New subscriber', condition: '', action: 'Send email' });
    onToast(`Recipe "${nr.name}" created.`);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Automation</h1>
          <p className={styles.toolbarSub}>Trigger-based marketing recipes and execution log.</p>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewSwitcher}>
            <button type="button" className={`${styles.viewTab} ${view === 'recipes' ? styles.viewTabActive : ''}`} onClick={() => { setView('recipes'); setSelected(new Set()); setSearch(''); }}><span className="material-symbols-outlined">bolt</span> Recipes</button>
            <button type="button" className={`${styles.viewTab} ${view === 'runs' ? styles.viewTabActive : ''}`} onClick={() => { setView('runs'); setSelected(new Set()); setSearch(''); }}><span className="material-symbols-outlined">history</span> Runs</button>
          </div>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModalOpen(true)}><span className="material-symbols-outlined">add</span> New recipe</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.filterBar}>
          <input className={styles.search} type="text" placeholder={view === 'recipes' ? 'Search recipes…' : 'Search runs…'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {selected.size > 0 && view === 'recipes' && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => bulk('Paused')}><span className="material-symbols-outlined">pause</span> Pause</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulk('Active')}><span className="material-symbols-outlined">play_arrow</span> Resume</button>
            <button type="button" className={styles.bulkAction} onClick={() => { const copies = recipes.filter((r) => selected.has(r.id)).map((r) => ({ ...r, id: `r${Date.now()}-${r.id}`, name: `${r.name} (copy)`, runs: 0, status: 'Paused' as Status })); setRecipes((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} recipe${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => { setRecipes((p) => p.filter((r) => !selected.has(r.id))); onToast(`Deleted ${selected.size} recipe${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {view === 'recipes' ? (
            filteredRecipes.length === 0 ? (
              <div className={styles.empty}><span className="material-symbols-outlined">bolt</span><h3>No recipes</h3><p>Create a new automation recipe.</p></div>
            ) : (
              <table className={styles.table}>
                <thead><tr>
                  <th className={styles.checkCell}><input type="checkbox" checked={filteredRecipes.length > 0 && filteredRecipes.every((r) => selected.has(r.id))} onChange={toggleAll} /></th>
                  <th>Recipe</th><th>Trigger</th><th>Condition</th><th>Action</th><th className={styles.right}>Runs (30d)</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {filteredRecipes.map((r) => (
                    <tr key={r.id} onClick={() => setPeekRecipe(r)}>
                      <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                      <td><div className={styles.recipeCell}><div className={styles.recipeIcon}><span className="material-symbols-outlined">{r.icon}</span></div><strong>{r.name}</strong></div></td>
                      <td style={{ color: 'var(--mut)' }}>{r.trigger}</td>
                      <td style={{ color: 'var(--mut)' }}>{r.condition}</td>
                      <td>{r.action}</td>
                      <td className={styles.right}>{r.runs}</td>
                      <td>{rPill(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            filteredRuns.length === 0 ? (
              <div className={styles.empty}><span className="material-symbols-outlined">history</span><h3>No runs yet</h3><p>Execution history will appear here.</p></div>
            ) : (
              <table className={styles.table}>
                <thead><tr><th>Recipe</th><th>Target</th><th>Triggered</th><th>Result</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredRuns.map((u) => (
                    <tr key={u.id} onClick={() => setPeekRun(u)}>
                      <td><strong>{u.recipe}</strong></td>
                      <td style={{ color: 'var(--mut)' }}>{u.target}</td>
                      <td style={{ color: 'var(--mut)' }}>{u.triggered}</td>
                      <td>{u.result}</td>
                      <td><span className={`${styles.pill} ${u.status === 'Completed' ? styles.pillGreen : u.status === 'Failed' ? styles.pillOrange : styles.pillGray}`}>{u.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Recipe peek */}
      {peekRecipe && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekRecipe(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className={styles.recipeIcon} style={{ width: 32, height: 32 }}><span className="material-symbols-outlined">{peekRecipe.icon}</span></div>
                <div>
                  <h3 className={styles.peekHeadTitle}>{peekRecipe.name}</h3>
                  <p className={styles.peekHeadSub}>{peekRecipe.trigger}</p>
                </div>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekRecipe(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{rPill(peekRecipe.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Trigger</span><span className={styles.peekValue}>{peekRecipe.trigger}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Condition</span><span className={styles.peekValue}>{peekRecipe.condition}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Action</span><span className={styles.peekValue}>{peekRecipe.action}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Runs (30d)</span><span className={styles.peekValue}>{peekRecipe.runs}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Recipe ID</span><span className={styles.peekValue}>{peekRecipe.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => del(peekRecipe)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => dup(peekRecipe)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setStatus(peekRecipe, peekRecipe.status === 'Active' ? 'Paused' : 'Active')}><span className="material-symbols-outlined">{peekRecipe.status === 'Active' ? 'pause' : 'play_arrow'}</span> {peekRecipe.status === 'Active' ? 'Pause' : 'Resume'}</button>
            </div>
          </div>
        </>
      )}

      {/* Run peek */}
      {peekRun && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekRun(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekRun.recipe}</h3>
                <p className={styles.peekHeadSub}>{peekRun.target}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekRun(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{peekRun.status}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Recipe</span><span className={styles.peekValue}>{peekRun.recipe}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Target</span><span className={styles.peekValue}>{peekRun.target}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Triggered</span><span className={styles.peekValue}>{peekRun.triggered}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Result</span><span className={styles.peekValue}>{peekRun.result}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Run ID</span><span className={styles.peekValue}>{peekRun.id}</span></div>
            </div>
          </div>
        </>
      )}

      {/* New recipe modal */}
      {modalOpen && (
        <div className={styles.modalScrim} onClick={() => setModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>New automation recipe</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setModalOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}><label className={styles.label}>Recipe name</label><input className={styles.input} type="text" placeholder="e.g. Welcome series" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
              <div className={styles.field}><label className={styles.label}>Trigger</label><select className={styles.select} value={form.trigger} onChange={(e) => setForm((p) => ({ ...p, trigger: e.target.value }))}>{TRIGGERS.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className={styles.field}><label className={styles.label}>Condition (optional)</label><input className={styles.input} type="text" placeholder="e.g. Has items > $20" value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} /></div>
              <div className={styles.field}><label className={styles.label}>Action</label><select className={styles.select} value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={create}><span className="material-symbols-outlined">bolt</span> Create recipe</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
