'use client';
/* InvoicesScreen — Sales → Invoices list view.
   Reads from the shared platform store (not mock data).
   Create → opens Document Engine (type=Invoice).
   Row click → opens Document Engine for that invoice.
   Row ⋯ → real actions: View, Record payment, Send, Void, Delete.
   All mutations go through the store — no local state, no toast-only buttons. */

import { useState, useMemo } from 'react';
import { usePlatformStore, type DocumentStatus } from '@/lib/platformStore';
import { exportToCsv } from '@/lib/csvExport';
import DocumentEngine from './DocumentEngine';

interface InvoicesScreenProps {
  onToast: (m: string) => void;
  onNavigate?: (d: string, s: string) => void;
}

function statusPill(s: DocumentStatus) {
  const cls = s === 'Paid' || s === 'Deposited' ? 'paid' : s === 'Overdue' ? 'overdue' : s === 'Draft' ? 'draft' : s === 'Void' ? 'rejected' : 'sent';
  return <span className={`st ${cls}`}>{s}</span>;
}

export default function InvoicesScreen({ onToast }: InvoicesScreenProps) {
  const store = usePlatformStore();
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowMenuForId, setRowMenuForId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const invoices = useMemo(() => store.documents.filter(d => d.type === 'Invoice'), [store.documents]);
  const filtered = useMemo(() => invoices.filter(d => {
    const tabOK = tab === 'All' || d.status === tab;
    const party = store.getParty(d.partyId);
    const qOK = !q || (d.number + ' ' + (party?.name || '')).toLowerCase().includes(q.toLowerCase());
    return tabOK && qOK;
  }), [invoices, tab, q, store]);

  const tabs = ['All', 'Draft', 'Unpaid', 'Overdue', 'Paid'];
  const allChecked = filtered.length > 0 && filtered.every(d => selected.has(d.id));
  const someChecked = filtered.some(d => selected.has(d.id));

  function toggleRow(id: string) { setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function toggleAll() { if (allChecked) setSelected(new Set()); else setSelected(new Set(filtered.map(d => d.id))); }

  function handleExport() {
    exportToCsv(filtered as unknown as Record<string, unknown>[], [
      { key: 'number', label: 'Invoice #' }, { key: 'partyId', label: 'Customer' }, { key: 'date', label: 'Date' },
      { key: 'dueDate', label: 'Due' }, { key: 'total', label: 'Amount' }, { key: 'balance', label: 'Balance' }, { key: 'status', label: 'Status' },
    ], 'invoices');
    onToast(`Exported ${filtered.length} invoices`);
  }

  function rowAction(act: string, docId: string) {
    setRowMenuForId(null);
    const doc = store.getDocument(docId);
    if (!doc) return;
    switch (act) {
      case 'view': setEditingId(docId); break;
      case 'payment': setEditingId(docId); break;
      case 'send': store.changeDocumentStatus(docId, 'Sent'); onToast(`Invoice ${doc.number} sent`); break;
      case 'void': store.changeDocumentStatus(docId, 'Void'); onToast(`Invoice ${doc.number} voided`); break;
      case 'delete': store.deleteDocument(docId); onToast(`Invoice ${doc.number} deleted`); break;
    }
  }

  function bulkAction(act: string) {
    const ids = [...selected];
    if (act === 'close') { setSelected(new Set()); return; }
    if (act === 'send') { ids.forEach(id => store.changeDocumentStatus(id, 'Sent')); onToast(`Sent ${ids.length} invoices`); }
    else if (act === 'void') { ids.forEach(id => store.changeDocumentStatus(id, 'Void')); onToast(`Voided ${ids.length} invoices`); }
    else if (act === 'delete') { ids.forEach(id => store.deleteDocument(id)); onToast(`Deleted ${ids.length} invoices`); }
    else if (act === 'export') { handleExport(); }
    setSelected(new Set());
  }

  // ── Document Engine view (create or edit) ──
  if (creating) {
    return <DocumentEngine type="Invoice" onToast={onToast} onClose={() => setCreating(false)} />;
  }
  if (editingId) {
    return <DocumentEngine type="Invoice" documentId={editingId} onToast={onToast} onClose={() => setEditingId(null)} />;
  }

  return (
    <main className="px-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mt-4 mb-2">
        <span>Sales</span><span className="text-outline">/</span><span className="text-on-surface font-semibold">Invoices</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 py-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg">Invoices</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Every invoice across all customers — create, send, and get paid.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1" onClick={handleExport}><span className="material-symbols-outlined text-[16px]">download</span>Export</button>
          <button className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main" onClick={() => setCreating(true)}><span className="material-symbols-outlined text-[16px]">add</span>New invoice</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Total invoices</div>
          <div className="text-headline-sm mt-1 tabular-nums">{invoices.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Outstanding</div>
          <div className="text-headline-sm mt-1 tabular-nums text-error">${invoices.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0).toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Overdue</div>
          <div className="text-headline-sm mt-1 tabular-nums text-error">{invoices.filter(d => d.status === 'Overdue').length}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-dim p-3">
          <div className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Paid (30d)</div>
          <div className="text-headline-sm mt-1 tabular-nums text-secondary">${invoices.filter(d => d.status === 'Paid').reduce((s, d) => s + d.amountPaid, 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
          {tabs.map(t => <button key={t} className={`h-full px-3 text-label-md tab-underline ${tab === t ? 'active' : 'text-on-surface-variant'}`} onClick={() => { setTab(t); setSelected(new Set()); }}>{t}</button>)}
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
          <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
            <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
            <input className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary" placeholder="Filter by invoice #, customer…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <span className="ml-auto text-[11px] text-on-surface-variant">{filtered.length} of {invoices.length}</span>
        </div>

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="bulk-bar show">
            <span className="text-[12px] font-semibold">{selected.size} selected</span>
            <span className="w-px h-4 bg-white/30" />
            <button onClick={() => bulkAction('send')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">send</span>Send</button>
            <button onClick={() => bulkAction('export')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">download</span>Export</button>
            <span className="w-px h-4 bg-white/30" />
            <button onClick={() => bulkAction('void')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">block</span>Void</button>
            <button onClick={() => bulkAction('delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" onClick={() => bulkAction('close')}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-12 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-surface-container-low flex items-center justify-center mb-3"><span className="material-symbols-outlined text-[28px] text-outline">receipt_long</span></div>
            <h3 className="text-headline-sm mb-1">No invoices</h3>
            <p className="text-body-sm text-on-surface-variant mb-3">Create your first invoice to get paid.</p>
            <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 mx-auto" onClick={() => setCreating(true)}><span className="material-symbols-outlined text-[16px]">add</span>New invoice</button>
          </div>
        ) : (
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }} onChange={toggleAll} /></th>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Status</th>
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {filtered.map(d => {
                const party = store.getParty(d.partyId);
                return (
                  <tr key={d.id} className="hover:bg-surface-container-low cursor-pointer" onClick={() => setEditingId(d.id)}>
                    <td className="px-3 py-2"><input type="checkbox" className="row-check" checked={selected.has(d.id)} onClick={e => e.stopPropagation()} onChange={() => toggleRow(d.id)} /></td>
                    <td className="px-3 py-2 font-medium">{d.number}</td>
                    <td className="px-3 py-2">{party?.name || '—'}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{d.date}</td>
                    <td className="px-3 py-2 text-on-surface-variant">{d.dueDate}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${d.total.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${d.balance > 0 ? 'text-error' : 'text-on-surface-variant'}`}>${d.balance.toFixed(2)}</td>
                    <td className="px-3 py-2">{statusPill(d.status)}</td>
                    <td className="px-2 py-2 text-right relative">
                      <button className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center" onClick={e => { e.stopPropagation(); setRowMenuForId(rowMenuForId === d.id ? null : d.id); }}><span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span></button>
                      {rowMenuForId === d.id && (
                        <div className="row-menu open" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4 }} onClick={e => e.stopPropagation()}>
                          <div className="menu-header">This invoice</div>
                          <button onClick={() => rowAction('view', d.id)}><span className="material-symbols-outlined">open_in_new</span>Open invoice</button>
                          <button onClick={() => rowAction('send', d.id)}><span className="material-symbols-outlined">send</span>Send</button>
                          <div className="sep" />
                          <div className="menu-header">Money</div>
                          {d.balance > 0 && <button onClick={() => rowAction('payment', d.id)}><span className="material-symbols-outlined">payments</span>Record payment</button>}
                          <div className="sep" />
                          <button className="danger" onClick={() => rowAction('void', d.id)}><span className="material-symbols-outlined">block</span>Void</button>
                          <button className="danger" onClick={() => rowAction('delete', d.id)}><span className="material-symbols-outlined">delete</span>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Totals footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-2 flex justify-end gap-8 border-t border-surface-dim text-[12px] text-on-surface-variant">
            <span>Total: <strong className="text-on-surface tabular-nums">${filtered.reduce((s, d) => s + d.total, 0).toFixed(2)}</strong></span>
            <span>Outstanding: <strong className="text-error tabular-nums">${filtered.reduce((s, d) => s + d.balance, 0).toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      {/* Click-away for row menu */}
      {rowMenuForId && <div style={{ position: 'fixed', inset: 0, zIndex: 150 }} onClick={() => setRowMenuForId(null)} />}
    </main>
  );
}
