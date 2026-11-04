'use client';
import './sales.css';
import { SalesScreenProps, SALES_NAV } from './types';

export default function SalesOverview({
  onNavigate,
  onToast,
  onCreate,
  onOpenCreateFlyout,
}: SalesScreenProps) {
  return (
    <>
      {/* Context header */}
      <div className="h-[52px] px-6 flex items-center justify-between bg-white border-b border-surface-dim">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            account_balance
          </span>
          <span className="text-label-md font-semibold">Finance</span>
          <span className="text-outline">/</span>
          <span className="text-label-md">Sales &amp; Get Paid</span>
          <span className="text-outline">/</span>
          <span className="text-label-md text-primary font-semibold">Overview</span>
        </div>
      </div>

      <main className="px-6 pb-12">
        <div className="flex items-center justify-between gap-4 py-4 flex-wrap">
          <div>
            <h1 className="text-headline-lg">Sales &amp; Get Paid — Overview</h1>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Payment-request funnel: Not paid / Paid / Deposited · November 2026
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToast('Date range picker')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              Nov 2026 ▾
            </button>
            <button
              onClick={() => onToast('Exporting overview…')}
              className="h-8 px-3 border border-surface-dim rounded text-body-md hover:bg-surface-container-low flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export
            </button>
          </div>
        </div>

        {/* KPI strip — clickable */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="kpi-card" onClick={() => onToast('Drill down → not paid')}>
            <div className="kpi-label">
              <span className="w-2 h-2 rounded-full bg-qb-maroon"></span>Not paid
            </div>
            <div className="kpi-val">$8,420.00</div>
            <div className="kpi-delta up">
              <span className="material-symbols-outlined text-[13px]">trending_up</span>+12% vs last month
            </div>
          </div>
          <div className="kpi-card" onClick={() => onToast('Drill down → paid')}>
            <div className="kpi-label">
              <span className="w-2 h-2 rounded-full bg-qb-blue"></span>Paid
            </div>
            <div className="kpi-val">$24,180.00</div>
            <div className="kpi-delta up">
              <span className="material-symbols-outlined text-[13px]">trending_up</span>+8% vs last month
            </div>
          </div>
          <div className="kpi-card" onClick={() => onToast('Drill down → deposited')}>
            <div className="kpi-label">
              <span className="w-2 h-2 rounded-full bg-qb-green"></span>Deposited
            </div>
            <div className="kpi-val">$22,900.00</div>
            <div className="kpi-delta up">
              <span className="material-symbols-outlined text-[13px]">trending_up</span>+6% vs last month
            </div>
          </div>
          <div className="kpi-card" onClick={() => onToast('Drill down → days')}>
            <div className="kpi-label">
              <span className="w-2 h-2 rounded-full bg-qb-teal"></span>Avg. days to pay
            </div>
            <div className="kpi-val">14.2</div>
            <div className="kpi-delta up">
              <span className="material-symbols-outlined text-[13px]">trending_down</span>−1.3 days faster
            </div>
          </div>
        </div>

        {/* Create actions row */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider font-bold mr-1">
            Create actions:
          </span>
          <button
            onClick={() => onCreate('Invoice')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>Invoice
          </button>
          <button
            onClick={() => onCreate('Receive payment')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">price_check</span>Receive payment
          </button>
          <button
            onClick={() => onCreate('Payment link')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">link</span>Payment link
          </button>
          <button
            onClick={() => onCreate('Estimate')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">request_quote</span>Estimate
          </button>
          <button
            onClick={() => onCreate('Sales receipt')}
            className="h-8 px-3 rounded-lg bg-white border border-surface-dim hover:bg-primary hover:text-white text-on-surface text-label-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">point_of_sale</span>Sales receipt
          </button>
          <button
            onClick={onOpenCreateFlyout}
            className="h-8 px-3 rounded-lg bg-surface-container hover:bg-surface-container-high text-label-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">apps</span>Show all
          </button>
        </div>

        {/* Payment funnel + Attention queue */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
          {/* Funnel */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-surface-dim p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-headline-sm">Payment funnel</h2>
              <span className="text-[11px] text-on-surface-variant">Not paid → Paid → Deposited</span>
            </div>

            {/* Visual bars */}
            <div className="space-y-1">
              <div className="stage-bar">
                <div className="lbl">Not paid</div>
                <div className="track">
                  <div className="fill" style={{ width: '26%', background: '#6b1e28' }}>
                    $8,420
                  </div>
                </div>
              </div>
              <div className="stage-bar">
                <div className="lbl">Paid</div>
                <div className="track">
                  <div className="fill" style={{ width: '74%', background: '#0077c5' }}>
                    $24,180
                  </div>
                </div>
              </div>
              <div className="stage-bar">
                <div className="lbl">Deposited</div>
                <div className="track">
                  <div className="fill" style={{ width: '70%', background: '#1e5a38' }}>
                    $22,900
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-surface-dim text-[11px] text-on-surface-variant">
              <div>
                Total sent: <span className="font-semibold text-on-surface">$32,600</span>
              </div>
              <div>
                Conversion to paid: <span className="font-semibold text-on-surface">74.2%</span>
              </div>
              <div>
                Paid → Deposited: <span className="font-semibold text-on-surface">94.7%</span>
              </div>
            </div>
          </div>

          {/* Attention queue */}
          <div className="bg-white rounded-xl border border-surface-dim p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-headline-sm">Needs attention</h2>
              <span className="text-[11px] text-error font-semibold">3 items</span>
            </div>
            <div className="space-y-2">
              <div className="drill-row" onClick={() => onToast('Drill down → overdue')}>
                <span className="material-symbols-outlined text-[18px] text-error">warning</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">2 overdue invoices</div>
                  <div className="text-[11px] text-on-surface-variant">$2,990.00 · oldest 17 days</div>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              </div>
              <div className="drill-row" onClick={() => onToast('Drill down → unsent')}>
                <span className="material-symbols-outlined text-[18px] text-tertiary">drafts</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">3 unsent invoices</div>
                  <div className="text-[11px] text-on-surface-variant">Drafts waiting to send</div>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              </div>
              <div className="drill-row" onClick={() => onToast('Drill down → failed')}>
                <span className="material-symbols-outlined text-[18px] text-error">error</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">1 failed payment</div>
                  <div className="text-[11px] text-on-surface-variant">Acme Corp · card declined</div>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              </div>
              <div className="drill-row" onClick={() => onToast('Drill down → deposits')}>
                <span className="material-symbols-outlined text-[18px] text-qb-blue">account_balance</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Deposits awaiting match</div>
                  <div className="text-[11px] text-on-surface-variant">1 Stripe payout · $1,842.60</div>
                </div>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        {/* Open invoices + Top customers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
          {/* Open invoices */}
          <div className="bg-white rounded-xl border border-surface-dim overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h2 className="text-headline-sm">Open invoices</h2>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  3 open · $4,230.00 outstanding
                </p>
              </div>
              <button
                onClick={() => onNavigate(...SALES_NAV.invoices())}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-surface-dim">
              <div
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open invoice 1002')}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Invoice 1002 · Acme Corp</div>
                  <div className="text-[11px] text-on-surface-variant">Due 12/01/2026 · 6 days</div>
                </div>
                <span className="age soon">Due soon</span>
                <span className="text-body-sm font-semibold tabular-nums">$1,240.00</span>
              </div>
              <div
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open invoice 0998')}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Invoice 0998 · Maple Supply</div>
                  <div className="text-[11px] text-on-surface-variant">Due 11/14/2026 · 12 days</div>
                </div>
                <span className="age current">Current</span>
                <span className="text-body-sm font-semibold tabular-nums">$890.00</span>
              </div>
              <div
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open invoice 0996')}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium">Invoice 0996 · Northwind Labs</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Due 11/01/2026 · 1 day overdue
                  </div>
                </div>
                <span className="age overdue">Overdue</span>
                <span className="text-body-sm font-semibold tabular-nums">$2,100.00</span>
              </div>
            </div>
          </div>

          {/* Top customers by revenue */}
          <div className="bg-white rounded-xl border border-surface-dim p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-headline-sm">Top customers by revenue</h2>
              <button
                onClick={() => onNavigate(...SALES_NAV.customers())}
                className="text-[11px] text-primary font-semibold hover:underline"
              >
                View all
              </button>
            </div>
            <div>
              <div className="drill-row">
                <div className="avatar bg-qb-blue">A</div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Acme Corp</div>
                  <div className="text-[11px] text-on-surface-variant">4 invoices · 34% of revenue</div>
                </div>
                <span className="amt">$8,640</span>
              </div>
              <div className="drill-row">
                <div className="avatar bg-qb-green">B</div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Blue Ridge Co.</div>
                  <div className="text-[11px] text-on-surface-variant">2 invoices · 29% of revenue</div>
                </div>
                <span className="amt">$7,410</span>
              </div>
              <div className="drill-row">
                <div className="avatar bg-qb-teal">N</div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Northwind Labs</div>
                  <div className="text-[11px] text-on-surface-variant">2 invoices · 17% of revenue</div>
                </div>
                <span className="amt">$4,240</span>
              </div>
              <div className="drill-row">
                <div className="avatar bg-qb-maroon">O</div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Orion Apparel</div>
                  <div className="text-[11px] text-on-surface-variant">3 invoices · 15% of revenue</div>
                </div>
                <span className="amt">$3,890</span>
              </div>
              <div className="drill-row">
                <div className="avatar bg-qb-navy">M</div>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Maple Supply</div>
                  <div className="text-[11px] text-on-surface-variant">1 invoice · 5% of revenue</div>
                </div>
                <span className="amt">$1,180</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row: Recent payments + Recent sales activity */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Recent payments */}
          <div className="bg-white rounded-xl border border-surface-dim overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-headline-sm">Recent payments</h2>
              <span className="text-[11px] text-on-surface-variant">Last 7 days · $4,650.00</span>
            </div>
            <div className="divide-y divide-surface-dim">
              <div
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open payment PMT-4410')}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">price_check</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Blue Ridge Co. · ACH</div>
                  <div className="text-[11px] text-on-surface-variant">10/31/2026 · Invoice 1001</div>
                </div>
                <span className="text-body-sm font-semibold tabular-nums text-secondary">+$3,410.00</span>
              </div>
              <div
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open payment PMT-4388')}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">price_check</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Northwind Labs · Card</div>
                  <div className="text-[11px] text-on-surface-variant">09/28/2026 · Card ending 4421</div>
                </div>
                <span className="text-body-sm font-semibold tabular-nums text-secondary">+$1,500.00</span>
              </div>
              <div
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low cursor-pointer"
                onClick={() => onToast('Open payment PMT-4381')}
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">price_check</span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-sm font-medium truncate">Orion Apparel · Payment link</div>
                  <div className="text-[11px] text-on-surface-variant">09/20/2026 · PL-7F2A</div>
                </div>
                <span className="text-body-sm font-semibold tabular-nums text-secondary">+$540.00</span>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-surface-dim p-5">
            <h2 className="text-headline-sm mb-3">Recent sales activity</h2>
            <div className="space-y-3 text-body-sm">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary mt-0.5">
                  check_circle
                </span>
                <div className="min-w-0">
                  <div className="font-medium">Payment received from Blue Ridge Co.</div>
                  <div className="text-[11px] text-on-surface-variant">$3,410.00 · 10/31/2026</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-qb-blue mt-0.5">
                  receipt_long
                </span>
                <div className="min-w-0">
                  <div className="font-medium">Invoice 1002 sent to Acme Corp</div>
                  <div className="text-[11px] text-on-surface-variant">Marcus L. · 11/01/2026</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-qb-maroon mt-0.5">
                  link
                </span>
                <div className="min-w-0">
                  <div className="font-medium">Payment link PL-7F2A created</div>
                  <div className="text-[11px] text-on-surface-variant">Sarah A. · 10/28/2026</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary mt-0.5">
                  schedule
                </span>
                <div className="min-w-0">
                  <div className="font-medium">Reminder sent to Northwind Labs</div>
                  <div className="text-[11px] text-on-surface-variant">Auto · 10/28/2026</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-qb-green mt-0.5">
                  request_quote
                </span>
                <div className="min-w-0">
                  <div className="font-medium">Estimate 0221 created for Orion</div>
                  <div className="text-[11px] text-on-surface-variant">Priya N. · 10/26/2026</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onToast('Full sales activity history — 42 entries')}
              className="w-full mt-3 h-8 border border-surface-dim rounded text-body-sm hover:bg-surface-container-low flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">history</span>View full history
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
