'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface CreativesScreenProps { onToast: (msg: string) => void; }

const CREATIVES = [
  { name: 'Holiday Tee — Hero Image', type: 'Image', campaign: 'Holiday Tee Launch', format: '1080×1080', status: 'Live' },
  { name: 'Mug Collection — Carousel', type: 'Carousel', campaign: 'Mug Collection Q4', format: '1080×1080', status: 'Live' },
  { name: 'Brand Video — 15s', type: 'Video', campaign: 'Brand Awareness', format: '1080×1920', status: 'Live' },
  { name: 'Crewneck — Lifestyle', type: 'Image', campaign: 'Holiday Crewneck', format: '1080×1080', status: 'In review' },
  { name: 'Retarget — Dynamic', type: 'Dynamic', campaign: 'Retarget', format: 'Auto', status: 'Live' },
  { name: 'Black Friday — Teaser', type: 'Video', campaign: 'Black Friday', format: '1080×1920', status: 'Draft' },
];

const KPI_DATA = [
  { label: 'Live creatives', value: '4', delta: '1 in review, 1 draft', deltaTone: 'neutral' as const },
  { label: 'Total impressions', value: '291K', delta: 'Across 6 creatives', deltaTone: 'neutral' as const },
  { label: 'Avg. CTR', value: '2.4%', delta: '+0.3% vs last 30d', deltaTone: 'pos' as const },
  { label: 'Rejected', value: '0', delta: 'All approved', deltaTone: 'pos' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Creative' },
  { key: 'type', label: 'Type' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'format', label: 'Format' },
  { key: 'status', label: 'Status' },
];

export default function CreativesScreen({ onToast }: CreativesScreenProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filtered = CREATIVES.filter((c) => {
    const tabMatch = activeTab === 'all' || c.status.toLowerCase().replace(' ', '') === activeTab;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Advertising', 'Creatives']} title="Creatives" subtitle="Manage ad creatives — images, videos, carousels, and dynamic ads."
        actions={<button type="button" className={styles.btnPrimary} onClick={() => setEditorOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New creative</button>} />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        statusTabs={[
          { id: 'all', label: 'All', count: 6 },
          { id: 'live', label: 'Live', count: 4 },
          { id: 'inreview', label: 'In Review', count: 1 },
          { id: 'draft', label: 'Draft', count: 1 },
        ]}
        activeStatusTab={activeTab}
        onStatusTabChange={setActiveTab}
        searchPlaceholder="Search creatives…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        bulkActions={[
          { label: 'Archive', icon: 'archive', onClick: () => { onToast('Archived selected creatives.'); } },
          { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast('Duplicated selected creatives.'); } },
        ]}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'creatives'); onToast(`Exported ${filtered.length} creatives.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Creative'} fields={[
        { label: 'Type', value: filtered[peekIdx]?.type || '' },
        { label: 'Campaign', value: filtered[peekIdx]?.campaign || '' },
        { label: 'Format', value: filtered[peekIdx]?.format || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title="New Creative" footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast('Creative created.'); }}>Create</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Creative details</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Creative name</label><input className={styles.editorInput} type="text" placeholder="e.g. Holiday Tee — Hero Image" /></div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Type</label><select className={styles.editorSelect}><option>Image</option><option>Video</option><option>Carousel</option><option>Dynamic</option></select></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Campaign</label><select className={styles.editorSelect}><option>Holiday Tee Launch</option><option>Mug Collection Q4</option><option>Brand Awareness</option></select></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Upload</span>
          <div className="border-2 border-dashed border-becab6 bg-f4f3f7 rounded-xl p-6 text-center cursor-pointer hover:border-0a6400" onClick={() => onToast('File picker would open.')}>
            <span className="material-symbols-outlined text-0a6400" style={{ fontSize: 28 }}>cloud_upload</span>
            <p className="text-sm font-semibold mt-2">Drop creative here or browse</p>
            <p className="text-xs text-5a6355">JPG, PNG, MP4 · Max 30 MB</p>
          </div>
        </div>
      </EditorDrawer>
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Creative Preview" footer={<button type="button" className={styles.btnOutline} onClick={() => setPreviewOpen(false)}>Close</button>}>
        <div className="bg-f4f3f7 rounded-lg p-8 text-center"><span className="material-symbols-outlined text-5a6355" style={{ fontSize: 48, opacity: 0.3 }}>image</span><p className="text-sm text-5a6355 mt-2">Creative preview would appear here</p></div>
      </Modal>
    </div>
  );
}
