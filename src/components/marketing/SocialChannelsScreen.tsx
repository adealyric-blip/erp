'use client';

/**
 * Connected Channels — social account management.
 * Source: publishing overview.html #page-channels section.
 */
import { useState } from 'react';
import { PageHeader, Modal } from './MarketingPrimitives';
import styles from './MarketingPrimitives.module.css';

interface SocialChannelsScreenProps {
  onToast: (msg: string) => void;
}

const CHANNELS = [
  { name: 'Instagram', handle: '@unsaidcompany', connected: true, kind: 'ig', letter: '◎' },
  { name: 'Facebook', handle: 'Unsaid Company', connected: true, kind: 'fb', letter: 'f' },
  { name: 'LinkedIn', handle: 'Unsaid Company', connected: true, kind: 'li', letter: 'in' },
  { name: 'TikTok', handle: '@unsaidcompany', connected: true, kind: 'tt', letter: '♪' },
  { name: 'YouTube', handle: 'Unsaid Company', connected: false, kind: 'yt', letter: '▶' },
  { name: 'Pinterest', handle: 'Unsaid Company', connected: false, kind: 'pin', letter: 'p' },
];

const PROVIDER_COLORS: Record<string, string> = {
  ig: '#a45a87', fb: '#4b77b8', li: '#4a7b9b', tt: '#27353a', yt: '#c45c5b', pin: '#bd5558',
};

export default function SocialChannelsScreen({ onToast }: SocialChannelsScreenProps) {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState('Instagram');
  const [connectAccount, setConnectAccount] = useState('');

  const connectedCount = CHANNELS.filter((c) => c.connected).length;

  const handleConnect = () => {
    setConnectModalOpen(false);
    onToast(`OAuth flow started for ${connectProvider}.`);
    setConnectAccount('');
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing']}
        title="Connected channels"
        subtitle="Connect and manage the social accounts used by your publishing workspace."
        actions={
          <button type="button" className={styles.btnPrimary} onClick={() => setConnectModalOpen(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_link</span>
            Connect channel
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-dad9dd overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-dad9dd">
          <div>
            <h2 className="text-base font-semibold">Your social accounts</h2>
            <p className="text-xs text-5a6355">Manage provider connections and token status.</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-8af5be text-00714b font-semibold">
            {connectedCount} connected
          </span>
        </div>

        <div className="divide-y divide-dad9dd">
          {CHANNELS.map((ch) => (
            <div key={ch.name} className="flex items-center gap-4 px-5 py-4 hover:bg-f9f8fb">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: (PROVIDER_COLORS[ch.kind] || '#666') + '22', color: PROVIDER_COLORS[ch.kind] || '#666' }}
              >
                {ch.letter}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{ch.name}</p>
                <p className="text-xs text-5a6355">{ch.connected ? ch.handle : 'Not connected'}</p>
              </div>
              {ch.connected ? (
                <>
                  <span className="text-xs px-2 py-1 rounded-full bg-e8f5e9 text-2e7d32 font-semibold">Connected</span>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => onToast(`Managing ${ch.name} connection.`)}
                  >
                    Manage
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => onToast(`Disconnecting ${ch.name}…`)}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs px-2 py-1 rounded-full bg-f4f3f7 text-5a6355 font-semibold">Not connected</span>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => {
                      setConnectProvider(ch.name);
                      setConnectModalOpen(true);
                    }}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-dad9dd mt-3 p-5">
        <h2 className="text-base font-semibold mb-1">Provider integration requirements</h2>
        <p className="text-xs text-5a6355 mb-3">
          Each provider adapter must handle its own scopes, media rules, publishing endpoint, and token lifecycle.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-semibold">OAuth &amp; permissions</p>
            <p className="text-xs text-5a6355">Account authorization, scopes, refresh tokens, expiration, and revocation.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Publishing capabilities</p>
            <p className="text-xs text-5a6355">Supported post types, media constraints, scheduled publishing, and API limits.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Delivery status</p>
            <p className="text-xs text-5a6355">Provider post IDs, status polling/webhooks, errors, and retries.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Account mapping</p>
            <p className="text-xs text-5a6355">Workspace, organization, social profile, and provider identity relationships.</p>
          </div>
        </div>
      </div>

      <Modal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        title="Connect a social channel"
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setConnectModalOpen(false)}>Cancel</button>
            <button type="button" className={styles.btnPrimary} onClick={handleConnect}>Continue to connect</button>
          </>
        }
      >
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>Provider</label>
          <select className={styles.editorSelect} value={connectProvider} onChange={(e) => setConnectProvider(e.target.value)}>
            <option>Instagram</option>
            <option>Facebook</option>
            <option>LinkedIn</option>
            <option>TikTok</option>
            <option>YouTube</option>
            <option>Pinterest</option>
          </select>
        </div>
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>Account label (optional)</label>
          <input
            className={styles.editorInput}
            type="text"
            placeholder="@yourbrand"
            value={connectAccount}
            onChange={(e) => setConnectAccount(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
