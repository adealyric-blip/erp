'use client';

/**
 * Newsletter Campaigns — minimalist management.
 * Real bulk Duplicate/Archive/Delete + working editor (create/send) + templates modal.
 */
import { useState } from 'react';
import styles from './Newsletter.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface NewsletterScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Sent' | 'Scheduled' | 'Draft' | 'Archived';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  sent: string;
  recipients: string;
  opens: string;
  clicks: string;
  status: Status;
}

const INITIAL: Campaign[] = [
  { id: 'n1', name: 'October product spotlight', subject: 'New arrivals: October collection', sent: 'Oct 28', recipients: '4,820', opens: '38%', clicks: '12%', status: 'Sent' },
  { id: 'n2', name: 'Holiday teaser', subject: 'Something special is coming…', sent: 'Oct 25', recipients: '4,910', opens: '42%', clicks: '8%', status: 'Sent' },
  { id: 'n3', name: 'Black Friday preview', subject: 'Your Black Friday early access', sent: '—', recipients: '—', opens: '—', clicks: '—', status: 'Scheduled' },
  { id: 'n4', name: 'Customer spotlight: Lakeside', subject: 'How Lakeside Design uses Unsaid', sent: 'Oct 20', recipients: '4,680', opens: '35%', clicks: '15%', status: 'Sent' },
  { id: 'n5', name: 'Welcome series — Email 1', subject: 'Welcome to Unsaid!', sent: 'Oct 18', recipients: '142', opens: '68%', clicks: '24%', status: 'Sent' },
  { id: 'n6', name: 'Cart abandonment recovery', subject: 'You left something behind', sent: 'Oct 15', recipients: '86', opens: '52%', clicks: '18%', status: 'Sent' },
];

const TEMPLATES = [
  { id: 't1', name: 'Product launch', desc: 'Hero image + features + CTA', icon: 'rocket_launch' },
  { id: 't2', name: 'Newsletter digest', desc: 'Multi-story round-up layout', icon: 'newspaper' },
  { id: 't3', name: 'Welcome series', desc: 'Onboarding email flow', icon: 'waving_hand' },
  { id: 't4', name: 'Abandoned cart', desc: 'Recovery with product reminder', icon: 'shopping_cart' },
  { id: 't5', name: 'Holiday promo', desc: 'Festive discount announcement', icon: 'celebration' },
  { id: 't6', name: 'Re-engagement', desc: 'Win-back inactive subscribers', icon: 'forum' },
];

const STATS = [
  { label: 'Subscribers', value: '4,910', delta: '+42 this week', tone: 'pos' },
  { label: 'Avg. open rate', value: '45%', delta: 'Above industry (21%)', tone: 'pos' },
  { label: 'Avg. click rate', value: '14%', delta: 'Above industry (2.6%)', tone: 'pos' },
  { label: 'Sent (MTD)', value: '4', delta: '1 scheduled', tone: '' },
];

function pill(s: Status) {
  switch (s) {
    case 'Sent': return <span className={`${styles.pill} ${styles.pillGreen}`}>Sent</span>;
    case 'Scheduled': return <span className={`${styles.pill} ${styles.pillBlue}`}>Scheduled</span>;
    case 'Draft': return <span className={`${styles.pill} ${styles.pillGray}`}>Draft</span>;
    case 'Archived': return <span className={`${styles.pill} ${styles.pillGray}`}>Archived</span>;
  }
}

const TABS = [{ id: 'all', label: 'All' }, { id: 'sent', label: 'Sent' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'draft', label: 'Drafts' }, { id: 'archived', label: 'Archived' }];
const EMPTY = { name: '', subject: '', body: '', audience: 'All subscribers', sendMode: 'schedule', date: '', time: '10:00' };

export default function NewsletterScreen({ onToast }: NewsletterScreenProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<Campaign | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const filtered = campaigns.filter((c) => {
    const tabMatch = activeTab === 'all' || c.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || c.name.toLowerCase().includes(s) || c.subject.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (filtered.length > 0 && filtered.every((c) => selected.has(c.id))) setSelected(new Set()); else setSelected(new Set(filtered.map((c) => c.id))); };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'name', label: 'Campaign' }, { key: 'subject', label: 'Subject' }, { key: 'sent', label: 'Sent' }, { key: 'recipients', label: 'Recipients' }, { key: 'opens', label: 'Open rate' }, { key: 'clicks', label: 'Click rate' }, { key: 'status', label: 'Status' },
    ], 'newsletter-campaigns');
    onToast(`Exported ${filtered.length} campaigns.`);
  };

  const dup = (c: Campaign) => {
    const copy: Campaign = { ...c, id: `n${Date.now()}`, name: `${c.name} (copy)`, status: 'Draft', sent: '—', recipients: '—', opens: '—', clicks: '—' };
    setCampaigns((p) => [copy, ...p]);
    setPeek(null);
    onToast(`Duplicated "${c.name}".`);
  };
  const del = (c: Campaign) => {
    setCampaigns((p) => p.filter((x) => x.id !== c.id));
    setPeek(null);
    setSelected((p) => { const n = new Set(p); n.delete(c.id); return n; });
    onToast(`Deleted "${c.name}".`);
  };

  const openNew = () => { setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (c: Campaign) => { setForm({ name: c.name, subject: c.subject, body: '', audience: 'All subscribers', sendMode: 'schedule', date: '', time: '10:00' }); setPeek(null); setEditorOpen(true); };

  const save = (sendNow: boolean) => {
    if (!form.name.trim() || !form.subject.trim()) { onToast('Campaign name and subject are required.'); return; }
    const nc: Campaign = {
      id: `n${Date.now()}`,
      name: form.name,
      subject: form.subject,
      sent: sendNow ? 'Just now' : '—',
      recipients: sendNow ? '4,910' : '—',
      opens: sendNow ? '—' : '—',
      clicks: sendNow ? '—' : '—',
      status: sendNow ? 'Sent' : 'Scheduled',
    };
    setCampaigns((p) => [nc, ...p]);
    setEditorOpen(false);
    onToast(sendNow ? `Campaign "${form.name}" sent to 4,910 subscribers.` : `Campaign "${form.name}" scheduled.`);
  };

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setForm((p) => ({ ...p, name: t.name, subject: t.name, body: '' }));
    setTemplatesOpen(false);
    setEditorOpen(true);
    onToast(`Started from "${t.name}" template.`);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Newsletter Campaigns</h1>
          <p className={styles.toolbarSub}>Create, send, and track email campaigns.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setTemplatesOpen(true)}><span className="material-symbols-outlined">view_quilt</span> Templates</button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> New campaign</button>
        </div>
      </div>

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
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}<span className={styles.tabCount}>{t.id === 'all' ? campaigns.length : campaigns.filter((c) => c.status.toLowerCase() === t.id).length}</span>
            </button>
          ))}
        </div>
        <div className={styles.filterBar}>
          <input className={styles.search} type="text" placeholder="Search campaigns…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {selected.size > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => { const copies = campaigns.filter((c) => selected.has(c.id)).map((c) => ({ ...c, id: `n${Date.now()}-${c.id}`, name: `${c.name} (copy)`, status: 'Draft' as Status, sent: '—', recipients: '—', opens: '—', clicks: '—' })); setCampaigns((p) => [...copies, ...p]); onToast(`Duplicated ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
            <button type="button" className={styles.bulkAction} onClick={() => { setCampaigns((p) => p.map((c) => selected.has(c.id) ? { ...c, status: 'Archived' } : c)); onToast(`Archived ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">archive</span> Archive</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => { setCampaigns((p) => p.filter((c) => !selected.has(c.id))); onToast(`Deleted ${selected.size} campaign${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={styles.bulkAction} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">mail</span><h3>No campaigns</h3><p>Adjust your filters or create a new campaign.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.checkCell}><input type="checkbox" checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))} onChange={toggleAll} /></th>
                <th>Campaign</th><th>Subject</th><th>Sent</th><th className={styles.right}>Recipients</th><th className={styles.right}>Open</th><th className={styles.right}>Click</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => setPeek(c)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td><strong>{c.name}</strong></td>
                    <td style={{ color: 'var(--mut)' }}>{c.subject}</td>
                    <td style={{ color: 'var(--mut)' }}>{c.sent}</td>
                    <td className={styles.right}>{c.recipients}</td>
                    <td className={styles.right}>{c.opens}</td>
                    <td className={styles.right}>{c.clicks}</td>
                    <td>{pill(c.status)}</td>
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
                <p className={styles.peekHeadSub}>{peek.subject}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Sent</span><span className={styles.peekValue}>{peek.sent}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Recipients</span><span className={styles.peekValue}>{peek.recipients}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Open rate</span><span className={styles.peekValue}>{peek.opens}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Click rate</span><span className={styles.peekValue}>{peek.clicks}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Campaign ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => dup(peek)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openEdit(peek)}><span className="material-symbols-outlined">edit</span> Edit</button>
            </div>
          </div>
        </>
      )}

      {/* Editor */}
      {editorOpen && (
        <>
          <div className={styles.editorScrim} onClick={() => setEditorOpen(false)} />
          <div className={styles.editorDrawer}>
            <div className={styles.editorHead}>
              <h2>New campaign</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Content</span>
                <div className={styles.field}><label className={styles.label}>Campaign name</label><input className={styles.input} type="text" placeholder="e.g. November product spotlight" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.field}><label className={styles.label}>Subject line</label><input className={styles.input} type="text" placeholder="New arrivals you'll love" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} /></div>
                <div className={styles.field}><label className={styles.label}>Body (preview)</label><textarea className={styles.textarea} placeholder="Write your email content…" value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} /></div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Audience</span>
                <div className={styles.field}><label className={styles.label}>Send to</label><select className={styles.select} value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}><option>All subscribers</option><option>Engaged (last 90 days)</option><option>New (last 30 days)</option><option>Customers only</option></select></div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Delivery</span>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Date</label><input className={styles.input} type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
                  <div className={styles.field}><label className={styles.label}>Time</label><input className={styles.input} type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} /></div>
                </div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => save(false)}><span className="material-symbols-outlined">schedule</span> Schedule</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => save(true)}><span className="material-symbols-outlined">send</span> Send now</button>
            </div>
          </div>
        </>
      )}

      {/* Templates modal */}
      {templatesOpen && (
        <div className={styles.modalScrim} onClick={() => setTemplatesOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Choose a template</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setTemplatesOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tplGrid}>
                {TEMPLATES.map((t) => (
                  <div key={t.id} className={styles.tplCard} onClick={() => applyTemplate(t)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--pri)' }}>{t.icon}</span>
                    <div className={styles.tplName}>{t.name}</div>
                    <p className={styles.tplDesc}>{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
