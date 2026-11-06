'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface AudiencesScreenProps { onToast: (msg: string) => void; }

const AUDIENCES = [
  { name: 'Lookalike — Holiday Buyers 1%', type: 'Lookalike', source: 'Purchase event', size: '2.4M', status: 'Ready' },
  { name: 'Retarget — Cart abandoners 30d', type: 'Retargeting', source: 'Add to cart', size: '12.4K', status: 'Ready' },
  { name: 'Engaged — Video viewers 50%', type: 'Engagement', source: 'Video view', size: '89K', status: 'Ready' },
  { name: 'Lookalike — Email subscribers', type: 'Lookalike', source: 'Email list upload', size: '1.8M', status: 'Building' },
  { name: 'Custom — Past purchasers 90d', type: 'Custom', source: 'Purchase event', size: '8.2K', status: 'Ready' },
  { name: 'Broad — US 18-35', type: 'Saved', source: 'Demographic', size: '120M', status: 'Ready' },
];

const KPI_DATA = [
  { label: 'Total audiences', value: '6', delta: '4 ready, 1 building', deltaTone: 'neutral' as const },
  { label: 'Total reach', value: '124M', delta: 'Across all audiences', deltaTone: 'neutral' as const },
  { label: 'Lookalikes', value: '2', delta: 'Based on purchase + email', deltaTone: 'neutral' as const },
  { label: 'Retargeting', value: '1', delta: '12.4K users in pool', deltaTone: 'pos' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Audience' },
  { key: 'type', label: 'Type' },
  { key: 'source', label: 'Source' },
  { key: 'size', label: 'Size', right: true },
  { key: 'status', label: 'Status' },
];

export default function AudiencesScreen({ onToast }: AudiencesScreenProps) {
  const [search, setSearch] = useState('');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = AUDIENCES.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Advertising', 'Audiences']} title="Audiences" subtitle="Manage custom, lookalike, and retargeting audiences."
        actions={<button type="button" className={styles.btnPrimary} onClick={() => setEditorOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New audience</button>} />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search audiences…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'audiences'); onToast(`Exported ${filtered.length} audiences.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Audience'} fields={[
        { label: 'Type', value: filtered[peekIdx]?.type || '' },
        { label: 'Source', value: filtered[peekIdx]?.source || '' },
        { label: 'Size', value: filtered[peekIdx]?.size || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title="New Audience" footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast('Audience created.'); }}>Create</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Audience details</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Audience name</label><input className={styles.editorInput} type="text" placeholder="e.g. Lookalike — Holiday Buyers" /></div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Type</label><select className={styles.editorSelect}><option>Custom</option><option>Lookalike</option><option>Retargeting</option><option>Engagement</option><option>Saved</option></select></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Source</label><select className={styles.editorSelect}><option>Purchase event</option><option>Add to cart</option><option>Video view</option><option>Email list upload</option><option>Demographic</option></select></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Lookalike config</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Similarity (%)</label><input className={styles.editorInput} type="number" defaultValue="1" /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Target country</label><select className={styles.editorSelect}><option>United States</option><option>Canada</option><option>United Kingdom</option></select></div>
          </div>
        </div>
      </EditorDrawer>
    </div>
  );
}
