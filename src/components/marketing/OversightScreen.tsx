'use client';

/**
 * Oversight — approval queue + decisions log.
 * Minimalist rebuild: Queue/Decisions toggle, bulk Approve/Reject/Flag/Delegate
 * that ACTUALLY move items from Queue → Decisions log (real state change).
 */
import { useState } from 'react';
import styles from './Oversight.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface OversightScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type QStatus = 'Pending' | 'Flagged';
type Decision = 'Approved' | 'Rejected' | 'Flagged' | 'Delegated';

interface QueueItem {
  id: string;
  title: string;
  channel: 'Instagram' | 'TikTok' | 'Facebook' | 'LinkedIn';
  color: string;
  author: string;
  submitted: string;
  status: QStatus;
  copy: string;
}

interface DecisionItem {
  id: string;
  title: string;
  channel: string;
  color: string;
  decision: Decision;
  by: string;
  date: string;
  author: string;
}

const INITIAL_QUEUE: QueueItem[] = [
  { id: 'o1', title: 'October product spotlight', channel: 'Instagram', color: '#c13584', author: 'Sarah Miller', submitted: 'Nov 1 · 10:24 AM', status: 'Pending', copy: 'Highlighting this month\'s bestsellers.' },
  { id: 'o2', title: 'New hoodie drop announcement', channel: 'TikTok', color: '#010101', author: 'John Doe', submitted: 'Nov 1 · 9:15 AM', status: 'Pending', copy: 'Heavyweight hoodie restock — 6 colorways.' },
  { id: 'o3', title: 'Behind the scenes — Studio redesign', channel: 'Facebook', color: '#1877f2', author: 'Alex Lee', submitted: 'Oct 31 · 4:30 PM', status: 'Flagged', copy: 'Flagged for tone review before publishing.' },
  { id: 'o4', title: 'Customer spotlight: Lakeside Design', channel: 'Instagram', color: '#c13584', author: 'Sarah Miller', submitted: 'Oct 31 · 2:00 PM', status: 'Pending', copy: 'Featuring a longtime customer.' },
  { id: 'o5', title: 'Black Friday teaser post', channel: 'TikTok', color: '#010101', author: 'John Doe', submitted: 'Oct 30 · 5:00 PM', status: 'Pending', copy: 'Teaser for the Black Friday sale.' },
];

const INITIAL_DECISIONS: DecisionItem[] = [
  { id: 'd1', title: 'Holiday gift guide carousel', channel: 'Instagram', color: '#c13584', decision: 'Approved', by: 'SA', date: 'Oct 29 · 3:00 PM', author: 'Sarah Miller' },
  { id: 'd2', title: 'Flash sale announcement', channel: 'Facebook', color: '#1877f2', decision: 'Rejected', by: 'SA', date: 'Oct 28 · 1:00 PM', author: 'John Doe' },
  { id: 'd3', title: 'Supplier spotlight: Printful', channel: 'LinkedIn', color: '#0a66c2', decision: 'Approved', by: 'SA', date: 'Oct 27 · 11:00 AM', author: 'Alex Lee' },
  { id: 'd4', title: 'Weekend meme post', channel: 'TikTok', color: '#010101', decision: 'Delegated', by: 'SA', date: 'Oct 26 · 4:00 PM', author: 'John Doe' },
];

function qPill(s: QStatus) {
  return s === 'Flagged'
    ? <span className={`${styles.pill} ${styles.pillOrange}`}>Flagged</span>
    : <span className={`${styles.pill} ${styles.pillGray}`}>Pending</span>;
}

function dPill(d: Decision) {
  switch (d) {
    case 'Approved': return <span className={`${styles.pill} ${styles.pillGreen}`}>Approved</span>;
    case 'Rejected': return <span className={`${styles.pill} ${styles.pillRed}`}>Rejected</span>;
    case 'Flagged': return <span className={`${styles.pill} ${styles.pillOrange}`}>Flagged</span>;
    case 'Delegated': return <span className={`${styles.pill} ${styles.pillBlue}`}>Delegated</span>;
  }
}

export default function OversightScreen({ onToast }: OversightScreenProps) {
  const [view, setView] = useState<'queue' | 'decisions'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [decisions, setDecisions] = useState<DecisionItem[]>(INITIAL_DECISIONS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekQueue, setPeekQueue] = useState<QueueItem | null>(null);
  const [peekDecision, setPeekDecision] = useState<DecisionItem | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState({ autoApprove: 'Disabled', slaHours: '24' });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (queue.length > 0 && queue.every((q) => selected.has(q.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map((q) => q.id)));
    }
  };

  const decide = (items: QueueItem[], decision: Decision) => {
    const now = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const newDecisions: DecisionItem[] = items.map((it) => ({
      id: `d${Date.now()}-${it.id}`,
      title: it.title,
      channel: it.channel,
      color: it.color,
      decision,
      by: 'SA',
      date: now,
      author: it.author,
    }));
    const ids = new Set(items.map((i) => i.id));
    setQueue((prev) => prev.filter((q) => !ids.has(q.id)));
    setDecisions((prev) => [...newDecisions, ...prev]);
    setSelected(new Set());
    onToast(`${decision} ${items.length} item${items.length === 1 ? '' : 's'}.`);
  };

  const bulkDecide = (decision: Decision) => {
    const items = queue.filter((q) => selected.has(q.id));
    if (items.length === 0) return;
    decide(items, decision);
  };

  const decideOne = (item: QueueItem, decision: Decision) => {
    decide([item], decision);
    setPeekQueue(null);
  };

  const handleExport = () => {
    const data = view === 'queue' ? queue : decisions;
    const cols = view === 'queue'
      ? [{ key: 'title', label: 'Title' }, { key: 'channel', label: 'Channel' }, { key: 'author', label: 'Author' }, { key: 'submitted', label: 'Submitted' }, { key: 'status', label: 'Status' }]
      : [{ key: 'title', label: 'Title' }, { key: 'channel', label: 'Channel' }, { key: 'decision', label: 'Decision' }, { key: 'by', label: 'By' }, { key: 'date', label: 'Date' }];
    exportToCsv(data as unknown as Record<string, unknown>[], cols, `oversight-${view}`);
    onToast(`Exported ${data.length} records to CSV.`);
  };

  const pendingCount = queue.filter((q) => q.status === 'Pending').length;
  const flaggedCount = queue.filter((q) => q.status === 'Flagged').length;
  const approvedWeek = decisions.filter((d) => d.decision === 'Approved').length;
  const rejectedWeek = decisions.filter((d) => d.decision === 'Rejected').length;

  const STATS = [
    { label: 'Pending review', value: String(pendingCount), delta: `${queue.length} in queue`, tone: '' },
    { label: 'Flagged', value: String(flaggedCount), delta: 'needs attention', tone: '' },
    { label: 'Approved', value: String(approvedWeek), delta: 'this period', tone: 'pos' },
    { label: 'Rejected', value: String(rejectedWeek), delta: 'this period', tone: '' },
  ];

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Oversight</h1>
          <p className={styles.toolbarSub}>Review and approve social content before it goes live.</p>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewSwitcher}>
            <button type="button" className={`${styles.viewTab} ${view === 'queue' ? styles.viewTabActive : ''}`} onClick={() => { setView('queue'); setSelected(new Set()); }}>
              <span className="material-symbols-outlined">inbox</span> Queue
            </button>
            <button type="button" className={`${styles.viewTab} ${view === 'decisions' ? styles.viewTabActive : ''}`} onClick={() => { setView('decisions'); setSelected(new Set()); }}>
              <span className="material-symbols-outlined">history</span> Decisions
            </button>
          </div>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setRulesOpen(true)}>
            <span className="material-symbols-outlined">rule</span> Rules
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}>
            <span className="material-symbols-outlined">download</span> Export
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.stats}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
              <span className={`${styles.statDelta} ${s.tone === 'pos' ? styles.statDeltaPos : ''}`}>{s.delta}</span>
            </div>
          ))}
        </div>

        <div className={styles.card}>
          {selected.size > 0 && view === 'queue' && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selected.size} selected</span>
              <button type="button" className={styles.bulkAction} onClick={() => bulkDecide('Approved')}><span className="material-symbols-outlined">check</span> Approve</button>
              <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => bulkDecide('Rejected')}><span className="material-symbols-outlined">close</span> Reject</button>
              <button type="button" className={styles.bulkAction} onClick={() => bulkDecide('Flagged')}><span className="material-symbols-outlined">flag</span> Flag</button>
              <button type="button" className={styles.bulkAction} onClick={() => bulkDecide('Delegated')}><span className="material-symbols-outlined">forward</span> Delegate</button>
              <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
            </div>
          )}

          <div className={styles.tableWrap}>
            {view === 'queue' ? (
              queue.length === 0 ? (
                <div className={styles.empty}>
                  <span className="material-symbols-outlined">inbox</span>
                  <h3>Queue is empty</h3>
                  <p>All posts have been reviewed. New submissions will appear here.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead><tr>
                    <th className={styles.checkCell}><input type="checkbox" checked={queue.length > 0 && queue.every((q) => selected.has(q.id))} onChange={toggleSelectAll} /></th>
                    <th>Title</th><th>Channel</th><th>Author</th><th>Submitted</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {queue.map((q) => (
                      <tr key={q.id} onClick={() => setPeekQueue(q)}>
                        <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} /></td>
                        <td><strong>{q.title}</strong></td>
                        <td><span className={styles.chDot} style={{ background: q.color }} />{q.channel}</td>
                        <td>{q.author}</td>
                        <td style={{ color: 'var(--mut)' }}>{q.submitted}</td>
                        <td>{qPill(q.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              decisions.length === 0 ? (
                <div className={styles.empty}>
                  <span className="material-symbols-outlined">history</span>
                  <h3>No decisions yet</h3>
                  <p>Approved or rejected posts will appear here.</p>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead><tr><th>Title</th><th>Channel</th><th>Author</th><th>Decision</th><th>By</th><th>Date</th></tr></thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr key={d.id} onClick={() => setPeekDecision(d)}>
                        <td><strong>{d.title}</strong></td>
                        <td><span className={styles.chDot} style={{ background: d.color }} />{d.channel}</td>
                        <td>{d.author}</td>
                        <td>{dPill(d.decision)}</td>
                        <td>{d.by}</td>
                        <td style={{ color: 'var(--mut)' }}>{d.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>

      {/* Queue peek */}
      {peekQueue && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekQueue(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekQueue.title}</h3>
                <p className={styles.peekHeadSub}><span className={styles.chDot} style={{ background: peekQueue.color }} />{peekQueue.channel} · {peekQueue.submitted}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekQueue(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{peekQueue.copy}</p>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{qPill(peekQueue.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Channel</span><span className={styles.peekValue}>{peekQueue.channel}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Author</span><span className={styles.peekValue}>{peekQueue.author}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Submitted</span><span className={styles.peekValue}>{peekQueue.submitted}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Item ID</span><span className={styles.peekValue}>{peekQueue.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => decideOne(peekQueue, 'Rejected')}><span className="material-symbols-outlined">close</span> Reject</button>
              <button type="button" className={styles.bulkAction} onClick={() => decideOne(peekQueue, 'Flagged')}><span className="material-symbols-outlined">flag</span> Flag</button>
              <button type="button" className={styles.bulkAction} onClick={() => decideOne(peekQueue, 'Delegated')}><span className="material-symbols-outlined">forward</span> Delegate</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => decideOne(peekQueue, 'Approved')}><span className="material-symbols-outlined">check</span> Approve</button>
            </div>
          </div>
        </>
      )}

      {/* Decision peek */}
      {peekDecision && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekDecision(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekDecision.title}</h3>
                <p className={styles.peekHeadSub}><span className={styles.chDot} style={{ background: peekDecision.color }} />{peekDecision.channel} · {peekDecision.date}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekDecision(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Decision</span><span className={styles.peekValue}>{dPill(peekDecision.decision)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Channel</span><span className={styles.peekValue}>{peekDecision.channel}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Author</span><span className={styles.peekValue}>{peekDecision.author}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Decided by</span><span className={styles.peekValue}>{peekDecision.by}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Date</span><span className={styles.peekValue}>{peekDecision.date}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Decision ID</span><span className={styles.peekValue}>{peekDecision.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => {
                setDecisions((prev) => prev.filter((d) => d.id !== peekDecision.id));
                setPeekDecision(null);
                onToast(`Removed decision for "${peekDecision.title}".`);
              }}><span className="material-symbols-outlined">delete</span> Remove from log</button>
            </div>
          </div>
        </>
      )}

      {/* Rules modal */}
      {rulesOpen && (
        <div className={styles.modalScrim} onClick={() => setRulesOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Approval rules</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setRulesOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Auto-approve from trusted authors</label>
                <select className={styles.select} value={rules.autoApprove} onChange={(e) => setRules((p) => ({ ...p, autoApprove: e.target.value }))}>
                  <option>Disabled</option>
                  <option>Admins only</option>
                  <option>Admins + Editors</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>SLA timeout (hours)</label>
                <input className={styles.input} type="number" value={rules.slaHours} onChange={(e) => setRules((p) => ({ ...p, slaHours: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setRulesOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setRulesOpen(false); onToast('Approval rules saved.'); }}>Save rules</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
