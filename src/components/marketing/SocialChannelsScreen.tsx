'use client';

/**
 * Connected Channels — social account management.
 * Minimalist rebuild: real Manage (peek drawer) + real Disconnect (state change)
 * + Connect modal that actually connects.
 */
import { useState } from 'react';
import styles from './SocialChannels.module.css';

interface SocialChannelsScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

interface Channel {
  id: string;
  name: string;
  handle: string;
  icon: string;
  color: string;
  connected: boolean;
  tokenExpiry: string;
  scopes: string;
  lastSync: string;
}

const INITIAL_CHANNELS: Channel[] = [
  { id: 'ig', name: 'Instagram', handle: '@unsaidmemories', icon: 'photo_camera', color: '#c13584', connected: true, tokenExpiry: 'Jan 12, 2026', scopes: 'publish, media, insights', lastSync: '2 min ago' },
  { id: 'fb', name: 'Facebook', handle: 'Unsaid Studio', icon: 'group', color: '#1877f2', connected: true, tokenExpiry: 'Jan 12, 2026', scopes: 'pages, publish, insights', lastSync: '5 min ago' },
  { id: 'li', name: 'LinkedIn', handle: 'Unsaid Studio', icon: 'business_center', color: '#0a66c2', connected: true, tokenExpiry: 'Dec 28, 2025', scopes: 'publish, profile', lastSync: '1 hr ago' },
  { id: 'tt', name: 'TikTok', handle: '@unsaidstudio', icon: 'music_note', color: '#010101', connected: true, tokenExpiry: 'Jan 3, 2026', scopes: 'publish, video', lastSync: '12 min ago' },
  { id: 'yt', name: 'YouTube', handle: 'Unsaid Channel', icon: 'smart_display', color: '#ff0000', connected: false, tokenExpiry: '—', scopes: '—', lastSync: '—' },
  { id: 'pin', name: 'Pinterest', handle: 'Unsaid Pins', icon: 'push_pin', color: '#bd081c', connected: false, tokenExpiry: '—', scopes: '—', lastSync: '—' },
];

const PROVIDERS = [
  { id: 'Instagram', icon: 'photo_camera', color: '#c13584' },
  { id: 'Facebook', icon: 'group', color: '#1877f2' },
  { id: 'LinkedIn', icon: 'business_center', color: '#0a66c2' },
  { id: 'TikTok', icon: 'music_note', color: '#010101' },
  { id: 'YouTube', icon: 'smart_display', color: '#ff0000' },
  { id: 'Pinterest', icon: 'push_pin', color: '#bd081c' },
];

export default function SocialChannelsScreen({ onToast }: SocialChannelsScreenProps) {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [peekChannel, setPeekChannel] = useState<Channel | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectProvider, setConnectProvider] = useState('Instagram');
  const [connectAccount, setConnectAccount] = useState('');

  const connectedCount = channels.filter((c) => c.connected).length;

  const handleDisconnect = (ch: Channel) => {
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, connected: false, handle: 'Not connected', tokenExpiry: '—', scopes: '—', lastSync: '—' } : c)));
    setPeekChannel(null);
    onToast(`${ch.name} disconnected.`);
  };

  const handleConnect = () => {
    const prov = PROVIDERS.find((p) => p.id === connectProvider)!;
    const handle = connectAccount.trim().startsWith('@') || connectAccount.trim().length === 0 ? (connectAccount.trim() || `@unsaidstudio`) : connectAccount.trim();
    setChannels((prev) => prev.map((c) => (c.name === connectProvider ? {
      ...c,
      connected: true,
      handle,
      tokenExpiry: 'in 60 days',
      scopes: 'publish, media, insights',
      lastSync: 'just now',
      icon: prov.icon,
      color: prov.color,
    } : c)));
    onToast(`${connectProvider} connected as ${handle}.`);
    setConnectAccount('');
    setConnectOpen(false);
  };

  const openConnectFor = (ch: Channel) => {
    setConnectProvider(ch.name);
    setConnectOpen(true);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Connected channels</h1>
          <p className={styles.toolbarSub}>{connectedCount} of {channels.length} accounts connected</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setConnectProvider('Instagram'); setConnectOpen(true); }}>
            <span className="material-symbols-outlined">add_link</span> Connect channel
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <h2 className={styles.cardTitle}>Your social accounts</h2>
              <p className={styles.cardSub}>Manage provider connections and token status.</p>
            </div>
            <span className={styles.badge}>{connectedCount} connected</span>
          </div>
          {channels.map((ch) => (
            <div key={ch.id} className={styles.channelRow}>
              <div className={styles.channelLogo} style={{ background: ch.color }}><span className="material-symbols-outlined">{ch.icon}</span></div>
              <div className={styles.channelMain}>
                <div className={styles.channelName}>{ch.name}</div>
                <div className={styles.channelHandle}>{ch.connected ? ch.handle : 'Not connected'}</div>
              </div>
              {ch.connected ? (
                <>
                  <span className={styles.channelStatus}><span className={styles.dot} />Connected</span>
                  <div className={styles.channelActions}>
                    <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setPeekChannel(ch)}>Manage</button>
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDisconnect(ch)}>Disconnect</button>
                  </div>
                </>
              ) : (
                <>
                  <span className={`${styles.channelStatus} ${styles.channelStatusOffline}`}><span className={`${styles.dot} ${styles.dotOff}`} />Not connected</span>
                  <div className={styles.channelActions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openConnectFor(ch)}>
                      <span className="material-symbols-outlined">link</span> Connect
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div className={styles.cardHeadLeft}>
              <h2 className={styles.cardTitle}>Provider integration requirements</h2>
              <p className={styles.cardSub}>Each provider adapter handles its own scopes, media rules, and token lifecycle.</p>
            </div>
          </div>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}><p className={styles.infoItemTitle}>OAuth &amp; permissions</p><p className={styles.infoItemText}>Account authorization, scopes, refresh tokens, expiration, and revocation.</p></div>
            <div className={styles.infoItem}><p className={styles.infoItemTitle}>Publishing capabilities</p><p className={styles.infoItemText}>Supported post types, media constraints, scheduled publishing, API limits.</p></div>
            <div className={styles.infoItem}><p className={styles.infoItemTitle}>Delivery status</p><p className={styles.infoItemText}>Provider post IDs, status polling, webhooks, errors, retries.</p></div>
            <div className={styles.infoItem}><p className={styles.infoItemTitle}>Account mapping</p><p className={styles.infoItemText}>Workspace, organization, social profile, and provider identity.</p></div>
          </div>
        </div>
      </div>

      {/* Peek drawer */}
      {peekChannel && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeekChannel(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className={styles.channelLogo} style={{ background: peekChannel.color, width: 32, height: 32 }}><span className="material-symbols-outlined" style={{ fontSize: 18 }}>{peekChannel.icon}</span></div>
                <div>
                  <h3 className={styles.peekHeadTitle}>{peekChannel.name}</h3>
                  <p className={styles.peekHeadSub}>{peekChannel.handle}</p>
                </div>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeekChannel(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}><span className={`${styles.pill} ${styles.pillGreen}`}>Connected</span></span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Handle</span><span className={styles.peekValue}>{peekChannel.handle}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Token expires</span><span className={styles.peekValue}>{peekChannel.tokenExpiry}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Scopes</span><span className={styles.peekValue}>{peekChannel.scopes}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Last sync</span><span className={styles.peekValue}>{peekChannel.lastSync}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Provider ID</span><span className={styles.peekValue}>{peekChannel.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => { setPeekChannel(null); onToast(`Refreshing ${peekChannel.name} token…`); }}><span className="material-symbols-outlined">refresh</span> Refresh token</button>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDisconnect(peekChannel)}><span className="material-symbols-outlined">link_off</span> Disconnect</button>
            </div>
          </div>
        </>
      )}

      {/* Connect modal */}
      {connectOpen && (
        <div className={styles.modalScrim} onClick={() => setConnectOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Connect a social channel</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setConnectOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Provider</label>
                <select className={styles.select} value={connectProvider} onChange={(e) => setConnectProvider(e.target.value)}>
                  {PROVIDERS.map((p) => (<option key={p.id}>{p.id}</option>))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Account label (optional)</label>
                <input className={styles.input} type="text" placeholder="@yourbrand" value={connectAccount} onChange={(e) => setConnectAccount(e.target.value)} autoFocus />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setConnectOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConnect}>
                <span className="material-symbols-outlined">link</span> Continue to connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
