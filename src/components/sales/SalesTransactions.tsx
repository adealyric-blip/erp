'use client';
import './sales.css';
import { useState, useMemo } from 'react';
import { SalesScreenProps, SALES_NAV } from './types';

type TxType = 'Invoice' | 'Sales receipt' | 'Credit memo' | 'Payment';
type TxStatus = 'Open' | 'Paid' | 'Overdue';

interface SalesRow {
  id: number;
  date: string;
  no: string;
  customer: string;
  type: TxType;
  due: string;
  amount: string;
  balance: string;
  status: TxStatus;
}

const ROWS: SalesRow[] = [
  { id: 1, date: '11/01/2026', no: '1002', customer: 'Acme Corp', type: 'Invoice', due: '12/01/2026', amount: '$1,240.00', balance: '$1,240.00', status: 'Open' },
  { id: 2, date: '10/31/2026', no: 'PMT-4410', customer: 'Blue Ridge Co.', type: 'Payment', due: '—', amount: '$3,410.00', balance: '$0.00', status: 'Paid' },
  { id: 3, date: '10/28/2026', no: '1001', customer: 'Blue Ridge Co.', type: 'Invoice', due: '11/27/2026', amount: '$3,410.00', balance: '$0.00', status: 'Paid' },
  { id: 4, date: '10/25/2026', no: 'SR-889', customer: 'Orion Apparel', type: 'Sales receipt', due: '—', amount: '$540.00', balance: '$0.00', status: 'Paid' },
  { id: 5, date: '10/22/2026', no: 'CM-204', customer: 'Maple Supply', type: 'Credit memo', due: '—', amount: '$120.00', balance: '$120.00', status: 'Open' },
  { id: 6, date: '10/15/2026', no: '0998', customer: 'Maple Supply', type: 'Invoice', due: '11/14/2026', amount: '$890.00', balance: '$890.00', status: 'Overdue' },
  { id: 7, date: '10/02/2026', no: '0996', customer: 'Northwind Labs', type: 'Invoice', due: '11/01/2026', amount: '$2,100.00', balance: '$2,100.00', status: 'Open' },
  { id: 8, date: '09/28/2026', no: 'PMT-4388', customer: 'Northwind Labs', type: 'Payment', due: '—', amount: '$1,500.00', balance: '$0.00', status: 'Paid' },
  { id: 9, date: '09/20/2026', no: '0994', customer: 'Orion Apparel', type: 'Invoice', due: '10/20/2026', amount: '$540.00', balance: '$0.00', status: 'Paid' },
  { id: 10, date: '09/12/2026', no: 'SR-871', customer: 'Acme Corp', type: 'Sales receipt', due: '—', amount: '$210.00', balance: '$0.00', status: 'Paid' },
];

type StatusTab = 'All' | 'Open' | 'Overdue' | 'Paid';
type TypeFilter = '' | 'Invoice' | 'Sales receipt' | 'Credit memo' | 'Payment';

const STATUS_TABS: StatusTab[] = ['All', 'Open', 'Overdue', 'Paid'];

const TYPE_BADGE_CLASS: Record<TxType, string> = {
  'Invoice': 'bg-qb-blue/10 text-qb-blue',
  'Payment': 'bg-qb-teal/10 text-qb-teal',
  'Sales receipt': 'bg-qb-green/10 text-qb-green',
  'Credit memo': 'bg-qb-maroon/10 text-qb-maroon',
};

const STATUS_BADGE_CLASS: Record<TxStatus, string> = {
  Open: 'bg-primary/10 text-primary',
  Paid: 'bg-secondary-container text-on-secondary-container',
  Overdue: 'bg-error-container text-on-error-container',
};

const CREATE_CHIPS: { icon: string; label: string }[] = [
  { icon: 'receipt_long', label: 'Invoice' },
  { icon: 'price_check', label: 'Receive payment' },
  { icon: 'point_of_sale', label: 'Sales receipt' },
  { icon: 'assignment_return', label: 'Credit memo' },
  { icon: 'request_quote', label: 'Estimate' },
];

export default function SalesTransactions({ onNavigate, onToast, onCreate, onOpenCreateFlyout }: SalesScreenProps) {
  const [activeTab, setActiveTab] = useState<StatusTab>('All');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [searchText, setSearchText] = useState('');

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return ROWS.filter((r) => {
      const matchType = !typeFilter || r.type === typeFilter;
      const matchStatus =
        activeTab === 'All' ? true : r.status === activeTab;
      const matchSearch =
        !q ||
        r.date.toLowerCase().includes(q) ||
        r.no.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.due.toLowerCase().includes(q) ||
        r.amount.toLowerCase().includes(q) ||
        r.balance.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);
      return matchType && matchStatus && matchSearch;
    });
  }, [activeTab, typeFilter, searchText]);

  const total = ROWS.length;
  const shown = filteredRows.length;
  const countText = `1–${shown} of ${total}`;

  const goOverview = () => {
    const [d, s] = SALES_NAV.overview();
    onNavigate(d, s);
  };
  const goTransactions = () => {
    const [d, s] = SALES_NAV.transactions();
    onNavigate(d, s);
  };

  return (
    <>
      {/* ═══════════ CONTEXT HEADER ═══════════ */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <button type="button" onClick={goOverview} className="text-label-md hover:text-primary cursor-pointer">
            Sales &amp; Get Paid
          </button>
          <span className="text-outline">/</span>
          <button type="button" onClick={goTransactions} className="text-label-md text-primary font-semibold hover:underline cursor-pointer">
            Sales transactions
          </button>
        </div>
        <div className="text-label-sm text-on-surface-variant">Preview · standalone</div>
      </div>

      {/* ═══════════ SALES TRANSACTIONS PAGE ═══════════ */}
      <main className="px-6 pb-12">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Sales transactions</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Invoice, Receipt, Credit, Payment — unified ledger. Default sort: Date desc.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex split-btn">
              <button
                type="button"
                onClick={() => onCreate('New transaction')}
                className="h-8 px-3 bg-primary text-white text-body-md font-semibold hover:bg-primary-container flex items-center gap-1 split-btn-main"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>New transaction
              </button>
              <button
                type="button"
                onClick={() => onToast('New transaction menu')}
                className="h-8 px-1.5 bg-primary text-white hover:bg-primary-container split-btn-arrow"
              >
                <span className="material-symbols-outlined text-[16px]">expand_more</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => onToast('Exporting…')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export
            </button>
            <button
              type="button"
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
          {CREATE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onCreate(chip.label)}
              className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">{chip.icon}</span>{chip.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenCreateFlyout}
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-surface-dim overflow-hidden">
          {/* Status view tabs */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-surface-dim overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-full px-3 text-label-md tab-underline ${activeTab === tab ? 'active' : 'text-on-surface-variant'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filter bar with TYPE dropdown */}
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
            <label className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant">category</span>
              <span className="text-on-surface-variant">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="bg-transparent border-none text-label-sm text-on-surface focus:outline-none"
              >
                <option value="">All types</option>
                <option value="Invoice">Invoice</option>
                <option value="Sales receipt">Sales receipt</option>
                <option value="Credit memo">Credit memo</option>
                <option value="Payment">Payment</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => onToast('Filter…')}
              className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">filter_list</span>Filter
            </button>
            <button
              type="button"
              onClick={() => onToast('Date range picker')}
              className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>Date range
            </button>
            <button
              type="button"
              onClick={() => onToast('Saved views')}
              className="h-7 px-2 border border-surface-dim rounded text-label-sm hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">bookmark</span>Saved views
            </button>
            <span className="ml-auto text-[11px] text-on-surface-variant">{countText}</span>
          </div>

          {/* Table */}
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="w-8 px-3 py-2"><input type="checkbox" className="row-check" /></th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">No.</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Type</th>
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
                  onClick={() => onToast(`Open transaction ${r.no}`)}
                  className="hover:bg-surface-container-low cursor-pointer sales-row"
                >
                  <td className="px-3 py-2"><input type="checkbox" className="row-check" /></td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2 font-medium">{r.no}</td>
                  <td className="px-3 py-2">{r.customer}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${TYPE_BADGE_CLASS[r.type]}`}>{r.type}</span>
                  </td>
                  <td className="px-3 py-2">{r.due}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.balance}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-label-sm ${STATUS_BADGE_CLASS[r.status]}`}>{r.status}</span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToast('Row actions menu');
                      }}
                      className="w-6 h-6 rounded hover:bg-surface-container flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">more_horiz</span>
                    </button>
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
