'use client';

/**
 * Advertisers — ad network account management. Uses shared AdList CSS.
 * Real Add advertiser editor + invite modal + status changes.
 */
import { useState } from 'react';
import styles from './AdList.module.css';
import { exportToCsv } from '@/lib/csvExport';

interface AdvertisersScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

type Status = 'Active' | 'Pending' | 'Suspended';

interface Advertiser {
  id: string;
  name: string;
  network: 'Meta' | 'TikTok' | 'Google' | 'Pinterest' | 'LinkedIn';
  account: string;
  spend: string;
  status: Status;
}

const INITIAL: Advertiser[] = [
  { id: 'ad1', name: 'Unsaid Memories', network: 'Meta', account: 'act_123456789', spend: '$4,280', status: 'Active' },
  { id: 'ad2', name: 'Unsaid Memories', network: 'TikTok', account: 'TT-ADV-9876', spend: '$1,200', status: 'Active' },
  { id: 'ad3', name: 'Unsaid Memories', network: 'Google', account: '123-456-7890', spend: '$680', status: 'Active' },
  { id: 'ad4', name: 'Unsaid Home', network: 'Meta', account: 'act_987654321', spend: '$0', status: 'Pending' },
  { id: 'ad5', name: 'Unsaid Wholesale', network: 'Meta', account: 'act_456789123', spend: '$0', status: 'Suspended' },
];

const NET_COLOR: Record<string, string> = { Meta: '#0077c5', TikTok: '#010101', Google: '#1e5a38', Pinterest: '#bd081c', LinkedIn: '#0a66c2' };

function pill(s: Status) {
  switch (s) {
    case 'Active': return <span className={`${styles.pill} ${styles.pillGreen}`}>Active</span>;
    case 'Pending': return <span className={`${styles.pill} ${styles.pillOrange}`}>Pending</span>;
    case 'Suspended': return <span className={`${styles.pill} ${styles.pillRed}`}>Suspended</span>;
  }
}

const EMPTY = { name: '', network: 'Meta', account: '', billing: 'Credit card (auto-charge)' };
const INVITE_EMPTY = { email: '', role: 'Admin' };

export default function AdvertisersScreen({ onToast }: AdvertisersScreenProps) {
  const [items, setItems] = useState<Advertiser[]>(INITIAL);
  const [search, setSearch] = useState('');
  const [peek, setPeek] = useState<Advertiser | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(INVITE_EMPTY);

  const filtered = items.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.network.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [{ key: 'name', label: 'Advertiser' }, { key: 'network', label: 'Network' }, { key: 'account', label: 'Account ID' }, { key: 'spend', label: 'Spend (30d)' }, { key: 'status', label: 'Status' }], 'advertisers');
    onToast(`Exported ${filtered.length} advertisers.`);
  };

  const setStatus = (a: Advertiser, s: Status) => { setItems((p) => p.map((x) => x.id === a.id ? { ...x, status: s } : x)); setPeek(null); onToast(`"${a.name}" (${a.network}) marked ${s.toLowerCase()}.`); };
  const del = (a: Advertiser) => { setItems((p) => p.filter((x) => x.id !== a.id)); setPeek(null); onToast(`Removed "${a.name}" (${a.network}).`); };

  const openNew = () => { setEditId(null); setForm(EMPTY); setEditorOpen(true); };
  const openEdit = (a: Advertiser) => { setEditId(a.id); setForm({ name: a.name, network: a.network, account: a.account, billing: 'Credit card (auto-charge)' }); setPeek(null); setEditorOpen(true); };
  const save = () => {
    if (!form.name.trim() || !form.account.trim()) { onToast('Advertiser name and account ID are required.'); return; }
    if (editId) {
      setItems((p) => p.map((a) => a.id === editId ? { ...a, name: form.name, network: form.network as Advertiser['network'], account: form.account } : a));
      onToast(`Advertiser "${form.name}" saved.`);
    } else {
      const na: Advertiser = { id: `ad${Date.now()}`, name: form.name, network: form.network as Advertiser['network'], account: form.account, spend: '$0', status: 'Pending' };
      setItems((p) => [na, ...p]);
      onToast(`Advertiser "${form.name}" added (pending activation).`);
    }
    setEditorOpen(false);
  };

  const sendInvite = () => {
    if (!inviteForm.email.trim()) { onToast('Enter an email address.'); return; }
    onToast(`Invite sent to ${inviteForm.email} as ${inviteForm.role}.`);
    setInviteForm(INVITE_EMPTY);
    setInviteOpen(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.toolbarTitle}>Advertisers</h1>
          <p className={styles.toolbarSub}>Manage advertiser accounts across ad networks.</p>
        </div>
        <div className={styles.toolbarRight}>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setInviteOpen(true)}><span className="material-symbols-outlined">person_add</span> Invite</button>
          <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}><span className="material-symbols-outlined">download</span> Export</button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={openNew}><span className="material-symbols-outlined">add</span> Add advertiser</button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.filterBar}><input className={styles.search} type="text" placeholder="Search advertisers…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className={styles.tableWrap}>
          {filtered.length === 0 ? (
            <div className={styles.empty}><span className="material-symbols-outlined">business</span><h3>No advertisers</h3><p>Add an advertiser account to get started.</p></div>
          ) : (
            <table className={styles.table}>
              <thead><tr><th>Advertiser</th><th>Network</th><th>Account ID</th><th className={styles.right}>Spend (30d)</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={`${a.id}-${a.network}`} onClick={() => setPeek(a)}>
                    <td><strong>{a.name}</strong></td>
                    <td><span className={styles.netDot} style={{ background: NET_COLOR[a.network] }} />{a.network}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--mut)' }}>{a.account}</td>
                    <td className={styles.right}>{a.spend}</td>
                    <td>{pill(a.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {peek && (
        <>
          <div className={`${styles.scrim} ${styles.scrimOpen}`} onClick={() => setPeek(null)} />
          <div className={`${styles.peek} ${styles.peekOpen}`}>
            <div className={styles.peekHead}>
              <div>
                <h3 className={styles.peekHeadTitle}>{peek.name}</h3>
                <p className={styles.peekHeadSub}><span className={styles.netDot} style={{ background: NET_COLOR[peek.network] }} />{peek.network}</p>
              </div>
              <button type="button" className={styles.btnIcon} onClick={() => setPeek(null)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.peekBody}>
              <div className={styles.peekField}><span className={styles.peekLabel}>Status</span><span className={styles.peekValue}>{pill(peek.status)}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Network</span><span className={styles.peekValue}>{peek.network}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Account ID</span><span className={styles.peekValue} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>{peek.account}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Spend (30d)</span><span className={styles.peekValue}>{peek.spend}</span></div>
              <div className={styles.peekField}><span className={styles.peekLabel}>Advertiser ID</span><span className={styles.peekValue}>{peek.id}</span></div>
            </div>
            <div className={styles.peekFooter}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => del(peek)}><span className="material-symbols-outlined">delete</span> Remove</button>
              {peek.status === 'Pending' && <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setStatus(peek, 'Active')}><span className="material-symbols-outlined">check</span> Activate</button>}
              {peek.status === 'Active' && <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setStatus(peek, 'Suspended')}><span className="material-symbols-outlined">block</span> Suspend</button>}
              {peek.status === 'Suspended' && <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setStatus(peek, 'Active')}><span className="material-symbols-outlined">play_arrow</span> Reactivate</button>}
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => openEdit(peek)}><span className="material-symbols-outlined">edit</span> Edit</button>
            </div>
          </div>
        </>
      )}

      {editorOpen && (
        <>
          <div className={styles.editorScrim} onClick={() => setEditorOpen(false)} />
          <div className={styles.editorDrawer}>
            <div className={styles.editorHead}>
              <h2>{editId ? 'Edit advertiser' : 'Add advertiser'}</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setEditorOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.editorBody}>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Advertiser details</span>
                <div className={styles.field}><label className={styles.label}>Advertiser name</label><input className={styles.input} type="text" placeholder="e.g. Unsaid Memories" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} autoFocus /></div>
                <div className={styles.row2}>
                  <div className={styles.field}><label className={styles.label}>Network</label><select className={styles.select} value={form.network} onChange={(e) => setForm((p) => ({ ...p, network: e.target.value }))}><option>Meta</option><option>TikTok</option><option>Google</option><option>Pinterest</option><option>LinkedIn</option></select></div>
                  <div className={styles.field}><label className={styles.label}>Account ID</label><input className={styles.input} type="text" placeholder="e.g. act_123456789" value={form.account} onChange={(e) => setForm((p) => ({ ...p, account: e.target.value }))} /></div>
                </div>
              </div>
              <div className={styles.editorSection}>
                <span className={styles.editorSectionTitle}>Billing</span>
                <div className={styles.field}><label className={styles.label}>Billing method</label><select className={styles.select} value={form.billing} onChange={(e) => setForm((p) => ({ ...p, billing: e.target.value }))}><option>Credit card (auto-charge)</option><option>Invoice</option><option>Prepaid balance</option></select></div>
              </div>
            </div>
            <div className={styles.editorFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save}>{editId ? 'Save changes' : 'Add advertiser'}</button>
            </div>
          </div>
        </>
      )}

      {inviteOpen && (
        <div className={styles.modalScrim} onClick={() => setInviteOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>Invite team member</h2>
              <button type="button" className={styles.btnIcon} onClick={() => setInviteOpen(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}><label className={styles.label}>Email address</label><input className={styles.input} type="email" placeholder="colleague@company.com" value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))} autoFocus /></div>
              <div className={styles.field}><label className={styles.label}>Role</label><select className={styles.select} value={inviteForm.role} onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value }))}><option>Admin</option><option>Editor</option><option>Viewer</option></select></div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => setInviteOpen(false)}>Cancel</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={sendInvite}><span className="material-symbols-outlined">send</span> Send invite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
