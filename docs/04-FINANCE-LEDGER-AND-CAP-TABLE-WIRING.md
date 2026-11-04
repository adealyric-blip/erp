# 04 — Financial Accounting Tables (`acct_*`) & Cap Table / 409A (`cap_*`, `val_*`) Wiring

**Code Nodes Covered:**
- `components/ScreenContent.tsx` (Finance domain Overviews & Lists: `Accounting`, `Business Tax`, `Expenses & Bills`, `Sales & Get Paid`, `Customer Hub`)
- `components/cap-table/CapTableScreens.tsx` (All 11 Cap Table & 409A screens)
- `lib/equityEngine.ts`, `lib/valuation409aEngine.ts`, `db/cap_table_409a_schema.sql`

---

## PART I — Financial Accounting Tables (`acct_*`) End-to-End Loops

### 1. Non-Negotiable Ledger Invariants
1. **Immutability of Posted Journals:** `acct_block_posted_mutation()` enforces that once `acct_journal_entries.status = 'posted'`, neither headers nor `acct_journal_lines` can be edited or deleted. Every void, credit memo, refund, or reclass **must** call `acct_reverse_journal()` and/or post a new balanced adjusting entry via `acct_post_journal()`.
2. **Closed Period Lock:** Before any document posts to GL, verify `acct_periods.status = 'open'` for `posting_date`. Attempting to post into a `closed` or `locked` period returns `409 PERIOD_CLOSED`.
3. **Audit Trail:** Attach `acct_audit_row_change()` trigger to `acct_chart_of_accounts`, `acct_ar_invoices`, `acct_ap_bills`, `acct_ar_receipts`, `acct_ap_payments`, `acct_reconciliations`, and `acct_periods` so `Settings > Audit` and `Accountant > Audit trail` show every before/after JSONB diff and actor UUID.

---

### 2. Finance Module-by-Module Behavioral Wiring

#### 2.1 Sales & Get Paid (`sales-overview`, `sales-transactions`, `invoices`, `payment-links`, `products`)
- **`Sales transactions` Unified List:** Server `UNION ALL` view across `acct_ar_invoices` (`Invoice`), `acct_ar_receipts` (`Payment` / `Sales receipt`), `acct_ar_credit_memos` (`Credit memo`), and `acct_estimates` (`Estimate`), sorted `date DESC`.
- **`Invoices` List & Row `⋯` Menu (`Send`, `Remind`, `Print`, `Mark paid`, `Void`):**
  - `Send` / `Remind`: Generates/reuses `checkouts` slug, queues `email_messages`, increments `acct_ar_invoices.reminder_count`, sets `last_reminder_at = now()`.
  - `Mark paid` (`Receive payment` [M]): Calls refactored `acct_take_payment()`:
    1. Inserts `acct_ar_receipts` (`amount`, `payment_method`, `deposit_account_id`).
    2. Inserts `acct_ar_receipt_applications` (`receipt_id`, `invoice_id`, `applied_amount`).
    3. Updates `acct_ar_invoices.amount_paid` and transitions `status` to `'partially_paid'` or `'paid'` (`paid_at = now()`).
    4. Calls `acct_post_journal()` (`DR 1000/1050 Deposit/Clearing Account`, `CR 1100 Accounts Receivable`).
  - `Void`: Sets `acct_ar_invoices.status = 'void', voided_at = now(), voided_by = auth.uid()`, and calls `acct_reverse_journal(posted_journal_id, current_date, 'Void invoice ' || invoice_number)`.
- **Stripe / Shopify Payout Settlement Loop (`Settlement` [W] & Webhook):**
  - Charge capture inserts `acct_gateway_clearing_entries` (`gross_amount`, `fee_amount`, `reserve_amount`, `net_amount`, `state = 'in_clearing'`).
  - Stripe `payout.paid` webhook inserts/updates `acct_payouts` (`status = 'paid'`, `arrived_at`), marks linked `acct_gateway_clearing_entries.state = 'released'`, posts `acct_post_journal()` (`DR 1000 Operating Checking = net`, `DR 5300 Stripe Fees = fee`, `DR 1180 Processor Reserve = reserve`, `CR 1050 Stripe Clearing = gross`), and auto-matches the incoming `acct_bank_transactions` deposit line!

#### 2.2 Expenses & Bills + Receipts Intake (`bills-overview`, `expenses`, `vendors`, `bills`, `bill-payments`, `receipts`)
- **Receipts Intake Inbox (`receipts` — §A Intake P2):**
  - **3 Capture Doors:** Inbound email webhook (`receipts+<slug>@intake.unsaid.app`), drag-and-drop upload, or mobile camera snap → stores file in Supabase Storage (`acct_attachments` with `sha256` dedupe check so the same PDF cannot be booked twice!) and inserts `acct_receipt_extractions` (`status = 'pending'`, extracted `vendor_name`, `extracted_total`, `tax_amount`, `receipt_date`, `ocr_score`).
  - **`For review` -> `Create Bill / Expense` Action:** Promotes extraction into `acct_ap_bills` (or `acct_expense_reports` + `acct_expense_lines`), links `acct_attachments.entity_id = bill.id`, and sets `acct_receipt_extractions.status = 'reviewed'`.
- **Bills (`For review | Unpaid | Paid`) & Pay Bills Workspace (`bill-payments` — §B1 `Pay bills [W]`):**
  - Approving a bill posts `acct_post_journal()` (`DR 5100..6999 Expense/COGS`, `CR 2000 Accounts Payable`) and sets `acct_ap_bills.posted_journal_id`.
  - **`Pay bills [W]` Execution:** User selects `cash_account_id`, payment date, ACH or Check (`starting_check_no`, `print_later`), checks `1..N` unpaid bills, and clicks `Schedule / Pay`:
    1. Inserts `acct_ap_payments` per vendor.
    2. Inserts `acct_ap_payment_applications` (`payment_id`, `bill_id`, `applied_amount`).
    3. Updates each `acct_ap_bills.amount_paid` and `status = 'paid'` (or `'partially_paid'`).
    4. Calls `acct_post_journal()` (`DR 2000 Accounts Payable`, `CR 1000 Operating Bank`).

#### 2.3 Accounting: Bank Feed, Rules, Chart of Accounts & Reconcile (`bank`, `rules`, `coa`, `reconcile`, `reports`)
- **Bank Feed (`bank`) & Rules (`rules`):**
  - Syncs via Stripe Financial Connections / Plaid into `acct_bank_transactions` (`transaction_hash` unique dedupe).
  - Bank rules evaluate `payee` / `description` / `amount` patterns:
    - **Match existing:** Links `acct_bank_transactions.matched_journal_line_id` (`match_status = 'matched'`).
    - **Categorize new:** Calls `acct_post_journal()` (`DR/CR Bank GL Account` vs `Rule Target Account`) and sets `matched_journal_line_id`.
- **Chart of Accounts (`coa` — §D1):**
  - Reads `acct_chart_of_accounts` joined to live posted GL balances (`SUM(debit - credit)` or `SUM(credit - debit)` by `normal_balance`) and live `acct_bank_accounts` balances.
  - Inline spreadsheet edit mode updates `name`, `code`, `description`, and `metadata->>'tax_line'` in batch; `Reclassify transactions` tool moves `acct_journal_lines` via auditable reclass journals (never mutating closed periods!).
- **Reconcile (`reconcile` — §D2):**
  - **Setup step:** Creates `acct_reconciliations` (`bank_account_id`, `as_of_date`, `statement_balance`, `gl_balance`, `status = 'open'`). If service charge or interest earned is entered on setup, immediately posts those journals via `acct_post_journal()`.
  - **Tie-out workspace:** Checking/unchecking cleared items updates `acct_reconciliation_items` (`status = 'matched' | 'unmatched'`) and recomputes `acct_reconciliations.outstanding_deposits` and `outstanding_payments`.
  - **Finish Reconciling Guard:** `acct_reconciliations.difference` is a PostgreSQL `GENERATED ALWAYS` column. The **`Finish now`** button is hard-blocked on the server unless `difference = 0`! When `difference = 0`, sets `status = 'reconciled', completed_at = now(), reviewed_by = auth.uid()`.
- **Reports (`reports`):**
  - Wired directly to `rpc_get_profit_and_loss`, `rpc_get_balance_sheet`, `rpc_get_trial_balance`, and `rpc_get_general_ledger`, plus `ListCustomizeDrawer` (`Visual` scale `$K` / parentheses / decimals).

#### 2.4 Business Tax (`tax-overview`, `tax-summary`, `tax-filing`)
- **`Tax summary`:** Aggregates `rpc_get_profit_and_loss` grouped by `acct_chart_of_accounts.metadata->>'tax_line'`, lists unmapped accounts as an interactive **Map Accounts Task** (inline picker writes `metadata.tax_line`), shows fixed asset depreciation from `acct_asset_depreciation_runs`, and sales tax collected vs remitted from `acct_tax_filings` + `seller_tax_remittance_filings`.
- **`1099s`:** Queries `acct_vendors` (`is_1099_vendor = true`) summed across `acct_ap_payments` (`>= $600` threshold) + `seller_1099k_generations`, generating `acct_payroll_tax_forms` (`form_type = '1099-NEC'`).

---

## PART II — Cap Table & 409A Engine (`cap_*`, `val_*`) End-to-End Loops

All 11 screens in `components/cap-table/CapTableScreens.tsx` wire to `db/cap_table_409a_schema.sql` under one non-negotiable rule: **Ownership is never edited in place. Every share, option, SAFE, conversion, exercise, transfer, or cancellation is an append-only, SHA-256 hash-chained row in `cap_transactions`.**

### 1. Hash-Chain & Snapshot Protocol (Shared Service `lib/equityEngine.ts`)
1. **Hash Chain Formula:**
   ```
   canonical_payload = JSON.stringify({ seq, company_id, security_id, txn_type, qty_delta, price_per_share, counterparty_stakeholder_id, effective_date, board_approval_id })
   row_hash = sha256((prev_hash ?? 'GENESIS') + '|' + canonical_payload)
   ```
   Acquire `SELECT pg_advisory_xact_lock(hashtext(company_id::text))` inside the transaction before reading the latest `seq` / `row_hash` so concurrent issuances serialize cleanly without forks.
2. **Pre-Event Snapshot Mandate:** Before inserting any `cap_grants` row or adopting/running any `val_requests` 409A run, compute the full stakeholder × class table as of `effective_date`, compute `snapshot_hash = sha256(canonical_snapshot_json)`, and insert `cap_table_snapshots` (`reason IN ('valuation','grant','financing')`).

### 2. Screen-by-Screen Behavioral Contract (All 11 Cap Table Screens)

| Screen ID | Chrome Promise & Controls | Exact Database Reads, Guards & Atomic Mutations |
| :--- | :--- | :--- |
| **1. `cap-overview`** (`Overview`) | 4 KPIs, Ownership Breakdown bar chart, Round History, Create Actions, Recent Equity Events, Active 409A FMV card | • Derives ownership live from `cap_transactions` + `cap_securities` + `cap_equity_plans` (`available = total_reserved - granted_outstanding - exercised_from_plan`).<br>• Reads active safe-harbor FMV from `val_active_fmv` view (`status='adopted' AND valid_until >= current_date`). If `0` rows (expired or superseded by material event), displays **red FMV Lock banner** warning option grants are blocked.<br>• `Export` generates full diligence workbook (Ledger + As-Of Cap Table + SHA-256 chain verification certificate). |
| **2. `cap-table`** (`Cap Table`) | `Summary / Detailed / Fully diluted` toggle, security filter tabs (`All`, `Common`, `Preferred`, `Options`, `SAFE/Convertible`), As-Of Date picker, row PeekDrawer | • **Reproducible Historical View:** Passing `?asOf=YYYY-MM-DD` replays `SELECT * FROM cap_transactions WHERE company_id = $1 AND effective_date <= $2 ORDER BY seq ASC` to reproduce the exact historical cap table on any past date for legal/audit diligence!<br>• `Summary`: Aggregates by stakeholder across classes (`Basic Shares` = issued Common + Preferred).<br>• `Detailed`: Breaks out every security lot (`cap_securities`) and conversion ratio.<br>• `Fully diluted`: Includes `cap_securities` (`option`, `rsu`, `warrant`), unallocated `cap_equity_plans` pool, and converted-equivalent shares for outstanding `safe` / `convertible_note` lots. |
| **3. `cap-holders`** (`Stakeholders`) | Search filter, stakeholder directory, `+ Add Stakeholder` drawer | • Queries `cap_stakeholders` joined with derived holdings & vesting status.<br>• Creating/updating a stakeholder writes `cap_stakeholders` (`kind`, `stakeholder_type`, `full_name`, `email`, pgp-encrypted `tax_id_enc` via `pgcrypto`, `is_board`, `is_insider`). |
| **4. `cap-rounds`** (`Funding Rounds`) | Financing ledger (`Pre-Seed`, `Seed`, `Series A`) + `New Round` closing wizard | **Closing a Priced Round (`POST /api/cap-table/rounds/close`) — Atomic Transaction:**<br>1. Freeze pre-money `cap_table_snapshots` (`reason = 'financing'`).<br>2. Create `cap_security_classes` (`kind = 'preferred'`, `seniority_rank`, `liquidation_preference_multiple`, `participating`, `participation_cap_multiple`, `original_price_per_share`, `conversion_ratio`).<br>3. Record `cap_board_approvals` (`approval_type = 'financing'`) + signed charter/SPA in `cap_documents` (`sha256`).<br>4. Convert selected outstanding SAFEs/Notes: append `safe_convert` / `note_convert` in `cap_transactions` (`qty_delta` negative on SAFE, positive on new Shadow/Preferred lot at `min(cap_price, discount_price)`), set `cap_securities.status = 'converted'`.<br>5. Mint new investor Preferred lots (`cap_securities` + `cap_transactions` `txn_type = 'issue'`).<br>6. Expand `cap_equity_plans.total_reserved` if top-up pool specified.<br>7. **Automatic 409A Invalidation:** Insert `val_material_events` (`event_type = 'financing'`, `triggers_revaluation = true`) and set active `val_reports.status = 'superseded'` — immediately locking option grants until a new 409A is adopted! |
| **5. `cap-options`** (`Option Pool`) | Pool KPIs (`Reserved`, `Granted`, `Vested`, `Available`), Grants table, `+ Option Grant`, `Exercise`, `Cancel` | **Hard Guards on `POST /api/cap-table/grants`:**<br>1. **FMV Lock Guard:** Query `val_active_fmv`. If no active report exists (or an unresolved `val_material_events` with `triggers_revaluation = true` exists after `valuation_date`), **hard-block (`422 NO_ACTIVE_409A_FMV`)**. If `exercise_price < fmv_per_share_common` (for ISO/NSO), **hard-block (`422 STRIKE_BELOW_FMV`)**.<br>2. **Pool Reserve Guard:** Verify `quantity <= plan_available_shares`; else **hard-block (`422 INSUFFICIENT_POOL_RESERVE`)**.<br>3. **Board Approval Guard:** Require `board_approval_id` (`approval_type = 'grant_batch'`).<br>4. **Execution:** Freeze `cap_table_snapshots` (`reason = 'grant'`), insert `cap_securities` (`kind = 'option'`) + `cap_grants` (`fmv_at_grant`, `val_report_id`, `form_83b_due_date = CASE WHEN early_exercise THEN grant_date + 30 END`), pre-generate deterministic monthly/cliff rows in `cap_vesting_events`, append `cap_transactions` (`txn_type = 'grant'`), and if `early_exercise = true`, insert a 30-day deadline alert into `crm_tasks` (`Attention Queue`)!<br>• **Exercise Action:** Appends `exercise` txn, mints Common `share` lot, updates option status, and checks ISO `$100K` limit / Form 3921 trigger. |
| **6. `cap-safes`** (`SAFEs & Convertibles`) | SAFE KPIs, cap/discount table, `+ Issue SAFE` | • Inserts `cap_securities` (`kind = 'safe' | 'convertible_note'`, `safe_cap`, `safe_discount`, `note_principal`, `note_interest_rate`, `board_approval_id`) + `cap_documents` (`sha256`) + `cap_transactions` (`txn_type = 'issue'`). Enforces schema rule: `safe_cap` is stored as valuation cap, **never** fabricated as `price_per_share`. |
| **7. `cap-dilution`** (`Dilution Modeler`) | New money, Pre-money valuation, Target post-money option pool % inputs + live post-round table | • Reads live `cap_securities` + `cap_equity_plans` + outstanding `SAFEs` (`safe_cap`, `safe_discount`) and runs exact algebraic simultaneous solver (post-money vs pre-money SAFE conversion + option pool shuffle) in `lib/equityEngine.ts`.<br>• Adding `"Save Scenario"` persists JSONB in `tenant_settings` and `"Promote to Draft Round"` pre-populates the `cap-rounds` closing wizard. |
| **8. `cap-waterfall`** (`Liquidation Waterfall`) | Exit value, Preference multiple, Participation toggle + payout per class | • Reads actual `cap_security_classes` (`seniority_rank`, `liquidation_preference_multiple`, `participating`, `participation_cap_multiple`, `conversion_ratio`) and derived share counts, computing exact seniority-ordered liquidation preferences vs optimal voluntary conversion breakpoints (the exact same breakpoint engine used by OPM in 409A!). |
| **9. `cap-409a`** (`409A & Valuations`) | Active Safe-Harbor FMV banner, Valuation Run Wizard & Historical Appraisals | **End-to-End 409A Engine (`lib/valuation409aEngine.ts` ↔ `val_*` tables):**<br>1. **Automated Gate Check (`val_requests.gate_check`):** Evaluates `<10yr` (`current_date - COALESCE(predecessor_start_date, incorp_date) < 3652`), `has_traded_class = false`, `cap_security_classes.has_put_or_call = false`, no expected CIC `<=90d` / IPO `<=180d`, and `cap_qualified_individuals` on file (`years_experience >= 5`, CV + board determination doc attached). If ineligible, sets `status = 'ineligible_independent_required'`.<br>2. **Freeze Snapshot:** Creates `cap_table_snapshots` (`reason = 'valuation'`) and binds `val_requests.snapshot_id`.<br>3. **Collect Inputs & Comps:** Persists `val_inputs` (cash/debt pulled directly from `rpc_get_balance_sheet`!, historical P&L from `rpc_get_profit_and_loss`, projections) + `val_comps`.<br>4. **Enterprise Value Approaches:** Solves and stores `val_approaches` (`asset`, `dcf`, `market_guideline`, `backsolve` Newton-Raphson solver against latest priced round) with weights summing to `100%`.<br>5. **OPM Allocation (`val_allocations`):** Builds preference/conversion breakpoints from `cap_security_classes`, runs Black-Scholes per call-option tranche, derives `common_per_share_pre_dlom`.<br>6. **DLOM (`val_dlom`):** Runs Finnerty / Chaffe put-option model to compute `dlom_pct` and deterministic `common_per_share_post_dlom`.<br>7. **Report Generation & Board Adoption (`val_reports`):** Renders structured PDF from the stored rows (zero hand-typed numbers!), stores in `cap_documents` (`sha256`), records `cap_board_approvals` (`approval_type = 'valuation_adopt'`), sets `val_reports.status = 'adopted'`, `valid_until = valuation_date + interval '12 months'`, and supersedes any prior adopted report! |
| **10. `cap-documents`** (`Documents`) | Equity data room table + Upload + Download + Hash Verify | • Queries `cap_documents` joined to `cap_board_approvals`, `val_reports`, and `cap_grants`.<br>• `Upload`: Streams file to private Supabase Storage bucket `equity-vault`, computes `sha256` on server, inserts `cap_documents`.<br>• `Download`: Verifies stored `sha256` against object bytes and returns short-lived presigned URL (`60s`). |
| **11. `cap-equity-events`** (`Equity Events`) | Immutable chronological ledger table | • Queries `cap_transactions` (`ORDER BY seq DESC`) joined to `cap_stakeholders`, `cap_securities`, `cap_security_classes`, and `cap_board_approvals`.<br>• Includes `"Verify Hash Chain"` action that recomputes `sha256` from `seq = 1..MAX(seq)` and proves zero tampering (`Chain intact: N/N blocks verified`). |

---

## PART III — End-to-End Verification Matrix ("Rows Prove Them")

Before deleting `data/dashboardData.ts`, `data/capTableData.ts`, and `DEMO_ROWS` in `data/shellData.ts`, the following 8 end-to-end integration flows must run against a live Supabase test tenant and pass every SQL proof assertion:

| # | User Flow Performed in Browser Chrome | Required SQL Row-Proof Assertion |
| :--- | :--- | :--- |
| **1** | Complete Steps 4 & 5 in **Company Setup Wizard**, customize **Create Actions Row** to 8 chips, and reload page. | `tenants.primary_color` updated; `tenant_settings` (`operating_goals`) present; `platform_create_favorites` has 8 ordered rows for `auth.uid()`; checklist shows `5/5 (100%)` on fresh reload. |
| **2** | Create & send an **Invoice** (`$1,500`) to `Acme Corp` via `DocumentEngine`, then execute **Receive payment** (`$1,500`). | `acct_ar_invoices.status = 'paid'`; 2 balanced `acct_journal_entries` (`posted`) in `acct_journal_lines`; `email_messages` queued/sent; **Executive GMV & Margins** GMV & Net Revenue increase by `$1,500` and AR `Not paid` drops by `$1,500`. |
| **3** | Upload a supplier invoice PDF into **Receipts Inbox**, promote to **Bill**, approve, and pay in **Pay Bills**. | `acct_attachments.sha256` non-null; `acct_receipt_extractions.status = 'reviewed'`; `acct_ap_bills.status = 'paid'`; `acct_ap_payments` + `acct_ap_payment_applications` + balanced `5100` COGS / `2000` AP / `1000` Cash journals exist; Supplier COGS updates on **Executive GMV**. |
| **4** | In **Analytics Explorer**, toggle `Created by` column on, set `Divide by 1,000 ($K)`, click `+ Save view`, and click `Export CSV`. | `platform_saved_views` row persisted with `columns` & `__visual`; `analytics_export_runs` row inserted with `status = 'succeeded'` and non-empty `csv_text`. |
| **5** | In **Attention Queue**, create a `New task`, `Snooze 4h`, advance clock / expire snooze, then `Resolve`. | `crm_tasks` transitions `open -> snoozed -> open -> completed`; `crm_audit_log` records every actor & timestamp; SideRail `Attention Queue` badge increments then decrements in lockstep. |
| **6** | In **Customer Queue**, select 2 customers -> `Tag VIP` + `Email`, then run `Issue Credit Memo / RMA` on an open return. | `crm_customer_tag_assignments` + `support_contacts.is_vip = true`; `crm_messages` + `email_messages` written; `acct_ar_credit_memos` + reversing `acct_journal_entries` posted; `customer_return_requests.status = 'completed'`. |
| **7** | In **Seller Queue**, invite a 1099 contractor (`§B4`), attempt `Approve & clear hold` BEFORE W-9 (must fail `422`), upload W-9, then `Approve & clear hold`. | Pre-W9 approval blocked (`0` transfers); after W-9 upload (`w9_received_at IS NOT NULL`), approval sets `sellers.status = 'approved'`, emits `commerce_outbox_events`, transitions `seller_settlements.state = 'settled'`, and posts `DR 2150 / CR 1050`. |
| **8** | In **Cap Table**, adopt a **409A Valuation** (`$2.14` FMV), attempt option grant at `$1.50` (must fail `422`), grant at `$2.14` (`10,000` opts), then close a new **Priced Round** and attempt another grant (must fail `422` due to material event superseding FMV). | `val_reports.status = 'adopted'` -> `$1.50` grant rejected (`0` rows) -> `$2.14` grant writes `cap_table_snapshots`, `cap_securities`, `cap_grants`, 48 `cap_vesting_events`, and hash-chained `cap_transactions` -> Priced Round inserts `val_material_events`, flips `val_reports.status = 'superseded'`, and blocks subsequent grant until new 409A adoption. |
