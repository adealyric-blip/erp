import { useState } from 'react';
import styles from './DocumentEngine.module.css';
import RowMenu from './ListPrimitives';

export type DocTabType = 'edit' | 'email' | 'payor' | 'pdf';

interface LineItem {
  id: number;
  product: string;
  description: string;
  qty: string;
  rate: string;
}

interface DocumentEngineProps {
  open: boolean;
  activeTab: DocTabType;
  onSelectTab: (tab: DocTabType) => void;
  onClose: () => void;
  onToast?: (msg: string) => void;
}

const DOC_TABS: { id: DocTabType; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'email', label: 'Email view' },
  { id: 'payor', label: 'Payor view' },
  { id: 'pdf', label: 'PDF view' },
];

let lineIdCounter = 1;

export default function DocumentEngine({
  open,
  activeTab,
  onSelectTab,
  onClose,
  onToast,
}: DocumentEngineProps) {
  // ── Form state ──
  const [customer, setCustomer] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('1002');
  const [terms, setTerms] = useState('Net 30');
  const [invoiceDate, setInvoiceDate] = useState('11/01/2026');
  const [dueDate, setDueDate] = useState('12/01/2026');
  const [paymentNote, setPaymentNote] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [lines, setLines] = useState<LineItem[]>([
    { id: 0, product: '', description: '', qty: '', rate: '' },
  ]);

  // ── Computed totals ──
  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.qty) || 0;
    const rate = parseFloat(l.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const total = subtotal;

  const handleAddLine = () => {
    setLines((prev) => [...prev, { id: lineIdCounter++, product: '', description: '', qty: '', rate: '' }]);
  };
  const handleClearLines = () => {
    setLines([{ id: lineIdCounter++, product: '', description: '', qty: '', rate: '' }]);
  };
  const handleLineChange = (id: number, field: keyof LineItem, value: string) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const formatMoney = (n: number) => `$${n.toFixed(2)}`;

  const handleSave = () => {
    if (!customer.trim()) {
      onToast?.('Please add a customer before saving.');
      return;
    }
    onToast?.(`Invoice ${invoiceNo} saved — ${formatMoney(total)}.`);
    onClose();
  };

  const handleReviewAndSend = () => {
    if (!customer.trim()) {
      onToast?.('Please add a customer before sending.');
      return;
    }
    onToast?.(`Invoice ${invoiceNo} sent to ${customer} — ${formatMoney(total)}.`);
    onClose();
  };

  return (
    <div id="doc-engine" className={`${styles.docEngine} ${!open ? styles.hiddenImp : ''}`}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={`material-symbols-outlined ${styles.iconOutline}`}>history</span>
          <span id="doc-title" className={styles.docTitle}>Invoice {invoiceNo}</span>
        </div>
        <div className={styles.docTabs}>
          {DOC_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-doctab={t.id}
              className={`${styles.docTab} ${activeTab === t.id ? styles.docTabActive : ''}`}
              onClick={() => onSelectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.topBarRight}>
          <button type="button" className={styles.topActionBtn} onClick={() => onToast?.('Document settings — opening')}>
            <span className={`material-symbols-outlined ${styles.icon18}`}>settings</span>
            Manage
          </button>
          <button type="button" className={styles.topActionBtn} onClick={() => onToast?.('Feedback — opening')}>
            <span className={`material-symbols-outlined ${styles.icon18}`}>chat</span>
            Feedback
          </button>
          <button id="doc-close" type="button" className={styles.closeRoundBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div className={styles.canvasArea}>
        {/* ── EDIT PANEL ── */}
        <div className={`${styles.panelEdit} ${activeTab !== 'edit' ? styles.hiddenImp : ''}`} data-docpanel="edit">
          <div className={styles.editTop}>
            <h1 className={styles.invoiceHeading}>INVOICE</h1>
            <div className={styles.editHeaderCols}>
              <div className={styles.halfCol}>
                <div className={styles.customerInputWrap}>
                  <input
                    className={styles.customerInput}
                    placeholder="Add customer"
                    type="text"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                  <span className={`material-symbols-outlined ${styles.icon18Dropdown}`}>expand_more</span>
                </div>
              </div>
              <div className={styles.metaRightCol}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Invoice no.</span>
                  <input className={styles.metaInput} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Terms</span>
                  <input className={styles.metaInput} value={terms} onChange={(e) => setTerms(e.target.value)} />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Invoice date</span>
                  <input className={styles.metaInput} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Due date</span>
                  <input className={styles.metaInput} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.editBody}>
            <div className={styles.sectionTitle}>Product or service</div>
            <table className={styles.linesTable}>
              <thead className={styles.linesHead}>
                <tr>
                  <th className={styles.thNum}>#</th>
                  <th className={styles.thText}>Product/service</th>
                  <th className={styles.thText}>Description</th>
                  <th className={styles.thQty}>Qty</th>
                  <th className={styles.thMoney}>Rate</th>
                  <th className={styles.thMoney}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} className={styles.lineRow}>
                    <td className={styles.tdMuted}>{i + 1}</td>
                    <td className={styles.tdCell}>
                      <input className={styles.lineInput} type="text" value={l.product} onChange={(e) => handleLineChange(l.id, 'product', e.target.value)} placeholder="Product or service" />
                    </td>
                    <td className={styles.tdCell}>
                      <input className={styles.lineInput} type="text" value={l.description} onChange={(e) => handleLineChange(l.id, 'description', e.target.value)} placeholder="Description" />
                    </td>
                    <td className={styles.tdCell}>
                      <input className={styles.lineInputRight} type="number" value={l.qty} onChange={(e) => handleLineChange(l.id, 'qty', e.target.value)} placeholder="0" />
                    </td>
                    <td className={styles.tdCell}>
                      <input className={styles.lineInputRight} type="number" value={l.rate} onChange={(e) => handleLineChange(l.id, 'rate', e.target.value)} placeholder="0.00" />
                    </td>
                    <td className={styles.tdMutedRight}>{((parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.lineBtns}>
              <button type="button" className={styles.smallOutlineBtn} onClick={handleAddLine}>Add lines</button>
              <button type="button" className={styles.smallOutlineBtn} onClick={handleClearLines}>Clear all lines</button>
            </div>

            <div className={styles.bottomSplit}>
              <div className={styles.bottomLeft}>
                <div>
                  <h3 className={styles.subHeading}>Customer payment options</h3>
                  <p className={styles.helperText}>
                    Activate online card or bank transfer payments.{' '}
                    <a href="#" className={styles.greenLink} onClick={(e) => { e.preventDefault(); onToast?.('Opening payment setup…'); }}>Activate payments</a>
                  </p>
                  <textarea className={styles.textarea20} placeholder="Tell your customer how you want to get paid." value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
                </div>
                <div>
                  <h3 className={styles.subHeading}>Note to customer</h3>
                  <textarea className={styles.textarea16} placeholder="Thank you for your business." value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} />
                </div>
                <div>
                  <h3 className={styles.subHeading}>Attachments</h3>
                  <div className={styles.attachmentDrop} onClick={() => onToast?.('File picker would open.')}>
                    <span className={styles.attachmentPrimary}>Add attachment</span>
                    <p className={styles.attachmentSub}>Max file size: 20 MB</p>
                  </div>
                </div>
              </div>
              <div className={styles.totalsCol}>
                <div className={styles.totalRow}>
                  <span className={styles.mutedText}>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span className={styles.mutedText}>Invoice total</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <div className={styles.rightAlignRow}>
                  <a href="#" className={styles.greenLinkSmall} onClick={(e) => { e.preventDefault(); onToast?.('Charge a deposit — opening'); }}>+ Charge a deposit</a>
                </div>
                <div className={styles.rightAlignRow}>
                  <a href="#" className={styles.greenLinkSmall} onClick={(e) => { e.preventDefault(); onToast?.('Edit totals — opening'); }}>Edit totals</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── EMAIL PANEL ── */}
        <div className={`${styles.panelEmail} ${activeTab !== 'email' ? styles.hiddenImp : ''}`} data-docpanel="email">
          <div className={styles.emailHero}>
            <h2 className={styles.emailHeading}>Your invoice is ready!</h2>
            <p className={styles.emailSub}>Total {formatMoney(total)}</p>
            <p className={styles.emailBalanceLabel}>Balance Due</p>
            <p className={styles.emailBalanceVal}>{formatMoney(total)}</p>
          </div>
          <p className={styles.emailMessageText}>{customerNote || 'The email message you write will go here'}</p>
          <button type="button" className={styles.emailCtaBtn} onClick={() => onSelectTab('edit')}>View details</button>
          <div className={styles.emailFooter}>
            <h3 className={styles.emailCompany}>Unsaid</h3>
            <p className={styles.emailContact}>besttimemke@gmail.com</p>
            <p className={styles.emailContact}>+1 (901) 210-3145</p>
          </div>
        </div>

        {/* ── PAYOR PANEL ── */}
        <div className={`${styles.panelPayor} ${activeTab !== 'payor' ? styles.hiddenImp : ''}`} data-docpanel="payor">
          <div className={styles.payorWrap}>
            <div className={styles.payorLeft}>
              <div className={styles.payorBalanceBox}>
                <p className={styles.payorBalanceLabel}>Balance Due</p>
                <p className={styles.payorBalanceVal}>{formatMoney(total)}</p>
              </div>
              <div className={styles.payorDetailBox}>
                <h3 className={styles.payorCompanyTitle}>Unsaid</h3>
                <div className={styles.payorGrid}>
                  <span className={styles.mutedText}>Invoice</span>
                  <span className={styles.alignRight}>{invoiceNo}</span>
                  <span className={styles.mutedText}>Due date</span>
                  <span className={styles.alignRight}>{dueDate}</span>
                  <span className={styles.mutedText}>Invoice amount</span>
                  <span className={styles.alignRight}>{formatMoney(total)}</span>
                </div>
                <div className={styles.payorBtns}>
                  <button type="button" className={styles.payorViewBtn} onClick={() => onSelectTab('edit')}>View Invoice</button>
                  <button type="button" className={styles.payorIconBtn} onClick={() => { onToast?.('Downloading PDF…'); setTimeout(() => window.print(), 300); }}>
                    <span className={`material-symbols-outlined ${styles.icon18}`}>download</span>
                  </button>
                  <button type="button" className={styles.payorIconBtn} onClick={() => window.print()}>
                    <span className={`material-symbols-outlined ${styles.icon18}`}>print</span>
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.payorRight}>
              <h3 className={styles.payorOptHeading}>Payment options</h3>
              <div className={styles.payorOptList}>
                <div className={styles.payorOptRow}><span>Invoice total</span><div className={styles.switchOn}><div className={styles.switchKnobOn} /></div></div>
                <div className={styles.payorOptRow}><span>Deposit</span><div className={styles.switchOff}><div className={styles.switchKnobOff} /></div></div>
                <div className={styles.payorOptRow}><span>Discount</span><div className={styles.switchOff}><div className={styles.switchKnobOff} /></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PDF PANEL ── */}
        <div className={`${styles.panelPdf} ${activeTab !== 'pdf' ? styles.hiddenImp : ''}`} data-docpanel="pdf">
          <div className={styles.pdfHeader}>
            <div>
              <h1 className={styles.pdfInvoiceTitle}>INVOICE</h1>
              <p className={styles.pdfCompanyName}>Unsaid</p>
            </div>
            <div className={styles.pdfContactRight}>
              <p>besttimemke@gmail.com</p>
              <p>+1 (901) 210-3145</p>
            </div>
          </div>
          <div className={styles.pdfDetailsBox}>
            <h3 className={styles.pdfDetailsTitle}>Invoice details</h3>
            <div className={styles.pdfDetailsGrid}>
              <span>Invoice no.: {invoiceNo}</span>
              <span>Terms: {terms}</span>
              <span>Invoice date: {invoiceDate}</span>
              <span>Due date: {dueDate}</span>
            </div>
          </div>
          <table className={styles.pdfTable}>
            <thead className={styles.pdfTableHead}>
              <tr>
                <th className={styles.thText}>#</th>
                <th className={styles.thText}>Product or service</th>
                <th className={styles.thText}>Description</th>
                <th className={`${styles.thText} ${styles.alignRight}`}>Qty</th>
                <th className={`${styles.thText} ${styles.alignRight}`}>Rate</th>
                <th className={`${styles.thText} ${styles.alignRight}`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const amount = (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0);
                return (
                  <tr key={l.id} className={styles.lineRow}>
                    <td className={styles.pdfTdEmpty}>{i + 1}</td>
                    <td>{l.product}</td>
                    <td>{l.description}</td>
                    <td className={styles.alignRight}>{l.qty}</td>
                    <td className={styles.alignRight}>{l.rate}</td>
                    <td className={styles.alignRight}>{amount.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.pdfTotalWrap}>
            <div className={styles.pdfTotalBox}>
              <div className={styles.pdfTotalRow}>
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className={styles.bottomBar}>
        <button id="doc-cancel" type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
        <div className={styles.bottomBarRight}>
          <button type="button" className={styles.textBtnUnderline} onClick={() => { onToast?.('Printing — opening print dialog'); setTimeout(() => window.print(), 300); }}>Print or download</button>
          <button type="button" className={styles.textBtnMuted} onClick={() => onToast?.('Make recurring — opening template')}>Make recurring</button>
          <div className={styles.splitBtn}>
            <button type="button" className={styles.splitSecondaryMain} onClick={handleSave}>Save</button>
            <RowMenu
              ariaLabel="Save options"
              items={[
                { label: 'Save and new', icon: 'add', onClick: () => { handleSave(); } },
                { label: 'Save and close', icon: 'check', onClick: () => { handleSave(); } },
                { label: 'Print or download', icon: 'print', dividerBefore: true, onClick: () => { onToast?.('Printing — opening print dialog'); setTimeout(() => window.print(), 300); } },
                { label: 'Make recurring', icon: 'repeat', onClick: () => onToast?.('Make recurring — opening template') },
              ]}
            />
          </div>
          <div className={styles.splitBtn}>
            <button type="button" className={styles.splitPrimaryMain} onClick={handleReviewAndSend}>Review and send</button>
            <RowMenu
              ariaLabel="Send options"
              items={[
                { label: 'Send later', icon: 'schedule', onClick: () => onToast?.('Scheduled — pick a date') },
                { label: 'Send a copy', icon: 'content_copy', onClick: () => onToast?.('Copy sent') },
                { label: 'Print or download', icon: 'print', dividerBefore: true, onClick: () => { onToast?.('Printing — opening print dialog'); setTimeout(() => window.print(), 300); } },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
