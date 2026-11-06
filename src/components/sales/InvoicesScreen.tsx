'use client';
import './sales.css';
import { useState, useMemo } from 'react';
import { SalesScreenProps, SALES_NAV } from './types';
import RowMenu from '@/components/ListPrimitives';
import type { DemoRow } from '@/data/shellData';
import { exportToCsv } from '@/lib/csvExport';

type InvoiceStatus = 'Open' | 'Paid' | 'Overdue';

interface Invoice {
  id: string;
  date: string;
  no: string;
  customer: string;
  due: string;
  amount: string;
  balance: string;
  status: InvoiceStatus;
}

const INITIAL_INVOICES: Invoice[] = [
  { id: '1002', date: '11/01/2026', no: '1002', customer: 'Acme Corp', due: '12/01/2026', amount: '$1,240.00', balance: '$1,240.00', status: 'Open' },
  { id: '1001', date: '10/28/2026', no: '1001', customer: 'Blue Ridge Co.', due: '11/27/2026', amount: '$3,410.00', balance: '$0.00', status: 'Paid' },
  { id: '0998', date: '10/15/2026', no: '0998', customer: 'Maple Supply', due: '11/14/2026', amount: '$890.00', balance: '$890.00', status: 'Overdue' },
  { id: '0996', date: '10/02/2026', no: '0996', customer: 'Northwind Labs', due: '11/01/2026', amount: '$2,100.00', balance: '$2,100.00', status: 'Open' },
  { id: '0994', date: '09/20/2026', no: '0994', customer: 'Orion Apparel', due: '10/20/2026', amount: '$540.00', balance: '$0.00', status: 'Paid' },
  { id: '0992', date: '09/05/2026', no: '0992', customer: 'Lakeside Design', due: '10/05/2026', amount: '$1,850.00', balance: '$1,850.00', status: 'Open' },
];

type TabKey = 'All' | 'Open' | 'Overdue' | 'Paid';

const STATUS_BADGE: Record<InvoiceStatus, string> = {
  Open: 'bg-primary/10 text-primary',
  Paid: 'bg-secondary-container text-on-secondary-container',
  Overdue: 'bg-error-container text-on-error-container',
};

const CREATE_ACTIONS: { label: string; icon: string }[] = [
  { label: 'Invoice', icon: 'receipt_long' },
  { label: 'Receive payment', icon: 'price_check' },
  { label: 'Estimate', icon: 'request_quote' },
  { label: 'Customer', icon: 'person_add' },
];

const TABS: TabKey[] = ['All', 'Open', 'Overdue', 'Paid'];

export default function InvoicesScreen({ onNavigate, onToast, onCreate, onOpenCreateFlyout, onOpenPeek }: SalesScreenProps) {
  const [rows, setRows] = useState<Invoice[]>(INITIAL_INVOICES);
  const [activeTab, setActiveTab] = useState<TabKey>('All');
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows.filter((r) => {
      const tabOk = activeTab === 'All' || r.status === activeTab;
      const searchOk = !q || r.no.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q);
      return tabOk && searchOk;
    });
  }, [rows, activeTab, searchText]);

  const total = rows.length;
  const shown = filteredRows.length;

  const visibleIds = filteredRows.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkAction = (action: string) => {
    const n = selected.size;
    onToast(`${action} on ${n} invoice(s)`);
    if (action === 'Delete') {
      setRows((prev) => prev.filter((r) => !selected.has(r.id)));
    }
    clearSelection();
  };

  const handleBreadcrumbNav = (target: 'overview' | 'invoices') => {
    const [domain, screenId] = SALES_NAV[target]();
    onNavigate(domain, screenId);
  };

  return (
    <>
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <button
            className="text-label-md hover:text-primary"
            onClick={() => handleBreadcrumbNav('overview')}
          >
            Sales &amp; Get Paid
          </button>
          <span className="text-outline">/</span>
          <button
            className="text-label-md text-primary font-semibold hover:underline"
            onClick={() => handleBreadcrumbNav('invoices')}
          >
            Invoices
          </button>
        </div>
      </div>

      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Invoices</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">All invoices across customers. Row → peek → Open full → document engine.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                onClick={() => onCreate('Invoice')}
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>New invoice
              </button>
              <button
                onClick={() => onOpenCreateFlyout()}
                className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
                aria-label="More create actions"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <button
              onClick={() => {
                const cols = [
                  { key: 'date', label: 'Date' },
                  { key: 'no', label: 'Invoice' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'due', label: 'Due' },
                  { key: 'amount', label: 'Amount' },
                  { key: 'balance', label: 'Balance' },
                  { key: 'status', label: 'Status' },
                ];
                exportToCsv(filteredRows as unknown as Record<string, unknown>[], cols, 'invoices');
                onToast(`Exported ${filteredRows.length} records to CSV`);
              }}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export
            </button>
            <button
              onClick={() => onToast('Customize panel')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>Customize
            </button>
          </div>
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">Create actions:</span>
          {CREATE_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => onCreate(a.label)}
              className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">{a.icon}</span>{a.label}
            </button>
          ))}
          <button
            onClick={() => onOpenCreateFlyout()}
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">
          {/* Status tabs */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`h-full px-3 text-label-md tab-underline ${activeTab === t ? 'active' : 'text-on-surface-variant'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="px-4 py-2 flex items-center gap-2 border-b border-surface-dim flex-wrap">
            <div className="relative flex items-center flex-1 max-w-sm min-w-[180px]">
              <span className="material-symbols-outlined absolute left-2 text-[15px] text-outline">search</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full h-7 pl-7 pr-2 bg-surface-container-low border border-surface-dim rounded text-body-sm focus:outline-none focus:border-primary"
                placeholder="Filter rows…"
              />
            </div>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">filter_list</span>Filter
            </button>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>Date range
            </button>
            <button className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            <span className="ml-auto text-[11px] text-on-surface-variant">{`1–${shown} of ${total}`}</span>
          </div>

          {/* Bulk bar */}
          <div className={`bulk-bar${selected.size > 0 ? ' show' : ''}`}>
            <span className="text-[12px] font-semibold">{selected.size} selected</span>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => bulkAction('Send')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">send</span>Send</button>
            <button onClick={() => bulkAction('Remind')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">notifications_active</span>Remind</button>
            <button onClick={() => bulkAction('Print')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">print</span>Print</button>
            <button onClick={() => bulkAction('Mark paid')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">check_circle</span>Mark paid</button>
            <span className="w-px h-4 bg-white/30"></span>
            <button onClick={() => bulkAction('Export')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">download</span>Export</button>
            <button onClick={() => bulkAction('Delete')}><span className="material-symbols-outlined text-[14px] align-middle mr-1">delete</span>Delete</button>
            <button className="ml-auto" onClick={clearSelection} aria-label="Clear selection"><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>

          {/* Table */}
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">No.</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-dim">
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-surface-container-low cursor-pointer inv-row"
                  onClick={() => onToast(`Open invoice ${r.no}`)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="row-check inv-check"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 font-medium">{r.no}</td>
                  <td className="px-3 py-2">{r.customer}</td>
                  <td className="px-3 py-2">{r.due}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.balance}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-label-sm ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <RowMenu
                      ariaLabel={`Row actions for invoice ${r.no}`}
                      items={[
                        {
                          label: 'View',
                          icon: 'open_in_new',
                          onClick: () => onOpenPeek?.(r as unknown as DemoRow, 'sales'),
                        },
                        {
                          label: 'Edit',
                          icon: 'edit',
                          onClick: () => onToast(`Editing invoice ${r.no}`),
                        },
                        {
                          label: 'Send',
                          icon: 'send',
                          onClick: () => onToast(`Sending invoice ${r.no}`),
                        },
                        {
                          label: 'Remind',
                          icon: 'notifications_active',
                          onClick: () => onToast(`Sending reminder for ${r.no}`),
                        },
                        {
                          label: 'Print',
                          icon: 'print',
                          dividerBefore: true,
                          onClick: () => onToast(`Printing invoice ${r.no}`),
                        },
                        {
                          label: 'Mark paid',
                          icon: 'check_circle',
                          onClick: () => onToast(`Marking ${r.no} paid`),
                        },
                        {
                          label: 'Delete',
                          icon: 'delete',
                          danger: true,
                          onClick: () => onToast(`Deleting invoice ${r.no}`),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
