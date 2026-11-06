'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface PromotionsScreenProps { onToast: (msg: string) => void; }

const PROMOS = [
  { code: 'HOLIDAY20', name: 'Holiday 20% off', type: 'Percentage', value: '20%', uses: '142', revenue: '$3,408', status: 'Active', expires: 'Dec 31' },
  { code: 'FREESHIP', name: 'Free shipping over $50', type: 'Free shipping', value: '—', uses: '86', revenue: '$4,128', status: 'Active', expires: 'Dec 31' },
  { code: 'BLACKFRIDAY', name: 'Black Friday 30% off', type: 'Percentage', value: '30%', uses: '0', revenue: '$0', status: 'Scheduled', expires: 'Nov 29' },
  { code: 'WELCOME10', name: 'Welcome 10% off', type: 'Percentage', value: '10%', uses: '320', revenue: '$8,640', status: 'Active', expires: '—' },
  { code: 'SUMMER25', name: 'Summer clearance 25%', type: 'Percentage', value: '25%', uses: '64', revenue: '$1,152', status: 'Expired', expires: 'Sep 30' },
  { code: 'BUNDLE15', name: 'Bundle save 15%', type: 'Percentage', value: '15%', uses: '28', revenue: '$672', status: 'Active', expires: '—' },
];

const KPI_DATA = [
  { label: 'Active promos', value: '4', delta: '1 scheduled, 1 expired', deltaTone: 'neutral' as const },
  { label: 'Total uses', value: '640', delta: 'Across all promos', deltaTone: 'neutral' as const },
  { label: 'Revenue attributed', value: '$18,000', delta: 'Last 90 days', deltaTone: 'pos' as const },
  { label: 'Avg. discount', value: '18%', delta: 'Across active promos', deltaTone: 'neutral' as const },
];

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Promotion' },
  { key: 'type', label: 'Type' },
  { key: 'value', label: 'Value' },
  { key: 'uses', label: 'Uses', right: true },
  { key: 'revenue', label: 'Revenue', right: true },
  { key: 'expires', label: 'Expires' },
  { key: 'status', label: 'Status' },
];

export default function PromotionsScreen({ onToast }: PromotionsScreenProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIdx, setEditorIdx] = useState(0);

  const filtered = PROMOS.filter((p) => {
    const tabMatch = activeTab === 'all' || p.status.toLowerCase() === activeTab;
    const searchMatch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Promotions']} title="Promotions & Discounts" subtitle="Manage discount codes and promotional rules."
        actions={<button type="button" className={styles.btnPrimary} onClick={() => { setEditorIdx(-1); setEditorOpen(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New promotion</button>} />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        statusTabs={[
          { id: 'all', label: 'All', count: 6 },
          { id: 'active', label: 'Active', count: 4 },
          { id: 'scheduled', label: 'Scheduled', count: 1 },
          { id: 'expired', label: 'Expired', count: 1 },
        ]}
        activeStatusTab={activeTab}
        onStatusTabChange={setActiveTab}
        searchPlaceholder="Search by code or name…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        bulkActions={[
          { label: 'Deactivate', icon: 'pause', onClick: () => { onToast('Deactivated selected promos.'); } },
          { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast('Duplicated selected promos.'); } },
          { label: 'Delete', icon: 'delete', danger: true, onClick: () => { onToast('Deleted selected promos.'); } },
        ]}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'promotions'); onToast(`Exported ${filtered.length} promos.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Promotion'} fields={[
        { label: 'Code', value: filtered[peekIdx]?.code || '' },
        { label: 'Type', value: filtered[peekIdx]?.type || '' },
        { label: 'Value', value: filtered[peekIdx]?.value || '' },
        { label: 'Uses', value: filtered[peekIdx]?.uses || '' },
        { label: 'Revenue', value: filtered[peekIdx]?.revenue || '' },
        { label: 'Expires', value: filtered[peekIdx]?.expires || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title={editorIdx === -1 ? 'New Promotion' : `Edit: ${PROMOS[editorIdx]?.name || ''}`} footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast(editorIdx === -1 ? 'Promotion created.' : 'Promotion saved.'); }}>{editorIdx === -1 ? 'Create' : 'Save'}</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Basics</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Promotion name</label><input className={styles.editorInput} type="text" placeholder="e.g. Holiday 20% off" /></div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Discount code</label><input className={styles.editorInput} type="text" placeholder="HOLIDAY20" /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Type</label><select className={styles.editorSelect}><option>Percentage</option><option>Fixed amount</option><option>Free shipping</option><option>Buy X get Y</option></select></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Value</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Discount value (%)</label><input className={styles.editorInput} type="number" placeholder="20" /></div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Schedule</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Start date</label><input className={styles.editorInput} type="date" /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>End date</label><input className={styles.editorInput} type="date" /></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Limits</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Max uses (total)</label><input className={styles.editorInput} type="number" placeholder="0 = unlimited" /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Max uses per customer</label><input className={styles.editorInput} type="number" placeholder="1" /></div>
          </div>
        </div>
      </EditorDrawer>
    </div>
  );
}
