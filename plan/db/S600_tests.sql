-- =====================================================================
-- S600_tests.sql  —  end-to-end security + workflow tests for the Design Studio
-- Run against a THROWAWAY database after S590 + S600:
--   psql -v ON_ERROR_STOP=1 -f S600_tests.sql
-- Simulates Supabase: role `authenticated` + request.jwt.claim.sub = user id.
-- Every check either passes silently or aborts the script with a message.
-- =====================================================================
\set ON_ERROR_STOP 1
SET client_min_messages = warning;

-- Supabase default table privileges (RLS does the real filtering)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, anon;
GRANT SELECT ON auth.users TO service_role;
GRANT ALL ON storage.objects, storage.buckets TO authenticated, service_role;

DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO PUBLIC;
CREATE TABLE t.results (n serial, name text, ok boolean, detail text);
GRANT ALL ON t.results, t.results_n_seq TO PUBLIC;
CREATE TABLE t.ctx (k text PRIMARY KEY, v text);
GRANT ALL ON t.ctx TO PUBLIC;

CREATE FUNCTION t.act(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  IF p_uid IS NULL THEN EXECUTE 'RESET ROLE'; ELSE EXECUTE 'SET ROLE authenticated'; END IF;
END $$;
CREATE FUNCTION t.get(p_k text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT v::uuid FROM t.ctx WHERE k = p_k $$;
CREATE FUNCTION t.put(p_k text, p_v text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO t.ctx VALUES (p_k, p_v) ON CONFLICT (k) DO UPDATE SET v = excluded.v $$;
CREATE FUNCTION t.ok(p_name text, p_cond boolean, p_detail text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t.results(name, ok, detail) VALUES (p_name, coalesce(p_cond,false), p_detail);
  IF NOT coalesce(p_cond,false) THEN RAISE EXCEPTION 'FAIL: % %', p_name, coalesce(p_detail,''); END IF;
END $$;
-- run SQL that MUST fail with an error matching p_pattern
CREATE FUNCTION t.denied(p_name text, p_sql text, p_pattern text DEFAULT '.') RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_failed boolean := false; v_msg text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN others THEN v_failed := true; v_msg := SQLERRM;
  END;
  IF NOT v_failed THEN PERFORM t.ok(p_name, false, 'expected an error, statement succeeded'); END IF;
  PERFORM t.ok(p_name, v_msg ~* p_pattern, 'got: ' || v_msg);
END $$;
CREATE FUNCTION t.cnt(p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint; BEGIN EXECUTE 'SELECT count(*) FROM (' || p_sql || ') x' INTO n; RETURN n; END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO PUBLIC;

-- ---------------------------------------------------------------------
-- 0. Fixtures (as superuser = service role)
-- ---------------------------------------------------------------------
DO $$
DECLARE t1 uuid; t2 uuid; o uuid; s uuid; x uuid; su uuid; su2 uuid; evil uuid; v1 uuid; v2 uuid; vx uuid; coa uuid; coa2 uuid;
BEGIN
  INSERT INTO tenants(name, slug, type) VALUES ('Maison Test', 'maison-test-' || substr(md5(random()::text),1,6), 'seller') RETURNING id INTO t1;
  INSERT INTO tenants(name, slug, type) VALUES ('Rival House', 'rival-' || substr(md5(random()::text),1,6), 'seller') RETURNING id INTO t2;
  INSERT INTO auth.users(email) VALUES ('owner@maison.test')  RETURNING id INTO o;
  INSERT INTO auth.users(email) VALUES ('staff@maison.test')  RETURNING id INTO s;
  INSERT INTO auth.users(email) VALUES ('owner@rival.test')   RETURNING id INTO x;
  INSERT INTO auth.users(email) VALUES ('sales@factory.test') RETURNING id INTO su;
  INSERT INTO auth.users(email) VALUES ('quotes@mill.test')   RETURNING id INTO su2;
  INSERT INTO auth.users(email) VALUES ('thief@else.test')    RETURNING id INTO evil;
  INSERT INTO tenant_memberships(tenant_id, user_id, role) VALUES (t1, o, 'owner'), (t1, s, 'staff'), (t2, x, 'owner');
  -- minimal AP control accounts (entity FK skipped in fixtures only)
  SET LOCAL session_replication_role = replica;
  INSERT INTO acct_chart_of_accounts(tenant_id, entity_id, code, name, account_type, normal_balance, is_control_account)
    VALUES (t1, gen_random_uuid(), '2000', 'Accounts Payable', 'liability', 'credit', true) RETURNING id INTO coa;
  INSERT INTO acct_chart_of_accounts(tenant_id, entity_id, code, name, account_type, normal_balance, is_control_account)
    VALUES (t2, gen_random_uuid(), '2000', 'Accounts Payable', 'liability', 'credit', true) RETURNING id INTO coa2;
  SET LOCAL session_replication_role = origin;
  INSERT INTO acct_vendors(tenant_id, vendor_number, legal_name, ap_account_id) VALUES (t1, 'V-001', 'Guangzhou Cut & Sew Ltd', coa) RETURNING id INTO v1;
  INSERT INTO acct_vendors(tenant_id, vendor_number, legal_name, ap_account_id) VALUES (t1, 'V-002', 'Porto Knit Mill', coa) RETURNING id INTO v2;
  INSERT INTO acct_vendors(tenant_id, vendor_number, legal_name, ap_account_id) VALUES (t2, 'V-900', 'Rival Supplier', coa2) RETURNING id INTO vx;
  PERFORM t.put('T1', t1::text); PERFORM t.put('T2', t2::text);
  PERFORM t.put('O', o::text); PERFORM t.put('S', s::text); PERFORM t.put('X', x::text);
  PERFORM t.put('SU', su::text); PERFORM t.put('SU2', su2::text); PERFORM t.put('EVIL', evil::text);
  PERFORM t.put('V1', v1::text); PERFORM t.put('V2', v2::text); PERFORM t.put('VX', vx::text);
END $$;

-- ---------------------------------------------------------------------
-- 1. Studio: libraries, design, versions (as owner / staff)
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE t1 uuid := t.get('T1'); d uuid; v1 uuid; v2 uuid; sr uuid; pom uuid; mat uuid; cw uuid;
BEGIN
  INSERT INTO ds_seasons(tenant_id, code, name) VALUES (t1, 'SS27', 'Spring Summer 27');
  INSERT INTO ds_size_ranges(tenant_id, name, sizes, base_size) VALUES (t1, 'Unisex XS-XL', ARRAY['XS','S','M','L','XL'], 'M') RETURNING id INTO sr;
  INSERT INTO ds_pom_library(tenant_id, code, name, how_to_measure) VALUES (t1, 'A', 'Body length from HPS', 'HPS to hem, flat') RETURNING id INTO pom;
  INSERT INTO ds_materials(tenant_id, kind, code, name, composition, weight_gsm) VALUES (t1, 'fabric', 'JER-240', '240gsm jersey', '100% organic cotton', 240) RETURNING id INTO mat;
  INSERT INTO designs(tenant_id, name, style_number, source) VALUES (t1, 'Boxy Tee — Atelier Logo', 'MT-27-001', 'vectorcraft') RETURNING id INTO d;
  v1 := ds_create_design_version(d, '{"layers":[]}'::jsonb, 'vectorcraft', NULL, NULL, 'first draft');
  v2 := ds_create_design_version(d, '{"layers":[{"id":"logo"}]}'::jsonb, 'vectorcraft', NULL, NULL, 'logo placed');
  PERFORM t.ok('version numbers increment', (SELECT array_agg(version_no ORDER BY version_no) FROM design_versions WHERE design_id = d) = ARRAY[1,2]);
  PERFORM t.ok('design.current_version_id follows latest', (SELECT current_version_id FROM designs WHERE id = d) = v2);
  INSERT INTO design_colorways(tenant_id, design_id, name, garment_color_hex, pantone_codes) VALUES (t1, d, 'Bone', '#E8E1D3', ARRAY['11-0105 TCX']) RETURNING id INTO cw;
  PERFORM t.put('D', d::text); PERFORM t.put('DV2', v2::text); PERFORM t.put('SR', sr::text); PERFORM t.put('POM', pom::text);
  PERFORM t.put('MAT', mat::text); PERFORM t.put('CW', cw::text);
END $$;

SELECT t.denied('design_versions not writable directly',
  format($q$INSERT INTO design_versions(tenant_id, design_id, version_no) VALUES (%L, %L, 99)$q$, t.get('T1'), t.get('D')), 'row-level security|permission');
SELECT t.denied('cross-tenant child rejected (colorway with foreign tenant_id)',
  format($q$INSERT INTO design_colorways(tenant_id, design_id, name) VALUES (%L, %L, 'x')$q$, t.get('T2'), t.get('D')), 'tenant|row-level security');

-- ---------------------------------------------------------------------
-- 2. Tech pack lifecycle
-- ---------------------------------------------------------------------
SELECT t.act(t.get('S'));
DO $$
DECLARE tp uuid; r tech_packs;
BEGIN
  tp := ds_create_tech_pack(t.get('D'), 'Boxy Tee tech pack', NULL, t.get('SR'), 'M');
  PERFORM t.put('TP', tp::text);
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom)
    VALUES (t.get('T1'), tp, t.get('MAT'), 'fabric', 'body', 'Body fabric', 1.2, 'm');
  INSERT INTO tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus)
    SELECT t.get('T1'), tp, t.get('POM'), s, 66 + i, 1, 1 FROM unnest(ARRAY['XS','S','M','L','XL']) WITH ORDINALITY u(s, i);
  r := ds_transition_tech_pack(tp, 'in_review', 'ready for review');
  PERFORM t.ok('staff can submit for review', r.status = 'in_review');
END $$;
SELECT t.denied('measurement with size outside range rejected',
  format($q$INSERT INTO tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus) VALUES (%L,%L,%L,'XXXL',80,1,1)$q$,
         t.get('T1'), t.get('TP'), t.get('POM')), 'size');
SELECT t.denied('status cannot be changed by direct UPDATE',
  format($q$UPDATE tech_packs SET status = 'approved', approved_by = %L, approved_at = now() WHERE id = %L$q$, t.get('S'), t.get('TP')), 'status|RPC|rpc');
SELECT t.denied('staff cannot approve', format($q$SELECT ds_transition_tech_pack(%L, 'approved')$q$, t.get('TP')), 'owner|admin|permission|not allowed');

SELECT t.act(t.get('O'));
DO $$
DECLARE r tech_packs;
BEGIN
  r := ds_transition_tech_pack(t.get('TP'), 'approved', 'approved for sourcing');
  PERFORM t.ok('owner approves', r.status = 'approved' AND r.approved_by = t.get('O'));
  PERFORM t.ok('approval locks the design version', (SELECT is_locked FROM design_versions WHERE id = r.version_id));
  PERFORM t.ok('approval queues PDF + watermarked preview jobs',
    (SELECT count(*) FROM craft_jobs WHERE subject_id = r.id AND kind IN ('techpack_pdf','techpack_preview_pdf')) = 2);
  PERFORM t.ok('revision snapshot written', (SELECT count(*) FROM tech_pack_revisions WHERE tech_pack_id = r.id) = 2);
END $$;
UPDATE design_versions SET canvas_state = '{}' WHERE id = t.get('DV2');   -- no UPDATE policy: silently 0 rows
SELECT t.ok('members cannot rewrite versions', (SELECT canvas_state FROM design_versions WHERE id = t.get('DV2')) <> '{}'::jsonb);
SELECT t.denied('BOM frozen after approval',
  format($q$UPDATE tech_pack_bom_lines SET quantity = 9 WHERE tech_pack_id = %L$q$, t.get('TP')), 'approved|draft|lines');
SELECT t.denied('approved tech pack cannot be deleted (children frozen)',
  format($q$DELETE FROM tech_packs WHERE id = %L$q$, t.get('TP')), 'archive it instead');
DELETE FROM tech_pack_revisions WHERE tech_pack_id = t.get('TP');       -- no DELETE policy: 0 rows
SELECT t.ok('members cannot delete revision log', t.cnt(format('SELECT 1 FROM tech_pack_revisions WHERE tech_pack_id = %L', t.get('TP'))) = 2);

-- ---------------------------------------------------------------------
-- 3. Worker produces assets (service role = superuser, no JWT)
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
SELECT t.denied('locked version immutable even for service role',
  format($q$UPDATE design_versions SET canvas_state = '{}' WHERE id = %L$q$, t.get('DV2')), 'lock');
SELECT t.denied('revision log append-only even for service role',
  format($q$DELETE FROM tech_pack_revisions WHERE tech_pack_id = %L$q$, t.get('TP')), 'append-only');
DO $$
DECLARE j craft_jobs; src uuid; prev uuid; img uuid;
BEGIN
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, mime_type)
    VALUES (t.get('T1'), t.get('D'), t.get('DV2'), 'mockup', t.get('T1') || '/designs/master.png', 'design-private', 'internal', 'image/png') RETURNING id INTO src;
  INSERT INTO design_assets(tenant_id, design_id, version_id, kind, storage_path, bucket, classification, derived_from_asset_id, mime_type, watermark)
    VALUES (t.get('T1'), t.get('D'), t.get('DV2'), 'mockup', t.get('T1') || '/previews/front.webp', 'supplier-previews', 'supplier_preview', src, 'image/webp', '{"tiled":true}') RETURNING id INTO img;
  INSERT INTO design_assets(tenant_id, design_id, kind, storage_path, bucket, classification, derived_from_asset_id, mime_type)
    VALUES (t.get('T1'), t.get('D'), 'techpack_pdf', t.get('T1') || '/previews/tp-r1.pdf', 'supplier-previews', 'supplier_preview', src, 'application/pdf') RETURNING id INTO prev;
  FOR j IN SELECT * FROM ds_claim_jobs('worker-1', ARRAY['techpack_preview_pdf'], 5) LOOP
    PERFORM ds_finish_job(j.id, 'worker-1', true, jsonb_build_object('asset_id', prev));
  END LOOP;
  PERFORM t.ok('worker finish wires preview PDF onto tech pack', (SELECT preview_pdf_asset_id FROM tech_packs WHERE id = t.get('TP')) = prev);
  PERFORM t.put('ASSET_INTERNAL', src::text); PERFORM t.put('ASSET_PREVIEW', img::text); PERFORM t.put('ASSET_TP_PREVIEW', prev::text);
END $$;
SELECT t.denied('supplier_preview must live in supplier-previews bucket',
  format($q$INSERT INTO design_assets(tenant_id, kind, storage_path, bucket, classification, derived_from_asset_id) VALUES (%L,'mockup','x/raw.png','design-assets','supplier_preview',%L)$q$,
         t.get('T1'), t.get('ASSET_INTERNAL')), 'class_bucket|check');

SELECT t.act(t.get('S'));
SELECT t.denied('authenticated users cannot claim worker jobs', $q$SELECT * FROM ds_claim_jobs('evil')$q$, 'permission');

-- ---------------------------------------------------------------------
-- 4. NDA + supplier onboarding
-- ---------------------------------------------------------------------
SELECT t.denied('staff cannot author NDAs',
  format($q$INSERT INTO ds_ndas(tenant_id, version, title, body_md, is_active) VALUES (%L, 1, 'x', 'y', true)$q$, t.get('T1')), 'row-level|permission');
SELECT t.act(t.get('O'));
DO $$
DECLARE inv jsonb; inv2 jsonb; n uuid;
BEGIN
  INSERT INTO ds_ndas(tenant_id, version, title, body_md, is_active)
    VALUES (t.get('T1'), 1, 'Mutual NDA v1', 'All designs, tech packs and pricing are confidential...', true) RETURNING id INTO n;
  PERFORM t.ok('NDA hash computed by trigger', length((SELECT body_sha256 FROM ds_ndas WHERE id = n)) = 64);
  inv  := ds_invite_supplier_user(t.get('V1'), 'Sales@Factory.test', 'estimator', 'Li Wei');
  inv2 := ds_invite_supplier_user(t.get('V2'), 'quotes@mill.test', 'estimator', 'Ana');
  PERFORM t.ok('invite returns one-time token', length(inv ->> 'token') = 64);
  PERFORM t.ok('only the token hash is stored',
    NOT EXISTS (SELECT 1 FROM supplier_portal_members WHERE invite_token_hash = inv ->> 'token'));
  PERFORM t.put('TOK1', inv ->> 'token'); PERFORM t.put('TOK2', inv2 ->> 'token'); PERFORM t.put('NDA', n::text);
END $$;
SELECT t.denied('NDA text immutable', format($q$UPDATE ds_ndas SET body_md = 'changed' WHERE id = %L$q$, t.get('NDA')), 'immutable');

SELECT t.act(t.get('EVIL'));
SELECT t.denied('invite token bound to invited email', format($q$SELECT supplier_accept_invite(%L)$q$, (SELECT v FROM t.ctx WHERE k='TOK1')), 'invited email');
SELECT t.act(t.get('SU'));
SELECT t.ok('supplier accepts invite (case-insensitive email)', (supplier_accept_invite((SELECT v FROM t.ctx WHERE k='TOK1')) ->> 'vendor_id')::uuid = t.get('V1'));
SELECT t.denied('invite token single-use', format($q$SELECT supplier_accept_invite(%L)$q$, (SELECT v FROM t.ctx WHERE k='TOK1')), 'invalid|expired');
SELECT t.act(t.get('SU2'));
SELECT supplier_accept_invite((SELECT v FROM t.ctx WHERE k='TOK2'));

-- ---------------------------------------------------------------------
-- 5. RFQ build + publish
-- ---------------------------------------------------------------------
SELECT t.act(t.get('S'));
DO $$
DECLARE r uuid;
BEGIN
  r := ds_create_rfq(t.get('T1'), 'SS27 Boxy Tee — 1,200 units', now() + interval '3 days', 'USD', 'FOB');
  PERFORM t.ok('RFQ picks up active NDA', (SELECT nda_id FROM rfqs WHERE id = r) = t.get('NDA'));
  INSERT INTO rfq_lines(tenant_id, rfq_id, line_no, tech_pack_id, colorway_id, quantity, size_breakdown, target_unit_cost)
    VALUES (t.get('T1'), r, 1, t.get('TP'), t.get('CW'), 1200, '{"S":300,"M":500,"L":400}', 6.10);
  PERFORM ds_invite_vendor_to_rfq(r, t.get('V1'));
  PERFORM ds_invite_vendor_to_rfq(r, t.get('V2'));
  PERFORM t.put('RFQ', r::text);
END $$;
DO $$ BEGIN PERFORM t.put('RL1', (SELECT id::text FROM rfq_lines WHERE rfq_id = t.get('RFQ'))); END $$;
SELECT t.denied('staff cannot publish', format($q$SELECT ds_publish_rfq(%L)$q$, t.get('RFQ')), 'owner|admin|permission|not allowed');
SELECT t.act(t.get('X'));
SELECT t.denied('other tenant cannot publish', format($q$SELECT ds_publish_rfq(%L)$q$, t.get('RFQ')), 'owner|admin|permission|not allowed');
SELECT t.ok('other tenant sees no RFQs', t.cnt('SELECT 1 FROM rfqs') = 0);
SELECT t.ok('other tenant sees no designs of T1', t.cnt(format('SELECT 1 FROM designs WHERE tenant_id = %L', t.get('T1'))) = 0);

SELECT t.act(t.get('SU'));
SELECT t.ok('supplier cannot see draft RFQ', jsonb_array_length(supplier_my_rfqs()) = 0);
SELECT t.act(t.get('O'));
SELECT t.ok('owner publishes', (ds_publish_rfq(t.get('RFQ'))).status = 'published');
SELECT t.denied('published RFQ lines frozen', format($q$UPDATE rfq_lines SET quantity = 5 WHERE rfq_id = %L$q$, t.get('RFQ')), 'draft');
SELECT t.denied('published RFQ not directly editable', format($q$UPDATE rfqs SET title = 'x' WHERE id = %L$q$, t.get('RFQ')), 'cannot be edited');

-- ---------------------------------------------------------------------
-- 6. Supplier experience: NDA gate, data minimisation, asset gate
-- ---------------------------------------------------------------------
SELECT t.act(t.get('SU'));
SELECT t.ok('supplier sees invited RFQ', jsonb_array_length(supplier_my_rfqs()) = 1);
SELECT t.denied('NDA required before RFQ details', format($q$SELECT supplier_get_rfq(%L)$q$, t.get('RFQ')), 'NDA_REQUIRED');
SELECT t.ok('NDA required before asset view', (supplier_authorize_asset_view(t.get('RFQ'), t.get('ASSET_PREVIEW')) ->> 'allowed')::boolean = false);
SELECT t.denied('NDA hash must match what was shown', format($q$SELECT supplier_accept_nda(%L, 'deadbeef', 'Li Wei')$q$, t.get('RFQ')), 'changed');
DO $$
DECLARE n jsonb := supplier_get_nda(t.get('RFQ')); v jsonb;
BEGIN
  PERFORM supplier_accept_nda(t.get('RFQ'), n ->> 'body_sha256', 'Li Wei', 'Sales Director');
  v := supplier_get_rfq(t.get('RFQ'));
  PERFORM t.ok('RFQ details after NDA', jsonb_array_length(v -> 'lines') = 1);
  PERFORM t.ok('target cost never sent to supplier', position('target_unit_cost' in v::text) = 0 AND position('6.1' in v::text) = 0);
  PERFORM t.ok('no storage paths sent to supplier', position('storage_path' in v::text) = 0 AND position('/previews/' in v::text) = 0);
  PERFORM t.ok('watermarked preview images listed', jsonb_array_length(v #> '{lines,0,tech_pack,preview_images}') = 2);
  v := supplier_authorize_asset_view(t.get('RFQ'), t.get('ASSET_PREVIEW'));
  PERFORM t.ok('preview authorized with per-viewer watermark', (v ->> 'allowed')::boolean AND v ->> 'bucket' = 'supplier-previews' AND v ->> 'watermark_text' LIKE '%sales@factory.test%');
END $$;
SELECT t.ok('internal master asset never authorized', (supplier_authorize_asset_view(t.get('RFQ'), t.get('ASSET_INTERNAL')) ->> 'allowed')::boolean = false);
SELECT t.ok('supplier reads no tables directly: designs',     t.cnt('SELECT 1 FROM designs') = 0);
SELECT t.ok('supplier reads no tables directly: assets',      t.cnt('SELECT 1 FROM design_assets') = 0);
SELECT t.ok('supplier reads no tables directly: tech packs',  t.cnt('SELECT 1 FROM tech_packs') = 0);
SELECT t.ok('supplier reads no tables directly: rfq_lines',   t.cnt('SELECT 1 FROM rfq_lines') = 0);
SELECT t.ok('supplier reads no tables directly: vendors',     t.cnt('SELECT 1 FROM acct_vendors') = 0);
SELECT t.ok('supplier reads no storage objects',              t.cnt('SELECT 1 FROM storage.objects') = 0);

-- bids
DO $$
DECLARE b uuid;
BEGIN
  b := supplier_save_bid(t.get('RFQ'), jsonb_build_object('lead_time_days', 60, 'payment_terms', '30/70', 'lines',
         jsonb_build_array(jsonb_build_object('rfq_line_id', t.get('RL1'), 'unit_price', 6.40, 'moq', 300, 'sample_cost', 40))));
  PERFORM supplier_submit_bid(b);
  PERFORM t.put('BID1', b::text);
  PERFORM t.ok('supplier sees own bid', (supplier_get_rfq(t.get('RFQ')) #>> '{my_bid,status}') = 'submitted');
  PERFORM t.ok('bid total computed from lines', (supplier_get_rfq(t.get('RFQ')) #>> '{my_bid,total_amount}')::numeric = 6.40 * 1200 + 40);
END $$;
UPDATE bids SET total_amount = 1 WHERE id = t.get('BID1');              -- no policy: 0 rows
SELECT t.ok('direct bid update affects nothing', t.cnt('SELECT 1 FROM bids') = 0);

SELECT t.act(t.get('SU2'));
SELECT t.denied('other supplier cannot touch a competitor bid', format($q$SELECT supplier_submit_bid(%L)$q$, t.get('BID1')), 'NDA_REQUIRED|not found');
DO $$
DECLARE n jsonb := supplier_get_nda(t.get('RFQ')); b uuid;
BEGIN
  PERFORM supplier_accept_nda(t.get('RFQ'), n ->> 'body_sha256', 'Ana Costa');
  PERFORM t.ok('competitor bid invisible to other supplier', supplier_get_rfq(t.get('RFQ')) -> 'my_bid' = 'null'::jsonb OR supplier_get_rfq(t.get('RFQ')) -> 'my_bid' IS NULL);
  PERFORM t.denied('cannot submit competitor bid after NDA', format($q$SELECT supplier_submit_bid(%L)$q$, t.get('BID1')), 'not found');
  b := supplier_save_bid(t.get('RFQ'), jsonb_build_object('lead_time_days', 45, 'lines',
         jsonb_build_array(jsonb_build_object('rfq_line_id', t.get('RL1'), 'unit_price', 7.10))));
  PERFORM supplier_submit_bid(b);
  PERFORM t.put('BID2', b::text);
  PERFORM supplier_ask_question(t.get('RFQ'), 'Is the neck rib 1x1 or 2x2?');
END $$;

-- ---------------------------------------------------------------------
-- 7. Sealed bids, close, award
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
SELECT t.ok('sealed: owner sees no bids before deadline/close', t.cnt('SELECT 1 FROM bids') = 0);
SELECT t.ok('sealed: owner sees no bid lines before close',     t.cnt('SELECT 1 FROM bid_lines') = 0);
SELECT t.denied('cannot award an open RFQ', format($q$SELECT ds_award_rfq(%L, '[]')$q$, t.get('RFQ')), 'close');
SELECT t.ok('owner closes', (ds_close_rfq(t.get('RFQ'))).status = 'closed');
SELECT t.ok('unsealed after close', t.cnt('SELECT 1 FROM bids WHERE status = ''submitted''') = 2);
DO $$
DECLARE res jsonb; po uuid;
BEGIN
  res := ds_award_rfq(t.get('RFQ'), jsonb_build_array(jsonb_build_object('rfq_line_id', t.get('RL1'), 'bid_id', t.get('BID1'))));
  po := (res #>> ARRAY['purchase_orders', t.get('V1')::text])::uuid;
  PERFORM t.ok('award creates draft PO for winner', (SELECT status = 'draft' AND vendor_id = t.get('V1') AND total = 6.40 * 1200 FROM erp_purchase_orders WHERE id = po));
  PERFORM t.ok('PO line from awarded bid', (SELECT count(*) FROM erp_purchase_order_lines WHERE purchase_order_id = po) = 1);
  PERFORM t.ok('RFQ awarded', (SELECT status FROM rfqs WHERE id = t.get('RFQ')) = 'awarded');
  PERFORM t.ok('loser bid rejected', (SELECT status FROM bids WHERE id = t.get('BID2')) = 'rejected');
  PERFORM t.ok('loser preview grant revoked', (SELECT revoked_at IS NOT NULL FROM asset_release_grants WHERE vendor_id = t.get('V2') AND level = 'preview'));
  PERFORM t.ok('winner production grant', EXISTS (SELECT 1 FROM asset_release_grants WHERE vendor_id = t.get('V1') AND level = 'production' AND revoked_at IS NULL));
END $$;

SELECT t.act(t.get('SU'));
SELECT t.ok('winner may download production pack', (supplier_authorize_release(t.get('TP')) ->> 'bucket') = 'production-releases');
SELECT t.act(t.get('SU2'));
SELECT t.ok('loser cannot download production pack', (supplier_authorize_release(t.get('TP')) ->> 'allowed')::boolean = false);
SELECT t.ok('loser loses preview access', (supplier_authorize_asset_view(t.get('RFQ'), t.get('ASSET_PREVIEW')) ->> 'allowed')::boolean = false);

-- ---------------------------------------------------------------------
-- 8. Audit trail + revocation
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
SELECT t.ok('access events recorded', t.cnt(format('SELECT 1 FROM ds_access_events WHERE rfq_id = %L', t.get('RFQ'))) >= 8);
SELECT t.ok('denied views are logged', t.cnt('SELECT 1 FROM ds_access_events WHERE event IN (''asset_view_denied'',''release_download_denied'')') >= 2);
DELETE FROM ds_access_events;                                            -- no policy: 0 rows
SELECT t.ok('members cannot delete audit log', t.cnt('SELECT 1 FROM ds_access_events') >= 8);
SELECT t.act(NULL);
SELECT t.denied('audit log append-only even for service role', 'UPDATE ds_access_events SET event = ''rfq_viewed''', 'append-only');
SELECT t.act(t.get('O'));
SELECT ds_revoke_supplier(t.get('V1'), 'contract ended');
SELECT t.act(t.get('SU'));
SELECT t.ok('revoked supplier sees nothing', jsonb_array_length(supplier_my_rfqs()) = 0);
SELECT t.ok('revoked supplier loses production access', (supplier_authorize_release(t.get('TP')) ->> 'allowed')::boolean = false);

-- ---------------------------------------------------------------------
-- 9. Anonymous access
-- ---------------------------------------------------------------------
SELECT t.act(NULL);
SET ROLE anon;
SELECT t.ok('anon sees no rfqs', t.cnt('SELECT 1 FROM rfqs') = 0);
SELECT t.denied('anon cannot call supplier RPCs', format($q$SELECT supplier_get_rfq(%L)$q$, t.get('RFQ')), 'permission');
RESET ROLE;

SELECT count(*) AS checks_passed FROM t.results WHERE ok;
