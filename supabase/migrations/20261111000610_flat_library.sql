-- =====================================================================
-- S610_flat_library.sql — flat library + license guard (canonical step 610, domain 06)
--
-- T10b. Spec: plan/08_FLAT_LIBRARY.md §S610. Follows the S605 pattern:
-- register ('610','ds3','S610_flat_library.sql',17) in unify.step_order,
-- move 900 to pos 18, unify.require('610') ... unify.done('610'),
-- idempotent, single transaction.
--
-- What lands here:
--   * ds_asset_licenses (admin mode: owners/admins write, members read)
--   * design_assets.license_id; ds_garment_templates.license_id, block,
--     style_options, generator_version, license_scope
--   * ds_flat_import_batches + ds_flat_pieces (T10c import tables)
--   * Guards: supplier previews / production releases may not derive from a
--     license that forbids supplier viewing (or an expired one); raw flat
--     pieces are never supplier-viewable.
--   * ds_publish_rfq redefined (S600 body + license check, DS_LICENSE_BLOCKED)
--   * supplier_authorize_asset_view / supplier_authorize_release redefined
--     with the same license check (deny + log, allowed:false)
--   * Printful back-fill (ds__s610_backfill_printful)
--
-- DEVIATION (documented, forced by Postgres): plan/08 calls
-- ds_garment_templates.license_scope a GENERATED column "from the license".
-- A GENERATED column may only reference the row's own columns, never another
-- table, so license_scope is a trigger-maintained text column instead:
-- ds__sync_template_license_scope() sets it on INSERT/UPDATE OF license_id,
-- and an AFTER UPDATE trigger on ds_asset_licenses refreshes dependent
-- templates when a license_type changes. Same values, same CHECK.
-- =====================================================================
\set ON_ERROR_STOP on
DO $guard$ BEGIN
  IF to_regclass('public.platform_table_registry') IS NULL
     OR to_regprocedure('public.platform__apply_app_security()') IS NULL
     OR to_regclass('public.ds_garment_templates') IS NULL
     OR to_regclass('public.design_assets') IS NULL THEN
    RAISE EXCEPTION 'S610: baseline + S600 missing (registry, templates or assets). Run the baseline + S590 + S600 + S605 first.';
  END IF;
  IF to_regprocedure('unify.require(text)') IS NOT NULL THEN PERFORM unify.require('610'); END IF;
END $guard$;

BEGIN;

-- step ledger (unify) ---------------------------------------------------
DO $$ BEGIN
  IF to_regclass('unify.step_order') IS NOT NULL THEN
    INSERT INTO unify.step_order(step, label, file, pos) VALUES ('610','ds3','S610_flat_library.sql',17)
    ON CONFLICT (step) DO UPDATE SET label = excluded.label, file = excluded.file, pos = excluded.pos;
    UPDATE unify.step_order SET pos = 18 WHERE step = '900';
    PERFORM unify.require('610');
  END IF;
END $$;

-- =====================================================================
-- A. License table (admin mode)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ds_asset_licenses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source                 text NOT NULL CHECK (source IN ('generated','vecfashion','fashiondesign411','opentechpack','printful','other')),
  license_type           text NOT NULL CHECK (license_type IN ('owned','open_source','licensed_commercial','vendor_restricted')),
  license_name           text,
  license_url            text,
  proof_asset_id         uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  allow_supplier_view    boolean NOT NULL,
  allow_redistribution   boolean NOT NULL DEFAULT false,
  restricted_to_vendor_id uuid REFERENCES public.acct_vendors(id) ON DELETE SET NULL,
  acquired_at            timestamptz,
  expires_at             timestamptz,
  notes                  text,
  created_by             uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (license_type <> 'vendor_restricted' OR (restricted_to_vendor_id IS NOT NULL AND allow_supplier_view = false)),
  CHECK (license_type <> 'owned' OR source = 'generated'),
  CHECK (license_type = 'owned' OR license_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ds_asset_licenses_tenant_idx ON public.ds_asset_licenses (tenant_id);
DROP TRIGGER IF EXISTS trg_ds_asset_licenses_updated_at ON public.ds_asset_licenses;
CREATE TRIGGER trg_ds_asset_licenses_updated_at BEFORE UPDATE ON public.ds_asset_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- B. Column adds
-- =====================================================================
ALTER TABLE public.design_assets
  ADD COLUMN IF NOT EXISTS license_id uuid REFERENCES public.ds_asset_licenses(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS design_assets_license_idx ON public.design_assets (license_id);

ALTER TABLE public.ds_garment_templates
  ADD COLUMN IF NOT EXISTS license_id        uuid REFERENCES public.ds_asset_licenses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS block             jsonb,
  ADD COLUMN IF NOT EXISTS style_options     jsonb,
  ADD COLUMN IF NOT EXISTS generator_version text,
  ADD COLUMN IF NOT EXISTS license_scope     text NOT NULL DEFAULT 'unlicensed'
    CHECK (license_scope IN ('owned','licensed','printful_only','unlicensed'));
CREATE INDEX IF NOT EXISTS ds_garment_templates_license_idx ON public.ds_garment_templates (license_id);

-- =====================================================================
-- C. License helpers (SECURITY DEFINER; ds__* = internal, service role)
-- =====================================================================
-- Effective supplier-viewability of one license row. An expiry in the past
-- behaves as allow_supplier_view = false (plan/08 rule 5).
CREATE OR REPLACE FUNCTION public.ds__license_viewable(p_license uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT coalesce(bool_and(l.allow_supplier_view AND (l.expires_at IS NULL OR l.expires_at > now())), false)
    FROM public.ds_asset_licenses l WHERE l.id = p_license
$$;

-- Scope string for a license id (used by the template sync trigger).
CREATE OR REPLACE FUNCTION public.ds__license_scope_for(p_license uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT CASE
    WHEN p_license IS NULL OR l.id IS NULL THEN 'unlicensed'
    WHEN l.license_type = 'owned' THEN 'owned'
    WHEN l.license_type = 'vendor_restricted' THEN 'printful_only'
    ELSE 'licensed' END
  FROM (SELECT 1) x LEFT JOIN public.ds_asset_licenses l ON l.id = p_license
$$;

-- Is this asset (and everything it was derived from) supplier-viewable?
-- Raw flat pieces from an import batch are never supplier-viewable.
CREATE OR REPLACE FUNCTION public.ds__asset_license_viewable(p_asset uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE a public.design_assets; v_id uuid; hops int := 0;
BEGIN
  SELECT * INTO a FROM public.design_assets WHERE id = p_asset;
  IF a.id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.ds_flat_pieces WHERE svg_asset_id = p_asset) THEN RETURN false; END IF;
  IF a.license_id IS NOT NULL AND NOT public.ds__license_viewable(a.license_id) THEN RETURN false; END IF;
  v_id := a.derived_from_asset_id;
  WHILE v_id IS NOT NULL AND hops < 16 LOOP
    SELECT * INTO a FROM public.design_assets WHERE id = v_id;
    IF a.id IS NULL THEN EXIT; END IF;
    IF EXISTS (SELECT 1 FROM public.ds_flat_pieces WHERE svg_asset_id = v_id) THEN RETURN false; END IF;
    IF a.license_id IS NOT NULL AND NOT public.ds__license_viewable(a.license_id) THEN RETURN false; END IF;
    v_id := a.derived_from_asset_id;
    hops := hops + 1;
  END LOOP;
  RETURN true;
END $$;

-- Keep ds_garment_templates.license_scope in step with its license.
CREATE OR REPLACE FUNCTION public.ds__sync_template_license_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  NEW.license_scope := public.ds__license_scope_for(NEW.license_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gt_license_scope ON public.ds_garment_templates;
CREATE TRIGGER trg_gt_license_scope BEFORE INSERT OR UPDATE OF license_id ON public.ds_garment_templates
  FOR EACH ROW EXECUTE FUNCTION public.ds__sync_template_license_scope();

-- When a license_type changes, refresh every template that points at it.
CREATE OR REPLACE FUNCTION public.ds__refresh_template_scopes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  UPDATE public.ds_garment_templates
     SET license_scope = public.ds__license_scope_for(license_id)
   WHERE license_id = NEW.id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_lic_refresh_templates ON public.ds_asset_licenses;
CREATE TRIGGER trg_lic_refresh_templates AFTER UPDATE OF license_type ON public.ds_asset_licenses
  FOR EACH ROW EXECUTE FUNCTION public.ds__refresh_template_scopes();

-- Back-fill scopes for templates that predate the column.
UPDATE public.ds_garment_templates
   SET license_scope = public.ds__license_scope_for(license_id);

-- =====================================================================
-- D. Import tables (T10c splitter input; S610 specifies them now)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ds_flat_import_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_asset_id   uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  license_id        uuid NOT NULL REFERENCES public.ds_asset_licenses(id) ON DELETE RESTRICT,
  source_category   text,
  status            text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','splitting','review','done','failed')),
  strategy          text CHECK (strategy IS NULL OR strategy IN ('artboard','layer','group','cluster')),
  piece_count       int NOT NULL DEFAULT 0 CHECK (piece_count >= 0),
  error             text,
  created_by        uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ds_flat_import_batches_tenant_idx ON public.ds_flat_import_batches (tenant_id);
DROP TRIGGER IF EXISTS trg_ds_flat_import_batches_updated_at ON public.ds_flat_import_batches;
CREATE TRIGGER trg_ds_flat_import_batches_updated_at BEFORE UPDATE ON public.ds_flat_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fib_tenant ON public.ds_flat_import_batches;
CREATE TRIGGER trg_fib_tenant BEFORE INSERT OR UPDATE ON public.ds_flat_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('design_assets','source_asset_id');

CREATE TABLE IF NOT EXISTS public.ds_flat_pieces (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id           uuid NOT NULL REFERENCES public.ds_flat_import_batches(id) ON DELETE CASCADE,
  source_ref         text,
  bbox               jsonb,
  view               text CHECK (view IS NULL OR view IN ('front','back','side','detail')),
  category           text,
  pair_key           text,
  scale_mm_per_unit  numeric,
  svg_asset_id       uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected','merged')),
  template_id        uuid REFERENCES public.ds_garment_templates(id) ON DELETE SET NULL,
  reviewed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ds_flat_pieces_batch_idx ON public.ds_flat_pieces (batch_id);
CREATE INDEX IF NOT EXISTS ds_flat_pieces_template_idx ON public.ds_flat_pieces (template_id);
DROP TRIGGER IF EXISTS trg_ds_flat_pieces_updated_at ON public.ds_flat_pieces;
CREATE TRIGGER trg_ds_flat_pieces_updated_at BEFORE UPDATE ON public.ds_flat_pieces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fp_tenant ON public.ds_flat_pieces;
CREATE TRIGGER trg_fp_tenant BEFORE INSERT OR UPDATE ON public.ds_flat_pieces
  FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant('ds_flat_import_batches','batch_id');

-- Piece guard: a piece asset must carry its batch's license, and an
-- accepted piece needs category, view, scale and a reviewer (plan/08).
CREATE OR REPLACE FUNCTION public.ds__flat_piece_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_batch_lic uuid; v_asset_lic uuid;
BEGIN
  SELECT license_id INTO v_batch_lic FROM public.ds_flat_import_batches WHERE id = NEW.batch_id;
  IF NEW.svg_asset_id IS NOT NULL THEN
    SELECT license_id INTO v_asset_lic FROM public.design_assets WHERE id = NEW.svg_asset_id;
    IF v_asset_lic IS DISTINCT FROM v_batch_lic THEN
      RAISE EXCEPTION 'split piece asset license must match its batch license' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.status = 'accepted' AND (NEW.category IS NULL OR NEW.view IS NULL
      OR NEW.scale_mm_per_unit IS NULL OR NEW.reviewed_by IS NULL) THEN
    RAISE EXCEPTION 'accepted pieces need category, view, scale and a reviewer' USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fp_guard ON public.ds_flat_pieces;
CREATE TRIGGER trg_fp_guard BEFORE INSERT OR UPDATE ON public.ds_flat_pieces
  FOR EACH ROW EXECUTE FUNCTION public.ds__flat_piece_guard();

-- =====================================================================
-- E. Asset classification guard (plan/08 rule 1)
-- =====================================================================
-- Inserting/updating a design_assets row with classification
-- supplier_preview / production_release fails if the asset or anything in
-- its derived_from chain links to a license that forbids supplier viewing
-- (or is expired). Unlicensed assets pass here; the RFQ publish step is
-- what blocks unlicensed / printful_only templates.
CREATE OR REPLACE FUNCTION public.ds__asset_license_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id uuid := NEW.derived_from_asset_id; hops int := 0;
        v_lic uuid; v_next uuid;
BEGIN
  IF NEW.classification NOT IN ('supplier_preview','production_release') THEN RETURN NEW; END IF;
  IF NEW.license_id IS NOT NULL AND NOT public.ds__license_viewable(NEW.license_id) THEN
    RAISE EXCEPTION 'DS_LICENSE_BLOCKED: this asset''s license does not allow supplier use' USING ERRCODE = '23514';
  END IF;
  WHILE v_id IS NOT NULL AND hops < 16 LOOP
    SELECT license_id, derived_from_asset_id INTO v_lic, v_next FROM public.design_assets WHERE id = v_id;
    IF NOT FOUND THEN EXIT; END IF;
    IF v_lic IS NOT NULL AND NOT public.ds__license_viewable(v_lic) THEN
      RAISE EXCEPTION 'DS_LICENSE_BLOCKED: a source asset''s license does not allow supplier use' USING ERRCODE = '23514';
    END IF;
    v_id := v_next;
    hops := hops + 1;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_da_license_guard ON public.design_assets;
CREATE TRIGGER trg_da_license_guard BEFORE INSERT OR UPDATE OF classification, derived_from_asset_id, license_id
  ON public.design_assets FOR EACH ROW EXECUTE FUNCTION public.ds__asset_license_guard();

-- =====================================================================
-- F. ds_publish_rfq — S600 body + license check (plan/08 rule 2)
--    Redefined here (never edit S600 in place). CREATE OR REPLACE keeps
--    the S600 grants. DS_LICENSE_BLOCKED is carried in the message text
--    (a SQLSTATE must be 5 chars; the check violation code is 23514).
-- =====================================================================
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
  -- S610: a line whose design's garment template is printful_only or
  -- unlicensed cannot be published (DS_LICENSE_BLOCKED). A design with no
  -- garment template at all is unaffected (pre-S610 behaviour, S600 tests).
  SELECT count(*) INTO bad FROM public.rfq_lines rl
    JOIN public.tech_packs tp ON tp.id = rl.tech_pack_id
    JOIN public.designs d ON d.id = tp.design_id
    JOIN public.ds_garment_templates gt ON gt.id = d.garment_template_id
   WHERE rl.rfq_id = r.id AND gt.license_scope IN ('printful_only','unlicensed');
  IF bad > 0 THEN RAISE EXCEPTION 'DS_LICENSE_BLOCKED: % line(s) use a garment template that is not cleared for supplier RFQs (printful_only or unlicensed)', bad USING ERRCODE = '23514'; END IF;
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

-- =====================================================================
-- G. Supplier authorize RPCs — S600 bodies + license checks (rule 3)
-- =====================================================================
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
  -- S610: the asset (or anything it derives from) must be supplier-viewable
  -- under its license. Raw flat pieces are never viewable.
  IF NOT public.ds__asset_license_viewable(a.id) THEN
    PERFORM public.ds__log(v_inv.tenant_id, 'asset_view_denied', 'design_asset', a.id, p_rfq, a.id, v_inv.vendor_id,
                           jsonb_build_object('reason', 'DS_LICENSE_BLOCKED'));
    RETURN jsonb_build_object('allowed', false, 'reason', 'DS_LICENSE_BLOCKED: asset license does not allow supplier viewing');
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT coalesce(display_name, company_name, legal_name) INTO v_vendor_name FROM public.acct_vendors WHERE id = v_inv.vendor_id;
  v_name := v_vendor_name || ' · ' || coalesce(v_email, auth.uid()::text) || ' · ' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || 'Z';
  PERFORM public.ds__log(v_inv.tenant_id, 'asset_view_authorized', 'design_asset', a.id, p_rfq, a.id, v_inv.vendor_id);
  RETURN jsonb_build_object('allowed', true, 'bucket', a.bucket, 'path', a.storage_path, 'mime_type', a.mime_type, 'watermark_text', v_name,
                            'tenant_id', a.tenant_id, 'vendor_id', v_inv.vendor_id, 'ttl_seconds', 120);
END $$;

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
  -- S610: a production release of a printful_only / unlicensed template is denied.
  IF tp.design_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.designs d JOIN public.ds_garment_templates gt ON gt.id = d.garment_template_id
     WHERE d.id = tp.design_id AND gt.license_scope IN ('printful_only','unlicensed')) THEN
    PERFORM public.ds__log(tp.tenant_id, 'release_download_denied', 'tech_pack', tp.id, NULL, NULL, g.vendor_id,
                           jsonb_build_object('reason', 'DS_LICENSE_BLOCKED'));
    RETURN jsonb_build_object('allowed', false, 'reason', 'DS_LICENSE_BLOCKED: garment template is not cleared for production release');
  END IF;
  PERFORM public.ds__log(tp.tenant_id, 'release_download_authorized', 'tech_pack', tp.id, g.rfq_id, NULL, g.vendor_id);
  RETURN jsonb_build_object('allowed', true, 'tech_pack_id', tp.id, 'vendor_id', g.vendor_id, 'tenant_id', tp.tenant_id, 'revision', tp.revision,
                            'bucket', 'production-releases', 'path', tp.tenant_id || '/' || tp.id || '/' || g.vendor_id || '/techpack-r' || tp.revision || '.pdf');
END $$;

-- =====================================================================
-- H. Printful back-fill (plan/08 rule 4)
--    Every existing Printful import gets one vendor_restricted license row
--    (linked to the Printful vendor row) and its assets/templates point
--    at it. No-op when no Printful vendor row exists (e.g. test DBs).
--    Re-runnable; safe to call again after new Printful imports land.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds__s610_backfill_printful() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_rec record; v_lic uuid; n int := 0; m int;
BEGIN
  -- one license per (tenant, Printful vendor); re-runnable, no duplicates.
  FOR v_rec IN SELECT id, tenant_id FROM public.acct_vendors
                WHERE legal_name ILIKE '%printful%' OR vendor_number ILIKE '%printful%' LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ds_asset_licenses
                    WHERE source = 'printful' AND license_type = 'vendor_restricted'
                      AND restricted_to_vendor_id = v_rec.id) THEN
      INSERT INTO public.ds_asset_licenses(tenant_id, source, license_type, license_name, license_url,
          allow_supplier_view, allow_redistribution, restricted_to_vendor_id, notes)
        VALUES (v_rec.tenant_id, 'printful', 'vendor_restricted', 'Printful ToS',
          'https://www.printful.com/policies/download/terms-of-service',
          false, false, v_rec.id, 'S610 back-fill: Printful mockup imports');
    END IF;
    SELECT id INTO v_lic FROM public.ds_asset_licenses
     WHERE source = 'printful' AND license_type = 'vendor_restricted' AND restricted_to_vendor_id = v_rec.id
     ORDER BY created_at LIMIT 1;
    IF v_lic IS NULL THEN CONTINUE; END IF;
    UPDATE public.design_assets SET license_id = v_lic
     WHERE provider = 'printful' AND tenant_id = v_rec.tenant_id AND license_id IS DISTINCT FROM v_lic;
    GET DIAGNOSTICS m = ROW_COUNT;
    n := n + m;
    UPDATE public.ds_garment_templates gt SET license_id = v_lic
     WHERE gt.tenant_id = v_rec.tenant_id
       AND gt.flat_sketch_asset_id IN (SELECT id FROM public.design_assets WHERE license_id = v_lic)
       AND gt.license_id IS DISTINCT FROM v_lic;
  END LOOP;
  RETURN n;
END $$;
SELECT public.ds__s610_backfill_printful();

-- =====================================================================
-- I. RLS registry wiring
-- =====================================================================
INSERT INTO public.platform_table_access_overrides(table_name, access_mode, lifecycle, notes) VALUES
  ('ds_asset_licenses', 'tenant_admin', 'active', 'S610: owners/admins write licenses, members read')
ON CONFLICT (table_name) DO UPDATE SET access_mode = excluded.access_mode, lifecycle = excluded.lifecycle, notes = excluded.notes;

SELECT count(*) AS tables_secured FROM public.platform__apply_app_security();

-- =====================================================================
-- J. Grants (mirror the S600 loop for the new functions)
-- =====================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('ds__license_viewable','ds__license_scope_for','ds__asset_license_viewable',
                                'ds__sync_template_license_scope','ds__refresh_template_scopes',
                                'ds__flat_piece_guard','ds__asset_license_guard','ds__s610_backfill_printful') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.ds__license_scope_for(uuid) TO authenticated;

DO $$ BEGIN IF to_regprocedure('unify.done(text)') IS NOT NULL THEN PERFORM unify.done('610'); END IF; END $$;
COMMIT;
