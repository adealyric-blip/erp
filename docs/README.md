# Canonical Engineering Wiring Blueprint — Unsaid / ManageKube Platform

**Status:** Canonical Behavioral & Data Wiring Specification  
**Baseline Schema:** Production Supabase Catalog (`pcwwvfgxnrglmmpbfqhf`, 2026-11-02) + Hotfix Part B RLS + Cap Table / 409A DDL (`db/cap_table_409a_schema.sql`)  
**UI Baseline:** Next.js 15 App Router Shell (`components/GlobalShell.tsx`, `components/dashboard/*`, `components/cap-table/*`, `components/DocumentEngine.tsx`, `components/RecordDrawer.tsx`, `components/PeekDrawer.tsx`)

---

## 1. The Engineering Mandate: "Read the Intent from the Chrome"

A route file that executes `SELECT * FROM table LIMIT 50` and returns `200 OK` is **not wired**. A button that fires a toast (`onToast('Resolved')`) or mutates ephemeral `useState` is **a mockup**.

**Canonical Definition of "Wired" (100% Done):**
Every control visible in the UI chrome is a promise to the operator. A feature is only marked **Done** when a real authenticated tenant user can execute the entire operational loop from the UI chrome, survive a hard browser refresh, trigger all downstream accounting/inventory/notification side effects, and prove the state transition via persisted rows in PostgreSQL.

### The 6-Gate Proof-of-Row Checklist
Before any mock constant (`data/dashboardData.ts`, `data/capTableData.ts`, `DEMO_ROWS` in `data/shellData.ts`) is removed for a screen, every interactive node on that screen must pass all six gates:

1. **Chrome Intent Audit:** Every visible button, split-menu item, tab, filter, sort header, `⋯` row action, bulk bar button, drawer field, and KPI drill-down has an explicit server read/write contract—zero dead buttons and zero toast-only stubs.
2. **Tenant & Permission Gate:** Every request resolves `tenant_id` from authenticated session membership (`platform_is_tenant_member(tenant_id)`), sets `SET LOCAL app.current_tenant_id = '<uuid>'` inside the DB transaction where session-GUC RLS policies apply, and verifies module capability (`platform_has_permission`).
3. **Atomic Domain Mutation:** Multi-table invariants execute inside a single PostgreSQL transaction or `SECURITY DEFINER` RPC (e.g., approving an RMA creates the credit memo, posts the balanced reversing journal to `acct_journal_entries`/`acct_journal_lines`, updates `acct_ar_invoices` or `commerce_refunds`, and enqueues the processor refund).
4. **External / Async Loop Closure:** Actions that promise external delivery (sending an invoice, emailing a W-9 link, triggering a Stripe payout, generating a CSV export, snoozing a queue item for 4 hours) write to durable outbox/job tables (`commerce_outbox_events`, `email_messages`, `sync_jobs`, `analytics_export_runs`, `crm_tasks.snoozed_until`) and have a worker/cron consumer that advances status to `sent`/`succeeded`/re-queued.
5. **UI Revalidation & Cross-Tab Sync:** Mutating a record in one workspace tab invalidates/updates KPI tiles, funnel bars, SideRail queue count badges, and PeekDrawer state across all open workspace tabs without stale local state.
6. **Row-Proof Assertion:** Automated end-to-end verification performs the flow through the UI and asserts exact row counts, foreign keys, journal debit/credit balance, and audit log entries (`acct_audit_log`, `crm_audit_log`, `erp_audit_log`, `cap_transactions`).

---

## 2. Critical Schema & RLS Reconciliation Rules (Must Apply First)

Inspecting the live production catalog (`pcwwvfgxnrglmmpbfqhf`) reveals five structural realities that **must** be obeyed when wiring code so queries never silently return `0 rows` or write to split ledgers:

### Rule 1 — Canonical General Ledger is `acct_*` (Retire Legacy Duplicate Ledger Writes)
The schema currently contains two parallel accounting table sets:
- **Canonical Enterprise Ledger (`acct_*`):** `acct_entities`, `acct_books`, `acct_periods`, `acct_chart_of_accounts`, `acct_journal_batches`, `acct_journal_entries`, `acct_journal_lines`, `acct_ar_invoices`, `acct_ar_invoice_lines`, `acct_ar_receipts`, `acct_ar_receipt_applications`, `acct_ar_credit_memos`, `acct_ap_bills`, `acct_ap_bill_lines`, `acct_ap_payments`, `acct_ap_payment_applications`, `acct_bank_accounts`, `acct_bank_transactions`, `acct_reconciliations`, `acct_payouts`, `acct_gateway_clearing_entries`.
- **Legacy Ledger:** `chart_of_accounts`, `journal_entries`, `journal_lines`, `invoices`, `bills`, `receipts`, `bank_accounts`, `bank_transactions`, `reconciliations`.

> **CRITICAL BUG TO FIX DURING WIRING:**  
> All reporting RPCs (`rpc_get_profit_and_loss`, `rpc_get_balance_sheet`, `rpc_get_general_ledger`, `rpc_get_trial_balance`) read **exclusively** from `acct_journal_entries` + `acct_journal_lines` + `acct_chart_of_accounts`. However, helper functions `take_payment()`, `create_bill()`, and `create_receipt()` currently call `post_journal()` which writes to legacy `journal_entries` / `journal_lines`!  
> **Resolution:** Refactor `take_payment`, `create_bill`, and `create_receipt` (or replace with `acct_take_payment`, `acct_create_bill`, `acct_create_receipt`) to post **exclusively via `acct_post_journal()`** against the tenant's primary `acct_books` (`WHERE is_primary = true`) and open `acct_periods`. Never write new transactions to legacy `invoices`, `bills`, or `journal_entries`.

### Rule 2 — Mixed RLS Policy Posture Across `public` Tables
Production tables use three distinct RLS mechanisms:
1. **Membership Function RLS:** `USING (platform_is_tenant_member(tenant_id))` — works automatically with a user-scoped Supabase client (`auth.uid()`).
2. **GUC Session Variable RLS:** Tables like `acct_ar_invoices`, `acct_ap_bills`, `acct_chart_of_accounts`, `acct_journal_entries`, `acct_bank_transactions`, `crm_customers`, `erp_orders`, `support_tickets` use:
   ```sql
   USING ((tenant_id = current_setting('app.current_tenant_id', true)::uuid)
          OR current_setting('app.current_tenant_id', true) IS NULL)
   ```
   **Mandatory Server Pattern:** Every Next.js API Route / Server Action MUST resolve `active_tenant_id` from `profiles` + `tenant_memberships` (`platform_is_tenant_member`), explicitly filter every query with `.eq('tenant_id', tenantId)`, AND execute a migration tightening those policies to `USING (platform_is_tenant_member(tenant_id))` so leaving `app.current_tenant_id` unset never leaks rows.
3. **`service_role`-Only Tables:** `acct_estimates`, `acct_recurring_invoices`, `acct_refunds`, `acct_refund_policies`, `acct_disputes`, `acct_gift_cards`, `acct_gift_card_transactions`, `acct_tax_filings`, and `acct_tax_rates` currently have `FOR ALL TO service_role` policies only. Browser-direct PostgREST calls with a user JWT will return `[]`. Either add `platform_is_tenant_member(tenant_id)` policies in a migration or route all reads/writes through authenticated Next.js server handlers (`/api/finance/*`) that verify `platform_is_tenant_member(tenantId)` before querying with the server client.

### Rule 3 — Hotfix Part B Per-User Platform Tables
Per Hotfix Part B:
- `platform_create_favorites (user_id, action_code, sort_order)` — RLS enforces `user_id = auth.uid()`.
- `platform_saved_views (id, user_id, entity_type, name, filters, columns, sort, is_shared)` — RLS enforces `user_id = auth.uid()`. Because `platform_saved_views` has **no `tenant_id` column**, `is_shared` must remain `false` (or read from `crm_saved_views` which **does** have `tenant_id`) until `ALTER TABLE public.platform_saved_views ADD COLUMN tenant_id uuid REFERENCES public.tenants(id)` is applied.

### Rule 4 — Party Identity Bridge (`B2` Single Party Drawer)
A "Party" in the UI is one unified drawer with stackable role chips (`Customer`, `Vendor`, `Supplier`, `Contact`), backed by synchronized domain tables:
- **Customer role:** `crm_customers` ↔ `acct_customers` linked 1:1 in `platform_customer_identity_links (tenant_id, crm_customer_id, acct_customer_id)`.
- **Vendor / Contractor role:** `acct_vendors` ↔ `erp_vendors` linked 1:1 in `platform_vendor_identity_links (tenant_id, acct_vendor_id, erp_vendor_id)`.
- **POD / Dropship Supplier role:** `acct_vendors` + `suppliers` (`kind IN ('pod','dropship','marketplace','seller')`).

### Rule 5 — Cap Table (`cap_*`) & 409A (`val_*`) Tenant Binding & Immutability
`db/cap_table_409a_schema.sql` defines `cap_companies` as the root issuer entity. When deploying to production Supabase:
1. Add `tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE` to `cap_companies`.
2. Enable RLS on all `cap_*` and `val_*` tables gated by `EXISTS (SELECT 1 FROM cap_companies c WHERE c.id = company_id AND platform_is_tenant_member(c.tenant_id))`.
3. Add a `BEFORE UPDATE OR DELETE ON cap_transactions` trigger (`cap_block_ledger_mutation()`) that unconditionally raises an exception—matching `acct_block_posted_mutation()`—so ownership history can never be mutated in place, even by `service_role`.

---

## 3. Document Map

| Document | Scope & Modules Covered |
| :--- | :--- |
| **[`01-SHELL-AND-SHARED-PRIMITIVES-WIRING.md`](./01-SHELL-AND-SHARED-PRIMITIVES-WIRING.md)** | Top Header, Global Search (`global_search`), Persistent Closeable Workspace Tabs (`user_workspace_sessions` / `user_session_tabs`), SideRail Badges & Business/Accountant View Toggle, Customizable Create Actions Row (`platform_create_favorites`), P1 List-System (`Data`/`Visual` Customizer, Saved Views, Split Menus, Bulk Bars), Peek Drawer, Party Drawer (`B2`), Product Drawer (`B3`), and Document Engine (`C`). |
| **[`02-HOME-DASHBOARD-OPERATIONS-GMV-ANALYTICS-WIRING.md`](./02-HOME-DASHBOARD-OPERATIONS-GMV-ANALYTICS-WIRING.md)** | **Operations Vitals** (`/admin`), **Company Setup Checklist & 5-Step Wizard**, **Executive GMV & Margins** (`/dashboard`), **Analytics Overview** (`/analytics`), and **Analytics Explorer** (`/analytics/explorer`) — exact SQL derivations, CoA mappings, cohort math, pivot engine, and scheduled exports. |
| **[`03-QUEUES-END-TO-END-LOOP-WIRING.md`](./03-QUEUES-END-TO-END-LOOP-WIRING.md)** | **Attention Queue** (`/notifications`), **Customer Queue** (`/customers`), and **Seller Queue** (`/seller`) — full chrome-to-database-to-worker loops for Resolve, Assign, Snooze, Reply/Email, Tag VIP, AR Statement, RMA/Credit Memo, Merge, Contractor W-9 Invite (`§B4`), KYB Approval, and Escrow Payout Release. |
| **[`04-FINANCE-LEDGER-AND-CAP-TABLE-WIRING.md`](./04-FINANCE-LEDGER-AND-CAP-TABLE-WIRING.md)** | **Financial Accounting Tables** (`Sales & Get Paid`, `Expenses & Bills`, `Receipts Inbox`, `Bank Feed & Rules`, `Reconcile`, `Chart of Accounts`, `Business Tax & 1099s`) + **All 11 Cap Table & 409A Screens** (`Overview`, `Cap Table`, `Stakeholders`, `Funding Rounds`, `Option Pool`, `SAFEs`, `Dilution Modeler`, `Liquidation Waterfall`, `409A & Valuations`, `Documents`, `Equity Events`) + **End-to-End Row-Proof Test Matrix**. |
