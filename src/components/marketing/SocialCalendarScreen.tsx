'use client';

/**
 * Social Calendar — month grid view of scheduled posts.
 * Source: publishing overview.html #page-calendar section.
 */
import { useState } from 'react';
import { PageHeader } from './MarketingPrimitives';
import styles from './MarketingPrimitives.module.css';

interface SocialCalendarScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SCHEDULED_POSTS: Record<string, { title: string; channel: string; color: string }[]> = {
  '2026-10-28': [{ title: 'October product spotlight', channel: 'Instagram', color: '#a45a87' }],
  '2026-10-29': [{ title: 'Weekly company update', channel: 'LinkedIn', color: '#4a7b9b' }],
  '2026-10-31': [{ title: 'Behind the scenes', channel: 'TikTok', color: '#27353a' }, { title: 'Holiday teaser', channel: 'Instagram', color: '#a45a87' }],
  '2026-11-01': [{ title: 'New hoodie drop', channel: 'TikTok', color: '#27353a' }],
  '2026-11-03': [{ title: 'Customer spotlight', channel: 'Instagram', color: '#a45a87' }],
  '2026-11-05': [{ title: 'Black Friday teaser', channel: 'Facebook', color: '#4b77b8' }],
  '2026-11-07': [{ title: 'Weekend meme', channel: 'TikTok', color: '#27353a' }],
};

export default function SocialCalendarScreen({ onToast, onNavigate }: SocialCalendarScreenProps) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(9); // October
  const [channelFilter, setChannelFilter] = useState('All');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Calendar"
        subtitle="See what's planned across all your connected channels."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={prevMonth}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <strong className="text-sm min-w-[110px] text-center">{MONTHS[month]} {year}</strong>
            <button type="button" className={styles.btnOutline} onClick={nextMonth}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
            <button type="button" className={styles.btnPrimary} onClick={() => onNavigate?.('marketing', 'mkt-create-content')}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Create post
            </button>
          </>
        }
      />

      <div className="bg-white rounded-xl border border-dad9dd overflow-hidden">
        <div className="flex items-center justify-between px-4 h-11 border-b border-dad9dd">
          <div className="flex items-center gap-1">
            <button className="px-3 text-xs font-semibold border-b-2 border-0a6400 text-1a1c1e">Month</button>
            <button className="px-3 text-xs font-semibold border-b-2 border-transparent text-5a6355" onClick={() => onToast('Week view')}>Week</button>
            <button className="px-3 text-xs font-semibold border-b-2 border-transparent text-5a6355" onClick={() => onToast('List view')}>List</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-5a6355">Channel</span>
            <select
              className="h-7 px-2 border border-dad9dd rounded text-xs bg-faf9fc"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option>All</option>
              <option>Instagram</option>
              <option>Facebook</option>
              <option>LinkedIn</option>
              <option>TikTok</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <div className="min-w-[680px] grid grid-cols-7 border-l border-t border-dad9dd">
            {DAY_NAMES.map((d) => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-5a6355 border-r border-b border-dad9dd bg-faf9fc">
                {d}
              </div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[126px] border-r border-b border-dad9dd bg-faf9fc" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = getDateStr(day);
              const posts = SCHEDULED_POSTS[dateStr] || [];
              const filtered = channelFilter === 'All' ? posts : posts.filter((p) => p.channel === channelFilter);
              const isToday = day === 28 && month === 9 && year === 2026;
              return (
                <div key={day} className="min-h-[126px] border-r border-b border-dad9dd p-2">
                  <div className="text-xs font-semibold mb-1 flex justify-between">
                    <span className={isToday ? 'text-0a6400 bg-e8f5e9 w-6 h-6 rounded-full flex items-center justify-center' : 'text-5a6355'}>
                      {day}
                    </span>
                  </div>
                  {filtered.map((post, j) => (
                    <div
                      key={j}
                      className="mt-1 rounded border-l-[3px] bg-edf7f6 px-1.5 py-1 text-[9px] cursor-pointer hover:bg-dce8e6"
                      style={{ borderLeftColor: post.color, color: post.color }}
                      onClick={() => onToast(`Post: ${post.title}`)}
                    >
                      {post.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
