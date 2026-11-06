'use client';

/**
 * Publishing Overview — the social publishing hub.
 * Source: upload/marketing_extracted/Marketing/publishing overview.html (overview section only).
 *
 * Layout: PageHeader → KPI strip → Quick actions grid → Next to publish list →
 * Attach to commerce & design section → Attach modal + Connect modal.
 */
import { useState } from 'react';
import {
  PageHeader,
  KpiStrip,
  QuickActions,
  Modal,
} from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface PublishingOverviewScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const KPI_DATA = [
  { label: 'Scheduled posts', value: '12', delta: 'Across all channels', deltaTone: 'neutral' as const },
  { label: 'Published this month', value: '48', delta: '+12% from last month', deltaTone: 'pos' as const },
  { label: 'Drafts', value: '6', delta: 'Ready for review', deltaTone: 'neutral' as const },
  { label: 'Connected channels', value: '4', delta: 'Across 4 platforms', deltaTone: 'neutral' as const },
];

const UPCOMING_POSTS = [
  { title: 'October product spotlight', channel: 'Instagram', time: 'Today 2:00 PM', status: 'Scheduled' },
  { title: 'New hoodie drop announcement', channel: 'TikTok', time: 'Tomorrow 10:00 AM', status: 'Scheduled' },
  { title: 'Behind the scenes — Studio redesign', channel: 'Facebook', time: 'Nov 3 4:00 PM', status: 'Scheduled' },
  { title: 'Customer spotlight: Lakeside Design', channel: 'Instagram', time: 'Nov 5 12:00 PM', status: 'Pending approval' },
];

export default function PublishingOverviewScreen({ onToast, onNavigate }: PublishingOverviewScreenProps) {
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [attachType, setAttachType] = useState<'product' | 'collection' | 'design'>('product');
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  const handleExport = () => {
    const cols = [
      { key: 'title', label: 'Post Title' },
      { key: 'channel', label: 'Channel' },
      { key: 'time', label: 'Scheduled Time' },
      { key: 'status', label: 'Status' },
    ];
    exportToCsv(UPCOMING_POSTS, cols, 'publishing-overview');
    onToast(`Exported ${UPCOMING_POSTS.length} posts to CSV.`);
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Publishing Overview"
        subtitle="Plan, publish, and manage your brand's social content from one place."
        actions={
          <>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => onNavigate?.('marketing', 'mkt-calendar')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
              View calendar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => onNavigate?.('marketing', 'mkt-create-content')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Create post
            </button>
          </>
        }
      />

      <KpiStrip items={KPI_DATA} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-6">
        {/* Quick actions */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-surface-dim p-5">
          <h2 className="text-base font-semibold mb-1">Quick actions</h2>
          <p className="text-xs text-on-surface-variant mb-4">Pick up where you left off</p>
          <QuickActions
            actions={[
              { title: 'Create a post', desc: 'Start with text and media', icon: 'edit_square', onClick: () => onNavigate?.('marketing', 'mkt-create-content') },
              { title: 'Schedule content', desc: 'Plan your publishing calendar', icon: 'calendar_month', onClick: () => onNavigate?.('marketing', 'mkt-calendar') },
              { title: 'Upload media', desc: 'Organize images and video', icon: 'perm_media', onClick: () => onNavigate?.('marketing', 'mkt-library') },
              { title: 'Connect a channel', desc: 'Manage provider accounts', icon: 'add_link', onClick: () => onNavigate?.('marketing', 'mkt-channels') },
              { title: 'Review queue', desc: 'Check upcoming posts', icon: 'outbox', onClick: () => onNavigate?.('marketing', 'mkt-queue') },
              { title: 'View performance', desc: 'See content results', icon: 'insights', onClick: () => onNavigate?.('marketing', 'mkt-performance') },
            ]}
          />
        </div>

        {/* Next to publish */}
        <div className="bg-white rounded-xl border border-surface-dim">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-dim">
            <div>
              <h2 className="text-base font-semibold">Next to publish</h2>
              <p className="text-xs text-on-surface-variant">Your upcoming content</p>
            </div>
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => onNavigate?.('marketing', 'mkt-queue')}
            >
              View queue
            </button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {UPCOMING_POSTS.map((post, i) => (
              <div
                key={i}
                className="border border-surface-dim rounded-lg p-3 cursor-pointer hover:bg-surface-container-low transition-colors"
                onClick={() => onToast(`Opening: ${post.title}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{post.title}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    post.status === 'Scheduled'
                      ? 'bg-e8f5e9 text-2e7d32'
                      : 'bg-fff3e0 text-a85a00'
                  }`}>
                    {post.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                  {post.time}
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>share</span>
                  {post.channel}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attach to commerce & design */}
      <div className="bg-white rounded-xl border border-surface-dim">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-dim">
          <div>
            <h2 className="text-base font-semibold">Attach to commerce &amp; design</h2>
            <p className="text-xs text-on-surface-variant">
              This social post can be created from or attached to a product, collection, or design.
            </p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full bg-eef5f4 text-0a6400 font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>extension</span>
            Integrated product
          </span>
        </div>
        <div className="p-5">
          <QuickActions
            actions={[
              { title: 'Attach a product', desc: 'Link a SKU to this content', icon: 'checkroom', onClick: () => { setAttachType('product'); setAttachModalOpen(true); } },
              { title: 'Attach a collection', desc: 'Feature a collection', icon: 'collections_bookmark', onClick: () => { setAttachType('collection'); setAttachModalOpen(true); } },
              { title: 'Open Design Studio', desc: 'Create a design from a product', icon: 'palette', onClick: () => onNavigate?.('design', 'new-design') },
            ]}
          />
        </div>
      </div>

      {/* Attach modal */}
      <Modal
        open={attachModalOpen}
        onClose={() => setAttachModalOpen(false)}
        title={attachType === 'product' ? 'Attach a Product' : 'Attach a Collection'}
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setAttachModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                setAttachModalOpen(false);
                onToast(`${attachType === 'product' ? 'Product' : 'Collection'} attached to post.`);
              }}
            >
              Attach
            </button>
          </>
        }
      >
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>
            {attachType === 'product' ? 'Search products by name or SKU' : 'Search collections by name'}
          </label>
          <input
            className={styles.editorInput}
            type="text"
            placeholder={attachType === 'product' ? 'e.g. Heavyweight Tee' : 'e.g. Holiday Collection'}
          />
        </div>
      </Modal>

      {/* Connect channel modal */}
      <Modal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title="Connect a Channel"
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setConnectModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                setConnectModalOpen(false);
                onToast('Channel connection flow started.');
              }}
            >
              Connect
            </button>
          </>
        }
      >
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>Select a platform</label>
          <select className={styles.editorSelect}>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>TikTok</option>
            <option>LinkedIn</option>
            <option>YouTube</option>
            <option>Pinterest</option>
          </select>
        </div>
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>Account name</label>
          <input className={styles.editorInput} type="text" placeholder="e.g. @unsaidmemories" />
        </div>
      </Modal>
    </div>
  );
}
