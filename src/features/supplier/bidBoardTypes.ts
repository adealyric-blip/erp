// Bid board data shapes — T19. Read shapes only; every row comes from
// the S600 tables (rfqs, rfq_lines, bids, bid_lines, bid_evaluations,
// rfq_invitations, ds_nda_acceptances, rfq_awards, erp_purchase_orders)
// through the staff loader in src/server/actions/supplier-portal.ts.

export interface BoardRfq {
  id: string;
  rfq_number: string;
  title: string;
  status: string;
  sealed: boolean;
  currency: string;
  bid_deadline: string | null;
  target_delivery_date: string | null;
  evaluation_weights: Record<string, unknown> | null;
}

export interface BoardLine {
  rfq_line_id: string;
  line_no: number;
  quantity: number;
  tech_pack_title: string;
  style_number: string | null;
}

export interface BoardBidLine {
  rfq_line_id: string;
  unit_price: number;
  moq: number | null;
  lead_time_days: number | null;
  sample_cost: number | null;
  tooling_cost: number | null;
}

export interface BoardBid {
  bid_id: string;
  vendor_id: string;
  vendor_name: string;
  status: string;
  revision: number;
  currency: string;
  valid_until: string | null;
  lead_time_days: number | null;
  landed_total: number;
  lines: BoardBidLine[];
  quality: number | null;
  compliance: number | null;
}

export interface BoardAward {
  rfq_line_id: string;
  bid_id: string;
  vendor_id: string;
  vendor_name: string;
  quantity: number;
  unit_price: number;
  purchase_order_id: string | null;
  po_number: string | null;
}

export interface PurchaseOrderLink {
  vendor_id: string;
  po_id: string;
  po_number: string;
  status: string;
  total: number | null;
}

export interface BidBoardData {
  rfq: BoardRfq;
  lines: BoardLine[];
  /** Sealed per ds_rfq_unsealed: sealed AND not closed/awarded/cancelled AND deadline not passed. */
  sealed: boolean;
  /** Count of invitations with status bid_submitted/awarded — the ONLY number shown while sealed. */
  receivedCount: number;
  /** Empty while sealed. */
  bids: BoardBid[];
  /** vendor_id -> the vendor's NDA for this RFQ is accepted. Award requires true. */
  ndaAcceptedByVendor: Record<string, boolean>;
  awards: BoardAward[];
  purchaseOrders: PurchaseOrderLink[];
}
