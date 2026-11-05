'use client';

import React, { useState, useMemo } from 'react';
import styles from './PurchaseOrderScreen.module.css';

interface LineItem {
  id: string;
  item: string;
  sku: string;
  description: string;
  qtyOrd: number;
  qtyRcvd: number;
  unitCost: number;
}

const INITIAL_LINES: LineItem[] = [
  {
    id: 'line-1',
    item: 'Classic Tee - White',
    sku: 'TEE-001',
    description: 'Size L',
    qtyOrd: 100,
    qtyRcvd: 0,
    unitCost: 8.5,
  },
  {
    id: 'line-2',
    item: 'Canvas Tote',
    sku: 'TOTE-014',
    description: 'Natural',
    qtyOrd: 50,
    qtyRcvd: 0,
    unitCost: 6.0,
  },
];

type POViewMode = 'edit' | 'email' | 'vendor' | 'pdf';
type POStatus = 'Open' | 'Sent to Vendor' | 'Partially Received' | 'Fully Received' | 'Cancelled';

const VENDOR_OPTIONS = [
  {
    name: 'Printful Inc.',
    email: 'support@printful.com',
    phone: '+1 (555) 000-1111',
  },
  {
    name: 'Gelato Pty Ltd',
    email: 'partner@gelato.com',
    phone: '+1 (555) 888-2222',
  },
  {
    name: 'Printify',
    email: 'merchants@printify.com',
    phone: '+1 (555) 444-3333',
  },
];

interface PurchaseOrderScreenProps {
  onClose?: () => void;
  onToast?: (message: string) => void;
}

export default function PurchaseOrderScreen({
  onClose,
  onToast,
}: PurchaseOrderScreenProps) {
  const [viewMode, setViewMode] = useState<POViewMode>('edit');
  const [status, setStatus] = useState<POStatus>('Open');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Vendor selection
  const [selectedVendorIndex, setSelectedVendorIndex] = useState(0);
  const activeVendor = VENDOR_OPTIONS[selectedVendorIndex] || VENDOR_OPTIONS[0];

  // Dates & terms
  const [orderDate, setOrderDate] = useState('11/03/2026');
  const [deliveryDate, setDeliveryDate] = useState('11/15/2026');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [shipVia, setShipVia] = useState('FedEx Ground');
  const [notes, setNotes] = useState('');

  // Lines
  const [lines, setLines] = useState<LineItem[]>(INITIAL_LINES);

  // Accordions in sidebar
  const [expandedAccordions, setExpandedAccordions] = useState<Record<string, boolean>>({
    customization: false,
    receiving: true,
    billing: false,
    attachments: false,
  });

  // Customization switches
  const [showSku, setShowSku] = useState(true);
  const [showUnitCost, setShowUnitCost] = useState(true);
  const [showReceivingStatus, setShowReceivingStatus] = useState(true);
  const [showVendorPartNo, setShowVendorPartNo] = useState(false);

  // Table column toggles
  const [colNum, setColNum] = useState(true);
  const [colItem, setColItem] = useState(true);
  const [colDesc, setColDesc] = useState(true);
  const [colQtyOrd, setColQtyOrd] = useState(true);
  const [colQtyRcvd, setColQtyRcvd] = useState(true);
  const [colCost, setColCost] = useState(true);
  const [colAmount, setColAmount] = useState(true);

  // Footer menus
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);

  const toggleAccordion = (id: string) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.qtyOrd * l.unitCost, 0);
  }, [lines]);

  const shipping = 45.0;
  const tax = 0.0;
  const grandTotal = subtotal + shipping + tax;

  const totalQtyOrd = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.qtyOrd, 0);
  }, [lines]);

  const totalQtyRcvd = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.qtyRcvd, 0);
  }, [lines]);

  const totalQtyRemaining = Math.max(0, totalQtyOrd - totalQtyRcvd);

  const handleUpdateLine = (id: string, field: keyof LineItem, val: string | number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: val } : l))
    );
  };

  const handleAddLine = () => {
    const nextIdx = lines.length + 1;
    const newLine: LineItem = {
      id: `line-${Date.now()}`,
      item: `Product Item #${nextIdx}`,
      sku: `SKU-${100 + nextIdx}`,
      description: 'Standard Specification',
      qtyOrd: 25,
      qtyRcvd: 0,
      unitCost: 10.0,
    };
    setLines((prev) => [...prev, newLine]);
    onToast?.('Added new line item');
  };

  const handleClearLines = () => {
    setLines([]);
    onToast?.('Cleared all lines');
  };

  const handleReceiveItems = () => {
    // Mark items as received
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        qtyRcvd: l.qtyOrd,
      }))
    );
    setStatus('Fully Received');
    onToast?.('All items marked as received');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusClass = (st: POStatus) => {
    switch (st) {
      case 'Open':
        return styles.statusOpen;
      case 'Sent to Vendor':
        return styles.statusSent;
      case 'Partially Received':
        return styles.statusPartial;
      case 'Fully Received':
        return styles.statusReceived;
      case 'Cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusOpen;
    }
  };

  return (
    <div className={styles.container}>
      {/* ═══════════ TOP HEADER ═══════════ */}
      <header className={styles.header}>
        <div className={styles.topRow}>
          <div className={styles.titleArea}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Audit history"
              onClick={() => onToast?.('Viewing PO audit history')}
            >
              <span className="material-symbols-outlined">history</span>
            </button>
            <h1 className={styles.mainTitle}>Purchase Order 1001</h1>
            <span className={`${styles.statusPill} ${getStatusClass(status)}`}>
              {status}
            </span>
          </div>

          <div className={styles.topRightActions}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Help & docs"
              onClick={() => onToast?.('Help and documentation')}
            >
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <button
              type="button"
              className={styles.starCircleBtn}
              title="Pin purchase order"
              onClick={() => onToast?.('Purchase Order pinned to favorites')}
            >
              <span className="material-symbols-outlined">star</span>
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              title="Close"
              onClick={() => {
                if (onClose) onClose();
                else onToast?.('Closed Purchase Order');
              }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Tabs & Quick Actions */}
        <div className={styles.tabRow}>
          <div className={styles.viewsTabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${viewMode === 'edit' ? styles.tabBtnActive : ''}`}
              onClick={() => setViewMode('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${viewMode === 'email' ? styles.tabBtnActive : ''}`}
              onClick={() => setViewMode('email')}
            >
              Email view
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${viewMode === 'vendor' ? styles.tabBtnActive : ''}`}
              onClick={() => setViewMode('vendor')}
            >
              Vendor view
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${viewMode === 'pdf' ? styles.tabBtnActive : ''}`}
              onClick={() => setViewMode('pdf')}
            >
              PDF view
            </button>
          </div>

          <div className={styles.quickActionsGroup}>
            <button
              type="button"
              className={styles.quickActionLink}
              onClick={() => {
                setSidebarOpen((prev) => !prev);
                onToast?.(sidebarOpen ? 'Sidebar collapsed' : 'Sidebar expanded');
              }}
            >
              <span className="material-symbols-outlined">settings</span>
              Manage
            </button>
            <button
              type="button"
              className={styles.quickActionLink}
              onClick={handleReceiveItems}
            >
              <span className="material-symbols-outlined">local_shipping</span>
              Receive items
            </button>
            <button
              type="button"
              className={styles.quickActionLink}
              onClick={() => onToast?.('Feedback dialog opened')}
            >
              <span className="material-symbols-outlined">chat_bubble_outline</span>
              Feedback
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN WORKSPACE AREA ═══════════ */}
      <div className={styles.workspace}>
        {/* Left Side: Document Canvas */}
        <div className={styles.canvasWrapper}>
          {/* 1. EDIT VIEW */}
          {viewMode === 'edit' && (
            <div className={styles.editContainer}>
              <div className={styles.documentPaper}>
                {/* Header: Company & PO # */}
                <div className={styles.docHeader}>
                  <div>
                    <h2 className={styles.companyTitle}>PURCHASE ORDER</h2>
                    <div className={styles.companyName}>Unsaid</div>
                    <div className={styles.companyMeta}>
                      123 Business Rd, Suite 100
                      <br />
                      hello@unsaid.com
                    </div>
                  </div>
                  <div className={styles.poNumberBlock}>
                    <div className={styles.poLabel}>PO Number</div>
                    <div className={styles.poValue}>PO-1001</div>
                  </div>
                </div>

                {/* Vendor / Ship To Grid */}
                <div className={styles.partyGrid}>
                  <div className={styles.vendorBlock}>
                    <div className={styles.partyLabel}>Vendor</div>
                    <div className={styles.selectWrapper}>
                      <select
                        className={styles.vendorSelect}
                        value={selectedVendorIndex}
                        onChange={(e) => setSelectedVendorIndex(Number(e.target.value))}
                      >
                        {VENDOR_OPTIONS.map((v, i) => (
                          <option key={v.name} value={i}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <span className={`material-symbols-outlined ${styles.selectArrow}`}>
                        expand_more
                      </span>
                    </div>
                    <div className={styles.partyDetails}>
                      {activeVendor.email}
                      <br />
                      {activeVendor.phone}
                    </div>
                  </div>

                  <div>
                    <div className={styles.partyLabel}>Ship To</div>
                    <div className={styles.partyName}>Unsaid Warehouse</div>
                    <div className={styles.partyDetails}>
                      456 Warehouse Way
                      <br />
                      Dock 4
                      <br />
                      Springfield, IL 62701
                    </div>
                  </div>
                </div>

                {/* Dates & Terms Row */}
                <div className={styles.metaGrid}>
                  <div className={styles.metaField}>
                    <label className={styles.fieldLabel}>Order Date</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.metaField}>
                    <label className={styles.fieldLabel}>Expected Delivery</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.metaField}>
                    <label className={styles.fieldLabel}>Payment Terms</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    />
                  </div>
                  <div className={styles.metaField}>
                    <label className={styles.fieldLabel}>Ship Via</label>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={shipVia}
                      onChange={(e) => setShipVia(e.target.value)}
                    />
                  </div>
                </div>

                {/* Product Lines Table */}
                <div className={styles.tableWrapper}>
                  <table className={styles.linesTable}>
                    <thead>
                      <tr className={styles.linesHeaderRow}>
                        <th className={styles.thCell} style={{ width: 36 }}></th>
                        {colNum && <th className={styles.thCell} style={{ width: 36 }}>#</th>}
                        {colItem && <th className={styles.thCell}>Item / SKU</th>}
                        {colDesc && <th className={styles.thCell}>Description</th>}
                        {colQtyOrd && (
                          <th className={styles.thCellRight} style={{ width: 70 }}>
                            Qty Ord
                          </th>
                        )}
                        {colQtyRcvd && (
                          <th className={styles.thCellRight} style={{ width: 70 }}>
                            Qty Rcvd
                          </th>
                        )}
                        {colCost && (
                          <th className={styles.thCellRight} style={{ width: 90 }}>
                            Unit Cost
                          </th>
                        )}
                        {colAmount && (
                          <th className={styles.thCellLast} style={{ width: 90 }}>
                            Amount
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => (
                        <tr key={line.id} className={styles.lineRow}>
                          <td className={styles.dragCell}>
                            <span className={`material-symbols-outlined ${styles.dragHandle}`}>
                              drag_indicator
                            </span>
                          </td>
                          {colNum && <td className={styles.numCell}>{idx + 1}</td>}
                          {colItem && (
                            <td className={styles.inputCell}>
                              <input
                                className={styles.cellInput}
                                value={line.item}
                                onChange={(e) =>
                                  handleUpdateLine(line.id, 'item', e.target.value)
                                }
                              />
                              {showSku && (
                                <div className={styles.itemSku}>
                                  SKU: {line.sku}
                                </div>
                              )}
                            </td>
                          )}
                          {colDesc && (
                            <td className={styles.inputCell}>
                              <input
                                className={styles.cellInput}
                                value={line.description}
                                onChange={(e) =>
                                  handleUpdateLine(line.id, 'description', e.target.value)
                                }
                              />
                            </td>
                          )}
                          {colQtyOrd && (
                            <td className={styles.numberCell}>
                              <input
                                className={styles.cellInput}
                                style={{ textAlign: 'right' }}
                                type="number"
                                value={line.qtyOrd}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    line.id,
                                    'qtyOrd',
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                            </td>
                          )}
                          {colQtyRcvd && (
                            <td className={styles.numberCell}>
                              <input
                                className={styles.cellInput}
                                style={{
                                  textAlign: 'right',
                                  color: line.qtyRcvd > 0 ? '#0a6400' : '#5a6355',
                                  fontWeight: 600,
                                }}
                                type="number"
                                value={line.qtyRcvd}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    line.id,
                                    'qtyRcvd',
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                            </td>
                          )}
                          {colCost && (
                            <td className={styles.numberCell}>
                              <input
                                className={styles.cellInput}
                                style={{ textAlign: 'right' }}
                                type="number"
                                step="0.5"
                                value={line.unitCost}
                                onChange={(e) =>
                                  handleUpdateLine(
                                    line.id,
                                    'unitCost',
                                    Number(e.target.value) || 0
                                  )
                                }
                              />
                            </td>
                          )}
                          {colAmount && (
                            <td className={styles.numberCellLast}>
                              {formatCurrency(line.qtyOrd * line.unitCost)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className={styles.tableBtnGroup}>
                    <button
                      type="button"
                      className={styles.tableBtn}
                      onClick={handleAddLine}
                    >
                      Add line item
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        expand_more
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.tableBtn}
                      onClick={handleClearLines}
                    >
                      Clear all lines
                    </button>
                  </div>

                  {/* Notes & Totals */}
                  <div className={styles.bottomSection}>
                    <div className={styles.notesArea}>
                      <div>
                        <label className={styles.sectionLabel}>
                          Vendor Instructions / Notes
                        </label>
                        <textarea
                          className={styles.textarea}
                          placeholder="Include packing slip with PO number. Do not substitute items without approval."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className={styles.sectionLabel}>Attachments</label>
                        <div
                          className={styles.attachmentDropzone}
                          onClick={() => onToast?.('Attachments upload dialog opened')}
                        >
                          <div className={styles.dropzoneTitle}>Add attachment</div>
                          <div className={styles.dropzoneDesc}>Max file size: 20 MB</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.totalsArea}>
                      <div className={styles.totalsRow}>
                        <span className={styles.totalsRowMuted}>Subtotal</span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
                      </div>
                      <div className={styles.totalsRow}>
                        <span className={styles.totalsRowMuted}>Shipping</span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(shipping)}</span>
                      </div>
                      <div className={styles.totalsRow}>
                        <span className={styles.totalsRowMuted}>Tax</span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(tax)}</span>
                      </div>
                      <div className={styles.totalsRowFinal}>
                        <span>PO Total</span>
                        <span>{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. EMAIL VIEW */}
          {viewMode === 'email' && (
            <div className={styles.emailCard}>
              <div className={styles.emailBanner}>
                <h2 className={styles.emailTitle}>Purchase Order PO-1001</h2>
                <div className={styles.emailCompany}>Unsaid</div>
                <div className={styles.emailBadgeBox}>
                  <div className={styles.emailBadgeLabel}>PO Total</div>
                  <div className={styles.emailBadgeAmount}>
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
              </div>

              <div className={styles.emailBody}>
                <div className={styles.emailParagraph}>
                  <p>Hi {activeVendor.name},</p>
                  <p>
                    Please find attached our purchase order PO-1001. Please confirm
                    receipt and expected delivery date of {deliveryDate}.
                  </p>
                </div>
                <div className={styles.emailCtaWrapper}>
                  <button
                    type="button"
                    className={styles.emailCtaBtn}
                    onClick={() => setViewMode('vendor')}
                  >
                    View Purchase Order
                  </button>
                </div>
                <div className={styles.emailFooter}>
                  <p style={{ fontWeight: 600, color: '#1a1c1e', marginBottom: 2 }}>
                    Unsaid
                  </p>
                  <p>123 Business Rd, Suite 100</p>
                  <p>hello@unsaid.com</p>
                </div>
              </div>
            </div>
          )}

          {/* 3. VENDOR VIEW */}
          {viewMode === 'vendor' && (
            <div className={styles.vendorCard}>
              <div className={styles.docHeader}>
                <div>
                  <h1 className={styles.companyTitle} style={{ fontSize: 28 }}>
                    PURCHASE ORDER
                  </h1>
                  <div className={styles.companyName}>Unsaid</div>
                </div>
                <div className={styles.poNumberBlock}>
                  <div className={styles.poLabel}>PO Total</div>
                  <div className={styles.poValue} style={{ fontSize: 24 }}>
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
              </div>

              <div className={styles.partyGrid}>
                <div>
                  <div className={styles.partyLabel}>Vendor</div>
                  <div className={styles.partyName}>{activeVendor.name}</div>
                  <div className={styles.partyDetails}>
                    {activeVendor.email}
                    <br />
                    {activeVendor.phone}
                  </div>
                </div>
                <div>
                  <div className={styles.partyLabel}>Ship To</div>
                  <div className={styles.partyName}>Unsaid Warehouse</div>
                  <div className={styles.partyDetails}>
                    456 Warehouse Way, Dock 4
                    <br />
                    Springfield, IL 62701
                  </div>
                </div>
              </div>

              <div className={styles.metaGrid}>
                <div>
                  <span className={styles.fieldLabel}>PO Number</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>PO-1001</span>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Order Date</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{orderDate}</span>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Expected Delivery</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{deliveryDate}</span>
                </div>
                <div>
                  <span className={styles.fieldLabel}>Terms</span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{paymentTerms}</span>
                </div>
              </div>

              <table className={styles.linesTable} style={{ marginBottom: 32 }}>
                <thead>
                  <tr className={styles.linesHeaderRow}>
                    <th className={styles.thCell}>Item</th>
                    <th className={styles.thCell}>Description</th>
                    <th className={styles.thCellRight}>Qty Ord</th>
                    <th className={styles.thCellRight}>Unit Cost</th>
                    <th className={styles.thCellLast}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className={styles.lineRow}>
                      <td style={{ fontWeight: 500 }}>{l.item}</td>
                      <td style={{ color: '#5a6355' }}>
                        SKU: {l.sku} · {l.description}
                      </td>
                      <td style={{ textAlign: 'right' }}>{l.qtyOrd}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(l.unitCost)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatCurrency(l.qtyOrd * l.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 48 }}>
                <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#5a6355' }}>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#5a6355' }}>Shipping</span>
                    <span>{formatCurrency(shipping)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      fontWeight: 600,
                      borderTop: '1px solid #dad9dd',
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid #dad9dd',
                  paddingTop: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#5a6355',
                }}
              >
                <p>
                  Please include PO Number <strong>PO-1001</strong> on all packing slips and invoices.
                </p>
              </div>
            </div>
          )}

          {/* 4. PDF VIEW */}
          {viewMode === 'pdf' && (
            <div className={styles.pdfCard}>
              <div className={styles.docHeader} style={{ marginBottom: 48 }}>
                <div>
                  <div className={styles.companyTitle} style={{ fontSize: 24, marginBottom: 4 }}>
                    PURCHASE ORDER
                  </div>
                  <div className={styles.companyName}>Unsaid</div>
                  <div className={styles.companyMeta} style={{ marginTop: 4 }}>
                    123 Business Rd, Suite 100
                  </div>
                </div>
                <div className={styles.poNumberBlock}>
                  <div className={styles.poLabel}>PO Total</div>
                  <div className={styles.poValue} style={{ fontSize: 28, fontWeight: 700 }}>
                    {formatCurrency(grandTotal)}
                  </div>
                </div>
              </div>

              <div className={styles.partyGrid} style={{ marginBottom: 48 }}>
                <div>
                  <div className={styles.partyLabel}>Vendor</div>
                  <div className={styles.partyName}>{activeVendor.name}</div>
                  <div className={styles.partyDetails}>
                    {activeVendor.email}
                    <br />
                    {activeVendor.phone}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={styles.partyLabel}>Ship To</div>
                  <div className={styles.partyName}>Unsaid Warehouse</div>
                  <div className={styles.partyDetails}>
                    456 Warehouse Way, Dock 4
                    <br />
                    Springfield, IL 62701
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 36,
                  fontSize: 12,
                }}
              >
                <table>
                  <tbody>
                    <tr>
                      <td style={{ color: '#5a6355', paddingRight: 16, paddingBottom: 4 }}>
                        PO Number
                      </td>
                      <td style={{ fontWeight: 600 }}>PO-1001</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#5a6355', paddingRight: 16, paddingBottom: 4 }}>
                        Order Date
                      </td>
                      <td style={{ fontWeight: 600 }}>{orderDate}</td>
                    </tr>
                  </tbody>
                </table>
                <table>
                  <tbody>
                    <tr>
                      <td style={{ color: '#5a6355', paddingRight: 16, paddingBottom: 4 }}>
                        Expected Delivery
                      </td>
                      <td style={{ fontWeight: 600 }}>{deliveryDate}</td>
                    </tr>
                    <tr>
                      <td style={{ color: '#5a6355', paddingRight: 16, paddingBottom: 4 }}>
                        Terms
                      </td>
                      <td style={{ fontWeight: 600 }}>{paymentTerms}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <table className={styles.linesTable} style={{ marginBottom: 32, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #dad9dd', color: '#5a6355', fontWeight: 700 }}>
                    <th style={{ padding: '12px 0' }}>Item / SKU</th>
                    <th style={{ padding: '12px 0' }}>Description</th>
                    <th style={{ padding: '12px 0', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '12px 0', textAlign: 'right' }}>Unit Cost</th>
                    <th style={{ padding: '12px 0', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #eeedf1' }}>
                      <td style={{ padding: '16px 0', fontWeight: 600 }}>
                        {l.item}
                        <br />
                        <span style={{ color: '#6f7a69', fontWeight: 400, fontSize: 11 }}>
                          SKU: {l.sku}
                        </span>
                      </td>
                      <td style={{ padding: '16px 0', color: '#5a6355' }}>{l.description}</td>
                      <td style={{ padding: '16px 0', textAlign: 'right' }}>{l.qtyOrd}</td>
                      <td style={{ padding: '16px 0', textAlign: 'right' }}>{formatCurrency(l.unitCost)}</td>
                      <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(l.qtyOrd * l.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #dad9dd', paddingTop: 16 }}>
                <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#5a6355' }}>Subtotal</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#5a6355' }}>Shipping</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(shipping)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      fontWeight: 700,
                      borderTop: '1px solid #eeedf1',
                      paddingTop: 8,
                      marginTop: 4,
                    }}
                  >
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 64, textAlign: 'center', fontSize: 11, color: '#6f7a69' }}>
                <p>Please include PO Number PO-1001 on all packing slips.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Sidebar Controls (only in Edit view) */}
        {viewMode === 'edit' && sidebarOpen && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>PO-1001</h2>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className={styles.sidebarBody}>
              {/* Status Dropdown */}
              <div className={styles.statusDropdownContainer}>
                <button
                  type="button"
                  className={styles.statusSelectBtn}
                  onClick={() => setStatusMenuOpen((prev) => !prev)}
                >
                  {status}
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    expand_more
                  </span>
                </button>

                {statusMenuOpen && (
                  <div className={styles.dropdownMenu}>
                    {(
                      [
                        'Open',
                        'Sent to Vendor',
                        'Partially Received',
                        'Fully Received',
                        'Cancelled',
                      ] as POStatus[]
                    ).map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={styles.dropdownMenuItem}
                        onClick={() => {
                          setStatus(st);
                          setStatusMenuOpen(false);
                          onToast?.(`Status changed to ${st}`);
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Accordions Stack */}
              <div className={styles.accordionsStack}>
                {/* 1. Customization */}
                <div className={styles.accordionCard}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => toggleAccordion('customization')}
                  >
                    Customization
                    <span className="material-symbols-outlined">
                      {expandedAccordions.customization ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expandedAccordions.customization && (
                    <div className={styles.accordionContent}>
                      <div className={styles.switchRow}>
                        <span>Show SKU</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={showSku}
                            onChange={(e) => setShowSku(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Show Unit Cost</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={showUnitCost}
                            onChange={(e) => setShowUnitCost(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Show Receiving Status</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={showReceivingStatus}
                            onChange={(e) => setShowReceivingStatus(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Show Vendor Part No.</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={showVendorPartNo}
                            onChange={(e) => setShowVendorPartNo(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>

                      <div className={styles.tableContentSubhead}>
                        <span className={styles.subheadTitle}>Table content</span>
                        <button
                          type="button"
                          className={styles.subheadLink}
                          onClick={() => onToast?.('Label editing enabled')}
                        >
                          Edit labels
                        </button>
                      </div>

                      <div className={styles.switchRow}>
                        <span>#</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colNum}
                            onChange={(e) => setColNum(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Item / SKU</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colItem}
                            onChange={(e) => setColItem(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Description</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colDesc}
                            onChange={(e) => setColDesc(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Qty Ordered</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colQtyOrd}
                            onChange={(e) => setColQtyOrd(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Qty Received</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colQtyRcvd}
                            onChange={(e) => setColQtyRcvd(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Unit Cost</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colCost}
                            onChange={(e) => setColCost(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                      <div className={styles.switchRow}>
                        <span>Amount</span>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            checked={colAmount}
                            onChange={(e) => setColAmount(e.target.checked)}
                          />
                          <span className={styles.slider}></span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Receiving */}
                <div className={styles.accordionCard}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => toggleAccordion('receiving')}
                  >
                    Receiving
                    <span className="material-symbols-outlined">
                      {expandedAccordions.receiving ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expandedAccordions.receiving && (
                    <div className={styles.accordionContent}>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>Items ordered</span>
                        <span style={{ fontWeight: 500 }}>{totalQtyOrd}</span>
                      </div>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>Items received</span>
                        <span style={{ fontWeight: 600, color: '#0a6400' }}>
                          {totalQtyRcvd}
                        </span>
                      </div>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>Items remaining</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: totalQtyRemaining > 0 ? '#ba1a1a' : '#0a6400',
                          }}
                        >
                          {totalQtyRemaining}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.receiveItemsBtn}
                        onClick={handleReceiveItems}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          local_shipping
                        </span>
                        Receive items
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Billing & Terms */}
                <div className={styles.accordionCard}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => toggleAccordion('billing')}
                  >
                    Billing &amp; Terms
                    <span className="material-symbols-outlined">
                      {expandedAccordions.billing ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expandedAccordions.billing && (
                    <div className={styles.accordionContent}>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>Payment Terms</span>
                        <span style={{ fontWeight: 500 }}>{paymentTerms}</span>
                      </div>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>Ship Via</span>
                        <span style={{ fontWeight: 500 }}>{shipVia}</span>
                      </div>
                      <div className={styles.kpiStatRow}>
                        <span className={styles.kpiStatLabel}>FOB</span>
                        <span style={{ fontWeight: 500 }}>Destination</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Attachments */}
                <div className={styles.accordionCard}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => toggleAccordion('attachments')}
                  >
                    Attachments
                    <span className="material-symbols-outlined">
                      {expandedAccordions.attachments ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expandedAccordions.attachments && (
                    <div
                      className={styles.accordionContent}
                      style={{ color: '#5a6355', fontSize: 13 }}
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
      <footer className={styles.footer}>
        <div style={{ width: '30%' }}></div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <button
            type="button"
            className={styles.printLink}
            onClick={() => onToast?.('Printing or downloading PO-1001...')}
          >
            Print or download
          </button>
        </div>

        <div className={styles.footerActions} style={{ width: '30%', justifyContent: 'flex-end' }}>
          {/* Split Save button */}
          <div className={styles.splitBtnGroup}>
            <button
              type="button"
              className={styles.splitBtnMain}
              onClick={() => onToast?.('Saved PO-1001 successfully')}
            >
              Save
            </button>
            <button
              type="button"
              className={styles.splitBtnArrow}
              onClick={() => {
                setSaveMenuOpen((prev) => !prev);
                setSendMenuOpen(false);
              }}
              title="Save options"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                expand_more
              </span>
            </button>

            {saveMenuOpen && (
              <div className={styles.floatingMenu}>
                <button
                  type="button"
                  className={styles.floatingMenuItem}
                  onClick={() => {
                    setSaveMenuOpen(false);
                    onToast?.('Saved and new PO started');
                  }}
                >
                  Save and new
                </button>
                <button
                  type="button"
                  className={styles.floatingMenuItem}
                  onClick={() => {
                    setSaveMenuOpen(false);
                    onToast?.('Saved and closed');
                    if (onClose) onClose();
                  }}
                >
                  Save and close
                </button>
              </div>
            )}
          </div>

          {/* Split Send button */}
          <div className={styles.splitBtnGroup}>
            <button
              type="button"
              className={styles.splitBtnPrimaryMain}
              onClick={() => {
                setStatus('Sent to Vendor');
                onToast?.(`Preparing to send PO-1001 to ${activeVendor.name}...`);
              }}
            >
              Send to Vendor
            </button>
            <button
              type="button"
              className={styles.splitBtnPrimaryArrow}
              onClick={() => {
                setSendMenuOpen((prev) => !prev);
                setSaveMenuOpen(false);
              }}
              title="Send options"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                expand_more
              </span>
            </button>

            {sendMenuOpen && (
              <div className={styles.floatingMenu}>
                <button
                  type="button"
                  className={styles.floatingMenuItem}
                  onClick={() => {
                    setSendMenuOpen(false);
                    setStatus('Sent to Vendor');
                    onToast?.(`Opening send flow to ${activeVendor.email}...`);
                  }}
                >
                  Send to Vendor
                </button>
                <button
                  type="button"
                  className={styles.floatingMenuItem}
                  onClick={() => {
                    setSendMenuOpen(false);
                    onToast?.('Downloading PDF PO-1001...');
                  }}
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
