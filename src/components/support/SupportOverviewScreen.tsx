'use client';
/* SupportOverviewScreen — 1:1 port of upload/support_extract/Support/support overview.html
   The HTML's <style> block lives in src/app/support.css (+ marketing.css globals).
   The HTML's <body> is ported to JSX below; class names are identical.
   The HTML's <script> is ported to React state + handlers below. */

interface SupportScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: import('@/data/shellData').DomainKey, screenId: string) => void;
}

/* ─── data (verbatim from HTML) ─── */
interface PriorityTicket {
  id: string;
  subject: string;
  requester: string;
  priority: 'High' | 'Normal' | 'Urgent';
  status: 'Open' | 'Pending';
}

const PRIORITY_TICKETS: PriorityTicket[] = [
  { id: 'SD-4821', subject: 'Unable to access account', requester: 'Olivia Rhys', priority: 'High', status: 'Open' },
  { id: 'SD-4820', subject: 'Refund request for order #8821', requester: 'Ethan Cole', priority: 'Normal', status: 'Pending' },
  { id: 'SD-4819', subject: 'App crashes on checkout', requester: 'Priya Shah', priority: 'Urgent', status: 'Open' },
];

/* Ticket volume chart bars (verbatim heights + day labels) */
const VOLUME_BARS = [40, 62, 53, 76, 58, 88, 68];
const VOLUME_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* Tickets by channel (verbatim) */
const CHANNELS: { label: string; pct: number; bar: string }[] = [
  { label: 'Email', pct: 42, bar: 'bg-qb-blue' },
  { label: 'Live chat', pct: 28, bar: 'bg-qb-teal' },
  { label: 'WhatsApp', pct: 17, bar: 'bg-qb-green' },
  { label: 'Phone', pct: 9, bar: 'bg-qb-maroon' },
];

export default function SupportOverviewScreen({ onToast, onNavigate }: SupportScreenProps) {
  return (
    <main className="px-6 pb-12">

      {/* ─── BREADCRUMB ─── */}
      <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-4 mb-2">
        <span>Support</span><span className="text-outline">/</span>
        <span className="text-on-surface font-semibold">Overview</span>
      </div>

      {/* ─── SUB-NAVIGATION (Standard Pills) ─── */}
      <div className="flex items-center gap-1 border-b border-surface-dim bg-white overflow-x-auto">
        <button className="px-3 py-2 text-label-md tab-underline active">Overview</button>
        <button className="px-3 py-2 text-label-md tab-underline text-on-surface-variant" onClick={() => onNavigate?.('support', 'agent-workspace')}>Omnichannel Inbox</button>
        <button className="px-3 py-2 text-label-md tab-underline text-on-surface-variant" onClick={() => onNavigate?.('support', 'tickets')}>Tickets</button>
        <button className="px-3 py-2 text-label-md tab-underline text-on-surface-variant" onClick={() => onToast('Navigate to Knowledge Base')}>Knowledge Base</button>
        <button className="px-3 py-2 text-label-md tab-underline text-on-surface-variant" onClick={() => onToast('Navigate to Analytics')}>Analytics</button>
      </div>

      {/* ─── PAGE HEADER ─── */}
      <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg">Support Overview</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Good afternoon, Jordan. Here is what&apos;s happening across your support operation today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container flex items-center gap-1" onClick={() => onToast('New ticket flow')}>
            <span className="material-symbols-outlined text-[16px]">add</span>Create ticket</button>
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={() => onToast('Export queued')}>
            <span className="material-symbols-outlined text-[16px]">download</span>Export</button>
        </div>
      </div>

      {/* ─── KPI STRIP ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-surface-dim p-4">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Open tickets</div>
          <div className="text-headline-lg mt-1 tabular-nums">128</div>
          <div className="text-[11px] text-secondary mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">trending_down</span>8.2% vs last week</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-4">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">First response time</div>
          <div className="text-headline-lg mt-1 tabular-nums">4m 32s</div>
          <div className="text-[11px] text-secondary mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">trending_down</span>12% improvement</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-4">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">CSAT score</div>
          <div className="text-headline-lg mt-1 tabular-nums">96.4%</div>
          <div className="text-[11px] text-secondary mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">trending_up</span>2.1% this month</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-4">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">SLA attainment</div>
          <div className="text-headline-lg mt-1 tabular-nums">98.2%</div>
          <div className="text-[11px] text-secondary mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">trending_up</span>0.8% this month</div>
        </div>
      </div>

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">

        {/* Ticket Volume (Chart) */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-surface-dim p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-headline-sm">Ticket volume</h2>
            <select className="h-7 px-2 border border-surface-dim rounded text-[11px] text-on-surface focus:outline-none">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className="flex items-end gap-2 h-40 pt-4 pb-2 border-b border-surface-dim">
            {VOLUME_BARS.map((h, i) => (
              <div key={i} className="flex-1 bg-qb-blue/20 rounded-t" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-on-surface-variant mt-2">
            {VOLUME_DAYS.map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* Tickets by Channel */}
        <div className="bg-white rounded-xl border border-surface-dim p-5">
          <h2 className="text-headline-sm mb-4">Tickets by channel</h2>
          <div className="space-y-3">
            {CHANNELS.map(c => (
              <div key={c.label}>
                <div className="flex justify-between text-[12px] mb-1"><span>{c.label}</span><span className="font-semibold">{c.pct}%</span></div>
                <div className="h-2 bg-surface-container-low rounded overflow-hidden"><div className={`h-full ${c.bar}`} style={{ width: `${c.pct}%` }}></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── PRIORITY TICKETS ─── */}
      <div className="bg-white rounded-xl border border-surface-dim overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-dim">
          <h2 className="text-headline-sm">Priority tickets</h2>
          <button className="text-[11px] font-semibold text-primary hover:underline" onClick={() => onToast('View all tickets')}>View all →</button>
        </div>
        <table className="w-full text-left text-body-sm">
          <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Ticket ID</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Requester</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Status</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-dim">
            {PRIORITY_TICKETS.map(t => (
              <tr key={t.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => onToast(`Open ticket ${t.id}`)}>
                <td className="px-3 py-2 font-mono text-primary font-medium">{t.id}</td>
                <td className="px-3 py-2 font-medium">{t.subject}</td>
                <td className="px-3 py-2 text-on-surface-variant">{t.requester}</td>
                <td className="px-3 py-2"><span className={`stat ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                <td className="px-3 py-2"><span className={`stat ${t.status.toLowerCase()}`}>{t.status}</span></td>
                <td className="px-2 py-2 text-right"><button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" onClick={e => { e.stopPropagation(); onToast('Row menu'); }}><span className="material-symbols-outlined text-[16px]">more_horiz</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  );
}
