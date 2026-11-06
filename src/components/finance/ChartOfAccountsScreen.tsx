'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DomainKey } from '@/data/shellData';
import { exportToCsv } from '@/lib/csvExport';
import styles from './ChartOfAccountsScreen.module.css';

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';

export interface AccountItem {
  id: string;
  number: string;
  name: string;
  type: AccountType;
  detail: string;
  balance: number;
  bankBalance?: number;
  taxLine: string;
  active: boolean;
  desc?: string;
}

const DETAIL_TYPES: Record<AccountType, string[]> = {
  Asset: [
    'Cash and cash equivalents',
    'Checking',
    'Savings',
    'Accounts receivable',
    'Inventory',
    'Fixed assets',
    'Other current assets',
  ],
  Liability: [
    'Accounts payable',
    'Credit card',
    'Sales tax payable',
    'Payroll liabilities',
    'Loan',
    'Other current liabilities',
  ],
  Equity: [
    "Owner's equity",
    'Retained earnings',
    'Partner contributions',
    'Partner distributions',
  ],
  Income: [
    'Sales of product income',
    'Sales of services',
    'Discounts',
    'Shipping income',
    'Interest income',
  ],
  Expense: [
    'Cost of goods sold',
    'Advertising',
    'Bank charges & fees',
    'Dues and subscriptions',
    'Insurance',
    'Legal & professional',
    'Meals & entertainment',
    'Office/General Administrative',
    'Rent or lease',
    'Shipping & delivery',
    'Software',
    'Travel',
    'Utilities',
  ],
};

const INITIAL_ACCOUNTS: AccountItem[] = [
  // ─── Current Assets (100-139) ───
  {
    id: 'coa-101',
    number: '101',
    name: 'Cash on Hand',
    type: 'Asset',
    detail: 'Cash and cash equivalents',
    balance: 2450.0,
    bankBalance: 2450.0,
    taxLine: '—',
    active: true,
    desc: 'Physical currency kept at your business',
  },
  {
    id: 'coa-105',
    number: '105',
    name: 'Checking Account',
    type: 'Asset',
    detail: 'Checking',
    balance: 412840.5,
    bankBalance: 412840.5,
    taxLine: '—',
    active: true,
    desc: 'Your primary business bank account',
  },
  {
    id: 'coa-110',
    number: '110',
    name: 'Savings Account',
    type: 'Asset',
    detail: 'Savings',
    balance: 1250000.0,
    bankBalance: 1250000.0,
    taxLine: '—',
    active: true,
    desc: 'Business savings and reserves',
  },
  {
    id: 'coa-120',
    number: '120',
    name: 'Accounts Receivable',
    type: 'Asset',
    detail: 'Accounts receivable',
    balance: 84200.0,
    taxLine: '—',
    active: true,
    desc: 'Money owed to you by customers',
  },
  {
    id: 'coa-125',
    number: '125',
    name: 'Inventory',
    type: 'Asset',
    detail: 'Inventory',
    balance: 32450.0,
    taxLine: '—',
    active: true,
    desc: 'Goods held for sale (if applicable)',
  },
  {
    id: 'coa-130',
    number: '130',
    name: 'Prepaid Expenses',
    type: 'Asset',
    detail: 'Other current assets',
    balance: 14200.0,
    taxLine: '—',
    active: true,
    desc: 'Services paid for in advance (insurance, rent)',
  },

  // ─── Fixed Assets (140-169) ───
  {
    id: 'coa-140',
    number: '140',
    name: 'Equipment',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: 45000.0,
    taxLine: '—',
    active: true,
    desc: 'Computers, machinery, tools',
  },
  {
    id: 'coa-145',
    number: '145',
    name: 'Accumulated Depreciation - Equipment',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: -12400.0,
    taxLine: '—',
    active: true,
    desc: 'Tracks value reduction over time',
  },
  {
    id: 'coa-150',
    number: '150',
    name: 'Vehicles',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: 62000.0,
    taxLine: '—',
    active: true,
    desc: 'Business-owned vehicles',
  },
  {
    id: 'coa-155',
    number: '155',
    name: 'Accumulated Depreciation - Vehicles',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: -18600.0,
    taxLine: '—',
    active: true,
    desc: 'Vehicle depreciation',
  },
  {
    id: 'coa-160',
    number: '160',
    name: 'Furniture and Fixtures',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: 18500.0,
    taxLine: '—',
    active: true,
    desc: 'Office furniture, display cases',
  },
  {
    id: 'coa-165',
    number: '165',
    name: 'Leasehold Improvements',
    type: 'Asset',
    detail: 'Fixed assets',
    balance: 35000.0,
    taxLine: '—',
    active: true,
    desc: 'Improvements to rented space',
  },

  // ─── Other Assets (170-199) ───
  {
    id: 'coa-170',
    number: '170',
    name: 'Security Deposits',
    type: 'Asset',
    detail: 'Other current assets',
    balance: 15000.0,
    taxLine: '—',
    active: true,
    desc: 'Deposits paid on leases or utilities',
  },
  {
    id: 'coa-175',
    number: '175',
    name: 'Long-Term Investments',
    type: 'Asset',
    detail: 'Other current assets',
    balance: 250000.0,
    taxLine: '—',
    active: true,
    desc: 'Investments held beyond one year',
  },
  {
    id: 'coa-180',
    number: '180',
    name: 'Intangible Assets',
    type: 'Asset',
    detail: 'Other current assets',
    balance: 75000.0,
    taxLine: '—',
    active: true,
    desc: 'Patents, trademarks, goodwill',
  },

  // ─── Current Liabilities (200-249) ───
  {
    id: 'coa-200',
    number: '200',
    name: 'Accounts Payable',
    type: 'Liability',
    detail: 'Accounts payable',
    balance: 18420.0,
    taxLine: '—',
    active: true,
    desc: 'Money you owe to vendors and suppliers',
  },
  {
    id: 'coa-210',
    number: '210',
    name: 'Credit Card Payable',
    type: 'Liability',
    detail: 'Credit card',
    balance: 6240.5,
    bankBalance: 6240.5,
    taxLine: '—',
    active: true,
    desc: 'Outstanding credit card balances',
  },
  {
    id: 'coa-220',
    number: '220',
    name: 'Payroll Liabilities',
    type: 'Liability',
    detail: 'Payroll liabilities',
    balance: 14850.0,
    taxLine: '—',
    active: true,
    desc: 'Wages and taxes owed to employees',
  },
  {
    id: 'coa-225',
    number: '225',
    name: 'Sales Tax Payable',
    type: 'Liability',
    detail: 'Sales tax payable',
    balance: 4210.0,
    taxLine: '—',
    active: true,
    desc: 'Collected sales tax awaiting remittance',
  },
  {
    id: 'coa-230',
    number: '230',
    name: 'Short-Term Loans',
    type: 'Liability',
    detail: 'Loan',
    balance: 25000.0,
    taxLine: '—',
    active: true,
    desc: 'Loans due within one year',
  },
  {
    id: 'coa-235',
    number: '235',
    name: 'Current Portion of Long-Term Debt',
    type: 'Liability',
    detail: 'Loan',
    balance: 12000.0,
    taxLine: '—',
    active: true,
    desc: "This year's payments on long-term loans",
  },
  {
    id: 'coa-240',
    number: '240',
    name: 'Unearned Revenue',
    type: 'Liability',
    detail: 'Other current liabilities',
    balance: 38500.0,
    taxLine: '—',
    active: true,
    desc: 'Payments received for services not yet delivered',
  },

  // ─── Long-Term Liabilities (250-299) ───
  {
    id: 'coa-250',
    number: '250',
    name: 'Long-Term Loans',
    type: 'Liability',
    detail: 'Loan',
    balance: 120000.0,
    taxLine: '—',
    active: true,
    desc: 'Bank loans, equipment financing beyond one year',
  },
  {
    id: 'coa-260',
    number: '260',
    name: 'Mortgage Payable',
    type: 'Liability',
    detail: 'Loan',
    balance: 450000.0,
    taxLine: '—',
    active: true,
    desc: 'Property loans',
  },
  {
    id: 'coa-270',
    number: '270',
    name: 'Lease Obligations',
    type: 'Liability',
    detail: 'Other current liabilities',
    balance: 85000.0,
    taxLine: '—',
    active: true,
    desc: 'Long-term lease commitments',
  },

  // ─── Equity (300-399) ───
  {
    id: 'coa-300',
    number: '300',
    name: "Owner's Capital",
    type: 'Equity',
    detail: "Owner's equity",
    balance: 500000.0,
    taxLine: '—',
    active: true,
    desc: 'Original investment in the business',
  },
  {
    id: 'coa-305',
    number: '305',
    name: "Owner's Draw",
    type: 'Equity',
    detail: 'Partner distributions',
    balance: -45000.0,
    taxLine: '—',
    active: true,
    desc: 'Money taken out by the owner (reduces equity)',
  },
  {
    id: 'coa-310',
    number: '310',
    name: 'Retained Earnings',
    type: 'Equity',
    detail: 'Retained earnings',
    balance: 382400.0,
    taxLine: '—',
    active: true,
    desc: 'Accumulated profits kept in the business',
  },
  {
    id: 'coa-320',
    number: '320',
    name: 'Common Stock',
    type: 'Equity',
    detail: "Owner's equity",
    balance: 100000.0,
    taxLine: '—',
    active: true,
    desc: 'Shares issued (for corporations)',
  },
  {
    id: 'coa-330',
    number: '330',
    name: 'Additional Paid-In Capital',
    type: 'Equity',
    detail: "Owner's equity",
    balance: 750000.0,
    taxLine: '—',
    active: true,
    desc: 'Amounts above par value (corporations)',
  },

  // ─── Revenue (400-499) ───
  {
    id: 'coa-400',
    number: '400',
    name: 'Sales Revenue',
    type: 'Income',
    detail: 'Sales of product income',
    balance: 620400.0,
    taxLine: 'Sales',
    active: true,
    desc: 'Income from products sold',
  },
  {
    id: 'coa-410',
    number: '410',
    name: 'Service Revenue',
    type: 'Income',
    detail: 'Sales of services',
    balance: 248500.0,
    taxLine: 'Sales',
    active: true,
    desc: 'Income from services provided',
  },
  {
    id: 'coa-420',
    number: '420',
    name: 'Consulting Revenue',
    type: 'Income',
    detail: 'Sales of services',
    balance: 95000.0,
    taxLine: 'Sales',
    active: true,
    desc: 'Income from consulting work',
  },
  {
    id: 'coa-450',
    number: '450',
    name: 'Interest Income',
    type: 'Income',
    detail: 'Interest income',
    balance: 14250.0,
    taxLine: 'Interest',
    active: true,
    desc: 'Interest earned on bank accounts',
  },
  {
    id: 'coa-460',
    number: '460',
    name: 'Other Income',
    type: 'Income',
    detail: 'Discounts',
    balance: 6400.0,
    taxLine: 'Other Income',
    active: true,
    desc: 'Miscellaneous income sources',
  },
  {
    id: 'coa-490',
    number: '490',
    name: 'Sales Returns and Allowances',
    type: 'Income',
    detail: 'Discounts',
    balance: -8200.0,
    taxLine: 'Sales',
    active: true,
    desc: 'Reduces revenue for returns (contra-revenue)',
  },

  // ─── Cost of Goods Sold (500-519) ───
  {
    id: 'coa-500',
    number: '500',
    name: 'Cost of Goods Sold',
    type: 'Expense',
    detail: 'Cost of goods sold',
    balance: 142800.0,
    taxLine: 'COGS',
    active: true,
    desc: 'Direct costs of products sold',
  },
  {
    id: 'coa-505',
    number: '505',
    name: 'Direct Labor',
    type: 'Expense',
    detail: 'Cost of goods sold',
    balance: 68400.0,
    taxLine: 'COGS',
    active: true,
    desc: 'Labor directly producing goods/services',
  },
  {
    id: 'coa-510',
    number: '510',
    name: 'Materials and Supplies',
    type: 'Expense',
    detail: 'Cost of goods sold',
    balance: 34200.0,
    taxLine: 'COGS',
    active: true,
    desc: 'Raw materials for production',
  },
  {
    id: 'coa-515',
    number: '515',
    name: 'Subcontractor Costs',
    type: 'Expense',
    detail: 'Cost of goods sold',
    balance: 28500.0,
    taxLine: 'COGS',
    active: true,
    desc: 'Outsourced production costs',
  },

  // ─── Operating Expenses (520-599) ───
  {
    id: 'coa-520',
    number: '520',
    name: 'Advertising and Marketing',
    type: 'Expense',
    detail: 'Advertising',
    balance: 42500.0,
    taxLine: 'Advertising',
    active: true,
    desc: 'All marketing costs',
  },
  {
    id: 'coa-530',
    number: '530',
    name: 'Bank Fees and Charges',
    type: 'Expense',
    detail: 'Bank charges & fees',
    balance: 3420.0,
    taxLine: 'Bank fees',
    active: true,
    desc: 'Bank and payment processing fees',
  },
  {
    id: 'coa-540',
    number: '540',
    name: 'Depreciation Expense',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 31000.0,
    taxLine: 'Depreciation',
    active: true,
    desc: 'Annual equipment value reduction',
  },
  {
    id: 'coa-550',
    number: '550',
    name: 'Insurance',
    type: 'Expense',
    detail: 'Insurance',
    balance: 16800.0,
    taxLine: 'Insurance',
    active: true,
    desc: 'Business insurance premiums',
  },
  {
    id: 'coa-560',
    number: '560',
    name: 'Legal and Professional Fees',
    type: 'Expense',
    detail: 'Legal & professional',
    balance: 24500.0,
    taxLine: 'Legal/Prof',
    active: true,
    desc: 'Lawyers, accountants, consultants',
  },
  {
    id: 'coa-570',
    number: '570',
    name: 'Office Supplies',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 4120.0,
    taxLine: 'Office',
    active: true,
    desc: 'Paper, pens, general supplies',
  },
  {
    id: 'coa-580',
    number: '580',
    name: 'Rent Expense',
    type: 'Expense',
    detail: 'Rent or lease',
    balance: 72000.0,
    taxLine: 'Rent',
    active: true,
    desc: 'Office or facility rent',
  },
  {
    id: 'coa-590',
    number: '590',
    name: 'Repairs and Maintenance',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 8600.0,
    taxLine: 'Repairs',
    active: true,
    desc: 'Equipment and facility upkeep',
  },

  // ─── Overhead Costs or Expenses (600-649) ───
  {
    id: 'coa-600',
    number: '600',
    name: 'Software and Subscriptions',
    type: 'Expense',
    detail: 'Software',
    balance: 18450.0,
    taxLine: 'Software',
    active: true,
    desc: 'Business software costs',
  },
  {
    id: 'coa-610',
    number: '610',
    name: 'Telephone and Internet',
    type: 'Expense',
    detail: 'Utilities',
    balance: 4800.0,
    taxLine: 'Utilities',
    active: true,
    desc: 'Communication costs',
  },
  {
    id: 'coa-620',
    number: '620',
    name: 'Travel and Entertainment',
    type: 'Expense',
    detail: 'Travel',
    balance: 14200.0,
    taxLine: 'Travel/Meals',
    active: true,
    desc: 'Business travel expenses',
  },
  {
    id: 'coa-630',
    number: '630',
    name: 'Utilities',
    type: 'Expense',
    detail: 'Utilities',
    balance: 9600.0,
    taxLine: 'Utilities',
    active: true,
    desc: 'Electric, gas, water',
  },
  {
    id: 'coa-640',
    number: '640',
    name: 'Wages and Salaries',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 285000.0,
    taxLine: 'Salaries',
    active: true,
    desc: 'Employee compensation',
  },
  {
    id: 'coa-645',
    number: '645',
    name: 'Payroll Taxes',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 24800.0,
    taxLine: 'Taxes',
    active: true,
    desc: 'Employer portion of payroll taxes',
  },

  // ─── Other Expenses (650-699) ───
  {
    id: 'coa-650',
    number: '650',
    name: 'Interest Expense',
    type: 'Expense',
    detail: 'Bank charges & fees',
    balance: 8900.0,
    taxLine: 'Interest',
    active: true,
    desc: 'Interest on loans and credit',
  },
  {
    id: 'coa-660',
    number: '660',
    name: 'Income Tax Expense',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 46000.0,
    taxLine: 'Taxes',
    active: true,
    desc: 'Federal and state income taxes',
  },
  {
    id: 'coa-670',
    number: '670',
    name: 'Miscellaneous Expense',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 2150.0,
    taxLine: 'Other',
    active: true,
    desc: 'Expenses not fitting other categories',
  },

  // ─── Other Income (700-799) ───
  {
    id: 'coa-710',
    number: '710',
    name: 'Dividend Income',
    type: 'Income',
    detail: 'Interest income',
    balance: 5400.0,
    taxLine: 'Other Income',
    active: true,
    desc: 'Dividends from investments',
  },
  {
    id: 'coa-720',
    number: '720',
    name: 'Gain on Sale of Assets',
    type: 'Income',
    detail: 'Discounts',
    balance: 12000.0,
    taxLine: 'Other Income',
    active: true,
    desc: 'Gains from disposal of fixed assets',
  },

  // ─── Other Expense (800-899) ───
  {
    id: 'coa-810',
    number: '810',
    name: 'Loss on Sale of Assets',
    type: 'Expense',
    detail: 'Office/General Administrative',
    balance: 3500.0,
    taxLine: 'Other Expense',
    active: true,
    desc: 'Losses from disposal of fixed assets',
  },
  {
    id: 'coa-820',
    number: '820',
    name: 'Penalties and Fines',
    type: 'Expense',
    detail: 'Bank charges & fees',
    balance: 0.0,
    taxLine: 'Penalties',
    active: true,
    desc: 'Government or regulatory penalties',
  },
];

const REG_TXNS: Record<string, { date: string; desc: string; amt: number }[]> = {
  'Checking Account': [
    { date: '11/01/2026', desc: 'ACME CORP — Wire Transfer Deposit', amt: 24500.0 },
    { date: '11/03/2026', desc: 'STAPLES #0412 — Office Supplies', amt: -142.5 },
    { date: '11/05/2026', desc: 'FEDEX 001239847 — Freight', amt: -84.2 },
    { date: '11/10/2026', desc: 'STRIPE PAYOUT — Merchant Settlement', amt: 18420.6 },
    { date: '11/18/2026', desc: 'AWS EMEA CHARGES — Cloud Infrastructure', amt: -1240.88 },
    { date: '11/24/2026', desc: 'BLUE RIDGE CO. — Invoice 1042 Settlement', amt: 8540.0 },
  ],
  'Savings Account': [
    { date: '11/01/2026', desc: 'Treasury Yield / Monthly Interest Credit', amt: 3450.0 },
    { date: '10/15/2026', desc: 'Transfer from Checking — Operating Surplus', amt: 50000.0 },
  ],
  'Accounts Receivable': [
    { date: '11/01/2026', desc: 'Invoice 1002 issued to GlobalTech Inc.', amt: 12400.0 },
    { date: '10/28/2026', desc: 'Invoice 1001 issued to Apex Retailers', amt: 34100.0 },
    { date: '10/15/2026', desc: 'Invoice 0998 issued to Vantage Brands', amt: 8900.0 },
  ],
  'Accounts Payable': [
    { date: '11/01/2026', desc: 'Bill PF-9211 — Printful Production Run', amt: -8880.0 },
    { date: '10/28/2026', desc: 'Bill GL-4402 — Gelato Merchandising', amt: -4200.0 },
    { date: '10/15/2026', desc: 'Bill SUP-108 — Direct Materials Supply', amt: -5340.0 },
  ],
  'Credit Card Payable': [
    { date: '11/02/2026', desc: 'Delta Air Lines — Client Onsite Visit', amt: -840.5 },
    { date: '11/04/2026', desc: 'GitHub Enterprise Annual Seat Expansion', amt: -1200.0 },
    { date: '11/06/2026', desc: 'Figma Organization Tier Renewal', amt: -540.0 },
  ],
  'Sales Revenue': [
    { date: '11/01/2026', desc: 'Product Order PO-8902 Fulfillment', amt: 12400.0 },
    { date: '10/30/2026', desc: 'E-commerce Storefront Batch Payout', amt: 28540.0 },
  ],
  'Cost of Goods Sold': [
    { date: '11/01/2026', desc: 'Batch 440 Component Fabrication Run', amt: 14200.0 },
    { date: '10/25/2026', desc: 'Direct Manufacturing Materials Delivery', amt: 18400.0 },
  ],
  'Software and Subscriptions': [
    { date: '11/01/2026', desc: 'Salesforce Enterprise CRM License', amt: 4200.0 },
    { date: '11/03/2026', desc: 'Slack Business+ Workspace Billing', amt: 1850.0 },
  ],
};

export interface ChartOfAccountsScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onToast?: (msg: string) => void;
}

export default function ChartOfAccountsScreen({
  onNavigate,
  onToast,
}: ChartOfAccountsScreenProps) {
  const [accounts, setAccounts] = useState<AccountItem[]>(INITIAL_ACCOUNTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dropdown menus
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [cleanMenuOpen, setCleanMenuOpen] = useState(false);
  const [rowMenuTxId, setRowMenuTxId] = useState<string | null>(null);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });

  // Account Drawer (New / Edit)
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formType, setFormType] = useState<AccountType>('Asset');
  const [formDetail, setFormDetail] = useState('');
  const [formName, setFormName] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTax, setFormTax] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Register Drawer
  const [isRegisterDrawerOpen, setIsRegisterDrawerOpen] = useState(false);
  const [registerAccount, setRegisterAccount] = useState<AccountItem | null>(null);
  const [regTab, setRegTab] = useState<'all' | 'deposits' | 'payments'>('all');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (onToast) onToast(msg);
    setToastMsg(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastMsg(null), 2000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = () => {
      setNewMenuOpen(false);
      setCleanMenuOpen(false);
      setRowMenuTxId(null);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          a.name.toLowerCase().includes(q) ||
          a.number.includes(q) ||
          (a.desc && a.desc.toLowerCase().includes(q)) ||
          a.detail.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [accounts, typeFilter, searchQuery]);

  // Bulk selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Open Drawer for Create
  const handleOpenCreateDrawer = (typePreset?: AccountType) => {
    setEditingAccountId(null);
    const chosenType = typePreset || 'Asset';
    setFormType(chosenType);
    setFormDetail(DETAIL_TYPES[chosenType][0] || '');
    setFormName('');
    setFormNumber(`${Math.floor(1000 + Math.random() * 8900)}`);
    setFormDesc('');
    setFormTax('');
    setFormActive(true);
    setIsAccountDrawerOpen(true);
  };

  // Open Drawer for Edit
  const handleOpenEditDrawer = (acc: AccountItem) => {
    setEditingAccountId(acc.id);
    setFormType(acc.type);
    setFormDetail(acc.detail);
    setFormName(acc.name);
    setFormNumber(acc.number);
    setFormDesc(acc.desc || '');
    setFormTax(acc.taxLine !== '—' ? acc.taxLine : '');
    setFormActive(acc.active);
    setIsAccountDrawerOpen(true);
  };

  // Save Account
  const handleSaveAccount = (andClose: boolean) => {
    if (!formName.trim()) {
      showToast('Account name is required');
      return;
    }
    if (!formNumber.trim()) {
      showToast('Account number is required');
      return;
    }

    if (editingAccountId) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccountId
            ? {
                ...a,
                name: formName.trim(),
                number: formNumber.trim(),
                type: formType,
                detail: formDetail,
                taxLine: formTax || '—',
                active: formActive,
                desc: formDesc,
              }
            : a
        )
      );
      showToast(`Account "${formName}" updated`);
    } else {
      const created: AccountItem = {
        id: `coa-${Date.now()}`,
        number: formNumber.trim(),
        name: formName.trim(),
        type: formType,
        detail: formDetail,
        balance: 0,
        taxLine: formTax || '—',
        active: formActive,
        desc: formDesc,
      };
      setAccounts((prev) => [created, ...prev]);
      showToast(`Account "${formName}" created`);
    }

    if (andClose) {
      setIsAccountDrawerOpen(false);
    } else {
      handleOpenCreateDrawer(formType);
    }
  };

  // Open Register
  const handleOpenRegister = (acc: AccountItem) => {
    setRegisterAccount(acc);
    setRegTab('all');
    setIsRegisterDrawerOpen(true);
  };

  const getDotClass = (type: AccountType) => {
    switch (type) {
      case 'Asset':
        return styles.dotAsset;
      case 'Liability':
        return styles.dotLiability;
      case 'Equity':
        return styles.dotEquity;
      case 'Income':
        return styles.dotIncome;
      case 'Expense':
        return styles.dotExpense;
    }
  };

  return (
    <div className={styles.container}>
      {/* ═══════════ CONTEXT HEADER ═══════════ */}
      <div className={styles.contextHeader}>
        <div className={styles.breadcrumbsGroup}>
          <span className={`material-symbols-outlined ${styles.breadcrumbDomainIcon}`}>
            account_balance
          </span>
          <span className={styles.breadcrumbDomain}>Finance</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbSection}>Accounting</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbActive}>Chart of accounts</span>
        </div>
      </div>

      <main className={styles.main}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Chart of accounts</h1>
            <p className={styles.pageSubtitle}>
              {accounts.length} accounts · Numbered, typed, mapped to tax lines.
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.splitBtn}>
              <button
                type="button"
                className={styles.splitBtnMain}
                onClick={() => handleOpenCreateDrawer()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  add
                </span>
                New account
              </button>
              <button
                type="button"
                className={styles.splitBtnArrow}
                onClick={(e) => {
                  e.stopPropagation();
                  setNewMenuOpen((prev) => !prev);
                  setCleanMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  expand_more
                </span>
              </button>

              {newMenuOpen && (
                <div className={styles.menu} style={{ top: 38, right: 0 }}>
                  <div className={styles.menuHeader}>Quick create</div>
                  {(['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as AccountType[]).map(
                    (k) => (
                      <button
                        key={k}
                        type="button"
                        className={styles.menuItem}
                        onClick={() => {
                          setNewMenuOpen(false);
                          handleOpenCreateDrawer(k);
                        }}
                      >
                        <span className={`material-symbols-outlined`}>
                          {k === 'Asset'
                            ? 'account_balance'
                            : k === 'Liability'
                            ? 'credit_card'
                            : k === 'Equity'
                            ? 'savings'
                            : k === 'Income'
                            ? 'trending_up'
                            : 'receipt_long'}
                        </span>
                        {k} account
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => onNavigate('finance', 'quick-view')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                assessment
              </span>
              Run report
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchInputWrap}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>
              search
            </span>
            <input
              className={styles.searchInput}
              placeholder="Filter by name or number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <label className={styles.typeFilterLabel}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, color: '#5a6355' }}
            >
              category
            </span>
            <span style={{ color: '#5a6355' }}>Type:</span>
            <select
              className={styles.typeFilterSelect}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </label>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={(e) => {
                e.stopPropagation();
                setCleanMenuOpen((prev) => !prev);
                setNewMenuOpen(false);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                cleaning_services
              </span>
              Clean up
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                expand_more
              </span>
            </button>

            {cleanMenuOpen && (
              <div className={styles.menu} style={{ top: 36, left: 0 }}>
                <div className={styles.menuHeader}>Clean up</div>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setCleanMenuOpen(false);
                    showToast('Cleanup session started — inactive accounts and duplicates flagged');
                  }}
                >
                  <span className="material-symbols-outlined">cleaning_services</span>
                  Start cleanup session
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setCleanMenuOpen(false);
                    setEditMode(true);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                  Open in edit mode
                </button>
                <div className={styles.menuSep} />
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setCleanMenuOpen(false);
                    showToast('Cleanup history: 3 accounts merged, 1 archived');
                  }}
                >
                  <span className="material-symbols-outlined">history</span>
                  View cleanup history
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            className={`${styles.toolbarBtn} ${editMode ? styles.toolbarBtnActive : ''}`}
            onClick={() => setEditMode((prev) => !prev)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              edit
            </span>
            Edit mode
          </button>

          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() => showToast('Customize columns panel')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              tune
            </span>
            Customize
          </button>
        </div>

        {/* Edit-mode banner */}
        {editMode && (
          <div className={styles.editBanner}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              edit
            </span>
            <span style={{ flex: 1 }}>
              Edit mode on — click any cell to edit inline. Press Esc to cancel a cell.
            </span>
            <button
              type="button"
              className={styles.editBannerBtn}
              onClick={() => {
                setEditMode(false);
                showToast('Inline changes saved');
              }}
            >
              Save changes
            </button>
          </div>
        )}

        {/* Table Card */}
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th style={{ width: 36, paddingLeft: 12 }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredAccounts.length > 0 &&
                      selectedIds.size === filteredAccounts.length
                    }
                    onChange={handleSelectAll}
                    style={{ accentColor: '#0077c5' }}
                  />
                </th>
                <th style={{ width: 80 }}>Number</th>
                <th>Name</th>
                <th>Type</th>
                <th>Detail type</th>
                <th style={{ textAlign: 'right' }}>Total balance</th>
                <th style={{ textAlign: 'right' }}>Bank balance</th>
                <th>Tax line</th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => {
                const isSelected = selectedIds.has(acc.id);

                return (
                  <tr
                    key={acc.id}
                    className={`${styles.row} ${!acc.active ? styles.rowInactive : ''}`}
                    onClick={() => {
                      if (!editMode) handleOpenRegister(acc);
                    }}
                  >
                    <td
                      className={styles.td}
                      style={{ width: 36, paddingLeft: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(acc.id)}
                        style={{ accentColor: '#0077c5' }}
                      />
                    </td>

                    {/* Number */}
                    <td className={styles.td} style={{ fontFamily: 'monospace' }}>
                      {editMode ? (
                        <input
                          className={styles.inlineInput}
                          value={acc.number}
                          onChange={(e) =>
                            setAccounts((prev) =>
                              prev.map((a) =>
                                a.id === acc.id ? { ...a, number: e.target.value } : a
                              )
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        acc.number
                      )}
                    </td>

                    {/* Name */}
                    <td className={styles.td} style={{ fontWeight: 500 }}>
                      {editMode ? (
                        <input
                          className={styles.inlineInput}
                          value={acc.name}
                          onChange={(e) =>
                            setAccounts((prev) =>
                              prev.map((a) =>
                                a.id === acc.id ? { ...a, name: e.target.value } : a
                              )
                            )
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div>
                          <div style={{ color: '#1c1d1f' }}>{acc.name}</div>
                          {acc.desc && (
                            <div style={{ fontSize: 11, color: '#72796e', fontWeight: 400, marginTop: 2 }}>
                              {acc.desc}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className={styles.td}>
                      <span className={`${styles.typeDot} ${getDotClass(acc.type)}`} />
                      {acc.type}
                    </td>

                    {/* Detail Type */}
                    <td className={styles.td} style={{ color: '#5a6355' }}>
                      {acc.detail}
                    </td>

                    {/* Total balance */}
                    <td
                      className={styles.td}
                      style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                    >
                      ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Bank balance */}
                    <td
                      className={styles.td}
                      style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#5a6355' }}
                    >
                      {acc.bankBalance !== undefined
                        ? `$${acc.bankBalance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}`
                        : '—'}
                    </td>

                    {/* Tax line */}
                    <td className={styles.td} style={{ color: '#5a6355' }}>
                      {acc.taxLine}
                    </td>

                    {/* Action */}
                    <td
                      className={styles.td}
                      style={{ textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className={styles.toolbarBtn}
                        style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setRowMenuPos({
                            top: rect.bottom + 4,
                            left: Math.min(rect.right - 240, window.innerWidth - 260),
                          });
                          setRowMenuTxId(rowMenuTxId === acc.id ? null : acc.id);
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          more_horiz
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Row Action Menu */}
      {rowMenuTxId && (
        <div
          className={styles.menu}
          style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.menuHeader}>This account</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              const acc = accounts.find((a) => a.id === rowMenuTxId);
              if (acc) handleOpenRegister(acc);
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            View register
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              const acc = accounts.find((a) => a.id === rowMenuTxId);
              if (acc) handleOpenEditDrawer(acc);
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">edit</span>
            Edit account
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              showToast('Running report for this account…');
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">assessment</span>
            Run report for this account
          </button>
          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>Structure</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              showToast('Make sub-account of… — opens parent picker');
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">subdirectory_arrow_right</span>
            Make sub-account of…
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              showToast('Merge into another account');
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">merge</span>
            Merge into another account…
          </button>
          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>State</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setAccounts((prev) =>
                prev.map((a) => (a.id === rowMenuTxId ? { ...a, active: !a.active } : a))
              );
              showToast('Account status updated');
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">visibility_off</span>
            Toggle active/inactive
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => {
              setAccounts((prev) => prev.filter((a) => a.id !== rowMenuTxId));
              showToast('Account deleted');
              setRowMenuTxId(null);
            }}
          >
            <span className="material-symbols-outlined">delete</span>
            Delete account
          </button>
        </div>
      )}

      {/* ═══════════ ACCOUNT DRAWER ═══════════ */}
      <div
        className={`${styles.drawerScrim} ${isAccountDrawerOpen ? styles.drawerScrimOpen : ''}`}
        onClick={() => setIsAccountDrawerOpen(false)}
      />
      <aside
        className={`${styles.drawer} ${styles.accountDrawer} ${
          isAccountDrawerOpen ? styles.drawerOpen : ''
        }`}
      >
        <div className={styles.drawerHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#0a6400', fontSize: 20 }}>
              account_tree
            </span>
            <div>
              <h2 className={styles.drawerTitle}>
                {editingAccountId ? 'Edit account' : 'New account'}
              </h2>
              <div style={{ fontSize: 11, color: '#5a6355' }}>Chart of accounts</div>
            </div>
          </div>
          <button
            type="button"
            className={styles.toolbarBtn}
            style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
            onClick={() => setIsAccountDrawerOpen(false)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className={styles.fieldLabel}>Type</label>
              <select
                className={styles.fieldInput}
                value={formType}
                onChange={(e) => {
                  const t = e.target.value as AccountType;
                  setFormType(t);
                  setFormDetail(DETAIL_TYPES[t][0] || '');
                }}
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
            <div>
              <label className={styles.fieldLabel}>Detail type</label>
              <select
                className={styles.fieldInput}
                value={formDetail}
                onChange={(e) => setFormDetail(e.target.value)}
              >
                {DETAIL_TYPES[formType].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className={styles.fieldLabel}>Name</label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. Business checking"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <label className={styles.fieldLabel}>Number</label>
              <input
                className={styles.fieldInput}
                placeholder="e.g. 1000"
                value={formNumber}
                onChange={(e) => setFormNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={styles.fieldLabel}>Sub-account of</label>
            <select className={styles.fieldInput} defaultValue="">
              <option value="">— None (top-level account) —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              className={styles.fieldInput}
              style={{ height: 60, padding: '8px 10px', resize: 'vertical' }}
              placeholder="Optional description visible to staff"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>

          <div style={{ borderTop: '1px solid #eeedf1', paddingTop: 16 }}>
            <label className={styles.fieldLabel}>Tax line</label>
            <select
              className={styles.fieldInput}
              value={formTax}
              onChange={(e) => setFormTax(e.target.value)}
            >
              <option value="">— Not mapped —</option>
              <option value="Sales">Sales</option>
              <option value="COGS">COGS</option>
              <option value="Office">Office</option>
              <option value="Software">Software</option>
              <option value="Travel">Travel</option>
              <option value="Meals">Meals</option>
              <option value="Advertising">Advertising</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid #eeedf1', paddingTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                style={{ accentColor: '#0077c5' }}
              />
              Active account
            </label>
            <p style={{ fontSize: 11, color: '#5a6355', margin: '4px 0 0 0' }}>
              Inactive accounts are hidden from pickers but remain in reports.
            </p>
          </div>
        </div>

        <div className={styles.drawerFooter}>
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={() => setIsAccountDrawerOpen(false)}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => handleSaveAccount(false)}
            >
              Save and new
            </button>
            <button
              type="button"
              className={styles.splitBtnMain}
              onClick={() => handleSaveAccount(true)}
            >
              Save account
            </button>
          </div>
        </div>
      </aside>

      {/* ═══════════ REGISTER DRAWER ═══════════ */}
      <div
        className={`${styles.drawerScrim} ${isRegisterDrawerOpen ? styles.drawerScrimOpen : ''}`}
        onClick={() => setIsRegisterDrawerOpen(false)}
      />
      <aside
        className={`${styles.drawer} ${styles.registerDrawer} ${
          isRegisterDrawerOpen ? styles.drawerOpen : ''
        }`}
      >
        <div className={styles.drawerHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ color: '#0a6400', fontSize: 20 }}>
              receipt_long
            </span>
            <div>
              <h2 className={styles.drawerTitle}>{registerAccount?.name || 'Register'}</h2>
              <div style={{ fontSize: 11, color: '#5a6355' }}>
                Account {registerAccount?.number} · {registerAccount?.type}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => showToast('Date range filter')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                calendar_today
              </span>
              Nov 2026
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={() => {
                const cols = [
                  { key: 'number', label: 'Account #' },
                  { key: 'name', label: 'Account name' },
                  { key: 'type', label: 'Type' },
                  { key: 'detail', label: 'Detail type' },
                  { key: 'balance', label: 'Balance' },
                  { key: 'taxLine', label: 'Tax line' },
                  { key: 'active', label: 'Active' },
                ];
                exportToCsv(filteredAccounts as unknown as Record<string, unknown>[], cols, 'chart-of-accounts');
                showToast(`Exported ${filteredAccounts.length} records to CSV`);
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                download
              </span>
              Export
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
              onClick={() => setIsRegisterDrawerOpen(false)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                close
              </span>
            </button>
          </div>
        </div>

        {/* Register Summary Strip */}
        <div className={styles.registerSummaryStrip}>
          <div>
            <div className={styles.regStripLabel}>Opening balance</div>
            <div className={styles.regStripVal}>
              ${Math.max(0, (registerAccount?.balance || 0) - 3000).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className={styles.regStripLabel}>Period activity</div>
            <div className={styles.regStripVal}>
              ${(registerAccount?.balance || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <div>
            <div className={styles.regStripLabel}>Closing balance</div>
            <div className={styles.regStripVal}>
              ${(registerAccount?.balance || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Register Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 20px',
            borderBottom: '1px solid #dad9dd',
            height: 40,
            alignItems: 'center',
          }}
        >
          {(['all', 'deposits', 'payments'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`${styles.toolbarBtn} ${regTab === tab ? styles.toolbarBtnActive : ''}`}
              style={{ border: 'none', background: 'transparent' }}
              onClick={() => setRegTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Register List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(() => {
            const defaultTxns = registerAccount?.balance
              ? [
                  {
                    date: '10/01/2026',
                    desc: 'Beginning Fiscal Year Balance',
                    amt: +(registerAccount.balance * 0.7).toFixed(2),
                  },
                  {
                    date: '10/20/2026',
                    desc: 'Prior Period Activity / Ledger Posting',
                    amt: +(registerAccount.balance * 0.15).toFixed(2),
                  },
                  {
                    date: '11/02/2026',
                    desc: 'Current Month Activity',
                    amt: +(registerAccount.balance * 0.15).toFixed(2),
                  },
                ]
              : [];
            const txns = REG_TXNS[registerAccount?.name || ''] || defaultTxns;
            const filtered = txns.filter((t) => {
              if (regTab === 'deposits') return t.amt >= 0;
              if (regTab === 'payments') return t.amt < 0;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div style={{ padding: 40, textAlign: 'center', color: '#5a6355', fontSize: 13 }}>
                  No transactions in this account for the selected period.
                </div>
              );
            }

            let running = Math.max(0, (registerAccount?.balance || 0) - 3000);
            return filtered.map((t, idx) => {
              running += t.amt;
              const isDep = t.amt >= 0;
              return (
                <div key={idx} className={styles.regRow}>
                  <span className={styles.regDate}>{t.date}</span>
                  <span className={styles.regDesc}>{t.desc}</span>
                  <span
                    className={styles.regAmt}
                    style={{ color: isDep ? '#006c47' : '#ba1a1a' }}
                  >
                    {isDep ? '+' : '−'}$
                    {Math.abs(t.amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={styles.regBal}>
                    ${running.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      </aside>

      {/* Toast */}
      {toastMsg && (
        <div className={styles.toast}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            check_circle
          </span>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
