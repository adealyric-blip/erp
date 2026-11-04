# 03 — Dashboard Queues: End-to-End Operational Loop Wiring

**Code Nodes Covered:**
- `components/dashboard/QueueViews.tsx` (`AttentionQueueView`, `CustomerQueueView`, `SellerQueueView`)
- `components/dashboard/DashboardModals.tsx` (`QuickTaskModal`, `ContractorInviteModal`)
- `components/SideRail.tsx` (`screenBadges` live counts)

> **Core Queue Rule:** A queue row is **never** a mock notification string that gets hidden by toggling a client boolean. Every row represents a real domain object in an actionable state. Clicking **Resolve**, **Assign**, **Snooze**, **Email**, **Approve**, or **Release Hold** must transition the underlying domain record, emit its audit/outbox event, execute external side effects, and naturally drop out of the active queue query because the underlying problem is actually solved.

---

## 1. Attention Queue (`/notifications` — `AttentionQueueView`)

### 1.1 Federated Read View (`v_dashboard_attention_queue`)
Create a database view (or server union query) scoped by `tenant_id` uniting the 6 live operational exception sources into one normalized shape `(id, source_table, source_id, code, title, category, severity, entity, owner_user_id, owner_label, impact_amount, sla_due_at, snoozed_until, status, target_domain, target_screen, summary, created_at, modified_by)`:

1. **Orders & SLA (`Orders & SLA`):**
   - `erp_orders` where `status NOT IN ('shipped','delivered','completed','cancelled','closed')` AND `(sla_due_at <= now() + interval '6 hours' OR status = 'on_hold')`
   - `dropship_pipe_attempts` where `state IN ('failed','blocked','unknown_outcome')`
2. **Preflight & Studio Gate (`Catalog & Preflight`):**
   - `designs` joined to `design_files` where `designs.status IN ('needs_review','publish_failed')` OR `(designs.status = 'ready_to_publish' AND design_files.dpi < 300)`
3. **Overdue AR & Shipment Holds (`Finance & Bills`):**
   - `acct_ar_invoices` where `status IN ('posted','partially_paid','overdue')` AND `due_date < current_date`
   - `acct_ar_collections_cases` where `status IN ('open','escalated')`
4. **Supplier Bills & OCR Intake (`Finance & Bills`):**
   - `acct_ap_bills` where `status IN ('draft','pending_approval')` AND `due_date <= current_date + 10`
   - `acct_receipt_extractions` where `status = 'pending'` AND `ocr_score < 0.90`
5. **Gateway Reserves & Chargebacks (`Finance & Bills`):**
   - `acct_disputes` / `commerce_disputes` where `status IN ('open','under_review')`
   - `acct_gateway_clearing_entries` where `reserve_amount > 0 AND state = 'in_clearing'`
6. **Damaged / Urgent RMAs & Manual Ops Tasks (`Support & RMA` / `All`):**
   - `erp_return_authorizations` / `customer_return_requests` where `status = 'requested'`
   - `crm_tasks` where `status NOT IN ('completed','cancelled')` AND `(snoozed_until IS NULL OR snoozed_until <= now())`
   - `crm_needs_attention` where `status = 'open'`

### 1.2 Every Chrome Action — Complete End-to-End Loop

| Chrome Trigger | Exact Server & Database Execution Loop | Proof-of-Row Outcome |
| :--- | :--- | :--- |
| **`New task` (Primary Split Button -> `QuickTaskModal`)** | `POST /api/queues/attention/tasks` → Inserts into `crm_tasks` (`tenant_id`, `created_by = auth.uid()`, `assigned_to = auth.uid()`, `task_type`, `priority = 'urgent'`, `title`, `description`, `due_at = now() + interval '4 hours'`, `status = 'open'`) + logs `crm_audit_log`. If `"Save and new"` clicked, modal resets form while newly inserted row immediately appears in table & increments SideRail badge. | New row in `crm_tasks` (`status='open'`); `v_dashboard_attention_queue` count `+1`. |
| **`Assign to me (SA)` / Owner Selector (Row `⋯` & Bulk Bar)** | `PATCH /api/queues/attention/assign` → Resolves `crm_staff.id` & `auth.uid()`. Updates `assigned_to` / `owner` on the underlying source row (`crm_tasks.assigned_to`, `acct_ar_collections_cases.assigned_to`, `support_tickets.assigned_staff_id`, or upserts a tracking shadow row in `crm_tasks` linked via `source_table:source_id`). Inserts `employee_notifications` for the assignee. | Assignee persisted on source record; filtering `Owner: SA` returns the row after reload. |
| **`Snooze 4 hours` (Row `⋯` & Bulk Bar)** | `POST /api/queues/attention/snooze` → Sets `crm_tasks.snoozed_until = now() + interval '4 hours'` (or `crm_needs_attention.status = 'snoozed'`, `due_by = now() + interval '4 hours'`). Row disappears from `All` / `Critical` tabs immediately. **`pg_cron` job** runs every 5 minutes (`UPDATE crm_needs_attention SET status='open' WHERE status='snoozed' AND due_by <= now()`) so snoozed items automatically wake back up when the 4h timer expires! | `snoozed_until` timestamp populated; row absent while `now() < snoozed_until`, re-surfaces automatically once expired. |
| **`Resolve exception` (Row `⋯`, Bulk Bar & Ops Vitals Snapshot)** | `POST /api/queues/attention/resolve` → Dispatches by `source_table`:<br>• `crm_tasks`: `SET status = 'completed', completed_at = now()`<br>• `crm_needs_attention`: `SET status = 'resolved', resolved_at = now(), resolved_by = staff_id`<br>• `designs` (preflight): if high-res file attached (`dpi >= 300`), transitions `status = 'approved'`; if still `<300 DPI`, **blocks blind resolve** with `422 PREFLIGHT_STILL_FAILING` and deep-links user into Konva Studio!<br>• `acct_ap_bills`: transitions `pending_approval -> approved` via `acct_ap_approvals` (`acted_at = now()`)<br>• `customer_return_requests`: transitions `requested -> approved` + creates `erp_return_authorizations`. | Source table row transitioned + `acct_audit_log`/`crm_audit_log` entry recorded; row moves to `Resolved` tab; SideRail badge decrements by `1`. |
| **`Open source workspace` (Row `⋯`)** | Calls `openOrActivateTab(row.targetDomain, row.targetScreen)` with `params: { highlightId: row.source_id }` persisted in `user_session_tabs`, scrolling to and opening `PeekDrawer` for that exact record in the destination module. | Destination tab opens with the exact invoice/order/design focused. |

---

## 2. Customer Queue (`/customers` — `CustomerQueueView`)

### 2.1 Commerce-Only Data Source (`v_dashboard_customer_queue`)
Per Feature Tree v3 §F, **zero pet/grooming/appointment columns are ever queried**. Joins:
- `crm_customers c`
- `LEFT JOIN platform_customer_identity_links link ON link.crm_customer_id = c.id`
- `LEFT JOIN acct_customers ac ON ac.id = link.acct_customer_id`
- `LEFT JOIN crm_customer_behavior b ON b.customer_id = c.id`
- Aggregated commerce metrics from `commerce_sales` / `erp_orders` (`orders_count`, `lifetime_value`, `last_order_date`, `primary_channel_source`)
- Open AR balance from `acct_ar_invoices` (`SUM(total - amount_paid - amount_credited) WHERE status IN ('posted','partially_paid','overdue')`)
- Open RMA count from `customer_return_requests` / `erp_return_authorizations`

**Queue Inclusion Predicate (who enters `Customer Queue`):**
Customers where at least one is true:
1. `open_ar_balance > 0 AND oldest_due_date <= current_date` → Bucket: `Overdue balance`
2. `open_rma_count > 0` → Bucket: `RMA & Refunds`
3. `c.next_follow_up_at <= now()` or open `crm_needs_attention` → Bucket: `Needs follow-up`
4. `b.win_back_candidate = true OR b.inactive_90_plus = true` → Bucket: `At risk`
5. `(b.high_lifetime_value = true OR c.lifetime_value >= 10000) AND open_inquiry_or_quote` → Bucket: `VIP / High LTV`

### 2.2 Every Chrome Action — Complete End-to-End Loop

| Chrome Trigger | Exact Server & Database Execution Loop | Proof-of-Row Outcome |
| :--- | :--- | :--- |
| **`Tag VIP` (Bulk Bar)** | `POST /api/queues/customers/tag` → Upserts tag `'VIP'` (`slug = 'vip'`) in `crm_tags` (`entity_type = 'customer'`), inserts `(tenant_id, customer_id, tag_id)` into `crm_customer_tag_assignments` & `crm_customer_tags` (`ON CONFLICT DO NOTHING`), sets `crm_customer_behavior.high_lifetime_value = true`, and updates `support_contacts.is_vip = true` so future support tickets inherit VIP SLA routing! | Rows in `crm_customer_tag_assignments` + `support_contacts.is_vip = true`. |
| **`Email` / Send Payment Link or Winback (Bulk Bar & Row Action)** | `POST /api/queues/customers/email` →<br>1. Checks `crm_customers.do_not_contact = false` (and for winback promos, `marketing_email_opt_in = true` and not in `marketing_suppressions`; transactional AR reminders allowed when `transactional_email_opt_in = true`).<br>2. For `Overdue balance` customers: auto-mints an active `checkouts` payment link for their open `acct_ar_invoices` and updates `acct_ar_invoices.last_reminder_at = now(), reminder_count = reminder_count + 1`.<br>3. Upserts `crm_conversations` (`channel = 'email'`), inserts outbound message in `crm_messages` + `email_messages` (`status = 'QUEUED'`), and logs `crm_activity` (`activity_type = 'email'`, `direction = 'outbound'`).<br>4. Mail worker dispatches via SMTP/Resend, updating `email_messages.status = 'SENT'`, `providerMessageId`, `sentAt`. | Rows in `crm_messages`, `email_messages` (`status='SENT'`), `checkouts`, and `crm_activity`. |
| **`Send AR Statement` (`Statement` in Split Menu)** | Calls `generate_customer_statement(tenant_id, customer_id, period_start, period_end)` + inserts into `acct_customer_statements` (with aging buckets `aging_current`, `aging_1_30`, `aging_31_60`, `aging_61_90`, `aging_over_90`), renders PDF to `acct_attachments`, and queues email in `email_messages`. | Row in `acct_customer_statements` (`status = 'sent'`) with aging buckets populated. |
| **`Issue Credit Memo / RMA` (Row `⋯` & Split Menu)** | Opens `DocumentEngine` in Credit Memo mode prefilled from the customer's `customer_return_requests` / `acct_ar_invoices`. Saving & posting:<br>1. Inserts `acct_ar_credit_memos` (`status = 'posted'`).<br>2. Calls `acct_post_journal()` (`DR 4200 Sales Returns`, `DR 2100 Sales Tax Payable`, `CR 1100 Accounts Receivable` or `1050 Clearing`).<br>3. If refunding card, inserts `commerce_refunds` / `acct_refunds`, executes Stripe `refunds.create`, and updates `customer_return_requests.status = 'completed'`. | Balanced `acct_journal_entries` + `acct_ar_credit_memos` + `customer_return_requests.status = 'completed'`. |
| **`Mark followed up` (Row `⋯` & Bulk Bar)** | Logs `crm_activity` (`activity_type = 'contacted'`), resolves open `crm_needs_attention` (`status = 'resolved'`) and `acct_ar_collections_cases` (`status = 'in_progress'`, `next_action_at = now() + interval '7 days'`), and advances `crm_customers.last_activity_at = now(), next_follow_up_at = NULL`. | Customer moves to `Resolved` tab; `crm_activity` audit row exists. |
| **`Merge` (Bulk Bar — 2+ Customers Selected)** | Opens Merge Confirmation preview comparing surviving vs source `crm_customers`. On confirm (`POST /api/parties/customers/merge`):<br>1. Repoints all FKs (`erp_orders`, `commerce_sales`, `acct_ar_invoices`, `crm_conversations`, `crm_notes`, `commerce_store_credits`) to `surviving_record_id`.<br>2. Reconciles `platform_customer_identity_links` and recomputes `lifetime_value` + `outstanding_balance`.<br>3. Sets `source.merged_into_customer_id = surviving.id, is_active = false, archived_at = now()`.<br>4. Writes full before-snapshot to `crm_merge_log` and marks `crm_duplicate_candidates.status = 'merged'`. | `crm_merge_log` row written; surviving customer owns combined order/invoice history; duplicate archived. |

---

## 3. Seller Queue (`/seller` — `SellerQueueView`)

### 3.1 Unified Counterparty Read View (`v_dashboard_seller_queue`)
Unites marketplace sellers, POD fulfillment suppliers, and 1099 contractors requiring action:
1. **Onboarding & KYB (`Onboarding & KYB`):** `onboarding_cases` (`state IN ('IN_GATES','READY_FOR_REVIEW','UNDER_REVIEW','NEEDS_INFO','BLOCKED_PENDING')`) joined to `sellers` (`status = 'applied'`) and `seller_stripe_accounts` (`onboarding_complete`, `charges_enabled`, `payouts_enabled`).
2. **Catalog & DPI Review (`Catalog review`):** `sellers` with pending `offers` (`status = 'draft'`), pending `seller_brand_authorizations` (`status = 'pending'`), pending `seller_category_approvals` (`status = 'pending'`), or `quarantine` (`resolved = false`).
3. **SLA & Quality (`SLA & Quality`):** `seller_performance_alerts` (`status = 'open'`) + POD `suppliers` where 7-day late shipment or damage RMA rate exceeds threshold (`Gelato` EU frame delay, etc.).
4. **Payouts & 1099 (`Payouts & 1099`):**
   - `seller_self_serve_profiles` where `tax_form_status = 'required_prompted'` or `payout_name_match = 'mismatch'`
   - `acct_vendors` where `is_1099_vendor = true AND w9_received_at IS NULL`
   - `seller_settlements` where `state = 'pending' AND pending_reason IS NOT NULL` (`SUM(net_cents)/100.0` = `payoutHold` column!)

### 3.2 Every Chrome Action — Complete End-to-End Loop

| Chrome Trigger | Exact Server & Database Execution Loop | Proof-of-Row Outcome |
| :--- | :--- | :--- |
| **`Invite seller / W-9` (`ContractorInviteModal` §B4)** | `POST /api/queues/sellers/invite` →<br>1. For `1099 Contractor` / `POD Supplier`: creates `acct_vendors` (`is_1099_vendor = (role='1099 Contractor')`) + `erp_vendors` + `platform_vendor_identity_links`, and creates draft `acct_payroll_tax_forms` (`form_type = 'W-9'`, `tax_year = extract(year from current_date)`, `status = 'draft'`).<br>2. For `Marketplace Seller` / `Design Partner`: creates `sellers` (`status = 'applied'`) + `onboarding_cases` (`state = 'DRAFT'`, `applicant_email`, hashed `applicant_token_hash`, 14-day expiry) + `onboarding_events`.<br>3. When `"Email counterparty to complete their profile & signed W-9"` is checked: queues onboarding/W-9 magic-link email in `email_messages`.<br>4. Counterparty portal submission uploads signed PDF to `partner_application_documents` / `acct_attachments` (`sha256`), sets `acct_vendors.w9_received_at = now()` or `seller_self_serve_profiles.tax_form_status = 'received'`, and updates `acct_payroll_tax_forms.status = 'accepted'`. | Rows created in `acct_vendors` / `sellers` + `onboarding_cases` + `email_messages`; row immediately visible in `Seller Queue`. |
| **`Request W-9 e-signature` (Row `⋯` & Bulk Bar)** | Generates fresh `applicant_token_hash` (7-day expiry), sets `seller_self_serve_profiles.tax_form_status = 'required_prompted', tax_form_prompted_at = now()`, and enqueues reminder email in `email_messages`. | `tax_form_prompted_at` updated + `email_messages` queued/sent. |
| **`Approve & clear hold` (Row `⋯` & Bulk Bar)** | `POST /api/queues/sellers/approve` (Atomic Transaction):<br>1. **Guard Check:** Verify `w9Status IN ('Verified','Exempt (Corp)')` AND (if marketplace seller) `seller_stripe_accounts.payouts_enabled = true`. If W-9 is still missing, **hard-block payout release** with `422 W9_REQUIRED_BEFORE_PAYOUT` (never release 1099-reportable funds without TIN on file!).<br>2. **Onboarding Approval:** Advance `onboarding_cases.state = 'APPROVED'`, insert `onboarding_events`, update `sellers.status = 'approved', approved_at = now(), approved_by = auth.uid()`. Note: `trg_outbox_seller_lifecycle` automatically emits `m10.onboarding.completed` to `commerce_outbox_events`!<br>3. **Catalog Gate Approval:** Update pending `seller_brand_authorizations` / `seller_category_approvals` to `'approved'` and promote `offers.status = 'active'` (passing `trg_offer_before()` trigger validation!).<br>4. **Escrow Settlement Release:** Select held `seller_settlements` (`state = 'pending'`), execute Stripe Connect `transfers.create` with `idempotency_key = seller_settlements.idempotency_key`, update `seller_settlements` (`state = 'settled'`, `stripe_transfer_id`, `executed_at = now()`, `pending_reason = NULL`), and post `acct_post_journal()` (`DR 2150 Marketplace Seller Payable`, `CR 1050 Stripe Clearing`). | `sellers.status = 'approved'`, `commerce_outbox_events` emitted, `seller_settlements.state = 'settled'` with `stripe_transfer_id`, `payoutHold` drops to `$0`, balanced GL journal posted. |
| **`Pause listings / Flag SLA warning`** | Sets `sellers.operations_paused = true, operations_paused_at = now()`, suppresses active `offers` (`status = 'paused'`), inserts `seller_performance_alerts` + `seller_remediation_plans`, and notifies seller via `seller_customer_messages` / `email_messages`. | Seller's storefront offers immediately paused; remediation plan row created. |
