'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import styles from './EstimatesScreen.module.css';

export interface EstimateLine {
  id: string;
  desc: string;
  qty: number;
  rate: number;
}

export interface EstimateItem {
  id: string;
  no: string;
  customer: string;
  email: string;
  avatarLetter: string;
  avatarClass: string;
  sentDate: string;
  expiryDate: string;
  amount: number;
  status: 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Declined' | 'Expired' | 'Converted';
  convertedInvoiceNo?: string;
  lines: EstimateLine[];
  note?: string;
}

const INITIAL_ESTIMATES: EstimateItem[] = [
  {
    id: 'est-1',
    no: '0221',
    customer: 'Orion Apparel',
    email: 'hello@orionapparel.com',
    avatarLetter: 'O',
    avatarClass: styles.avatarNavy,
    sentDate: '10/26/2026',
    expiryDate: '11/26/2026',
    amount: 3600,
    status: 'Sent',
    lines: [
      { id: 'l1', desc: 'Custom apparel — 40 units', qty: 40, rate: 80.0 },
      { id: 'l2', desc: 'Rush fee', qty: 1, rate: 400.0 },
    ],
  },
  {
    id: 'est-2',
    no: '0219',
    customer: 'Lakeside Design',
    email: 'hello@lakeside.design',
    avatarLetter: 'L',
    avatarClass: styles.avatarBlue,
    sentDate: '10/18/2026',
    expiryDate: '11/18/2026',
    amount: 4200,
    status: 'Viewed',
    lines: [{ id: 'l1', desc: 'Website redesign', qty: 1, rate: 4200.0 }],
  },
  {
    id: 'est-3',
    no: '0214',
    customer: 'Northwind Labs',
    email: 'finance@northwind.io',
    avatarLetter: 'N',
    avatarClass: styles.avatarTeal,
    sentDate: '10/12/2026',
    expiryDate: '11/12/2026',
    amount: 1440,
    status: 'Viewed',
    lines: [{ id: 'l1', desc: 'Consulting — 12 hours', qty: 12, rate: 120.0 }],
  },
  {
    id: 'est-4',
    no: '0212',
    customer: 'Acme Corp',
    email: 'ap@acme.com',
    avatarLetter: 'A',
    avatarClass: styles.avatarBlue,
    sentDate: '10/05/2026',
    expiryDate: '11/05/2026',
    amount: 4800,
    status: 'Accepted',
    lines: [{ id: 'l1', desc: 'Brand identity package', qty: 1, rate: 4800.0 }],
  },
  {
    id: 'est-5',
    no: '0207',
    customer: 'Orion Apparel',
    email: 'hello@orionapparel.com',
    avatarLetter: 'O',
    avatarClass: styles.avatarNavy,
    sentDate: '09/18/2026',
    expiryDate: '10/18/2026',
    amount: 2600,
    status: 'Declined',
    lines: [{ id: 'l1', desc: 'Spring collection — 30 units', qty: 30, rate: 86.67 }],
  },
  {
    id: 'est-6',
    no: '0224',
    customer: 'Maple Supply',
    email: 'ar@maplesupply.io',
    avatarLetter: 'M',
    avatarClass: styles.avatarMaroon,
    sentDate: '—',
    expiryDate: '12/01/2026',
    amount: 2200,
    status: 'Draft',
    lines: [{ id: 'l1', desc: 'Custom supply order', qty: 1, rate: 2200.0 }],
  },
  {
    id: 'est-7',
    no: '0201',
    customer: 'Blue Ridge Co.',
    email: 'billing@blueridge.co',
    avatarLetter: 'B',
    avatarClass: styles.avatarGreen,
    sentDate: '08/15/2026',
    expiryDate: '09/15/2026',
    amount: 3100,
    status: 'Expired',
    lines: [{ id: 'l1', desc: 'Fall collection — 25 units', qty: 25, rate: 124.0 }],
  },
  {
    id: 'est-8',
    no: '0198',
    customer: 'Acme Corp',
    email: 'ap@acme.com',
    avatarLetter: 'A',
    avatarClass: styles.avatarBlue,
    sentDate: '08/12/2026',
    expiryDate: '09/12/2026',
    amount: 2400,
    status: 'Converted',
    convertedInvoiceNo: '1002',
    lines: [{ id: 'l1', desc: 'Design retainer', qty: 1, rate: 2400.0 }],
  },
];

interface EstimatesScreenProps {
  onCreateInvoice?: () => void;
  onCreateCustomer?: () => void;
  onOpenCreateFlyout?: () => void;
  onToast?: (message: string) => void;
}

export default function EstimatesScreen({
  onCreateInvoice,
  onCreateCustomer,
  onOpenCreateFlyout,
  onToast,
}: EstimatesScreenProps) {
  const [estimates, setEstimates] = useState<EstimateItem[]>(INITIAL_ESTIMATES);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Row context menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [activeMenuEst, setActiveMenuEst] = useState<EstimateItem | null>(null);

  // New estimate split dropdown
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newMenuPos, setNewMenuPos] = useState({ top: 0, left: 0 });
  const newSplitBtnRef = useRef<HTMLButtonElement | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEst, setEditingEst] = useState<EstimateItem | null>(null);

  // Convert confirmation modal
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertTargetEst, setConvertTargetEst] = useState<EstimateItem | null>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setMenuOpen(false);
      setNewMenuOpen(false);
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Filtered estimates list
  const filteredEstimates = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return estimates.filter((est) => {
      const tabMatch =
        activeTab === 'All' ||
        (activeTab === 'Converted' ? est.status === 'Converted' : est.status === activeTab);
      if (!tabMatch) return false;
      if (!q) return true;
      return (
        est.no.toLowerCase().includes(q) ||
        est.customer.toLowerCase().includes(q) ||
        est.email.toLowerCase().includes(q) ||
        est.status.toLowerCase().includes(q)
      );
    });
  }, [estimates, activeTab, searchFilter]);

  // Bulk selection handlers
  const handleCheckAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEstimates.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action: string) => {
    const count = selectedIds.length;
    if (action === 'delete') {
      setEstimates((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
      setSelectedIds([]);
      onToast?.(`Deleted ${count} estimate(s)`);
      return;
    }
    if (action === 'convert') {
      setEstimates((prev) =>
        prev.map((e) =>
          selectedIds.includes(e.id)
            ? { ...e, status: 'Converted', convertedInvoiceNo: `10${Math.floor(Math.random() * 90) + 10}` }
            : e
        )
      );
      setSelectedIds([]);
      onToast?.(`Converted ${count} estimate(s) to invoice`);
      return;
    }
    setSelectedIds([]);
    onToast?.(`${action.charAt(0).toUpperCase() + action.slice(1)} on ${count} estimate(s)`);
  };

  // Open Drawer for Create / Edit
  const handleOpenDrawer = (est: EstimateItem | null) => {
    if (est) {
      setEditingEst({ ...est });
    } else {
      const nextNo = `02${estimates.length + 20}`;
      setEditingEst({
        id: `est-${Date.now()}`,
        no: nextNo,
        customer: 'Acme Corp',
        email: 'ap@acme.com',
        avatarLetter: 'A',
        avatarClass: styles.avatarBlue,
        sentDate: '11/04/2026',
        expiryDate: '12/04/2026',
        amount: 2800,
        status: 'Draft',
        note: 'Thanks for the opportunity — let us know if you have questions.',
        lines: [
          { id: 'l1', desc: 'Custom design — 3 concepts', qty: 3, rate: 800.0 },
          { id: 'l2', desc: 'Print setup + samples', qty: 1, rate: 400.0 },
        ],
      });
    }
    setDrawerOpen(true);
  };

  const handleDrawerSave = () => {
    if (!editingEst) return;
    const lineTotal = editingEst.lines.reduce((acc, l) => acc + l.qty * l.rate, 0);
    const updated = { ...editingEst, amount: lineTotal };

    setEstimates((prev) => {
      const exists = prev.some((e) => e.id === updated.id);
      if (exists) {
        return prev.map((e) => (e.id === updated.id ? updated : e));
      }
      return [updated, ...prev];
    });
    setDrawerOpen(false);
    onToast?.(`Estimate ${updated.no} saved`);
  };

  const handleDrawerSend = () => {
    if (!editingEst) return;
    const lineTotal = editingEst.lines.reduce((acc, l) => acc + l.qty * l.rate, 0);
    const updated: EstimateItem = { ...editingEst, amount: lineTotal, status: 'Sent' };

    setEstimates((prev) => {
      const exists = prev.some((e) => e.id === updated.id);
      if (exists) {
        return prev.map((e) => (e.id === updated.id ? updated : e));
      }
      return [updated, ...prev];
    });
    setDrawerOpen(false);
    onToast?.(`Estimate ${updated.no} sent to customer`);
  };

  const handlePromptConvert = (est: EstimateItem) => {
    setConvertTargetEst(est);
    setConvertModalOpen(true);
  };

  const handleConfirmConvert = () => {
    if (!convertTargetEst) return;
    const newInvoiceNo = `10${Math.floor(Math.random() * 90) + 10}`;
    setEstimates((prev) =>
      prev.map((e) =>
        e.id === convertTargetEst.id
          ? { ...e, status: 'Converted', convertedInvoiceNo: newInvoiceNo }
          : e
      )
    );
    setConvertModalOpen(false);
    setDrawerOpen(false);
    onToast?.(`Estimate ${convertTargetEst.no} converted to invoice ${newInvoiceNo}`);
  };

  // Row More Menu
  const handleOpenRowMenu = (e: React.MouseEvent, est: EstimateItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.min(rect.right - 230, window.innerWidth - 250),
    });
    setActiveMenuEst(est);
    setMenuOpen(true);
  };

  const handleRowMenuAction = (action: string) => {
    if (!activeMenuEst) return;
    const est = activeMenuEst;
    setMenuOpen(false);

    switch (action) {
      case 'view':
      case 'edit':
        handleOpenDrawer(est);
        break;
      case 'duplicate': {
        const copy: EstimateItem = {
          ...est,
          id: `est-${Date.now()}`,
          no: `${est.no}-copy`,
          status: 'Draft',
        };
        setEstimates((prev) => [copy, ...prev]);
        onToast?.(`Duplicated estimate ${est.no}`);
        break;
      }
      case 'send':
        setEstimates((prev) =>
          prev.map((e) => (e.id === est.id ? { ...e, status: 'Sent' } : e))
        );
        onToast?.(`Sent estimate ${est.no}`);
        break;
      case 'remind':
        onToast?.(`Reminder sent for estimate ${est.no}`);
        break;
      case 'print':
        onToast?.(`Printing estimate ${est.no} PDF`);
        break;
      case 'convert':
        handlePromptConvert(est);
        break;
      case 'mark-accepted':
        setEstimates((prev) =>
          prev.map((e) => (e.id === est.id ? { ...e, status: 'Accepted' } : e))
        );
        onToast?.(`Estimate ${est.no} marked accepted`);
        break;
      case 'mark-declined':
        setEstimates((prev) =>
          prev.map((e) => (e.id === est.id ? { ...e, status: 'Declined' } : e))
        );
        onToast?.(`Estimate ${est.no} marked declined`);
        break;
      case 'delete':
        setEstimates((prev) => prev.filter((e) => e.id !== est.id));
        onToast?.(`Deleted estimate ${est.no}`);
        break;
    }
  };

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amt);
  };

  const getStatusBadge = (est: EstimateItem) => {
    if (est.status === 'Converted') {
      return (
        <span className={`${styles.statusPill} ${styles.statusConverted}`}>
          Converted → {est.convertedInvoiceNo || '1002'}
        </span>
      );
    }
    switch (est.status) {
      case 'Draft':
        return <span className={`${styles.statusPill} ${styles.statusDraft}`}>Draft</span>;
      case 'Sent':
        return <span className={`${styles.statusPill} ${styles.statusSent}`}>Sent</span>;
      case 'Viewed':
        return <span className={`${styles.statusPill} ${styles.statusViewed}`}>Viewed</span>;
      case 'Accepted':
        return <span className={`${styles.statusPill} ${styles.statusAccepted}`}>Accepted</span>;
      case 'Declined':
        return <span className={`${styles.statusPill} ${styles.statusDeclined}`}>Declined</span>;
      case 'Expired':
        return <span className={`${styles.statusPill} ${styles.statusExpired}`}>Expired</span>;
      default:
        return <span className={`${styles.statusPill} ${styles.statusDraft}`}>{est.status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      {/* Context Header */}
      <div className={styles.contextHeader}>
        <div className={styles.breadcrumbGroup}>
          <span className={`material-symbols-outlined ${styles.domainIcon}`}>
            account_balance
          </span>
          <span className={styles.breadcrumbLabel}>Finance</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbLabel}>Sales &amp; Get Paid</span>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbActive}>Estimates</span>
        </div>
        <div className={styles.previewBadge}>Quotes · standalone</div>
      </div>

      <div className={styles.mainContent}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Estimates</h1>
            <p className={styles.subtitle}>
              Quotes sent to customers · convert to invoice when accepted
            </p>
          </div>

          <div className={styles.headerActions}>
            <div className={styles.splitBtn}>
              <button
                type="button"
                className={styles.splitBtnMain}
                onClick={() => handleOpenDrawer(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  add
                </span>
                New estimate
              </button>
              <button
                ref={newSplitBtnRef}
                type="button"
                className={styles.splitBtnArrow}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setNewMenuPos({
                    top: rect.bottom + 4,
                    left: Math.min(rect.right - 220, window.innerWidth - 240),
                  });
                  setNewMenuOpen((prev) => !prev);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  expand_more
                </span>
              </button>
            </div>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onToast?.('Exporting estimates…')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                download
              </span>
              Export
            </button>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => onToast?.('Customize panel opened')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                tune
              </span>
              Customize
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className={styles.kpiStrip}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Open estimates</div>
            <div className={styles.kpiValue}>3</div>
            <div className={styles.kpiMeta}>$9,240 · awaiting response</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Sent this month</div>
            <div className={styles.kpiValue}>5</div>
            <div className={styles.kpiMeta}>$14,800 total</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Acceptance rate</div>
            <div className={`${styles.kpiValue} ${styles.kpiValueGreen}`}>42%</div>
            <div className={styles.kpiMeta}>Last 30 days</div>
          </div>
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Converted to invoice</div>
            <div className={styles.kpiValue}>2</div>
            <div className={styles.kpiMeta}>$5,040 this month</div>
          </div>
        </div>

        {/* Create Actions Row */}
        <div className={styles.createActionsRow}>
          <span className={styles.createActionsLabel}>Create actions:</span>
          <button
            type="button"
            className={styles.actionChip}
            onClick={() => handleOpenDrawer(null)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              request_quote
            </span>
            Estimate
          </button>
          <button
            type="button"
            className={styles.actionChip}
            onClick={() => {
              if (onCreateInvoice) onCreateInvoice();
              else onToast?.('Create invoice triggered');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              receipt_long
            </span>
            Invoice
          </button>
          <button
            type="button"
            className={styles.actionChip}
            onClick={() => {
              if (onCreateCustomer) onCreateCustomer();
              else onToast?.('Add customer drawer opened');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              person_add
            </span>
            Customer
          </button>
          <button
            type="button"
            className={styles.actionChip}
            onClick={() => onToast?.('Template picker — 4 saved estimates')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              content_copy
            </span>
            From template
          </button>
          <button
            type="button"
            className={styles.actionChipMuted}
            onClick={() => {
              if (onOpenCreateFlyout) onOpenCreateFlyout();
              else onToast?.('Global Create flyout');
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              apps
            </span>
            Show all
          </button>
        </div>

        {/* Table Card */}
        <div className={styles.tableCard}>
          {/* Tabs */}
          <div className={styles.tabStrip}>
            {['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'].map(
              (tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.tabUnderline} ${
                    activeTab === tab ? styles.tabUnderlineActive : ''
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              )
            )}
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <div className={styles.searchWrapper}>
              <span className={`material-symbols-outlined ${styles.searchIcon}`}>
                search
              </span>
              <input
                type="text"
                placeholder="Filter by estimate, customer…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => onToast?.('Date range filter')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                calendar_today
              </span>
              Date range
            </button>

            <button
              type="button"
              className={styles.filterBtn}
              onClick={() => onToast?.('Saved views')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                bookmark
              </span>
              Saved views
            </button>

            <span className={styles.countIndicator}>
              {filteredEstimates.length} of {estimates.length}
            </span>
          </div>

          {/* Bulk Bar */}
          {selectedIds.length > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selectedIds.length} selected</span>
              <span className={styles.bulkSep} />
              <button
                type="button"
                className={styles.bulkActionBtn}
                onClick={() => handleBulkAction('send')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  send
                </span>
                Send
              </button>
              <button
                type="button"
                className={styles.bulkActionBtn}
                onClick={() => handleBulkAction('remind')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  notifications_active
                </span>
                Remind
              </button>
              <button
                type="button"
                className={styles.bulkActionBtn}
                onClick={() => handleBulkAction('convert')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  sync_alt
                </span>
                Convert to invoice
              </button>
              <button
                type="button"
                className={styles.bulkActionBtn}
                onClick={() => handleBulkAction('print')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  print
                </span>
                Print
              </button>
              <span className={styles.bulkSep} />
              <button
                type="button"
                className={styles.bulkActionBtn}
                onClick={() => handleBulkAction('delete')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  delete
                </span>
                Delete
              </button>
              <button
                type="button"
                className={styles.bulkCloseBtn}
                onClick={() => setSelectedIds([])}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  close
                </span>
              </button>
            </div>
          )}

          {/* Table */}
          <table className={styles.table}>
            <thead className={styles.tableHeader}>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    className={styles.rowCheck}
                    checked={
                      filteredEstimates.length > 0 &&
                      selectedIds.length === filteredEstimates.length
                    }
                    onChange={handleCheckAll}
                  />
                </th>
                <th>Estimate</th>
                <th>Customer</th>
                <th>Sent</th>
                <th>Expires</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.map((est) => {
                const isChecked = selectedIds.includes(est.id);
                return (
                  <tr
                    key={est.id}
                    className={styles.row}
                    onClick={() => handleOpenDrawer(est)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className={styles.rowCheck}
                        checked={isChecked}
                        onClick={(e) => handleToggleCheck(est.id, e)}
                        onChange={() => {}}
                      />
                    </td>
                    <td style={{ fontWeight: 500 }}>{est.no}</td>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={`${styles.avatar} ${est.avatarClass}`}>
                          {est.avatarLetter}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.customerName}>{est.customer}</div>
                          <div className={styles.customerEmail}>{est.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.textMuted}>{est.sentDate}</td>
                    <td
                      className={
                        est.status === 'Expired'
                          ? styles.textExpired
                          : styles.textMuted
                      }
                    >
                      {est.expiryDate}
                    </td>
                    <td className={styles.textRight}>
                      {formatCurrency(est.amount)}
                    </td>
                    <td>{getStatusBadge(est)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className={styles.moreBtn}
                        onClick={(e) => handleOpenRowMenu(e, est)}
                        title="Row options"
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
      </div>

      {/* New Split Menu */}
      {newMenuOpen && (
        <div
          className={styles.floatingMenu}
          style={{ top: newMenuPos.top, left: newMenuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.menuHeader}>New estimate</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setNewMenuOpen(false);
              handleOpenDrawer(null);
            }}
          >
            <span className="material-symbols-outlined">request_quote</span>
            Blank estimate
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setNewMenuOpen(false);
              onToast?.('Template picker — 4 saved estimates');
            }}
          >
            <span className="material-symbols-outlined">content_copy</span>
            From template…
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setNewMenuOpen(false);
              onToast?.('Reverse from invoice — pick source invoice');
            }}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            Reverse from invoice…
          </button>
        </div>
      )}

      {/* Row Context Menu */}
      {menuOpen && activeMenuEst && (
        <div
          className={styles.floatingMenu}
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.menuHeader}>This estimate</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('view')}
          >
            <span className="material-symbols-outlined">open_in_new</span>
            Open estimate
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('edit')}
          >
            <span className="material-symbols-outlined">edit</span>
            Edit
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('duplicate')}
          >
            <span className="material-symbols-outlined">content_copy</span>
            Duplicate
          </button>

          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>Send</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('send')}
          >
            <span className="material-symbols-outlined">send</span>
            Send
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('remind')}
          >
            <span className="material-symbols-outlined">notifications_active</span>
            Send reminder
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('print')}
          >
            <span className="material-symbols-outlined">print</span>
            Print / download PDF
          </button>

          <div className={styles.menuSep} />
          <div className={styles.menuHeader}>Close the deal</div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('convert')}
          >
            <span className="material-symbols-outlined">sync_alt</span>
            Convert to invoice
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('mark-accepted')}
          >
            <span className="material-symbols-outlined">check_circle</span>
            Mark accepted
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => handleRowMenuAction('mark-declined')}
          >
            <span className="material-symbols-outlined">cancel</span>
            Mark declined
          </button>

          <div className={styles.menuSep} />
          <button
            type="button"
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => handleRowMenuAction('delete')}
          >
            <span className="material-symbols-outlined">delete</span>
            Delete
          </button>
        </div>
      )}

      {/* ═══════════ ESTIMATE DRAWER ═══════════ */}
      <div
        className={`${styles.drawerScrim} ${drawerOpen ? styles.drawerScrimOpen : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
        {editingEst && (
          <>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerHeaderLeft}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#0a6400' }}>
                  request_quote
                </span>
                <div>
                  <div className={styles.drawerTitle}>Estimate {editingEst.no}</div>
                  <div className={styles.drawerSubtitle}>
                    {editingEst.customer} · {editingEst.status}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={() => onToast?.(`Downloading Estimate ${editingEst.no} PDF`)}
                  title="Download PDF"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    download
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={() => setDrawerOpen(false)}
                  title="Close"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    close
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.drawerBody}>
              {/* Customer Banner */}
              <div className={styles.customerBanner}>
                <div className={styles.customerBannerLabel}>Customer</div>
                <div className={styles.customerBannerName}>{editingEst.customer}</div>
                <div className={styles.customerBannerEmail}>{editingEst.email}</div>
              </div>

              {/* Estimate Details Grid */}
              <div className={styles.detailsGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Estimate no.</label>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={editingEst.no}
                    onChange={(e) =>
                      setEditingEst({ ...editingEst, no: e.target.value })
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select
                    className={styles.fieldInput}
                    value={editingEst.status}
                    onChange={(e) =>
                      setEditingEst({
                        ...editingEst,
                        status: e.target.value as EstimateItem['status'],
                      })
                    }
                  >
                    <option>Draft</option>
                    <option>Sent</option>
                    <option>Viewed</option>
                    <option>Accepted</option>
                    <option>Declined</option>
                    <option>Expired</option>
                    <option>Converted</option>
                  </select>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Estimate date</label>
                  <input
                    type="date"
                    className={styles.fieldInput}
                    value={editingEst.sentDate !== '—' ? '2026-10-26' : '2026-11-04'}
                    onChange={(e) =>
                      setEditingEst({ ...editingEst, sentDate: e.target.value })
                    }
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Expires</label>
                  <input
                    type="date"
                    className={styles.fieldInput}
                    value="2026-11-26"
                    onChange={(e) =>
                      setEditingEst({ ...editingEst, expiryDate: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className={styles.linesSection}>
                <div className={styles.linesHeaderRow}>
                  <span className={styles.linesSectionTitle}>Line items</span>
                  <button
                    type="button"
                    className={styles.addLineBtn}
                    onClick={() => {
                      const nextLine: EstimateLine = {
                        id: `l-${Date.now()}`,
                        desc: 'Additional service / product',
                        qty: 1,
                        rate: 150.0,
                      };
                      setEditingEst({
                        ...editingEst,
                        lines: [...editingEst.lines, nextLine],
                      });
                    }}
                  >
                    + Add line
                  </button>
                </div>

                <div className={styles.linesTableHead}>
                  <span>#</span>
                  <span>Description</span>
                  <span style={{ textAlign: 'right' }}>Qty</span>
                  <span style={{ textAlign: 'right' }}>Rate</span>
                  <span style={{ textAlign: 'right' }}>Amount</span>
                  <span></span>
                </div>

                {editingEst.lines.map((line, idx) => (
                  <div key={line.id} className={styles.lineRowItem}>
                    <span style={{ fontSize: 11, color: '#5a6355' }}>{idx + 1}</span>
                    <input
                      type="text"
                      className={styles.lineInput}
                      value={line.desc}
                      onChange={(e) => {
                        const newLines = editingEst.lines.map((l) =>
                          l.id === line.id ? { ...l, desc: e.target.value } : l
                        );
                        setEditingEst({ ...editingEst, lines: newLines });
                      }}
                    />
                    <input
                      type="number"
                      className={`${styles.lineInput} ${styles.lineInputNum}`}
                      value={line.qty}
                      onChange={(e) => {
                        const newLines = editingEst.lines.map((l) =>
                          l.id === line.id
                            ? { ...l, qty: Number(e.target.value) || 0 }
                            : l
                        );
                        setEditingEst({ ...editingEst, lines: newLines });
                      }}
                    />
                    <input
                      type="number"
                      step="50"
                      className={`${styles.lineInput} ${styles.lineInputNum}`}
                      value={line.rate}
                      onChange={(e) => {
                        const newLines = editingEst.lines.map((l) =>
                          l.id === line.id
                            ? { ...l, rate: Number(e.target.value) || 0 }
                            : l
                        );
                        setEditingEst({ ...editingEst, lines: newLines });
                      }}
                    />
                    <input
                      type="text"
                      readOnly
                      className={`${styles.lineInput} ${styles.lineInputNum}`}
                      value={formatCurrency(line.qty * line.rate)}
                    />
                    <button
                      type="button"
                      className={styles.lineDeleteBtn}
                      onClick={() => {
                        if (editingEst.lines.length <= 1) return;
                        const newLines = editingEst.lines.filter((l) => l.id !== line.id);
                        setEditingEst({ ...editingEst, lines: newLines });
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className={styles.totalsBox}>
                <div className={styles.totalsInner}>
                  <div className={styles.totalsRow}>
                    <span style={{ color: '#5a6355' }}>Subtotal</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(
                        editingEst.lines.reduce((a, b) => a + b.qty * b.rate, 0)
                      )}
                    </span>
                  </div>
                  <div className={styles.totalsRow}>
                    <span style={{ color: '#5a6355' }}>Tax (est.)</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>$0.00</span>
                  </div>
                  <div className={styles.totalsRowFinal}>
                    <span>Estimate total</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(
                        editingEst.lines.reduce((a, b) => a + b.qty * b.rate, 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note to customer */}
              <div style={{ borderTop: '1px solid #dad9dd', paddingTop: 12 }}>
                <label className={styles.fieldLabel} style={{ marginBottom: 4 }}>
                  Note to customer
                </label>
                <textarea
                  className={styles.noteTextarea}
                  placeholder="Optional note visible to the customer"
                  value={editingEst.note || ''}
                  onChange={(e) =>
                    setEditingEst({ ...editingEst, note: e.target.value })
                  }
                />
              </div>

              {/* Activity log */}
              <div style={{ borderTop: '1px solid #dad9dd', paddingTop: 12 }}>
                <div
                  className={styles.fieldLabel}
                  style={{ marginBottom: 8 }}
                >
                  Activity
                </div>
                <div className={styles.activityList}>
                  <div className={styles.activityItem}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: '#006c47', marginTop: 2 }}
                    >
                      send
                    </span>
                    <div>
                      <div className={styles.activityTitle}>Sent to customer</div>
                      <div className={styles.activityTime}>10/26/2026 · 9:42 AM</div>
                    </div>
                  </div>
                  <div className={styles.activityItem}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: '#0055a5', marginTop: 2 }}
                    >
                      visibility
                    </span>
                    <div>
                      <div className={styles.activityTitle}>Viewed by customer</div>
                      <div className={styles.activityTime}>10/28/2026 · 3:15 PM</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className={styles.drawerFooter}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setDrawerOpen(false)}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleDrawerSend}
                  style={{ fontWeight: 600 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    send
                  </span>
                  Send
                </button>

                <div className={styles.splitBtn}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    style={{
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      fontWeight: 600,
                    }}
                    onClick={handleDrawerSave}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    style={{
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      borderLeft: 'none',
                      padding: '0 4px',
                    }}
                    onClick={handleDrawerSave}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      expand_more
                    </span>
                  </button>
                </div>

                <div className={styles.splitBtn}>
                  <button
                    type="button"
                    className={styles.splitBtnMain}
                    onClick={() => handlePromptConvert(editingEst)}
                  >
                    Convert to invoice
                  </button>
                  <button
                    type="button"
                    className={styles.splitBtnArrow}
                    onClick={() => handlePromptConvert(editingEst)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      expand_more
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════ CONVERT CONFIRMATION MODAL ═══════════ */}
      {convertModalOpen && convertTargetEst && (
        <div className={styles.modalScrim}>
          <div className={styles.modalCard}>
            <div className={styles.modalBody}>
              <div className={styles.modalIconBox}>
                <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                  sync_alt
                </span>
              </div>
              <h2 className={styles.modalTitle}>Convert estimate to invoice?</h2>
              <p className={styles.modalSummary}>
                Estimate {convertTargetEst.no} · {convertTargetEst.customer} ·{' '}
                {formatCurrency(convertTargetEst.amount)}
              </p>
              <div className={styles.modalBenefitsBox}>
                <div className={styles.benefitItem}>
                  <span className={`material-symbols-outlined ${styles.benefitCheck}`}>
                    check
                  </span>
                  Customer, line items, and totals carry over
                </div>
                <div className={styles.benefitItem}>
                  <span className={`material-symbols-outlined ${styles.benefitCheck}`}>
                    check
                  </span>
                  Estimate marked Converted with a link to the invoice
                </div>
                <div className={styles.benefitItem}>
                  <span className={`material-symbols-outlined ${styles.benefitCheck}`}>
                    check
                  </span>
                  Invoice starts as Draft — send when you&apos;re ready
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setConvertModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmBtn}
                onClick={handleConfirmConvert}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  sync_alt
                </span>
                Convert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
