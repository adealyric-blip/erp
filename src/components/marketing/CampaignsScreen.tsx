'use client';

/**
 * Campaigns — advertising campaigns list.
 * Source: upload/marketing_extracted/Marketing/caimpaigns.html.
 *
 * Status tabs, filter, bulk bar, table, peek drawer, editor drawer.
 */
import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface CampaignsScreenProps {
  onToast: (msg: string) => void;
}

const CAMPAIGNS = [
  { name: 'Holiday Tee Launch', network: 'Meta', objective: 'Conversions', spend: '$1,240', roas: '4.2x', impressions: '45.2K', clicks: '1,402', status: 'Active' },
  { name: 'Mug Collection Q4', network: 'Meta', objective: 'Conversions', spend: '$860', roas: '3.8x', impressions: '32.1K', clicks: '890', status: 'Active' },
  { name: 'Brand Awareness — TikTok', network: 'TikTok', objective: 'Reach', spend: '$680', roas: '2.1x', impressions: '120K', clicks: '2,280', status: 'Active' },
  { name: 'Holiday Crewneck', network: 'Meta', objective: 'Conversions', spend: '$420', roas: '5.1x', impressions: '18.5K', clicks: '668', status: 'Paused' },
  { name: 'Retarget — Cart abandoners', network: 'Meta', objective: 'Conversions', spend: '$340', roas: '6.2x', impressions: '8.2K', clicks: '412', status: 'Active' },
  { name: 'Google Search — Brand', network: 'Google', objective: 'Traffic', spend: '$280', roas: '3.4x', impressions: '12.4K', clicks: '480', status: 'Active' },
  { name: 'Black Friday Teaser', network: 'TikTok', objective: 'Reach', spend: '$180', roas: '1.8x', impressions: '55K', clicks: '990', status: 'Draft' },
  { name: 'Lookalike — Holiday Buyers', network: 'Meta', objective: 'Conversions', spend: '$0', roas: '—', impressions: '0', clicks: '0', status: 'Draft' },
];

const KPI_DATA = [
  { label: 'Active campaigns', value: '5', delta: '2 paused, 2 drafts', deltaTone: 'neutral' as const },
  { label: 'Total spend (30d)', value: '$4,000', delta: '+12% vs last 30d', deltaTone: 'neutral' as const },
  { label: 'Avg. ROAS', value: '3.8x', delta: 'Above 3.0x target', deltaTone: 'pos' as const },
  { label: 'Total impressions', value: '291K', delta: 'Across 3 networks', deltaTone: 'neutral' as const },
];

const STATUS_TABS = [
  { id: 'all', label: 'All', count: 8 },
  { id: 'active', label: 'Active', count: 5 },
  { id: 'paused', label: 'Paused', count: 1 },
  { id: 'draft', label: 'Draft', count: 2 },
];

const COLUMNS = [
  { key: 'name', label: 'Campaign' },
  { key: 'network', label: 'Network' },
  { key: 'objective', label: 'Objective' },
  { key: 'spend', label: 'Spend', right: true },
  { key: 'roas', label: 'ROAS', right: true },
  { key: 'impressions', label: 'Impressions', right: true },
  { key: 'clicks', label: 'Clicks', right: true },
  { key: 'status', label: 'Status' },
];

export default function CampaignsScreen({ onToast }: CampaignsScreenProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIdx, setEditorIdx] = useState(0);

  const filtered = CAMPAIGNS.filter((c) => {
    const tabMatch = activeTab === 'all' || c.status.toLowerCase() === activeTab;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  const handleExport = () => {
    const cols = COLUMNS.map((c) => ({ key: c.key, label: c.label }));
    exportToCsv(filtered as unknown as Record<string, unknown>[], cols, 'campaigns');
    onToast(`Exported ${filtered.length} campaigns to CSV.`);
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Advertising', 'Campaigns']}
        title="Campaigns"
        subtitle="Manage advertising campaigns across all networks."
        actions={
          <button type="button" className={styles.btnPrimary} onClick={() => { setEditorIdx(-1); setEditorOpen(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New campaign
          </button>
        }
      />

      <KpiStrip items={KPI_DATA} />

      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        statusTabs={STATUS_TABS}
        activeStatusTab={activeTab}
        onStatusTabChange={setActiveTab}
        searchPlaceholder="Search campaigns…"
        searchValue={search}
        onSearchChange={setSearch}
        selectedIds={selectedIds}
        onToggleSelect={(idx) => {
          const realIdx = CAMPAIGNS.indexOf(filtered[idx]);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(realIdx)) next.delete(realIdx);
            else next.add(realIdx);
            return next;
          });
        }}
        onToggleSelectAll={() => {
          if (selectedIds.size === filtered.length) setSelectedIds(new Set());
          else setSelectedIds(new Set(filtered.map((_, i) => CAMPAIGNS.indexOf(filtered[i]))));
        }}
        onRowClick={(row, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        bulkActions={[
          { label: 'Pause', icon: 'pause', onClick: () => { onToast(`Paused ${selectedIds.size} campaigns.`); setSelectedIds(new Set()); } },
          { label: 'Resume', icon: 'play_arrow', onClick: () => { onToast(`Resumed ${selectedIds.size} campaigns.`); setSelectedIds(new Set()); } },
          { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast(`Duplicated ${selectedIds.size} campaigns.`); setSelectedIds(new Set()); } },
          { label: 'Archive', icon: 'archive', danger: true, onClick: () => { onToast(`Archived ${selectedIds.size} campaigns.`); setSelectedIds(new Set()); } },
        ]}
        exportFn={handleExport}
      />

      <PeekDrawer
        open={peekOpen}
        onClose={() => setPeekOpen(false)}
        title={filtered[peekIdx]?.name || 'Campaign'}
        fields={[
          { label: 'Network', value: filtered[peekIdx]?.network || '' },
          { label: 'Objective', value: filtered[peekIdx]?.objective || '' },
          { label: 'Spend', value: filtered[peekIdx]?.spend || '' },
          { label: 'ROAS', value: filtered[peekIdx]?.roas || '' },
          { label: 'Impressions', value: filtered[peekIdx]?.impressions || '' },
          { label: 'Clicks', value: filtered[peekIdx]?.clicks || '' },
          { label: 'Status', value: filtered[peekIdx]?.status || '' },
        ]}
      />

      <EditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorIdx === -1 ? 'New Campaign' : `Edit: ${CAMPAIGNS[editorIdx]?.name || ''}`}
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button>
            <button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast(editorIdx === -1 ? 'Campaign created.' : 'Campaign saved.'); }}>
              {editorIdx === -1 ? 'Create' : 'Save'}
            </button>
          </>
        }
      >
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Basics</span>
          <div className={styles.editorField}>
            <label className={styles.editorLabel}>Campaign name</label>
            <input className={styles.editorInput} type="text" placeholder="e.g. Holiday Tee Launch" defaultValue={editorIdx >= 0 ? CAMPAIGNS[editorIdx]?.name : ''} />
          </div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Network</label>
              <select className={styles.editorSelect} defaultValue={editorIdx >= 0 ? CAMPAIGNS[editorIdx]?.network : 'Meta'}>
                <option>Meta</option>
                <option>TikTok</option>
                <option>Google</option>
              </select>
            </div>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Objective</label>
              <select className={styles.editorSelect} defaultValue={editorIdx >= 0 ? CAMPAIGNS[editorIdx]?.objective : 'Conversions'}>
                <option>Conversions</option>
                <option>Reach</option>
                <option>Traffic</option>
                <option>Brand awareness</option>
              </select>
            </div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Budget</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Daily budget ($)</label>
              <input className={styles.editorInput} type="number" placeholder="50" />
            </div>
            <div className={styles.editorField}>
              <label className={styles.editorLabel}>Lifetime budget ($)</label>
              <input className={styles.editorInput} type="number" placeholder="1000" />
            </div>
          </div>
        </div>
      </EditorDrawer>
    </div>
  );
}
