-- =====================================================================
-- 05 — CANONICAL SQL WIRING CONTRACTS (REFERENCE DDL FOR WIRING PHASE)
-- Target Catalog: Supabase Production Schema (pcwwvfgxnrglmmpbfqhf)
-- Apply AFTER Unsaid Schema Parts 1-3, Hotfix Part B, and cap_table_409a_schema.sql
-- =====================================================================

BEGIN;

-- 1. CAP TABLE & 409A TENANT BINDING + APPEND-ONLY LEDGER GUARD
ALTER TABLE public.cap_companies
  ADD COLUMN IF NOT EXISTS tenant_id uuid UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.cap_block_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'cap_transactions is append-only (immutable ownership ledger): % is prohibited', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_cap_transactions_immutable ON public.cap_transactions;
CREATE TRIGGER trg_cap_transactions_immutable
  BEFORE UPDATE OR DELETE ON public.cap_transactions
  FOR EACH ROW EXECUTE FUNCTION public.cap_block_ledger_mutation();

ALTER TABLE public.cap_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_qualified_individuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_board_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_security_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_equity_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_vesting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_vesting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cap_table_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_approaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_dlom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.val_material_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cap_companies_tenant_access ON public.cap_companies;
CREATE POLICY cap_companies_tenant_access ON public.cap_companies
  FOR ALL USING (platform_is_tenant_member(tenant_id))
  WITH CHECK (platform_is_tenant_member(tenant_id));

-- 2. FEDERATED ATTENTION QUEUE VIEW (v_dashboard_attention_queue)
CREATE OR REPLACE VIEW public.v_dashboard_attention_queue AS
  -- Leg A: Orders at SLA risk or on hold
  SELECT
    o.tenant_id,
    'erp_orders:' || o.id::text AS id,
    'erp_orders'::text AS source_table,
    o.id::text AS source_id,
    o.order_number AS code,
    CASE
      WHEN o.status = 'on_hold' THEN 'Order on hold — action required before supplier routing'
      ELSE 'Fulfillment SLA due within 6h (' || o.fulfillment_method || ')'
    END AS title,
    'Orders & SLA'::text AS category,
    CASE WHEN o.sla_due_at <= now() THEN 'SLA breach' ELSE 'SLA warning' END AS status,
    COALESCE(o.customer_email, 'Storefront Buyer') AS entity,
    o.created_by AS owner_user_id,
    o.total::numeric AS impact_amount,
    o.sla_due_at,
    NULL::timestamptz AS snoozed_until,
    'orders'::text AS target_domain,
    'fulfillment'::text AS target_screen,
    COALESCE(o.notes, 'Verify carrier / POD supplier routing') AS summary,
    o.created_at
  FROM public.erp_orders o
  WHERE o.status NOT IN ('shipped', 'delivered', 'completed', 'cancelled', 'returned', 'closed')
    AND (o.status = 'on_hold' OR (o.sla_due_at IS NOT NULL AND o.sla_due_at <= now() + interval '6 hours'))

  UNION ALL

  -- Leg B: Konva Studio Preflight Artwork Holds (<300 DPI or needs_review)
  SELECT
    d.tenant_id,
    'designs:' || d.id::text AS id,
    'designs'::text AS source_table,
    d.id::text AS source_id,
    'STU-' || upper( left(d.id::text, 6) ) AS code,
    'Preflight block on "' || d.name || '"' AS title,
    'Catalog & Preflight'::text AS category,
    'Critical'::text AS status,
    COALESCE(d.product_title, d.name) AS entity,
    d.owner_id AS owner_user_id,
    COALESCE(d.retail_price, 0)::numeric AS impact_amount,
    d.updated_at + interval '4 hours' AS sla_due_at,
    NULL::timestamptz AS snoozed_until,
    'catalog'::text AS target_domain,
    'studio'::text AS target_screen,
    'Design status: ' || d.status || ' — inspect print zone & 300 DPI requirement' AS summary,
    d.created_at
  FROM public.designs d
  WHERE d.status IN ('needs_review', 'publish_failed')

  UNION ALL

  -- Leg C: Overdue AR Invoices
  SELECT
    inv.tenant_id,
    'acct_ar_invoices:' || inv.id::text AS id,
    'acct_ar_invoices'::text AS source_table,
    inv.id::text AS source_id,
    inv.invoice_number AS code,
    'Invoice ' || inv.invoice_number || ' past due (' || (current_date - inv.due_date) || 'd)' AS title,
    'Finance & Bills'::text AS category,
    'SLA warning'::text AS status,
    COALESCE(c.company_name, concat_ws(' ', c.first_name, c.last_name), inv.invoice_number) AS entity,
    inv.created_by AS owner_user_id,
    (inv.total - inv.amount_paid - inv.amount_credited)::numeric AS impact_amount,
    inv.due_date::timestamptz AS sla_due_at,
    NULL::timestamptz AS snoozed_until,
    'finance'::text AS target_domain,
    'invoices'::text AS target_screen,
    'Open balance awaiting payment link or collection follow-up' AS summary,
    inv.created_at
  FROM public.acct_ar_invoices inv
  LEFT JOIN public.crm_customers c ON c.id = inv.customer_id
  WHERE inv.status IN ('posted', 'partially_paid', 'overdue')
    AND inv.due_date < current_date
    AND (inv.total - inv.amount_paid - inv.amount_credited) > 0

  UNION ALL

  -- Leg D: Supplier Bills & OCR Extractions Pending Review
  SELECT
    b.tenant_id,
    'acct_ap_bills:' || b.id::text AS id,
    'acct_ap_bills'::text AS source_table,
    b.id::text AS source_id,
    b.bill_number AS code,
    'Supplier bill ' || b.bill_number || ' awaiting approval / payment' AS title,
    'Finance & Bills'::text AS category,
    'For review'::text AS status,
    COALESCE(v.legal_name, b.bill_number) AS entity,
    b.created_by AS owner_user_id,
    (b.total - b.amount_paid - b.amount_credited)::numeric AS impact_amount,
    b.due_date::timestamptz AS sla_due_at,
    NULL::timestamptz AS snoozed_until,
    'finance'::text AS target_domain,
    'bills'::text AS target_screen,
    'Verify COGS account mapping before due date ' || b.due_date::text AS summary,
    b.created_at
  FROM public.acct_ap_bills b
  LEFT JOIN public.acct_vendors v ON v.id = b.vendor_id
  WHERE b.status IN ('draft', 'pending_approval')

  UNION ALL

  -- Leg E: Open Customer Return / RMA Requests
  SELECT
    r.tenant_id,
    'customer_return_requests:' || r.id::text AS id,
    'customer_return_requests'::text AS source_table,
    r.id::text AS source_id,
    'RMA-' || upper(left(r.id::text, 6)) AS code,
    'RMA (' || r.request_type || '): ' || COALESCE(r.item_name, r.order_number) AS title,
    'Support & RMA'::text AS category,
    'Critical'::text AS status,
    r.order_email AS entity,
    NULL::uuid AS owner_user_id,
    0::numeric AS impact_amount,
    r.created_at + interval '12 hours' AS sla_due_at,
    NULL::timestamptz AS snoozed_until,
    'orders'::text AS target_domain,
    'returns'::text AS target_screen,
    COALESCE(r.details, r.reason_code) AS summary,
    r.created_at
  FROM public.customer_return_requests r
  WHERE r.tenant_id IS NOT NULL AND r.status = 'requested'

  UNION ALL

  -- Leg F: Manual & Automated Operational Tasks (crm_tasks)
  SELECT
    t.tenant_id,
    'crm_tasks:' || t.id::text AS id,
    'crm_tasks'::text AS source_table,
    t.id::text AS source_id,
    'TSK-' || upper(left(t.id::text, 5)) AS code,
    t.title,
    CASE
      WHEN t.task_type IN ('Orders & SLA','Finance & Bills','Catalog & Preflight','Support & RMA') THEN t.task_type
      ELSE 'Orders & SLA'
    END AS category,
    CASE
      WHEN t.status = 'completed' THEN 'Resolved'
      WHEN t.snoozed_until IS NOT NULL AND t.snoozed_until > now() THEN 'Snoozed'
      WHEN t.priority IN ('urgent', 'high') THEN 'Critical'
      ELSE 'For review'
    END AS status,
    COALESCE(t.description, 'Operational Task') AS entity,
    t.assigned_to AS owner_user_id,
    0::numeric AS impact_amount,
    t.due_at AS sla_due_at,
    t.snoozed_until,
    'dashboard'::text AS target_domain,
    'attention'::text AS target_screen,
    COALESCE(t.description, t.title) AS summary,
    t.created_at
  FROM public.crm_tasks t
  WHERE t.status <> 'cancelled';

COMMIT;
