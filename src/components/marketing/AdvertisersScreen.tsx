'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface AdvertisersScreenProps { onToast: (msg: string) => void; }

const ADVERTISERS = [
  { name: 'Unsaid Memories', network: 'Meta', account: 'act_123456789', status: 'Active', spend: '$4,280' },
  { name: 'Unsaid Memories', network: 'TikTok', account: 'TT-ADV-9876', status: 'Active', spend: '$1,200' },
  { name: 'Unsaid Memories', network: 'Google', account: '123-456-7890', status: 'Active', spend: '$680' },
  { name: 'Unsaid Home', network: 'Meta', account: 'act_987654321', status: 'Pending', spend: '$0' },
  { name: 'Unsaid Wholesale', network: 'Meta', account: 'act_456789123', status: 'Suspended', spend: '$0' },
];

const KPI_DATA = [
  { label: 'Active advertisers', value: '3', delta: '1 pending, 1 suspended', deltaTone: 'neutral' as const },
  { label: 'Total spend (30d)', value: '$6,160', delta: 'Across 3 networks', deltaTone: 'neutral' as const },
  { label: 'Networks connected', value: '3', delta: 'Meta, TikTok, Google', deltaTone: 'neutral' as const },
  { label: 'Pending invites', value: '1', delta: 'Unsaid Home', deltaTone: 'neutral' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Advertiser' },
  { key: 'network', label: 'Network' },
  { key: 'account', label: 'Account ID' },
  { key: 'spend', label: 'Spend (30d)', right: true },
  { key: 'status', label: 'Status' },
];

export default function AdvertisersScreen({ onToast }: AdvertisersScreenProps) {
  const [search, setSearch] = useState('');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const filtered = ADVERTISERS.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Advertising', 'Advertisers']} title="Advertisers" subtitle="Manage advertiser accounts across ad networks."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setInviteModalOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span> Invite</button>
            <button type="button" className={styles.btnPrimary} onClick={() => setEditorOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add advertiser</button>
          </>
        }
      />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search advertisers…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'advertisers'); onToast(`Exported ${filtered.length} advertisers.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Advertiser'} fields={[
        { label: 'Network', value: filtered[peekIdx]?.network || '' },
        { label: 'Account ID', value: filtered[peekIdx]?.account || '' },
        { label: 'Spend (30d)', value: filtered[peekIdx]?.spend || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title="Add Advertiser" footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast('Advertiser added.'); }}>Add</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Advertiser details</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Advertiser name</label><input className={styles.editorInput} type="text" placeholder="e.g. Unsaid Memories" /></div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Network</label><select className={styles.editorSelect}><option>Meta</option><option>TikTok</option><option>Google</option><option>Pinterest</option><option>LinkedIn</option></select></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Account ID</label><input className={styles.editorInput} type="text" placeholder="e.g. act_123456789" /></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Billing</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Billing method</label><select className={styles.editorSelect}><option>Credit card (auto-charge)</option><option>Invoice</option><option>Prepaid balance</option></select></div>
        </div>
      </EditorDrawer>
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Invite Team Member" footer={<><button type="button" className={styles.btnOutline} onClick={() => setInviteModalOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setInviteModalOpen(false); onToast('Invite sent.'); }}>Send Invite</button></>}>
        <div className={styles.editorField}><label className={styles.editorLabel}>Email address</label><input className={styles.editorInput} type="email" placeholder="colleague@company.com" /></div>
        <div className={styles.editorField}><label className={styles.editorLabel}>Role</label><select className={styles.editorSelect}><option>Admin</option><option>Editor</option><option>Viewer</option></select></div>
      </Modal>
    </div>
  );
}
