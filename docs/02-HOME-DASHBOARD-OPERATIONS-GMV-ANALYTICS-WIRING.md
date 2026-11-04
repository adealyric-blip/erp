# 02 — Home Dashboard: Operations Vitals, GMV & Analytics Wiring

**Code Nodes Covered:**
- `components/dashboard/OverviewViews.tsx` (`OperationsVitalsView`, `ExecutiveGmvView`)
- `components/dashboard/AnalyticsViews.tsx` (`AnalyticsOverviewView`, `AnalyticsExplorerView`)
- `components/dashboard/DashboardModals.tsx` (`CompanySetupWizardModal`, `ListCustomizeDrawer`)

---

## 1. Company Setup Checklist & 5-Step Wizard (`OperationsVitalsView` + `CompanySetupWizardModal`)

### What the Chrome Promises
- Displays a live completion bar (`X of 5 steps completed · Y%`) at the top of `Operations Vitals` until all 5 operational pillars are configured (and remains accessible via the `Company setup (X/5)` header button afterward).
- Clicking any step tile opens `CompanySetupWizardModal` directly on that step; editing fields and clicking `Complete & next step` or `Save and close` persists real system configuration—**never** just a dummy checklist boolean.

### Exact Per-Step Table Mapping & Completion Predicates

| Step | Wizard Fields in Chrome | Authoritative Write Targets | Derived `completed` Predicate (Truth Test) |
| :--- | :--- | :--- | :--- |
| **1. Business profile** | Legal name, Years in business, Industry, Tax classification, Annual GMV band | `UPDATE tenants SET legal_name, tax_id, settings = jsonb_set(...)` + `UPSERT acct_entities (code='HQ', legal_name, functional_currency='USD', fiscal_year_start_month)` + `UPSERT acct_books (code='PRIMARY', is_primary=true)` | `tenants.legal_name IS NOT NULL` AND primary `acct_entities` + `acct_books` exist for `tenant_id` |
| **2. Connect bank & payout feeds** | Operating checking, Corporate card, Stripe processor clearing, Storefront payouts | `UPSERT acct_bank_accounts` (linked to `acct_chart_of_accounts` `1000` Operating Cash, `1050` Stripe Clearing, `2050` Corporate Card) + Stripe Financial Connections / Plaid token in `integration_keys` | `COUNT(acct_bank_accounts WHERE tenant_id = $1 AND is_active = true) >= 1` |
| **3. Set up customer payments** | ACH transfer toggle, Card processing toggle, Payment links & QR, Automated reminders | `UPSERT commerce_payment_methods` (`ach`, `card`, `payment_link`) + verify `tenant_stripe_accounts.charges_enabled = true` + write reminder cadence to `tenant_settings (section = 'ar_reminders')` | `EXISTS (SELECT 1 FROM commerce_payment_methods WHERE tenant_id = $1 AND active = true)` |
| **4. Invoice & payor branding** | Primary brand hex, Wordmark logo upload, Default invoice terms, Default footer note | `UPDATE tenants SET primary_color, logo_url` + `UPSERT cms_design_tokens (category='invoice', token_key='brand_primary')` + `UPSERT acct_payment_terms` + `tenant_settings (section = 'invoice_branding')` | `tenants.primary_color IS NOT NULL AND tenants.logo_url IS NOT NULL` |
| **5. Operating & margin goals** | Monthly GMV target, Gross margin guardrail %, Supplier SLA target %, Target DSO | `UPSERT tenant_settings (section = 'operating_goals', data = jsonb)` + `UPSERT acct_budget_versions (scenario = 'plan', status = 'active')` & monthly `acct_budget_lines` | `tenant_settings` row with `section = 'operating_goals'` has non-null `monthlyGmvTarget` and `grossMarginFloor` |

---

## 2. Operations Vitals (`/admin` — `OperationsVitalsView`)

### 2.1 Time Window Switcher (`Today | 7D | 30D | MTD`)
Resolves `[p_start, p_end]` in the tenant's configured timezone (`crm_settings.default_timezone`, default `'America/Chicago'`):
- `Today`: `[date_trunc('day', now_tz), now_tz]`
- `7D`: `[now_tz - interval '7 days', now_tz]`
- `30D`: `[now_tz - interval '30 days', now_tz]`
- `MTD`: `[date_trunc('month', now_tz), now_tz]`

### 2.2 The 6 Vitals KPI Cards (`GET /api/dashboard/ops-vitals?window=...`)

1. **Unfulfilled / Pipeline Orders (`target: orders:orders`):**
   - **Query:** `SELECT count(*), count(*) FILTER (WHERE sla_due_at <= now() + interval '4 hours'), COALESCE(sum(total),0) FROM erp_orders WHERE tenant_id = $1 AND status NOT IN ('shipped','delivered','completed','cancelled','returned','closed') AND order_date BETWEEN $2 AND $3`.
2. **Supplier SLA Health (`target: orders:fulfillment`):**
   - **Query:** Ratio of `fulfillment_orders` (or `erp_fulfillment_orders` + `commerce_supplier_orders`) dispatched on or before `erp_orders.sla_due_at` divided by total due in window, broken down by `suppliers.slug IN ('printful','printify','gelato')`.
3. **Preflight Artwork Holds (`target: catalog:studio`):**
   - **Query:** `SELECT count(*) FROM designs d LEFT JOIN design_files df ON df.design_id = d.id WHERE d.tenant_id = $1 AND (d.status IN ('needs_review','publish_failed') OR df.dpi < 300)`.
   - Subtext counts low-DPI (`df.dpi < 300`) vs print-zone bleed violations (`designs.print_area->>'bleed_violation' = 'true'`).
4. **Intake & Bills for Review (`target: finance:bills` / `finance:receipts`):**
   - **Query:** `SELECT (SELECT count(*) FROM acct_receipt_extractions WHERE tenant_id = $1 AND status = 'pending') AS ocr_drafts, (SELECT count(*) FROM acct_ap_bills WHERE tenant_id = $1 AND status IN ('draft','pending_approval')) AS bills_review, (SELECT COALESCE(sum(total - amount_paid - amount_credited),0) FROM acct_ap_bills WHERE tenant_id = $1 AND status NOT IN ('paid','void','cancelled')) AS open_ap`.
5. **Bank & Payout Feed (`target: finance:bank`):**
   - **Query:** `SELECT count(*) FILTER (WHERE match_status = 'unmatched'), count(*) FILTER (WHERE match_status = 'rule_suggested') FROM acct_bank_transactions WHERE tenant_id = $1` plus open `acct_gateway_clearing_entries WHERE state = 'in_clearing'`.
6. **Open Tickets & RMAs (`target: support:tickets`):**
   - **Query:** `SELECT count(*) FROM support_tickets WHERE tenant_id = $1 AND status NOT IN ('resolved','closed') AND deleted_at IS NULL` + `SELECT count(*) FROM erp_return_authorizations WHERE tenant_id = $1 AND status NOT IN ('completed','cancelled','rejected')`. Median first-response calculated from `support_report_daily.first_response_minutes_sum / NULLIF(first_response_count, 0)`.

### 2.3 Order-to-Cash & POD Fulfillment Funnel
Five mutually exclusive live stage buckets (clicking any bar navigates to `targetDomain:targetScreen` with the matching `viewTab` pre-selected):
1. **Unfulfilled & Preflight Check:** `erp_orders.status IN ('pending_payment','confirmed','on_hold')`
2. **Routed to POD Supplier:** `commerce_supplier_orders.status IN ('to_order','ordered')` / `dropship_pipe_attempts.state IN ('pending','placing','placed')`
3. **In Print & Quality Inspection:** `fulfillment_orders.status = 'in_production'` or `erp_fulfillment_orders.status IN ('picking','packing','packed','staged')`
4. **Shipped / Carrier In-Transit:** `fulfillment_packages.state IN ('in_transit','out_for_delivery')` or `erp_shipments.status = 'in_transit'`
5. **Delivered & Payout Settled (Window):** `erp_orders.status IN ('delivered','completed')` in the active window.

### 2.4 Suppliers, Feeds & Intake Inbox Panel
- Reads live health from `platform_integration_health_registry` (`status`, `latency_ms`, `last_success_at`, `consecutive_failures`) joined with live open counts per supplier (`commerce_supplier_orders`, `acct_ap_bills`, `acct_payouts`, `acct_receipt_extractions`).
- **`Copy intake email` button:** Reads tenant's dedicated inbound address `receipts+<tenant_slug>@intake.unsaid.app` from `tenant_settings (section = 'intake_inbox')` and copies via `navigator.clipboard.writeText(...)`.

### 2.5 Business at a Glance — Smart Suggestions Engine
Suggestions are **not static cards**; they are generated by deterministic server predicates (`GET /api/dashboard/suggestions`) and filtered against `user_dismissed_suggestions` (stored in `tenant_settings` or `crm_needs_attention` with `status = 'dismissed'`):
- **Early-Pay / Due-Soon AP Rule:** Fires when `acct_ap_bills` has unpaid bills due within 10 days or with `acct_payment_terms.discount_days` expiring.
- **Bank Rule Confidence Rule:** Fires when `acct_bank_transactions` has rows with `match_status = 'rule_suggested'`.
- **Preflight Gate Rule:** Fires when `erp_order_lines` reference a `design_publication_id` or `designs` row blocked on DPI/bleed.
- **1099 / W-9 Threshold Rule:** Fires when `acct_vendors` (`is_1099_vendor = true AND w9_received_at IS NULL`) or `seller_self_serve_profiles` (`tax_form_status = 'required_prompted'`) has YTD payments/settlements `>= $600`.

---

## 3. Executive GMV & Margins (`/dashboard` — `ExecutiveGmvView`)

### 3.1 Canonical Accounting & Commerce Formulas (Reconciled to CoA §D1)
Every number on `Executive GMV & Margins` must tie to the penny with `acct_journal_lines` (for posted accrual books) and `commerce_sales` / `erp_orders` (for intra-day real-time GMV):

| Waterfall / KPI Line | Chart of Accounts Code(s) | Exact SQL / Ledger Source |
| :--- | :--- | :--- |
| **Gross Merchandise Volume (GMV)** | Gross merchandise + shipping billed pre-discount | `SUM(cs.subtotal + cs.shipping_total)` from `commerce_sales` (`status NOT IN ('draft','cancelled','void')`) + posted B2B `acct_ar_invoices` (`source_system != 'commerce_pos'`) |
| **− Promotional Discounts & Codes** | `4100 · Discounts Given` (contra-revenue) | `SUM(commerce_sale_discounts.amount)` + `acct_journal_lines` on `4100` |
| **− Returns, RMAs & Credit Memos** | `4200 · Sales Returns & Allowances` | `SUM(commerce_refunds.amount WHERE status='completed')` + posted `acct_ar_credit_memos.total` |
| **= Net Recognized Revenue** | `4010..4090` net of `4100`, `4200` | Matches `Revenue` section of `rpc_get_profit_and_loss(tenant_id, start_date, end_date)` |
| **− Supplier Blank & Print COGS** | `5100 · COGS — POD Suppliers` (`Printful`, `Printify`, `Gelato`) | `acct_journal_lines` on `5100..5199` (accrued from `fulfillment_orders.cost` / `supplier_product_costs` on shipment, trued up on `acct_ap_bill_lines`) |
| **− Outbound Carrier & Packaging** | `5200 · Shipping & Fulfillment COGS` | `SUM(fulfillment_packages.label_cost_cents)/100.0` + `acct_journal_lines` on `5200` |
| **− Stripe & Marketplace Fees** | `5300 · Merchant Processing Fees` | `SUM(acct_gateway_clearing_entries.fee_amount)` + `SUM(seller_settlements.fees_cents)/100.0` |
| **= Gross Profit & Gross Margin %** | `Net Revenue − Total COGS (5100..5399)` | `Gross Profit / NULLIF(Net Revenue, 0) * 100` |
| **− Ad Center Performance Spend** | `6100 · Advertising & Performance Spend` | `SUM(ad_campaign_daily.spend_cents)/100.0` (for tenant campaigns) + `acct_journal_lines` on `6100` |
| **− Marketplace Seller Payouts** | `2150 · Marketplace Seller Payable` (or net take-rate share) | `SUM(seller_settlements.net_cents)/100.0` (`WHERE state IN ('pending','settled')`) |
| **= Net Contribution Margin** | `Gross Profit − Ad Spend − Seller Payout Share` | Executive bottom-line unit contribution |
| **Operating Cash & In-Transit** | `1000..1049` Bank + `1050` Gateway Clearing |Posted GL balance on `acct_bank_accounts.gl_account_id` + `SUM(acct_gateway_clearing_entries.net_amount WHERE state='in_clearing')` + `SUM(acct_payouts.net_amount WHERE status='in_transit')` |

### 3.2 Interactive Controls Wiring
- **`MTD | QTD | YTD | 12M` Toggle:** Re-queries `/api/dashboard/exec-gmv?period=...&compare=...` (never multiplies a static constant in client JS!).
- **`vs Prior | vs Plan` Toggle:**
  - `vs Prior`: Compares `[start, end]` against the immediately preceding window of equal duration (or YoY for `12M`).
  - `vs Plan`: Compares `[start, end]` against active `acct_budget_versions` (`scenario = 'plan'`, `status IN ('approved','active')`) summed across `acct_budget_lines` for matching `acct_periods`.
- **12-Month Interactive SVG Trajectory + Month Inspector:**
  - Queries 12 monthly buckets (`date_trunc('month', entry_date)`). Clicking any month bar loads that month's exact P&L, order count, and AOV into the right-hand inspector card.
- **AR Payment Request Funnel (`Not paid` / `Paid` / `Deposited`):**
  - `Not paid`: `SUM(total - amount_paid - amount_credited) FROM acct_ar_invoices WHERE status IN ('posted','partially_paid','overdue')`
  - `Paid (30D)`: `SUM(amount) FROM acct_ar_receipts WHERE receipt_date >= current_date - 30 AND status = 'succeeded'`
  - `Deposited (30D)`: `SUM(net_amount) FROM acct_payouts WHERE status = 'paid' AND arrived_at >= now() - interval '30 days'` + matched `acct_bank_transactions`.

---

## 4. Analytics Overview (`/analytics` — `AnalyticsOverviewView`)

### 4.1 Storefront Conversion Funnel
Queries `[start, end]` filtered by optional `channel` (`commerce_order_channels.code`):
1. **Sessions:** `COUNT(DISTINCT session_id)` from `cms_funnel_events` / `analytics_events` (+ `SUM(sessions)` from `google_ga4_daily` if GA4 leg active).
2. **Product & Mockup Views:** `COUNT(DISTINCT session_id)` where `event_name = 'view_item'` or `cms_funnel_events.stage = 'product_view'`.
3. **Customized / Added to Cart:** `COUNT(DISTINCT id)` from `carts` / `commerce_carts` created in window.
4. **Checkout Initiated:** `COUNT(DISTINCT id)` from `commerce_checkout_sessions` started in window.
5. **Completed Paid Orders:** `COUNT(DISTINCT id)` from `commerce_sales` / `erp_orders` with paid status in window.

### 4.2 Ad Center Multi-Channel Attribution & ROAS Table
Joins `ad_campaigns` (`WHERE tenant_id = $1`), `ad_campaign_daily` (`impressions`, `clicks`, `spend_cents`), and `ad_event_counters` (`conversions`) with UTM/channel-attributed orders from `commerce_orders` / `crm_lead_sources`:
- `ROAS = attributed_gmv / NULLIF(spend_usd, 0)`
- `CAC = spend_usd / NULLIF(new_customer_orders, 0)`
- Clicking any row opens `PeekDrawer` with campaign breakdown; clicking `Open Marketing →` opens `marketing:social` / Ad Center tab.

### 4.3 Monthly Customer Retention Cohort Matrix (`M0`–`M5`)
Computed via server SQL CTE over `commerce_sales` (or `erp_orders` where `status NOT IN ('cancelled','void')`):
```sql
WITH first_purchase AS (
  SELECT customer_id, date_trunc('month', MIN(sale_at))::date AS cohort_month
  FROM public.commerce_sales
  WHERE tenant_id = $1 AND customer_id IS NOT NULL AND status = 'completed'
  GROUP BY customer_id
),
activity AS (
  SELECT fp.cohort_month,
         (EXTRACT(YEAR FROM age(date_trunc('month', cs.sale_at)::date, fp.cohort_month)) * 12
          + EXTRACT(MONTH FROM age(date_trunc('month', cs.sale_at)::date, fp.cohort_month)))::int AS month_offset,
         COUNT(DISTINCT cs.customer_id) AS active_buyers
  FROM first_purchase fp
  JOIN public.commerce_sales cs
    ON cs.customer_id = fp.customer_id
   AND cs.tenant_id = $1
   AND cs.status = 'completed'
  WHERE fp.cohort_month >= (date_trunc('month', current_date) - interval '5 months')::date
  GROUP BY 1, 2
)
SELECT cohort_month, month_offset, active_buyers FROM activity ORDER BY 1, 2;
```
`M0` is always `100%`; `M1..M5` = `ROUND(active_buyers::numeric / m0_buyers * 100)`. Future month offsets (`cohort_month + month_offset > current_month`) render `'—'` (`styles.heatEmpty`).

### 4.4 Top Performing SKUs & Designs
Aggregates `commerce_sale_lines` + `erp_order_lines` joined to `commerce_catalog_items`, `erp_product_skus`, `suppliers`, and `customer_return_requests` (for SKU-level `rmaPct = returned_qty / sold_qty * 100`).

---

## 5. Analytics Explorer (`/analytics/explorer` — `AnalyticsExplorerView`)

### What the Chrome Promises
- Switch between 4 fact datasets (`orders_gmv`, `sku_velocity`, `customer_cohorts`, `seller_ledger`), filter by margin/volume/variance tabs, sort any column, toggle audit columns (`Created by/on`, `Modified by/on`), scale numbers (`$K`, parentheses, decimals), save/load custom views, export CSV, or schedule a weekly email digest.

### Server Query & Action Wiring
1. **Parameterized Pivot Endpoint (`POST /api/analytics/explorer/query`):**
   - Accepts `{ dataset, tabFilter, search, dateRange, sortKey, sortDir }` (whitelisted column identifiers—never raw SQL string interpolation).
   - Executes the dataset-specific SQL view:
     - `orders_gmv`: Groups `commerce_sales` + `commerce_sale_lines` by `(channel, category, supplier)` joined to `acct_budget_lines` for `varianceAmount`.
     - `sku_velocity`: Groups `commerce_sale_lines` by `erp_product_skus.sku`, `suppliers.name`, `commerce_categories.name`.
     - `customer_cohorts`: Groups `crm_customers` + `commerce_sales` by `lifecycle_stage` / `crm_segments`.
     - `seller_ledger`: Groups `seller_settlements` + `sellers` (`gross_cents`, `commission_cents`, `fees_cents`, `net_cents`, `w9Status` from `seller_self_serve_profiles`).
2. **Saved Views (`platform_saved_views` with `entity_type = 'analytics_explorer'`):**
   - `+ Save view` → `POST /api/platform/saved-views` storing `{ dataset, tab, search, dateRange, visualCfg }` in `filters`, `columns` array in `columns`, and `{ sortKey, sortDir }` in `sort`.
3. **Export CSV & Schedule Digest (`Split Button`):**
   - **`Export CSV`:** Generates RFC-4180 CSV honoring the user's active visible columns and `visualCfg`, writes an audit row to `analytics_export_runs` (`tenant_id`, `definition_name`, `status = 'succeeded'`, `row_count`, `csv_text`), and triggers browser download.
   - **`Schedule weekly digest`:** Creates/updates a scheduled definition row and registers a `pg_cron` / worker job that populates `analytics_export_runs` (`schedule = 'weekly_mon_0800'`) and queues an email in `email_messages` with the CSV attachment.
   - **`Pin to Executive Overview` (Bulk Action):** Writes selected dimension keys to `tenant_settings (section = 'pinned_explorer_slices')` so they surface on `Executive GMV & Margins`.
   - **`Flag variance` (Bulk Action):** Inserts a `crm_tasks` / `crm_needs_attention` row (`issue_code = 'MARGIN_VARIANCE'`, `priority = 'high'`) for each selected slice, which immediately increments the `Attention Queue` badge!
