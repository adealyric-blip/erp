'use client';

/**
 * Social Calendar — month grid + list view of scheduled posts.
 * Minimalist rebuild: local CSS module, real Month/List toggle,
 * channel filter, peek drawer on post click, day-click → create-content.
 */
import { useState } from 'react';
import styles from './SocialCalendar.module.css';

interface SocialCalendarScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

interface CalPost {
  id: string;
  title: string;
  channel: 'Instagram' | 'TikTok' | 'Facebook' | 'LinkedIn';
  color: string;
  date: string; // YYYY-MM-DD
  time: string;
  status: 'Scheduled' | 'Pending approval' | 'Draft';
  copy: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHANNELS = ['All', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn'] as const;
const CHANNEL_COLOR: Record<string, string> = {
  Instagram: '#c13584',
  TikTok: '#010101',
  Facebook: '#1877f2',
  LinkedIn: '#0a66c2',
};

const INITIAL_POSTS: CalPost[] = [
  { id: 'c1', title: 'October product spotlight', channel: 'Instagram', color: '#c13584', date: '2026-10-28', time: '2:00 PM', status: 'Scheduled', copy: 'Highlighting this month\'s best-selling pieces.' },
  { id: 'c2', title: 'Weekly company update', channel: 'LinkedIn', color: '#0a66c2', date: '2026-10-29', time: '9:00 AM', status: 'Scheduled', copy: 'Internal milestones shared externally.' },
  { id: 'c3', title: 'Behind the scenes', channel: 'TikTok', color: '#010101', date: '2026-10-31', time: '12:00 PM', status: 'Scheduled', copy: 'Studio redesign footage.' },
  { id: 'c4', title: 'Holiday teaser', channel: 'Instagram', color: '#c13584', date: '2026-10-31', time: '4:00 PM', status: 'Pending approval', copy: 'Sneak peek at the holiday drop.' },
  { id: 'c5', title: 'New hoodie drop', channel: 'TikTok', color: '#010101', date: '2026-11-01', time: '10:00 AM', status: 'Scheduled', copy: 'Heavyweight hoodie restock — 6 colorways.' },
  { id: 'c6', title: 'Customer spotlight', channel: 'Instagram', color: '#c13584', date: '2026-11-03', time: '12:00 PM', status: 'Pending approval', copy: 'Featuring a longtime customer.' },
  { id: 'c7', title: 'Black Friday teaser', channel: 'Facebook', color: '#1877f2', date: '2026-11-05', time: '3:00 PM', status: 'Draft', copy: 'Teaser for the Black Friday sale.' },
  { id: 'c8', title: 'Weekend meme', channel: 'TikTok', color: '#010101', date: '2026-11-07', time: '6:00 PM', status: 'Draft', copy: 'Light weekend content.' },
];

function statusPill(status: CalPost['status']) {
  if (status === 'Scheduled') return <span className={`${styles.pill} ${styles.pillGreen}`}>Scheduled</span>;
  if (status === 'Pending approval') return <span className={`${styles.pill} ${styles.pillOrange}`}>Pending</span>;
  return <span className={`${styles.pill} ${styles.pillGray}`}>Draft</span>;
}

export default function SocialCalendarScreen({ onToast, onNavigate }: SocialCalendarScreenProps) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9); // October
  const [view, setView] = useState<'month' | 'list'>('month');
  const [channelFilter, setChannelFilter] = useState<string>('All');
  const [posts, setPosts] = useState<CalPost[]>(INITIAL_POSTS);
  const [peekPost, setPeekPost] = useState<CalPost | null>(null);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = 28; // for highlight

  const prevMonth = () => (month === 0 ? (setMonth(11), setYear(year - 1)) : setMonth(month - 1));
  const nextMonth = () => (month === 11 ? (setMonth(0), setYear(year + 1)) : setMonth(month + 1));
  const goToday = () => { setYear(2026); setMonth(9); };

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const filteredPosts = channelFilter === 'All' ? posts : posts.filter((p) => p.channel === channelFilter);

  const handleDuplicate = (post: CalPost) => {
    const dup: CalPost = { ...post, id: `c${Date.now()}`, title: `${post.title} (copy)`, status: 'Draft', time: 'Unscheduled' };
    setPosts((prev) => [dup, ...prev]);
    setPeekPost(null);
    onToast(`Duplicated "${post.title}".`);
  };

  const handleDelete = (post: CalPost) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setPeekPost(null);
    onToast(`Deleted "${post.title}".`);
  };

  return (
    <div className={styles.screen}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Calendar</h1>
          <div className={styles.monthNav}>
            <button type="button" className={styles.btnIcon} onClick={prevMonth} title="Previous month"><span className="material-symbols-outlined">chevron_left</span></button>
            <span className={styles.monthLabel}>{MONTHS[month]} {year}</span>
            <button type="button" className={styles.btnIcon} onClick={nextMonth} title="Next month"><span className="material-symbols-outlined">chevron_right</span></button>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={goToday}>Today</button>
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewSwitcher}>
            <button type="button" className={`${styles.viewTab} ${view === 'month' ? styles.viewTabActive : ''}`} onClick={() => setView('month')}>
              <span className="material-symbols-outlined">calendar_month</span> Month
            </button>
            <button type="button" className={`${styles.viewTab} ${view === 'list' ? styles.viewTabActive : ''}`} onClick={() => setView('list')}>
              <span className="material-symbols-outlined">list</span> List
            </button>
          </div>
          <select className={styles.select} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            {CHANNELS.map((c) => (<option key={c} value={c}>{c === 'All' ? 'All channels' : c}</option>))}
          </select>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
            <span className="material-symbols-outlined">add</span> Create post
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {view === 'month' ? (
          <div className={styles.gridWrap}>
            <div className={styles.grid}>
              {DAY_NAMES.map((d) => (<div key={d} className={styles.dayHead}>{d}</div>))}
              {Array.from({ length: firstDay }, (_, i) => (<div key={`empty-${i}`} className={`${styles.cell} ${styles.cellEmpty}`} />))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = getDateStr(day);
                const dayPosts = filteredPosts.filter((p) => p.date === dateStr);
                return (
                  <div
                    key={day}
                    className={styles.cell}
                    title={dayPosts.length === 0 ? `Schedule for ${MONTHS[month]} ${day}` : ''}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest(`.${styles.postChip}`)) return;
                      onNavigate?.('marketing', 'mkt-create-content');
                    }}
                  >
                    <span className={`${styles.dateNum} ${day === today && month === 9 && year === 2026 ? styles.dateToday : ''}`}>{day}</span>
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className={styles.postChip}
                        style={{ borderLeftColor: p.color }}
                        onClick={(e) => { e.stopPropagation(); setPeekPost(p); }}
                      >
                        {p.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 && <span className={styles.moreChip}>+{dayPosts.length - 3} more</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.listWrap}>
            {filteredPosts.length === 0 ? (
              <div className={styles.empty}>
                <span className="material-symbols-outlined">calendar_today</span>
                <h3>No posts</h3>
                <p>Adjust your channel filter or create a post.</p>
              </div>
            ) : (
              <table className={styles.listTable}>
                <thead>
                  <tr><th>Date</th><th>Title</th><th>Channel</th><th>Time</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {filteredPosts.map((p) => (
                    <tr key={p.id} onClick={() => setPeekPost(p)}>
                      <td>{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td><strong>{p.title}</strong></td>
                      <td><span className={styles.chDot} style={{ background: p.color }} />{p.channel}</td>
                      <td>{p.time}</td>
                      <td>{statusPill(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Peek drawer */}
      {peekPost && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekPost(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekPost.title}</h3>
                <p className={styles.peekHeadSub}>
                  <span className={styles.chDot} style={{ background: peekPost.color }} />
                  {peekPost.channel} · {new Date(peekPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {peekPost.time}
                </p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekPost(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{peekPost.copy}</p>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{statusPill(peekPost.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Channel</span><span className={styles.peekValue}>{peekPost.channel}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Date</span><span className={styles.peekValue}>{peekPost.date}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Time</span><span className={styles.peekValue}>{peekPost.time}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Post ID</span><span className={styles.peekValue}>{peekPost.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleDelete(peekPost)}>
                <span className="material-symbols-outlined">delete</span> Delete
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleDuplicate(peekPost)}>
                <span className="material-symbols-outlined">content_copy</span> Duplicate
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPeekPost(null); onNavigate?.('marketing', 'mkt-create-content'); }}>
                <span className="material-symbols-outlined">edit</span> Edit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
