'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DomainKey } from '@/data/shellData';
import styles from './ReceiptsScreen.module.css';

export interface ReceiptItem {
  id: string;
  vendor: string;
  amount: string;
  tax: string;
  date: string;
  account: string;
  category: string;
  status: 'review' | 'reviewed';
  actionLabel?: string;
  isProcessing?: boolean;
  notes?: string;
}

const INITIAL_RECEIPTS: ReceiptItem[] = [
  {
    id: 'R-1042',
    vendor: 'Staples',
    amount: '$142.50',
    tax: '$8.55',
    date: '10/30/2026',
    account: 'Visa •4421',
    category: 'Office supplies',
    status: 'review',
    notes: 'Quarterly office inventory replenish',
  },
  {
    id: 'R-1041',
    vendor: 'FedEx',
    amount: '$84.20',
    tax: '$5.05',
    date: '10/29/2026',
    account: 'Bank •9910',
    category: '',
    status: 'review',
    notes: 'Priority overnight shipment',
  },
  {
    id: 'R-1040',
    vendor: 'Adobe',
    amount: '$59.99',
    tax: '$3.60',
    date: '10/30/2026',
    account: 'Visa •4421',
    category: 'Software',
    status: 'review',
    notes: 'Creative Cloud single app license',
  },
  {
    id: 'R-1039',
    vendor: 'UPS',
    amount: '$62.10',
    tax: '$3.73',
    date: '10/26/2026',
    account: 'Amex •2103',
    category: 'Shipping',
    status: 'reviewed',
    actionLabel: 'Reviewed',
  },
  {
    id: 'R-1038',
    vendor: 'Google Workspace',
    amount: '$144.00',
    tax: '$0.00',
    date: '10/25/2026',
    account: 'Visa •4421',
    category: 'Software',
    status: 'reviewed',
    actionLabel: 'Reviewed',
  },
];

const UNMATCHED_BANK_TRANSACTIONS = [
  {
    name: 'FEDEX 001239847',
    date: '10/29/2026 · Bank •9910',
    amt: '−$84.20',
    isBank: true,
  },
  {
    name: 'STAPLES #0412',
    date: '10/30/2026 · Bank •9910',
    amt: '−$142.50',
    isBank: true,
  },
  {
    name: 'AWS EMEA CHARGES',
    date: '10/27/2026 · Visa •4421',
    amt: '−$124.88',
    isBank: true,
  },
];

const OPEN_BILLS = [
  {
    name: 'Bill PF-9211 · Printful',
    date: 'Due 11/10/2026',
    amt: '$2,880.00',
    isBank: false,
  },
];

export interface ReceiptsScreenProps {
  onNavigate: (domain: DomainKey, screenId: string) => void;
  onCreateExpense?: () => void;
  onOpenPeek?: (title: string, details: Record<string, string | number>) => void;
  onToast?: (msg: string) => void;
}

export default function ReceiptsScreen({
  onToast,
}: ReceiptsScreenProps) {
  const [receipts, setReceipts] = useState<ReceiptItem[]>(INITIAL_RECEIPTS);
  const [activeTab, setActiveTab] = useState<'review' | 'reviewed' | 'all'>('review');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragover, setIsDragover] = useState(false);
  const [copyConfirmed, setCopyConfirmed] = useState(false);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptItem | null>(null);
  const [drawerForm, setDrawerForm] = useState({
    vendor: '',
    date: '',
    amount: '',
    tax: '',
    account: 'Visa •4421',
    category: '',
    notes: '',
  });

  // Floating menus state
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [catPickerPos, setCatPickerPos] = useState({ top: 0, left: 0 });
  const [catPickerTargetId, setCatPickerTargetId] = useState<string | null>(null);

  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });
  const [rowMenuTargetId, setRowMenuTargetId] = useState<string | null>(null);

  const [matchMenuOpen, setMatchMenuOpen] = useState(false);
  const [matchMenuPos, setMatchMenuPos] = useState({ top: 0, left: 0 });

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(1050);

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
      setCatPickerOpen(false);
      setRowMenuOpen(false);
      setMatchMenuOpen(false);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  // Copy forwarding address
  const handleCopyForwarding = async () => {
    const val = 'receipts@managekube.unsaid.app';
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(val);
    }
    setCopyConfirmed(true);
    showToast('Forwarding address copied to clipboard');
    setTimeout(() => setCopyConfirmed(false), 2000);
  };

  // Open Receipt Drawer
  const handleOpenReceipt = (rec: ReceiptItem) => {
    setActiveReceipt(rec);
    setDrawerForm({
      vendor: rec.vendor,
      date: rec.date.includes('/')
        ? (() => {
            const parts = rec.date.split('/');
            return parts.length === 3
              ? `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
              : rec.date;
          })()
        : rec.date,
      amount: rec.amount,
      tax: rec.tax,
      account: rec.account || 'Visa •4421',
      category: rec.category,
      notes: rec.notes || '',
    });
    setIsDrawerOpen(true);
  };

  const handleCloseReceipt = () => {
    setIsDrawerOpen(false);
    setActiveReceipt(null);
  };

  // Filtered receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (activeTab === 'review' && r.status !== 'review') return false;
      if (activeTab === 'reviewed' && r.status !== 'reviewed') return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          r.vendor.toLowerCase().includes(q) ||
          r.amount.toLowerCase().includes(q) ||
          r.account.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [receipts, activeTab, searchQuery]);

  const reviewCount = useMemo(() => {
    return receipts.filter((r) => r.status === 'review').length;
  }, [receipts]);

  // Bulk selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredReceipts.map((r) => r.id)));
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

  // Bulk actions
  const handleBulkAction = (act: string) => {
    if (act === 'close') {
      setSelectedIds(new Set());
      return;
    }
    const count = selectedIds.size;
    if (act === 'delete') {
      setReceipts((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      showToast(`Deleted ${count} receipt${count !== 1 ? 's' : ''}`);
      return;
    }
    if (act === 'create') {
      setReceipts((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, status: 'reviewed', actionLabel: 'Expense created' }
            : r
        )
      );
      setSelectedIds(new Set());
      showToast(`Created expenses for ${count} receipt${count !== 1 ? 's' : ''}`);
      return;
    }
    showToast(`${act.charAt(0).toUpperCase() + act.slice(1)} on ${count} receipt${count !== 1 ? 's' : ''}`);
  };

  // Add processing row & simulate OCR extraction
  const processFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    files.forEach((file, idx) => {
      counterRef.current += 1;
      const curIdNum = counterRef.current;
      const newId = `R-${curIdNum}`;
      const fakeVendors = [
        'Staples',
        'FedEx',
        'Adobe',
        'Amazon Web Services',
        'Google Workspace',
        'UPS',
      ];
      const vendorGuess = fakeVendors[curIdNum % fakeVendors.length];
      const baseAmt = 35 + (curIdNum * 19) % 150;
      const amountGuess = `$${baseAmt.toFixed(2)}`;
      const taxGuess = `$${(baseAmt * 0.06).toFixed(2)}`;
      const dateGuess = '11/04/2026';

      const tempRow: ReceiptItem = {
        id: newId,
        vendor: 'Extracting…',
        amount: '…',
        tax: '…',
        date: dateGuess,
        account: file.name,
        category: '',
        status: 'review',
        isProcessing: true,
      };

      setReceipts((prev) => [tempRow, ...prev]);

      setTimeout(() => {
        const resolvedRow: ReceiptItem = {
          id: newId,
          vendor: vendorGuess,
          amount: amountGuess,
          tax: taxGuess,
          date: dateGuess,
          account: 'Visa •4421',
          category: curIdNum % 2 === 0 ? 'Office supplies' : 'Software',
          status: 'review',
          isProcessing: false,
          notes: `Uploaded file: ${file.name}`,
        };

        setReceipts((prev) =>
          prev.map((r) => (r.id === newId ? resolvedRow : r))
        );
        showToast(`${vendorGuess} receipt extracted from ${file.name}`);
        handleOpenReceipt(resolvedRow);
      }, 1100 + idx * 300);
    });
  };

  // Category picker selection
  const handlePickCategory = (cat: string) => {
    if (catPickerTargetId) {
      setReceipts((prev) =>
        prev.map((r) => (r.id === catPickerTargetId ? { ...r, category: cat } : r))
      );
      showToast(`Category updated to "${cat}"`);
    }
    setCatPickerOpen(false);
  };

  // Match menu selection
  const handleSelectMatch = (matchName: string) => {
    const targetId = rowMenuTargetId || activeReceipt?.id;
    if (targetId) {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === targetId
            ? { ...r, status: 'reviewed', actionLabel: 'Matched' }
            : r
        )
      );
      showToast(`Receipt matched to "${matchName}"`);
    }
    setMatchMenuOpen(false);
    setRowMenuOpen(false);
    setIsDrawerOpen(false);
  };

  // Row menu actions
  const handleRowMenuAction = (action: string) => {
    const rec = receipts.find((r) => r.id === rowMenuTargetId);
    setRowMenuOpen(false);
    if (!rec) return;

    switch (action) {
      case 'view':
      case 'edit':
        handleOpenReceipt(rec);
        break;
      case 'download':
        showToast('Download original receipt PDF/JPG');
        break;
      case 'create-expense':
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === rec.id
              ? { ...r, status: 'reviewed', actionLabel: 'Expense created' }
              : r
          )
        );
        showToast('Expense created from receipt');
        break;
      case 'create-bill':
        showToast('Bill created from receipt');
        break;
      case 'attach':
        showToast('Attach to existing — opens bill picker');
        break;
      case 'match':
        setMatchMenuOpen(true);
        break;
      case 'mark-reviewed':
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === rec.id
              ? { ...r, status: 'reviewed', actionLabel: 'Reviewed' }
              : r
          )
        );
        showToast('Marked as reviewed');
        break;
      case 'unmark-reviewed':
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === rec.id
              ? { ...r, status: 'review', actionLabel: undefined }
              : r
          )
        );
        showToast('Moved back to review');
        break;
      case 'delete':
        setReceipts((prev) => prev.filter((r) => r.id !== rec.id));
        showToast('Receipt deleted');
        break;
    }
  };

  // Drawer create expense
  const handleDrawerCreateExpense = () => {
    if (activeReceipt) {
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === activeReceipt.id
            ? {
                ...r,
                vendor: drawerForm.vendor,
                amount: drawerForm.amount,
                tax: drawerForm.tax,
                account: drawerForm.account,
                category: drawerForm.category,
                notes: drawerForm.notes,
                status: 'reviewed',
                actionLabel: 'Expense created',
              }
            : r
        )
      );
      showToast('Expense created from receipt');
      setIsDrawerOpen(false);
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
          <span className={styles.breadcrumbActive}>Receipts</span>
        </div>
        <div className={styles.contextTag}>Preview · standalone</div>
      </div>

      <main className={styles.main}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Receipts</h1>
            <p className={styles.pageSubtitle}>
              Intake inbox — forward, drop, snap. Extracted fields auto-fill.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => uploadInputRef.current?.click()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                upload
              </span>
              Upload
            </button>
            <button
              type="button"
              className={styles.headerBtn}
              onClick={() => snapInputRef.current?.click()}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                photo_camera
              </span>
              Snap photo
            </button>
          </div>
        </div>

        {/* Forwarding address + drop zone */}
        <div className={styles.intakeGrid}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${isDragover ? styles.dropZoneDragover : ''}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragover(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragover(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragover(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragover(false);
              processFiles(e.dataTransfer.files);
            }}
            onClick={() => uploadInputRef.current?.click()}
          >
            <span className={`material-symbols-outlined ${styles.dropIcon}`}>
              cloud_upload
            </span>
            <div className={styles.dropTitle}>Drop receipts here</div>
            <div className={styles.dropSubtitle}>
              PDF, JPG, PNG · up to 20 MB each · multiple files supported
            </div>
            <div className={styles.dropBtns} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={styles.btnPrimaryGreen}
                onClick={() => uploadInputRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  upload_file
                </span>
                Choose files
              </button>
              <button
                type="button"
                className={styles.btnSecondaryOutline}
                onClick={() => snapInputRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  photo_camera
                </span>
                Snap
              </button>
            </div>
          </div>

          {/* Forward by email card */}
          <div className={styles.fwdCard}>
            <div className={styles.fwdHeader}>
              <span className={`material-symbols-outlined ${styles.fwdHeaderIcon}`}>
                mail
              </span>
              <span className={styles.fwdHeaderTitle}>Forward by email</span>
            </div>
            <p className={styles.fwdDesc}>
              Send receipts to this address — they&apos;ll appear here for review.
            </p>
            <div className={styles.fwdInputRow}>
              <input
                readOnly
                className={styles.fwdInput}
                value="receipts@managekube.unsaid.app"
              />
              <button
                type="button"
                className={styles.fwdCopyBtn}
                onClick={handleCopyForwarding}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  content_copy
                </span>
                Copy
              </button>
            </div>
            {copyConfirmed && (
              <div className={styles.fwdCopiedBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  check_circle
                </span>
                Copied to clipboard
              </div>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className={styles.tableCard}>
          {/* Tabs */}
          <div className={styles.tabsBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'review' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('review')}
            >
              For review
              <span className={styles.tabCountBadge}>{reviewCount}</span>
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'reviewed' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('reviewed')}
            >
              Reviewed
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All
            </button>
          </div>

          {/* Filter bar */}
          <div className={styles.filterBar}>
            <div className={styles.searchWrap}>
              <span className={`material-symbols-outlined ${styles.searchIcon}`}>
                search
              </span>
              <input
                className={styles.searchInput}
                placeholder="Filter by vendor, amount…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => showToast('Date range filter')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                calendar_today
              </span>
              Date range
            </button>
            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => showToast('Saved views panel')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                bookmark
              </span>
              Saved views
            </button>
            <span className={styles.countText}>
              1–{filteredReceipts.length} of {receipts.length}
            </span>
          </div>

          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selectedIds.size} selected</span>
              <span className={styles.bulkSep} />
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={() => handleBulkAction('categorize')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, marginRight: 4 }}
                >
                  category
                </span>
                Categorize
              </button>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={() => handleBulkAction('attach')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, marginRight: 4 }}
                >
                  attach_file
                </span>
                Attach to bill
              </button>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={() => handleBulkAction('create')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, marginRight: 4 }}
                >
                  receipt_long
                </span>
                Create expenses
              </button>
              <span className={styles.bulkSep} />
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={() => handleBulkAction('delete')}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 14, marginRight: 4 }}
                >
                  delete
                </span>
                Delete
              </button>
              <button
                type="button"
                className={styles.bulkCloseBtn}
                onClick={() => handleBulkAction('close')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          )}

          {/* Table */}
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} style={{ width: 36, paddingLeft: 12 }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredReceipts.length > 0 &&
                      selectedIds.size === filteredReceipts.length
                    }
                    onChange={handleSelectAll}
                    style={{ accentColor: '#0077c5' }}
                  />
                </th>
                <th className={styles.th} style={{ width: 48 }}>
                  Receipt
                </th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Vendor</th>
                <th className={styles.th}>Payment account</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>
                  Amount / Tax
                </th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Action</th>
                <th className={styles.th} style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {filteredReceipts.map((rec) => {
                const isSelected = selectedIds.has(rec.id);
                return (
                  <tr
                    key={rec.id}
                    className={`${styles.row} ${rec.isProcessing ? styles.processingRow : ''}`}
                    onClick={() => {
                      if (!rec.isProcessing) handleOpenReceipt(rec);
                    }}
                  >
                    <td
                      className={styles.td}
                      style={{ width: 36, paddingLeft: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        disabled={rec.isProcessing}
                        checked={isSelected}
                        onChange={() => handleToggleRow(rec.id)}
                        style={{ accentColor: '#0077c5' }}
                      />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.receiptThumb}>
                        {rec.isProcessing && <div className={styles.spinner} />}
                      </div>
                    </td>
                    <td className={styles.td}>{rec.date}</td>
                    <td
                      className={styles.td}
                      style={{
                        fontWeight: rec.isProcessing ? 400 : 500,
                        fontStyle: rec.isProcessing ? 'italic' : 'normal',
                        color: rec.isProcessing ? '#5a6355' : '#1a1c1e',
                      }}
                    >
                      {rec.vendor}
                    </td>
                    <td className={styles.td} style={{ color: '#5a6355' }}>
                      {rec.account}
                    </td>
                    <td
                      className={styles.td}
                      style={{
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <div>{rec.amount}</div>
                      {!rec.isProcessing && (
                        <div style={{ fontSize: 10, color: '#5a6355' }}>
                          Tax {rec.tax}
                        </div>
                      )}
                    </td>
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      {rec.isProcessing ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#5a6355',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <div
                            className={styles.spinner}
                            style={{ width: 12, height: 12 }}
                          />
                          Processing
                        </span>
                      ) : rec.category ? (
                        <button
                          type="button"
                          className={`${styles.catChip} ${
                            rec.status === 'reviewed'
                              ? styles.catChipDone
                              : styles.catChipSuggested
                          }`}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCatPickerPos({
                              top: rect.bottom + 4,
                              left: Math.min(rect.left, window.innerWidth - 300),
                            });
                            setCatPickerTargetId(rec.id);
                            setCatPickerOpen(true);
                            setRowMenuOpen(false);
                            setMatchMenuOpen(false);
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 12 }}
                          >
                            {rec.status === 'reviewed' ? 'check_circle' : 'auto_awesome'}
                          </span>
                          {rec.category}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.catChip} ${styles.catChipUncat}`}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setCatPickerPos({
                              top: rect.bottom + 4,
                              left: Math.min(rect.left, window.innerWidth - 300),
                            });
                            setCatPickerTargetId(rec.id);
                            setCatPickerOpen(true);
                            setRowMenuOpen(false);
                            setMatchMenuOpen(false);
                          }}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 12 }}
                          >
                            error
                          </span>
                          Needs category
                        </button>
                      )}
                    </td>
                    <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                      {rec.isProcessing ? (
                        <span style={{ fontSize: 11, color: '#5a6355' }}>—</span>
                      ) : rec.status === 'review' ? (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleOpenReceipt(rec)}
                        >
                          Review
                        </button>
                      ) : (
                        <span className={styles.reviewedBadge}>
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: 14 }}
                          >
                            check
                          </span>
                          {rec.actionLabel || 'Reviewed'}
                        </span>
                      )}
                    </td>
                    <td
                      className={styles.td}
                      style={{ textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={rec.isProcessing}
                        className={styles.moreBtn}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setRowMenuPos({
                            top: rect.bottom + 4,
                            left: Math.min(rect.right - 250, window.innerWidth - 270),
                          });
                          setRowMenuTargetId(rec.id);
                          setRowMenuOpen(true);
                          setCatPickerOpen(false);
                          setMatchMenuOpen(false);
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16 }}
                        >
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

      {/* Hidden real file pickers */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          processFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={snapInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          processFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* ═══════════ RECEIPT PREVIEW DRAWER ═══════════ */}
      {isDrawerOpen && (
        <>
          <div className={styles.drawerScrim} onClick={handleCloseReceipt} />
          <aside className={styles.drawer}>
            {/* Drawer Header */}
            <div className={styles.drawerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 20, color: '#0a6400' }}
                >
                  receipt_long
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className={styles.drawerHeaderTitle}>
                    Receipt — {activeReceipt?.vendor || 'Vendor'}
                  </div>
                  <div className={styles.drawerHeaderSub}>
                    {activeReceipt?.id} ·{' '}
                    {activeReceipt?.status === 'review' ? 'For review' : 'Reviewed'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className={styles.drawerIconBtn}
                  title="Download original"
                  onClick={() => showToast('Download original receipt')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    download
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.drawerIconBtn}
                  onClick={handleCloseReceipt}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    close
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Split */}
            <div className={styles.drawerSplit}>
              {/* Left: Paper Receipt Viewer */}
              <div className={styles.drawerImage}>
                <div className={styles.drawerImageViewer}>
                  <div className={styles.fakeReceipt}>
                    <div className={styles.fakeReceiptStore}>
                      {(drawerForm.vendor || 'STORE').toUpperCase()}
                    </div>
                    <div className={styles.fakeReceiptSub}>Store #0412</div>
                    <div className={styles.receiptLineSep} />
                    <div className={styles.receiptRow}>
                      <span>Date</span>
                      <span>{drawerForm.date || '10/30/2026'}</span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span>Time</span>
                      <span>2:42 PM</span>
                    </div>
                    <div className={styles.receiptDottedSep} />
                    <div className={styles.receiptRow}>
                      <span>Item 1</span>
                      <span>$18.44</span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span>Item 2</span>
                      <span>$32.10</span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span>Item 3</span>
                      <span>$44.90</span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span>Item 4</span>
                      <span>$38.51</span>
                    </div>
                    <div className={styles.receiptDottedSep} />
                    <div className={styles.receiptRow}>
                      <span>Subtotal</span>
                      <span>
                        $
                        {Math.max(
                          0,
                          parseFloat(drawerForm.amount.replace('$', '') || '0') -
                            parseFloat(drawerForm.tax.replace('$', '') || '0')
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className={styles.receiptRow}>
                      <span>Tax</span>
                      <span>{drawerForm.tax || '$0.00'}</span>
                    </div>
                    <div className={styles.receiptTotalRow}>
                      <span>TOTAL</span>
                      <span>{drawerForm.amount || '$0.00'}</span>
                    </div>
                    <div className={styles.receiptDottedSep} />
                    <div className={styles.receiptFooter}>
                      VISA ****4421
                      <br />
                      Auth: 002847
                      <br />
                      Thank you!
                    </div>
                  </div>
                </div>

                {/* Bottom Image Toolbar */}
                <div className={styles.imageToolbar}>
                  <button
                    type="button"
                    className={styles.imageToolBtn}
                    onClick={() => showToast('Zoom in')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      zoom_in
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.imageToolBtn}
                    onClick={() => showToast('Zoom out')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      zoom_out
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.imageToolBtn}
                    onClick={() => showToast('Rotate receipt')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      rotate_right
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.imageToolBtn}
                    onClick={() => showToast('Open full image')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      open_in_new
                    </span>
                    Open
                  </button>
                </div>
              </div>

              {/* Right: Extracted Fields */}
              <div className={styles.drawerFields}>
                <div className={styles.drawerFieldsBody}>
                  <div className={styles.fieldsSectionTitle}>Extracted fields</div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Vendor</div>
                    <div className={styles.fieldValue}>
                      <input
                        className={styles.fieldInput}
                        value={drawerForm.vendor}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, vendor: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Date</div>
                    <div className={styles.fieldValue}>
                      <input
                        type="date"
                        className={styles.fieldInput}
                        value={drawerForm.date}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Amount</div>
                    <div className={styles.fieldValue}>
                      <input
                        className={styles.fieldInput}
                        value={drawerForm.amount}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, amount: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Tax</div>
                    <div className={styles.fieldValue}>
                      <input
                        className={styles.fieldInput}
                        value={drawerForm.tax}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, tax: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Payment account</div>
                    <div className={styles.fieldValue}>
                      <select
                        className={styles.fieldSelect}
                        value={drawerForm.account}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, account: e.target.value })
                        }
                      >
                        <option>Visa •4421</option>
                        <option>Bank •9910</option>
                        <option>Amex •2103</option>
                        <option>Cash</option>
                        <option>Personal funds — reimburse</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Category</div>
                    <div className={styles.fieldValue}>
                      <select
                        className={styles.fieldSelect}
                        value={drawerForm.category}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, category: e.target.value })
                        }
                      >
                        <option value="">— Select category —</option>
                        <option>Office supplies</option>
                        <option>Shipping</option>
                        <option>Software</option>
                        <option>Advertising</option>
                        <option>Meals &amp; entertainment</option>
                        <option>Travel</option>
                        <option>Ask My Accountant</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldLabel}>Notes</div>
                    <div className={styles.fieldValue}>
                      <input
                        className={styles.fieldInput}
                        placeholder="Add a note…"
                        value={drawerForm.notes}
                        onChange={(e) =>
                          setDrawerForm({ ...drawerForm, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className={styles.drawerFooter}>
                  <button
                    type="button"
                    className={styles.btnSecondaryOutline}
                    onClick={handleCloseReceipt}
                  >
                    Cancel
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      className={styles.btnSecondaryOutline}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMatchMenuPos({
                          top: rect.bottom + 4,
                          left: Math.min(rect.left, window.innerWidth - 360),
                        });
                        setMatchMenuOpen(true);
                      }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 16 }}
                      >
                        link
                      </span>
                      Match to transaction
                    </button>
                    <div className={styles.btnSplitExpense}>
                      <button
                        type="button"
                        className={styles.btnSplitExpenseMain}
                        onClick={handleDrawerCreateExpense}
                      >
                        Create expense
                      </button>
                      <button
                        type="button"
                        className={styles.btnSplitExpenseArrow}
                        onClick={handleDrawerCreateExpense}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16 }}
                        >
                          expand_more
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ═══════════ CATEGORY PICKER POPUP ═══════════ */}
      {catPickerOpen && (
        <div
          className={styles.catPicker}
          style={{ top: catPickerPos.top, left: catPickerPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            className={styles.catPickerSearch}
            placeholder="Search categories…"
          />
          <div className={styles.pickerSection}>Suggested</div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Office supplies')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#0077c5' }} />
            Office supplies
          </div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Shipping')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#1e5a38' }} />
            Shipping
          </div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Software')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#6b1e28' }} />
            Software
          </div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Advertising')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#0e5e6f' }} />
            Advertising
          </div>
          <div className={styles.pickerSep} />
          <div className={styles.pickerSection}>All categories</div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Meals & entertainment')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#dad9dd' }} />
            Meals &amp; entertainment
          </div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Travel')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#dad9dd' }} />
            Travel
          </div>
          <div
            className={styles.catPickerOpt}
            onClick={() => handlePickCategory('Ask My Accountant')}
          >
            <span className={styles.catDot} style={{ backgroundColor: '#ba1a1a' }} />
            Ask My Accountant
          </div>
        </div>
      )}

      {/* ═══════════ ROW ⋯ MENU ═══════════ */}
      {rowMenuOpen && (
        <div
          className={styles.rowMenu}
          style={{ top: rowMenuPos.top, left: rowMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.menuHeader}>This receipt</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('view')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              open_in_new
            </span>
            View receipt
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('edit')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              edit
            </span>
            Edit extracted fields
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('download')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              download
            </span>
            Download original
          </button>
          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>Create from receipt</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('create-expense')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              credit_card
            </span>
            Create expense
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('create-bill')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              description
            </span>
            Create bill
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('attach')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              attach_file
            </span>
            Attach to existing…
          </button>
          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>Match</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setRowMenuOpen(false);
              setMatchMenuPos({ top: rowMenuPos.top, left: rowMenuPos.left });
              setMatchMenuOpen(true);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              link
            </span>
            Match to transaction…
          </button>
          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>State</div>
          {(() => {
            const currentRec = receipts.find((r) => r.id === rowMenuTargetId);
            return currentRec?.status === 'reviewed' ? (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => handleRowMenuAction('unmark-reviewed')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  restart_alt
                </span>
                Move back to review
              </button>
            ) : (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => handleRowMenuAction('mark-reviewed')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  check_circle
                </span>
                Mark as reviewed
              </button>
            );
          })()}
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => handleRowMenuAction('delete')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              delete
            </span>
            Delete receipt
          </button>
        </div>
      )}

      {/* ═══════════ MATCH MENU POPUP ═══════════ */}
      {matchMenuOpen && (
        <div
          className={styles.matchMenu}
          style={{ top: matchMenuPos.top, left: matchMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.matchHeader}>Unmatched bank transactions</div>
          {UNMATCHED_BANK_TRANSACTIONS.map((txn, idx) => (
            <div
              key={idx}
              className={styles.matchItem}
              onClick={() => handleSelectMatch(txn.name)}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: '#ba1a1a', marginTop: 2 }}
              >
                account_balance
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {txn.name}
                </div>
                <div className={styles.matchDate}>{txn.date}</div>
              </div>
              <span className={styles.matchAmt} style={{ color: '#ba1a1a' }}>
                {txn.amt}
              </span>
            </div>
          ))}

          <div className={styles.matchHeader}>Open bills</div>
          {OPEN_BILLS.map((bill, idx) => (
            <div
              key={idx}
              className={styles.matchItem}
              onClick={() => handleSelectMatch(bill.name)}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, color: '#6b1e28', marginTop: 2 }}
              >
                description
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {bill.name}
                </div>
                <div className={styles.matchDate}>{bill.date}</div>
              </div>
              <span className={styles.matchAmt} style={{ color: '#5a6355' }}>
                {bill.amt}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════ TOAST NOTIFICATION ═══════════ */}
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
