'use client';
import './accounting.css';
import { AccountingScreenProps, ACCT_NAV } from './types';

export default function AccountingOverview({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: AccountingScreenProps) {
  return (
    <div className="bg-background font-sans text-body-md text-on-surface antialiased">
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_balance</span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Accounting</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Overview</span>
        </div>
      </div>

      <main className="px-6 pb-12">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-headline-lg">Accounting — Overview</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Bank feed, receipts, reconcile, books. ManageKube LLC · Nov 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              onClick={() => onToast('Date range picker')}
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>This month ▾</button>
            <button
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
              onClick={() => onToast('Exporting…')}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>Export</button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-surface-dim p-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">For review</span>
            <div className="text-headline-lg mt-1 tabular-nums">47</div>
            <div className="text-[11px] text-tertiary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">schedule</span>Oldest 6 days ago</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Uncategorized</span>
            <div className="text-headline-lg mt-1 tabular-nums">$2,418.90</div>
            <div className="text-[11px] text-on-surface-variant mt-1">12 transactions</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Bank balance</span>
            <div className="text-headline-lg mt-1 tabular-nums">$84,210.40</div>
            <div className="text-[11px] text-secondary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">sync</span>2m ago · Chase •9910</div>
          </div>
          <div className="bg-white rounded-xl border border-surface-dim p-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">Reconciled</span>
            <div className="text-headline-lg mt-1 tabular-nums">Oct 31</div>
            <div className="text-[11px] text-secondary mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">check_circle</span>Period closed</div>
          </div>
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">Create actions:</span>
          <button
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            onClick={() => onCreate('Expense')}
          >
            <span className="material-symbols-outlined text-[16px]">credit_card</span>Expense</button>
          <button
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            onClick={() => onCreate('Bank deposit')}
          >
            <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>Bank deposit</button>
          <button
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            onClick={() => onCreate('Transfer')}
          >
            <span className="material-symbols-outlined text-[16px]">swap_horiz</span>Transfer</button>
          <button
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            onClick={() => onCreate('Journal entry')}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>Journal entry</button>
          <button
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
            onClick={() => onCreate('Reconcile')}
          >
            <span className="material-symbols-outlined text-[16px]">fact_check</span>Reconcile</button>
          <button
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
            onClick={onOpenCreateFlyout}
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all</button>
        </div>

        {/* Two-column: Setup checklist + Receipts inbox preview */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">

          {/* Setup checklist (§A: "Setup checklist card until company setup complete") */}
          <div className="bg-white rounded-xl border border-surface-dim p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-headline-sm">Set up your books</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">3 of 6 complete</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">50%</span>
            </div>
            <div className="progress-bar mb-3"><div style={{ width: '50%' }} /></div>
            <div>
              <div className="check-row">
                <div className="check-badge done"><span className="material-symbols-outlined text-[14px]">check</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Connect bank account</div>
                  <div className="text-[11px] text-on-surface-variant">Chase •9910 linked</div>
                </div>
              </div>
              <div className="check-row">
                <div className="check-badge done"><span className="material-symbols-outlined text-[14px]">check</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Chart of accounts</div>
                  <div className="text-[11px] text-on-surface-variant">34 accounts mapped</div>
                </div>
              </div>
              <div className="check-row">
                <div className="check-badge done"><span className="material-symbols-outlined text-[14px]">check</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">First reconciliation</div>
                  <div className="text-[11px] text-on-surface-variant">October closed</div>
                </div>
              </div>
              <div className="check-row">
                <div className="check-badge todo"><span className="material-symbols-outlined text-[14px]">chevron_right</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Import receipts</div>
                  <div className="text-[11px] text-on-surface-variant">12 awaiting review</div>
                </div>
                <button
                  className="h-7 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low"
                  onClick={() => onNavigate(...ACCT_NAV.receipts())}
                >Open</button>
              </div>
              <div className="check-row">
                <div className="check-badge todo"><span className="material-symbols-outlined text-[14px]">chevron_right</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Set up bank rules</div>
                  <div className="text-[11px] text-on-surface-variant">Auto-categorize repeating transactions</div>
                </div>
                <button
                  className="h-7 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low"
                  onClick={() => onNavigate(...ACCT_NAV.rules())}
                >Open</button>
              </div>
              <div className="check-row">
                <div className="check-badge todo"><span className="material-symbols-outlined text-[14px]">chevron_right</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Sales tax</div>
                  <div className="text-[11px] text-on-surface-variant">Configure tax rates</div>
                </div>
                <button className="h-7 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low">Open</button>
              </div>
            </div>
          </div>

          {/* Receipts inbox preview (§A intake-queue) */}
          <div className="bg-white rounded-xl border border-surface-dim overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-headline-sm">Receipts inbox</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">12 for review</p>
              </div>
              <button
                className="text-[11px] font-semibold text-primary hover:underline"
                onClick={() => onNavigate(...ACCT_NAV.receipts())}
              >View all</button>
            </div>
            <div className="px-5 pb-3 flex items-center gap-2">
              <div className="flex-1 h-7 px-2 rounded bg-surface-container-low border border-surface-dim text-[11px] text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px]">mail</span>
                receipts@managekube.unsaid.app
                <button
                  className="ml-auto text-primary font-semibold"
                  onClick={() => onToast('Forwarding address copied')}
                >Copy</button>
              </div>
              <button className="h-7 px-2 border border-dashed border-surface-dim rounded text-[11px] text-primary font-semibold hover:bg-surface-container-low flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">upload</span>Upload</button>
            </div>
            <div className="border-t border-surface-dim">
              <div className="inbox-row" onClick={() => onToast('Open receipt review')}>
                <div className="receipt-thumb"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">receipt_long</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Staples · Office supplies</div>
                  <div className="text-[11px] text-on-surface-variant">10/30/2026 · $142.50 · Visa •4421</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary/15 text-tertiary">New</span>
              </div>
              <div className="inbox-row" onClick={() => onToast('Open receipt review')}>
                <div className="receipt-thumb"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">receipt_long</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">FedEx · Shipping</div>
                  <div className="text-[11px] text-on-surface-variant">10/29/2026 · $84.20 · Bank •9910</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary/15 text-tertiary">New</span>
              </div>
              <div className="inbox-row" onClick={() => onToast('Open receipt review')}>
                <div className="receipt-thumb"><span className="material-symbols-outlined text-[16px] text-on-surface-variant">receipt_long</span></div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Adobe · Software</div>
                  <div className="text-[11px] text-on-surface-variant">10/30/2026 · $59.99 · Visa •4421</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary/15 text-tertiary">New</span>
              </div>
            </div>
          </div>
        </div>

        {/* Two-column: For review feed + Recent activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* For review feed (Bank transactions preview) */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-surface-dim overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-headline-sm">For review</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">47 bank transactions</p>
              </div>
              <button
                className="text-[11px] font-semibold text-primary hover:underline"
                onClick={() => onNavigate(...ACCT_NAV.bank())}
              >Open bank feed</button>
            </div>
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Suggested</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-dim">
                <tr className="hover:bg-surface-container-low">
                  <td className="px-4 py-2">10/30</td>
                  <td className="px-4 py-2 truncate">STAPLES #0412</td>
                  <td className="px-4 py-2 text-right tabular-nums text-error">−$142.50</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-surface-container text-[11px]">Office supplies</span></td>
                  <td className="px-4 py-2 text-right"><button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" onClick={() => onNavigate(...ACCT_NAV.bank())}>Review</button></td>
                </tr>
                <tr className="hover:bg-surface-container-low">
                  <td className="px-4 py-2">10/29</td>
                  <td className="px-4 py-2 truncate">FEDEX 001239847</td>
                  <td className="px-4 py-2 text-right tabular-nums text-error">−$84.20</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-surface-container text-[11px]">Shipping</span></td>
                  <td className="px-4 py-2 text-right"><button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" onClick={() => onNavigate(...ACCT_NAV.bank())}>Review</button></td>
                </tr>
                <tr className="hover:bg-surface-container-low">
                  <td className="px-4 py-2">10/28</td>
                  <td className="px-4 py-2 truncate">STRIPE PAYOUT</td>
                  <td className="px-4 py-2 text-right tabular-nums text-secondary">+$1,842.60</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-surface-container text-[11px]">Stripe clearing</span></td>
                  <td className="px-4 py-2 text-right"><button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" onClick={() => onNavigate(...ACCT_NAV.bank())}>Review</button></td>
                </tr>
                <tr className="hover:bg-surface-container-low">
                  <td className="px-4 py-2">10/27</td>
                  <td className="px-4 py-2 truncate">AWS EMEA CHARGES</td>
                  <td className="px-4 py-2 text-right tabular-nums text-error">−$124.88</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-surface-container text-[11px]">Software</span></td>
                  <td className="px-4 py-2 text-right"><button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" onClick={() => onNavigate(...ACCT_NAV.bank())}>Review</button></td>
                </tr>
                <tr className="hover:bg-surface-container-low">
                  <td className="px-4 py-2">10/27</td>
                  <td className="px-4 py-2 truncate">ACME CORP — ACH</td>
                  <td className="px-4 py-2 text-right tabular-nums text-secondary">+$1,240.00</td>
                  <td className="px-4 py-2"><span className="px-2 py-0.5 rounded bg-surface-container text-[11px]">Invoice 1002</span></td>
                  <td className="px-4 py-2 text-right"><button className="h-6 px-2 text-[11px] font-semibold text-primary border border-surface-dim rounded hover:bg-surface-container-low" onClick={() => onNavigate(...ACCT_NAV.bank())}>Review</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-surface-dim p-5">
            <h2 className="text-headline-sm mb-3">Recent activity</h2>
            <div className="space-y-3 text-body-sm">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">check_circle</span>
                <div className="min-w-0">
                  <div className="font-medium">October reconciled</div>
                  <div className="text-[11px] text-on-surface-variant">Sarah A. · 2 hours ago</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-qb-blue mt-0.5">receipt_long</span>
                <div className="min-w-0">
                  <div className="font-medium">Invoice 1002 sent to Acme Corp</div>
                  <div className="text-[11px] text-on-surface-variant">Marcus L. · Yesterday</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-qb-maroon mt-0.5">credit_card</span>
                <div className="min-w-0">
                  <div className="font-medium">Staples expense created</div>
                  <div className="text-[11px] text-on-surface-variant">Auto · 10/30</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">tune</span>
                <div className="min-w-0">
                  <div className="font-medium">Rule added: Stripe payouts</div>
                  <div className="text-[11px] text-on-surface-variant">Priya N. · 10/28</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5">person_add</span>
                <div className="min-w-0">
                  <div className="font-medium">New vendor: Printful</div>
                  <div className="text-[11px] text-on-surface-variant">Auto · 10/26</div>
                </div>
              </div>
            </div>
            <button
              className="w-full mt-4 h-8 border border-surface-dim rounded text-body-sm hover:bg-surface-container-low flex items-center justify-center gap-1"
              onClick={() => onToast('Opening audit log')}
            >
              <span className="material-symbols-outlined text-[14px]">history</span>Audit log
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
