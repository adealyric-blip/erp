'use client';

import './expenses-bills.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ExpensesBillsScreenProps } from './types';
import { EBL_NAV } from './types';

/* ════════════════════════════════════════════════════════════════
   Purchase Order — 1:1 conversion of upload/Purchase order.html
   ════════════════════════════════════════════════════════════════ */

type ViewKey = 'edit' | 'email' | 'vendor' | 'pdf';
type AccordionKey = 'customization' | 'receiving' | 'billing' | 'attachments';

const VIEW_LABELS: Record<ViewKey, string> = {
  edit: 'Edit',
  email: 'Email view',
  vendor: 'Vendor view',
  pdf: 'PDF view',
};

const VIEW_ORDER: ViewKey[] = ['edit', 'email', 'vendor', 'pdf'];

const STATUS_OPTIONS: string[] = [
  'Open',
  'Sent to Vendor',
  'Partially Received',
  'Fully Received',
  'Cancelled',
];

export default function PurchaseOrder({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: ExpensesBillsScreenProps) {
  /* ── Toast ── */
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((msg: string) => setToastMsg(msg), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 2500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  /* Mirror local toast up to the shell */
  useEffect(() => {
    if (toastMsg) onToast(toastMsg);
  }, [toastMsg, onToast]);

  /* ── View switching ── */
  const [view, setView] = useState<ViewKey>('edit');

  /* ── Status dropdown ── */
  const [status, setStatus] = useState('Open');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  /* ── Accordions (source has all collapsed by default — hidden-imp on each #acc-*) ── */
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  /* ── Save & Send split menus ── */
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [saveMenuPos, setSaveMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [sendMenuPos, setSendMenuPos] = useState<{ top: number; left: number } | null>(null);

  const saveArrowRef = useRef<HTMLButtonElement>(null);
  const sendArrowRef = useRef<HTMLButtonElement>(null);

  /* ── Outside-click + Escape ── */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('#statusBtn') && !target.closest('#statusMenu')) {
        setStatusMenuOpen(false);
      }
      if (!target.closest('#saveArrow') && !target.closest('#saveMenu')) {
        setSaveMenuOpen(false);
      }
      if (!target.closest('#sendArrow') && !target.closest('#sendMenu')) {
        setSendMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setStatusMenuOpen(false);
        setSaveMenuOpen(false);
        setSendMenuOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* ═══════════ Action handlers ═══════════ */

  /* Tabs */
  const handleTabClick = (v: ViewKey) => setView(v);

  /* Status dropdown */
  const handleStatusBtnClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusMenuOpen((o) => !o);
  };
  const handleStatusSelect = (newStatus: string) => {
    setStatus(newStatus);
    setStatusMenuOpen(false);
    showToast(`Status changed to ${newStatus}`);
  };

  /* Accordions */
  const handleAccordion = (key: AccordionKey) => {
    if (key === 'customization') setCustomizationOpen((o) => !o);
    else if (key === 'receiving') setReceivingOpen((o) => !o);
    else if (key === 'billing') setBillingOpen((o) => !o);
    else if (key === 'attachments') setAttachmentsOpen((o) => !o);
  };

  /* Save arrow (split) */
  const handleSaveArrow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!saveArrowRef.current) return;
    const rect = saveArrowRef.current.getBoundingClientRect();
    setSaveMenuPos({
      top: rect.top - 80,
      left: Math.min(rect.right - 200, window.innerWidth - 220),
    });
    setSaveMenuOpen((o) => !o);
  };

  /* Send arrow (split) */
  const handleSendArrow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sendArrowRef.current) return;
    const rect = sendArrowRef.current.getBoundingClientRect();
    setSendMenuPos({
      top: rect.top - 80,
      left: Math.min(rect.right - 200, window.innerWidth - 220),
    });
    setSendMenuOpen((o) => !o);
  };

  /* Save menu items */
  const handleSaveAndNew = () => {
    setSaveMenuOpen(false);
    showToast('Saved and new PO started');
  };
  const handleSaveAndClose = () => {
    setSaveMenuOpen(false);
    showToast('Saved and closed');
  };

  /* Send menu items */
  const handleSendToVendorMenu = () => {
    setSendMenuOpen(false);
    showToast('Opening send flow');
  };
  const handleDownloadPdf = () => {
    setSendMenuOpen(false);
    showToast('Downloading PDF...');
  };

  /* Navigate back to overview (close button) */
  const handleNavigateBack = () => {
    const [d, s] = EBL_NAV.overview();
    onNavigate(d, s);
  };

  /* Reference unused props so TS strict doesn't complain in some configs */
  void onCreate;
  void onOpenCreateFlyout;

  /* ═══════════ Render ═══════════ */
  return (
    <div className="purchase-order-page">
      <div
        className="bg-background font-sans text-body-md text-on-surface antialiased flex flex-col"
        style={{ minHeight: 'calc(100vh - 0px)' }}
      >
        {/* ═══════════ TOP HEADER ═══════════ */}
        <header className="bg-white border-b border-surface-dim shrink-0 flex flex-col z-20">
          {/* Top utility row */}
          <div className="h-14 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                onClick={() => showToast('Viewing revision history...')}
              >
                <span className="material-symbols-outlined">history</span>
              </button>
              <h1 className="text-[20px] font-semibold text-on-surface">Purchase Order 1001</h1>
              <span className="bg-[#e8f5e9] text-[#0a6400] text-[10px] font-bold px-2 py-0.5 rounded uppercase ml-2">
                Open
              </span>
            </div>
            <div className="flex items-center gap-4 text-on-surface-variant">
              <button
                type="button"
                className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
                onClick={() => showToast('Opening help...')}
              >
                <span className="material-symbols-outlined text-[20px]">help_outline</span>
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-[#0077c5] text-white flex items-center justify-center"
                onClick={() => showToast('Starred PO-1001')}
              >
                <span className="material-symbols-outlined text-[18px]">star</span>
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center"
                onClick={handleNavigateBack}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Tabs & Actions row */}
          <div className="h-12 px-6 flex items-center justify-between border-t border-surface-dim">
            <div className="flex items-center gap-6 h-full">
              {VIEW_ORDER.map((v) => {
                const isActive = view === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`h-full px-1 text-[14px] tab-underline ${
                      isActive
                        ? 'active'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                    onClick={() => handleTabClick(v)}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 text-[13px] font-semibold text-on-surface-variant">
              <button
                type="button"
                className="flex items-center gap-1 hover:text-on-surface"
                onClick={() => showToast('Opening manage menu...')}
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Manage
              </button>
              <button
                type="button"
                className="flex items-center gap-1 hover:text-on-surface"
                onClick={() => showToast('Opening receive items flow...')}
              >
                <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                Receive items
              </button>
              <button
                type="button"
                className="flex items-center gap-1 hover:text-on-surface"
                onClick={() => showToast('Opening feedback...')}
              >
                <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                Feedback
              </button>
            </div>
          </div>
        </header>

        {/* ═══════════ MAIN SCROLLABLE AREA ═══════════ */}
        <div className="flex-1 flex overflow-hidden bg-[#faf9fc]">
          {/* Left Side: Document Canvas */}
          <div className="flex-1 overflow-y-auto p-6 flex justify-center">
            {/* EDIT VIEW */}
            {view === 'edit' && (
              <div className="w-full max-w-[1000px] space-y-4" id="view-edit">
                {/* Document Paper */}
                <div className="bg-white border border-surface-dim shadow-sm rounded-sm min-h-[800px] flex flex-col relative p-8 pb-12">
                  {/* Header: Business Info & PO Number */}
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-[24px] font-bold text-primary mb-1">PURCHASE ORDER</h2>
                      <div className="text-[13px] font-semibold text-on-surface">Unsaid</div>
                      <div className="text-[12px] text-on-surface-variant">
                        123 Business Rd, Suite 100
                        <br />
                        hello@unsaid.com
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-1">
                        PO Number
                      </div>
                      <div className="text-[18px] font-semibold text-on-surface">PO-1001</div>
                    </div>
                  </div>

                  {/* Vendor / Ship To Grid */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="vendor-block p-4 rounded-md">
                      <div className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-2">
                        Vendor
                      </div>
                      <div className="relative w-full mb-2">
                        <select
                          className="w-full h-8 pl-2 pr-8 border border-[#dad9dd] rounded bg-white text-[13px] appearance-none focus:outline-none focus:border-primary"
                          defaultValue="Printful Inc."
                        >
                          <option>Printful Inc.</option>
                          <option>Gelato Pty Ltd</option>
                          <option>Printify</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-1.5 text-[16px] text-on-surface-variant pointer-events-none">
                          expand_more
                        </span>
                      </div>
                      <div className="text-[12px] text-on-surface-variant">
                        support@printful.com
                        <br />
                        +1 (555) 000-1111
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-on-surface-variant uppercase tracking-wider font-bold mb-2">
                        Ship To
                      </div>
                      <div className="text-[13px] font-semibold text-on-surface mb-1">
                        Unsaid Warehouse
                      </div>
                      <div className="text-[12px] text-on-surface-variant leading-relaxed">
                        456 Warehouse Way
                        <br />
                        Dock 4
                        <br />
                        Springfield, IL 62701
                      </div>
                    </div>
                  </div>

                  {/* Dates & Terms Row */}
                  <div className="grid grid-cols-4 gap-4 mb-8 bg-[#faf9fc] p-4 rounded-md border border-surface-dim">
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Order Date
                      </label>
                      <input
                        className="w-full h-8 px-2 border border-[#dad9dd] rounded text-[13px] focus:outline-none focus:border-primary bg-white"
                        defaultValue="11/03/2026"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Expected Delivery
                      </label>
                      <input
                        className="w-full h-8 px-2 border border-[#dad9dd] rounded text-[13px] focus:outline-none focus:border-primary bg-white"
                        defaultValue="11/15/2026"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Payment Terms
                      </label>
                      <input
                        className="w-full h-8 px-2 border border-[#dad9dd] rounded text-[13px] focus:outline-none focus:border-primary bg-white"
                        defaultValue="Net 30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1">
                        Ship Via
                      </label>
                      <input
                        className="w-full h-8 px-2 border border-[#dad9dd] rounded text-[13px] focus:outline-none focus:border-primary bg-white"
                        defaultValue="FedEx Ground"
                      />
                    </div>
                  </div>

                  {/* Product Lines */}
                  <div className="flex-1">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="text-[11px] text-on-surface-variant font-semibold border-b border-surface-dim bg-[#faf9fc]">
                          <th className="py-2 px-2 w-10 border-r border-surface-dim border-dashed"></th>
                          <th className="py-2 px-2 w-10 border-r border-surface-dim border-dashed">#</th>
                          <th className="py-2 px-2 border-r border-surface-dim border-dashed">Item / SKU</th>
                          <th className="py-2 px-2 border-r border-surface-dim border-dashed">Description</th>
                          <th className="py-2 px-2 w-16 text-right border-r border-surface-dim border-dashed">Qty Ord</th>
                          <th className="py-2 px-2 w-16 text-right border-r border-surface-dim border-dashed">Qty Rcvd</th>
                          <th className="py-2 px-2 w-24 text-right border-r border-surface-dim border-dashed">Unit Cost</th>
                          <th className="py-2 px-2 w-24 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Line 1 */}
                        <tr className="line-row">
                          <td className="py-3 px-2 text-on-surface-variant text-center border-r border-surface-dim border-dashed">
                            <span className="material-symbols-outlined text-[16px] cursor-grab">drag_indicator</span>
                          </td>
                          <td className="py-3 px-2 text-on-surface-variant border-r border-surface-dim border-dashed">1</td>
                          <td className="py-3 px-2 border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent focus:outline-none font-medium"
                              defaultValue="Classic Tee - White"
                            />
                            <div className="text-[11px] text-on-surface-variant mt-0.5">SKU: TEE-001</div>
                          </td>
                          <td className="py-3 px-2 border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent focus:outline-none text-on-surface-variant"
                              defaultValue="Size L"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none"
                              defaultValue="100"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none text-[#0a6400] font-semibold"
                              defaultValue="0"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none"
                              defaultValue="$8.50"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-medium">$850.00</td>
                        </tr>
                        {/* Line 2 */}
                        <tr className="line-row">
                          <td className="py-3 px-2 text-on-surface-variant text-center border-r border-surface-dim border-dashed">
                            <span className="material-symbols-outlined text-[16px] cursor-grab">drag_indicator</span>
                          </td>
                          <td className="py-3 px-2 text-on-surface-variant border-r border-surface-dim border-dashed">2</td>
                          <td className="py-3 px-2 border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent focus:outline-none font-medium"
                              defaultValue="Canvas Tote"
                            />
                            <div className="text-[11px] text-on-surface-variant mt-0.5">SKU: TOTE-014</div>
                          </td>
                          <td className="py-3 px-2 border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent focus:outline-none text-on-surface-variant"
                              defaultValue="Natural"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none"
                              defaultValue="50"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none text-[#0a6400] font-semibold"
                              defaultValue="0"
                            />
                          </td>
                          <td className="py-3 px-2 text-right border-r border-surface-dim border-dashed">
                            <input
                              className="w-full bg-transparent text-right focus:outline-none"
                              defaultValue="$6.00"
                            />
                          </td>
                          <td className="py-3 px-2 text-right font-medium">$300.00</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="flex items-center gap-2 mt-3 mb-8">
                      <button
                        type="button"
                        className="h-8 px-3 border border-surface-dim rounded bg-[#f4f3f7] text-[12px] font-semibold text-on-surface-variant flex items-center gap-1 hover:bg-surface-container"
                        onClick={() => showToast('Add line item...')}
                      >
                        Add line item{' '}
                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                      </button>
                      <button
                        type="button"
                        className="h-8 px-3 border border-surface-dim rounded bg-[#f4f3f7] text-[12px] font-semibold text-on-surface-variant hover:bg-surface-container"
                        onClick={() => showToast('Clearing all lines...')}
                      >
                        Clear all lines
                      </button>
                    </div>

                    {/* Bottom section: Memo & Totals */}
                    <div className="grid grid-cols-2 gap-12 mt-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[12px] font-semibold text-on-surface mb-1">
                            Vendor Instructions / Notes
                          </label>
                          <textarea
                            className="w-full h-24 p-2 border border-[#dad9dd] rounded text-[13px] focus:outline-none focus:border-primary resize-y placeholder:text-on-surface-variant"
                            placeholder="Include packing slip with PO number. Do not substitute items without approval."
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-on-surface mb-1">
                            Attachments
                          </label>
                          <div
                            className="border border-dashed border-[#dad9dd] rounded-lg p-4 text-center cursor-pointer hover:bg-surface-container-low"
                            onClick={() => showToast('Opening attachment upload...')}
                          >
                            <div className="text-[12px] font-semibold text-primary mb-1">Add attachment</div>
                            <div className="text-[11px] text-on-surface-variant">Max file size: 20 MB</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-6">
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="text-on-surface-variant">Subtotal</span>
                          <span className="font-medium">$1,150.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="text-on-surface-variant">Shipping</span>
                          <span className="font-medium">$45.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[13px]">
                          <span className="text-on-surface-variant">Tax</span>
                          <span className="font-medium">$0.00</span>
                        </div>
                        <div className="flex justify-between items-center text-[15px] font-semibold border-t border-surface-dim pt-2 mt-1">
                          <span>PO Total</span>
                          <span>$1,195.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EMAIL VIEW */}
            {view === 'email' && (
              <div className="w-full max-w-[800px]" id="view-email">
                <div className="bg-white border border-surface-dim shadow-sm rounded-xl overflow-hidden">
                  <div className="bg-[#f4fbfa] p-8 text-center border-b border-[#d9eae8]">
                    <h2 className="text-[24px] font-semibold text-on-surface mb-2">
                      Purchase Order PO-1001
                    </h2>
                    <div className="text-[14px] text-on-surface-variant mb-6">Unsaid</div>
                    <div className="inline-flex flex-col items-center justify-center p-6 bg-white rounded-lg border border-surface-dim shadow-sm min-w-[240px]">
                      <div className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                        PO Total
                      </div>
                      <div className="text-[32px] font-semibold text-on-surface">$1,195.00</div>
                    </div>
                  </div>
                  <div className="p-8">
                    <div className="text-[14px] text-on-surface mb-6">
                      <p className="mb-4">Hi Printful Inc.,</p>
                      <p className="mb-4">
                        Please find attached our purchase order PO-1001. Please confirm receipt and
                        expected delivery date.
                      </p>
                    </div>
                    <div className="text-center mb-8">
                      <button
                        type="button"
                        className="h-10 px-6 bg-primary text-white rounded-full text-[14px] font-semibold hover:bg-primary-container"
                      >
                        View Purchase Order
                      </button>
                    </div>
                    <div className="border-t border-surface-dim pt-6 mt-8 text-[12px] text-on-surface-variant text-center">
                      <p className="font-semibold text-on-surface mb-1">Unsaid</p>
                      <p>123 Business Rd, Suite 100</p>
                      <p>hello@unsaid.com</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VENDOR VIEW (Payor) */}
            {view === 'vendor' && (
              <div className="w-full max-w-[900px]" id="view-vendor">
                <div className="bg-white border border-surface-dim shadow-sm rounded-sm p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h1 className="text-[28px] font-semibold text-primary mb-1">PURCHASE ORDER</h1>
                      <div className="text-[14px] font-semibold">Unsaid</div>
                    </div>
                    <div className="text-right text-[13px]">
                      <div className="text-on-surface-variant uppercase font-semibold mb-1">PO Total</div>
                      <div className="text-[24px] font-semibold">$1,195.00</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8 text-[13px]">
                    <div>
                      <div className="text-on-surface-variant font-semibold mb-1 uppercase tracking-wider text-[11px]">
                        Vendor
                      </div>
                      <div className="font-semibold mb-1">Printful Inc.</div>
                      <div className="text-on-surface-variant">
                        support@printful.com
                        <br />
                        +1 (555) 000-1111
                      </div>
                    </div>
                    <div>
                      <div className="text-on-surface-variant font-semibold mb-1 uppercase tracking-wider text-[11px]">
                        Ship To
                      </div>
                      <div className="font-semibold mb-1">Unsaid Warehouse</div>
                      <div className="text-on-surface-variant">
                        456 Warehouse Way, Dock 4
                        <br />
                        Springfield, IL 62701
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#faf9fc] rounded p-4 mb-8 text-[13px] grid grid-cols-4 gap-4">
                    <div>
                      <span className="block text-on-surface-variant text-[11px] uppercase mb-1">PO Number</span>
                      <span className="font-medium">PO-1001</span>
                    </div>
                    <div>
                      <span className="block text-on-surface-variant text-[11px] uppercase mb-1">Order Date</span>
                      <span className="font-medium">11/03/2026</span>
                    </div>
                    <div>
                      <span className="block text-on-surface-variant text-[11px] uppercase mb-1">Expected Delivery</span>
                      <span className="font-medium">11/15/2026</span>
                    </div>
                    <div>
                      <span className="block text-on-surface-variant text-[11px] uppercase mb-1">Terms</span>
                      <span className="font-medium">Net 30</span>
                    </div>
                  </div>

                  <table className="w-full text-left text-[13px] mb-8">
                    <thead>
                      <tr className="border-b-2 border-surface-dim text-[11px] text-on-surface-variant uppercase font-semibold">
                        <th className="py-2">Item</th>
                        <th className="py-2">Description</th>
                        <th className="py-2 text-right">Qty Ord</th>
                        <th className="py-2 text-right">Unit Cost</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-surface-dim">
                        <td className="py-4 font-medium">Classic Tee - White</td>
                        <td className="py-4 text-on-surface-variant">SKU: TEE-001 · Size L</td>
                        <td className="py-4 text-right">100</td>
                        <td className="py-4 text-right">$8.50</td>
                        <td className="py-4 text-right">$850.00</td>
                      </tr>
                      <tr className="border-b border-surface-dim">
                        <td className="py-4 font-medium">Canvas Tote</td>
                        <td className="py-4 text-on-surface-variant">SKU: TOTE-014 · Natural</td>
                        <td className="py-4 text-right">50</td>
                        <td className="py-4 text-right">$6.00</td>
                        <td className="py-4 text-right">$300.00</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-end mb-12">
                    <div className="w-64 space-y-2 text-[13px]">
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Subtotal</span>
                        <span>$1,150.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-on-surface-variant">Shipping</span>
                        <span>$45.00</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-surface-dim pt-2 mt-2">
                        <span>Total</span>
                        <span>$1,195.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-surface-dim pt-8 text-center text-[12px] text-on-surface-variant">
                    <p>
                      Please include PO Number <strong>PO-1001</strong> on all packing slips and
                      invoices.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PDF VIEW */}
            {view === 'pdf' && (
              <div className="w-full max-w-[900px]" id="view-pdf">
                <div className="bg-white shadow-lg w-full max-w-[850px] min-h-[1100px] mx-auto p-[0.75in]">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <div className="text-[24px] font-bold text-primary mb-1">PURCHASE ORDER</div>
                      <div className="text-[14px] font-semibold text-gray-800">Unsaid</div>
                      <div className="text-[12px] text-gray-500 mt-1">123 Business Rd, Suite 100</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        PO Total
                      </div>
                      <div className="text-[28px] font-bold text-gray-900">$1,195.00</div>
                    </div>
                  </div>

                  <div className="flex justify-between mb-12">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">
                        Vendor
                      </div>
                      <div className="text-[14px] font-semibold text-gray-800">Printful Inc.</div>
                      <div className="text-[12px] text-gray-500">support@printful.com</div>
                      <div className="text-[12px] text-gray-500">+1 (555) 000-1111</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-widest">
                        Ship To
                      </div>
                      <div className="text-[14px] font-semibold text-gray-800">Unsaid Warehouse</div>
                      <div className="text-[12px] text-gray-500">456 Warehouse Way, Dock 4</div>
                      <div className="text-[12px] text-gray-500">Springfield, IL 62701</div>
                    </div>
                  </div>

                  <div className="flex justify-between mb-12">
                    <table className="text-[12px]">
                      <tbody>
                        <tr>
                          <td className="text-gray-500 pr-4 pb-1">PO Number</td>
                          <td className="font-semibold text-gray-800 pb-1">PO-1001</td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 pr-4 pb-1">Order Date</td>
                          <td className="font-semibold text-gray-800 pb-1">11/03/2026</td>
                        </tr>
                      </tbody>
                    </table>
                    <table className="text-[12px]">
                      <tbody>
                        <tr>
                          <td className="text-gray-500 pr-4 pb-1">Expected Delivery</td>
                          <td className="font-semibold text-gray-800 pb-1">11/15/2026</td>
                        </tr>
                        <tr>
                          <td className="text-gray-500 pr-4 pb-1">Terms</td>
                          <td className="font-semibold text-gray-800 pb-1">Net 30</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <table className="w-full text-left text-[12px] mb-8">
                    <thead>
                      <tr className="border-b-2 border-gray-300 text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                        <th className="py-3">Item / SKU</th>
                        <th className="py-3">Description</th>
                        <th className="py-3 text-right">Qty</th>
                        <th className="py-3 text-right">Unit Cost</th>
                        <th className="py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="py-4 font-medium text-gray-800">
                          Classic Tee - White
                          <br />
                          <span className="text-gray-500 font-normal">SKU: TEE-001</span>
                        </td>
                        <td className="py-4 text-gray-600">Size L</td>
                        <td className="py-4 text-right text-gray-800">100</td>
                        <td className="py-4 text-right text-gray-800">$8.50</td>
                        <td className="py-4 text-right text-gray-800 font-medium">$850.00</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="py-4 font-medium text-gray-800">
                          Canvas Tote
                          <br />
                          <span className="text-gray-500 font-normal">SKU: TOTE-014</span>
                        </td>
                        <td className="py-4 text-gray-600">Natural</td>
                        <td className="py-4 text-right text-gray-800">50</td>
                        <td className="py-4 text-right text-gray-800">$6.00</td>
                        <td className="py-4 text-right text-gray-800 font-medium">$300.00</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-end border-t-2 border-gray-300 pt-4">
                    <div className="w-64">
                      <div className="flex justify-between py-1 text-[12px]">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-semibold text-gray-800">$1,150.00</span>
                      </div>
                      <div className="flex justify-between py-1 text-[12px]">
                        <span className="text-gray-500">Shipping</span>
                        <span className="font-semibold text-gray-800">$45.00</span>
                      </div>
                      <div className="flex justify-between py-2 text-[14px] font-bold border-t border-gray-200 mt-1">
                        <span className="text-gray-800">Total</span>
                        <span className="text-gray-900">$1,195.00</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-16 text-center text-[10px] text-gray-400">
                    <p>Please include PO Number PO-1001 on all packing slips.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Sidebar Controls (only visible in Edit view) */}
          {view === 'edit' && (
            <aside className="w-[340px] bg-white border-l border-surface-dim flex flex-col shrink-0 overflow-y-auto">
              <div className="p-5 border-b border-surface-dim flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">PO-1001</h2>
                <button
                  type="button"
                  className="w-8 h-8 rounded hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
                  onClick={handleNavigateBack}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-5 flex-1 space-y-4">
                {/* Status Dropdown */}
                <div className="relative inline-block w-full mb-4">
                  <button
                    type="button"
                    id="statusBtn"
                    className="h-8 px-3 border border-surface-dim rounded bg-white text-[12px] font-semibold flex items-center justify-between w-32 hover:bg-surface-container"
                    onClick={handleStatusBtnClick}
                  >
                    {status}{' '}
                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  </button>
                  <div
                    className={`row-menu ${statusMenuOpen ? 'open' : ''}`}
                    id="statusMenu"
                    style={{ position: 'absolute', top: 36, left: 0, width: 140 }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={s === 'Open' ? 'font-semibold' : ''}
                        onClick={() => handleStatusSelect(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accordions */}
                <div className="space-y-3">
                  {/* Customization */}
                  <div className="border border-surface-dim rounded-lg bg-white overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-semibold hover:bg-surface-container-low"
                      onClick={() => handleAccordion('customization')}
                    >
                      Customization
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {customizationOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                    {customizationOpen && (
                      <div className="border-t border-surface-dim p-4 space-y-4" id="acc-customization">
                        <div className="space-y-3 text-[13px]">
                          <div className="flex items-center justify-between">
                            <span>Show SKU</span>
                            <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span className="slider"></span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Show Unit Cost</span>
                            <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span className="slider"></span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Show Receiving Status</span>
                            <label className="switch">
                              <input type="checkbox" defaultChecked />
                              <span className="slider"></span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Show Vendor Part No.</span>
                            <label className="switch">
                              <input type="checkbox" />
                              <span className="slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-surface-dim mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[13px] font-semibold">Table content</span>
                            <a
                              href="#"
                              className="text-[12px] text-primary hover:underline"
                              onClick={(e) => e.preventDefault()}
                            >
                              Edit labels
                            </a>
                          </div>
                          <div className="space-y-3 text-[13px]">
                            <div className="flex items-center justify-between">
                              <span>#</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Item / SKU</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Description</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Qty Ordered</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Qty Received</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Unit Cost</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Amount</span>
                              <label className="switch">
                                <input type="checkbox" defaultChecked />
                                <span className="slider"></span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Receiving */}
                  <div className="border border-surface-dim rounded-lg bg-white overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-semibold hover:bg-surface-container-low"
                      onClick={() => handleAccordion('receiving')}
                    >
                      Receiving
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {receivingOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                    {receivingOpen && (
                      <div className="border-t border-surface-dim p-4" id="acc-receiving">
                        <div className="space-y-3 text-[13px] mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-on-surface-variant">Items ordered</span>
                            <span className="font-medium">150</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-on-surface-variant">Items received</span>
                            <span className="font-medium text-[#0a6400]">0</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-on-surface-variant">Items remaining</span>
                            <span className="font-medium text-[#ba1a1a]">150</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="w-full h-8 border border-surface-dim rounded text-[12px] font-semibold hover:bg-surface-container flex items-center justify-center gap-1"
                          onClick={() => showToast('Opening receive items flow...')}
                        >
                          <span className="material-symbols-outlined text-[16px]">local_shipping</span>{' '}
                          Receive items
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Billing & Terms */}
                  <div className="border border-surface-dim rounded-lg bg-white overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-semibold hover:bg-surface-container-low"
                      onClick={() => handleAccordion('billing')}
                    >
                      Billing &amp; Terms
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {billingOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                    {billingOpen && (
                      <div className="border-t border-surface-dim p-4 text-[13px]" id="acc-billing">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Payment Terms</span>
                            <span className="font-medium">Net 30</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">Ship Via</span>
                            <span className="font-medium">FedEx Ground</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-on-surface-variant">FOB</span>
                            <span className="font-medium">Destination</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  <div className="border border-surface-dim rounded-lg bg-white overflow-hidden">
                    <button
                      type="button"
                      className="w-full px-4 py-3 flex items-center justify-between text-[14px] font-semibold hover:bg-surface-container-low"
                      onClick={() => handleAccordion('attachments')}
                    >
                      Attachments
                      <span className="material-symbols-outlined text-on-surface-variant">
                        {attachmentsOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                    {attachmentsOpen && (
                      <div
                        className="border-t border-surface-dim p-4 text-[13px] text-on-surface-variant"
                        id="acc-attachments"
                      >
                        No attachments.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="h-16 bg-white border-t border-surface-dim px-6 flex items-center justify-between shrink-0 z-20">
          <div className="w-1/3"></div>
          <div className="flex-1 flex justify-center">
            <button
              type="button"
              className="text-[13px] text-on-surface font-semibold hover:underline"
              onClick={() => showToast('Printing or downloading PO...')}
            >
              Print or download
            </button>
          </div>
          <div className="w-1/3 flex justify-end items-center gap-3">
            <div className="flex">
              <button
                type="button"
                className="h-9 px-4 border border-surface-dim rounded-l bg-white text-[13px] font-semibold hover:bg-surface-container"
                onClick={() => showToast('Saving PO...')}
              >
                Save
              </button>
              <button
                type="button"
                ref={saveArrowRef}
                className="h-9 px-2 border border-l-0 border-surface-dim rounded-r bg-white hover:bg-surface-container"
                id="saveArrow"
                onClick={handleSaveArrow}
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  expand_more
                </span>
              </button>
            </div>
            <div className="flex">
              <button
                type="button"
                className="h-9 px-5 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1"
                onClick={() => showToast('Preparing to send PO to Vendor...')}
              >
                Send to Vendor
              </button>
              <button
                type="button"
                ref={sendArrowRef}
                className="h-9 px-2 bg-primary text-white rounded-r hover:bg-primary-container border-l border-primary-container"
                id="sendArrow"
                onClick={handleSendArrow}
              >
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══════════ OVERLAYS ═══════════ */}
      {/* Save Menu */}
      {saveMenuOpen && saveMenuPos && (
        <div
          className="row-menu open"
          id="saveMenu"
          style={{ top: saveMenuPos.top, left: saveMenuPos.left }}
        >
          <button type="button" onClick={handleSaveAndNew}>
            Save and new
          </button>
          <button type="button" onClick={handleSaveAndClose}>
            Save and close
          </button>
        </div>
      )}

      {/* Send Menu */}
      {sendMenuOpen && sendMenuPos && (
        <div
          className="row-menu open"
          id="sendMenu"
          style={{ top: sendMenuPos.top, left: sendMenuPos.left }}
        >
          <button type="button" onClick={handleSendToVendorMenu}>
            Send to Vendor
          </button>
          <button type="button" onClick={handleDownloadPdf}>
            Download PDF
          </button>
        </div>
      )}

      {/* Toast */}
      <div className={`toast bottom-80 ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
