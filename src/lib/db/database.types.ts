// ---------------------------------------------------------------------------
// STUB — replaced by `pnpm gen:types` (scripts/gen-types.sh) once the local
// Supabase database is running. It carries the exact RPC signatures from
// plan/db/S600_design_studio_production.sql + S605_browser_runner.sql so
// packages/db compiles and its tests run before the database exists.
// DO NOT hand-edit the generated file after gen:types runs.
// ---------------------------------------------------------------------------
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CraftJobRow = {
  id: string;
  tenant_id: string;
  kind: string;
  app: string;
  status: string;
  runner: string;
  priority: number;
  input: Json;
  output: Json | null;
  subject_type: string | null;
  subject_id: string | null;
  idempotency_key: string;
  attempts: number;
  max_attempts: number;
  run_after: string;
  claimed_by: string | null;
  claimed_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TechPackRow = {
  id: string;
  tenant_id: string;
  design_id: string;
  title: string;
  version_id: string | null;
  size_range_id: string | null;
  base_size: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RfqRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: string;
  bid_deadline: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export type TenantMembershipRow = {
  tenant_id: string;
  user_id: string;
  role: string;
  active: boolean;
};

export interface Database {
  public: {
    Tables: {
      craft_jobs: {
        Row: CraftJobRow;
        Insert: Partial<CraftJobRow>;
        Update: Partial<CraftJobRow>;
        Relationships: [];
      };
      tech_packs: {
        Row: TechPackRow;
        Insert: Partial<TechPackRow>;
        Update: Partial<TechPackRow>;
        Relationships: [];
      };
      rfqs: { Row: RfqRow; Insert: Partial<RfqRow>; Update: Partial<RfqRow>; Relationships: [] };
      tenant_memberships: {
        Row: TenantMembershipRow;
        Insert: Partial<TenantMembershipRow>;
        Update: Partial<TenantMembershipRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ds_create_design_version: {
        Args: {
          p_design: string;
          p_canvas_state?: Json | null;
          p_source_app?: string | null;
          p_document_asset?: string | null;
          p_preview_asset?: string | null;
          p_message?: string | null;
          p_sha256?: string | null;
        };
        Returns: string;
      };
      ds_create_tech_pack: {
        Args: {
          p_design: string;
          p_title?: string | null;
          p_version?: string | null;
          p_size_range?: string | null;
          p_base_size?: string | null;
        };
        Returns: string;
      };
      ds_transition_tech_pack: {
        Args: { p_tp: string; p_to: string; p_note?: string | null };
        Returns: TechPackRow;
      };
      ds_tech_pack_snapshot: { Args: { p_tp: string }; Returns: Json };
      ds_create_rfq: {
        Args: {
          p_tenant: string;
          p_title: string;
          p_bid_deadline?: string | null;
          p_currency?: string | null;
          p_incoterm?: string | null;
          p_sealed?: boolean | null;
        };
        Returns: string;
      };
      ds_invite_vendor_to_rfq: { Args: { p_rfq: string; p_vendor: string }; Returns: string };
      ds_publish_rfq: { Args: { p_rfq: string }; Returns: RfqRow };
      ds_close_rfq: { Args: { p_rfq: string }; Returns: RfqRow };
      ds_close_due_rfqs: { Args: Record<string, never>; Returns: number };
      ds_answer_question: {
        Args: { p_question: string; p_answer: string; p_broadcast?: boolean | null };
        Returns: null;
      };
      ds_award_rfq: { Args: { p_rfq: string; p_awards: Json }; Returns: Json };
      ds_invite_supplier_user: {
        Args: { p_vendor: string; p_email: string; p_role?: string | null; p_name?: string | null };
        Returns: Json;
      };
      ds_revoke_supplier: {
        Args: { p_vendor: string; p_reason?: string | null };
        Returns: null;
      };
      ds_enqueue_job: {
        Args: {
          p_tenant: string;
          p_kind: string;
          p_app: string;
          p_input: Json;
          p_subject_type: string;
          p_subject: string;
          p_key: string;
          p_priority?: number | null;
        };
        Returns: string;
      };
      ds_rfq_unsealed: { Args: { p_rfq: string }; Returns: boolean };
      ds_my_vendor_ids: { Args: Record<string, never>; Returns: string[] };
      supplier_accept_invite: { Args: { p_token: string }; Returns: Json };
      supplier_get_nda: { Args: { p_rfq: string }; Returns: Json };
      supplier_accept_nda: {
        Args: { p_rfq: string; p_body_sha256: string; p_signer_name: string; p_signer_title?: string | null };
        Returns: null;
      };
      supplier_my_rfqs: { Args: Record<string, never>; Returns: Json };
      supplier_get_rfq: { Args: { p_rfq: string }; Returns: Json };
      supplier_authorize_asset_view: { Args: { p_rfq: string; p_asset: string }; Returns: Json };
      supplier_save_bid: { Args: { p_rfq: string; p_payload: Json }; Returns: string };
      supplier_submit_bid: { Args: { p_bid: string }; Returns: null };
      supplier_withdraw_bid: { Args: { p_bid: string }; Returns: null };
      supplier_ask_question: { Args: { p_rfq: string; p_question: string }; Returns: null };
      supplier_decline_rfq: { Args: { p_rfq: string; p_reason?: string | null }; Returns: null };
      supplier_register_upload: {
        Args: { p_rfq: string; p_file_name: string; p_mime: string; p_size: number };
        Returns: Json;
      };
      supplier_authorize_release: { Args: { p_tech_pack: string }; Returns: Json };
      ds_claim_jobs: {
        Args: { p_worker: string; p_kinds?: string[] | null; p_limit?: number | null };
        Returns: CraftJobRow[];
      };
      ds_heartbeat_job: { Args: { p_job: string; p_worker: string }; Returns: null };
      ds_finish_job: {
        Args: {
          p_job: string;
          p_worker: string;
          p_ok: boolean;
          p_output?: Json | null;
          p_error?: string | null;
        };
        Returns: CraftJobRow;
      };
      ds_reap_stale_jobs: { Args: { p_stale?: string | null }; Returns: number };
      ds_claim_browser_jobs: {
        Args: { p_tenant: string; p_session: string; p_kinds?: string[] | null; p_limit?: number | null };
        Returns: CraftJobRow[];
      };
      ds_heartbeat_browser_job: { Args: { p_job: string; p_session: string }; Returns: boolean };
      ds_finish_browser_job: {
        Args: {
          p_job: string;
          p_session: string;
          p_ok: boolean;
          p_output?: Json | null;
          p_error?: string | null;
        };
        Returns: CraftJobRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
