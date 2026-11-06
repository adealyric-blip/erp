'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface AdSetsScreenProps { onToast: (msg: string) => void; }

const AD_SETS = [
  { name: 'Holiday Tee — Lookalike 1%', campaign: 'Holiday Tee Launch', network: 'Meta', spend: '$1,240', roas: '4.2x', budget: '$50/day', status: 'Active' },
  { name: 'Mug — Retarget cart', campaign: 'Mug Collection Q4', network: 'Meta', spend: '$860', roas: '3.8x', budget: '$30/day', status: 'Active' },
  { name: 'TikTok — Broad reach', campaign: 'Brand Awareness', network: 'TikTok', spend: '$680', roas: '2.1x', budget: '$40/day', status: 'Active' },
  { name: 'Crewneck — Broad', campaign: 'Holiday Crewneck', network: 'Meta', spend: '$420', roas: '5.1x', budget: '$20/day', status: 'Paused' },
  { name: 'Retarget — abandoners', campaign: 'Retarget', network: 'Meta', spend: '$340', roas: '6.2x', budget: '$15/day', status: 'Active' },
];

const KPI_DATA = [
  { label: 'Active ad sets', value: '4', delta: '1 paused', deltaTone: 'neutral' as const },
  { label: 'Total spend (30d)', value: '$3,540', delta: 'Across 3 campaigns', deltaTone: 'neutral' as const },
  { label: 'Avg. ROAS', value: '4.3x', delta: 'Above 3.0x target', deltaTone: 'pos' as const },
  { label: 'Avg. CPC', value: '$0.42', delta: '−5% vs last 30d', deltaTone: 'pos' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Ad set' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'network', label: 'Network' },
  { key: 'budget', label: 'Budget', right: true },
  { key: 'spend', label: 'Spend', right: true },
  { key: 'roas', label: 'ROAS', right: true },
  { key: 'status', label: 'Status' },
];

export default function AdSetsScreen({ onToast }: AdSetsScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorIdx, setEditorIdx] = useState(0);

  const filtered = AD_SETS.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'ad-sets');
    onToast(`Exported ${filtered.length} ad sets to CSV.`);
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Advertising', 'Ad Sets']}
        title="Ad Sets"
        subtitle="Manage ad set budgets, placements, and bidding."
        actions={<button type="button" className={styles.btnPrimary} onClick={() => { setEditorIdx(-1); setEditorOpen(true); }}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New ad set</button>}
      />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search ad sets…"
        searchValue={search}
        onSearchChange={setSearch}
        selectedIds={selectedIds}
        onToggleSelect={(idx) => { const ri = AD_SETS.indexOf(filtered[idx]); setSelectedIds((p) => { const n = new Set(p); if (n.has(ri)) n.delete(ri); else n.add(ri); return n; }); }}
        onToggleSelectAll={() => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map((_, i) => AD_SETS.indexOf(filtered[i])))); }}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        bulkActions={[
          { label: 'Pause', icon: 'pause', onClick: () => { onToast(`Paused ${selectedIds.size} ad sets.`); setSelectedIds(new Set()); } },
          { label: 'Resume', icon: 'play_arrow', onClick: () => { onToast(`Resumed ${selectedIds.size} ad sets.`); setSelectedIds(new Set()); } },
          { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast(`Duplicated ${selectedIds.size} ad sets.`); setSelectedIds(new Set()); } },
        ]}
        exportFn={handleExport}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Ad set'} fields={[
        { label: 'Campaign', value: filtered[peekIdx]?.campaign || '' },
        { label: 'Network', value: filtered[peekIdx]?.network || '' },
        { label: 'Budget', value: filtered[peekIdx]?.budget || '' },
        { label: 'Spend', value: filtered[peekIdx]?.spend || '' },
        { label: 'ROAS', value: filtered[peekIdx]?.roas || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title={editorIdx === -1 ? 'New Ad Set' : `Edit: ${AD_SETS[editorIdx]?.name || ''}`} footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast(editorIdx === -1 ? 'Ad set created.' : 'Ad set saved.'); }}>{editorIdx === -1 ? 'Create' : 'Save'}</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Basics</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Ad set name</label><input className={styles.editorInput} type="text" placeholder="e.g. Holiday Tee — Lookalike 1%" defaultValue={editorIdx >= 0 ? AD_SETS[editorIdx]?.name : ''} /></div>
          <div className={styles.editorField}><label className={styles.editorLabel}>Campaign</label><select className={styles.editorSelect}><option>Holiday Tee Launch</option><option>Mug Collection Q4</option><option>Brand Awareness</option></select></div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Budget & Bidding</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Daily budget ($)</label><input className={styles.editorInput} type="number" placeholder="50" defaultValue={editorIdx >= 0 ? AD_SETS[editorIdx]?.budget?.replace('/day', '').replace('$', '') : ''} /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Bid strategy</label><select className={styles.editorSelect}><option>Lowest cost</option><option>Cost cap</option><option>Bid cap</option></select></div>
          </div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Placements</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Placement type</label><select className={styles.editorSelect}><option>Automatic placements</option><option>Manual placements</option></select></div>
        </div>
      </EditorDrawer>
    </div>
  );
}
