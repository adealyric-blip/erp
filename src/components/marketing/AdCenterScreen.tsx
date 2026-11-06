'use client';

/**
 * Ad Center — advertising hub overview.
 * Source: upload/marketing_extracted/Marketing/adcenter.html.
 *
 * View toggle: Overview / Campaigns / Creatives / Audiences.
 * KPI strip, create actions, tracking pixels modal.
 */
import { useState } from 'react';
import { PageHeader, KpiStrip, ViewToggle, CreateActionsRow, Modal } from './MarketingPrimitives';
import styles from './MarketingPrimitives.module.css';

interface AdCenterScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const KPI_DATA = [
  { label: 'Total spend (30d)', value: '$4,280', delta: '+12% vs last 30d', deltaTone: 'neutral' as const },
  { label: 'Revenue attributed', value: '$18,420', delta: '3.3x ROAS', deltaTone: 'pos' as const },
  { label: 'Active campaigns', value: '8', delta: '2 paused', deltaTone: 'neutral' as const },
  { label: 'Avg. CTR', value: '2.4%', delta: '+0.3% vs last 30d', deltaTone: 'pos' as const },
];

const NETWORK_BARS = [
  { name: 'Meta (Facebook + Instagram)', spend: 2400, pct: 56, color: '#0077c5' },
  { name: 'TikTok', spend: 1200, pct: 28, color: '#27353a' },
  { name: 'Google Ads', spend: 680, pct: 16, color: '#1e5a38' },
];

const TOP_ADSETS = [
  { name: 'Holiday Tee — Lookalike 1%', spend: '$1,240', roas: '4.2x', ctr: '3.1%', status: 'Active' },
  { name: 'Mug Collection — Retarget', spend: '$860', roas: '3.8x', ctr: '2.8%', status: 'Active' },
  { name: 'Brand awareness — TikTok', spend: '$680', roas: '2.1x', ctr: '1.9%', status: 'Active' },
  { name: 'Holiday Crewneck — Broad', spend: '$420', roas: '5.1x', ctr: '3.6%', status: 'Paused' },
];

export default function AdCenterScreen({ onToast, onNavigate }: AdCenterScreenProps) {
  const [view, setView] = useState<'overview' | 'campaigns' | 'creatives' | 'audiences'>('overview');
  const [pixelsModalOpen, setPixelsModalOpen] = useState(false);

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Advertising']}
        title="Ad Center"
        subtitle="Manage campaigns, creatives, audiences, and tracking across all ad networks."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setPixelsModalOpen(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>code</span>
              Tracking pixels
            </button>
            <ViewToggle
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'campaigns', label: 'Campaigns' },
                { id: 'creatives', label: 'Creatives' },
                { id: 'audiences', label: 'Audiences' },
              ]}
              active={view}
              onChange={setView}
            />
          </>
        }
      />

      <KpiStrip items={KPI_DATA} />

      <CreateActionsRow
        actions={[
          { label: 'Campaign', icon: 'campaign', onClick: () => onNavigate?.('marketing', 'mkt-campaigns') },
          { label: 'Ad set', icon: 'tune', onClick: () => onNavigate?.('marketing', 'mkt-adsets') },
          { label: 'Creative', icon: 'image', onClick: () => onNavigate?.('marketing', 'mkt-creatives') },
          { label: 'Audience', icon: 'group', onClick: () => onNavigate?.('marketing', 'mkt-audiences') },
          { label: 'Pixel', icon: 'code', onClick: () => setPixelsModalOpen(true) },
        ]}
        onShowAll={() => onToast('Opening create flyout…')}
      />

      {view === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {/* Spend by network */}
          <div className="bg-white rounded-xl border border-dad9dd p-5">
            <h2 className="text-base font-semibold mb-1">Spend by network</h2>
            <p className="text-xs text-5a6355 mb-4">Last 30 days</p>
            <div className="flex flex-col gap-4">
              {NETWORK_BARS.map((n) => (
                <div key={n.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{n.name}</span>
                    <span className="font-semibold">${n.spend.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-f4f3f7 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${n.pct}%`, background: n.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top ad sets */}
          <div className="bg-white rounded-xl border border-dad9dd p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Top ad sets</h2>
                <p className="text-xs text-5a6355">By ROAS this month</p>
              </div>
              <button type="button" className={styles.btnOutline} onClick={() => onNavigate?.('marketing', 'mkt-adsets')}>
                View all →
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dad9dd text-xs text-5a6355 uppercase">
                  <th className="text-left py-2 font-semibold">Ad set</th>
                  <th className="text-right py-2 font-semibold">Spend</th>
                  <th className="text-right py-2 font-semibold">ROAS</th>
                  <th className="text-right py-2 font-semibold">CTR</th>
                </tr>
              </thead>
              <tbody>
                {TOP_ADSETS.map((a, i) => (
                  <tr key={i} className="border-b border-f4f3f7 hover:bg-f9f8fb cursor-pointer" onClick={() => onNavigate?.('marketing', 'mkt-adsets')}>
                    <td className="py-3">{a.name}</td>
                    <td className="py-3 text-right">{a.spend}</td>
                    <td className="py-3 text-right font-semibold">{a.roas}</td>
                    <td className="py-3 text-right">{a.ctr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'campaigns' && (
        <div className="bg-white rounded-xl border border-dad9dd p-8 text-center text-5a6355">
          <span className="material-symbols-outlined text-4xl opacity-30 mb-2">campaign</span>
          <p className="text-sm">Campaign list is on the dedicated Campaigns page.</p>
          <button type="button" className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={() => onNavigate?.('marketing', 'mkt-campaigns')}>
            Go to Campaigns →
          </button>
        </div>
      )}

      {view === 'creatives' && (
        <div className="bg-white rounded-xl border border-dad9dd p-8 text-center text-5a6355">
          <span className="material-symbols-outlined text-4xl opacity-30 mb-2">image</span>
          <p className="text-sm">Creative list is on the dedicated Creatives page.</p>
          <button type="button" className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={() => onNavigate?.('marketing', 'mkt-creatives')}>
            Go to Creatives →
          </button>
        </div>
      )}

      {view === 'audiences' && (
        <div className="bg-white rounded-xl border border-dad9dd p-8 text-center text-5a6355">
          <span className="material-symbols-outlined text-4xl opacity-30 mb-2">group</span>
          <p className="text-sm">Audience list is on the dedicated Audiences page.</p>
          <button type="button" className={styles.btnPrimary} style={{ marginTop: 12 }} onClick={() => onNavigate?.('marketing', 'mkt-audiences')}>
            Go to Audiences →
          </button>
        </div>
      )}

      {/* Tracking pixels modal */}
      <Modal
        open={pixelsModalOpen}
        onClose={() => setPixelsModalOpen(false)}
        title="Tracking Pixels"
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setPixelsModalOpen(false)}>Close</button>
            <button type="button" className={styles.btnPrimary} onClick={() => { setPixelsModalOpen(false); onNavigate?.('marketing', 'mkt-pixels'); }}>
              Manage pixels →
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="border border-dad9dd rounded-lg p-3 flex items-center justify-between">
            <div>
              <b className="text-sm">Meta Pixel</b>
              <p className="text-xs text-5a6355">ID: 892345678901234 · Last fired: 2 min ago</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-e8f5e9 text-2e7d32 font-semibold">Active</span>
          </div>
          <div className="border border-dad9dd rounded-lg p-3 flex items-center justify-between">
            <div>
              <b className="text-sm">TikTok Pixel</b>
              <p className="text-xs text-5a6355">ID: C8K9M2N7P4Q1R6S3 · Last fired: 15 min ago</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-e8f5e9 text-2e7d32 font-semibold">Active</span>
          </div>
          <div className="border border-dad9dd rounded-lg p-3 flex items-center justify-between">
            <div>
              <b className="text-sm">Google Ads Tag</b>
              <p className="text-xs text-5a6355">ID: AW-CONV-12345 · Last fired: 1 hour ago</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-fff3e0 text-a85a00 font-semibold">Warning</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
