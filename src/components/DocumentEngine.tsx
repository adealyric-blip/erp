'use client';
/* DocumentEngine.tsx — The ONE engine that renders every multi-line transaction.
   Per platform-component-map.md §1.1 Rule:
   "Every Document is rendered by one Document Engine (header → lines → totals →
   attachments/memo → status → activity). Invoice, Bill, PO, Sales order, Estimate,
   Credit memo, Vendor credit differ only by config."
   
   This replaces the 8+ separate finance screen implementations. */

import { useState, useMemo } from 'react';
import { usePlatformStore, type DocumentType, type Document, type DocumentLine, type Party } from '@/lib/platformStore';

/* ─── Document Config (what makes each type different) ─── */
interface DocConfig {
  type: DocumentType;
  label: string;           // "Invoice", "Bill", "Purchase Order"
  numberPrefix: string;    // "INV-", "BILL-", "PO-"
  partyLabel: string;      // "Customer", "Vendor", "Supplier"
  partyRole: string;       // "Customer", "Vendor", "Supplier"
  dateLabel: string;       // "Invoice date", "Bill date"
  dueLabel: string;        // "Due date", "Due date"
  lineColumns: { key: string; label: string; width?: string; align?: 'left' | 'right' }[];
  statuses: string[];
  canRecordPayment: boolean;
  canSend: boolean;
  canPrint: boolean;
  showShipTo: boolean;
  showPaymentOptions: boolean;
  primaryAction: string;   // "Review and send", "Save bill", "Send to supplier"
}

const CONFIGS: Record<DocumentType, DocConfig> = {
  Invoice: {
    type: 'Invoice', label: 'Invoice', numberPrefix: 'INV-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Invoice date', dueLabel: 'Due date',
    lineColumns: [
      { key: 'description', label: 'Product/service', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Sent', 'Unpaid', 'Overdue', 'Paid', 'Deposited', 'Void'],
    canRecordPayment: true, canSend: true, canPrint: true, showShipTo: false, showPaymentOptions: true,
    primaryAction: 'Review and send',
  },
  Estimate: {
    type: 'Estimate', label: 'Estimate', numberPrefix: 'EST-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Estimate date', dueLabel: 'Expiration date',
    lineColumns: [
      { key: 'description', label: 'Product/service', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Sent', 'Converted', 'Declined', 'Closed'],
    canRecordPayment: false, canSend: true, canPrint: true, showShipTo: false, showPaymentOptions: false,
    primaryAction: 'Review and send',
  },
  Bill: {
    type: 'Bill', label: 'Bill', numberPrefix: 'BILL-', partyLabel: 'Vendor', partyRole: 'Vendor',
    dateLabel: 'Bill date', dueLabel: 'Due date',
    lineColumns: [
      { key: 'description', label: 'Category / Item', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['ForReview', 'Approved', 'Unpaid', 'Overdue', 'Paid', 'Void'],
    canRecordPayment: true, canSend: false, canPrint: true, showShipTo: false, showPaymentOptions: false,
    primaryAction: 'Save bill',
  },
  PurchaseOrder: {
    type: 'PurchaseOrder', label: 'Purchase Order', numberPrefix: 'PO-', partyLabel: 'Supplier', partyRole: 'Supplier',
    dateLabel: 'Order date', dueLabel: 'Expected delivery',
    lineColumns: [
      { key: 'description', label: 'Item', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Unit cost', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Open', 'Sent', 'PartiallyReceived', 'Received', 'Closed'],
    canRecordPayment: false, canSend: true, canPrint: true, showShipTo: true, showPaymentOptions: false,
    primaryAction: 'Send to supplier',
  },
  SalesReceipt: {
    type: 'SalesReceipt', label: 'Sales Receipt', numberPrefix: 'SR-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Sale date', dueLabel: '',
    lineColumns: [
      { key: 'description', label: 'Product/service', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Paid', 'Deposited'],
    canRecordPayment: false, canSend: true, canPrint: true, showShipTo: false, showPaymentOptions: true,
    primaryAction: 'Save and print',
  },
  CreditMemo: {
    type: 'CreditMemo', label: 'Credit Memo', numberPrefix: 'CM-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Date', dueLabel: '',
    lineColumns: [
      { key: 'description', label: 'Product/service', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Applied', 'Refunded', 'Void'],
    canRecordPayment: true, canSend: true, canPrint: true, showShipTo: false, showPaymentOptions: false,
    primaryAction: 'Save',
  },
  SalesOrder: {
    type: 'SalesOrder', label: 'Sales Order', numberPrefix: 'SO-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Order date', dueLabel: 'Expected ship',
    lineColumns: [
      { key: 'description', label: 'Product/service', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Open', 'Fulfilled', 'Closed'],
    canRecordPayment: true, canSend: true, canPrint: true, showShipTo: true, showPaymentOptions: false,
    primaryAction: 'Save order',
  },
  VendorCredit: {
    type: 'VendorCredit', label: 'Vendor Credit', numberPrefix: 'VC-', partyLabel: 'Vendor', partyRole: 'Vendor',
    dateLabel: 'Date', dueLabel: '',
    lineColumns: [
      { key: 'description', label: 'Category / Item', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Applied', 'Void'],
    canRecordPayment: false, canSend: false, canPrint: true, showShipTo: false, showPaymentOptions: false,
    primaryAction: 'Save',
  },
  JournalEntry: {
    type: 'JournalEntry', label: 'Journal Entry', numberPrefix: 'JE-', partyLabel: '—', partyRole: '',
    dateLabel: 'Date', dueLabel: '',
    lineColumns: [
      { key: 'account', label: 'Account', align: 'left' },
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'debit', label: 'Debit', width: '120px', align: 'right' },
      { key: 'credit', label: 'Credit', width: '120px', align: 'right' },
    ],
    statuses: ['Draft', 'Posted'],
    canRecordPayment: false, canSend: false, canPrint: true, showShipTo: false, showPaymentOptions: false,
    primaryAction: 'Post',
  },
  RMA: {
    type: 'RMA', label: 'Return / RMA', numberPrefix: 'RMA-', partyLabel: 'Customer', partyRole: 'Customer',
    dateLabel: 'Date', dueLabel: '',
    lineColumns: [
      { key: 'description', label: 'Item', align: 'left' },
      { key: 'qty', label: 'Qty', width: '80px', align: 'right' },
      { key: 'rate', label: 'Rate', width: '100px', align: 'right' },
      { key: 'amount', label: 'Refund amount', width: '120px', align: 'right' },
    ],
    statuses: ['Requested', 'Approved', 'Received', 'Refunded', 'Declined'],
    canRecordPayment: true, canSend: true, canPrint: true, showShipTo: true, showPaymentOptions: false,
    primaryAction: 'Save',
  },
};

export { CONFIGS as DOC_CONFIGS };
export type { DocConfig };

/* ─── The Document Engine Component ─── */
interface DocumentEngineProps {
  type: DocumentType;
  documentId?: string | null; // null = new document
  onToast: (msg: string) => void;
  onClose?: () => void;
  partyId?: string | null; // prefill from envelope
}

export default function DocumentEngine({ type, documentId, onToast, onClose, partyId: prefillPartyId }: DocumentEngineProps) {
  const config = CONFIGS[type];
  const store = usePlatformStore();
  
  const existing = documentId ? store.getDocument(documentId) : null;
  const isNew = !existing;

  // Form state
  const [number, setNumber] = useState(existing?.number || `${config.numberPrefix}${String(store.documents.length + 1001)}`);
  const [partyId, setPartyId] = useState(existing?.partyId || prefillPartyId || '');
  const [status, setStatus] = useState(existing?.status || 'Draft');
  const [date, setDate] = useState(existing?.date || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(existing?.dueDate || '');
  const [lines, setLines] = useState<DocumentLine[]>(existing?.lines || [{ id: 'L1', itemId: null, description: '', qty: 1, rate: 0, amount: 0, taxRate: 0, account: '', tags: [] }]);
  const [shipping, setShipping] = useState(existing?.shipping || 0);
  const [memo, setMemo] = useState(existing?.memo || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [view, setView] = useState<'edit' | 'email' | 'payor' | 'pdf'>('edit');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const party = partyId ? store.getParty(partyId) : null;
  
  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);
  const tax = useMemo(() => lines.reduce((s, l) => s + (l.amount * l.taxRate / 100), 0), [lines]);
  const total = subtotal + tax + shipping;
  const balance = existing ? existing.balance : total;

  function updateLine(idx: number, updates: Partial<DocumentLine>) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, ...updates };
      updated.amount = updated.qty * updated.rate;
      return updated;
    }));
  }

  function addLine() {
    setLines(prev => [...prev, { id: `L${prev.length + 1}`, itemId: null, description: '', qty: 1, rate: 0, amount: 0, taxRate: 0, account: '', tags: [] }]);
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }

  function save() {
    if (!partyId) { onToast(`${config.partyLabel} is required`); return; }
    const docData = {
      type, number, partyId, status, date, dueDate, lines, subtotal, tax: Math.round(tax * 100) / 100, shipping, total, amountPaid: existing?.amountPaid || 0, balance: total - (existing?.amountPaid || 0), memo, notes, tags: existing?.tags || [], attachments: existing?.attachments || [], orderId: existing?.orderId || null, poId: existing?.poId || null, channelId: existing?.channelId || null, createdBy: 'Current user',
    };
    if (existing) {
      store.updateDocument(existing.id, docData);
      store.recalcDocument(existing.id);
      onToast(`${config.label} saved`);
    } else {
      const id = store.addDocument(docData as Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'activity'>);
      onToast(`${config.label} ${number} created`);
    }
    onClose?.();
  }

  function send() {
    if (!existing && isNew) { save(); return; }
    if (existing) {
      store.changeDocumentStatus(existing.id, 'Sent' as any);
      onToast(`${config.label} ${number} sent to ${party?.email || 'customer'}`);
    }
  }

  function recordPayment(amount: number, method: string, account: string) {
    if (!existing) { onToast('Save the document first'); return; }
    store.recordPayment(existing.id, amount, method, account);
    onToast(`Payment of $${amount.toFixed(2)} recorded via ${method}`);
    setShowPaymentModal(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="h-12 bg-white border-b border-surface-dim flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          {['edit', 'email', 'payor', 'pdf'].map(v => (
            <button key={v} className={`px-3 py-2 text-[13px] tab-underline ${view === v ? 'active' : 'text-on-surface-variant'}`} onClick={() => setView(v as any)}>
              {v === 'edit' ? 'Edit' : v === 'email' ? 'Email view' : v === 'payor' ? 'Payor view' : 'PDF view'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[13px] text-on-surface-variant">
          {onClose && <button className="icon-btn" onClick={onClose}><span className="material-symbols-outlined">close</span></button>}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden bg-[#faf9fc]">
        {view === 'edit' && (
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            <div className="w-full max-w-[900px] space-y-4">
              {/* Document paper */}
              <div className="bg-white border border-surface-dim shadow-sm rounded-sm min-h-[600px] p-8">
                {/* Header row */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-[24px] font-bold text-primary mb-1">{config.label.toUpperCase()}</h1>
                    <div className="text-[13px] font-semibold">{number}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-on-surface-variant uppercase font-bold mb-1">{config.label} total</div>
                    <div className="text-[24px] font-bold">${total.toFixed(2)}</div>
                  </div>
                </div>

                {/* Party + dates */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                  <div>
                    <label className="block text-[11px] text-on-surface-variant uppercase font-bold mb-1">{config.partyLabel}</label>
                    <select className="field-input" value={partyId} onChange={e => setPartyId(e.target.value)}>
                      <option value="">Select {config.partyLabel.toLowerCase()}…</option>
                      {store.getPartiesByRole(config.partyRole as any).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {party && (
                      <div className="mt-2 text-[12px] text-on-surface-variant">
                        {party.address}, {party.city}, {party.state} {party.zip}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-on-surface-variant uppercase font-bold mb-1">{config.dateLabel}</label>
                      <input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    {config.dueLabel && (
                      <div>
                        <label className="block text-[11px] text-on-surface-variant uppercase font-bold mb-1">{config.dueLabel}</label>
                        <input type="date" className="field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Lines table */}
                <table className="w-full text-left text-[13px] border border-surface-dim rounded">
                  <thead>
                    <tr className="text-[11px] text-on-surface-variant uppercase font-bold bg-surface-container-low border-b border-surface-dim">
                      <th className="py-2 px-3 w-8"></th>
                      {config.lineColumns.map(col => (
                        <th key={col.key} className={`py-2 px-3 ${col.align === 'right' ? 'text-right' : ''}`} style={col.width ? { width: col.width } : undefined}>{col.label}</th>
                      ))}
                      <th className="py-2 px-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-b border-surface-dim">
                        <td className="py-2 px-3 text-on-surface-variant text-center"><span className="material-symbols-outlined text-[16px] cursor-grab">drag_indicator</span></td>
                        <td className="py-2 px-3"><input className="w-full border-0 bg-transparent text-[13px] focus:outline-none focus:border-b focus:border-primary" placeholder="Description or item name" value={line.description} onChange={e => updateLine(idx, { description: e.target.value })} /></td>
                        <td className="py-2 px-3"><input type="number" className="w-full border-0 bg-transparent text-[13px] text-right focus:outline-none focus:border-b focus:border-primary" value={line.qty} onChange={e => updateLine(idx, { qty: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="py-2 px-3"><input type="number" className="w-full border-0 bg-transparent text-[13px] text-right focus:outline-none focus:border-b focus:border-primary" value={line.rate} onChange={e => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })} /></td>
                        <td className="py-2 px-3 text-right tabular-nums">${line.amount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center"><button className="text-on-surface-variant hover:text-error" onClick={() => removeLine(idx)}><span className="material-symbols-outlined text-[16px]">close</span></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="mt-2 text-[12px] text-primary font-semibold hover:underline flex items-center gap-1" onClick={addLine}><span className="material-symbols-outlined text-[16px]">add</span>Add line</button>

                {/* Totals */}
                <div className="flex justify-end mt-6">
                  <div className="w-64 space-y-2 text-[13px]">
                    <div className="flex justify-between"><span className="text-on-surface-variant">Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Tax</span><span>${tax.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-on-surface-variant">Shipping</span><input type="number" className="w-20 border-0 bg-transparent text-right" value={shipping} onChange={e => setShipping(parseFloat(e.target.value) || 0)} /></div>
                    <div className="flex justify-between font-bold border-t border-surface-dim pt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
                    {existing && existing.amountPaid > 0 && (
                      <>
                        <div className="flex justify-between text-on-surface-variant"><span>Amount paid</span><span>${existing.amountPaid.toFixed(2)}</span></div>
                        <div className="flex justify-between font-bold"><span>Balance due</span><span className={balance > 0 ? 'text-error' : 'text-secondary'}>${balance.toFixed(2)}</span></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Memo + notes */}
                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div><label className="block text-[12px] text-on-surface-variant mb-1">Memo (on statement)</label><textarea className="field-input" style={{ height: 56 }} value={memo} onChange={e => setMemo(e.target.value)} /></div>
                  <div><label className="block text-[12px] text-on-surface-variant mb-1">Note to {config.partyLabel.toLowerCase()}</label><textarea className="field-input" style={{ height: 56 }} value={notes} onChange={e => setNotes(e.target.value)} /></div>
                </div>

                {/* Activity log (existing docs only) */}
                {existing && existing.activity.length > 0 && (
                  <div className="mt-8 border-t border-surface-dim pt-4">
                    <h3 className="text-[13px] font-bold mb-2">Activity</h3>
                    {existing.activity.map((a, i) => (
                      <div key={i} className="flex items-center gap-3 py-1 text-[12px]">
                        <span className="text-on-surface-variant w-24">{a.date}</span>
                        <span className="font-medium">{a.text}</span>
                        <span className="text-on-surface-variant ml-auto">{a.actor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'email' && (
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            <div className="w-full max-w-[800px] bg-white border border-surface-dim shadow-sm rounded-xl overflow-hidden">
              <div className="bg-[#f4fbfa] p-8 text-center border-b border-[#d9eae8]">
                <h2 className="text-[24px] font-semibold mb-2">ManageKube LLC sent you an {config.label.toLowerCase()}</h2>
                <div className="text-[14px] text-on-surface-variant mb-6">{number}</div>
                <div className="inline-flex flex-col items-center p-6 bg-white rounded-lg border border-surface-dim shadow-sm min-w-[240px]">
                  <div className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{config.label} total</div>
                  <div className="text-[32px] font-semibold">${total.toFixed(2)}</div>
                </div>
              </div>
              <div className="p-8">
                <div className="text-[14px] mb-6"><p className="mb-4">Hi {party?.name || 'Customer'},</p><p className="mb-4">Here is the {config.label.toLowerCase()} we discussed. Please review and let us know if you have any questions.</p></div>
                <div className="text-center mb-8"><button className="h-10 px-6 bg-primary text-white rounded-full text-[14px] font-semibold hover:bg-primary-container">Review and accept</button></div>
              </div>
            </div>
          </div>
        )}

        {view === 'payor' && (
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            <div className="w-full max-w-[900px] bg-white border border-surface-dim shadow-sm rounded-sm p-8">
              <div className="flex justify-between items-start mb-8">
                <div><h1 className="text-[28px] font-semibold text-primary mb-1">{config.label.toUpperCase()}</h1><div className="text-[14px] font-semibold">ManageKube LLC</div></div>
                <div className="text-right text-[13px]"><div className="text-on-surface-variant uppercase font-semibold mb-1">{config.label} total</div><div className="text-[24px] font-semibold">${total.toFixed(2)}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-8 mb-8 text-[13px]">
                <div><div className="text-on-surface-variant font-semibold mb-1 uppercase tracking-wider text-[11px]">From</div><div className="font-semibold mb-1">ManageKube LLC</div></div>
                <div><div className="text-on-surface-variant font-semibold mb-1 uppercase tracking-wider text-[11px]">To</div><div className="font-semibold mb-1">{party?.name || '—'}</div></div>
              </div>
              <table className="w-full text-left text-[13px] mb-8"><thead><tr className="border-b-2 border-surface-dim text-[11px] text-on-surface-variant uppercase font-semibold">{config.lineColumns.map(c => <th key={c.key} className={`py-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
                <tbody>{lines.map((l, i) => <tr key={i} className="border-b border-surface-dim"><td className="py-3">{l.description}</td><td className="py-3 text-right">{l.qty}</td><td className="py-3 text-right">${l.rate.toFixed(2)}</td><td className="py-3 text-right">${l.amount.toFixed(2)}</td></tr>)}</tbody>
              </table>
              <div className="flex justify-end mb-12"><div className="w-64 space-y-2 text-[13px]"><div className="flex justify-between"><span className="text-on-surface-variant">Subtotal</span><span>${subtotal.toFixed(2)}</span></div><div className="flex justify-between font-semibold border-t border-surface-dim pt-2"><span>Total</span><span>${total.toFixed(2)}</span></div></div></div>
              {config.canRecordPayment && balance > 0 && <div className="border-t border-surface-dim pt-8 text-center"><button className="h-10 px-8 bg-primary text-white rounded-full text-[14px] font-semibold hover:bg-primary-container mb-4" onClick={() => setShowPaymentModal(true)}>Pay ${balance.toFixed(2)}</button></div>}
            </div>
          </div>
        )}

        {view === 'pdf' && (
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            <div className="w-full max-w-[850px] bg-white shadow-lg min-h-[1100px] p-12">
              <div className="flex justify-between items-start mb-12"><div><div className="text-[24px] font-bold text-primary mb-1">{config.label.toUpperCase()}</div><div className="text-[14px] font-semibold">ManageKube LLC</div></div><div className="text-right"><div className="text-[12px] font-semibold text-gray-500 uppercase tracking-widest mb-1">{config.label} Total</div><div className="text-[28px] font-bold">${total.toFixed(2)}</div></div></div>
              <table className="w-full text-left text-[12px] mb-8"><thead><tr className="border-b-2 border-gray-300 text-[10px] text-gray-500 uppercase font-bold tracking-widest">{config.lineColumns.map(c => <th key={c.key} className={`py-3 ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead><tbody>{lines.map((l, i) => <tr key={i} className="border-b border-gray-200"><td className="py-4">{l.description}</td><td className="py-4 text-right">{l.qty}</td><td className="py-4 text-right">${l.rate.toFixed(2)}</td><td className="py-4 text-right">${l.amount.toFixed(2)}</td></tr>)}</tbody></table>
              <div className="flex justify-end border-t-2 border-gray-300 pt-4"><div className="w-64"><div className="flex justify-between py-1 text-[12px]"><span className="text-gray-500">Subtotal</span><span className="font-semibold">${subtotal.toFixed(2)}</span></div><div className="flex justify-between py-2 text-[14px] font-bold border-t border-gray-200 mt-1"><span>Total</span><span>${total.toFixed(2)}</span></div></div></div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="h-16 bg-white border-t border-surface-dim px-6 flex items-center justify-between shrink-0 z-20">
        <div className="w-1/3">
          {existing && <span className={`st ${status === 'Paid' ? 'paid' : status === 'Overdue' ? 'overdue' : status === 'Draft' ? 'draft' : 'sent'}`}>{status}</span>}
        </div>
        <div className="flex-1 flex justify-center gap-2">
          {config.canPrint && <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={() => setView('pdf')}><span className="material-symbols-outlined text-[16px] align-middle">print</span>Print</button>}
          {existing && config.canRecordPayment && balance > 0 && <button className="h-8 px-3 border border-surface-dim rounded text-body-md font-semibold hover:bg-surface-container-low" onClick={() => setShowPaymentModal(true)}>Record payment</button>}
        </div>
        <div className="w-1/3 flex justify-end gap-2">
          {onClose && <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={onClose}>Cancel</button>}
          <button className="h-8 px-4 bg-primary text-white text-body-md font-semibold rounded hover:bg-primary-container" onClick={save}>{config.primaryAction}</button>
        </div>
      </footer>

      {/* Payment modal */}
      {showPaymentModal && existing && (
        <div className="modal-scrim open" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-headline-sm mb-3">Record payment</h3>
            <div className="space-y-3">
              <div><label className="field-label">Amount</label><input type="number" className="field-input" defaultValue={balance.toFixed(2)} id="pay-amount" /></div>
              <div><label className="field-label">Payment method</label><select className="field-input" id="pay-method"><option>Cash</option><option>Check</option><option>ACH</option><option>Card</option><option>PayPal</option><option>Bank transfer</option></select></div>
              <div><label className="field-label">Deposit to</label><select className="field-input" id="pay-account">{store.getAccountsByType('Bank').map(a => <option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button className="h-8 px-3 bg-primary text-white rounded text-body-md font-semibold hover:bg-primary-container" onClick={() => {
                const amt = parseFloat((document.getElementById('pay-amount') as HTMLInputElement)?.value || '0');
                const method = (document.getElementById('pay-method') as HTMLSelectElement)?.value || 'Cash';
                const account = (document.getElementById('pay-account') as HTMLSelectElement)?.value || 'Checking';
                recordPayment(amt, method, account);
              }}>Record payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
