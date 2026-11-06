'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ResourceTable, PeekDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface AdSpendScreenProps {
  onToast: (msg: string) => void;
  onNavigate?: (domain: string, screenId: string) => void;
}

const SPEND_ENTRIES = [
  { date: 'Nov 1', network: 'Meta', campaign: 'Holiday Tee Launch', amount: '$50.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { date: 'Nov 1', network: 'TikTok', campaign: 'Brand Awareness', amount: '$40.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { date: 'Oct 31', network: 'Meta', campaign: 'Mug Collection Q4', amount: '$30.00', coa: 'Advertising — Digital', status: 'Mapped' },
  { date: 'Oct 31', network: 'Google', campaign: 'Google Search — Brand', amount: '$15.00', coa: '—', status: 'Unmapped' },
  { date: 'Oct 30', network: 'Meta', campaign: 'Retarget', amount: '$15.00', coa: 'Advertising — Digital', status: 'Mapped' },
];

const KPI_DATA = [
  { label: 'Total ad spend (MTD)', value: '$4,280', delta: 'Across 3 networks', deltaTone: 'neutral' as const },
  { label: 'Mapped to CoA', value: '$4,090', delta: '95.6% mapped', deltaTone: 'pos' as const },
  { label: 'Unmapped', value: '$190', delta: 'Needs review', deltaTone: 'neg' as const },
  { label: 'Journal entries', value: '12', delta: 'Posted to GL', deltaTone: 'pos' as const },
];

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'network', label: 'Network' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'amount', label: 'Amount', right: true },
  { key: 'coa', label: 'Chart of Accounts' },
  { key: 'status', label: 'Status' },
];

export default function AdSpendScreen({ onToast, onNavigate }: AdSpendScreenProps) {
  const [search, setSearch] = useState('');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekIdx, setPeekIdx] = useState(0);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const filtered = SPEND_ENTRIES.filter((s) => !search || s.campaign.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Advertising', 'Ad Spend & Finance']} title="Ad Spend & Finance Bridge" subtitle="Reconcile ad spend with your accounting ledger."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={() => onNavigate?.('finance', 'coa')}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance</span> Chart of Accounts</button>
            <button type="button" className={styles.btnOutline} onClick={() => onNavigate?.('finance', 'reconcile')}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span> Reconcile</button>
          </>
        }
      />
      <KpiStrip items={KPI_DATA} />
      <ResourceTable
        columns={COLUMNS}
        rows={filtered as unknown as Record<string, unknown>[]}
        searchPlaceholder="Search spend entries…"
        searchValue={search}
        onSearchChange={setSearch}
        onRowClick={(_, idx) => { setPeekIdx(idx); setPeekOpen(true); }}
        exportFn={() => { exportToCsv(filtered as unknown as Record<string, unknown>[], COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'ad-spend'); onToast(`Exported ${filtered.length} entries.`); }}
      />
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={filtered[peekIdx]?.campaign || 'Spend Entry'} fields={[
        { label: 'Date', value: filtered[peekIdx]?.date || '' },
        { label: 'Network', value: filtered[peekIdx]?.network || '' },
        { label: 'Amount', value: filtered[peekIdx]?.amount || '' },
        { label: 'Chart of Accounts', value: filtered[peekIdx]?.coa || '' },
        { label: 'Status', value: filtered[peekIdx]?.status || '' },
      ]} />
      <Modal open={mapModalOpen} onClose={() => setMapModalOpen(false)} title="Map to Chart of Accounts" footer={<><button type="button" className={styles.btnOutline} onClick={() => setMapModalOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setMapModalOpen(false); onToast('Spend entry mapped to CoA.'); }}>Map</button></>}>
        <div className={styles.editorField}><label className={styles.editorLabel}>Chart of Accounts account</label><select className={styles.editorSelect}><option>Advertising — Digital</option><option>Advertising — Social Media</option><option>Marketing — General</option><option>Uncategorized</option></select></div>
      </Modal>
      <button type="button" className={styles.btnOutline} style={{ marginTop: 16 }} onClick={() => setMapModalOpen(true)}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span> Map unmapped entries
      </button>
    </div>
  );
}
