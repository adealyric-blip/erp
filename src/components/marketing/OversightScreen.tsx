'use client';

/**
 * Oversight — approval queue + decisions log for social publishing.
 * Source: upload/marketing_extracted/Marketing/publishing oversight.html.
 *
 * View toggle: Queue / Decisions log.
 * Queue shows pending items with approve/reject/flag/delegate bulk actions.
 * Decisions log shows past decisions.
 */
import { useState } from 'react';
import { PageHeader, KpiStrip, ViewToggle, ResourceTable, PeekDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface OversightScreenProps {
  onToast: (msg: string) => void;
}

const QUEUE_ITEMS = [
  { id: 1, title: 'October product spotlight', channel: 'Instagram', author: 'Sarah Miller', submitted: 'Nov 1 10:24 AM', status: 'Pending' },
  { id: 2, title: 'New hoodie drop announcement', channel: 'TikTok', author: 'John Doe', submitted: 'Nov 1 9:15 AM', status: 'Pending' },
  { id: 3, title: 'Behind the scenes — Studio redesign', channel: 'Facebook', author: 'Alex Lee', submitted: 'Oct 31 4:30 PM', status: 'Flagged' },
  { id: 4, title: 'Customer spotlight: Lakeside Design', channel: 'Instagram', author: 'Sarah Miller', submitted: 'Oct 31 2:00 PM', status: 'Pending' },
  { id: 5, title: 'Black Friday teaser post', channel: 'TikTok', author: 'John Doe', submitted: 'Oct 30 5:00 PM', status: 'Pending' },
];

const DECISIONS = [
  { id: 1, title: 'Holiday gift guide carousel', channel: 'Instagram', decision: 'Approved', by: 'SA', date: 'Oct 29 3:00 PM' },
  { id: 2, title: 'Flash sale announcement', channel: 'Facebook', decision: 'Rejected', by: 'SA', date: 'Oct 28 1:00 PM' },
  { id: 3, title: 'Supplier spotlight: Printful', channel: 'LinkedIn', decision: 'Approved', by: 'SA', date: 'Oct 27 11:00 AM' },
  { id: 4, title: 'Weekend meme post', channel: 'TikTok', decision: 'Delegated', by: 'SA', date: 'Oct 26 4:00 PM' },
];

const KPI_DATA = [
  { label: 'Pending review', value: '4', delta: '2 new today', deltaTone: 'neutral' as const },
  { label: 'Approved this week', value: '18', delta: '+5 from last week', deltaTone: 'pos' as const },
  { label: 'Rejected this week', value: '3', delta: 'Down 2 from last week', deltaTone: 'pos' as const },
  { label: 'Avg. review time', value: '2.4h', delta: 'Within SLA', deltaTone: 'pos' as const },
];

export default function OversightScreen({ onToast }: OversightScreenProps) {
  const [view, setView] = useState<'queue' | 'decisions'>('queue');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekData, setPeekData] = useState<{ title: string; channel: string; author: string; submitted: string; status: string } | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  const toggleSelect = (idx: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === QUEUE_ITEMS.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(QUEUE_ITEMS.map((_, i) => i)));
  };

  const handleBulk = (action: string) => {
    onToast(`${action} ${selectedIds.size} item(s).`);
    setSelectedIds(new Set());
  };

  const handleRowClick = (row: Record<string, unknown>, idx: number) => {
    const item = QUEUE_ITEMS[idx];
    setPeekData(item);
    setPeekOpen(true);
  };

  const handleExport = () => {
    const data = view === 'queue' ? QUEUE_ITEMS : DECISIONS;
    const cols = view === 'queue'
      ? [{ key: 'title', label: 'Title' }, { key: 'channel', label: 'Channel' }, { key: 'author', label: 'Author' }, { key: 'submitted', label: 'Submitted' }, { key: 'status', label: 'Status' }]
      : [{ key: 'title', label: 'Title' }, { key: 'channel', label: 'Channel' }, { key: 'decision', label: 'Decision' }, { key: 'by', label: 'By' }, { key: 'date', label: 'Date' }];
    exportToCsv(data as unknown as Record<string, unknown>[], cols, `oversight-${view}`);
    onToast(`Exported ${data.length} records to CSV.`);
  };

  const queueColumns = [
    { key: 'title', label: 'Title' },
    { key: 'channel', label: 'Channel' },
    { key: 'author', label: 'Author' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'status', label: 'Status' },
  ];

  const decisionColumns = [
    { key: 'title', label: 'Title' },
    { key: 'channel', label: 'Channel' },
    { key: 'decision', label: 'Decision' },
    { key: 'by', label: 'By' },
    { key: 'date', label: 'Date' },
  ];

  return (
    <div className="px-6 pb-12">
      <PageHeader
        breadcrumb={['Marketing', 'Social publishing', 'Oversight']}
        title="Oversight"
        subtitle="Review and approve social content before it goes live."
        actions={
          <ViewToggle
            tabs={[{ id: 'queue', label: 'Queue' }, { id: 'decisions', label: 'Decisions log' }]}
            active={view}
            onChange={(v) => { setView(v); setSelectedIds(new Set()); }}
          />
        }
      />

      <KpiStrip items={KPI_DATA} />

      {view === 'queue' && (
        <ResourceTable
          columns={queueColumns}
          rows={QUEUE_ITEMS as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search queue…"
          searchValue=""
          onSearchChange={() => {}}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onRowClick={handleRowClick}
          bulkActions={[
            { label: 'Approve', icon: 'check', onClick: () => handleBulk('Approved') },
            { label: 'Reject', icon: 'close', danger: true, onClick: () => handleBulk('Rejected') },
            { label: 'Flag', icon: 'flag', onClick: () => handleBulk('Flagged') },
            { label: 'Delegate', icon: 'forward', onClick: () => handleBulk('Delegated') },
          ]}
          exportFn={handleExport}
          emptyTitle="Queue is empty"
          emptyText="All posts have been reviewed. New submissions will appear here."
        />
      )}

      {view === 'decisions' && (
        <ResourceTable
          columns={decisionColumns}
          rows={DECISIONS as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search decisions…"
          searchValue=""
          onSearchChange={() => {}}
          onRowClick={(row, idx) => {
            const item = DECISIONS[idx];
            setPeekData({ title: item.title, channel: item.channel, author: item.by, submitted: item.date, status: item.decision });
            setPeekOpen(true);
          }}
          exportFn={handleExport}
        />
      )}

      <PeekDrawer
        open={peekOpen}
        onClose={() => setPeekOpen(false)}
        title={peekData?.title || ''}
        fields={[
          { label: 'Channel', value: peekData?.channel || '' },
          { label: 'Author', value: peekData?.author || '' },
          { label: 'Submitted', value: peekData?.submitted || '' },
          { label: 'Status', value: peekData?.status || '' },
        ]}
      />

      <Modal
        open={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        title="Approval Rules"
        footer={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setRulesModalOpen(false)}>Cancel</button>
            <button type="button" className={styles.btnPrimary} onClick={() => { setRulesModalOpen(false); onToast('Rules saved.'); }}>Save Rules</button>
          </>
        }
      >
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>Auto-approve from trusted authors</label>
          <select className={styles.editorSelect}>
            <option>Disabled</option>
            <option>Admins only</option>
            <option>Admins + Editors</option>
          </select>
        </div>
        <div className={styles.editorField}>
          <label className={styles.editorLabel}>SLA timeout (hours)</label>
          <input className={styles.editorInput} type="number" defaultValue="24" />
        </div>
      </Modal>

      <button
        type="button"
        className={styles.btnOutline}
        style={{ marginTop: 16 }}
        onClick={() => setRulesModalOpen(true)}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rule</span>
        Configure approval rules
      </button>
    </div>
  );
}
