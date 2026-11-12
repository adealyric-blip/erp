-- =====================================================================
-- S610_tests.sql — flat library + license guard (T10b).
-- Run right after S605_tests.sql in the same throwaway database (reuses
-- its users, tenants and t.* helpers). Proves plan/08 §S610:
--   staff can read but not write licenses; owner can; rival tenant and
--   supplier see nothing; vendor_restricted + allow_supplier_view is
--   rejected; a supplier preview derived from a Printful asset is
--   rejected; an RFQ on a printful_only template can't publish; one on a
--   generated flat can; supplier_authorize_asset_view / _release deny and
--   log for a restricted asset; expired license blocks; S600 (82) and
--   S605 (17) still pass (the db:test run itself proves those).
-- =====================================================================
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
DELETE FROM t.results;

-- ---------------------------------------------------------------------
-- 0. Fixtures (superuser): Printful vendor + coa, owned / expired licenses
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
DO $$
DECLARE coa uuid; vp uuid;
BEGIN
  SET LOCAL session_replication_role = replica;
  INSERT INTO acct_chart_of_accounts(tenant_id, entity_id, code, name, account_type, normal_balance, is_control_account)
    VALUES (t.get('T1'), gen_random_uuid(), '2010', 'Printful AP', 'liability', 'credit', true) RETURNING id INTO coa;
  SET LOCAL session_replication_role = origin;
  INSERT INTO acct_vendors(tenant_id, vendor_number, legal_name, ap_account_id)
    VALUES (t.get('T1'), 'V-PF', 'Printful Inc', coa) RETURNING id INTO vp;
  PERFORM t.put('VP', vp::text);
END $$;

-- owner creates the owned + expired licenses (admin-mode write)
SELECT t.act(t.get('O'));
DO $$
DECLARE lic uuid; exp uuid;
BEGIN
  INSERT INTO ds_asset_licenses(tenant_id, source, license_type, license_name, license_url, allow_supplier_view, allow_redistribution)
    VALUES (t.get('T1'), 'generated', 'owned', 'Atelier owned flat', NULL, true, false) RETURNING id INTO lic;
  PERFORM t.put('LIC_OWNED', lic::text);
  INSERT INTO ds_asset_licenses(tenant_id, source, license_type, license_name, license_url, allow_supplier_view, expires_at)
    VALUES (t.get('T1'), 'vecfashion', 'licensed_commercial', 'VecFashion Standard', 'https://vecfashion.com/pages/faqs', true, now() - interval '1 day')
    RETURNING id INTO exp;
  PERFORM t.put('LIC_EXP', exp::text);
END $$;

-- ---------------------------------------------------------------------
-- 1. License table access: owner writes, staff reads, others see nothing
-- ---------------------------------------------------------------------
SELECT t.ok('staff can read licenses', (SELECT count(*) FROM ds_asset_licenses WHERE tenant_id = t.get('T1')) >= 1);
SELECT t.act(t.get('S'));
SELECT t.ok('staff (member) can read licenses', (SELECT count(*) FROM ds_asset_licenses) >= 2);
SELECT t.denied('staff cannot write licenses',
  format($q$INSERT INTO ds_asset_licenses(tenant_id, source, license_type, allow_supplier_view) VALUES (%L, 'generated', 'owned', true)$q$, t.get('T1')),
  'row-level security|permission');
SELECT t.act(t.get('X'));
SELECT t.ok('rival tenant sees no licenses', t.cnt('SELECT 1 FROM ds_asset_licenses') = 0);
SELECT t.act(t.get('SU'));
SELECT t.ok('supplier sees no licenses', t.cnt('SELECT 1 FROM ds_asset_licenses') = 0);

-- ---------------------------------------------------------------------
-- 2. License CHECKs (as owner)
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
SELECT t.denied('vendor_restricted with allow_supplier_view=true is rejected',
  format($q$INSERT INTO ds_asset_licenses(tenant_id, source, license_type, license_url, allow_supplier_view, restricted_to_vendor_id) VALUES (%L, 'printful', 'vendor_restricted', 'https://www.printful.com/policies/download/terms-of-service', true, %L)$q$, t.get('T1'), t.get('VP')),
  'check constraint|vendor_restricted');
SELECT t.denied('owned license must come from generated source',
  format($q$INSERT INTO ds_asset_licenses(tenant_id, source, license_type, allow_supplier_view) VALUES (%L, 'vecfashion', 'owned', true)$q$, t.get('T1')),
  'check constraint');
SELECT t.denied('non-owned license needs a license_url',
  format($q$INSERT INTO ds_asset_licenses(tenant_id, source, license_type, allow_supplier_view) VALUES (%L, 'vecfashion', 'licensed_commercial', true)$q$, t.get('T1')),
  'check constraint');
SELECT t.act(NULL);
SELECT t.ok('expired license is not viewable', NOT ds__license_viewable(t.get('LIC_EXP')));
SELECT t.ok('live owned license is viewable', ds__license_viewable(t.get('LIC_OWNED')));

-- ---------------------------------------------------------------------
-- 3. Printful back-fill (rule 4): assets + template point at the license
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
DO $$
DECLARE src uuid; tpl uuid; lic uuid;
BEGIN
  INSERT INTO design_assets(tenant_id, kind, storage_path, bucket, classification, mime_type, provider)
    VALUES (t.get('T1'), 'mockup', t.get('T1') || '/printful/tee-base.png', 'design-assets', 'internal', 'image/png', 'printful')
    RETURNING id INTO src;
  PERFORM t.put('PF_SRC', src::text);
  INSERT INTO ds_garment_templates(tenant_id, name, category, flat_sketch_asset_id)
    VALUES (t.get('T1'), 'Printful classic tee', 'tops', src) RETURNING id INTO tpl;
  PERFORM t.put('TPL_PF', tpl::text);
  PERFORM ds__s610_backfill_printful();
  SELECT id INTO lic FROM ds_asset_licenses
   WHERE source = 'printful' AND license_type = 'vendor_restricted' AND restricted_to_vendor_id = t.get('VP');
  PERFORM t.put('LIC_PF', lic::text);
  PERFORM t.ok('back-fill created one Printful license', lic IS NOT NULL);
  PERFORM t.ok('Printful asset points at the license', (SELECT license_id FROM design_assets WHERE id = src) = lic);
  PERFORM t.ok('Printful template scope is printful_only', (SELECT license_scope FROM ds_garment_templates WHERE id = tpl) = 'printful_only');
  PERFORM t.ok('back-fill is idempotent (second run adds no license)',
    (SELECT count(*) FROM ds_asset_licenses WHERE source = 'printful' AND restricted_to_vendor_id = t.get('VP')) = 1
    AND (SELECT ds__s610_backfill_printful()) >= 0
    AND (SELECT count(*) FROM ds_asset_licenses WHERE source = 'printful' AND restricted_to_vendor_id = t.get('VP')) = 1);
END $$;

-- owned + unlicensed templates for the publish tests
SELECT t.act(t.get('O'));
DO $$
DECLARE tpl uuid; unl uuid;
BEGIN
  INSERT INTO ds_garment_templates(tenant_id, name, category, license_id, block, style_options, generator_version)
    VALUES (t.get('T1'), 'Atelier classic tee', 'tops', t.get('LIC_OWNED'),
            '{"chest_mm": 540, "body_length_mm": 700}'::jsonb, '{"neck":"crew","sleeve":"set-in"}'::jsonb, 'flat-gen/1')
    RETURNING id INTO tpl;
  PERFORM t.put('TPL_OWN', tpl::text);
  PERFORM t.ok('owned template scope is owned', (SELECT license_scope FROM ds_garment_templates WHERE id = tpl) = 'owned');
  INSERT INTO ds_garment_templates(tenant_id, name, category)
    VALUES (t.get('T1'), 'Mystery blank (no license)', 'tops') RETURNING id INTO unl;
  PERFORM t.put('TPL_UNL', unl::text);
  PERFORM t.ok('template without a license is unlicensed', (SELECT license_scope FROM ds_garment_templates WHERE id = unl) = 'unlicensed');
END $$;

-- ---------------------------------------------------------------------
-- 4. Asset guard (rule 1): no supplier preview off a Printful asset
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
SELECT t.denied('supplier preview derived from a Printful asset is rejected',
  format($q$INSERT INTO design_assets(tenant_id, kind, storage_path, bucket, classification, derived_from_asset_id, mime_type) VALUES (%L, 'mockup', 'x/p.webp', 'supplier-previews', 'supplier_preview', %L, 'image/webp')$q$, t.get('T1'), t.get('PF_SRC')),
  'DS_LICENSE_BLOCKED');

-- ---------------------------------------------------------------------
-- 5. RFQ publish: printful_only blocked, owned allowed
--    (build one publishable RFQ per template: design + version + assets +
--    approved tech pack with wired preview + invitation)
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE d uuid; v uuid; src uuid; prev uuid; tp uuid; j craft_jobs;
BEGIN
  -- printful_only design
  INSERT INTO designs(tenant_id, name, style_number, source, garment_template_id)
    VALUES (t.get('T1'), 'Printful tee RFQ', 'S610-PF-001', 'konva', t.get('TPL_PF')) RETURNING id INTO d;
  PERFORM t.put('D_PF', d::text);
  v := ds_create_design_version(d, '{"layers":[]}'::jsonb, 'konva', NULL, NULL, 'v1');
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, mime_type)
    VALUES (t.get('T1'), d, v, 'mockup', t.get('T1') || '/designs/pf-master.png', 'design-private', 'internal', 'image/png') RETURNING id INTO src;
  PERFORM t.put('SRC_PF', src::text);
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, derived_from_asset_id, mime_type)
    VALUES (t.get('T1'), d, v, 'techpack_pdf', t.get('T1') || '/previews/pf-tp-r1.pdf', 'supplier-previews', 'supplier_preview', src, 'application/pdf') RETURNING id INTO prev;
  PERFORM t.put('PREV_PF', prev::text);
  tp := ds_create_tech_pack(d, 'Printful tee tech pack', v, t.get('SR'), 'M');
  PERFORM t.put('TP_PF', tp::text);
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom)
    VALUES (t.get('T1'), tp, t.get('MAT'), 'fabric', 'body', 'Body fabric', 1.2, 'm');
  INSERT INTO tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus)
    SELECT t.get('T1'), tp, t.get('POM'), s, 66 + i, 1, 1 FROM unnest(ARRAY['XS','S','M','L','XL']) WITH ORDINALITY u(s, i);
  PERFORM ds_transition_tech_pack(tp, 'in_review', 'ready');
  PERFORM ds_transition_tech_pack(tp, 'approved', 'approved');
END $$;
SELECT t.act(NULL);
DO $$
DECLARE tp uuid := t.get('TP_PF'); j craft_jobs;
BEGIN
  FOR j IN SELECT * FROM ds_claim_jobs('s610-worker', ARRAY['techpack_preview_pdf'], 5) LOOP
    IF j.subject_id = tp THEN PERFORM ds_finish_job(j.id, 's610-worker', true, jsonb_build_object('asset_id', t.get('PREV_PF'))); END IF;
  END LOOP;
  PERFORM t.ok('printful tech pack preview wired', (SELECT preview_pdf_asset_id FROM tech_packs WHERE id = tp) = t.get('PREV_PF'));
END $$;
SELECT t.act(t.get('O'));
DO $$
DECLARE r uuid;
BEGIN
  r := ds_create_rfq(t.get('T1'), 'S610 Printful RFQ', now() + interval '3 days', 'USD', 'FOB');
  INSERT INTO rfq_lines(tenant_id, rfq_id, line_no, tech_pack_id, quantity, size_breakdown)
    VALUES (t.get('T1'), r, 1, t.get('TP_PF'), 100, '{"M":100}');
  PERFORM ds_invite_vendor_to_rfq(r, t.get('V1'));
  PERFORM t.put('RFQ_PF', r::text);
END $$;
SELECT t.denied('RFQ on a printful_only template cannot publish',
  format($q$SELECT ds_publish_rfq(%L)$q$, t.get('RFQ_PF')), 'DS_LICENSE_BLOCKED');

-- owned template: same build, must publish
SELECT t.act(t.get('O'));
DO $$
DECLARE d uuid; v uuid; src uuid; prev uuid; tp uuid;
BEGIN
  INSERT INTO designs(tenant_id, name, style_number, source, garment_template_id)
    VALUES (t.get('T1'), 'Atelier tee RFQ', 'S610-OWN-001', 'konva', t.get('TPL_OWN')) RETURNING id INTO d;
  PERFORM t.put('D_OWN', d::text);
  v := ds_create_design_version(d, '{"layers":[]}'::jsonb, 'konva', NULL, NULL, 'v1');
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, mime_type)
    VALUES (t.get('T1'), d, v, 'mockup', t.get('T1') || '/designs/own-master.png', 'design-private', 'internal', 'image/png') RETURNING id INTO src;
  PERFORM t.put('SRC_OWN', src::text);
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, derived_from_asset_id, mime_type)
    VALUES (t.get('T1'), d, v, 'techpack_pdf', t.get('T1') || '/previews/own-tp-r1.pdf', 'supplier-previews', 'supplier_preview', src, 'application/pdf') RETURNING id INTO prev;
  PERFORM t.put('PREV_OWN', prev::text);
  tp := ds_create_tech_pack(d, 'Atelier tee tech pack', v, t.get('SR'), 'M');
  PERFORM t.put('TP_OWN', tp::text);
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom)
    VALUES (t.get('T1'), tp, t.get('MAT'), 'fabric', 'body', 'Body fabric', 1.2, 'm');
  INSERT INTO tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus)
    SELECT t.get('T1'), tp, t.get('POM'), s, 66 + i, 1, 1 FROM unnest(ARRAY['XS','S','M','L','XL']) WITH ORDINALITY u(s, i);
  PERFORM ds_transition_tech_pack(tp, 'in_review', 'ready');
  PERFORM ds_transition_tech_pack(tp, 'approved', 'approved');
END $$;
SELECT t.act(NULL);
DO $$
DECLARE tp uuid := t.get('TP_OWN'); j craft_jobs;
BEGIN
  FOR j IN SELECT * FROM ds_claim_jobs('s610-worker', ARRAY['techpack_preview_pdf'], 5) LOOP
    IF j.subject_id = tp THEN PERFORM ds_finish_job(j.id, 's610-worker', true, jsonb_build_object('asset_id', t.get('PREV_OWN'))); END IF;
  END LOOP;
  PERFORM t.ok('owned tech pack preview wired', (SELECT preview_pdf_asset_id FROM tech_packs WHERE id = tp) = t.get('PREV_OWN'));
END $$;
SELECT t.act(t.get('O'));
DO $$
DECLARE r uuid;
BEGIN
  r := ds_create_rfq(t.get('T1'), 'S610 Owned RFQ', now() + interval '3 days', 'USD', 'FOB');
  INSERT INTO rfq_lines(tenant_id, rfq_id, line_no, tech_pack_id, quantity, size_breakdown)
    VALUES (t.get('T1'), r, 1, t.get('TP_OWN'), 100, '{"M":100}');
  PERFORM ds_invite_vendor_to_rfq(r, t.get('V1'));
  PERFORM ds_invite_vendor_to_rfq(r, t.get('V2'));  -- V2/SU2 is the live supplier (V1 was revoked in S600 §8)
  PERFORM t.put('RFQ_OWN', r::text);
END $$;
SELECT t.ok('RFQ on a generated (owned) flat publishes',
  (ds_publish_rfq(t.get('RFQ_OWN'))).status = 'published');

-- ---------------------------------------------------------------------
-- 6. supplier_authorize_asset_view: license denial + log + restore
-- ---------------------------------------------------------------------
SELECT t.act(t.get('SU2'));
DO $$
DECLARE n jsonb := supplier_get_nda(t.get('RFQ_OWN'));
BEGIN
  PERFORM supplier_accept_nda(t.get('RFQ_OWN'), n ->> 'body_sha256', 'Li Wei', 'Sales Director');
END $$;
SELECT t.ok('owned preview authorized before license change',
  (supplier_authorize_asset_view(t.get('RFQ_OWN'), t.get('PREV_OWN')) ->> 'allowed')::boolean);
SELECT t.act(NULL);
UPDATE design_assets SET license_id = t.get('LIC_PF') WHERE id = t.get('SRC_OWN');
SELECT t.act(t.get('SU2'));
SELECT t.ok('preview denied once its source license forbids supplier view',
  (supplier_authorize_asset_view(t.get('RFQ_OWN'), t.get('PREV_OWN')) ->> 'allowed')::boolean = false);
SELECT t.ok('denial reason is DS_LICENSE_BLOCKED',
  (supplier_authorize_asset_view(t.get('RFQ_OWN'), t.get('PREV_OWN')) ->> 'reason') LIKE 'DS_LICENSE_BLOCKED%');
SELECT t.act(NULL);
SELECT t.ok('license denial is logged',
  t.cnt(format($q$SELECT 1 FROM ds_access_events WHERE event = 'asset_view_denied' AND asset_id = %L AND metadata ->> 'reason' = 'DS_LICENSE_BLOCKED'$q$, t.get('PREV_OWN'))) >= 1);
UPDATE design_assets SET license_id = t.get('LIC_EXP') WHERE id = t.get('SRC_OWN');
SELECT t.act(t.get('SU2'));
SELECT t.ok('expired license also blocks the preview',
  (supplier_authorize_asset_view(t.get('RFQ_OWN'), t.get('PREV_OWN')) ->> 'allowed')::boolean = false);
SELECT t.act(NULL);
UPDATE design_assets SET license_id = NULL WHERE id = t.get('SRC_OWN');
SELECT t.act(t.get('SU2'));
SELECT t.ok('preview authorized again once the license is cleared',
  (supplier_authorize_asset_view(t.get('RFQ_OWN'), t.get('PREV_OWN')) ->> 'allowed')::boolean);

-- ---------------------------------------------------------------------
-- 7. supplier_authorize_release: printful denied, owned allowed
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
INSERT INTO asset_release_grants(tenant_id, vendor_id, rfq_id, tech_pack_id, level)
  VALUES (t.get('T1'), t.get('V2'), t.get('RFQ_PF'), t.get('TP_PF'), 'production'),
         (t.get('T1'), t.get('V2'), t.get('RFQ_OWN'), t.get('TP_OWN'), 'production');
SELECT t.act(t.get('SU2'));
SELECT t.ok('production release denied for a printful_only template',
  (supplier_authorize_release(t.get('TP_PF')) ->> 'allowed')::boolean = false);
SELECT t.ok('release denial reason is DS_LICENSE_BLOCKED',
  (supplier_authorize_release(t.get('TP_PF')) ->> 'reason') LIKE 'DS_LICENSE_BLOCKED%');
SELECT t.ok('production release allowed for an owned template',
  (supplier_authorize_release(t.get('TP_OWN')) ->> 'allowed')::boolean);
SELECT t.act(NULL);
SELECT t.ok('release denial is logged',
  t.cnt(format($q$SELECT 1 FROM ds_access_events WHERE event = 'release_download_denied' AND subject_id = %L AND metadata ->> 'reason' = 'DS_LICENSE_BLOCKED'$q$, t.get('TP_PF'))) >= 1);

-- ---------------------------------------------------------------------
-- 8. Import tables (T10c): piece license match + accept requirements
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE b uuid; a uuid;
BEGIN
  INSERT INTO design_assets(tenant_id, kind, storage_path, bucket, classification, mime_type, license_id)
    VALUES (t.get('T1'), 'flat_sketch', t.get('T1') || '/flats/tee-front.svg', 'design-private', 'internal', 'image/svg+xml', t.get('LIC_OWNED'))
    RETURNING id INTO a;
  PERFORM t.put('PIECE_ASSET', a::text);
  INSERT INTO ds_flat_import_batches(tenant_id, source_asset_id, license_id, source_category, status)
    VALUES (t.get('T1'), t.get('PF_SRC'), t.get('LIC_OWNED'), 'tops', 'review') RETURNING id INTO b;
  PERFORM t.put('BATCH', b::text);
END $$;
SELECT t.act(t.get('O'));
DO $$
DECLARE b uuid := t.get('BATCH');
BEGIN
  -- piece asset carries the batch license: insert ok as proposed
  INSERT INTO ds_flat_pieces(tenant_id, batch_id, source_ref, svg_asset_id, view, category)
    VALUES (t.get('T1'), b, 'page-1', t.get('PIECE_ASSET'), 'front', 'tee');
  PERFORM t.ok('piece with matching license inserts', true);
END $$;
SELECT t.act(NULL);
SELECT t.ok('a raw flat piece is never supplier-viewable',
  NOT ds__asset_license_viewable(t.get('PIECE_ASSET')));
SELECT t.denied('piece asset with a different license than its batch is rejected',
  format($q$INSERT INTO ds_flat_pieces(tenant_id, batch_id, source_ref, svg_asset_id) VALUES (%L, %L, 'page-2', %L)$q$, t.get('T1'), t.get('BATCH'), t.get('PF_SRC')),
  'batch license');
SELECT t.denied('accepting a piece without category/view/scale/reviewer is rejected',
  format($q$INSERT INTO ds_flat_pieces(tenant_id, batch_id, source_ref, status, category) VALUES (%L, %L, 'page-3', 'accepted', 'tee')$q$, t.get('T1'), t.get('BATCH')),
  'category, view, scale');
SELECT t.act(t.get('O'));
DO $$
DECLARE b uuid := t.get('BATCH'); p uuid;
BEGIN
  INSERT INTO ds_flat_pieces(tenant_id, batch_id, source_ref, svg_asset_id, view, category, pair_key, scale_mm_per_unit, status, reviewed_by, reviewed_at)
    VALUES (t.get('T1'), b, 'page-1', t.get('PIECE_ASSET'), 'front', 'tee', 'pair-1', 1.0, 'accepted', t.get('O'), now()) RETURNING id INTO p;
  PERFORM t.ok('fully-specified piece accepts', p IS NOT NULL);
END $$;

-- ---------------------------------------------------------------------
-- 9. Scope follows the license when its type changes
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE lic uuid; tpl uuid;
BEGIN
  INSERT INTO ds_asset_licenses(tenant_id, source, license_type, license_name, license_url, allow_supplier_view)
    VALUES (t.get('T1'), 'vecfashion', 'licensed_commercial', 'VecFashion Standard', 'https://vecfashion.com/pages/faqs', true)
    RETURNING id INTO lic;
  INSERT INTO ds_garment_templates(tenant_id, name, category, license_id)
    VALUES (t.get('T1'), 'VecFashion tee', 'tops', lic) RETURNING id INTO tpl;
  PERFORM t.ok('licensed template scope is licensed', (SELECT license_scope FROM ds_garment_templates WHERE id = tpl) = 'licensed');
  UPDATE ds_asset_licenses SET license_type = 'open_source', license_url = 'https://opensource.org/licenses/MIT' WHERE id = lic;
  PERFORM t.ok('scope still licensed after open_source change', (SELECT license_scope FROM ds_garment_templates WHERE id = tpl) = 'licensed');
END $$;

SELECT count(*) AS s610_checks_passed FROM t.results WHERE ok;
