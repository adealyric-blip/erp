'use client';

/**
 * Social Performance — analytics for published content.
 * Minimalist rebuild: compact stats + channel bars + top content list (click → peek).
 */
import { useState } from 'react';
import styles from './SocialPerformance.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface SocialPerformanceScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const STATS = [
  { label: 'Total reach', value: '128.4K', delta: '+8.4% vs previous', tone: 'pos' },
  { label: 'Engagement', value: '6.8%', delta: 'Across channels', tone: '' },
  { label: 'Link clicks', value: '2,416', delta: 'Tracked post clicks', tone: '' },
  { label: 'Published', value: '48', delta: 'In selected period', tone: '' },
];

const CHANNELS = [
  { name: 'Instagram', reach: '62.4K', engagement: '8.2%', clicks: '1,240', posts: '24', color: '#c13584', pct: 49 },
  { name: 'TikTok', reach: '38.2K', engagement: '7.9%', clicks: '680', posts: '12', color: '#010101', pct: 30 },
  { name: 'LinkedIn', reach: '18.6K', engagement: '4.1%', clicks: '320', posts: '8', color: '#0a66c2', pct: 14 },
  { name: 'Facebook', reach: '9.2K', engagement: '3.2%', clicks: '176', posts: '4', color: '#1877f2', pct: 7 },
];

const TOP_CONTENT = [
  { rank: 1, title: 'Product launch announcement', channel: 'Instagram', engagement: '8.2%', reach: '24.1K', clicks: '680', date: 'Oct 28' },
  { rank: 2, title: 'Behind the scenes video', channel: 'TikTok', engagement: '7.9%', reach: '18.4K', clicks: '420', date: 'Oct 25' },
  { rank: 3, title: 'Team spotlight', channel: 'LinkedIn', engagement: '6.4%', reach: '9.2K', clicks: '210', date: 'Oct 22' },
  { rank: 4, title: 'Holiday gift guide carousel', channel: 'Instagram', engagement: '5.8%', reach: '14.6K', clicks: '320', date: 'Oct 18' },
  { rank: 5, title: 'Customer spotlight: Lakeside', channel: 'Instagram', engagement: '5.2%', reach: '11.2K', clicks: '180', date: 'Oct 12' },
];

export default function SocialPerformanceScreen({ onToast, onNavigate }: SocialPerformanceScreenProps) {
  const [range, setRange] = useState('Last 30 days');
  const [peekItem, setPeekItem] = useState<typeof TOP_CONTENT[number] | null>(null);

  const handleExport = () => {
    exportToCsv(CHANNELS as unknown as Record<string, unknown>[], [
      { key: 'name', label: 'Channel' },
      { key: 'reach', label: 'Reach' },
      { key: 'engagement', label: 'Engagement' },
      { key: 'clicks', label: 'Link clicks' },
      { key: 'posts', label: 'Published posts' },
    ], 'social-performance');
    onToast('Exported performance data to CSV.');
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Performance</h1>
          <p className={styles.toolbarSub}>How your published content is performing across channels.</p>
        </div>
        <div className={styles.toolbarRight}>
          <select className={styles.select} value={range} onChange={(e) => setRange(e.target.value)}>
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>This quarter</option>
          </select>
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

        <div className={styles.split}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <h2 className={styles.cardTitle}>Channel performance</h2>
                <p className={styles.cardSub}>Reach, engagement, and clicks by platform</p>
              </div>
            </div>
            <div className={styles.cardBody}>
              {CHANNELS.map((ch) => (
                <div key={ch.name} className={styles.chBar}>
                  <div className={styles.chBarHead}>
                    <span className={styles.chBarName}><span className={styles.chBarDot} style={{ background: ch.color }} />{ch.name}</span>
                    <span className={styles.chBarVal}>{ch.reach}</span>
                  </div>
                  <div className={styles.chBarTrack}>
                    <div className={styles.chBarFill} style={{ width: `${ch.pct}%`, background: ch.color }} />
                  </div>
                  <div className={styles.chBarMeta}>
                    <span>Engagement: {ch.engagement}</span>
                    <span>Clicks: {ch.clicks}</span>
                    <span>Posts: {ch.posts}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <h2 className={styles.cardTitle}>Top content</h2>
                <p className={styles.cardSub}>Highest engagement this month · click to view</p>
              </div>
            </div>
            <div className={styles.cardBody} style={{ padding: '4px 16px' }}>
              <div className={styles.topList}>
                {TOP_CONTENT.map((c) => (
                  <div key={c.rank} className={styles.topRow} onClick={() => setPeekItem(c)}>
                    <span className={styles.topRank}>{String(c.rank).padStart(2, '0')}</span>
                    <div className={styles.topMain}>
                      <div className={styles.topTitle}>{c.title}</div>
                      <div className={styles.topMeta}>{c.channel} · {c.date}</div>
                    </div>
                    <span className={styles.topEng}>{c.engagement}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--mut)' }}>chevron_right</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Peek */}
      {peekItem && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekItem(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peekItem.title}</h3>
                <p className={styles.peekHeadSub}>{peekItem.channel} · {peekItem.date}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekItem(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Rank</span><span className={styles.peekValue}>#{peekItem.rank}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Engagement rate</span><span className={styles.peekValue} style={{ color: 'var(--ok)' }}>{peekItem.engagement}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Reach</span><span className={styles.peekValue}>{peekItem.reach}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Link clicks</span><span className={styles.peekValue}>{peekItem.clicks}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Channel</span><span className={styles.peekValue}>{peekItem.channel}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Published</span><span className={styles.peekValue}>{peekItem.date}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => { setPeekItem(null); onNavigate?.('marketing', 'mkt-queue'); }}>
                <span className="material-symbols-outlined">outbox</span> View in queue
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPeekItem(null); onNavigate?.('marketing', 'mkt-create-content'); }}>
                <span className="material-symbols-outlined">content_copy</span> Replicate
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
