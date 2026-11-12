// Shared supplier-portal types — T18/T19/T20 (Phase 4 Lane 2).
//
// These mirror the S600 RPC return shapes exactly (see
// supabase/migrations/20261111000600_design_studio_production.sql):
// supplier_my_rfqs, supplier_get_rfq, supplier_get_nda,
// supplier_authorize_asset_view, supplier_authorize_release, ds_award_rfq.
// No shape here is invented: fields the RPCs never return (target cost,
// internal notes, other bids, storage paths) are absent on purpose.

export interface SupplierRfqListItem {
  rfq_id: string;
  rfq_number: string;
  title: string;
  status: string;
  bid_deadline: string | null;
  invitation_status: string;
  workspace: string;
  my_bid_status: string | null;
}

export interface SupplierRfqLine {
  rfq_line_id: string;
  line_no: number;
  quantity: number;
  size_breakdown: Record<string, number>;
  notes: string | null;
  colorway: { name: string; pantone_codes: unknown; garment_color_hex: string | null } | null;
  tech_pack: {
    id: string;
    title: string;
    style_number: string | null;
    revision: number;
    preview_asset_id: string | null;
    preview_images: Array<{ asset_id: string; surface: string; width: number | null; height: number | null }>;
  };
}

export interface SupplierRfqQuestion {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  mine: boolean;
  created_at: string;
}

export interface SupplierBidLine {
  rfq_line_id: string;
  unit_price: number;
  moq?: number | null;
  lead_time_days?: number | null;
  sample_cost?: number | null;
  tooling_cost?: number | null;
  size_price_overrides?: Record<string, number>;
  notes?: string | null;
}

export interface SupplierBid {
  id: string;
  revision: number;
  status: string;
  currency: string;
  valid_until: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  incoterm: string | null;
  notes: string | null;
  total_amount: number | null;
  submitted_at: string | null;
  lines: SupplierBidLine[];
}

export interface SupplierRfqView {
  rfq: {
    id: string;
    rfq_number: string;
    title: string;
    status: string;
    currency: string;
    incoterm: string | null;
    ship_to: string | null;
    target_delivery_date: string | null;
    questions_deadline: string | null;
    bid_deadline: string | null;
    allow_bid_revisions: boolean;
    meet_space_uri: string | null;
  };
  vendor_id: string;
  lines: SupplierRfqLine[];
  questions: SupplierRfqQuestion[];
  my_bid: SupplierBid | null;
  production_release: boolean;
}

export interface SupplierNda {
  nda_id: string;
  title: string;
  version: number;
  body_md: string;
  body_sha256: string;
  accepted: boolean;
}

/** What supplier_authorize_asset_view / supplier_authorize_release return. */
export interface AuthorizeResult {
  allowed: boolean;
  reason?: string;
  bucket?: string;
  path?: string;
  mime_type?: string;
  watermark_text?: string;
  ttl_seconds?: number;
  tech_pack_id?: string;
  vendor_id?: string;
  tenant_id?: string;
  revision?: number;
}

/** One row of ds_access_events, as staff reads it for the audit trail. */
export interface AccessEventRow {
  id: number;
  occurred_at: string;
  event: string;
  subject_type: string | null;
  subject_id: string | null;
  rfq_id: string | null;
  asset_id: string | null;
  actor_user_id: string | null;
  actor_vendor_id: string | null;
  metadata: Record<string, unknown>;
}
