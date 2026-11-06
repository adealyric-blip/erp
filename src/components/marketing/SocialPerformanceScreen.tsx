'use client';

/**
 * Social Performance — analytics for published content.
 * Source: publishing overview.html #page-performance section.
 */
import { useState } from 'react';
import { PageHeader, KpiStrip } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface SocialPerformanceScreenProps {
  onToast: (msg: string) => void;
}

const KPI_DATA = [
  { label: 'Total reach', value: '128.4K', delta: '+8.4% vs previous period', deltaTone: 'pos' as const },
  { label: 'Engagement', value: '6.8%', delta: 'Across connected channels', deltaTone: 'neutral' as const },
  { label: 'Link clicks', value: '2,416', delta: 'Tracked post link clicks', deltaTone: 'neutral' as const },
  { label: 'Published posts', value: '48', delta: 'In selected period', deltaTone: 'neutral' as const },
];

const CHANNEL_PERFORMANCE = [
  { name: 'Instagram', reach: '62.4K', engagement: '8.2%', clicks: '1,240', posts: '24', color: '#a45a87', pct: 49 },
  { name: 'TikTok', reach: '38.2K', engagement: '7.9%', clicks: '680', posts: '12', color: '#27353a', pct: 30 },
  { name: 'LinkedIn', reach: '18.6K', engagement: '4.1%', clicks: '320', posts: '8', color: '#4a7b9b', pct: 14 },
  { name: 'Facebook', reach: '9.2K', engagement: '3.2%', clicks: '176', posts: '4', color: '#4b77b8', pct: 7 },
];

const TOP_CONTENT = [
  { rank: 1, title: 'Product launch announcement', channel: 'Instagram', engagement: '8.2%' },
  { rank: 2, title: 'Behind the scenes video', channel: 'TikTok', engagement: '7.9%' },
  { rank: 3, title: 'Team spotlight', channel: 'LinkedIn', engagement: '6.4%' },
  { rank: 4, title: 'Holiday gift guide carousel', channel: 'Instagram', engagement: '5.8%' },
  { rank: 5, title: 'Customer spotlight: Lakeside', channel: 'Instagram', engagement: '5.2%' },
];

export default function SocialPerformanceScreen({ onToast }: SocialPerformanceScreenProps) {
  const [range, setRange] = useState('Last 30 days');

  const handleExport = () => {
    exportToCsv(CHANNEL_PERFORMANCE as unknown as Record<string, unknown>[], [
      { key: 'name', label: 'Channel' },
      { key: 'reach', label: 'Reach' },
      { key: 'engagement', label: 'Engagement' },
      { key: 'clicks', label: 'Link clicks' },
      { key: 'posts', label: 'Published posts' },
    ], 'social-performance');
    onToast('Exported performance data to CSV.');
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Performance"
        subtitle="Understand how your published content is performing across channels."
        actions={
          <>
            <select
              className="h-8 px-2 border border-dad9dd rounded text-sm bg-faf9fc"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option>Last 30 days</option>
              <option>Last 7 days</option>
              <option>This quarter</option>
            </select>
            <button type="button" className={styles.btnOutline} onClick={handleExport}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
              Export
            </button>
          </>
        }
      />

      <KpiStrip items={KPI_DATA} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Channel performance */}
        <div className="bg-white rounded-xl border border-dad9dd">
          <div className="px-5 py-3 border-b border-dad9dd">
            <h2 className="text-base font-semibold">Channel performance</h2>
            <p className="text-xs text-5a6355">Reach, engagement, and clicks by platform</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            {CHANNEL_PERFORMANCE.map((ch) => (
              <div key={ch.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{ch.name}</span>
                  <span className="font-semibold">{ch.reach}</span>
                </div>
                <div className="h-2 bg-f4f3f7 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ch.pct}%`, background: ch.color }} />
                </div>
                <div className="flex gap-4 mt-1 text-xs text-5a6355">
                  <span>Engagement: {ch.engagement}</span>
                  <span>Clicks: {ch.clicks}</span>
                  <span>Posts: {ch.posts}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top content */}
        <div className="bg-white rounded-xl border border-dad9dd">
          <div className="px-5 py-3 border-b border-dad9dd">
            <h2 className="text-base font-semibold">Top content</h2>
            <p className="text-xs text-5a6355">Highest engagement this month</p>
          </div>
          <div className="p-5 divide-y divide-dad9dd">
            {TOP_CONTENT.map((c) => (
              <div key={c.rank} className="flex items-center gap-3 py-2">
                <div className="w-10 h-10 rounded-lg bg-f4f3f7 flex items-center justify-center text-sm font-semibold text-5a6355">
                  {String(c.rank).padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-5a6355">{c.channel} · {c.engagement} engagement</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
