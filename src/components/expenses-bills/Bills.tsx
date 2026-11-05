'use client';

import './expenses-bills.css';
import React, { useState, useEffect, useCallback } from 'react';
import type { ExpensesBillsScreenProps } from './types';
import { EBL_NAV } from './types';

/* ════════════════════════════════════════════════════════════════
   Bills screen — 1:1 conversion of upload/Bills.html
   ════════════════════════════════════════════════════════════════ */

type BillTab = 'For review' | 'Unpaid' | 'Paid';

/* Customize-drawer column list (sourced verbatim from HTML) */
const COLUMN_ITEMS: string[] = [
  'Vendor',
  'Source',
  'Bill No.',
  'Bill Date',
  'Category',
  'Class',
  'Location',
  'Memo',
  'Due Date',
  'Bill Amount',
  'Attachments',
];

export default function Bills({
  onNavigate,
  onToast,
  onCreate,
}: ExpensesBillsScreenProps) {
  /* ── Toast ── */
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((msg: string) => setToastMsg(msg), []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(''), 2500);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  /* Mirror local toast up to the shell (matches Overview pattern) */
  useEffect(() => {
    if (toastMsg) onToast(toastMsg);
  }, [toastMsg, onToast]);

  /* ── Tabs ── */
  const [activeTab, setActiveTab] = useState<BillTab>('For review');

  /* ── Add Bill split-menu ── */
  const [addBillMenuOpen, setAddBillMenuOpen] = useState(false);

  /* ── Date popover + active date pill ── */
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [dateFilterApplied, setDateFilterApplied] = useState(false);
  const dateFilterLabel = dateFilterApplied ? 'Custom Range' : 'This Year';

  /* ── Filter popover ── */
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  /* ── Customize drawer ── */
  const [customizeOpen, setCustomizeOpen] = useState(false);

  /* ── Outside-click + Escape (closes any open popover/menu/drawer) ── */
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('#addBillArrow') && !target.closest('#addBillMenu')) {
        setAddBillMenuOpen(false);
      }
      if (!target.closest('#dateFilterTrigger') && !target.closest('#datePopover')) {
        setDatePopoverOpen(false);
      }
      if (!target.closest('#filterTrigger') && !target.closest('#filterPopover')) {
        setFilterPopoverOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAddBillMenuOpen(false);
        setDatePopoverOpen(false);
        setFilterPopoverOpen(false);
        setCustomizeOpen(false);
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
  const handleTabClick = (tab: BillTab) => {
    setActiveTab(tab);
    showToast(`Switched to ${tab} tab`);
  };

  /* Add bill main button — onCreate('Bill') + toast */
  const handleAddBillMain = () => {
    onCreate('Bill');
    showToast('Opening New Bill drawer...');
  };

  /* Add bill arrow — toggles add-bill menu */
  const handleAddBillArrow = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAddBillMenuOpen((v) => !v);
  };

  /* Add-bill menu: "Create bill" */
  const handleAddBillMenuCreate = () => {
    setAddBillMenuOpen(false);
    showToast('Creating bill...');
  };

  /* Pay bills — navigate to bill_payments + toast */
  const handlePayBills = () => {
    const [d, s] = EBL_NAV.payBills();
    onNavigate(d, s);
    showToast('Opening Pay Bills workspace...');
  };

  /* Manage email settings link */
  const handleManageEmailSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    showToast('Opening email settings...');
  };

  /* Email-forwarding banner copy */
  const handleCopyEmail = () => showToast('Email address copied');

  /* How to manage bills link */
  const handleHowToManage = (e: React.MouseEvent) => {
    e.preventDefault();
    showToast('Opening help article...');
  };

  /* Top utility icons */
  const handleGiveFeedback = () => showToast('Opening feedback...');
  const handleOpenInNew = () => showToast('Opening in new tab...');
  const handleFullscreen = () => showToast('Toggling fullscreen...');

  /* Date filter trigger */
  const handleDateTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDatePopoverOpen((v) => !v);
    setFilterPopoverOpen(false);
  };

  /* Date popover close (X) */
  const handleDatePopoverClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDatePopoverOpen(false);
  };

  /* Date popover Apply */
  const handleApplyDateFilter = () => {
    setDatePopoverOpen(false);
    setDateFilterApplied(true);
    showToast('Date filter applied');
  };

  /* Date popover Reset OR active-pill close (resetDateFilter in source) */
  const handleResetDateFilter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDateFilterApplied(false);
    showToast('Date filter reset');
  };

  /* Filter trigger */
  const handleFilterTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFilterPopoverOpen((v) => !v);
    setDatePopoverOpen(false);
  };

  /* Filter popover close (X) */
  const handleFilterPopoverClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFilterPopoverOpen(false);
  };

  /* Filter popover Apply */
  const handleApplyFilters = () => {
    setFilterPopoverOpen(false);
    showToast('Filters applied');
  };

  /* Filter popover Reset */
  const handleResetFilters = () => {
    setFilterPopoverOpen(false);
  };

  /* Print icon */
  const handlePrint = () => showToast('Printing...');

  /* Customize drawer open / close */
  const handleCustomizeOpen = () => setCustomizeOpen(true);
  const handleCustomizeClose = () => setCustomizeOpen(false);

  /* Upload files (empty-state CTA) */
  const handleUploadFiles = () => showToast('Opening file picker...');

  /* Pagination nav buttons (disabled in source but still wired) */
  const handlePageNav = () => showToast('No more pages');

  /* Tab class builder */
  const tabClass = (tab: BillTab) =>
    `h-full px-1 text-[14px] tab-underline ${
      activeTab === tab ? 'active' : 'text-on-surface-variant hover:text-on-surface'
    }`;

  /* ═══════════ Render ═══════════ */
  return (
    <div className="bills-page">
      {/* ═══════════ TOP HEADER ═══════════ */}
      <header className="bg-white px-6 pt-4 shrink-0 flex flex-col z-20">
        {/* Breadcrumbs & Utility */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] text-on-surface-variant font-medium">
            Expenses & Pay Bills / Bills
          </div>
          <div className="flex items-center gap-4 text-on-surface-variant">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-on-surface text-[12px]"
              onClick={handleGiveFeedback}
            >
              <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
              Give feedback
            </button>
            <button type="button" className="icon-btn" onClick={handleOpenInNew}>
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </button>
            <button type="button" className="icon-btn" onClick={handleFullscreen}>
              <span className="material-symbols-outlined text-[18px]">fullscreen</span>
            </button>
          </div>
        </div>

        {/* Title & Main Actions */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[32px] font-semibold text-on-surface">Bills</h1>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="text-[13px] font-semibold text-on-surface hover:underline"
              onClick={handleManageEmailSettings}
            >
              Manage email settings
            </a>
            <button
              type="button"
              className="h-8 px-4 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container-low"
              onClick={handlePayBills}
            >
              Pay bills
            </button>
            <div className="flex">
              <button
                type="button"
                className="h-8 px-3 bg-primary text-white text-[13px] font-semibold rounded-l hover:bg-primary-container flex items-center gap-1"
                onClick={handleAddBillMain}
              >
                Add bill
              </button>
              <button
                type="button"
                className="h-8 px-1.5 bg-primary text-white rounded-r hover:bg-primary-container border-l border-[#084e00]"
                id="addBillArrow"
                onClick={handleAddBillArrow}
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
          </div>
        </div>

        {/* Add Bill Menu */}
        <div
          className={`row-menu ${addBillMenuOpen ? 'open' : ''}`}
          id="addBillMenu"
          style={{ top: 110, right: 24 }}
        >
          <button type="button" onClick={handleAddBillMenuCreate}>
            Create bill
          </button>
        </div>

        {/* Email Forwarding Banner */}
        <div className="bg-white border border-[#0077c5] rounded-lg p-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="material-symbols-outlined text-[#0077c5] text-[18px]">auto_awesome</span>
            <span className="font-semibold text-on-surface">Anyone can autofill multiple receipts</span>
            <span className="text-on-surface-variant">or create bills and expenses by sending files to:</span>
            <span className="font-semibold text-on-surface">managekube_llc+expenses@assist.intuit.com</span>
            <button
              type="button"
              className="text-[#0077c5] hover:bg-[#eef5fa] p-1 rounded"
              title="Copy email"
              onClick={handleCopyEmail}
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-surface-dim">
          <div className="flex items-center gap-6 h-10">
            <button
              type="button"
              className={tabClass('For review')}
              data-tab="For review"
              onClick={() => handleTabClick('For review')}
            >
              For review
            </button>
            <button
              type="button"
              className={tabClass('Unpaid')}
              data-tab="Unpaid"
              onClick={() => handleTabClick('Unpaid')}
            >
              Unpaid
            </button>
            <button
              type="button"
              className={tabClass('Paid')}
              data-tab="Paid"
              onClick={() => handleTabClick('Paid')}
            >
              Paid
            </button>
          </div>
          <a
            href="#"
            className="text-[13px] text-primary hover:underline"
            onClick={handleHowToManage}
          >
            How to manage bills
          </a>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="flex-1 overflow-y-auto px-6 py-4 relative">
        {/* Filter Bar */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              {/* Vendor Filter */}
              <div className="w-48">
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  Vendor
                </label>
                <div className="relative">
                  <select className="field-select">
                    <option>All</option>
                    <option>Printful</option>
                    <option>Gelato</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-2 text-[16px] text-on-surface-variant pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Bill Date Filter (opens popover) */}
              <div className="w-48 relative">
                <label className="block text-[11px] font-semibold text-on-surface-variant mb-1">
                  Bill Date
                </label>
                <div
                  className="relative cursor-pointer"
                  id="dateFilterTrigger"
                  onClick={handleDateTrigger}
                >
                  <div className="field-select flex items-center justify-between">
                    <span>{dateFilterLabel}</span>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                      calendar_today
                    </span>
                  </div>
                </div>

                {/* Date Popover */}
                <div
                  className={`popover ${datePopoverOpen ? 'open' : ''}`}
                  id="datePopover"
                  style={{ top: 60, left: 0, width: 500, padding: 20 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[16px] font-semibold">Bill Date</h3>
                    <button type="button" className="icon-btn" onClick={handleDatePopoverClose}>
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <div className="flex items-end gap-4 mb-6">
                    <div className="flex-1">
                      <label className="block text-[12px] text-on-surface-variant mb-1">Bill Date</label>
                      <select className="field-select">
                        <option>This Year</option>
                        <option>Last Year</option>
                        <option>Custom</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[12px] text-on-surface-variant mb-1">From</label>
                      <div className="relative">
                        <input className="field-input" defaultValue="01/01/2026" />
                        <span className="material-symbols-outlined absolute right-2 top-2 text-[16px] text-on-surface-variant">
                          calendar_today
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[12px] text-on-surface-variant mb-1">To</label>
                      <div className="relative">
                        <input className="field-input" defaultValue="12/31/2026" />
                        <span className="material-symbols-outlined absolute right-2 top-2 text-[16px] text-on-surface-variant">
                          calendar_today
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      className="h-8 px-4 border border-surface-dim rounded text-[13px] font-semibold hover:bg-surface-container"
                      onClick={() => handleResetDateFilter()}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="h-8 px-4 bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container"
                      onClick={handleApplyDateFilter}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter By Button (opens popover) */}
              <div className="relative mt-5">
                <button
                  type="button"
                  className="h-9 px-3 border border-surface-dim rounded bg-[#f4f3f7] text-[13px] font-semibold flex items-center gap-1 hover:bg-[#e3e2e6]"
                  id="filterTrigger"
                  onClick={handleFilterTrigger}
                >
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                    filter_list
                  </span>{' '}
                  Filters
                </button>

                {/* Filter By Popover */}
                <div
                  className={`popover ${filterPopoverOpen ? 'open' : ''}`}
                  id="filterPopover"
                  style={{ top: 44, left: 0, width: 320, padding: 20 }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[16px] font-semibold">Filter By</h3>
                    <button type="button" className="icon-btn" onClick={handleFilterPopoverClose}>
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-[12px] text-on-surface-variant mb-1">Status</label>
                      <div className="relative">
                        <select className="field-select">
                          <option>All</option>
                          <option>Open</option>
                          <option>Overdue</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-2 text-[16px] text-on-surface-variant pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[12px] text-on-surface-variant mb-1">Category</label>
                      <div className="relative">
                        <select className="field-select">
                          <option>All</option>
                          <option>Shipping</option>
                          <option>Software</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-2 top-2 text-[16px] text-on-surface-variant pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="h-9 w-full bg-primary text-white rounded text-[13px] font-semibold hover:bg-primary-container"
                      onClick={handleApplyFilters}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="h-9 w-full border border-surface-dim rounded text-[13px] font-semibold hover:bg-surface-container"
                      onClick={handleResetFilters}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Date Pill */}
            <div
              className={`mt-1 ${dateFilterApplied ? '' : 'hidden-imp'}`}
              id="activeDatePill"
            >
              <button
                type="button"
                className="h-7 px-3 rounded-full bg-[#eef5fa] text-[12px] font-semibold text-on-surface flex items-center gap-2 hover:bg-[#dce8f2]"
              >
                Bill Date: 01/01/2026-12/31/2026{' '}
                <span
                  className="material-symbols-outlined text-[14px] text-on-surface-variant"
                  onClick={handleResetDateFilter}
                >
                  close
                </span>
              </button>
            </div>
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-4 mt-2">
            <button type="button" className="icon-btn" onClick={handlePrint}>
              <span className="material-symbols-outlined text-[18px]">print</span>
            </button>
            <button
              type="button"
              className="h-8 px-3 text-[13px] font-semibold text-on-surface flex items-center gap-2 hover:bg-surface-container rounded"
              id="customizeBtn"
              onClick={handleCustomizeOpen}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span> Customize
            </button>
          </div>
        </div>

        {/* Empty State / Table Area */}
        <div className="border-t border-surface-dim mt-2">
          <table className="w-full text-left text-[12px] text-on-surface-variant uppercase tracking-wider font-semibold">
            <thead>
              <tr className="border-b border-surface-dim">
                <th className="py-3 px-3 w-10">
                  <input type="checkbox" className="row-check" />
                </th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Bill No.</th>
                <th className="py-3 px-3">Bill Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Memo</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Bill Amount</th>
                <th className="py-3 px-3 text-right">Attachments</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="py-24 text-center">
                  <h3 className="text-[18px] font-semibold text-on-surface mb-2">No bills found</h3>
                  <p className="text-[13px] text-on-surface-variant mb-4">
                    Select Upload files to create bills automatically.
                  </p>
                  <button
                    type="button"
                    className="h-8 px-4 text-[13px] font-semibold text-primary hover:underline"
                    onClick={handleUploadFiles}
                  >
                    Upload files
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-[12px] text-on-surface-variant">
          <div>0 - 0 of 0 items</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="icon-btn opacity-50"
              disabled
              onClick={handlePageNav}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span>Page</span>
            <input
              className="w-10 h-7 border border-surface-dim rounded text-center"
              defaultValue="1"
            />
            <span>of 1</span>
            <button
              type="button"
              className="icon-btn opacity-50"
              disabled
              onClick={handlePageNav}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
            <button
              type="button"
              className="icon-btn opacity-50"
              disabled
              onClick={handlePageNav}
            >
              <span className="material-symbols-outlined text-[18px]">last_page</span>
            </button>
          </div>
        </div>
      </main>

      {/* ═══════════ CUSTOMIZE DRAWER ═══════════ */}
      <div
        className={`drawer-scrim ${customizeOpen ? 'open' : ''}`}
        onClick={handleCustomizeClose}
      />
      <div
        className={`drawer w-380 ${customizeOpen ? 'open' : ''}`}
        id="customizeDrawer"
      >
        <div className="p-5 border-b border-surface-dim flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-on-surface">Customize</h2>
          <button
            type="button"
            className="icon-btn"
            id="closeCustomize"
            onClick={handleCustomizeClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Sort Section */}
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-on-surface mb-3 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">expand_less</span> Sort
            </div>
            <div className="border border-surface-dim rounded-lg p-3 space-y-3">
              <div>
                <label className="block text-[11px] text-on-surface-variant mb-1">Sort by</label>
                <select className="field-select">
                  <option>Bill Date</option>
                  <option>Due Date</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-on-surface-variant mb-1">Direction</label>
                <select className="field-select">
                  <option>Ascending</option>
                  <option>Descending</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              className="mt-2 text-[12px] text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> Add sort
            </button>
          </div>

          {/* Rows Section */}
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-on-surface mb-3 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">expand_less</span> Rows
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-on-surface-variant mb-1">Rows per page</label>
                <select className="field-select">
                  <option>50</option>
                  <option>75</option>
                  <option>100</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-on-surface-variant mb-1">Row height</label>
                <select className="field-select">
                  <option>Cozy</option>
                  <option>Compact</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="row-check" /> Alternate row color
              </label>
            </div>
          </div>

          {/* Columns Section */}
          <div>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-on-surface mb-3 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">expand_less</span> Columns
            </div>
            <p className="text-[11px] text-on-surface-variant mb-3">
              Drag to change the order of columns
            </p>

            <div className="space-y-1">
              {COLUMN_ITEMS.map((col) => (
                <div
                  key={col}
                  className="flex items-center justify-between py-1 hover:bg-surface-container rounded px-1 -mx-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-outline cursor-grab">
                      drag_indicator
                    </span>
                    <input type="checkbox" className="row-check" defaultChecked />
                    <span className="text-[13px]">{col}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
