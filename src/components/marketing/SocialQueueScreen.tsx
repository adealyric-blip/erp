'use client';

/**
 * Publishing Queue — resource table of scheduled/published/draft/failed posts.
 * Minimalist rebuild: status tabs + search + checkbox bulk bar (real state
 * changes: Pause/Resume/Duplicate/Archive) + row-click peek + row menu.
 */
import { useState } from 'react';
import styles from './SocialQueue.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface SocialQueueScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Scheduled' | 'Published' | 'Draft' | 'Failed' | 'Paused' | 'Archived';

interface QPost {
  id: string;
  title: string;
  channel: 'Instagram' | 'TikTok' | 'Facebook' | 'LinkedIn' | 'Pinterest';
  color: string;
  date: string;
  status: Status;
  copy: string;
  author: string;
}

const INITIAL_POSTS: QPost[] = [
  { id: 'q1', title: 'October product spotlight', channel: 'Instagram', color: '#c13584', date: 'Oct 31 · 2:00 PM', status: 'Scheduled', copy: 'Highlighting this month\'s bestsellers.', author: 'Sarah M.' },
  { id: 'q2', title: 'Behind the scenes', channel: 'TikTok', color: '#010101', date: 'Nov 1 · 10:00 AM', status: 'Scheduled', copy: 'Studio redesign footage.', author: 'Alex L.' },
  { id: 'q3', title: 'Weekly company update', channel: 'LinkedIn', color: '#0a66c2', date: 'Nov 3 · 9:00 AM', status: 'Scheduled', copy: 'Milestones shared externally.', author: 'John D.' },
  { id: 'q4', title: 'New hoodie drop', channel: 'TikTok', color: '#010101', date: 'Nov 1 · 10:00 AM', status: 'Scheduled', copy: 'Heavyweight hoodie restock.', author: 'Sarah M.' },
  { id: 'q5', title: 'Customer spotlight', channel: 'Instagram', color: '#c13584', date: 'Nov 5 · 12:00 PM', status: 'Scheduled', copy: 'Featuring a longtime customer.', author: 'Alex L.' },
  { id: 'q6', title: 'Holiday gift guide', channel: 'Facebook', color: '#1877f2', date: 'Oct 28 · 4:00 PM', status: 'Published', copy: 'Curated gift picks.', author: 'Sarah M.' },
  { id: 'q7', title: 'Flash sale announcement', channel: 'Instagram', color: '#c13584', date: 'Oct 25 · 6:00 PM', status: 'Published', copy: '48-hour flash sale.', author: 'John D.' },
  { id: 'q8', title: 'Supplier spotlight', channel: 'LinkedIn', color: '#0a66c2', date: 'Oct 27 · 11:00 AM', status: 'Published', copy: 'Spotlighting a partner.', author: 'Alex L.' },
  { id: 'q9', title: 'Black Friday teaser', channel: 'TikTok', color: '#010101', date: '—', status: 'Draft', copy: 'Teaser for Black Friday.', author: 'Sarah M.' },
  { id: 'q10', title: 'Weekend meme post', channel: 'TikTok', color: '#010101', date: '—', status: 'Draft', copy: 'Light weekend content.', author: 'John D.' },
  { id: 'q11', title: 'Pinterest pin — Fall collection', channel: 'Pinterest', color: '#bd081c', date: 'Oct 20 · 3:00 PM', status: 'Failed', copy: 'Pin failed to publish — token expired.', author: 'Alex L.' },
];

const TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'failed', label: 'Failed' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
];

function pill(status: Status) {
  switch (status) {
    case 'Scheduled': return <span className={`${styles.pill} ${styles.pillGreen}`}>Scheduled</span>;
    case 'Published': return <span className={`${styles.pill} ${styles.pillBlue}`}>Published</span>;
    case 'Draft': return <span className={`${styles.pill} ${styles.pillGray}`}>Draft</span>;
    case 'Failed': return <span className={`${styles.pill} ${styles.pillRed}`}>Failed</span>;
    case 'Paused': return <span className={`${styles.pill} ${styles.pillGray}`}>Paused</span>;
    case 'Archived': return <span className={`${styles.pill} ${styles.pillGray}`}>Archived</span>;
  }
}

function tabCount(posts: QPost[], tabId: string): number {
  if (tabId === 'all') return posts.length;
  return posts.filter((p) => p.status.toLowerCase() === tabId).length;
}

export default function SocialQueueScreen({ onToast, onNavigate }: SocialQueueScreenProps) {
  const [posts, setPosts] = useState<QPost[]>(INITIAL_POSTS);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekPost, setPeekPost] = useState<QPost | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const filtered = posts.filter((p) => {
    const tabMatch = activeTab === 'all' || p.status.toLowerCase() === activeTab;
    const s = search.trim().toLowerCase();
    const searchMatch = !s || p.title.toLowerCase().includes(s) || p.channel.toLowerCase().includes(s);
    return tabMatch && searchMatch;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filtered.every((p) => selected.has(p.id))) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const bulkUpdate = (newStatus: Status, verb: string) => {
    setPosts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, status: newStatus } : p)));
    onToast(`${verb} ${selected.size} post${selected.size === 1 ? '' : 's'}.`);
    setSelected(new Set());
  };

  const handleDuplicate = (post: QPost) => {
    const dup: QPost = { ...post, id: `q${Date.now()}`, title: `${post.title} (copy)`, status: 'Draft', date: '—' };
    setPosts((prev) => [dup, ...prev]);
    setPeekPost(null);
    setMenuOpenId(null);
    onToast(`Duplicated "${post.title}".`);
  };

  const handleDelete = (post: QPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setPeekPost(null);
    setMenuOpenId(null);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(post.id);
      return next;
    });
    onToast(`Deleted "${post.title}".`);
  };

  const setStatus = (post: QPost, newStatus: Status) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: newStatus } : p)));
    setMenuOpenId(null);
    onToast(`"${post.title}" marked ${newStatus}.`);
  };

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'title', label: 'Content' },
      { key: 'channel', label: 'Channel' },
      { key: 'date', label: 'Publish date' },
      { key: 'status', label: 'Status' },
      { key: 'author', label: 'Author' },
    ], 'publishing-queue');
    onToast(`Exported ${filtered.length} posts to CSV.`);
  };

  const hasSelection = selected.size > 0;

  return (
    <div className={styles.screen}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Publishing queue</h1>
          <p className={styles.toolbarSub}>Track scheduled posts, drafts, and outcomes.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}>
            <span className="material-symbols-outlined">download</span> Export
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
            <span className="material-symbols-outlined">add</span> Create post
          </button>
        </div>
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Status tabs */}
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`} onClick={() => { setActiveTab(t.id); setSelected(new Set()); }}>
              {t.label}
              <span className={styles.tabCount}>{tabCount(posts, t.id)}</span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <input className={styles.search} type="text" placeholder="Search by title or channel…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Bulk bar */}
        {hasSelection && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selected.size} selected</span>
            <button type="button" className={styles.bulkAction} onClick={() => bulkUpdate('Paused', 'Paused')}><span className="material-symbols-outlined">pause</span> Pause</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkUpdate('Scheduled', 'Resumed')}><span className="material-symbols-outlined">play_arrow</span> Resume</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkUpdate('Draft', 'Sent back to drafts')}><span className="material-symbols-outlined">edit_note</span> To draft</button>
            <button type="button" className={styles.bulkAction} onClick={() => bulkUpdate('Archived', 'Archived')}><span className="material-symbols-outlined">archive</span> Archive</button>
            <button type="button" className={`${styles.bulkAction} ${styles.bulkActionDanger}`} onClick={() => { setPosts((prev) => prev.filter((p) => !selected.has(p.id))); onToast(`Deleted ${selected.size} post${selected.size === 1 ? '' : 's'}.`); setSelected(new Set()); }}><span className="material-symbols-outlined">delete</span> Delete</button>
            <button type="button" className={`${styles.bulkAction}`} onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>Clear</button>
          </div>
        )}

        {/* Table */}
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined">outbox</span>
              <h3>No posts</h3>
              <p>Adjust your filters or create a new post.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCell}>
                    <input type="checkbox" checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))} onChange={toggleSelectAll} />
                  </th>
                  <th>Content</th>
                  <th>Channel</th>
                  <th>Publish date</th>
                  <th>Status</th>
                  <th className={styles.menuCell} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((post) => (
                  <tr key={post.id} onClick={() => setPeekPost(post)}>
                    <td className={styles.checkCell} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                    </td>
                    <td>
                      <div className={styles.contentCell}>
                        <span className={styles.contentTitle}>{post.title}</span>
                        <span className={styles.contentMeta}>{post.author}</span>
                      </div>
                    </td>
                    <td><span className={styles.chDot} style={{ background: post.color }} />{post.channel}</td>
                    <td style={{ color: 'var(--mut)' }}>{post.date}</td>
                    <td>{pill(post.status)}</td>
                    <td className={styles.menuCell} onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
                      <button type="button" className={styles.btnIcon} onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}>
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                      {menuOpenId === post.id && (
                        <div className={styles.rowMenu} style={{ right: 8, top: 36 }}>
                          <button type="button" className={styles.rowMenuItem} onClick={() => { setPeekPost(post); setMenuOpenId(null); }}>
                            <span className="material-symbols-outlined">visibility</span> View details
                          </button>
                          <button type="button" className={styles.rowMenuItem} onClick={() => { setPeekPost(null); onNavigate?.('marketing', 'mkt-create-content'); setMenuOpenId(null); }}>
                            <span className="material-symbols-outlined">edit</span> Edit
                          </button>
                          <button type="button" className={styles.rowMenuItem} onClick={() => handleDuplicate(post)}>
                            <span className="material-symbols-outlined">content_copy</span> Duplicate
                          </button>
                          {post.status === 'Scheduled' ? (
                            <button type="button" className={styles.rowMenuItem} onClick={() => setStatus(post, 'Paused')}><span className="material-symbols-outlined">pause</span> Pause</button>
                          ) : post.status === 'Paused' || post.status === 'Failed' ? (
                            <button type="button" className={styles.rowMenuItem} onClick={() => setStatus(post, 'Scheduled')}><span className="material-symbols-outlined">play_arrow</span> Resume</button>
                          ) : null}
                          <button type="button" className={styles.rowMenuItem} onClick={() => setStatus(post, 'Archived')}><span className="material-symbols-outlined">archive</span> Archive</button>
                          <button type="button" className={`${styles.rowMenuItem} ${styles.rowMenuItemDanger}`} onClick={() => handleDelete(post)}><span className="material-symbols-outlined">delete</span> Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Peek */}
      {peekPost && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekPost(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekPost.title}</h3>
                <p className={styles.peekHeadSub}>
                  <span className={styles.chDot} style={{ background: peekPost.color }} />
                  {peekPost.channel} · {peekPost.date}
                </p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekPost(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{peekPost.copy}</p>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peekPost.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Channel</span><span className={styles.peekValue}>{peekPost.channel}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Publish date</span><span className={styles.peekValue}>{peekPost.date}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Author</span><span className={styles.peekValue}>{peekPost.author}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Post ID</span><span className={styles.peekValue}>{peekPost.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(peekPost)}><span className="material-symbols-outlined">delete</span> Delete</button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleDuplicate(peekPost)}><span className="material-symbols-outlined">content_copy</span> Duplicate</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPeekPost(null); onNavigate?.('marketing', 'mkt-create-content'); }}><span className="material-symbols-outlined">edit</span> Edit</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
