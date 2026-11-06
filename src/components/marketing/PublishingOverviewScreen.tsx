'use client';

/**
 * Publishing Overview — social publishing hub.
 * Minimalist rebuild: local CSS module (matches Tasks/finance pattern),
 * compact toolbar + stat row + split (upcoming list / quick actions + channels).
 * Every button does a real action (navigate, open modal, open peek, change state).
 */
import { useState } from 'react';
import styles from './PublishingOverview.module.css';

interface PublishingOverviewScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

interface Post {
  id: string;
  title: string;
  channel: 'Instagram' | 'TikTok' | 'Facebook' | 'LinkedIn';
  icon: string;
  color: string;
  time: string;
  status: 'Scheduled' | 'Pending approval' | 'Draft';
  copy: string;
}

interface Channel {
  name: string;
  handle: string;
  icon: string;
  color: string;
  connected: boolean;
}

const STATS = [
  { label: 'Scheduled', value: '12', delta: 'next 7 days', tone: '' },
  { label: 'Published', value: '48', delta: '+12% vs last month', tone: 'pos' },
  { label: 'Drafts', value: '6', delta: 'ready for review', tone: '' },
  { label: 'Channels', value: '4', delta: 'all connected', tone: '' },
];

const POSTS: Post[] = [
  { id: 'p1', title: 'October product spotlight', channel: 'Instagram', icon: 'photo_camera', color: '#c13584', time: 'Today · 2:00 PM', status: 'Scheduled', copy: 'Highlighting this month\'s best-selling pieces and the stories behind them.' },
  { id: 'p2', title: 'New hoodie drop announcement', channel: 'TikTok', icon: 'music_note', color: '#010101', time: 'Tomorrow · 10:00 AM', status: 'Scheduled', copy: 'Quick teaser for the heavyweight hoodie restock — 6 new colorways.' },
  { id: 'p3', title: 'Behind the scenes — Studio redesign', channel: 'Facebook', icon: 'group', color: '#1877f2', time: 'Nov 3 · 4:00 PM', status: 'Pending approval', copy: 'A look at how we reimagined the studio workspace this quarter.' },
  { id: 'p4', title: 'Customer spotlight: Lakeside Design', channel: 'Instagram', icon: 'photo_camera', color: '#c13584', time: 'Nov 5 · 12:00 PM', status: 'Pending approval', copy: 'Featuring a longtime customer and how they use our pieces daily.' },
  { id: 'p5', title: 'Weekly digest — new arrivals', channel: 'LinkedIn', icon: 'business_center', color: '#0a66c2', time: 'Nov 6 · 9:00 AM', status: 'Draft', copy: 'Round-up of new SKUs added to the catalog this week.' },
];

const CHANNELS: Channel[] = [
  { name: 'Instagram', handle: '@unsaidmemories', icon: 'photo_camera', color: '#c13584', connected: true },
  { name: 'TikTok', handle: '@unsaidstudio', icon: 'music_note', color: '#010101', connected: true },
  { name: 'Facebook', handle: 'Unsaid Studio', icon: 'group', color: '#1877f2', connected: true },
  { name: 'LinkedIn', handle: 'Unsaid Studio', icon: 'business_center', color: '#0a66c2', connected: true },
];

const PLATFORMS = [
  { id: 'Instagram', icon: 'photo_camera' },
  { id: 'TikTok', icon: 'music_note' },
  { id: 'Facebook', icon: 'group' },
  { id: 'LinkedIn', icon: 'business_center' },
  { id: 'YouTube', icon: 'smart_display' },
  { id: 'Pinterest', icon: 'push_pin' },
];

function statusPill(status: Post['status']) {
  if (status === 'Scheduled') return <span className={`${styles.pill} ${styles.pillGreen}`}>Scheduled</span>;
  if (status === 'Pending approval') return <span className={`${styles.pill} ${styles.pillOrange}`}>Pending</span>;
  return <span className={`${styles.pill} ${styles.pillGray}`}>Draft</span>;
}

export default function PublishingOverviewScreen({ onToast, onNavigate }: PublishingOverviewScreenProps) {
  const [peekPost, setPeekPost] = useState<Post | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [platform, setPlatform] = useState('Instagram');
  const [accountName, setAccountName] = useState('');
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [posts, setPosts] = useState<Post[]>(POSTS);

  const handleConnect = () => {
    if (!accountName.trim()) {
      onToast('Enter an account name to connect.');
      return;
    }
    const exists = channels.find((c) => c.name === platform);
    const plat = PLATFORMS.find((p) => p.id === platform)!;
    if (exists) {
      setChannels((prev) => prev.map((c) => (c.name === platform ? { ...c, handle: accountName.startsWith('@') ? accountName : `@${accountName}`, connected: true } : c)));
    } else {
      setChannels((prev) => [...prev, { name: platform, handle: accountName.startsWith('@') ? accountName : `@${accountName}`, icon: plat.icon, color: '#5a6355', connected: true }]);
    }
    onToast(`${platform} connected as ${accountName}.`);
    setAccountName('');
    setConnectOpen(false);
  };

  const handleDuplicate = (post: Post) => {
    const dup: Post = { ...post, id: `p${Date.now()}`, title: `${post.title} (copy)`, status: 'Draft', time: 'Unscheduled' };
    setPosts((prev) => [dup, ...prev]);
    setPeekPost(null);
    onToast(`Duplicated "${post.title}".`);
  };

  const handleDelete = (post: Post) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    setPeekPost(null);
    onToast(`Deleted "${post.title}".`);
  };

  const openPost = (post: Post) => setPeekPost(post);

  return (
    <div className={styles.screen}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Publishing Overview</h1>
          <p className={styles.toolbarSub}>Plan, publish, and manage your brand&rsquo;s social content.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('marketing', 'mkt-calendar')}>
            <span className="material-symbols-outlined">calendar_month</span>
            Calendar
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('marketing', 'mkt-queue')}>
            <span className="material-symbols-outlined">outbox</span>
            Queue
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
            <span className="material-symbols-outlined">add</span>
            Create post
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.stats}>
          {STATS.map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
              <span className={`${styles.statDelta} ${s.tone === 'pos' ? styles.statDeltaPos : ''}`}>{s.delta}</span>
            </div>
          ))}
        </div>

        {/* Main split */}
        <div className={styles.mainSplit}>
          {/* Upcoming posts */}
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionHeadLeft}>
                <h2 className={styles.sectionTitle}>Next to publish</h2>
                <p className={styles.sectionSub}>{posts.length} upcoming · click a row to view</p>
              </div>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => onNavigate?.('marketing', 'mkt-queue')}>
                View all
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div className={styles.postList}>
              {posts.length === 0 ? (
                <div className={styles.empty}>
                  <span className="material-symbols-outlined">outbox</span>
                  <h3>No upcoming posts</h3>
                  <p>Create a post to fill your queue.</p>
                </div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className={styles.postRow} onClick={() => openPost(post)}>
                    <div className={styles.postChannel} style={{ background: post.color, color: '#fff' }}>
                      <span className="material-symbols-outlined">{post.icon}</span>
                    </div>
                    <div className={styles.postMain}>
                      <span className={styles.postTitle}>{post.title}</span>
                      <span className={styles.postMeta}>
                        <span className="material-symbols-outlined">share</span>
                        {post.channel}
                        <span className="material-symbols-outlined">schedule</span>
                        {post.time}
                      </span>
                    </div>
                    <div className={styles.postRight}>
                      {statusPill(post.status)}
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--mut)' }}>chevron_right</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right rail: quick actions + channels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadLeft}>
                  <h2 className={styles.sectionTitle}>Quick actions</h2>
                  <p className={styles.sectionSub}>Pick up where you left off</p>
                </div>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.chipRow}>
                  <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
                    <span className="material-symbols-outlined">edit_square</span>
                    Create a post
                  </button>
                  <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-library')}>
                    <span className="material-symbols-outlined">perm_media</span>
                    Upload media
                  </button>
                  <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-performance')}>
                    <span className="material-symbols-outlined">insights</span>
                    View performance
                  </button>
                  <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-oversight')}>
                    <span className="material-symbols-outlined">fact_check</span>
                    Review queue
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <div className={styles.sectionHeadLeft}>
                  <h2 className={styles.sectionTitle}>Connected channels</h2>
                  <p className={styles.sectionSub}>{channels.filter((c) => c.connected).length} of {channels.length} active</p>
                </div>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConnectOpen(true)}>
                  <span className="material-symbols-outlined">add_link</span>
                  Connect
                </button>
              </div>
              <div className={styles.sectionBody}>
                {channels.map((c) => (
                  <div key={c.name} className={styles.channelRow}>
                    <div className={styles.channelIcon} style={{ background: c.color }}>
                      <span className="material-symbols-outlined">{c.icon}</span>
                    </div>
                    <div className={styles.channelMain}>
                      <div className={styles.channelName}>{c.name}</div>
                      <div className={styles.channelHandle}>{c.handle}</div>
                    </div>
                    {c.connected ? (
                      <span className={styles.channelStatus}>
                        <span className={styles.dot} />
                        Connected
                      </span>
                    ) : (
                      <span className={`${styles.pill} ${styles.pillGray}`}>Offline</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Peek drawer */}
      {peekPost && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekPost(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekPost.title}</h3>
                <p className={styles.peekHeadSub}>{peekPost.channel} · {peekPost.time}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekPost(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.peekBody}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{peekPost.copy}</p>
              <div className={styles.peekField}>
                <span className={styles.peekLabel}>Status</span>
                <span className={styles.peekValue}>{statusPill(peekPost.status)}</span>
              </div>
              <div className={styles.peekField}>
                <span className={styles.peekLabel}>Channel</span>
                <span className={styles.peekValue}>{peekPost.channel}</span>
              </div>
              <div className={styles.peekField}>
                <span className={styles.peekLabel}>Scheduled</span>
                <span className={styles.peekValue}>{peekPost.time}</span>
              </div>
              <div className={styles.peekField}>
                <span className={styles.peekLabel}>Post ID</span>
                <span className={styles.peekValue}>{peekPost.id}</span>
              </div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleDelete(peekPost)}>
                <span className="material-symbols-outlined">delete</span>
                Delete
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => handleDuplicate(peekPost)}>
                <span className="material-symbols-outlined">content_copy</span>
                Duplicate
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPeekPost(null); onNavigate?.('marketing', 'mkt-create-content'); }}>
                <span className="material-symbols-outlined">edit</span>
                Edit
              </button>
            </div>
          </div>
        </>
      )}

      {/* Connect channel modal */}
      {connectOpen && (
        <div className={styles.modalScrim} onClick={() => setConnectOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Connect a channel</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setConnectOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Select a platform</label>
                <div className={styles.platformGrid}>
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.platformOpt} ${platform === p.id ? styles.platformOptActive : ''}`}
                      onClick={() => setPlatform(p.id)}
                    >
                      <span className="material-symbols-outlined">{p.icon}</span>
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Account name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. @unsaidmemories"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setConnectOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConnect}>
                <span className="material-symbols-outlined">link</span>
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
