'use client';

/**
 * Social Publishing Queue — list of scheduled/published/draft/failed posts.
 * Source: publishing overview.html #page-queue section.
 */
import { useState } from 'react';
import { PageHeader } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface SocialQueueScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const QUEUE_POSTS = [
  { title: 'October product spotlight', channel: 'Instagram', date: 'Oct 31 · 2:00 PM', status: 'Scheduled' },
  { title: 'Behind the scenes', channel: 'TikTok', date: 'Nov 1 · 10:00 AM', status: 'Scheduled' },
  { title: 'Weekly company update', channel: 'LinkedIn', date: 'Nov 3 · 9:00 AM', status: 'Scheduled' },
  { title: 'New hoodie drop', channel: 'TikTok', date: 'Nov 1 · 10:00 AM', status: 'Scheduled' },
  { title: 'Customer spotlight', channel: 'Instagram', date: 'Nov 5 · 12:00 PM', status: 'Scheduled' },
  { title: 'Holiday gift guide', channel: 'Facebook', date: 'Oct 28 · 4:00 PM', status: 'Published' },
  { title: 'Flash sale announcement', channel: 'Instagram', date: 'Oct 25 · 6:00 PM', status: 'Published' },
  { title: 'Supplier spotlight', channel: 'LinkedIn', date: 'Oct 27 · 11:00 AM', status: 'Published' },
  { title: 'Black Friday teaser', channel: 'TikTok', date: '—', status: 'Draft' },
  { title: 'Weekend meme post', channel: 'TikTok', date: '—', status: 'Draft' },
  { title: 'Pinterest pin — Fall collection', channel: 'Pinterest', date: 'Oct 20 · 3:00 PM', status: 'Failed' },
];

const STATUS_TABS = [
  { id: 'all', label: 'All', count: 11 },
  { id: 'scheduled', label: 'Scheduled', count: 5 },
  { id: 'published', label: 'Published', count: 3 },
  { id: 'draft', label: 'Drafts', count: 2 },
  { id: 'failed', label: 'Failed', count: 1 },
];

export default function SocialQueueScreen({ onToast, onNavigate }: SocialQueueScreenProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = QUEUE_POSTS.filter((p) => {
    const tabMatch = activeTab === 'all' || p.status.toLowerCase() === activeTab;
    const searchMatch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'title', label: 'Content' },
      { key: 'channel', label: 'Channel' },
      { key: 'date', label: 'Publish date' },
      { key: 'status', label: 'Status' },
    ], 'publishing-queue');
    onToast(`Exported ${filtered.length} posts to CSV.`);
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Publishing queue"
        subtitle="Track scheduled posts, drafts, and publishing outcomes."
        actions={
          <button type="button" className={styles.btnPrimary} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Create post
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-dad9dd overflow-hidden">
        <div className="flex items-center justify-between px-4 h-11 border-b border-dad9dd">
          <div className="flex items-center gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-3 text-xs font-semibold border-b-2 cursor-pointer ${
                  activeTab === tab.id ? 'border-0a6400 text-1a1c1e' : 'border-transparent text-5a6355'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-5a6355">{filtered.length} items</span>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-dad9dd">
          <input
            className="flex-1 min-w-[200px] h-8 px-3 border border-dad9dd rounded text-sm bg-faf9fc"
            type="text"
            placeholder="Search queue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className={styles.btnOutline} onClick={handleExport}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-faf9fc text-xs text-5a6355 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-semibold">Content</th>
                <th className="px-4 py-2 font-semibold">Channel</th>
                <th className="px-4 py-2 font-semibold">Publish date</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dad9dd">
              {filtered.map((post, i) => (
                <tr
                  key={i}
                  className="hover:bg-f9f8fb cursor-pointer"
                  onClick={() => onToast(`Opening: ${post.title}`)}
                >
                  <td className="px-4 py-3 font-medium">{post.title}</td>
                  <td className="px-4 py-3">{post.channel}</td>
                  <td className="px-4 py-3 text-5a6355">{post.date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      post.status === 'Scheduled' ? 'bg-e8f5e9 text-2e7d32' :
                      post.status === 'Published' ? 'bg-e1effa text-0077c5' :
                      post.status === 'Draft' ? 'bg-f4f3f7 text-5a6355' :
                      'bg-ffdad6 text-ba1a1a'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className={styles.btnIcon} onClick={(e) => { e.stopPropagation(); onToast(`Menu: ${post.title}`); }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_horiz</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
