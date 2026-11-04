# 01 — Global Shell & Shared Platform Primitives Wiring

**Code Nodes Covered:**
- `components/GlobalShell.tsx`
- `components/Header.tsx`
- `components/MainRail.tsx`
- `components/SideRail.tsx`
- `components/CreateFlyout.tsx`
- `components/PeekDrawer.tsx`
- `components/RecordDrawer.tsx`
- `components/DocumentEngine.tsx`
- `components/dashboard/DashboardModals.tsx` (`CreateActionsCustomizerDrawer`, `ListCustomizeDrawer`)

---

## 1. Persistent Closeable Workspace Tabs (`Header.tsx` + `GlobalShell.tsx`)

### What the Chrome Promises
1. Every screen opened from `SideRail`, `MainRail`, KPI cards, or queue jump-links opens or activates a tab in `#tabstrip`.
2. Switching tabs preserves scroll position, active filters, and unsaved form drafts without unmounting/losing work.
3. Hovering a tab reveals `×`; clicking `×` closes that tab (and if closing the last tab, opens the default fallback tab).
4. Reloading the browser or logging in on another workstation restores the user's open tabs and active tab.

### Backing Tables
- `public.user_workspace_sessions` (`id`, `user_id`, `active_tab_id`, `max_tabs`, `updated_at`)
- `public.user_session_tabs` (`id`, `session_id`, `tab_id`, `title`, `module_path`, `params`, `form_data_cache`, `scroll_position`, `tab_order`, `group_id`, `group_title`)

### Expected Runtime Behavior
- **Boot (`GET /api/shell/session`):**
  1. Upsert `user_workspace_sessions` for `auth.uid()` (`ON CONFLICT (user_id) DO NOTHING`).
  2. Query `user_session_tabs` ordered by `tab_order ASC`.
  3. If `0` rows exist, seed default tab `tab_id = 'dashboard:ops'`, `module_path = '/dashboard/ops'`, `tab_order = 0`, and set `active_tab_id = 'dashboard:ops'`.
- **Open / Activate Tab (`PUT /api/shell/session/tabs`):**
  1. Enforce `max_tabs` (default `15` from `user_workspace_sessions.max_tabs`): if user opens a 16th distinct tab, return `409 MAX_TABS_REACHED` and surface toast `"Maximum of 15 open tabs reached — close a tab first"` instead of silently dropping state.
  2. Upsert `user_session_tabs` on `(session_id, tab_id)` with `title`, `module_path`, `params` (serialized filter/tab query), and update `user_workspace_sessions.active_tab_id`.
- **Draft & Scroll Sync (Debounced `800ms` `PATCH /api/shell/session/tabs/[tabId]`):**
  - Persist `scroll_position` (`#screen` scrollTop) and `form_data_cache` (any dirty `RecordDrawer` or `Explorer` query state).
- **Close Tab (`DELETE /api/shell/session/tabs/[tabId]`):**
  1. Delete row from `user_session_tabs` where `(session_id, tab_id)` matches.
  2. Re-compact `tab_order` (`0..N-1`) and update `active_tab_id` to the adjacent surviving tab.

### Row-Proof Check
```sql
SELECT s.active_tab_id, t.tab_id, t.tab_order, t.params, t.scroll_position
FROM public.user_workspace_sessions s
JOIN public.user_session_tabs t ON t.session_id = s.id
WHERE s.user_id = auth.uid()
ORDER BY t.tab_order;
```

---

## 2. Top Header Global Search & Command Bar (`Header.tsx`)

### What the Chrome Promises
- Typing in the top search bar searches across customers, orders, SKUs, invoices, bills, vendors, tickets, and equity stakeholders; pressing `Cmd+K` opens the Universal Create / Command Flyout.

### Backing RPCs & Tables
- `public.global_search(search_query text, result_limit integer, requested_tenant_id uuid)`
- `public.crm_search_index` (`entity_type`, `entity_id`, `search_text` GIN index)
- `public.search_events` (`tenant_id`, `query`, `surface`, `result_count`, `clicked_ref`)

### Expected Runtime Behavior
1. **Note on `global_search()` Cleanup:** The existing `global_search()` SQL function still contains legacy `UNION ALL` legs referencing `public.dogs` and `public.bookings`. Replace or wrap with `rpc_commerce_global_search(p_tenant_id, p_query, p_limit)` querying:
   - `crm_customers` / `acct_customers` (`entity_type = 'customer'`)
   - `erp_orders` / `commerce_orders` (`entity_type = 'order'`)
   - `acct_ar_invoices` (`entity_type = 'invoice'`)
   - `acct_ap_bills` (`entity_type = 'bill'`)
   - `commerce_catalog_items` / `erp_product_skus` (`entity_type = 'product'`)
   - `sellers` / `acct_vendors` (`entity_type = 'seller_or_vendor'`)
   - `support_tickets` via `support_tickets.search_vector` (`entity_type = 'ticket'`)
   - `cap_stakeholders` (`entity_type = 'stakeholder'`)
2. **Telemetry & Click-Through:** Log each debounced query (`>= 2` chars) to `search_events` (`surface = 'header'`). Clicking a result opens the corresponding domain tab AND opens `PeekDrawer` pre-loaded with that `entity_id`, updating `search_events.clicked_ref`.

---

## 3. SideRail: Business/Accountant View Toggle, Live Badges & Feature Gates (`SideRail.tsx`)

### What the Chrome Promises
1. **Business / Accountant Toggle:** Switches Finance & Global navigation between operational QB groups (`Sales & Get Paid`, `Expenses & Bills`, `Customer Hub`) and ERP controller books (`Books`, `Journal`, `Ledger`, `Period close & locks`, `Transfers`, `Audit trail`, `Entities`, `Multi-currency`, `Controls`).
2. **Count Badges:** Live open counts on `Attention Queue`, `Customer Queue`, `Seller Queue`, `Receipts`, `Bank transactions` (unmatched), and `Bills` (unpaid).
3. **Gear Menu:** Direct navigation to `Account & settings`, `Manage users`, `Chart of accounts`, `All lists`, `Products & services`, `Custom fields`, `Reclassify transactions`, `Reconcile`, `Audit log`.
4. **Gated Routes:** Locked/unavailable modules show `"This product isn't available for your account"`.

### Backing Tables
- `public.tenant_settings` (`tenant_id`, `section = 'ui_preferences'`, `data`) or `public.portal_user_preferences`
- `public.platform_feature_flags` (`tenant_id`, `audience`, `flag_key`, `enabled`)
- `public.platform_module_permissions` (`tenant_id`, `staff_id`, `module_code`, `access_level`)

### Expected Runtime Behavior
- **View Mode Toggle:** Persist `viewMode` (`'business' | 'accountant'`) per user in `portal_user_preferences` (extend with `finance_view_mode text DEFAULT 'business'`). In `accountant` mode, append the Accountant group in `SideRail` exposing `acct_books`, `acct_journal_entries`, `rpc_get_general_ledger`, `acct_periods` + `acct_close_checklists`, `acct_intercompany_transactions`, `acct_audit_log`, `acct_entities`, `acct_exchange_rates`, and `acct_controls`.
- **Badge Poll / Realtime (`GET /api/shell/badges`):** Single aggregated query returning counts for:
  - `attention`: open rows in `v_dashboard_attention_queue`
  - `customer-queue`: open rows in `v_dashboard_customer_queue`
  - `seller-queue`: actionable rows in `v_dashboard_seller_queue`
  - `bank`: `SELECT count(*) FROM acct_bank_transactions WHERE tenant_id = $1 AND match_status = 'unmatched'`
  - `receipts`: `SELECT count(*) FROM acct_receipt_extractions WHERE tenant_id = $1 AND status = 'pending'`
  - `bills`: `SELECT count(*) FROM acct_ap_bills WHERE tenant_id = $1 AND status IN ('draft','pending_approval','approved','overdue')`
- **Gated Route Check:** Before rendering any feature-gated screen (e.g., `tax-filing`), check `platform_feature_flags` (`flag_key = 'finance.tax_filing'`). If `enabled = false`, render the canonical gated empty state with an admin upgrade/request CTA.

---

## 4. Customizable Create Actions Row (`CreateActionsStrip` + `CreateActionsCustomizerDrawer`)

### What the Chrome Promises
- Every domain Overview displays up to 10 quick-create chips (`Create actions:`).
- Clicking `Customize (N/10)` opens the right drawer where the user filters by `All` or `Favorites ★`, checks/unchecks up to 10 actions, reorders them (`↑` / `↓`), and clicks `Save and close`.

### Backing Tables
- `public.platform_quick_action_registry` (`id`, `action_code`, `module`, `display_name`, `api_route`)
- `public.platform_create_favorites` (`user_id`, `action_code`, `sort_order`, `created_at`) — **RLS enabled in Hotfix Part B (`user_id = auth.uid()`)**

### Expected Runtime Behavior
1. **Seed Registry:** Seed `platform_quick_action_registry` with all `CREATE_REGISTRY` entries (`invoice`, `sales_order`, `receive_payment`, `payment_link`, `expense`, `bill`, `pay_bills`, `purchase_order`, `product`, `design`, `discount_code`, `customer`, `vendor`, `supplier`, `contractor`, `rma`, `task`, `reconcile`).
2. **Load (`GET /api/platform/create-favorites`):** Query `platform_create_favorites` joined to `platform_quick_action_registry` ordered by `sort_order ASC`. If `0` rows exist for `auth.uid()`, return the domain's default 7 actions without mutating DB until user customizes.
3. **Save (`PUT /api/platform/create-favorites`):**
   - Server enforces `array_length(actions, 1) <= 10`.
   - Inside a transaction for `user_id = auth.uid()`: `DELETE FROM platform_create_favorites WHERE user_id = auth.uid()`, then bulk `INSERT` `(user_id, action_code, sort_order)` for indices `0..N-1`.

---

## 5. P1 List-System, Saved Views & Data/Visual Customizer (`ListCustomizeDrawer`)

### What the Chrome Promises
- **View Tabs:** Instant server-backed status segment filtering.
- **Filter Bar + Date Range + Saved Views:** Save current filter + column + visual configuration as a named pill; click any saved pill to restore.
- **Customize Drawer:**
  - `Data` tab: Toggle & reorder columns including audit fields (`Created by`, `Created on`, `Modified by`, `Modified on`) plus custom fields from `platform_custom_fields`.
  - `Visual` tab: Currency symbol `$`, accounting parentheses `($1,234)`, decimal precision (`0` or `2`), and `Divide by 1,000 ($K)`.
- **Bulk Bar & `⋯` Row Menu:** Entity-specific multi-row mutations.
- **Empty State:** 3-step onboarding pills + `[Import]` (opens `acct_import_jobs` CSV uploader) + `[Add]`.

### Backing Tables
- `public.platform_saved_views` (`id`, `user_id`, `entity_type`, `name`, `filters`, `columns`, `sort`, `is_shared`)
- `public.platform_custom_fields` (`tenant_id`, `entity_type`, `field_key`, `label`, `field_type`, `options`, `is_active`)

### Expected Runtime Behavior
- Store `visualConfig` (`{ currencySymbol, parenthesesNegatives, decimals, divideBy1000 }`) inside `platform_saved_views.filters->'__visual'` and ordered `{ key, visible }[]` inside `platform_saved_views.columns` (`jsonb`).
- Every P1 list maintains an implicit `'__default__'` row in `platform_saved_views` per `(user_id, entity_type)` so clicking `Apply & close` in `ListCustomizeDrawer` persists column order and number formatting across reloads!
- Clicking `Import` on any empty state opens the CSV import modal, uploads the file to Supabase Storage, inserts a row into `acct_import_jobs` (`entity_type`, `source_file_name`, `source_uri`, `status = 'queued'`), and triggers the import parser worker.

---

## 6. Shared Containers: Peek Drawer, Party Drawer (`B2`), Product Drawer (`B3`) & Document Engine (`C`)

### 6.1 Right Peek Drawer (`PeekDrawer.tsx`)
- **Intent:** Clicking any table row opens a fast right-side summary without leaving the list; user can read status, key fields, real audit activity, and notes/tasks, or click `Open full` to launch the full `DocumentEngine` or `RecordDrawer`.
- **Wiring:**
  - `GET /api/records/[family]/[id]/peek` fetches:
    1. Canonical record fields.
    2. Last 10 activity events from `acct_audit_log` / `crm_activity` / `commerce_order_events` / `support_ticket_events` (replaces hardcoded `"Created by SA / Viewed 3 times"`).
    3. Linked notes from `crm_notes` / `erp_order_notes` and open tasks from `crm_tasks`.
  - Typing in `Notes & tasks` textarea and pressing Save (`Enter` or blur button) `INSERT`s into `crm_notes` (`customer_id` / `order_id`, `note_type = 'general'`, `body`, `created_by = auth.uid()`).

### 6.2 Unified Party Drawer (`RecordDrawer.tsx` — §B2)
- **Intent:** One drawer with stackable role chips (`Customer`, `Vendor`, `Supplier`, `Contact`) and universal footer (`Cancel` | `Save and new` | `Save and close`).
- **Transactional Write (`POST /api/parties`):**
  - If `Customer` chip active:
    1. Resolve tenant's default AR account (`acct_chart_of_accounts` code `'1100'` or `'1200'`).
    2. Insert/update `crm_customers` (names, email, phone, address, `marketing_email_opt_in`, `lifecycle_stage = 'active'`).
    3. Insert/update `acct_customers` (`legal_name`, `email`, `payment_terms_days`, `credit_limit`, `tax_exempt`, `ar_account_id`).
    4. Link in `platform_customer_identity_links (tenant_id, crm_customer_id, acct_customer_id)`.
  - If `Vendor` chip active:
    1. Resolve tenant's default AP account (`acct_chart_of_accounts` code `'2000'`).
    2. Insert/update `acct_vendors` (`legal_name`, `email`, `payment_terms_days`, `ap_account_id`, `default_expense_account_id`, `is_1099_vendor`, `ach_routing_number`, `ach_account_last4`).
    3. Insert/update `erp_vendors` and link in `platform_vendor_identity_links`.
    4. If `"Request W-9"` checked, enqueue W-9 onboarding invite (see `03-QUEUES-END-TO-END-LOOP-WIRING.md` §3.2).
  - If `Supplier` chip active:
    1. Also upsert `suppliers` (`name`, `slug`, `kind = 'pod'`, `api_base_url`, `ordering_status`) and store SLA/lead-time metadata on `acct_vendors.metadata`.

### 6.3 Product / Service Drawer (`RecordDrawer.tsx` — §B3)
- **Intent:** Maps every sellable/purchasable item to its Income and COGS accounts so invoices, bills, and GMV waterfalls never hit unmapped suspense accounts.
- **Transactional Write (`POST /api/catalog/items`):**
  1. Upsert `erp_products` + `erp_product_skus` (`sku`, `unit_price`, `standard_cost`, `reorder_point`).
  2. Upsert `commerce_catalog_items` (`sku_id`, `item_type`, `sku`, `name`, `taxable`, `tax_code_id`).
  3. Upsert `commerce_prices` on active retail `commerce_price_lists` (`price`, `cost_price`).
  4. **Mandatory Accounting Link:** Upsert `commerce_accounting_mappings` (`tenant_id`, `mapping_type = 'item'`, `catalog_item_id`, `revenue_account_id`, `cogs_account_id`, `inventory_account_id`). Enforce `NOT NULL` on `cogs_account_id` whenever `"I purchase this from a supplier"` is checked.
  5. If `"I purchase this from a supplier"` is checked with `preferred_supplier`, upsert `erp_vendor_items (tenant_id, vendor_id, sku_id, unit_cost, is_preferred = true)`.

### 6.4 Document Engine (`DocumentEngine.tsx` — §C)
- **Intent:** Full-screen 4-tab document studio (`Edit | Email view | Payor view | PDF view`) with right-hand `payment-options-rail` and universal footer (`Cancel` | `Print or download` | `Make recurring` | `Save ▾` | `Review and send ▾`).
- **Expected Behavior per Footer Action:**
  - **`Save` (Draft):** Writes `acct_ar_invoices` + `acct_ar_invoice_lines` with `status = 'draft'` (does **not** post GL journal yet).
  - **`Save and post` (from `Save ▾` split menu):** Validates lines, calls `acct_post_journal()` (`DR 1100 Accounts Receivable`, `CR 4010..4040 Revenue by Category`, `CR 2100 Sales Tax Payable`), updates `acct_ar_invoices` (`status = 'posted'`, `posted_journal_id`).
  - **`Review and send`:** Posts the invoice (if still `draft`), creates a `checkouts` payment-link row (`slug`, `invoice_id`, `amount`, `status = 'active'`), renders HTML/PDF snapshot to `acct_attachments`, inserts outbound row in `email_messages` (`relatedInvoiceId`, `status = 'QUEUED'`), and sets `acct_ar_invoices.sent_at = now()`.
  - **`Make recurring`:** Opens the `recurring-template` modal (`Scheduled | Reminder | Unscheduled`, interval, start/end) and writes `acct_recurring_invoices` + `acct_recurring_invoice_lines`.
  - **`Print or download`:** Streams deterministic server-rendered PDF of the `PDF view` layout and records SHA-256 in `acct_attachments`.
