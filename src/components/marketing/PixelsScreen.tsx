'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface PixelsScreenProps { onToast: (msg: string) => void; }

const PIXELS = [
  { name: 'Meta Pixel', id: '892345678901234', network: 'Meta', events: 'PageView, ViewContent, AddToCart, Purchase', lastFired: '2 min ago', status: 'Live' },
  { name: 'TikTok Pixel', id: 'C8K9M2N7P4Q1R6S3', network: 'TikTok', events: 'ViewContent, AddToCart, CompletePayment', lastFired: '15 min ago', status: 'Live' },
  { name: 'Google Ads Tag', id: 'AW-CONV-12345', network: 'Google', events: 'Purchase, Lead', lastFired: '1 hour ago', status: 'Paused' },
  { name: 'Pinterest Tag', id: 'PIN-TAG-98765', network: 'Pinterest', events: 'PageVisit, AddToCart', lastFired: '3 hours ago', status: 'Error' },
];

const KPI_DATA = [
  { label: 'Active pixels', value: '2', delta: '1 paused, 1 error', deltaTone: 'neutral' as const },
  { label: 'Total events tracked (30d)', value: '48.2K', delta: 'Across 4 pixels', deltaTone: 'neutral' as const },
  { label: 'Purchase events', value: '1,240', delta: '+18% vs last 30d', deltaTone: 'pos' as const },
  { label: 'Errors', value: '1', delta: 'Pinterest tag needs reconnection', deltaTone: 'neg' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Pixel' },
  { key: 'id', label: 'Pixel ID' },
  { key: 'network', label: 'Network' },
  { key: 'events', label: 'Tracked events' },
  { key: 'lastFired', label: 'Last fired' },
  { key: 'status', label: 'Status' },
];

export default function PixelsScreen({ onToast }: PixelsScreenProps) {
  const [search, setSearch] = useState('');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selfTestOpen, setSelfTestOpen] = useState(false);

  const filtered = PIXELS.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Advertising', 'Pixels']} title="Pixels" subtitle="Manage tracking pixels for conversion attribution."
        actions={<button type="button" className={styles.btnPrimary} onClick={() => setEditorOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add pixel</button>} />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search pixels…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'pixels'); onToast(`Exported ${filtered.length} pixels.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Pixel'} fields={[
        { label: 'Pixel ID', value: filtered[peekIdx]?.id || '' },
        { label: 'Network', value: filtered[peekIdx]?.network || '' },
        { label: 'Events', value: filtered[peekIdx]?.events || '' },
        { label: 'Last fired', value: filtered[peekIdx]?.lastFired || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title="Add Pixel" footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast('Pixel added.'); }}>Add</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Pixel details</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Pixel name</label><input className={styles.editorInput} type="text" placeholder="e.g. Meta Pixel" /></div>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Network</label><select className={styles.editorSelect}><option>Meta</option><option>TikTok</option><option>Google</option><option>Pinterest</option><option>LinkedIn</option></select></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Pixel ID</label><input className={styles.editorInput} type="text" placeholder="e.g. 892345678901234" /></div>
          </div>
        </div>
      </EditorDrawer>
      <Modal open={selfTestOpen} onClose={() => setSelfTestOpen(false)} title="Self-Test" footer={<button type="button" className={styles.btnOutline} onClick={() => setSelfTestOpen(false)}>Close</button>}>
        <div className="flex flex-col gap-3">
          <div className="border border-dad9dd rounded-lg p-3"><span className="text-sm font-semibold">PageView</span> <span className="text-xs px-2 py-0.5 rounded-full bg-e8f5e9 text-2e7d32 font-semibold float-right">✓ Passed</span></div>
          <div className="border border-dad9dd rounded-lg p-3"><span className="text-sm font-semibold">ViewContent</span> <span className="text-xs px-2 py-0.5 rounded-full bg-e8f5e9 text-2e7d32 font-semibold float-right">✓ Passed</span></div>
          <div className="border border-dad9dd rounded-lg p-3"><span className="text-sm font-semibold">AddToCart</span> <span className="text-xs px-2 py-0.5 rounded-full bg-ffdad6 text-ba1a1a font-semibold float-right">✗ Failed</span></div>
          <div className="border border-dad9dd rounded-lg p-3"><span className="text-sm font-semibold">Purchase</span> <span className="text-xs px-2 py-0.5 rounded-full bg-e8f5e9 text-2e7d32 font-semibold float-right">✓ Passed</span></div>
        </div>
      </Modal>
      <button type="button" className={styles.btnOutline} style={{ marginTop: 16 }} onClick={() => setSelfTestOpen(true)}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bug_report</span> Run self-test
      </button>
    </div>
  );
}
