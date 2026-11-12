-- =====================================================================
-- S600_design_studio_production.sql   (canonical step 600, domain 06)
--
-- Design Studio -> Tech Pack -> Private Supplier RFQ -> Award -> PO
--
-- Builds on the existing domain 06 tables (designs, design_assets,
-- design_files, product_canvas_templates, ...) and on:
--   tenants, tenant_memberships, platform_is_tenant_member/admin,
--   acct_vendors (canonical vendor, per platform_canonical_map),
--   erp_purchase_orders/_lines, erp_next_document_number, platform_notify,
--   platform_table_registry + platform__apply_app_security().
--
-- SECURITY MODEL (read this before changing anything)
--   * Internal staff = active tenant_memberships row. RLS comes from the
--     registry (app_* policies), so every new table carries tenant_id.
--   * Suppliers are NEVER tenant members. They have ZERO direct table or
--     storage access. Everything a supplier sees or writes goes through
--     the supplier_* SECURITY DEFINER functions below, which check:
--     active supplier_portal_members row -> live rfq_invitations row ->
--     accepted NDA for that RFQ -> deadline. Every call is logged to
--     ds_access_events (append-only).
--   * Supplier-visible imagery is a watermarked derivative
--     (design_assets.classification = 'supplier_preview') streamed by the
--     Next.js proxy route after supplier_authorize_asset_view() says yes.
--     Source files (classification 'internal') can never be authorized.
--   * Sealed bids: internal staff cannot read bid amounts until the RFQ
--     is closed or the deadline passed (ds_ policies on bids/bid_lines).
--   * Status columns (tech_packs, rfqs, bids) can only change inside the
--     ds_* / supplier_* functions (ds__status_guard + ds.via_rpc flag).
--
-- REGISTRY NOTES
--   * Tables in platform_table_access_overrides are 'explicit'; the
--     registry drops non app_* policies on them and rebuilds app_*.
--   * Tables with our own ds_* policies stay 'inferred' and the registry
--     KEEPS those policies (it only adds app_platform_admin).
--   * Re-running platform__apply_app_security() is safe; tests verify it.
-- Idempotent where practical; one transaction.
-- =====================================================================
\set ON_ERROR_STOP on
DO $guard$ BEGIN
  IF to_regclass('public.platform_table_registry') IS NULL
     OR to_regprocedure('public.platform__apply_app_security()') IS NULL
     OR to_regclass('public.acct_vendors') IS NULL
     OR to_regclass('public.erp_purchase_orders') IS NULL THEN
    RAISE EXCEPTION 'S600: baseline missing (registry, acct_vendors or erp_purchase_orders). Run the baseline + S100..S500 first.';
  END IF;
  IF to_regprocedure('unify.require(text)') IS NOT NULL THEN PERFORM unify.require('600'); END IF;
END $guard$;

BEGIN;
CREATE EXTENSION IF NOT EXISTS citext;

-- =====================================================================
-- A. Generic helpers
-- =====================================================================

-- A child row's tenant_id must equal its parent's. TG_ARGV[0]=parent table, TG_ARGV[1]=fk column.
CREATE OR REPLACE FUNCTION public.ds__match_parent_tenant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_parent_tenant uuid; v_fk uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', TG_ARGV[1]) INTO v_fk USING NEW;
  IF v_fk IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', TG_ARGV[0]) INTO v_parent_tenant USING v_fk;
  IF v_parent_tenant IS NULL THEN
    RAISE EXCEPTION '%: parent %.% not found', TG_TABLE_NAME, TG_ARGV[0], v_fk USING ERRCODE = '23503';
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := v_parent_tenant;
  ELSIF NEW.tenant_id <> v_parent_tenant THEN
    RAISE EXCEPTION '%: tenant mismatch with % (cross-tenant reference refused)', TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Status changes only inside our RPCs.
CREATE OR REPLACE FUNCTION public.ds__status_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM TG_ARGV[0] AND coalesce(current_setting('ds.via_rpc', true), '') <> 'on' THEN
      RAISE EXCEPTION '%: new rows must start as %', TG_TABLE_NAME, TG_ARGV[0] USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND coalesce(current_setting('ds.via_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION '%: status changes must go through the ds_*/supplier_* functions', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Append-only tables.
CREATE OR REPLACE FUNCTION public.ds__append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;

CREATE OR REPLACE FUNCTION public.ds__rpc_on() RETURNS void
LANGUAGE sql SET search_path = public, pg_catalog AS $$ SELECT set_config('ds.via_rpc', 'on', true) $$;

CREATE OR REPLACE FUNCTION public.ds__assert_member(p_tenant uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.platform_is_tenant_member(p_tenant) THEN
    RAISE EXCEPTION 'not a member of this workspace' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ds__assert_admin(p_tenant uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.platform_is_tenant_admin(p_tenant) THEN
    RAISE EXCEPTION 'owner or admin role required' USING ERRCODE = '42501';
  END IF;
END $$;

-- First path segment of a storage object name as uuid (NULL if not a uuid).
CREATE OR REPLACE FUNCTION public.ds__path_tenant(p_name text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_catalog AS $$
DECLARE s text := split_part(p_name, '/', 1);
BEGIN
  IF s ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN s::uuid; END IF;
  RETURN NULL;
END $$;

-- =====================================================================
-- B. Reference data: seasons, sizes, points of measure, materials, templates
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ds_seasons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code        text NOT NULL,                       -- SS27, FW27, RESORT28
  name        text NOT NULL,
  starts_on   date,
  ends_on     date,
  status      text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','closed','archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.ds_size_ranges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,                       -- "Women Alpha XS-XL"
  sizes       text[] NOT NULL CHECK (cardinality(sizes) > 0),
  base_size   text NOT NULL,
  unit        text NOT NULL DEFAULT 'cm' CHECK (unit IN ('cm','in')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  CHECK (base_size = ANY (sizes))
);

CREATE TABLE IF NOT EXISTS public.ds_pom_library (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code               text NOT NULL,                -- "A", "B1", "HPS-LEN"
  name               text NOT NULL,                -- "Body length from HPS"
  how_to_measure     text,
  category           text,                         -- tops, bottoms, headwear
  default_tol_plus   numeric(8,2) NOT NULL DEFAULT 1 CHECK (default_tol_plus >= 0),
  default_tol_minus  numeric(8,2) NOT NULL DEFAULT 1 CHECK (default_tol_minus >= 0),
  diagram_asset_id   uuid,
  sort               int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.ds_materials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('fabric','trim','label','packaging','thread','hardware','interlining','other')),
  code             text NOT NULL,
  name             text NOT NULL,
  composition      text,                           -- "100% organic cotton"
  weight_gsm       numeric(8,2) CHECK (weight_gsm IS NULL OR weight_gsm > 0),
  width_cm         numeric(8,2) CHECK (width_cm IS NULL OR width_cm > 0),
  color_ref        text,                           -- Pantone / lab dip ref
  vendor_id        uuid REFERENCES public.acct_vendors(id) ON DELETE SET NULL,
  unit_cost        numeric(18,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  currency         char(3) NOT NULL DEFAULT 'USD',
  uom              text NOT NULL DEFAULT 'm',
  swatch_asset_id  uuid,
  certifications   text[] NOT NULL DEFAULT '{}',   -- GOTS, OEKO-TEX, GRS
  notes            text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.ds_garment_templates (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                   text NOT NULL,            -- "Boxy tee", "6-panel cap"
  category               text NOT NULL,
  archetype              text NOT NULL DEFAULT 'APPAREL',
  views                  text[] NOT NULL DEFAULT ARRAY['front','back'],
  print_areas            jsonb NOT NULL DEFAULT '{}'::jsonb, -- {"front":{"x":.15,"y":.15,"w":.7,"h":.7,"width_mm":300,"height_mm":400}}
  size_range_id          uuid REFERENCES public.ds_size_ranges(id) ON DELETE SET NULL,
  flat_sketch_asset_id   uuid,                     -- VectorCraft flat (svg/pdf)
  pattern_asset_id       uuid,                     -- DXF/AAMA pattern
  model_asset_id         uuid,                     -- GLB for 3D / 360
  turntable_frames       int CHECK (turntable_frames IS NULL OR turntable_frames BETWEEN 8 AND 72),
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

-- =====================================================================
-- C. Designs, versions, assets, colorways, annotations
-- =====================================================================
ALTER TABLE public.designs
  ADD COLUMN IF NOT EXISTS season_id           uuid REFERENCES public.ds_seasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS garment_template_id uuid REFERENCES public.ds_garment_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS style_number        text,
  ADD COLUMN IF NOT EXISTS current_version_id  uuid,
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz;
ALTER TABLE public.designs DROP CONSTRAINT IF EXISTS designs_source_check;
ALTER TABLE public.designs ADD CONSTRAINT designs_source_check CHECK (source IN
  ('konva','upload','ai_draft','vectorcraft','photocraft','designcraft','texturecraft','materialcraft','lightcraft','effectcraft','filmcraft','import'));
CREATE UNIQUE INDEX IF NOT EXISTS designs_tenant_style_number_uq ON public.designs (tenant_id, style_number) WHERE style_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS designs_tenant_season_idx ON public.designs (tenant_id, season_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.design_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  design_id          uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  version_no         int NOT NULL,
  label              text,
  canvas_state       jsonb,                        -- Konva scene graph (studio canvas)
  source_app         text NOT NULL DEFAULT 'konva',
  document_asset_id  uuid,                         -- .vectorcraft / .pcraft / .tcraft source document
  preview_asset_id   uuid,                         -- internal PNG preview
  sha256             text,
  message            text,
  is_locked          boolean NOT NULL DEFAULT false,
  created_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, version_no),
  UNIQUE (id, tenant_id)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'designs_current_version_fk') THEN
    ALTER TABLE public.designs ADD CONSTRAINT designs_current_version_fk
      FOREIGN KEY (current_version_id) REFERENCES public.design_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS version_id            uuid REFERENCES public.design_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classification        text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS derived_from_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sha256                text,
  ADD COLUMN IF NOT EXISTS size_bytes            bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ADD COLUMN IF NOT EXISTS watermark             jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz;
ALTER TABLE public.design_assets DROP CONSTRAINT IF EXISTS design_assets_classification_check;
ALTER TABLE public.design_assets ADD CONSTRAINT design_assets_classification_check
  CHECK (classification IN ('internal','supplier_preview','production_release','supplier_upload'));
ALTER TABLE public.design_assets DROP CONSTRAINT IF EXISTS design_assets_bucket_check;
ALTER TABLE public.design_assets ADD CONSTRAINT design_assets_bucket_check
  CHECK (bucket IN ('design-assets','design-private','supplier-previews','production-releases','supplier-uploads'));
-- a supplier-facing derivative must point at what it was derived from
ALTER TABLE public.design_assets DROP CONSTRAINT IF EXISTS design_assets_derivative_check;
ALTER TABLE public.design_assets ADD CONSTRAINT design_assets_derivative_check
  CHECK (classification NOT IN ('supplier_preview','production_release') OR derived_from_asset_id IS NOT NULL);
-- supplier-facing classes live only in their dedicated private buckets (worker writes them watermarked)
ALTER TABLE public.design_assets DROP CONSTRAINT IF EXISTS design_assets_class_bucket_check;
ALTER TABLE public.design_assets ADD CONSTRAINT design_assets_class_bucket_check CHECK (
  (classification = 'supplier_preview'   AND bucket = 'supplier-previews') OR
  (classification = 'production_release' AND bucket = 'production-releases') OR
  (classification = 'supplier_upload'    AND bucket = 'supplier-uploads') OR
  (classification = 'internal'           AND bucket IN ('design-assets','design-private')));
CREATE INDEX IF NOT EXISTS design_assets_tenant_class_idx ON public.design_assets (tenant_id, classification) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS design_assets_version_idx ON public.design_assets (version_id);
CREATE INDEX IF NOT EXISTS design_assets_derived_idx ON public.design_assets (derived_from_asset_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'design_versions_document_asset_fk') THEN
    ALTER TABLE public.design_versions
      ADD CONSTRAINT design_versions_document_asset_fk FOREIGN KEY (document_asset_id) REFERENCES public.design_assets(id) ON DELETE SET NULL,
      ADD CONSTRAINT design_versions_preview_asset_fk  FOREIGN KEY (preview_asset_id)  REFERENCES public.design_assets(id) ON DELETE SET NULL;
    ALTER TABLE public.ds_pom_library
      ADD CONSTRAINT ds_pom_library_diagram_fk FOREIGN KEY (diagram_asset_id) REFERENCES public.design_assets(id) ON DELETE SET NULL;
    ALTER TABLE public.ds_materials
      ADD CONSTRAINT ds_materials_swatch_fk FOREIGN KEY (swatch_asset_id) REFERENCES public.design_assets(id) ON DELETE SET NULL;
    ALTER TABLE public.ds_garment_templates
      ADD CONSTRAINT ds_garment_templates_flat_fk    FOREIGN KEY (flat_sketch_asset_id) REFERENCES public.design_assets(id) ON DELETE SET NULL,
      ADD CONSTRAINT ds_garment_templates_pattern_fk FOREIGN KEY (pattern_asset_id)     REFERENCES public.design_assets(id) ON DELETE SET NULL,
      ADD CONSTRAINT ds_garment_templates_model_fk   FOREIGN KEY (model_asset_id)       REFERENCES public.design_assets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- version numbering + lock + current pointer
CREATE OR REPLACE FUNCTION public.ds__version_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.design_id::text, 0));
  SELECT coalesce(max(version_no), 0) + 1 INTO NEW.version_no FROM public.design_versions WHERE design_id = NEW.design_id;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ds__version_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  UPDATE public.designs SET current_version_id = NEW.id WHERE id = NEW.design_id;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.ds__version_lock_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_locked THEN RAISE EXCEPTION 'design version % is locked (used by an approved tech pack)', OLD.version_no USING ERRCODE = '42501'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_locked THEN RAISE EXCEPTION 'design version % is locked', OLD.version_no USING ERRCODE = '42501'; END IF;
  IF NEW.design_id <> OLD.design_id OR NEW.version_no <> OLD.version_no OR NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'design_id, version_no and tenant_id are immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dv_tenant ON public.design_versions;
CREATE TRIGGER trg_dv_tenant BEFORE INSERT OR UPDATE ON public.design_versions FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('designs','design_id');
DROP TRIGGER IF EXISTS trg_dv_number ON public.design_versions;
CREATE TRIGGER trg_dv_number BEFORE INSERT ON public.design_versions FOR EACH ROW EXECUTE FUNCTION public.ds__version_before_insert();
DROP TRIGGER IF EXISTS trg_dv_current ON public.design_versions;
CREATE TRIGGER trg_dv_current AFTER INSERT ON public.design_versions FOR EACH ROW EXECUTE FUNCTION public.ds__version_after_insert();
DROP TRIGGER IF EXISTS trg_dv_lock ON public.design_versions;
CREATE TRIGGER trg_dv_lock BEFORE UPDATE OR DELETE ON public.design_versions FOR EACH ROW EXECUTE FUNCTION public.ds__version_lock_guard();

DROP TRIGGER IF EXISTS trg_design_assets_tenant ON public.design_assets;
CREATE TRIGGER trg_design_assets_tenant BEFORE INSERT OR UPDATE OF design_id, tenant_id ON public.design_assets
  FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('designs','design_id');

CREATE TABLE IF NOT EXISTS public.design_colorways (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  design_id         uuid NOT NULL REFERENCES public.designs(id) ON DELETE CASCADE,
  name              text NOT NULL,                 -- "Bone / Navy"
  garment_color_hex text CHECK (garment_color_hex IS NULL OR garment_color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  pantone_codes     text[] NOT NULL DEFAULT '{}',
  is_default        boolean NOT NULL DEFAULT false,
  sort              int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS design_colorways_one_default ON public.design_colorways (design_id) WHERE is_default;
DROP TRIGGER IF EXISTS trg_colorways_tenant ON public.design_colorways;
CREATE TRIGGER trg_colorways_tenant BEFORE INSERT OR UPDATE ON public.design_colorways FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('designs','design_id');

-- =====================================================================
-- D. Suppliers: portal members, capabilities, NDAs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.supplier_portal_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id          uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- NULL until the invite is accepted
  email              citext NOT NULL,
  display_name       text,
  role               text NOT NULL DEFAULT 'estimator' CHECK (role IN ('owner','estimator','viewer')),
  status             text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','revoked')),
  invite_token_hash  text UNIQUE,
  invite_expires_at  timestamptz,
  invited_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at        timestamptz,
  last_seen_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, email),
  CHECK (status <> 'active' OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS spm_user_idx ON public.supplier_portal_members (user_id) WHERE status = 'active';
DROP TRIGGER IF EXISTS trg_spm_tenant ON public.supplier_portal_members;
CREATE TRIGGER trg_spm_tenant BEFORE INSERT OR UPDATE ON public.supplier_portal_members FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('acct_vendors','vendor_id');

CREATE TABLE IF NOT EXISTS public.supplier_capabilities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id        uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  category         text NOT NULL,                  -- knitwear, denim, headwear, cut&sew
  techniques       text[] NOT NULL DEFAULT '{}',
  moq              int CHECK (moq IS NULL OR moq > 0),
  lead_time_days   int CHECK (lead_time_days IS NULL OR lead_time_days > 0),
  monthly_capacity int CHECK (monthly_capacity IS NULL OR monthly_capacity > 0),
  certifications   text[] NOT NULL DEFAULT '{}',
  country_code     char(2),
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, category)
);
DROP TRIGGER IF EXISTS trg_supcap_tenant ON public.supplier_capabilities;
CREATE TRIGGER trg_supcap_tenant BEFORE INSERT OR UPDATE ON public.supplier_capabilities FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('acct_vendors','vendor_id');

CREATE TABLE IF NOT EXISTS public.ds_ndas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version     int NOT NULL,
  title       text NOT NULL,
  body_md     text NOT NULL,
  body_sha256 text NOT NULL DEFAULT '',             -- set by trigger from body_md
  is_active   boolean NOT NULL DEFAULT false,
  created_by  uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS ds_ndas_one_active ON public.ds_ndas (tenant_id) WHERE is_active;
-- an NDA text never changes once created (new version instead)
CREATE OR REPLACE FUNCTION public.ds__nda_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.body_sha256 := encode(sha256(convert_to(NEW.body_md, 'UTF8')), 'hex'); RETURN NEW; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'NDAs cannot be deleted; deactivate instead' USING ERRCODE = '42501'; END IF;
  NEW.body_sha256 := OLD.body_sha256;
  IF NEW.body_md <> OLD.body_md OR NEW.title <> OLD.title OR NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'NDA text is immutable; create a new version' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_nda_immutable ON public.ds_ndas;
CREATE TRIGGER trg_nda_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.ds_ndas FOR EACH ROW EXECUTE FUNCTION public.ds__nda_immutable();

CREATE TABLE IF NOT EXISTS public.ds_nda_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nda_id        uuid NOT NULL REFERENCES public.ds_ndas(id) ON DELETE RESTRICT,
  vendor_id     uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name   text NOT NULL,
  signer_title  text,
  body_sha256   text NOT NULL,                     -- what they actually agreed to
  ip            inet,
  user_agent    text,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nda_id, user_id)
);
DROP TRIGGER IF EXISTS trg_nda_acc_append ON public.ds_nda_acceptances;
CREATE TRIGGER trg_nda_acc_append BEFORE UPDATE OR DELETE ON public.ds_nda_acceptances FOR EACH ROW EXECUTE FUNCTION public.ds__append_only();

-- =====================================================================
-- E. Tech packs
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tech_packs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  design_id      uuid NOT NULL REFERENCES public.designs(id) ON DELETE RESTRICT,
  version_id     uuid NOT NULL REFERENCES public.design_versions(id) ON DELETE RESTRICT,
  revision       int NOT NULL DEFAULT 1 CHECK (revision > 0),
  style_number   text,
  title          text NOT NULL,
  season_id      uuid REFERENCES public.ds_seasons(id) ON DELETE SET NULL,
  size_range_id  uuid REFERENCES public.ds_size_ranges(id) ON DELETE RESTRICT,
  base_size      text,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','released','superseded','archived')),
  supersedes_id  uuid REFERENCES public.tech_packs(id) ON DELETE SET NULL,
  pdf_asset_id   uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,          -- internal master PDF
  preview_pdf_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,    -- watermarked, supplier_preview
  notes          text,
  approved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  released_at    timestamptz,
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (design_id, revision),
  CHECK (status NOT IN ('approved','released') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS tech_packs_tenant_status_idx ON public.tech_packs (tenant_id, status);
DROP TRIGGER IF EXISTS trg_tp_tenant ON public.tech_packs;
CREATE TRIGGER trg_tp_tenant BEFORE INSERT OR UPDATE ON public.tech_packs FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('designs','design_id');
DROP TRIGGER IF EXISTS trg_tp_status ON public.tech_packs;
CREATE TRIGGER trg_tp_status BEFORE INSERT OR UPDATE ON public.tech_packs FOR EACH ROW EXECUTE FUNCTION public.ds__status_guard('draft');
-- only never-reviewed drafts can be deleted; everything else is archived (keeps the audit chain intact)
CREATE OR REPLACE FUNCTION public.ds__tp_delete_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF OLD.status <> 'draft' OR EXISTS (SELECT 1 FROM public.tech_pack_revisions r WHERE r.tech_pack_id = OLD.id) THEN
    RAISE EXCEPTION 'tech pack rev % is % or has review history; archive it instead of deleting', OLD.revision, OLD.status USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_tp_delete ON public.tech_packs;
CREATE TRIGGER trg_tp_delete BEFORE DELETE ON public.tech_packs FOR EACH ROW EXECUTE FUNCTION public.ds__tp_delete_guard();

-- children of a tech pack are editable only while it is draft / in_review
CREATE OR REPLACE FUNCTION public.ds__tp_child_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_status text; v_tp uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tech_pack_id ELSE NEW.tech_pack_id END;
BEGIN
  SELECT status INTO v_status FROM public.tech_packs WHERE id = v_tp;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft','in_review') THEN
    RAISE EXCEPTION 'tech pack is % and cannot be edited; create a new revision', v_status USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE TABLE IF NOT EXISTS public.tech_pack_bom_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id  uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  material_id   uuid REFERENCES public.ds_materials(id) ON DELETE RESTRICT,
  kind          text NOT NULL CHECK (kind IN ('fabric','trim','label','packaging','thread','hardware','interlining','other')),
  placement     text,                              -- body, rib, neck tape, main label
  description   text NOT NULL,
  quantity      numeric(18,4) NOT NULL CHECK (quantity > 0),
  uom           text NOT NULL DEFAULT 'pc',
  colorway_id   uuid REFERENCES public.design_colorways(id) ON DELETE SET NULL,
  vendor_id     uuid REFERENCES public.acct_vendors(id) ON DELETE SET NULL,  -- nominated material supplier
  unit_cost     numeric(18,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  supplier_note text,
  sort          int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tp_bom_tp_idx ON public.tech_pack_bom_lines (tech_pack_id, sort);

CREATE TABLE IF NOT EXISTS public.tech_pack_measurements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id  uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  pom_id        uuid NOT NULL REFERENCES public.ds_pom_library(id) ON DELETE RESTRICT,
  size_label    text NOT NULL,
  value         numeric(10,2) NOT NULL CHECK (value >= 0),
  tol_plus      numeric(8,2) NOT NULL CHECK (tol_plus >= 0),
  tol_minus     numeric(8,2) NOT NULL CHECK (tol_minus >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tech_pack_id, pom_id, size_label)
);
CREATE OR REPLACE FUNCTION public.ds__measurement_size_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_sizes text[];
BEGIN
  SELECT sr.sizes INTO v_sizes FROM public.tech_packs tp JOIN public.ds_size_ranges sr ON sr.id = tp.size_range_id WHERE tp.id = NEW.tech_pack_id;
  IF v_sizes IS NOT NULL AND NOT (NEW.size_label = ANY (v_sizes)) THEN
    RAISE EXCEPTION 'size % is not in the tech pack size range %', NEW.size_label, v_sizes USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS public.tech_pack_construction (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id      uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  area              text NOT NULL,                 -- neckline, side seam, hem
  operation         text NOT NULL,                 -- "coverstitch hem"
  stitch_type       text,                          -- ISO 4915 code e.g. 406
  spi               int CHECK (spi IS NULL OR spi BETWEEN 4 AND 30),
  seam_allowance_mm numeric(6,2),
  notes             text,
  image_asset_id    uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  sort              int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tech_pack_artwork (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id  uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  asset_id      uuid NOT NULL REFERENCES public.design_assets(id) ON DELETE RESTRICT,
  view          text NOT NULL DEFAULT 'front',
  placement     text NOT NULL,                     -- "center chest", "left sleeve"
  technique     text NOT NULL CHECK (technique IN ('screen_print','dtg','dtf','embroidery','puff_embroidery','heat_transfer','sublimation','jacquard','patch','laser','other')),
  width_mm      numeric(8,2) NOT NULL CHECK (width_mm > 0),
  height_mm     numeric(8,2) NOT NULL CHECK (height_mm > 0),
  offset_ref    text,                              -- "HPS", "CF", "hem"
  offset_x_mm   numeric(8,2),
  offset_y_mm   numeric(8,2),
  colorway_id   uuid REFERENCES public.design_colorways(id) ON DELETE SET NULL,
  pantone_codes text[] NOT NULL DEFAULT '{}',
  stitch_count  int CHECK (stitch_count IS NULL OR stitch_count > 0),
  notes         text,
  sort          int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tech_pack_revisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id   uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  revision       int NOT NULL,
  from_status    text,
  to_status      text NOT NULL,
  snapshot       jsonb NOT NULL,                   -- full pack incl. children at transition time
  change_summary text,
  created_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tp_rev_tp_idx ON public.tech_pack_revisions (tech_pack_id, created_at);
DROP TRIGGER IF EXISTS trg_tp_rev_append ON public.tech_pack_revisions;
CREATE TRIGGER trg_tp_rev_append BEFORE UPDATE OR DELETE ON public.tech_pack_revisions FOR EACH ROW EXECUTE FUNCTION public.ds__append_only();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tech_pack_bom_lines','tech_pack_measurements','tech_pack_construction','tech_pack_artwork'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_tenant ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_tenant BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant(''tech_packs'',''tech_pack_id'')', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_lock ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ds__tp_child_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_tpm_size ON public.tech_pack_measurements;
CREATE TRIGGER trg_tpm_size BEFORE INSERT OR UPDATE ON public.tech_pack_measurements FOR EACH ROW EXECUTE FUNCTION public.ds__measurement_size_guard();

-- =====================================================================
-- F. RFQs, invitations, Q&A, bids, evaluations, awards, files
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.rfqs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_number          text NOT NULL,
  title               text NOT NULL,
  season_id           uuid REFERENCES public.ds_seasons(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','awarded','cancelled')),
  sealed              boolean NOT NULL DEFAULT true,
  allow_bid_revisions boolean NOT NULL DEFAULT true,
  currency            char(3) NOT NULL DEFAULT 'USD',
  incoterm            text CHECK (incoterm IS NULL OR incoterm IN ('EXW','FCA','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP')),
  ship_to             text,
  target_delivery_date date,
  questions_deadline  timestamptz,
  bid_deadline        timestamptz,
  nda_id              uuid REFERENCES public.ds_ndas(id) ON DELETE RESTRICT,
  evaluation_weights  jsonb NOT NULL DEFAULT '{"price":0.5,"lead_time":0.2,"quality":0.2,"compliance":0.1}'::jsonb,
  meet_space_uri      text,                        -- Google Meet space for supplier briefing
  published_at        timestamptz,
  closed_at           timestamptz,
  awarded_at          timestamptz,
  cancelled_reason    text,
  created_by          uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, rfq_number),
  CHECK (questions_deadline IS NULL OR bid_deadline IS NULL OR questions_deadline <= bid_deadline)
);
CREATE INDEX IF NOT EXISTS rfqs_tenant_status_idx ON public.rfqs (tenant_id, status);
CREATE INDEX IF NOT EXISTS rfqs_deadline_idx ON public.rfqs (bid_deadline) WHERE status = 'published';
DROP TRIGGER IF EXISTS trg_rfqs_status ON public.rfqs;
CREATE TRIGGER trg_rfqs_status BEFORE INSERT OR UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.ds__status_guard('draft');
-- only draft RFQs are editable directly; after publish use the RPCs
CREATE OR REPLACE FUNCTION public.ds__rfq_edit_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF OLD.status <> 'draft' AND coalesce(current_setting('ds.via_rpc', true), '') <> 'on' THEN
    RAISE EXCEPTION 'RFQ % is % and cannot be edited directly', OLD.rfq_number, OLD.status USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_rfqs_edit ON public.rfqs;
CREATE TRIGGER trg_rfqs_edit BEFORE UPDATE ON public.rfqs FOR EACH ROW EXECUTE FUNCTION public.ds__rfq_edit_guard();

CREATE TABLE IF NOT EXISTS public.rfq_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id           uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  line_no          int NOT NULL CHECK (line_no > 0),
  tech_pack_id     uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE RESTRICT,
  colorway_id      uuid REFERENCES public.design_colorways(id) ON DELETE SET NULL,
  quantity         int NOT NULL CHECK (quantity > 0),
  size_breakdown   jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"S":120,"M":240,...}
  target_unit_cost numeric(18,4) CHECK (target_unit_cost IS NULL OR target_unit_cost >= 0),  -- internal only, never sent to suppliers
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, line_no)
);
CREATE OR REPLACE FUNCTION public.ds__rfq_child_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_status text; v_rfq uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.rfq_id ELSE NEW.rfq_id END;
BEGIN
  IF coalesce(current_setting('ds.via_rpc', true), '') = 'on' THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  SELECT status INTO v_status FROM public.rfqs WHERE id = v_rfq;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'RFQ is % ; lines can only change while draft', v_status USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS trg_rfq_lines_tenant ON public.rfq_lines;
CREATE TRIGGER trg_rfq_lines_tenant BEFORE INSERT OR UPDATE ON public.rfq_lines FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');
DROP TRIGGER IF EXISTS trg_rfq_lines_tp_tenant ON public.rfq_lines;
CREATE TRIGGER trg_rfq_lines_tp_tenant BEFORE INSERT OR UPDATE ON public.rfq_lines FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('tech_packs','tech_pack_id');
DROP TRIGGER IF EXISTS trg_rfq_lines_lock ON public.rfq_lines;
CREATE TRIGGER trg_rfq_lines_lock BEFORE INSERT OR UPDATE OR DELETE ON public.rfq_lines FOR EACH ROW EXECUTE FUNCTION public.ds__rfq_child_guard();

CREATE TABLE IF NOT EXISTS public.rfq_invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id            uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id         uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','viewed','declined','bid_submitted','awarded','not_awarded','revoked')),
  invited_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at        timestamptz NOT NULL DEFAULT now(),
  first_viewed_at   timestamptz,
  last_viewed_at    timestamptz,
  declined_reason   text,
  revoked_at        timestamptz,
  access_expires_at timestamptz,
  UNIQUE (rfq_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS rfq_inv_vendor_idx ON public.rfq_invitations (vendor_id, status);
DROP TRIGGER IF EXISTS trg_rfq_inv_tenant ON public.rfq_invitations;
CREATE TRIGGER trg_rfq_inv_tenant BEFORE INSERT OR UPDATE ON public.rfq_invitations FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');
DROP TRIGGER IF EXISTS trg_rfq_inv_vendor_tenant ON public.rfq_invitations;
CREATE TRIGGER trg_rfq_inv_vendor_tenant BEFORE INSERT OR UPDATE ON public.rfq_invitations FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('acct_vendors','vendor_id');
DROP TRIGGER IF EXISTS trg_rfq_inv_status ON public.rfq_invitations;
CREATE TRIGGER trg_rfq_inv_status BEFORE INSERT OR UPDATE ON public.rfq_invitations FOR EACH ROW EXECUTE FUNCTION public.ds__status_guard('invited');

CREATE TABLE IF NOT EXISTS public.rfq_questions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id       uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id    uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  asked_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question     text NOT NULL CHECK (length(question) BETWEEN 3 AND 4000),
  answer       text,
  answered_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at  timestamptz,
  broadcast    boolean NOT NULL DEFAULT false,     -- true: answer shown (anonymised) to every invitee
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rfq_q_rfq_idx ON public.rfq_questions (rfq_id, created_at);
DROP TRIGGER IF EXISTS trg_rfq_q_tenant ON public.rfq_questions;
CREATE TRIGGER trg_rfq_q_tenant BEFORE INSERT OR UPDATE ON public.rfq_questions FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');

CREATE TABLE IF NOT EXISTS public.bids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id          uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  invitation_id   uuid NOT NULL REFERENCES public.rfq_invitations(id) ON DELETE CASCADE,
  vendor_id       uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  revision        int NOT NULL DEFAULT 1 CHECK (revision > 0),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','withdrawn','superseded','shortlisted','awarded','rejected')),
  currency        char(3) NOT NULL,
  valid_until     date,
  lead_time_days  int CHECK (lead_time_days IS NULL OR lead_time_days > 0),
  payment_terms   text,
  incoterm        text,
  notes           text,
  total_amount    numeric(18,4) NOT NULL DEFAULT 0,
  submitted_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id, revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS bids_one_live_per_vendor ON public.bids (rfq_id, vendor_id) WHERE status IN ('draft','submitted','shortlisted','awarded');
DROP TRIGGER IF EXISTS trg_bids_tenant ON public.bids;
CREATE TRIGGER trg_bids_tenant BEFORE INSERT OR UPDATE ON public.bids FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');
DROP TRIGGER IF EXISTS trg_bids_status ON public.bids;
CREATE TRIGGER trg_bids_status BEFORE INSERT OR UPDATE ON public.bids FOR EACH ROW EXECUTE FUNCTION public.ds__status_guard('draft');

CREATE TABLE IF NOT EXISTS public.bid_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bid_id               uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  rfq_line_id          uuid NOT NULL REFERENCES public.rfq_lines(id) ON DELETE CASCADE,
  unit_price           numeric(18,4) NOT NULL CHECK (unit_price >= 0),
  moq                  int CHECK (moq IS NULL OR moq > 0),
  lead_time_days       int CHECK (lead_time_days IS NULL OR lead_time_days > 0),
  sample_cost          numeric(18,4) CHECK (sample_cost IS NULL OR sample_cost >= 0),
  tooling_cost         numeric(18,4) CHECK (tooling_cost IS NULL OR tooling_cost >= 0),
  size_price_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, rfq_line_id)
);
DROP TRIGGER IF EXISTS trg_bid_lines_tenant ON public.bid_lines;
CREATE TRIGGER trg_bid_lines_tenant BEFORE INSERT OR UPDATE ON public.bid_lines FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('bids','bid_id');
-- total maintained from lines
CREATE OR REPLACE FUNCTION public.ds__bid_total() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_bid uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.bid_id ELSE NEW.bid_id END;
BEGIN
  UPDATE public.bids b SET total_amount = coalesce((
    SELECT sum(bl.unit_price * rl.quantity + coalesce(bl.tooling_cost,0) + coalesce(bl.sample_cost,0))
      FROM public.bid_lines bl JOIN public.rfq_lines rl ON rl.id = bl.rfq_line_id
     WHERE bl.bid_id = v_bid), 0)
   WHERE b.id = v_bid;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_bid_lines_total ON public.bid_lines;
CREATE TRIGGER trg_bid_lines_total AFTER INSERT OR UPDATE OR DELETE ON public.bid_lines FOR EACH ROW EXECUTE FUNCTION public.ds__bid_total();

CREATE TABLE IF NOT EXISTS public.bid_evaluations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bid_id          uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  evaluator_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scores          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"quality":4,"compliance":5} on a 0..5 scale
  weighted_score  numeric(6,3),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, evaluator_id)
);
DROP TRIGGER IF EXISTS trg_bid_eval_tenant ON public.bid_evaluations;
CREATE TRIGGER trg_bid_eval_tenant BEFORE INSERT OR UPDATE ON public.bid_evaluations FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('bids','bid_id');

CREATE TABLE IF NOT EXISTS public.rfq_awards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id            uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  rfq_line_id       uuid NOT NULL REFERENCES public.rfq_lines(id) ON DELETE CASCADE,
  bid_id            uuid NOT NULL REFERENCES public.bids(id) ON DELETE RESTRICT,
  bid_line_id       uuid NOT NULL REFERENCES public.bid_lines(id) ON DELETE RESTRICT,
  vendor_id         uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE RESTRICT,
  quantity          int NOT NULL CHECK (quantity > 0),
  unit_price        numeric(18,4) NOT NULL,
  purchase_order_id uuid REFERENCES public.erp_purchase_orders(id) ON DELETE SET NULL,
  awarded_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  awarded_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_line_id)
);
DROP TRIGGER IF EXISTS trg_rfq_awards_tenant ON public.rfq_awards;
CREATE TRIGGER trg_rfq_awards_tenant BEFORE INSERT OR UPDATE ON public.rfq_awards FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');

CREATE TABLE IF NOT EXISTS public.rfq_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rfq_id        uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  bid_id        uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  vendor_id     uuid REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  direction     text NOT NULL CHECK (direction IN ('to_supplier','from_supplier')),
  bucket        text NOT NULL DEFAULT 'supplier-uploads' CHECK (bucket IN ('supplier-uploads','supplier-previews')),
  storage_path  text NOT NULL UNIQUE,
  file_name     text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 104857600),
  sha256        text,
  scan_status   text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','error')),
  uploaded_by   uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (direction <> 'from_supplier' OR vendor_id IS NOT NULL)
);
DROP TRIGGER IF EXISTS trg_rfq_files_tenant ON public.rfq_files;
CREATE TRIGGER trg_rfq_files_tenant BEFORE INSERT OR UPDATE ON public.rfq_files FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('rfqs','rfq_id');

-- =====================================================================
-- G. Secure access: release grants + append-only access log
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.asset_release_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vendor_id     uuid NOT NULL REFERENCES public.acct_vendors(id) ON DELETE CASCADE,
  rfq_id        uuid REFERENCES public.rfqs(id) ON DELETE CASCADE,
  tech_pack_id  uuid REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  level         text NOT NULL CHECK (level IN ('preview','production')),
  granted_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  UNIQUE (vendor_id, tech_pack_id, level)
);
DROP TRIGGER IF EXISTS trg_arg_tenant ON public.asset_release_grants;
CREATE TRIGGER trg_arg_tenant BEFORE INSERT OR UPDATE ON public.asset_release_grants FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('acct_vendors','vendor_id');

CREATE TABLE IF NOT EXISTS public.ds_access_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  actor_user_id   uuid,
  actor_vendor_id uuid,
  event           text NOT NULL CHECK (event IN (
                    'rfq_viewed','asset_view_authorized','asset_view_denied','asset_streamed',
                    'nda_accepted','bid_saved','bid_submitted','bid_withdrawn','question_asked','rfq_declined',
                    'upload_registered','release_download_authorized','release_download_denied',
                    'supplier_invited','supplier_accepted','supplier_revoked','rfq_published','rfq_closed','rfq_awarded',
                    'techpack_transition','print_attempt','devtools_hint','copy_attempt')),
  subject_type    text,
  subject_id      uuid,
  rfq_id          uuid,
  asset_id        uuid,
  ip              inet,
  user_agent      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ds_access_events_tenant_time_idx ON public.ds_access_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ds_access_events_vendor_idx ON public.ds_access_events (actor_vendor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ds_access_events_rfq_idx ON public.ds_access_events (rfq_id, occurred_at DESC);
DROP TRIGGER IF EXISTS trg_dsae_append ON public.ds_access_events;
CREATE TRIGGER trg_dsae_append BEFORE UPDATE OR DELETE ON public.ds_access_events FOR EACH ROW EXECUTE FUNCTION public.ds__append_only();

-- PostgREST exposes request.headers as json; capture ip + user agent when present
CREATE OR REPLACE FUNCTION public.ds__log(p_tenant uuid, p_event text, p_subject_type text, p_subject uuid,
  p_rfq uuid DEFAULT NULL, p_asset uuid DEFAULT NULL, p_vendor uuid DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE h jsonb; v_ip inet;
BEGIN
  BEGIN h := nullif(current_setting('request.headers', true), '')::jsonb; EXCEPTION WHEN others THEN h := NULL; END;
  BEGIN v_ip := split_part(coalesce(h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1)::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  INSERT INTO public.ds_access_events(tenant_id, actor_user_id, actor_vendor_id, event, subject_type, subject_id, rfq_id, asset_id, ip, user_agent, metadata)
  VALUES (p_tenant, auth.uid(), p_vendor, p_event, p_subject_type, p_subject, p_rfq, p_asset, v_ip, h ->> 'user-agent', coalesce(p_meta, '{}'::jsonb));
END $$;

-- =====================================================================
-- H. Render / export job queue for the Lightsail Craft worker
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.craft_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN (
                     'mockup_render','supplier_preview','techpack_pdf','techpack_preview_pdf','vector_export',
                     'pattern_export','texture_bake','turntable_render','promo_video','bg_remove','virus_scan','thumbnail')),
  app              text NOT NULL CHECK (app IN ('photocraft','vectorcraft','designcraft','pdfcraft','texturecraft','materialcraft','lightcraft','effectcraft','filmcraft','ffmpeg','clamav','rembg','internal')),
  status           text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  priority         int NOT NULL DEFAULT 100,
  input            jsonb NOT NULL DEFAULT '{}'::jsonb,
  output           jsonb,
  subject_type     text,
  subject_id       uuid,
  idempotency_key  text NOT NULL,
  attempts         int NOT NULL DEFAULT 0,
  max_attempts     int NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  run_after        timestamptz NOT NULL DEFAULT now(),
  claimed_by       text,
  claimed_at       timestamptz,
  heartbeat_at     timestamptz,
  finished_at      timestamptz,
  error            text,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS craft_jobs_ready_idx ON public.craft_jobs (priority, run_after) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS craft_jobs_subject_idx ON public.craft_jobs (subject_type, subject_id);

-- updated_at triggers for the rest
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ds_seasons','ds_size_ranges','ds_pom_library','ds_materials','ds_garment_templates','design_colorways',
                           'supplier_portal_members','supplier_capabilities','tech_packs','rfqs','rfq_lines','bids','bid_lines',
                           'bid_evaluations','craft_jobs'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- =====================================================================
-- I. Supplier identity helpers
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds_my_vendor_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT vendor_id FROM public.supplier_portal_members WHERE user_id = auth.uid() AND status = 'active'
$$;

-- Resolve the caller's live access to an RFQ. Raises unless everything checks out.
CREATE OR REPLACE FUNCTION public.ds__supplier_rfq_access(p_rfq uuid, p_require_nda boolean DEFAULT true)
RETURNS public.rfq_invitations
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; r public.rfqs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  IF r.id IS NULL OR r.status = 'draft' THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  SELECT i.* INTO v_inv FROM public.rfq_invitations i
   WHERE i.rfq_id = p_rfq AND i.vendor_id IN (SELECT public.ds_my_vendor_ids())
     AND i.status <> 'revoked' AND (i.access_expires_at IS NULL OR i.access_expires_at > now())
   LIMIT 1;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  IF p_require_nda AND r.nda_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.ds_nda_acceptances a WHERE a.nda_id = r.nda_id AND a.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'NDA_REQUIRED' USING ERRCODE = '42501', HINT = r.nda_id::text;
  END IF;
  RETURN v_inv;
END $$;

-- sealed-bid visibility for internal staff
CREATE OR REPLACE FUNCTION public.ds_rfq_unsealed(p_rfq uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT coalesce((SELECT NOT r.sealed OR r.status IN ('closed','awarded','cancelled') OR (r.bid_deadline IS NOT NULL AND now() >= r.bid_deadline)
                     FROM public.rfqs r WHERE r.id = p_rfq), false)
$$;

-- =====================================================================
-- J. Internal RPCs (staff)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds_create_design_version(p_design uuid, p_canvas_state jsonb DEFAULT NULL,
  p_source_app text DEFAULT 'konva', p_document_asset uuid DEFAULT NULL, p_preview_asset uuid DEFAULT NULL,
  p_message text DEFAULT NULL, p_sha256 text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE d public.designs; v_id uuid;
BEGIN
  SELECT * INTO d FROM public.designs WHERE id = p_design AND deleted_at IS NULL;
  IF d.id IS NULL THEN RAISE EXCEPTION 'design not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_member(d.tenant_id);
  INSERT INTO public.design_versions(tenant_id, design_id, version_no, canvas_state, source_app, document_asset_id, preview_asset_id, message, sha256)
  VALUES (d.tenant_id, d.id, 0, p_canvas_state, coalesce(p_source_app,'konva'), p_document_asset, p_preview_asset, p_message, p_sha256)
  RETURNING id INTO v_id;
  IF p_canvas_state IS NOT NULL THEN UPDATE public.designs SET canvas_state = p_canvas_state WHERE id = d.id; END IF;
  RETURN v_id;
END $$;

-- Snapshot of a tech pack with children (used for revisions and PDF rendering)
CREATE OR REPLACE FUNCTION public.ds_tech_pack_snapshot(p_tp uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE tp public.tech_packs; v jsonb;
BEGIN
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp;
  IF tp.id IS NULL THEN RAISE EXCEPTION 'tech pack not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.platform_is_tenant_member(tp.tenant_id) AND coalesce(current_setting('ds.via_rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'not a member of this workspace' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'tech_pack', to_jsonb(tp),
    'design', (SELECT jsonb_build_object('id', d.id, 'name', d.name, 'style_number', d.style_number, 'product_type', d.product_type) FROM public.designs d WHERE d.id = tp.design_id),
    'size_range', (SELECT to_jsonb(sr) FROM public.ds_size_ranges sr WHERE sr.id = tp.size_range_id),
    'colorways', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort) FROM public.design_colorways c WHERE c.design_id = tp.design_id), '[]'::jsonb),
    'bom', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sort) FROM public.tech_pack_bom_lines b WHERE b.tech_pack_id = tp.id), '[]'::jsonb),
    'measurements', coalesce((SELECT jsonb_agg(jsonb_build_object('pom', p.code, 'name', p.name, 'size', m.size_label, 'value', m.value, 'tol_plus', m.tol_plus, 'tol_minus', m.tol_minus) ORDER BY p.sort, p.code, m.size_label)
                               FROM public.tech_pack_measurements m JOIN public.ds_pom_library p ON p.id = m.pom_id WHERE m.tech_pack_id = tp.id), '[]'::jsonb),
    'construction', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort) FROM public.tech_pack_construction c WHERE c.tech_pack_id = tp.id), '[]'::jsonb),
    'artwork', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort) FROM public.tech_pack_artwork a WHERE a.tech_pack_id = tp.id), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

-- New draft tech pack (revision n+1), cloning children from the latest revision.
CREATE OR REPLACE FUNCTION public.ds_create_tech_pack(p_design uuid, p_title text DEFAULT NULL, p_version uuid DEFAULT NULL,
  p_size_range uuid DEFAULT NULL, p_base_size text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE d public.designs; prev public.tech_packs; v_id uuid; v_ver uuid;
BEGIN
  SELECT * INTO d FROM public.designs WHERE id = p_design AND deleted_at IS NULL;
  IF d.id IS NULL THEN RAISE EXCEPTION 'design not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_member(d.tenant_id);
  v_ver := coalesce(p_version, d.current_version_id);
  IF v_ver IS NULL THEN RAISE EXCEPTION 'save a design version first' USING ERRCODE = '23502'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.design_versions WHERE id = v_ver AND design_id = d.id) THEN
    RAISE EXCEPTION 'version does not belong to this design' USING ERRCODE = '23503';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tp:' || d.id::text, 0));
  SELECT * INTO prev FROM public.tech_packs WHERE design_id = d.id ORDER BY revision DESC LIMIT 1;
  IF prev.id IS NOT NULL AND prev.status IN ('draft','in_review') THEN
    RAISE EXCEPTION 'revision % is still %; finish or archive it first', prev.revision, prev.status USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.tech_packs(tenant_id, design_id, version_id, revision, style_number, title, season_id, size_range_id, base_size, supersedes_id)
  VALUES (d.tenant_id, d.id, v_ver, coalesce(prev.revision, 0) + 1, d.style_number,
          coalesce(p_title, prev.title, d.name), d.season_id,
          coalesce(p_size_range, prev.size_range_id), coalesce(p_base_size, prev.base_size), prev.id)
  RETURNING id INTO v_id;
  IF prev.id IS NOT NULL THEN
    INSERT INTO public.tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom, colorway_id, vendor_id, unit_cost, supplier_note, sort)
      SELECT tenant_id, v_id, material_id, kind, placement, description, quantity, uom, colorway_id, vendor_id, unit_cost, supplier_note, sort FROM public.tech_pack_bom_lines WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus)
      SELECT tenant_id, v_id, pom_id, size_label, value, tol_plus, tol_minus FROM public.tech_pack_measurements WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_construction(tenant_id, tech_pack_id, area, operation, stitch_type, spi, seam_allowance_mm, notes, image_asset_id, sort)
      SELECT tenant_id, v_id, area, operation, stitch_type, spi, seam_allowance_mm, notes, image_asset_id, sort FROM public.tech_pack_construction WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_artwork(tenant_id, tech_pack_id, asset_id, view, placement, technique, width_mm, height_mm, offset_ref, offset_x_mm, offset_y_mm, colorway_id, pantone_codes, stitch_count, notes, sort)
      SELECT tenant_id, v_id, asset_id, view, placement, technique, width_mm, height_mm, offset_ref, offset_x_mm, offset_y_mm, colorway_id, pantone_codes, stitch_count, notes, sort FROM public.tech_pack_artwork WHERE tech_pack_id = prev.id;
  END IF;
  RETURN v_id;
END $$;

-- Tech pack state machine:
--   draft -> in_review -> approved -> released -> superseded
--   in_review -> draft (changes requested); any non-terminal -> archived
--   approve/release/archive need owner/admin. Approving locks the design version.
CREATE OR REPLACE FUNCTION public.ds_transition_tech_pack(p_tp uuid, p_to text, p_note text DEFAULT NULL)
RETURNS public.tech_packs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE tp public.tech_packs; v_ok boolean; v_from text;
BEGIN
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp FOR UPDATE;
  IF tp.id IS NULL THEN RAISE EXCEPTION 'tech pack not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_member(tp.tenant_id);
  v_from := tp.status;
  v_ok := (v_from, p_to) IN (('draft','in_review'),('in_review','draft'),('in_review','approved'),('approved','released'),
                              ('draft','archived'),('in_review','archived'),('approved','archived'));
  IF NOT v_ok THEN RAISE EXCEPTION 'cannot move tech pack from % to %', v_from, p_to USING ERRCODE = '22023'; END IF;
  IF p_to IN ('approved','released','archived') THEN PERFORM public.ds__assert_admin(tp.tenant_id); END IF;
  IF p_to = 'in_review' THEN
    IF tp.size_range_id IS NULL OR tp.base_size IS NULL THEN RAISE EXCEPTION 'size range and base size are required' USING ERRCODE = '23502'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tech_pack_bom_lines WHERE tech_pack_id = tp.id) THEN RAISE EXCEPTION 'BOM is empty' USING ERRCODE = '23502'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tech_pack_measurements WHERE tech_pack_id = tp.id) THEN RAISE EXCEPTION 'measurement chart is empty' USING ERRCODE = '23502'; END IF;
  END IF;
  PERFORM public.ds__rpc_on();
  IF p_to = 'approved' THEN
    UPDATE public.tech_packs SET status = 'approved', approved_by = auth.uid(), approved_at = now() WHERE id = tp.id;
    UPDATE public.design_versions SET is_locked = true WHERE id = tp.version_id AND NOT is_locked;
  ELSIF p_to = 'released' THEN
    UPDATE public.tech_packs SET status = 'superseded' WHERE design_id = tp.design_id AND status = 'released' AND id <> tp.id;
    UPDATE public.tech_packs SET status = 'released', released_at = now() WHERE id = tp.id;
  ELSE
    UPDATE public.tech_packs SET status = p_to WHERE id = tp.id;
  END IF;
  INSERT INTO public.tech_pack_revisions(tenant_id, tech_pack_id, revision, from_status, to_status, snapshot, change_summary)
  VALUES (tp.tenant_id, tp.id, tp.revision, v_from, p_to, public.ds_tech_pack_snapshot(tp.id), p_note);
  PERFORM public.ds__log(tp.tenant_id, 'techpack_transition', 'tech_pack', tp.id, NULL, NULL, NULL, jsonb_build_object('from', v_from, 'to', p_to));
  IF p_to IN ('approved','released') THEN
    INSERT INTO public.craft_jobs(tenant_id, kind, app, input, subject_type, subject_id, idempotency_key, priority)
    VALUES (tp.tenant_id, 'techpack_pdf', 'designcraft', jsonb_build_object('tech_pack_id', tp.id, 'revision', tp.revision), 'tech_pack', tp.id,
            'techpack_pdf:' || tp.id || ':' || p_to, 50),
           (tp.tenant_id, 'techpack_preview_pdf', 'pdfcraft', jsonb_build_object('tech_pack_id', tp.id, 'revision', tp.revision), 'tech_pack', tp.id,
            'techpack_preview_pdf:' || tp.id || ':' || p_to, 60)
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp;
  RETURN tp;
END $$;

CREATE OR REPLACE FUNCTION public.ds_create_rfq(p_tenant uuid, p_title text, p_bid_deadline timestamptz DEFAULT NULL,
  p_currency char(3) DEFAULT 'USD', p_incoterm text DEFAULT NULL, p_sealed boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.ds__assert_member(p_tenant);
  INSERT INTO public.rfqs(tenant_id, rfq_number, title, bid_deadline, currency, incoterm, sealed, nda_id)
  VALUES (p_tenant, public.erp_next_document_number(p_tenant, 'rfq'), p_title, p_bid_deadline, p_currency, p_incoterm, p_sealed,
          (SELECT id FROM public.ds_ndas WHERE tenant_id = p_tenant AND is_active))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ds_invite_vendor_to_rfq(p_rfq uuid, p_vendor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE r public.rfqs; v_id uuid; m record;
BEGIN
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_member(r.tenant_id);
  IF r.status NOT IN ('draft','published') THEN RAISE EXCEPTION 'RFQ is %', r.status USING ERRCODE = '22023'; END IF;
  PERFORM public.ds__rpc_on();
  INSERT INTO public.rfq_invitations(tenant_id, rfq_id, vendor_id) VALUES (r.tenant_id, r.id, p_vendor)
  ON CONFLICT (rfq_id, vendor_id) DO UPDATE SET status = CASE WHEN rfq_invitations.status = 'revoked' THEN 'invited' ELSE rfq_invitations.status END,
                                               revoked_at = NULL
  RETURNING id INTO v_id;
  INSERT INTO public.asset_release_grants(tenant_id, vendor_id, rfq_id, tech_pack_id, level)
    SELECT r.tenant_id, p_vendor, r.id, rl.tech_pack_id, 'preview' FROM public.rfq_lines rl WHERE rl.rfq_id = r.id
  ON CONFLICT (vendor_id, tech_pack_id, level) DO UPDATE SET revoked_at = NULL, revoked_by = NULL;
  IF r.status = 'published' THEN
    FOR m IN SELECT user_id FROM public.supplier_portal_members WHERE vendor_id = p_vendor AND status = 'active' LOOP
      PERFORM public.platform_notify(r.tenant_id, m.user_id, 'rfq_invited', 'New request for quote: ' || r.title, NULL, '/supplier/rfqs/' || r.id, 'high', 'rfq', r.id);
    END LOOP;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ds_publish_rfq(p_rfq uuid)
RETURNS public.rfqs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE r public.rfqs; bad int; m record;
BEGIN
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_admin(r.tenant_id);
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'only draft RFQs can be published' USING ERRCODE = '22023'; END IF;
  IF r.bid_deadline IS NULL OR r.bid_deadline <= now() + interval '1 hour' THEN RAISE EXCEPTION 'bid deadline must be at least 1 hour away' USING ERRCODE = '22023'; END IF;
  IF r.nda_id IS NULL THEN RAISE EXCEPTION 'an NDA is required before suppliers can see designs' USING ERRCODE = '23502'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rfq_lines WHERE rfq_id = r.id) THEN RAISE EXCEPTION 'RFQ has no lines' USING ERRCODE = '23502'; END IF;
  SELECT count(*) INTO bad FROM public.rfq_lines rl JOIN public.tech_packs tp ON tp.id = rl.tech_pack_id
   WHERE rl.rfq_id = r.id AND (tp.status NOT IN ('approved','released') OR tp.preview_pdf_asset_id IS NULL);
  IF bad > 0 THEN RAISE EXCEPTION '% line(s) use a tech pack that is not approved or has no watermarked preview yet', bad USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rfq_invitations WHERE rfq_id = r.id AND status <> 'revoked') THEN RAISE EXCEPTION 'invite at least one supplier' USING ERRCODE = '23502'; END IF;
  PERFORM public.ds__rpc_on();
  UPDATE public.rfqs SET status = 'published', published_at = now() WHERE id = r.id;
  INSERT INTO public.asset_release_grants(tenant_id, vendor_id, rfq_id, tech_pack_id, level)
    SELECT r.tenant_id, i.vendor_id, r.id, rl.tech_pack_id, 'preview'
      FROM public.rfq_invitations i CROSS JOIN public.rfq_lines rl
     WHERE i.rfq_id = r.id AND rl.rfq_id = r.id AND i.status <> 'revoked'
  ON CONFLICT (vendor_id, tech_pack_id, level) DO NOTHING;
  FOR m IN SELECT DISTINCT spm.user_id FROM public.rfq_invitations i
             JOIN public.supplier_portal_members spm ON spm.vendor_id = i.vendor_id AND spm.status = 'active'
            WHERE i.rfq_id = r.id AND i.status <> 'revoked' LOOP
    PERFORM public.platform_notify(r.tenant_id, m.user_id, 'rfq_invited', 'New request for quote: ' || r.title, 'Bids due ' || to_char(r.bid_deadline, 'YYYY-MM-DD HH24:MI TZ'), '/supplier/rfqs/' || r.id, 'high', 'rfq', r.id);
  END LOOP;
  PERFORM public.ds__log(r.tenant_id, 'rfq_published', 'rfq', r.id, r.id);
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.ds_close_rfq(p_rfq uuid)
RETURNS public.rfqs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE r public.rfqs;
BEGIN
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  IF auth.uid() IS NOT NULL THEN PERFORM public.ds__assert_admin(r.tenant_id); END IF;  -- NULL uid = cron/service
  IF r.status <> 'published' THEN RAISE EXCEPTION 'only published RFQs can be closed' USING ERRCODE = '22023'; END IF;
  PERFORM public.ds__rpc_on();
  UPDATE public.rfqs SET status = 'closed', closed_at = now() WHERE id = r.id;
  -- drafts that were never submitted are dropped from consideration
  UPDATE public.bids SET status = 'withdrawn' WHERE rfq_id = r.id AND status = 'draft';
  PERFORM public.ds__log(r.tenant_id, 'rfq_closed', 'rfq', r.id, r.id);
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  RETURN r;
END $$;

-- cron: SELECT ds_close_due_rfqs();  (every minute via pg_cron, service role)
CREATE OR REPLACE FUNCTION public.ds_close_due_rfqs() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE r record; n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.platform_is_admin() THEN RAISE EXCEPTION 'service only' USING ERRCODE = '42501'; END IF;
  FOR r IN SELECT id FROM public.rfqs WHERE status = 'published' AND bid_deadline <= now() LOOP
    PERFORM public.ds_close_rfq(r.id); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.ds_answer_question(p_question uuid, p_answer text, p_broadcast boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE q public.rfq_questions; m record;
BEGIN
  SELECT * INTO q FROM public.rfq_questions WHERE id = p_question;
  IF q.id IS NULL THEN RAISE EXCEPTION 'question not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_member(q.tenant_id);
  UPDATE public.rfq_questions SET answer = p_answer, answered_by = auth.uid(), answered_at = now(), broadcast = p_broadcast WHERE id = q.id;
  FOR m IN SELECT DISTINCT spm.user_id FROM public.rfq_invitations i JOIN public.supplier_portal_members spm ON spm.vendor_id = i.vendor_id AND spm.status = 'active'
            WHERE i.rfq_id = q.rfq_id AND i.status <> 'revoked' AND (p_broadcast OR i.vendor_id = q.vendor_id) LOOP
    PERFORM public.platform_notify(q.tenant_id, m.user_id, 'rfq_answer', 'A question on your RFQ was answered', NULL, '/supplier/rfqs/' || q.rfq_id, 'normal', 'rfq', q.rfq_id);
  END LOOP;
END $$;

-- Award: p_awards = [{"rfq_line_id": "...", "bid_id": "..."}]. Creates one draft PO per vendor.
CREATE OR REPLACE FUNCTION public.ds_award_rfq(p_rfq uuid, p_awards jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE r public.rfqs; a jsonb; b public.bids; bl public.bid_lines; rl public.rfq_lines;
        v_po uuid; v_pos jsonb := '{}'::jsonb; v_vendor uuid; m record;
BEGIN
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'RFQ not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_admin(r.tenant_id);
  IF r.status <> 'closed' THEN RAISE EXCEPTION 'close the RFQ before awarding' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_awards) <> 'array' OR jsonb_array_length(p_awards) = 0 THEN RAISE EXCEPTION 'no awards given' USING ERRCODE = '22023'; END IF;
  PERFORM public.ds__rpc_on();
  FOR a IN SELECT * FROM jsonb_array_elements(p_awards) LOOP
    SELECT * INTO rl FROM public.rfq_lines WHERE id = (a ->> 'rfq_line_id')::uuid AND rfq_id = r.id;
    SELECT * INTO b  FROM public.bids WHERE id = (a ->> 'bid_id')::uuid AND rfq_id = r.id AND status IN ('submitted','shortlisted');
    IF rl.id IS NULL OR b.id IS NULL THEN RAISE EXCEPTION 'invalid award %', a USING ERRCODE = '22023'; END IF;
    SELECT * INTO bl FROM public.bid_lines WHERE bid_id = b.id AND rfq_line_id = rl.id;
    IF bl.id IS NULL THEN RAISE EXCEPTION 'bid % did not price line %', b.id, rl.line_no USING ERRCODE = '22023'; END IF;
    v_vendor := b.vendor_id;
    IF v_pos ? v_vendor::text THEN
      v_po := (v_pos ->> v_vendor::text)::uuid;
    ELSE
      INSERT INTO public.erp_purchase_orders(tenant_id, po_number, vendor_id, status, currency, expected_date, notes, created_by)
      VALUES (r.tenant_id, public.erp_next_document_number(r.tenant_id, 'purchase_order'), v_vendor, 'draft', b.currency,
              r.target_delivery_date, 'Awarded from ' || r.rfq_number || ' (bid rev ' || b.revision || ')', auth.uid())
      RETURNING id INTO v_po;
      v_pos := v_pos || jsonb_build_object(v_vendor::text, v_po);
    END IF;
    INSERT INTO public.erp_purchase_order_lines(tenant_id, purchase_order_id, description, quantity, quantity_ordered, unit_cost, line_total)
    VALUES (r.tenant_id, v_po,
            (SELECT tp.title || ' / ' || coalesce(tp.style_number,'') || ' rev ' || tp.revision FROM public.tech_packs tp WHERE tp.id = rl.tech_pack_id),
            rl.quantity, rl.quantity, bl.unit_price, bl.unit_price * rl.quantity);
    INSERT INTO public.rfq_awards(tenant_id, rfq_id, rfq_line_id, bid_id, bid_line_id, vendor_id, quantity, unit_price, purchase_order_id)
    VALUES (r.tenant_id, r.id, rl.id, b.id, bl.id, v_vendor, rl.quantity, bl.unit_price, v_po);
    INSERT INTO public.asset_release_grants(tenant_id, vendor_id, rfq_id, tech_pack_id, level)
    VALUES (r.tenant_id, v_vendor, r.id, rl.tech_pack_id, 'production')
    ON CONFLICT (vendor_id, tech_pack_id, level) DO UPDATE SET revoked_at = NULL, revoked_by = NULL, granted_at = now();
  END LOOP;
  UPDATE public.erp_purchase_orders po SET subtotal = s.t, total = s.t + po.tax_total + po.shipping_total
    FROM (SELECT purchase_order_id, sum(line_total) t FROM public.erp_purchase_order_lines
           WHERE purchase_order_id IN (SELECT (value #>> '{}')::uuid FROM jsonb_each(v_pos)) GROUP BY 1) s
   WHERE po.id = s.purchase_order_id;
  UPDATE public.bids SET status = 'awarded'  WHERE rfq_id = r.id AND id IN (SELECT bid_id FROM public.rfq_awards WHERE rfq_id = r.id);
  UPDATE public.bids SET status = 'rejected' WHERE rfq_id = r.id AND status IN ('submitted','shortlisted');
  UPDATE public.rfq_invitations SET status = CASE WHEN vendor_id IN (SELECT vendor_id FROM public.rfq_awards WHERE rfq_id = r.id) THEN 'awarded' ELSE 'not_awarded' END
   WHERE rfq_id = r.id AND status IN ('invited','viewed','bid_submitted');
  -- losing suppliers lose preview access immediately
  UPDATE public.asset_release_grants SET revoked_at = now(), revoked_by = auth.uid(), reason = 'not awarded'
   WHERE rfq_id = r.id AND level = 'preview' AND vendor_id NOT IN (SELECT vendor_id FROM public.rfq_awards WHERE rfq_id = r.id) AND revoked_at IS NULL;
  UPDATE public.rfqs SET status = 'awarded', awarded_at = now() WHERE id = r.id;
  FOR m IN SELECT DISTINCT spm.user_id, i.status FROM public.rfq_invitations i JOIN public.supplier_portal_members spm ON spm.vendor_id = i.vendor_id AND spm.status = 'active'
            WHERE i.rfq_id = r.id AND i.status IN ('awarded','not_awarded') LOOP
    PERFORM public.platform_notify(r.tenant_id, m.user_id, 'rfq_result',
      CASE WHEN m.status = 'awarded' THEN 'You were awarded ' || r.rfq_number ELSE 'Result for ' || r.rfq_number END, NULL, '/supplier/rfqs/' || r.id, 'high', 'rfq', r.id);
  END LOOP;
  PERFORM public.ds__log(r.tenant_id, 'rfq_awarded', 'rfq', r.id, r.id, NULL, NULL, jsonb_build_object('purchase_orders', v_pos));
  RETURN jsonb_build_object('rfq_id', r.id, 'purchase_orders', v_pos);
END $$;

-- Invite a supplier user. Returns the plaintext token ONCE (server emails the link).
CREATE OR REPLACE FUNCTION public.ds_invite_supplier_user(p_vendor uuid, p_email text, p_role text DEFAULT 'estimator', p_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_tenant uuid; v_token text := encode(gen_random_bytes(32), 'hex'); v_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.acct_vendors WHERE id = p_vendor;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'vendor not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_admin(v_tenant);
  INSERT INTO public.supplier_portal_members(tenant_id, vendor_id, email, display_name, role, status, invite_token_hash, invite_expires_at, invited_by)
  VALUES (v_tenant, p_vendor, lower(p_email), p_name, p_role, 'invited', encode(sha256(convert_to(v_token,'UTF8')),'hex'), now() + interval '7 days', auth.uid())
  ON CONFLICT (vendor_id, email) DO UPDATE SET invite_token_hash = excluded.invite_token_hash, invite_expires_at = excluded.invite_expires_at,
        role = excluded.role, status = CASE WHEN supplier_portal_members.status = 'active' THEN 'active' ELSE 'invited' END
  RETURNING id INTO v_id;
  PERFORM public.ds__log(v_tenant, 'supplier_invited', 'supplier_portal_member', v_id, NULL, NULL, p_vendor, jsonb_build_object('email', lower(p_email)));
  RETURN jsonb_build_object('member_id', v_id, 'token', v_token);
END $$;

CREATE OR REPLACE FUNCTION public.ds_revoke_supplier(p_vendor uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.acct_vendors WHERE id = p_vendor;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'vendor not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.ds__assert_admin(v_tenant);
  PERFORM public.ds__rpc_on();
  UPDATE public.supplier_portal_members SET status = 'revoked', invite_token_hash = NULL WHERE vendor_id = p_vendor AND status <> 'revoked';
  UPDATE public.rfq_invitations SET status = 'revoked', revoked_at = now() WHERE vendor_id = p_vendor AND status NOT IN ('revoked','awarded','not_awarded');
  UPDATE public.asset_release_grants SET revoked_at = now(), revoked_by = auth.uid(), reason = coalesce(p_reason, 'supplier revoked') WHERE vendor_id = p_vendor AND revoked_at IS NULL;
  PERFORM public.ds__log(v_tenant, 'supplier_revoked', 'vendor', p_vendor, NULL, NULL, p_vendor, jsonb_build_object('reason', p_reason));
END $$;

-- =====================================================================
-- K. Supplier RPCs (caller = supplier portal user)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.supplier_accept_invite(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE m public.supplier_portal_members; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.supplier_portal_members
   WHERE invite_token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND status IN ('invited','active') FOR UPDATE;
  IF m.id IS NULL OR m.invite_expires_at < now() THEN RAISE EXCEPTION 'invite is invalid or expired' USING ERRCODE = '22023'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(v_email) <> lower(m.email::text) THEN RAISE EXCEPTION 'sign in with the invited email address' USING ERRCODE = '42501'; END IF;
  UPDATE public.supplier_portal_members SET user_id = auth.uid(), status = 'active', accepted_at = now(), invite_token_hash = NULL WHERE id = m.id;
  PERFORM public.ds__log(m.tenant_id, 'supplier_accepted', 'supplier_portal_member', m.id, NULL, NULL, m.vendor_id);
  RETURN jsonb_build_object('vendor_id', m.vendor_id, 'tenant_id', m.tenant_id);
END $$;

CREATE OR REPLACE FUNCTION public.supplier_get_nda(p_rfq uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; n public.ds_ndas;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, false);
  SELECT nd.* INTO n FROM public.rfqs r JOIN public.ds_ndas nd ON nd.id = r.nda_id WHERE r.id = p_rfq;
  RETURN jsonb_build_object('nda_id', n.id, 'title', n.title, 'version', n.version, 'body_md', n.body_md, 'body_sha256', n.body_sha256,
    'accepted', EXISTS (SELECT 1 FROM public.ds_nda_acceptances a WHERE a.nda_id = n.id AND a.user_id = auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.supplier_accept_nda(p_rfq uuid, p_body_sha256 text, p_signer_name text, p_signer_title text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; n public.ds_ndas; h jsonb; v_ip inet;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, false);
  SELECT nd.* INTO n FROM public.rfqs r JOIN public.ds_ndas nd ON nd.id = r.nda_id WHERE r.id = p_rfq;
  IF n.id IS NULL THEN RETURN; END IF;
  IF p_body_sha256 IS DISTINCT FROM n.body_sha256 THEN RAISE EXCEPTION 'NDA text changed; reload and read it again' USING ERRCODE = '22023'; END IF;
  IF length(trim(coalesce(p_signer_name,''))) < 2 THEN RAISE EXCEPTION 'type your full name to sign' USING ERRCODE = '22023'; END IF;
  BEGIN h := nullif(current_setting('request.headers', true), '')::jsonb; EXCEPTION WHEN others THEN h := NULL; END;
  BEGIN v_ip := split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)::inet; EXCEPTION WHEN others THEN v_ip := NULL; END;
  INSERT INTO public.ds_nda_acceptances(tenant_id, nda_id, vendor_id, user_id, signer_name, signer_title, body_sha256, ip, user_agent)
  VALUES (n.tenant_id, n.id, v_inv.vendor_id, auth.uid(), trim(p_signer_name), p_signer_title, n.body_sha256, v_ip, h ->> 'user-agent')
  ON CONFLICT (nda_id, user_id) DO NOTHING;
  PERFORM public.ds__log(n.tenant_id, 'nda_accepted', 'nda', n.id, p_rfq, NULL, v_inv.vendor_id);
END $$;

CREATE OR REPLACE FUNCTION public.supplier_my_rfqs()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rfq_id', r.id, 'rfq_number', r.rfq_number, 'title', r.title, 'status', r.status, 'bid_deadline', r.bid_deadline,
           'invitation_status', i.status, 'workspace', t.name,
           'my_bid_status', (SELECT b.status FROM public.bids b WHERE b.rfq_id = r.id AND b.vendor_id = i.vendor_id ORDER BY b.revision DESC LIMIT 1))
         ORDER BY r.bid_deadline NULLS LAST), '[]'::jsonb)
    FROM public.rfq_invitations i JOIN public.rfqs r ON r.id = i.rfq_id JOIN public.tenants t ON t.id = r.tenant_id
   WHERE i.vendor_id IN (SELECT public.ds_my_vendor_ids()) AND i.status <> 'revoked' AND r.status <> 'draft'
     AND auth.uid() IS NOT NULL
$$;

-- What a supplier may see of an RFQ. Never includes target_unit_cost, internal notes, other bids or storage paths.
CREATE OR REPLACE FUNCTION public.supplier_get_rfq(p_rfq uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; r public.rfqs; v jsonb;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, true);
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  PERFORM public.ds__rpc_on();
  UPDATE public.rfq_invitations SET first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now(),
         status = CASE WHEN status = 'invited' THEN 'viewed' ELSE status END
   WHERE id = v_inv.id;
  UPDATE public.supplier_portal_members SET last_seen_at = now() WHERE user_id = auth.uid() AND vendor_id = v_inv.vendor_id;
  SELECT jsonb_build_object(
    'rfq', jsonb_build_object('id', r.id, 'rfq_number', r.rfq_number, 'title', r.title, 'status', r.status, 'currency', r.currency,
             'incoterm', r.incoterm, 'ship_to', r.ship_to, 'target_delivery_date', r.target_delivery_date,
             'questions_deadline', r.questions_deadline, 'bid_deadline', r.bid_deadline, 'allow_bid_revisions', r.allow_bid_revisions,
             'meet_space_uri', r.meet_space_uri),
    'vendor_id', v_inv.vendor_id,
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object(
               'rfq_line_id', rl.id, 'line_no', rl.line_no, 'quantity', rl.quantity, 'size_breakdown', rl.size_breakdown, 'notes', rl.notes,
               'colorway', (SELECT jsonb_build_object('name', c.name, 'pantone_codes', c.pantone_codes, 'garment_color_hex', c.garment_color_hex) FROM public.design_colorways c WHERE c.id = rl.colorway_id),
               'tech_pack', jsonb_build_object('id', tp.id, 'title', tp.title, 'style_number', tp.style_number, 'revision', tp.revision,
                                               'preview_asset_id', tp.preview_pdf_asset_id,
                                               'preview_images', coalesce((SELECT jsonb_agg(jsonb_build_object('asset_id', da.id, 'surface', da.surface, 'width', da.width, 'height', da.height))
                                                                  FROM public.design_assets da WHERE da.design_id = tp.design_id AND da.classification = 'supplier_preview'
                                                                   AND da.deleted_at IS NULL AND (da.version_id = tp.version_id OR da.version_id IS NULL)), '[]'::jsonb)))
               ORDER BY rl.line_no)
             FROM public.rfq_lines rl JOIN public.tech_packs tp ON tp.id = rl.tech_pack_id WHERE rl.rfq_id = r.id), '[]'::jsonb),
    'questions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'question', q.question, 'answer', q.answer, 'answered_at', q.answered_at,
                                   'mine', q.vendor_id = v_inv.vendor_id, 'created_at', q.created_at) ORDER BY q.created_at)
               FROM public.rfq_questions q WHERE q.rfq_id = r.id AND (q.vendor_id = v_inv.vendor_id OR (q.broadcast AND q.answer IS NOT NULL))), '[]'::jsonb),
    'my_bid', (SELECT jsonb_build_object('id', b.id, 'revision', b.revision, 'status', b.status, 'currency', b.currency, 'valid_until', b.valid_until,
                        'lead_time_days', b.lead_time_days, 'payment_terms', b.payment_terms, 'incoterm', b.incoterm, 'notes', b.notes,
                        'total_amount', b.total_amount, 'submitted_at', b.submitted_at,
                        'lines', coalesce((SELECT jsonb_agg(to_jsonb(bl) - 'tenant_id') FROM public.bid_lines bl WHERE bl.bid_id = b.id), '[]'::jsonb))
                 FROM public.bids b WHERE b.rfq_id = r.id AND b.vendor_id = v_inv.vendor_id ORDER BY b.revision DESC LIMIT 1),
    'production_release', EXISTS (SELECT 1 FROM public.asset_release_grants g WHERE g.vendor_id = v_inv.vendor_id AND g.rfq_id = r.id AND g.level = 'production' AND g.revoked_at IS NULL)
  ) INTO v;
  PERFORM public.ds__log(r.tenant_id, 'rfq_viewed', 'rfq', r.id, r.id, NULL, v_inv.vendor_id);
  RETURN v;
END $$;

-- Authorize one supplier-preview asset for streaming. Called by the Next.js proxy with the supplier's JWT.
-- Returns bucket/path + watermark text; the proxy then reads the object with the service key.
CREATE OR REPLACE FUNCTION public.supplier_authorize_asset_view(p_rfq uuid, p_asset uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; a public.design_assets; v_name text; v_email text; v_vendor_name text;
BEGIN
  BEGIN
    v_inv := public.ds__supplier_rfq_access(p_rfq, true);
  EXCEPTION WHEN others THEN
    -- return (not raise) so the denial row commits; the proxy maps allowed=false to HTTP 403
    INSERT INTO public.ds_access_events(tenant_id, actor_user_id, event, subject_type, subject_id, rfq_id, asset_id, metadata)
      SELECT r.tenant_id, auth.uid(), 'asset_view_denied', 'design_asset', p_asset, p_rfq, p_asset, jsonb_build_object('reason', SQLERRM)
        FROM public.rfqs r WHERE r.id = p_rfq;
    RETURN jsonb_build_object('allowed', false, 'reason', SQLERRM);
  END;
  SELECT da.* INTO a FROM public.design_assets da
   WHERE da.id = p_asset AND da.deleted_at IS NULL AND da.classification = 'supplier_preview'
     AND (
       da.design_id IN (SELECT tp.design_id FROM public.rfq_lines rl JOIN public.tech_packs tp ON tp.id = rl.tech_pack_id WHERE rl.rfq_id = p_rfq)
       OR da.id IN (SELECT tp.preview_pdf_asset_id FROM public.rfq_lines rl JOIN public.tech_packs tp ON tp.id = rl.tech_pack_id WHERE rl.rfq_id = p_rfq)
     )
     AND EXISTS (SELECT 1 FROM public.asset_release_grants g JOIN public.rfq_lines rl ON rl.tech_pack_id = g.tech_pack_id AND rl.rfq_id = p_rfq
                  WHERE g.vendor_id = v_inv.vendor_id AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now()));
  IF a.id IS NULL THEN
    PERFORM public.ds__log(v_inv.tenant_id, 'asset_view_denied', 'design_asset', p_asset, p_rfq, p_asset, v_inv.vendor_id);
    RETURN jsonb_build_object('allowed', false, 'reason', 'asset not available');
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT coalesce(display_name, company_name, legal_name) INTO v_vendor_name FROM public.acct_vendors WHERE id = v_inv.vendor_id;
  v_name := v_vendor_name || ' · ' || coalesce(v_email, auth.uid()::text) || ' · ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || 'Z';
  PERFORM public.ds__log(v_inv.tenant_id, 'asset_view_authorized', 'design_asset', a.id, p_rfq, a.id, v_inv.vendor_id);
  RETURN jsonb_build_object('allowed', true, 'bucket', a.bucket, 'path', a.storage_path, 'mime_type', a.mime_type, 'watermark_text', v_name,
                            'tenant_id', a.tenant_id, 'vendor_id', v_inv.vendor_id, 'ttl_seconds', 120);
END $$;

-- Save (create or update) the caller's draft bid. p_payload:
-- {"currency":"USD","valid_until":"2027-01-31","lead_time_days":60,"payment_terms":"30% deposit","incoterm":"FOB","notes":"...",
--  "lines":[{"rfq_line_id":"...","unit_price":12.5,"moq":300,"lead_time_days":55,"sample_cost":40,"tooling_cost":0,"notes":"..."}]}
CREATE OR REPLACE FUNCTION public.supplier_save_bid(p_rfq uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; r public.rfqs; b public.bids; l jsonb; v_role text;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, true);
  SELECT role INTO v_role FROM public.supplier_portal_members WHERE user_id = auth.uid() AND vendor_id = v_inv.vendor_id AND status = 'active';
  IF v_role = 'viewer' THEN RAISE EXCEPTION 'your role cannot edit bids' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  IF r.status <> 'published' OR now() >= r.bid_deadline THEN RAISE EXCEPTION 'bidding is closed' USING ERRCODE = '22023'; END IF;
  IF v_inv.status = 'declined' THEN RAISE EXCEPTION 'you declined this RFQ' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('bid:' || p_rfq::text || v_inv.vendor_id::text, 0));
  PERFORM public.ds__rpc_on();
  SELECT * INTO b FROM public.bids WHERE rfq_id = p_rfq AND vendor_id = v_inv.vendor_id ORDER BY revision DESC LIMIT 1;
  IF b.id IS NULL OR b.status IN ('withdrawn','superseded') THEN
    INSERT INTO public.bids(tenant_id, rfq_id, invitation_id, vendor_id, revision, status, currency)
    VALUES (r.tenant_id, r.id, v_inv.id, v_inv.vendor_id, coalesce(b.revision, 0) + 1, 'draft', r.currency) RETURNING * INTO b;
  ELSIF b.status = 'submitted' THEN
    IF NOT r.allow_bid_revisions THEN RAISE EXCEPTION 'bid already submitted and revisions are not allowed' USING ERRCODE = '22023'; END IF;
    UPDATE public.bids SET status = 'superseded' WHERE id = b.id;
    INSERT INTO public.bids(tenant_id, rfq_id, invitation_id, vendor_id, revision, status, currency)
    VALUES (r.tenant_id, r.id, v_inv.id, v_inv.vendor_id, b.revision + 1, 'draft', r.currency) RETURNING * INTO b;
  ELSIF b.status <> 'draft' THEN
    RAISE EXCEPTION 'bid is % and cannot be edited', b.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.bids SET
    valid_until    = nullif(p_payload ->> 'valid_until', '')::date,
    lead_time_days = nullif(p_payload ->> 'lead_time_days', '')::int,
    payment_terms  = p_payload ->> 'payment_terms',
    incoterm       = coalesce(p_payload ->> 'incoterm', r.incoterm),
    notes          = p_payload ->> 'notes'
  WHERE id = b.id;
  IF jsonb_typeof(p_payload -> 'lines') = 'array' THEN
    FOR l IN SELECT * FROM jsonb_array_elements(p_payload -> 'lines') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.rfq_lines WHERE id = (l ->> 'rfq_line_id')::uuid AND rfq_id = r.id) THEN
        RAISE EXCEPTION 'unknown rfq line %', l ->> 'rfq_line_id' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.bid_lines(tenant_id, bid_id, rfq_line_id, unit_price, moq, lead_time_days, sample_cost, tooling_cost, size_price_overrides, notes)
      VALUES (r.tenant_id, b.id, (l ->> 'rfq_line_id')::uuid, (l ->> 'unit_price')::numeric, nullif(l ->> 'moq','')::int,
              nullif(l ->> 'lead_time_days','')::int, nullif(l ->> 'sample_cost','')::numeric, nullif(l ->> 'tooling_cost','')::numeric,
              coalesce(l -> 'size_price_overrides', '{}'::jsonb), l ->> 'notes')
      ON CONFLICT (bid_id, rfq_line_id) DO UPDATE SET unit_price = excluded.unit_price, moq = excluded.moq, lead_time_days = excluded.lead_time_days,
        sample_cost = excluded.sample_cost, tooling_cost = excluded.tooling_cost, size_price_overrides = excluded.size_price_overrides, notes = excluded.notes;
    END LOOP;
  END IF;
  PERFORM public.ds__log(r.tenant_id, 'bid_saved', 'bid', b.id, r.id, NULL, v_inv.vendor_id);
  RETURN b.id;
END $$;

CREATE OR REPLACE FUNCTION public.supplier_submit_bid(p_bid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE b public.bids; r public.rfqs; v_inv public.rfq_invitations; missing int; m record;
BEGIN
  SELECT * INTO b FROM public.bids WHERE id = p_bid FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'bid not found' USING ERRCODE = 'P0002'; END IF;
  v_inv := public.ds__supplier_rfq_access(b.rfq_id, true);
  IF v_inv.vendor_id <> b.vendor_id THEN RAISE EXCEPTION 'bid not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO r FROM public.rfqs WHERE id = b.rfq_id;
  IF r.status <> 'published' OR now() >= r.bid_deadline THEN RAISE EXCEPTION 'bidding is closed' USING ERRCODE = '22023'; END IF;
  IF b.status <> 'draft' THEN RAISE EXCEPTION 'only a draft bid can be submitted' USING ERRCODE = '22023'; END IF;
  SELECT count(*) INTO missing FROM public.rfq_lines rl WHERE rl.rfq_id = r.id
     AND NOT EXISTS (SELECT 1 FROM public.bid_lines bl WHERE bl.bid_id = b.id AND bl.rfq_line_id = rl.id);
  IF missing > 0 THEN RAISE EXCEPTION 'price every line before submitting (% missing)', missing USING ERRCODE = '23502'; END IF;
  PERFORM public.ds__rpc_on();
  UPDATE public.bids SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now() WHERE id = b.id;
  UPDATE public.rfq_invitations SET status = 'bid_submitted' WHERE id = v_inv.id;
  FOR m IN SELECT user_id FROM public.tenant_memberships WHERE tenant_id = r.tenant_id AND active AND status = 'active' AND lower(role) IN ('owner','admin','manager') LOOP
    PERFORM public.platform_notify(r.tenant_id, m.user_id, 'bid_submitted', 'Bid received on ' || r.rfq_number, NULL, '/studio/rfqs/' || r.id, 'normal', 'rfq', r.id);
  END LOOP;
  PERFORM public.ds__log(r.tenant_id, 'bid_submitted', 'bid', b.id, r.id, NULL, b.vendor_id, jsonb_build_object('revision', b.revision));
END $$;

CREATE OR REPLACE FUNCTION public.supplier_withdraw_bid(p_bid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE b public.bids; r public.rfqs; v_inv public.rfq_invitations;
BEGIN
  SELECT * INTO b FROM public.bids WHERE id = p_bid FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'bid not found' USING ERRCODE = 'P0002'; END IF;
  v_inv := public.ds__supplier_rfq_access(b.rfq_id, true);
  IF v_inv.vendor_id <> b.vendor_id THEN RAISE EXCEPTION 'bid not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO r FROM public.rfqs WHERE id = b.rfq_id;
  IF r.status <> 'published' OR now() >= r.bid_deadline THEN RAISE EXCEPTION 'bidding is closed' USING ERRCODE = '22023'; END IF;
  IF b.status NOT IN ('draft','submitted') THEN RAISE EXCEPTION 'bid is %', b.status USING ERRCODE = '22023'; END IF;
  PERFORM public.ds__rpc_on();
  UPDATE public.bids SET status = 'withdrawn' WHERE id = b.id;
  UPDATE public.rfq_invitations SET status = 'viewed' WHERE id = v_inv.id AND status = 'bid_submitted';
  PERFORM public.ds__log(r.tenant_id, 'bid_withdrawn', 'bid', b.id, r.id, NULL, b.vendor_id);
END $$;

CREATE OR REPLACE FUNCTION public.supplier_ask_question(p_rfq uuid, p_question text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; r public.rfqs; v_id uuid; m record;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, true);
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  IF r.status <> 'published' OR now() >= coalesce(r.questions_deadline, r.bid_deadline) THEN RAISE EXCEPTION 'questions are closed' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.rfq_questions(tenant_id, rfq_id, vendor_id, asked_by, question) VALUES (r.tenant_id, r.id, v_inv.vendor_id, auth.uid(), p_question) RETURNING id INTO v_id;
  FOR m IN SELECT user_id FROM public.tenant_memberships WHERE tenant_id = r.tenant_id AND active AND status = 'active' AND lower(role) IN ('owner','admin','manager') LOOP
    PERFORM public.platform_notify(r.tenant_id, m.user_id, 'rfq_question', 'Supplier question on ' || r.rfq_number, left(p_question, 200), '/studio/rfqs/' || r.id, 'normal', 'rfq', r.id);
  END LOOP;
  PERFORM public.ds__log(r.tenant_id, 'question_asked', 'rfq_question', v_id, r.id, NULL, v_inv.vendor_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.supplier_decline_rfq(p_rfq uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, false);
  PERFORM public.ds__rpc_on();
  UPDATE public.rfq_invitations SET status = 'declined', declined_reason = p_reason WHERE id = v_inv.id AND status IN ('invited','viewed');
  UPDATE public.bids SET status = 'withdrawn' WHERE rfq_id = p_rfq AND vendor_id = v_inv.vendor_id AND status = 'draft';
  PERFORM public.ds__log(v_inv.tenant_id, 'rfq_declined', 'rfq', p_rfq, p_rfq, NULL, v_inv.vendor_id, jsonb_build_object('reason', p_reason));
END $$;

-- Register an upload; returns the storage path the server signs an upload URL for.
CREATE OR REPLACE FUNCTION public.supplier_register_upload(p_rfq uuid, p_file_name text, p_mime text, p_size bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_inv public.rfq_invitations; r public.rfqs; v_id uuid := gen_random_uuid(); v_path text; v_bid uuid;
BEGIN
  v_inv := public.ds__supplier_rfq_access(p_rfq, true);
  SELECT * INTO r FROM public.rfqs WHERE id = p_rfq;
  IF r.status <> 'published' OR now() >= r.bid_deadline THEN RAISE EXCEPTION 'bidding is closed' USING ERRCODE = '22023'; END IF;
  IF p_mime NOT IN ('application/pdf','image/png','image/jpeg','image/webp','text/csv',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') THEN
    RAISE EXCEPTION 'file type not allowed' USING ERRCODE = '22023';
  END IF;
  IF p_size IS NULL OR p_size <= 0 OR p_size > 104857600 THEN RAISE EXCEPTION 'file too large (100 MB max)' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_bid FROM public.bids WHERE rfq_id = p_rfq AND vendor_id = v_inv.vendor_id AND status = 'draft' ORDER BY revision DESC LIMIT 1;
  v_path := r.tenant_id || '/' || r.id || '/' || v_inv.vendor_id || '/' || v_id || '-' || regexp_replace(p_file_name, '[^A-Za-z0-9._-]', '_', 'g');
  INSERT INTO public.rfq_files(id, tenant_id, rfq_id, bid_id, vendor_id, direction, bucket, storage_path, file_name, mime_type, size_bytes)
  VALUES (v_id, r.tenant_id, r.id, v_bid, v_inv.vendor_id, 'from_supplier', 'supplier-uploads', v_path, p_file_name, p_mime, p_size);
  INSERT INTO public.craft_jobs(tenant_id, kind, app, input, subject_type, subject_id, idempotency_key, priority)
  VALUES (r.tenant_id, 'virus_scan', 'clamav', jsonb_build_object('bucket','supplier-uploads','path', v_path, 'rfq_file_id', v_id), 'rfq_file', v_id, 'scan:' || v_id, 10);
  PERFORM public.ds__log(r.tenant_id, 'upload_registered', 'rfq_file', v_id, r.id, NULL, v_inv.vendor_id);
  RETURN jsonb_build_object('rfq_file_id', v_id, 'bucket', 'supplier-uploads', 'path', v_path);
END $$;

-- After award: production pack download (still watermarked per vendor by the worker).
CREATE OR REPLACE FUNCTION public.supplier_authorize_release(p_tech_pack uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE g public.asset_release_grants; tp public.tech_packs;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM public.asset_release_grants
   WHERE tech_pack_id = p_tech_pack AND level = 'production' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
     AND vendor_id IN (SELECT public.ds_my_vendor_ids()) LIMIT 1;
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tech_pack;
  IF g.id IS NULL OR tp.id IS NULL THEN
    IF tp.id IS NOT NULL THEN PERFORM public.ds__log(tp.tenant_id, 'release_download_denied', 'tech_pack', tp.id); END IF;
    RETURN jsonb_build_object('allowed', false, 'reason', 'not released to you');
  END IF;
  PERFORM public.ds__log(tp.tenant_id, 'release_download_authorized', 'tech_pack', tp.id, g.rfq_id, NULL, g.vendor_id);
  RETURN jsonb_build_object('allowed', true, 'tech_pack_id', tp.id, 'vendor_id', g.vendor_id, 'tenant_id', tp.tenant_id, 'revision', tp.revision,
                            'bucket', 'production-releases', 'path', tp.tenant_id || '/' || tp.id || '/' || g.vendor_id || '/techpack-r' || tp.revision || '.pdf');
END $$;

-- =====================================================================
-- L. Worker RPCs (service_role only)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds_claim_jobs(p_worker text, p_kinds text[] DEFAULT NULL, p_limit int DEFAULT 1)
RETURNS SETOF public.craft_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  RETURN QUERY
  UPDATE public.craft_jobs j SET status = 'running', claimed_by = p_worker, claimed_at = now(), heartbeat_at = now(), attempts = j.attempts + 1
   WHERE j.id IN (SELECT id FROM public.craft_jobs
                   WHERE status = 'queued' AND run_after <= now() AND (p_kinds IS NULL OR kind = ANY (p_kinds))
                   ORDER BY priority, run_after FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 20)))
  RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.ds_heartbeat_job(p_job uuid, p_worker text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  UPDATE public.craft_jobs SET heartbeat_at = now() WHERE id = p_job AND claimed_by = p_worker AND status = 'running'
$$;

CREATE OR REPLACE FUNCTION public.ds_finish_job(p_job uuid, p_worker text, p_ok boolean, p_output jsonb DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS public.craft_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE j public.craft_jobs;
BEGIN
  SELECT * INTO j FROM public.craft_jobs WHERE id = p_job AND claimed_by = p_worker AND status = 'running' FOR UPDATE;
  IF j.id IS NULL THEN RAISE EXCEPTION 'job not running for this worker' USING ERRCODE = '22023'; END IF;
  IF p_ok THEN
    UPDATE public.craft_jobs SET status = 'succeeded', output = p_output, finished_at = now(), error = NULL WHERE id = j.id RETURNING * INTO j;
    -- side effects the worker should not have to know about
    IF j.kind = 'techpack_preview_pdf' AND (p_output ->> 'asset_id') IS NOT NULL THEN
      UPDATE public.tech_packs SET preview_pdf_asset_id = (p_output ->> 'asset_id')::uuid WHERE id = j.subject_id;
    ELSIF j.kind = 'techpack_pdf' AND (p_output ->> 'asset_id') IS NOT NULL THEN
      UPDATE public.tech_packs SET pdf_asset_id = (p_output ->> 'asset_id')::uuid WHERE id = j.subject_id;
    ELSIF j.kind = 'virus_scan' THEN
      UPDATE public.rfq_files SET scan_status = CASE WHEN (p_output ->> 'clean')::boolean THEN 'clean' ELSE 'infected' END, sha256 = p_output ->> 'sha256' WHERE id = j.subject_id;
    END IF;
  ELSIF j.attempts >= j.max_attempts THEN
    UPDATE public.craft_jobs SET status = 'failed', error = p_error, finished_at = now() WHERE id = j.id RETURNING * INTO j;
  ELSE
    UPDATE public.craft_jobs SET status = 'queued', error = p_error, claimed_by = NULL, claimed_at = NULL,
           run_after = now() + make_interval(secs => 30 * power(2, j.attempts)) WHERE id = j.id RETURNING * INTO j;
  END IF;
  RETURN j;
END $$;

CREATE OR REPLACE FUNCTION public.ds_reap_stale_jobs(p_stale interval DEFAULT interval '5 minutes') RETURNS int
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  WITH x AS (UPDATE public.craft_jobs SET status = 'queued', claimed_by = NULL, claimed_at = NULL, error = 'worker heartbeat lost'
              WHERE status = 'running' AND heartbeat_at < now() - p_stale AND attempts < max_attempts RETURNING 1)
  SELECT count(*)::int FROM x
$$;

CREATE OR REPLACE FUNCTION public.ds_enqueue_job(p_tenant uuid, p_kind text, p_app text, p_input jsonb, p_subject_type text, p_subject uuid, p_key text, p_priority int DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public.ds__assert_member(p_tenant);
  INSERT INTO public.craft_jobs(tenant_id, kind, app, input, subject_type, subject_id, idempotency_key, priority)
  VALUES (p_tenant, p_kind, p_app, coalesce(p_input,'{}'::jsonb), p_subject_type, p_subject, p_key, p_priority)
  ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- =====================================================================
-- M. Storage buckets + object policies (all private)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('design-private',      'design-private',      false, 524288000, NULL),
  ('supplier-previews',   'supplier-previews',   false, 104857600, ARRAY['image/png','image/jpeg','image/webp','application/pdf','model/gltf-binary','video/mp4']),
  ('supplier-uploads',    'supplier-uploads',    false, 104857600, ARRAY['application/pdf','image/png','image/jpeg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('production-releases', 'production-releases', false, 524288000, ARRAY['application/pdf','application/zip','image/svg+xml','application/dxf','image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS ds_design_private_rw ON storage.objects;
CREATE POLICY ds_design_private_rw ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'design-private' AND public.platform_is_tenant_member(public.ds__path_tenant(name)))
  WITH CHECK (bucket_id = 'design-private' AND public.platform_is_tenant_member(public.ds__path_tenant(name)));
-- staff may read supplier uploads for their tenant; suppliers never touch storage directly
DROP POLICY IF EXISTS ds_supplier_uploads_staff_read ON storage.objects;
CREATE POLICY ds_supplier_uploads_staff_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-uploads' AND public.platform_is_tenant_member(public.ds__path_tenant(name)));
-- supplier-previews and production-releases: no policies => service role only (Next.js proxy + worker)

-- =====================================================================
-- N. RLS registry wiring
-- =====================================================================
-- explicit read-only-for-members tables (writes only via SECURITY DEFINER functions / service role)
INSERT INTO public.platform_table_access_overrides(table_name, access_mode, lifecycle, notes) VALUES
  ('design_versions',      'tenant_read', 'active', 'S600: write via ds_create_design_version'),
  ('tech_pack_revisions',  'tenant_read', 'log',    'S600: written by ds_transition_tech_pack'),
  ('ds_nda_acceptances',   'tenant_read', 'log',    'S600: written by supplier_accept_nda'),
  ('ds_access_events',     'tenant_read', 'log',    'S600: append-only audit'),
  ('rfq_invitations',      'tenant_read', 'active', 'S600: write via ds_invite_vendor_to_rfq / supplier_*'),
  ('rfq_awards',           'tenant_read', 'active', 'S600: write via ds_award_rfq'),
  ('rfq_files',            'tenant_read', 'active', 'S600: write via supplier_register_upload / server'),
  ('asset_release_grants', 'tenant_read', 'active', 'S600: write via ds_* functions'),
  ('craft_jobs',           'tenant_read', 'active', 'S600: write via ds_enqueue_job, worker uses service role'),
  ('rfq_questions',        'tenant_read', 'active', 'S600: write via supplier_ask_question / ds_answer_question'),
  ('ds_ndas',              'tenant_admin','active', 'S600: owners/admins author NDAs'),
  ('supplier_portal_members','tenant_read','active','S600: write via ds_invite_supplier_user / supplier_accept_invite')
ON CONFLICT (table_name) DO UPDATE SET access_mode = excluded.access_mode, lifecycle = excluded.lifecycle, notes = excluded.notes;

-- Sealed bids: our own policies (registry keeps them because these tables stay 'inferred').
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ds_bids_staff_read ON public.bids;
CREATE POLICY ds_bids_staff_read ON public.bids FOR SELECT TO authenticated
  USING (public.platform_is_tenant_member(tenant_id) AND status <> 'draft' AND public.ds_rfq_unsealed(rfq_id));
DROP POLICY IF EXISTS ds_bid_lines_staff_read ON public.bid_lines;
CREATE POLICY ds_bid_lines_staff_read ON public.bid_lines FOR SELECT TO authenticated
  USING (public.platform_is_tenant_member(tenant_id) AND EXISTS (
    SELECT 1 FROM public.bids b WHERE b.id = bid_lines.bid_id AND b.status <> 'draft' AND public.ds_rfq_unsealed(b.rfq_id)));
DROP POLICY IF EXISTS ds_bid_eval_staff_rw ON public.bid_evaluations;
CREATE POLICY ds_bid_eval_staff_rw ON public.bid_evaluations FOR ALL TO authenticated
  USING (public.platform_is_tenant_member(tenant_id) AND evaluator_id = auth.uid())
  WITH CHECK (public.platform_is_tenant_member(tenant_id) AND evaluator_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_evaluations.bid_id AND public.ds_rfq_unsealed(b.rfq_id)));
DROP POLICY IF EXISTS ds_bid_eval_staff_read_all ON public.bid_evaluations;
CREATE POLICY ds_bid_eval_staff_read_all ON public.bid_evaluations FOR SELECT TO authenticated
  USING (public.platform_is_tenant_member(tenant_id));
-- no INSERT/UPDATE/DELETE policies on bids / bid_lines: only supplier_* functions write them

SELECT count(*) AS tables_secured FROM public.platform__apply_app_security();

-- =====================================================================
-- O. Grants: functions are not callable by anon; worker functions service_role only
-- =====================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND (p.proname LIKE 'ds\_%' OR p.proname LIKE 'supplier\_%') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    IF f.proname IN ('ds_claim_jobs','ds_heartbeat_job','ds_finish_job','ds_reap_stale_jobs','ds_close_due_rfqs') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    ELSIF f.proname LIKE 'ds\_\_%' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);   -- internal helpers
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    END IF;
  END LOOP;
END $$;
-- helpers referenced inside RLS policies must stay executable by authenticated
GRANT EXECUTE ON FUNCTION public.ds_rfq_unsealed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ds__path_tenant(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ds_my_vendor_ids() TO authenticated;

DO $$ BEGIN IF to_regprocedure('unify.done(text)') IS NOT NULL THEN PERFORM unify.done('600'); END IF; END $$;
COMMIT;

-- pg_cron (run once, outside the transaction, if pg_cron is enabled):
-- SELECT cron.schedule('ds_close_due_rfqs', '* * * * *', $$SELECT public.ds_close_due_rfqs()$$);
-- SELECT cron.schedule('ds_reap_stale_jobs', '*/2 * * * *', $$SELECT public.ds_reap_stale_jobs()$$);
