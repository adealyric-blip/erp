'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, EditorDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface NewsletterScreenProps { onToast: (msg: string) => void; }

const CAMPAIGNS = [
  { name: 'October product spotlight', subject: 'New arrivals: October collection', sent: 'Oct 28', recipients: '4,820', opens: '38%', clicks: '12%', status: 'Sent' },
  { name: 'Holiday teaser', subject: 'Something special is coming…', sent: 'Oct 25', recipients: '4,910', opens: '42%', clicks: '8%', status: 'Sent' },
  { name: 'Black Friday preview', subject: 'Your Black Friday early access', sent: '—', recipients: '—', opens: '—', clicks: '—', status: 'Scheduled' },
  { name: 'Customer spotlight: Lakeside', subject: 'How Lakeside Design uses Unsaid', sent: 'Oct 20', recipients: '4,680', opens: '35%', clicks: '15%', status: 'Sent' },
  { name: 'Welcome series — Email 1', subject: 'Welcome to Unsaid!', sent: 'Oct 18', recipients: '142', opens: '68%', clicks: '24%', status: 'Sent' },
  { name: 'Cart abandonment recovery', subject: 'You left something behind', sent: 'Oct 15', recipients: '86', opens: '52%', clicks: '18%', status: 'Sent' },
];

const KPI_DATA = [
  { label: 'Subscribers', value: '4,910', delta: '+42 this week', deltaTone: 'pos' as const },
  { label: 'Avg. open rate', value: '45%', delta: 'Above industry avg (21%)', deltaTone: 'pos' as const },
  { label: 'Avg. click rate', value: '14%', delta: 'Above industry avg (2.6%)', deltaTone: 'pos' as const },
  { label: 'Campaigns sent (MTD)', value: '4', delta: '1 scheduled', deltaTone: 'neutral' as const },
];

const COLUMNS = [
  { key: 'name', label: 'Campaign' },
  { key: 'subject', label: 'Subject' },
  { key: 'sent', label: 'Sent' },
  { key: 'recipients', label: 'Recipients', right: true },
  { key: 'opens', label: 'Open rate', right: true },
  { key: 'clicks', label: 'Click rate', right: true },
  { key: 'status', label: 'Status' },
];

export default function NewsletterScreen({ onToast }: NewsletterScreenProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = CAMPAIGNS.filter((c) => {
    const tabMatch = activeTab === 'all' || c.status.toLowerCase() === activeTab;
    const searchMatch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase());
    return tabMatch && searchMatch;
  });

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Newsletter']} title="Newsletter Campaigns" subtitle="Create, send, and track email campaigns."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => setTemplatesModalOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>view_quilt</span> Templates</button>
            <button type="button" className={styles.btnPrimary} onClick={() => setEditorOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New campaign</button>
          </>
        }
      />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        statusTabs={[
          { id: 'all', label: 'All', count: 6 },
          { id: 'sent', label: 'Sent', count: 5 },
          { id: 'scheduled', label: 'Scheduled', count: 1 },
        ]}
        activeStatusTab={activeTab}
        onStatusTabChange={setActiveTab}
        searchPlaceholder="Search campaigns…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        bulkActions={[
          { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast('Duplicated selected campaigns.'); } },
          { label: 'Archive', icon: 'archive', onClick: () => { onToast('Archived selected campaigns.'); } },
        ]}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'newsletter-campaigns'); onToast(`Exported ${filtered.length} campaigns.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.name || 'Campaign'} fields={[
        { label: 'Subject', value: filtered[peekIdx]?.subject || '' },
        { label: 'Sent', value: filtered[peekIdx]?.sent || '' },
        { label: 'Recipients', value: filtered[peekIdx]?.recipients || '' },
        { label: 'Open rate', value: filtered[peekIdx]?.opens || '' },
        { label: 'Click rate', value: filtered[peekIdx]?.clicks || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <Modal open={templatesModalOpen} onClose={() => setTemplatesModalOpen(false)} title="Email Templates" footer={<button type="button" className={styles.btnOutline} onClick={() => setTemplatesModalOpen(false)}>Close</button>}>
        <div className="flex flex-col gap-3">
          {['Holiday Spotlight', 'Product Drop', 'Welcome Series', 'Cart Recovery', 'Customer Spotlight'].map((t) => (
            <div key={t} className="border border-dad9dd rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-f4f3f7" onClick={() => { setTemplatesModalOpen(false); setEditorOpen(true); onToast(`Using template: ${t}`); }}>
              <span className="text-sm font-medium">{t}</span>
              <span className="material-symbols-outlined text-5a6355" style={{ fontSize: 18 }}>chevron_right</span>
            </div>
          ))}
        </div>
      </Modal>
      <EditorDrawer open={editorOpen} onClose={() => setEditorOpen(false)} title="New Campaign" footer={<><button type="button" className={styles.btnOutline} onClick={() => setEditorOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setEditorOpen(false); onToast('Campaign created. Schedule or send when ready.'); }}>Create</button></>}>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Campaign details</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Campaign name</label><input className={styles.editorInput} type="text" placeholder="e.g. November product spotlight" /></div>
          <div className={styles.editorField}><label className={styles.editorLabel}>Subject line</label><input className={styles.editorInput} type="text" placeholder="e.g. New arrivals: November collection" /></div>
          <div className={styles.editorField}><label className={styles.editorLabel}>Preview text</label><input className={styles.editorInput} type="text" placeholder="A sneak peek of what's inside…" /></div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Audience</span>
          <div className={styles.editorField}><label className={styles.editorLabel}>Send to</label><select className={styles.editorSelect}><option>All subscribers (4,910)</option><option>Active only (4,200)</option><option>New subscribers (142)</option><option>Custom segment</option></select></div>
        </div>
        <div className={styles.editorSection}>
          <span className={styles.editorSectionTitle}>Schedule</span>
          <div className={styles.editorRow}>
            <div className={styles.editorField}><label className={styles.editorLabel}>Send date</label><input className={styles.editorInput} type="date" /></div>
            <div className={styles.editorField}><label className={styles.editorLabel}>Send time</label><input className={styles.editorInput} type="time" defaultValue="10:00" /></div>
          </div>
        </div>
      </EditorDrawer>
    </div>
  );
}
