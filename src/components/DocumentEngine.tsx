import styles from './DocumentEngine.module.css';

export type DocTabType = 'edit' | 'email' | 'payor' | 'pdf';

interface DocumentEngineProps {
  open: boolean;
  activeTab: DocTabType;
  onSelectTab: (tab: DocTabType) => void;
  onClose: () => void;
}

const DOC_TABS: { id: DocTabType; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'email', label: 'Email view' },
  { id: 'payor', label: 'Payor view' },
  { id: 'pdf', label: 'PDF view' },
];

export default function DocumentEngine({
  open,
  activeTab,
  onSelectTab,
  onClose,
}: DocumentEngineProps) {
  return (
    <div
      id="doc-engine"
      className={`${styles.docEngine} ${!open ? styles.hiddenImp : ''}`}
    >
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={`material-symbols-outlined ${styles.iconOutline}`}>history</span>
          <span id="doc-title" className={styles.docTitle}>
            Invoice 1002
          </span>
        </div>
        <div className={styles.docTabs}>
          {DOC_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-doctab={t.id}
              className={`${styles.docTab} ${
                activeTab === t.id ? styles.docTabActive : ''
              }`}
              onClick={() => onSelectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.topBarRight}>
          <button type="button" className={styles.topActionBtn}>
            <span className={`material-symbols-outlined ${styles.icon18}`}>settings</span>
            Manage
          </button>
          <button type="button" className={styles.topActionBtn}>
            <span className={`material-symbols-outlined ${styles.icon18}`}>chat</span>
            Feedback
          </button>
          <button
            id="doc-close"
            type="button"
            className={styles.closeRoundBtn}
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <div className={styles.canvasArea}>
        {/* EDIT PANEL */}
        <div
          className={`${styles.panelEdit} ${activeTab !== 'edit' ? styles.hiddenImp : ''}`}
          data-docpanel="edit"
        >
          <div className={styles.editTop}>
            <h1 className={styles.invoiceHeading}>INVOICE</h1>
            <div className={styles.editHeaderCols}>
              <div className={styles.halfCol}>
                <div className={styles.customerInputWrap}>
                  <input
                    className={styles.customerInput}
                    placeholder="Add customer"
                    type="text"
                  />
                  <span className={`material-symbols-outlined ${styles.icon18Dropdown}`}>
                    expand_more
                  </span>
                </div>
                <div className={styles.skeletonWide} />
                <div className={styles.skeletonNarrow} />
              </div>
              <div className={styles.metaRightCol}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Invoice no.</span>
                  <input className={styles.metaInput} defaultValue="1002" />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Terms</span>
                  <input className={styles.metaInput} defaultValue="Net 30" />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Invoice date</span>
                  <input className={styles.metaInput} defaultValue="11/01/2026" />
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Due date</span>
                  <input className={styles.metaInput} defaultValue="12/01/2026" />
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
                <tr className={styles.lineRow}>
                  <td className={styles.tdMuted}>1</td>
                  <td className={styles.tdCell}>
                    <input className={styles.lineInput} type="text" />
                  </td>
                  <td className={styles.tdCell}>
                    <input className={styles.lineInput} type="text" />
                  </td>
                  <td className={styles.tdCell}>
                    <input className={styles.lineInputRight} type="text" />
                  </td>
                  <td className={styles.tdCell}>
                    <input className={styles.lineInputRight} type="text" />
                  </td>
                  <td className={styles.tdMutedRight}>0.00</td>
                </tr>
              </tbody>
            </table>
            <div className={styles.lineBtns}>
              <button type="button" className={styles.smallOutlineBtn}>
                Add lines
              </button>
              <button type="button" className={styles.smallOutlineBtn}>
                Clear all lines
              </button>
            </div>
            <div className={styles.bottomSplit}>
              <div className={styles.bottomLeft}>
                <div>
                  <h3 className={styles.subHeading}>Customer payment options</h3>
                  <p className={styles.helperText}>
                    Activate online card or bank transfer payments.{' '}
                    <a
                      href="#"
                      className={styles.greenLink}
                      onClick={(e) => e.preventDefault()}
                    >
                      Activate payments
                    </a>
                  </p>
                  <textarea
                    className={styles.textarea20}
                    placeholder="Tell your customer how you want to get paid."
                  />
                </div>
                <div>
                  <h3 className={styles.subHeading}>Note to customer</h3>
                  <textarea
                    className={styles.textarea16}
                    placeholder="Thank you for your business."
                  />
                </div>
                <div>
                  <h3 className={styles.subHeading}>Attachments</h3>
                  <div className={styles.attachmentDrop}>
                    <span className={styles.attachmentPrimary}>Add attachment</span>
                    <p className={styles.attachmentSub}>Max file size: 20 MB</p>
                  </div>
                </div>
              </div>
              <div className={styles.totalsCol}>
                <div className={styles.totalRow}>
                  <span className={styles.mutedText}>Subtotal</span>
                  <span>$0.00</span>
                </div>
                <div className={styles.totalRow}>
                  <span className={styles.mutedText}>Invoice total</span>
                  <span>$0.00</span>
                </div>
                <div className={styles.rightAlignRow}>
                  <a
                    href="#"
                    className={styles.greenLinkSmall}
                    onClick={(e) => e.preventDefault()}
                  >
                    + Charge a deposit
                  </a>
                </div>
                <div className={styles.rightAlignRow}>
                  <a
                    href="#"
                    className={styles.greenLinkSmall}
                    onClick={(e) => e.preventDefault()}
                  >
                    Edit totals
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* EMAIL PANEL */}
        <div
          className={`${styles.panelEmail} ${activeTab !== 'email' ? styles.hiddenImp : ''}`}
          data-docpanel="email"
        >
          <div className={styles.emailHero}>
            <h2 className={styles.emailHeading}>Your invoice is ready!</h2>
            <p className={styles.emailSub}>Total $0.00</p>
            <p className={styles.emailBalanceLabel}>Balance Due</p>
            <p className={styles.emailBalanceVal}>$0.00</p>
          </div>
          <p className={styles.emailMessageText}>The email message you write will go here</p>
          <button type="button" className={styles.emailCtaBtn}>
            View details
          </button>
          <div className={styles.emailFooter}>
            <h3 className={styles.emailCompany}>Unsaid</h3>
            <p className={styles.emailContact}>besttimemke@gmail.com</p>
            <p className={styles.emailContact}>+1 (901) 210-3145</p>
          </div>
        </div>

        {/* PAYOR PANEL */}
        <div
          className={`${styles.panelPayor} ${activeTab !== 'payor' ? styles.hiddenImp : ''}`}
          data-docpanel="payor"
        >
          <div className={styles.payorWrap}>
            <div className={styles.payorLeft}>
              <div className={styles.payorBalanceBox}>
                <p className={styles.payorBalanceLabel}>Balance Due</p>
                <p className={styles.payorBalanceVal}>$0.00</p>
                <p className={styles.payorCopy}>© 2026 Intuit Inc. All rights reserved.</p>
              </div>
              <div className={styles.payorDetailBox}>
                <h3 className={styles.payorCompanyTitle}>Unsaid</h3>
                <div className={styles.payorGrid}>
                  <span className={styles.mutedText}>Invoice</span>
                  <span className={styles.alignRight}>1002</span>
                  <span className={styles.mutedText}>Due date</span>
                  <span className={styles.alignRight}>December 1, 2026</span>
                  <span className={styles.mutedText}>Invoice amount</span>
                  <span className={styles.alignRight}>$0.00</span>
                </div>
                <div className={styles.payorBtns}>
                  <button type="button" className={styles.payorViewBtn}>
                    View Invoice
                  </button>
                  <button type="button" className={styles.payorIconBtn}>
                    <span className={`material-symbols-outlined ${styles.icon18}`}>
                      download
                    </span>
                  </button>
                  <button type="button" className={styles.payorIconBtn}>
                    <span className={`material-symbols-outlined ${styles.icon18}`}>
                      print
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.payorRight}>
              <h3 className={styles.payorOptHeading}>Payment options</h3>
              <div className={styles.payorOptList}>
                <div className={styles.payorOptRow}>
                  <span>Invoice total</span>
                  <div className={styles.switchOn}>
                    <div className={styles.switchKnobOn} />
                  </div>
                </div>
                <div className={styles.payorOptRow}>
                  <span>Deposit</span>
                  <div className={styles.switchOff}>
                    <div className={styles.switchKnobOff} />
                  </div>
                </div>
                <div className={styles.payorOptRow}>
                  <span>Discount</span>
                  <div className={styles.switchOff}>
                    <div className={styles.switchKnobOff} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PDF PANEL */}
        <div
          className={`${styles.panelPdf} ${activeTab !== 'pdf' ? styles.hiddenImp : ''}`}
          data-docpanel="pdf"
        >
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
              <span>Invoice no.: 1002</span>
              <span>Terms: Net 30</span>
              <span>Invoice date: 11/01/2026</span>
              <span>Due date: 12/01/2026</span>
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
              <tr className={styles.lineRow}>
                <td className={styles.pdfTdEmpty}>1</td>
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            </tbody>
          </table>
          <div className={styles.pdfTotalWrap}>
            <div className={styles.pdfTotalBox}>
              <div className={styles.pdfTotalRow}>
                <span>Total</span>
                <span>$0.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <button
          id="doc-cancel"
          type="button"
          className={styles.cancelBtn}
          onClick={onClose}
        >
          Cancel
        </button>
        <div className={styles.bottomBarRight}>
          <button type="button" className={styles.textBtnUnderline}>
            Print or download
          </button>
          <button type="button" className={styles.textBtnMuted}>
            Make recurring
          </button>
          <div className={styles.splitBtn}>
            <button type="button" className={styles.splitSecondaryMain}>
              Save
            </button>
            <button type="button" className={styles.splitSecondaryArrow}>
              <span className={`material-symbols-outlined ${styles.icon16}`}>
                expand_more
              </span>
            </button>
          </div>
          <div className={styles.splitBtn}>
            <button type="button" className={styles.splitPrimaryMain}>
              Review and send
            </button>
            <button type="button" className={styles.splitPrimaryArrow}>
              <span className={`material-symbols-outlined ${styles.icon16}`}>
                expand_more
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
