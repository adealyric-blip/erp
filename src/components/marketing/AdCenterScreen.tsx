'use client';

/**
 * Ad Center — advertising hub overview.
 * Minimalist rebuild: quick-create chips, compact stats, spend bars,
 * top ad sets table, real tracking pixels modal.
 */
import { useState } from 'react';
import styles from './AdCenter.module.css';

interface AdCenterScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const STATS = [
  { label: 'Total spend (30d)', value: '$4,280', delta: '+12% vs last 30d', tone: '' },
  { label: 'Revenue attributed', value: '$18,420', delta: '3.3x ROAS', tone: 'pos' },
  { label: 'Active campaigns', value: '8', delta: '2 paused', tone: '' },
  { label: 'Avg. CTR', value: '2.4%', delta: '+0.3% vs last 30d', tone: 'pos' },
];

const NETWORKS = [
  { name: 'Meta (Facebook + Instagram)', spend: 2400, pct: 56, color: '#0077c5' },
  { name: 'TikTok', spend: 1200, pct: 28, color: '#010101' },
  { name: 'Google Ads', spend: 680, pct: 16, color: '#1e5a38' },
];

const TOP_ADSETS = [
  { name: 'Holiday Tee — Lookalike 1%', spend: '$1,240', roas: '4.2x', ctr: '3.1%', status: 'Active' },
  { name: 'Mug Collection — Retarget', spend: '$860', roas: '3.8x', ctr: '2.8%', status: 'Active' },
  { name: 'Brand awareness — TikTok', spend: '$680', roas: '2.1x', ctr: '1.9%', status: 'Active' },
  { name: 'Holiday Crewneck — Broad', spend: '$420', roas: '5.1x', ctr: '3.6%', status: 'Paused' },
];

const PIXELS = [
  { name: 'Meta Pixel', id: '892345678901234', lastFired: '2 min ago', status: 'Active' as const },
  { name: 'TikTok Pixel', id: 'C8K9M2N7P4Q1R6S3', lastFired: '15 min ago', status: 'Active' as const },
  { name: 'Google Ads Tag', id: 'AW-CONV-12345', lastFired: '1 hour ago', status: 'Warning' as const },
];

export default function AdCenterScreen({ onNavigate }: AdCenterScreenProps) {
  const [pixelsOpen, setPixelsOpen] = useState(false);

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Ad Center</h1>
          <p className={styles.toolbarSub}>Manage campaigns, creatives, audiences, and tracking across all ad networks.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPixelsOpen(true)}>
            <span className="material-symbols-outlined">code</span> Tracking pixels
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Quick create */}
        <div className={styles.chipRow}>
          <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-campaigns')}><span className="material-symbols-outlined">campaign</span> New campaign</button>
          <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-adsets')}><span className="material-symbols-outlined">tune</span> New ad set</button>
          <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-creatives')}><span className="material-symbols-outlined">image</span> New creative</button>
          <button type="button" className={styles.chip} onClick={() => onNavigate?.('marketing', 'mkt-audiences')}><span className="material-symbols-outlined">group</span> New audience</button>
          <button type="button" className={styles.chip} onClick={() => setPixelsOpen(true)}><span className="material-symbols-outlined">code</span> New pixel</button>
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

        <div className={styles.split}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <h2 className={styles.cardTitle}>Spend by network</h2>
                <p className={styles.cardSub}>Last 30 days</p>
              </div>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('marketing', 'mkt-ad-spend')}>View spend</button>
            </div>
            <div className={styles.cardBody}>
              {NETWORKS.map((n) => (
                <div key={n.name} className={styles.netBar}>
                  <div className={styles.netBarHead}>
                    <span className={styles.netBarName}>{n.name}</span>
                    <span className={styles.netBarVal}>${n.spend.toLocaleString()}</span>
                  </div>
                  <div className={styles.netBarTrack}>
                    <div className={styles.netBarFill} style={{ width: `${n.pct}%`, background: n.color }} />
                  </div>
                  <div className={styles.netBarMeta}>{n.pct}% of total spend</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadLeft}>
                <h2 className={styles.cardTitle}>Top ad sets</h2>
                <p className={styles.cardSub}>By ROAS this month · click a row</p>
              </div>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => onNavigate?.('marketing', 'mkt-adsets')}>View all</button>
            </div>
            <table className={styles.table}>
              <thead><tr><th>Ad set</th><th className={styles.right}>Spend</th><th className={styles.right}>ROAS</th><th className={styles.right}>CTR</th></tr></thead>
              <tbody>
                {TOP_ADSETS.map((a, i) => (
                  <tr key={i} onClick={() => onNavigate?.('marketing', 'mkt-adsets')}>
                    <td>{a.name}</td>
                    <td className={styles.right}>{a.spend}</td>
                    <td className={`${styles.right} ${styles.roas}`}>{a.roas}</td>
                    <td className={styles.right}>{a.ctr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pixels modal */}
      {pixelsOpen && (
        <div className={styles.modalScrim} onClick={() => setPixelsOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Tracking pixels</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setPixelsOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              {PIXELS.map((p) => (
                <div key={p.id} className={styles.pixelRow}>
                  <div className={styles.pixelMain}>
                    <span className={styles.pixelName}>{p.name}</span>
                    <span className={styles.pixelMeta}>ID: {p.id} · Last fired: {p.lastFired}</span>
                  </div>
                  <span className={`${styles.pill} ${p.status === 'Active' ? styles.pillGreen : styles.pillOrange}`}>{p.status}</span>
                </div>
              ))}
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPixelsOpen(false)}>Close</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setPixelsOpen(false); onNavigate?.('marketing', 'mkt-pixels'); }}>Manage pixels</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
