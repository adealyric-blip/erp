'use client';

import { useState } from 'react';
import { PageHeader, KpiStrip, ViewToggle, ResourceTable, PeekDrawer, Modal } from './MarketingPrimitives';
import { exportToCsv } from '@/lib/csvExport';
import styles from './MarketingPrimitives.module.css';

interface AutomationScreenProps { onToast: (msg: string) => void; }

const RECIPES = [
  { name: 'Welcome series', trigger: 'New subscriber', condition: '—', action: 'Send welcome email', status: 'Active', runs: '142' },
  { name: 'Cart abandonment', trigger: 'Cart abandoned 1h', condition: 'Has items > $20', action: 'Send recovery email', status: 'Active', runs: '86' },
  { name: 'Post-purchase follow-up', trigger: 'Order delivered', condition: '—', action: 'Send review request', status: 'Active', runs: '320' },
  { name: 'Win-back inactive', trigger: 'No purchase 90d', condition: 'Was active', action: 'Send 15% off code', status: 'Active', runs: '48' },
  { name: 'Birthday discount', trigger: 'Birthday today', condition: '—', action: 'Send birthday email', status: 'Paused', runs: '12' },
  { name: 'VIP threshold', trigger: 'Total spend > $500', condition: '—', action: 'Add to VIP segment', status: 'Active', runs: '28' },
];

const RUNS = [
  { recipe: 'Welcome series', target: 'sarah@example.com', triggered: 'Nov 1 10:24 AM', status: 'Completed', result: 'Email sent' },
  { recipe: 'Cart abandonment', target: 'john@example.com', triggered: 'Nov 1 9:15 AM', status: 'Completed', result: 'Email sent' },
  { recipe: 'Post-purchase follow-up', target: 'alex@example.com', triggered: 'Oct 31 4:30 PM', status: 'Completed', result: 'Email sent' },
  { recipe: 'Win-back inactive', target: 'lakeside@example.com', triggered: 'Oct 31 2:00 PM', status: 'Completed', result: 'Email sent' },
  { recipe: 'VIP threshold', target: 'maple@example.com', triggered: 'Oct 30 5:00 PM', status: 'Completed', result: 'Segment updated' },
];

const KPI_DATA = [
  { label: 'Active recipes', value: '5', delta: '1 paused', deltaTone: 'neutral' as const },
  { label: 'Total runs (30d)', value: '636', delta: 'All completed', deltaTone: 'pos' as const },
  { label: 'Avg. execution time', value: '1.2s', delta: 'Within SLA', deltaTone: 'pos' as const },
  { label: 'Failed runs', value: '0', delta: 'No errors', deltaTone: 'pos' as const },
];

const RECIPE_COLUMNS = [
  { key: 'name', label: 'Recipe' },
  { key: 'trigger', label: 'Trigger' },
  { key: 'condition', label: 'Condition' },
  { key: 'action', label: 'Action' },
  { key: 'runs', label: 'Runs (30d)', right: true },
  { key: 'status', label: 'Status' },
];

const RUN_COLUMNS = [
  { key: 'recipe', label: 'Recipe' },
  { key: 'target', label: 'Target' },
  { key: 'triggered', label: 'Triggered' },
  { key: 'result', label: 'Result' },
  { key: 'status', label: 'Status' },
];

export default function AutomationScreen({ onToast }: AutomationScreenProps) {
  const [view, setView] = useState<'recipes' | 'runs'>('recipes');
  const [search, setSearch] = useState('');
  const [peekOpen, setPeekOpen] = useState(false);
  const [peekData, setPeekData] = useState<{ label: string; value: string }[]>([]);
  const [peekTitle, setPeekTitle] = useState('');
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);

  const filteredRecipes = RECIPES.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredRuns = RUNS.filter((r) => !search || r.recipe.toLowerCase().includes(search.toLowerCase()) || r.target.toLowerCase().includes(search.toLowerCase()));

  const handleExport = () => {
    if (view === 'recipes') {
      exportToCsv(filteredRecipes as unknown as Record<string, unknown>[], RECIPE_COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'automation-recipes');
      onToast(`Exported ${filteredRecipes.length} recipes.`);
    } else {
      exportToCsv(filteredRuns as unknown as Record<string, unknown>[], RUN_COLUMNS.map((c) => ({ key: c.key, label: c.label })), 'automation-runs');
      onToast(`Exported ${filteredRuns.length} runs.`);
    }
  };

  return (
    <div className="px-6 pb-12">
      <PageHeader breadcrumb={['Marketing', 'Automation']} title="Automation" subtitle="Trigger-based marketing recipes and execution log."
        actions={
          <>
            <button type="button" className={styles.btnOutline} onClick={handleExport}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> Export</button>
            <button type="button" className={styles.btnPrimary} onClick={() => setTriggerModalOpen(true)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New recipe</button>
            <ViewToggle tabs={[{ id: 'recipes', label: 'Recipes' }, { id: 'runs', label: 'Runs' }]} active={view} onChange={(v) => { setView(v); setSearch(''); }} />
          </>
        }
      />
      <KpiStrip items={KPI_DATA} />
      {view === 'recipes' ? (
        <ResourceTable
          columns={RECIPE_COLUMNS}
          rows={filteredRecipes as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search recipes…"
          searchValue={search}
          onSearchChange={setSearch}
          onRowClick={(row, idx) => {
            const r = filteredRecipes[idx];
            setPeekTitle(r.name);
            setPeekData([
              { label: 'Trigger', value: r.trigger },
              { label: 'Condition', value: r.condition },
              { label: 'Action', value: r.action },
              { label: 'Runs (30d)', value: r.runs },
              { label: 'Status', value: r.status },
            ]);
            setPeekOpen(true);
          }}
          bulkActions={[
            { label: 'Pause', icon: 'pause', onClick: () => { onToast('Paused selected recipes.'); } },
            { label: 'Resume', icon: 'play_arrow', onClick: () => { onToast('Resumed selected recipes.'); } },
            { label: 'Duplicate', icon: 'content_copy', onClick: () => { onToast('Duplicated selected recipes.'); } },
          ]}
          exportFn={handleExport}
        />
      ) : (
        <ResourceTable
          columns={RUN_COLUMNS}
          rows={filteredRuns as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search runs…"
          searchValue={search}
          onSearchChange={setSearch}
          onRowClick={(row, idx) => {
            const r = filteredRuns[idx];
            setPeekTitle(r.recipe);
            setPeekData([
              { label: 'Target', value: r.target },
              { label: 'Triggered', value: r.triggered },
              { label: 'Result', value: r.result },
              { label: 'Status', value: r.status },
            ]);
            setPeekOpen(true);
          }}
          exportFn={handleExport}
        />
      )}
      <PeekDrawer open={peekOpen} onClose={() => setPeekOpen(false)} title={peekTitle} fields={peekData} />
      <Modal open={triggerModalOpen} onClose={() => setTriggerModalOpen(false)} title="New Automation Recipe" footer={<><button type="button" className={styles.btnOutline} onClick={() => setTriggerModalOpen(false)}>Cancel</button><button type="button" className={styles.btnPrimary} onClick={() => { setTriggerModalOpen(false); onToast('Recipe created.'); }}>Create</button></>}>
        <div className={styles.editorField}><label className={styles.editorLabel}>Recipe name</label><input className={styles.editorInput} type="text" placeholder="e.g. Welcome series" /></div>
        <div className={styles.editorField}><label className={styles.editorLabel}>Trigger</label><select className={styles.editorSelect}><option>New subscriber</option><option>Cart abandoned 1h</option><option>Order delivered</option><option>No purchase 90d</option><option>Birthday today</option><option>Total spend threshold</option></select></div>
        <div className={styles.editorField}><label className={styles.editorLabel}>Condition (optional)</label><input className={styles.editorInput} type="text" placeholder="e.g. Has items > $20" /></div>
        <div className={styles.editorField}><label className={styles.editorLabel}>Action</label><select className={styles.editorSelect}><option>Send email</option><option>Add to segment</option><option>Send discount code</option><option>Tag customer</option><option>Notify team</option></select></div>
      </Modal>
    </div>
  );
}
