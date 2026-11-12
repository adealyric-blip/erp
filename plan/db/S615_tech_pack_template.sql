-- =====================================================================
-- S615_tech_pack_template.sql — 11-page tech pack template + S615 tables
-- (canonical step 615, domain ds4)
--
-- T13b. Spec: plan/09_TECH_PACK_TEMPLATE.md §S615. Follows the S605/S610
-- pattern: register ('615','ds4','S615_tech_pack_template.sql',18) in
-- unify.step_order, move 900 to pos 19, unify.require('615') ...
-- unify.done('615'), idempotent, single transaction.
--
-- What lands here:
--   * Column adds: tech_packs (description, designer_id,
--     reference_asset_ids, measure_unit, template_id);
--     tech_pack_bom_lines.is_main_fabric (one per pack, partial unique);
--     tech_pack_construction callout anchors (callout_no, view,
--     anchor_x/y, label_x/y, normalized 0..1);
--     tech_pack_measurements.grade (per-size increment, GRADE column).
--   * New tables: ds_tech_pack_templates (admin mode, one default per
--     tenant), tech_pack_pom_markers, tech_pack_colorway_components,
--     tech_pack_labels, tech_pack_hangtags, tech_pack_packaging (one/pack).
--   * Guards: fibre % sums to 100; UPC-A/EAN-13 check digit; carton size
--     ratio sizes exist in the pack's size range and sum to
--     units_per_carton; colorway must belong to the pack's design;
--     fold_steps <= 4; all new child tables get the S600
--     ds__tp_child_guard lock (nothing changes once approved).
--   * ds_tech_pack_snapshot redefined (+ header, pom_markers,
--     colorway_components, labels, hangtags, packaging, template; every
--     S600 key unchanged) and ds_tech_pack_supplier_snapshot (same JSON
--     with bom[].unit_cost / bom[].supplier_note stripped).
--   * ds_create_tech_pack redefined to clone the new children (BOM clone
--     keeps an old->new id map so colorway_components re-point).
--
-- DEVIATION (documented): the spec says the template table is "seeded
-- with the files in this folder". Template rows are per-tenant, so no
-- migration can seed them; the SVG masters are seeded into the repo at
-- src/lib/techpack-render/templates/*.svg and the library page creates
-- the tenant's default template row on first visit (server action
-- ensureDefaultTechPackTemplate). No tenant row is invented here.
-- =====================================================================
\set ON_ERROR_STOP on
DO $guard$ BEGIN
  IF to_regclass('public.platform_table_registry') IS NULL
     OR to_regprocedure('public.platform__apply_app_security()') IS NULL
     OR to_regclass('public.tech_packs') IS NULL
     OR to_regclass('public.tech_pack_bom_lines') IS NULL THEN
    RAISE EXCEPTION 'S615: baseline + S600 missing (registry or tech pack tables). Run baseline + S590 + S600 + S605 + S610 first.';
  END IF;
  IF to_regprocedure('unify.require(text)') IS NOT NULL THEN PERFORM unify.require('615'); END IF;
END $guard$;

BEGIN;

-- step ledger (unify) ---------------------------------------------------
DO $$ BEGIN
  IF to_regclass('unify.step_order') IS NOT NULL THEN
    INSERT INTO unify.step_order(step, label, file, pos) VALUES ('615','ds4','S615_tech_pack_template.sql',18)
    ON CONFLICT (step) DO UPDATE SET label = excluded.label, file = excluded.file, pos = excluded.pos;
    UPDATE unify.step_order SET pos = 19 WHERE step = '900';
    PERFORM unify.require('615');
  END IF;
END $$;

-- =====================================================================
-- A. ds_tech_pack_templates (admin mode: owners/admins author templates)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ds_tech_pack_templates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name               text NOT NULL,
  version            int NOT NULL DEFAULT 1 CHECK (version > 0),
  page_svg_asset_ids jsonb NOT NULL DEFAULT '{}'::jsonb,  -- page id -> design_asset id
  pages              text[] NOT NULL DEFAULT ARRAY['sketch','construction','measurement_guide','measurement_chart','bom','materials','colorways','artwork','labels','hangtag','packaging'],
  is_default         boolean NOT NULL DEFAULT false,
  created_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ds_tech_pack_templates_tenant_idx ON public.ds_tech_pack_templates (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS ds_tech_pack_templates_one_default_idx
  ON public.ds_tech_pack_templates (tenant_id) WHERE is_default;
DROP TRIGGER IF EXISTS trg_ds_tech_pack_templates_updated_at ON public.ds_tech_pack_templates;
CREATE TRIGGER trg_ds_tech_pack_templates_updated_at BEFORE UPDATE ON public.ds_tech_pack_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- B. Column adds
-- =====================================================================
ALTER TABLE public.tech_packs
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS designer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference_asset_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS measure_unit text NOT NULL DEFAULT 'cm' CHECK (measure_unit IN ('cm','in')),
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.ds_tech_pack_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tech_packs_template_idx ON public.tech_packs (template_id);

ALTER TABLE public.tech_pack_bom_lines
  ADD COLUMN IF NOT EXISTS is_main_fabric boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS tp_bom_one_main_fabric_idx
  ON public.tech_pack_bom_lines (tech_pack_id) WHERE is_main_fabric;

ALTER TABLE public.tech_pack_construction
  ADD COLUMN IF NOT EXISTS callout_no int CHECK (callout_no IS NULL OR callout_no > 0),
  ADD COLUMN IF NOT EXISTS view text CHECK (view IS NULL OR view IN ('front','back','side','detail')),
  ADD COLUMN IF NOT EXISTS anchor_x numeric CHECK (anchor_x IS NULL OR (anchor_x >= 0 AND anchor_x <= 1)),
  ADD COLUMN IF NOT EXISTS anchor_y numeric CHECK (anchor_y IS NULL OR (anchor_y >= 0 AND anchor_y <= 1)),
  ADD COLUMN IF NOT EXISTS label_x numeric CHECK (label_x IS NULL OR (label_x >= 0 AND label_x <= 1)),
  ADD COLUMN IF NOT EXISTS label_y numeric CHECK (label_y IS NULL OR (label_y >= 0 AND label_y <= 1));
CREATE UNIQUE INDEX IF NOT EXISTS tp_construction_callout_no_idx
  ON public.tech_pack_construction (tech_pack_id, callout_no) WHERE callout_no IS NOT NULL;

ALTER TABLE public.tech_pack_measurements
  ADD COLUMN IF NOT EXISTS grade numeric(8,2);

-- =====================================================================
-- C. New child tables (tenant_id NOT NULL, tp_child_guard lock, updated_at)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tech_pack_pom_markers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  pom_id       uuid NOT NULL REFERENCES public.ds_pom_library(id) ON DELETE RESTRICT,
  view         text NOT NULL DEFAULT 'front' CHECK (view IN ('front','back','side','detail')),
  x1           numeric NOT NULL CHECK (x1 >= 0 AND x1 <= 1),
  y1           numeric NOT NULL CHECK (y1 >= 0 AND y1 <= 1),
  x2           numeric NOT NULL CHECK (x2 >= 0 AND x2 <= 1),
  y2           numeric NOT NULL CHECK (y2 >= 0 AND y2 <= 1),
  label_x      numeric CHECK (label_x IS NULL OR (label_x >= 0 AND label_x <= 1)),
  label_y      numeric CHECK (label_y IS NULL OR (label_y >= 0 AND label_y <= 1)),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tech_pack_id, pom_id, view)
);
CREATE INDEX IF NOT EXISTS tp_pom_markers_tp_idx ON public.tech_pack_pom_markers (tech_pack_id);

CREATE TABLE IF NOT EXISTS public.tech_pack_colorway_components (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  colorway_id  uuid NOT NULL REFERENCES public.design_colorways(id) ON DELETE RESTRICT,
  bom_line_id  uuid NOT NULL REFERENCES public.tech_pack_bom_lines(id) ON DELETE CASCADE,
  color_name   text,
  pantone      text,
  hex          text CHECK (hex IS NULL OR hex ~ '^#[0-9A-Fa-f]{6}$'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tech_pack_id, colorway_id, bom_line_id)
);
CREATE INDEX IF NOT EXISTS tp_cwc_tp_idx ON public.tech_pack_colorway_components (tech_pack_id);

CREATE TABLE IF NOT EXISTS public.tech_pack_labels (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id     uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('main','size','care','content','flag','extra')),
  label_type       text CHECK (label_type IS NULL OR label_type IN ('woven','printed','heat_transfer','satin','leather','patch','other')),
  material_id      uuid REFERENCES public.ds_materials(id) ON DELETE SET NULL,
  width_mm         numeric(8,2) CHECK (width_mm IS NULL OR width_mm > 0),
  height_mm        numeric(8,2) CHECK (height_mm IS NULL OR height_mm > 0),
  color            text,
  attachment       text CHECK (attachment IS NULL OR attachment IN ('sewn_in_seam','sewn_4_sides','loop','heat_seal','other')),
  placement        text,
  text             text,
  fibre_content    jsonb,  -- [{fibre, pct}] — pct must sum to 100 when present
  country_of_origin char(2),
  care_symbols     text[] NOT NULL DEFAULT '{}',  -- ISO 3758 codes
  artwork_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  sort             int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tp_labels_tp_idx ON public.tech_pack_labels (tech_pack_id, sort);

CREATE TABLE IF NOT EXISTS public.tech_pack_hangtags (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id   uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE,
  front_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  back_asset_id  uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  width_mm       numeric(8,2) CHECK (width_mm IS NULL OR width_mm > 0),
  height_mm      numeric(8,2) CHECK (height_mm IS NULL OR height_mm > 0),
  shape          text,
  stock          text,
  gsm            numeric(8,2) CHECK (gsm IS NULL OR gsm > 0),
  print          text,
  finish         text,
  eyelet         text,
  fastener       text,
  fastener_color text,
  placement      text,
  barcode_type   text CHECK (barcode_type IS NULL OR barcode_type IN ('upc_a','ean_13','code_128','qr')),
  barcode_value  text,
  retail_price   numeric(18,4) CHECK (retail_price IS NULL OR retail_price >= 0),
  currency       char(3),
  vendor_id      uuid REFERENCES public.acct_vendors(id) ON DELETE SET NULL,
  material_id    uuid REFERENCES public.ds_materials(id) ON DELETE SET NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tp_hangtags_tp_idx ON public.tech_pack_hangtags (tech_pack_id);

CREATE TABLE IF NOT EXISTS public.tech_pack_packaging (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tech_pack_id     uuid NOT NULL REFERENCES public.tech_packs(id) ON DELETE CASCADE UNIQUE,  -- one per pack
  fold_steps       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- <= 4 x {asset_id, text}
  polybag_size_mm  text,
  polybag_thickness_micron int CHECK (polybag_thickness_micron IS NULL OR polybag_thickness_micron > 0),
  polybag_material text,
  polybag_closure  text,
  polybag_warning  text,
  polybag_print    text,
  polybag_sticker  text,
  polybag_units    int CHECK (polybag_units IS NULL OR polybag_units > 0),
  carton_size_mm   text,
  carton_ply       int CHECK (carton_ply IS NULL OR carton_ply > 0),
  carton_max_kg    numeric(8,2) CHECK (carton_max_kg IS NULL OR carton_max_kg > 0),
  carton_units     int CHECK (carton_units IS NULL OR carton_units > 0),
  carton_size_ratio jsonb,  -- {size: qty} — sizes must exist in the pack's size range, sum = carton_units
  carton_assortment text CHECK (carton_assortment IS NULL OR carton_assortment IN ('solid','ratio')),
  carton_tape      text,
  carton_markings_asset_id uuid REFERENCES public.design_assets(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- D. Guards (S615 rules that need triggers, not CHECKs)
-- =====================================================================
-- Fibre content: [{fibre, pct}] must sum to 100 when present.
CREATE OR REPLACE FUNCTION public.ds__label_fibre_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
DECLARE v_sum numeric;
BEGIN
  IF NEW.fibre_content IS NOT NULL AND jsonb_typeof(NEW.fibre_content) = 'array'
     AND jsonb_array_length(NEW.fibre_content) > 0 THEN
    SELECT coalesce(sum((e ->> 'pct')::numeric), 0) INTO v_sum
      FROM jsonb_array_elements(NEW.fibre_content) e;
    IF v_sum IS NULL OR v_sum <> 100 THEN
      RAISE EXCEPTION 'fibre content must total 100%% (got %)', v_sum USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tp_labels_fibre ON public.tech_pack_labels;
CREATE TRIGGER trg_tp_labels_fibre BEFORE INSERT OR UPDATE OF fibre_content ON public.tech_pack_labels
  FOR EACH ROW EXECUTE FUNCTION public.ds__label_fibre_guard();

-- Barcode check digit (UPC-A 12 digits, EAN-13 13 digits). code_128/qr are
-- free text; a NULL barcode_value is allowed (no barcode on the tag yet).
CREATE OR REPLACE FUNCTION public.ds__barcode_valid(p_type text, p_value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_catalog AS $$
DECLARE v_len int; v_total int := 0; v_i int; v_d int; v_check int;
BEGIN
  IF p_value IS NULL OR p_type IS NULL THEN RETURN true; END IF;
  IF p_type NOT IN ('upc_a','ean_13') THEN RETURN true; END IF;
  v_len := CASE p_type WHEN 'upc_a' THEN 12 WHEN 'ean_13' THEN 13 END;
  IF p_value !~ ('^[0-9]{' || v_len || '}$') THEN RETURN false; END IF;
  FOR v_i IN 1 .. v_len - 1 LOOP
    v_d := substr(p_value, v_i, 1)::int;
    -- weight 3 on digits where (len - i) is odd (from the right, excl. check)
    v_total := v_total + v_d * (CASE WHEN (v_len - v_i) % 2 = 1 THEN 3 ELSE 1 END);
  END LOOP;
  v_check := (10 - (v_total % 10)) % 10;
  RETURN v_check = substr(p_value, v_len, 1)::int;
END $$;
CREATE OR REPLACE FUNCTION public.ds__hangtag_barcode_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF NOT public.ds__barcode_valid(NEW.barcode_type, NEW.barcode_value) THEN
    RAISE EXCEPTION 'barcode % is not a valid % (check digit)', NEW.barcode_value, NEW.barcode_type USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tp_hangtags_barcode ON public.tech_pack_hangtags;
CREATE TRIGGER trg_tp_hangtags_barcode BEFORE INSERT OR UPDATE OF barcode_type, barcode_value ON public.tech_pack_hangtags
  FOR EACH ROW EXECUTE FUNCTION public.ds__hangtag_barcode_guard();

-- Carton size ratio: every size must exist in the pack's size range and
-- the quantities must sum to carton_units (when both are present).
CREATE OR REPLACE FUNCTION public.ds__packaging_ratio_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_sizes text[]; v_key text; v_sum numeric := 0;
BEGIN
  IF NEW.fold_steps IS NOT NULL AND jsonb_typeof(NEW.fold_steps) = 'array'
     AND jsonb_array_length(NEW.fold_steps) > 4 THEN
    RAISE EXCEPTION 'packaging allows at most 4 fold steps' USING ERRCODE = '23514';
  END IF;
  IF NEW.carton_size_ratio IS NOT NULL AND jsonb_typeof(NEW.carton_size_ratio) = 'object'
     AND (SELECT count(*) FROM jsonb_object_keys(NEW.carton_size_ratio)) > 0 THEN
    SELECT sr.sizes INTO v_sizes FROM public.tech_packs tp
      JOIN public.ds_size_ranges sr ON sr.id = tp.size_range_id WHERE tp.id = NEW.tech_pack_id;
    IF v_sizes IS NOT NULL THEN
      FOR v_key IN SELECT jsonb_object_keys(NEW.carton_size_ratio) LOOP
        IF NOT (v_key = ANY (v_sizes)) THEN
          RAISE EXCEPTION 'size ratio uses unknown size % (range %)', v_key, v_sizes USING ERRCODE = '23514';
        END IF;
        v_sum := v_sum + (NEW.carton_size_ratio ->> v_key)::numeric;
      END LOOP;
      IF NEW.carton_units IS NOT NULL AND v_sum <> NEW.carton_units THEN
        RAISE EXCEPTION 'size ratio sums to % but carton holds %', v_sum, NEW.carton_units USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tp_packaging_ratio ON public.tech_pack_packaging;
CREATE TRIGGER trg_tp_packaging_ratio BEFORE INSERT OR UPDATE ON public.tech_pack_packaging
  FOR EACH ROW EXECUTE FUNCTION public.ds__packaging_ratio_guard();

-- Colorway components: the colorway must belong to the pack's design.
CREATE OR REPLACE FUNCTION public.ds__colorway_component_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_design uuid;
BEGIN
  SELECT tp.design_id INTO v_design FROM public.tech_packs tp WHERE tp.id = NEW.tech_pack_id;
  IF v_design IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.design_colorways c WHERE c.id = NEW.colorway_id AND c.design_id = v_design) THEN
    RAISE EXCEPTION 'colorway does not belong to this tech pack''s design' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tp_cwc_design ON public.tech_pack_colorway_components;
CREATE TRIGGER trg_tp_cwc_design BEFORE INSERT OR UPDATE OF colorway_id, tech_pack_id ON public.tech_pack_colorway_components
  FOR EACH ROW EXECUTE FUNCTION public.ds__colorway_component_guard();

-- Child-table wiring: tenant match + approved-lock + updated_at (S600 pattern).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tech_pack_pom_markers','tech_pack_colorway_components','tech_pack_labels','tech_pack_hangtags','tech_pack_packaging'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_tenant ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_tenant BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ds__match_parent_tenant(''tech_packs'',''tech_pack_id'')', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_lock ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_lock BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ds__tp_child_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- =====================================================================
-- E. Snapshot (S600 body, factored so the member check and the JSON
--    build are separate: the supplier snapshot reuses the build without
--    duplicating it, and the public snapshot keeps its membership check)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds__tech_pack_snapshot_json(p_tp uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE tp public.tech_packs; v jsonb;
BEGIN
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp;
  IF tp.id IS NULL THEN RAISE EXCEPTION 'tech pack not found' USING ERRCODE = 'P0002'; END IF;
  SELECT jsonb_build_object(
    'tech_pack', to_jsonb(tp),
    'design', (SELECT jsonb_build_object('id', d.id, 'name', d.name, 'style_number', d.style_number, 'product_type', d.product_type) FROM public.designs d WHERE d.id = tp.design_id),
    'size_range', (SELECT to_jsonb(sr) FROM public.ds_size_ranges sr WHERE sr.id = tp.size_range_id),
    'header', jsonb_build_object(
      'brand', (SELECT name FROM public.tenants WHERE id = tp.tenant_id),
      'style_number', tp.style_number,
      'title', tp.title,
      'description', tp.description,
      'designer_id', tp.designer_id,
      'season', (SELECT code FROM public.ds_seasons WHERE id = tp.season_id),
      'category', (SELECT category FROM public.ds_garment_templates gt JOIN public.designs d ON d.garment_template_id = gt.id WHERE d.id = tp.design_id),
      'size_range', (SELECT sr.sizes FROM public.ds_size_ranges sr WHERE sr.id = tp.size_range_id),
      'base_size', tp.base_size,
      'measure_unit', tp.measure_unit,
      'date', tp.updated_at,
      'revision', tp.revision,
      'status', tp.status,
      'approved_by', tp.approved_by,
      'main_fabric', (SELECT jsonb_build_object('description', b.description, 'material_id', b.material_id)
                        FROM public.tech_pack_bom_lines b WHERE b.tech_pack_id = tp.id AND b.is_main_fabric ORDER BY b.sort LIMIT 1)
    ),
    'colorways', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort) FROM public.design_colorways c WHERE c.design_id = tp.design_id), '[]'::jsonb),
    'bom', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.sort) FROM public.tech_pack_bom_lines b WHERE b.tech_pack_id = tp.id), '[]'::jsonb),
    'measurements', coalesce((SELECT jsonb_agg(jsonb_build_object('pom', p.code, 'name', p.name, 'size', m.size_label, 'value', m.value, 'tol_plus', m.tol_plus, 'tol_minus', m.tol_minus, 'grade', m.grade) ORDER BY p.sort, p.code, m.size_label)
                               FROM public.tech_pack_measurements m JOIN public.ds_pom_library p ON p.id = m.pom_id WHERE m.tech_pack_id = tp.id), '[]'::jsonb),
    'construction', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.sort) FROM public.tech_pack_construction c WHERE c.tech_pack_id = tp.id), '[]'::jsonb),
    'artwork', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sort) FROM public.tech_pack_artwork a WHERE a.tech_pack_id = tp.id), '[]'::jsonb),
    'pom_markers', coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.view, m.pom_id) FROM public.tech_pack_pom_markers m WHERE m.tech_pack_id = tp.id), '[]'::jsonb),
    'colorway_components', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.colorway_id, c.bom_line_id) FROM public.tech_pack_colorway_components c WHERE c.tech_pack_id = tp.id), '[]'::jsonb),
    'labels', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sort) FROM public.tech_pack_labels l WHERE l.tech_pack_id = tp.id), '[]'::jsonb),
    'hangtags', coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at) FROM public.tech_pack_hangtags h WHERE h.tech_pack_id = tp.id), '[]'::jsonb),
    'packaging', (SELECT to_jsonb(p) FROM public.tech_pack_packaging p WHERE p.tech_pack_id = tp.id),
    'template', (SELECT to_jsonb(t) FROM public.ds_tech_pack_templates t WHERE t.id = tp.template_id)
  ) INTO v;
  RETURN v;
END $$;

-- Public snapshot: S600 signature + membership check, S615 keys added.
CREATE OR REPLACE FUNCTION public.ds_tech_pack_snapshot(p_tp uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE tp public.tech_packs;
BEGIN
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp;
  IF tp.id IS NULL THEN RAISE EXCEPTION 'tech pack not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.platform_is_tenant_member(tp.tenant_id) AND coalesce(current_setting('ds.via_rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'not a member of this workspace' USING ERRCODE = '42501';
  END IF;
  RETURN public.ds__tech_pack_snapshot_json(p_tp);
END $$;

-- Supplier snapshot: same JSON with bom[].unit_cost, bom[].supplier_note
-- (internal) stripped. Member-checked like the public snapshot; used only
-- by the preview/release renderers (never printed: no RFQ target cost
-- lives in the snapshot at all).
CREATE OR REPLACE FUNCTION public.ds_tech_pack_supplier_snapshot(p_tp uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE tp public.tech_packs; v jsonb;
BEGIN
  SELECT * INTO tp FROM public.tech_packs WHERE id = p_tp;
  IF tp.id IS NULL THEN RAISE EXCEPTION 'tech pack not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.platform_is_tenant_member(tp.tenant_id) AND coalesce(current_setting('ds.via_rpc', true),'') <> 'on' THEN
    RAISE EXCEPTION 'not a member of this workspace' USING ERRCODE = '42501';
  END IF;
  v := public.ds__tech_pack_snapshot_json(p_tp);
  v := jsonb_set(v, '{bom}', coalesce(
    (SELECT jsonb_agg(b - 'unit_cost' - 'supplier_note') FROM jsonb_array_elements(v -> 'bom') b),
    '[]'::jsonb));
  RETURN v;
END $$;

-- =====================================================================
-- F. ds_create_tech_pack — S600 body + S615 clones.
--    BOM is cloned row-by-row (old->new id map in a temp table) so
--    colorway_components can re-point at the new BOM lines.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ds_create_tech_pack(p_design uuid, p_title text DEFAULT NULL, p_version uuid DEFAULT NULL,
  p_size_range uuid DEFAULT NULL, p_base_size text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE d public.designs; prev public.tech_packs; v_id uuid; v_ver uuid;
        r record; v_new_bom uuid;
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
  INSERT INTO public.tech_packs(tenant_id, design_id, version_id, revision, style_number, title, season_id, size_range_id, base_size, supersedes_id,
                                description, designer_id, reference_asset_ids, measure_unit, template_id)
  VALUES (d.tenant_id, d.id, v_ver, coalesce(prev.revision, 0) + 1, d.style_number,
          coalesce(p_title, prev.title, d.name), d.season_id,
          coalesce(p_size_range, prev.size_range_id), coalesce(p_base_size, prev.base_size), prev.id,
          prev.description, prev.designer_id, coalesce(prev.reference_asset_ids, '{}'), coalesce(prev.measure_unit, 'cm'), prev.template_id)
  RETURNING id INTO v_id;
  IF prev.id IS NOT NULL THEN
    CREATE TEMP TABLE IF NOT EXISTS tp_bom_map_615(old_id uuid, new_id uuid) ON COMMIT DROP;
    DELETE FROM tp_bom_map_615;
    FOR r IN SELECT * FROM public.tech_pack_bom_lines WHERE tech_pack_id = prev.id ORDER BY sort LOOP
      INSERT INTO public.tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom, colorway_id, vendor_id, unit_cost, supplier_note, sort, is_main_fabric)
        VALUES (r.tenant_id, v_id, r.material_id, r.kind, r.placement, r.description, r.quantity, r.uom, r.colorway_id, r.vendor_id, r.unit_cost, r.supplier_note, r.sort, r.is_main_fabric)
        RETURNING id INTO v_new_bom;
      INSERT INTO tp_bom_map_615 VALUES (r.id, v_new_bom);
    END LOOP;
    INSERT INTO public.tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus, grade)
      SELECT tenant_id, v_id, pom_id, size_label, value, tol_plus, tol_minus, grade FROM public.tech_pack_measurements WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_construction(tenant_id, tech_pack_id, area, operation, stitch_type, spi, seam_allowance_mm, notes, image_asset_id, sort, callout_no, view, anchor_x, anchor_y, label_x, label_y)
      SELECT tenant_id, v_id, area, operation, stitch_type, spi, seam_allowance_mm, notes, image_asset_id, sort, callout_no, view, anchor_x, anchor_y, label_x, label_y FROM public.tech_pack_construction WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_artwork(tenant_id, tech_pack_id, asset_id, view, placement, technique, width_mm, height_mm, offset_ref, offset_x_mm, offset_y_mm, colorway_id, pantone_codes, stitch_count, notes, sort)
      SELECT tenant_id, v_id, asset_id, view, placement, technique, width_mm, height_mm, offset_ref, offset_x_mm, offset_y_mm, colorway_id, pantone_codes, stitch_count, notes, sort FROM public.tech_pack_artwork WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_pom_markers(tenant_id, tech_pack_id, pom_id, view, x1, y1, x2, y2, label_x, label_y)
      SELECT tenant_id, v_id, pom_id, view, x1, y1, x2, y2, label_x, label_y FROM public.tech_pack_pom_markers WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_colorway_components(tenant_id, tech_pack_id, colorway_id, bom_line_id, color_name, pantone, hex)
      SELECT c.tenant_id, v_id, c.colorway_id, m.new_id, c.color_name, c.pantone, c.hex
        FROM public.tech_pack_colorway_components c JOIN tp_bom_map_615 m ON m.old_id = c.bom_line_id
       WHERE c.tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_labels(tenant_id, tech_pack_id, kind, label_type, material_id, width_mm, height_mm, color, attachment, placement, text, fibre_content, country_of_origin, care_symbols, artwork_asset_id, sort)
      SELECT tenant_id, v_id, kind, label_type, material_id, width_mm, height_mm, color, attachment, placement, text, fibre_content, country_of_origin, care_symbols, artwork_asset_id, sort FROM public.tech_pack_labels WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_hangtags(tenant_id, tech_pack_id, front_asset_id, back_asset_id, width_mm, height_mm, shape, stock, gsm, print, finish, eyelet, fastener, fastener_color, placement, barcode_type, barcode_value, retail_price, currency, vendor_id, material_id, notes)
      SELECT tenant_id, v_id, front_asset_id, back_asset_id, width_mm, height_mm, shape, stock, gsm, print, finish, eyelet, fastener, fastener_color, placement, barcode_type, barcode_value, retail_price, currency, vendor_id, material_id, notes FROM public.tech_pack_hangtags WHERE tech_pack_id = prev.id;
    INSERT INTO public.tech_pack_packaging(tenant_id, tech_pack_id, fold_steps, polybag_size_mm, polybag_thickness_micron, polybag_material, polybag_closure, polybag_warning, polybag_print, polybag_sticker, polybag_units, carton_size_mm, carton_ply, carton_max_kg, carton_units, carton_size_ratio, carton_assortment, carton_tape, carton_markings_asset_id)
      SELECT tenant_id, v_id, fold_steps, polybag_size_mm, polybag_thickness_micron, polybag_material, polybag_closure, polybag_warning, polybag_print, polybag_sticker, polybag_units, carton_size_mm, carton_ply, carton_max_kg, carton_units, carton_size_ratio, carton_assortment, carton_tape, carton_markings_asset_id FROM public.tech_pack_packaging WHERE tech_pack_id = prev.id;
    DROP TABLE tp_bom_map_615;
  END IF;
  RETURN v_id;
END $$;

-- =====================================================================
-- G. RLS registry wiring (templates are admin mode; children stay
--    member-writable like the S600 tech pack children — no override)
-- =====================================================================
INSERT INTO public.platform_table_access_overrides(table_name, access_mode, lifecycle, notes) VALUES
  ('ds_tech_pack_templates', 'tenant_admin', 'active', 'S615: owners/admins author tech pack templates, members read')
ON CONFLICT (table_name) DO UPDATE SET access_mode = excluded.access_mode, lifecycle = excluded.lifecycle, notes = excluded.notes;

SELECT count(*) AS tables_secured FROM public.platform__apply_app_security();

-- =====================================================================
-- H. Grants (mirror the S600/S610 loop for the new functions)
-- =====================================================================
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('ds__label_fibre_guard','ds__barcode_valid','ds__hangtag_barcode_guard',
                                'ds__packaging_ratio_guard','ds__colorway_component_guard',
                                'ds__tech_pack_snapshot_json') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.ds_tech_pack_supplier_snapshot(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.ds_tech_pack_supplier_snapshot(uuid) FROM PUBLIC, anon;
-- pure validation helper used by the editor + tests (S610 precedent:
-- ds__license_scope_for is likewise granted to authenticated)
GRANT EXECUTE ON FUNCTION public.ds__barcode_valid(text, text) TO authenticated;

DO $$ BEGIN IF to_regprocedure('unify.done(text)') IS NOT NULL THEN PERFORM unify.done('615'); END IF; END $$;
COMMIT;
