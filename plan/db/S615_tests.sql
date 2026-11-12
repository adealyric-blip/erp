-- =====================================================================
-- S615_tests.sql — 11-page tech pack template + S615 tables (T13b).
-- Run right after S610_tests.sql in the same throwaway database (reuses
-- its users, tenants and t.* helpers). Proves plan/09 §S615:
--   template table is admin-mode; one default per tenant; one main
--   fabric per pack; callout anchors are normalized 0..1; POM markers
--   unique per (pack, pom, view); colorway must belong to the pack's
--   design; fibre % must total 100; bad UPC check digit fails; carton
--   size ratio needs known sizes and the right sum; fold steps <= 4;
--   one packaging row per pack; all new child rows lock after approval
--   (insert/update/delete fail); rival tenant and suppliers see none of
--   the new tables; ds_create_tech_pack clones the new children;
--   snapshot contains all 11 sections; supplier snapshot has no
--   unit_cost / supplier_note; S600, S605, S610 counts unchanged
--   (the db:test run itself proves those).
--
-- NOTE: S600 already approved its fixture tech pack (t.get('TP')), so
-- the lock tests use TP directly; the guard tests use a fresh draft
-- pack TP2 built from a second design D2.
-- =====================================================================
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
DELETE FROM t.results;

-- ---------------------------------------------------------------------
-- 0. Fixtures: second design D2 (+ version, colorway) and a draft pack
-- ---------------------------------------------------------------------
SELECT t.act(t.get('S'));
DO $$
DECLARE d2 uuid; v uuid; cw2 uuid; tp2 uuid;
BEGIN
  INSERT INTO designs(tenant_id, name, style_number, source) VALUES (t.get('T1'), 'Boxy Tee — second colour', 'MT-27-002', 'vectorcraft') RETURNING id INTO d2;
  v := ds_create_design_version(d2, '{"layers":[]}'::jsonb, 'vectorcraft', NULL, NULL, 'v1');
  INSERT INTO design_colorways(tenant_id, design_id, name, garment_color_hex, pantone_codes) VALUES (t.get('T1'), d2, 'Ink', '#1F2430', ARRAY['19-4007 TCX']) RETURNING id INTO cw2;
  tp2 := ds_create_tech_pack(d2, 'Boxy Tee second colour pack', NULL, t.get('SR'), 'M');
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom, unit_cost, supplier_note)
    VALUES (t.get('T1'), tp2, t.get('MAT'), 'fabric', 'body', 'Body fabric', 1.2, 'm', 2.5, 'internal — do not share');
  PERFORM t.put('D2', d2::text); PERFORM t.put('CW2', cw2::text); PERFORM t.put('TP2', tp2::text);
END $$;

-- ---------------------------------------------------------------------
-- 1. Template table: admin-mode, one default per tenant
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE tpl uuid;
BEGIN
  INSERT INTO ds_tech_pack_templates(tenant_id, name, version, is_default)
    VALUES (t.get('T1'), 'Atelier 11-page master', 1, true) RETURNING id INTO tpl;
  PERFORM t.put('TPL', tpl::text);
END $$;
SELECT t.ok('owner can read templates', (SELECT count(*) FROM ds_tech_pack_templates WHERE tenant_id = t.get('T1')) = 1);
SELECT t.act(t.get('S'));
SELECT t.ok('staff (member) can read templates', (SELECT count(*) FROM ds_tech_pack_templates) = 1);
SELECT t.denied('staff cannot write templates',
  format($q$INSERT INTO ds_tech_pack_templates(tenant_id, name) VALUES (%L, 'rogue')$q$, t.get('T1')),
  'row-level security|permission');
SELECT t.act(t.get('O'));
SELECT t.denied('second default template is rejected',
  format($q$INSERT INTO ds_tech_pack_templates(tenant_id, name, is_default) VALUES (%L, 'second', true)$q$, t.get('T1')),
  'unique|duplicate');
SELECT t.act(t.get('X'));
SELECT t.ok('rival tenant sees no templates', t.cnt('SELECT 1 FROM ds_tech_pack_templates') = 0);
SELECT t.act(t.get('SU'));
SELECT t.ok('supplier sees no templates', t.cnt('SELECT 1 FROM ds_tech_pack_templates') = 0);
SELECT t.act(t.get('X'));
SELECT t.ok('rival sees no new child tables', t.cnt('SELECT 1 FROM tech_pack_labels') = 0 AND t.cnt('SELECT 1 FROM tech_pack_hangtags') = 0 AND t.cnt('SELECT 1 FROM tech_pack_packaging') = 0 AND t.cnt('SELECT 1 FROM tech_pack_pom_markers') = 0 AND t.cnt('SELECT 1 FROM tech_pack_colorway_components') = 0);

-- ---------------------------------------------------------------------
-- 2. Column adds: description / measure_unit / one main fabric
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE v_desc text; v_grade numeric;
BEGIN
  UPDATE tech_packs SET description = 'Boxy tee, dropped shoulder', measure_unit = 'cm' WHERE id = t.get('TP2') RETURNING description INTO v_desc;
  PERFORM t.ok('tech_packs.description is writable', v_desc = 'Boxy tee, dropped shoulder');
  INSERT INTO tech_pack_measurements(tenant_id, tech_pack_id, pom_id, size_label, value, tol_plus, tol_minus, grade)
    VALUES (t.get('T1'), t.get('TP2'), t.get('POM'), 'M', 68, 1, 1, 2) RETURNING grade INTO v_grade;
  PERFORM t.ok('grade column stores the per-size increment', v_grade = 2);
END $$;
SELECT t.denied('measure_unit outside cm/in is rejected',
  format($q$UPDATE tech_packs SET measure_unit = 'mm' WHERE id = %L$q$, t.get('TP2')), 'check constraint');
DO $$
DECLARE b1 uuid; b2 uuid;
BEGIN
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom, is_main_fabric)
    VALUES (t.get('T1'), t.get('TP2'), t.get('MAT'), 'fabric', 'body', 'Body fabric (main)', 1.2, 'm', true) RETURNING id INTO b1;
  PERFORM t.put('BOM1', b1::text);
  INSERT INTO tech_pack_bom_lines(tenant_id, tech_pack_id, material_id, kind, placement, description, quantity, uom)
    VALUES (t.get('T1'), t.get('TP2'), t.get('MAT'), 'trim', 'neck tape', 'Neck tape', 0.4, 'm') RETURNING id INTO b2;
  PERFORM t.put('BOM2', b2::text);
END $$;
SELECT t.denied('second main fabric is rejected',
  format($q$UPDATE tech_pack_bom_lines SET is_main_fabric = true WHERE id = %L$q$, t.get('BOM2')), 'unique|duplicate');
-- ---------------------------------------------------------------------
-- 3. Construction callouts: normalized anchors, unique callout_no
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE c uuid;
BEGIN
  INSERT INTO tech_pack_construction(tenant_id, tech_pack_id, area, operation, callout_no, view, anchor_x, anchor_y, label_x, label_y, sort)
    VALUES (t.get('T1'), t.get('TP2'), 'neckline', 'bind neck', 1, 'front', 0.5, 0.12, 0.8, 0.05, 1) RETURNING id INTO c;
  PERFORM t.put('CON1', c::text);
END $$;
SELECT t.denied('anchor outside 0..1 is rejected',
  format($q$INSERT INTO tech_pack_construction(tenant_id, tech_pack_id, area, operation, callout_no, anchor_x) VALUES (%L, %L, 'hem', 'coverstitch hem', 2, 1.5)$q$, t.get('T1'), t.get('TP2')),
  'check constraint');
SELECT t.denied('duplicate callout_no is rejected',
  format($q$INSERT INTO tech_pack_construction(tenant_id, tech_pack_id, area, operation, callout_no) VALUES (%L, %L, 'hem', 'coverstitch hem', 1)$q$, t.get('T1'), t.get('TP2')),
  'unique|duplicate');

-- ---------------------------------------------------------------------
-- 4. POM markers: insert ok, duplicate (pack, pom, view) rejected
-- ---------------------------------------------------------------------
DO $$
DECLARE m uuid;
BEGIN
  INSERT INTO tech_pack_pom_markers(tenant_id, tech_pack_id, pom_id, view, x1, y1, x2, y2, label_x, label_y)
    VALUES (t.get('T1'), t.get('TP2'), t.get('POM'), 'front', 0.3, 0.1, 0.3, 0.9, 0.35, 0.5) RETURNING id INTO m;
  PERFORM t.put('POMM', m::text);
END $$;
SELECT t.denied('duplicate pom marker is rejected',
  format($q$INSERT INTO tech_pack_pom_markers(tenant_id, tech_pack_id, pom_id, view, x1, y1, x2, y2) VALUES (%L, %L, %L, 'front', 0.3, 0.1, 0.3, 0.9)$q$, t.get('T1'), t.get('TP2'), t.get('POM')),
  'unique|duplicate');

-- ---------------------------------------------------------------------
-- 5. Colorway components: same-design ok, other-design rejected
-- ---------------------------------------------------------------------
DO $$
DECLARE c uuid;
BEGIN
  INSERT INTO tech_pack_colorway_components(tenant_id, tech_pack_id, colorway_id, bom_line_id, color_name, pantone, hex)
    VALUES (t.get('T1'), t.get('TP2'), t.get('CW2'), t.get('BOM1'), 'Ink', '19-4007 TCX', '#1F2430') RETURNING id INTO c;
  PERFORM t.put('CWC', c::text);
END $$;
SELECT t.denied('colorway from another design is rejected',
  format($q$INSERT INTO tech_pack_colorway_components(tenant_id, tech_pack_id, colorway_id, bom_line_id, color_name) VALUES (%L, %L, %L, %L, 'Bone')$q$, t.get('T1'), t.get('TP2'), t.get('CW'), t.get('BOM1')),
  'design');
SELECT t.denied('bad hex is rejected',
  format($q$INSERT INTO tech_pack_colorway_components(tenant_id, tech_pack_id, colorway_id, bom_line_id, hex) VALUES (%L, %L, %L, %L, 'red')$q$, t.get('T1'), t.get('TP2'), t.get('CW2'), t.get('BOM2')),
  'check constraint');

-- ---------------------------------------------------------------------
-- 6. Labels: fibre % must total 100
-- ---------------------------------------------------------------------
DO $$
DECLARE l uuid;
BEGIN
  INSERT INTO tech_pack_labels(tenant_id, tech_pack_id, kind, label_type, width_mm, height_mm, fibre_content, country_of_origin, care_symbols, sort)
    VALUES (t.get('T1'), t.get('TP2'), 'care', 'satin', 60, 30, '[{"fibre":"cotton","pct":60},{"fibre":"polyester","pct":40}]'::jsonb, 'US', ARRAY['wash_30','bleach_no','tumble_low','iron_low','dryclean_no'], 1)
    RETURNING id INTO l;
  PERFORM t.put('LBL', l::text);
END $$;
SELECT t.denied('fibre content totalling 90 is rejected',
  format($q$INSERT INTO tech_pack_labels(tenant_id, tech_pack_id, kind, fibre_content) VALUES (%L, %L, 'content', '[{"fibre":"cotton","pct":60},{"fibre":"polyester","pct":30}]'::jsonb)$q$, t.get('T1'), t.get('TP2')),
  'fibre|100');
SELECT t.denied('label with non-positive size is rejected',
  format($q$INSERT INTO tech_pack_labels(tenant_id, tech_pack_id, kind, width_mm) VALUES (%L, %L, 'main', 0)$q$, t.get('T1'), t.get('TP2')),
  'check constraint');

-- ---------------------------------------------------------------------
-- 7. Hang tags: UPC-A check digit
-- ---------------------------------------------------------------------
DO $$
DECLARE h uuid;
BEGIN
  INSERT INTO tech_pack_hangtags(tenant_id, tech_pack_id, width_mm, height_mm, barcode_type, barcode_value, retail_price, currency)
    VALUES (t.get('T1'), t.get('TP2'), 55, 85, 'upc_a', '036000291452', 48, 'USD') RETURNING id INTO h;
  PERFORM t.put('HT', h::text);
END $$;
SELECT t.denied('bad UPC check digit is rejected',
  format($q$INSERT INTO tech_pack_hangtags(tenant_id, tech_pack_id, barcode_type, barcode_value) VALUES (%L, %L, 'upc_a', '036000291453')$q$, t.get('T1'), t.get('TP2')),
  'barcode|check digit');
SELECT t.ok('EAN-13 check digit validates',
  ds__barcode_valid('ean_13', '4006381333931') AND NOT ds__barcode_valid('ean_13', '4006381333932'));

-- ---------------------------------------------------------------------
-- 8. Packaging: fold steps, size ratio, one row per pack
-- ---------------------------------------------------------------------
SELECT t.denied('5 fold steps are rejected',
  format($q$INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id, fold_steps) VALUES (%L, %L, '[{"text":"a"},{"text":"b"},{"text":"c"},{"text":"d"},{"text":"e"}]'::jsonb)$q$, t.get('T1'), t.get('TP2')),
  'fold steps');
SELECT t.denied('size ratio with an unknown size is rejected',
  format($q$INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id, carton_units, carton_size_ratio) VALUES (%L, %L, 12, '{"XXXL":12}'::jsonb)$q$, t.get('T1'), t.get('TP2')),
  'unknown size');
SELECT t.denied('size ratio with the wrong sum is rejected',
  format($q$INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id, carton_units, carton_size_ratio) VALUES (%L, %L, 12, '{"S":2,"M":2,"L":2}'::jsonb)$q$, t.get('T1'), t.get('TP2')),
  'sums to');
DO $$
DECLARE p uuid;
BEGIN
  INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id, fold_steps, polybag_size_mm, polybag_thickness_micron, polybag_material, carton_size_mm, carton_ply, carton_max_kg, carton_units, carton_size_ratio, carton_assortment)
    VALUES (t.get('T1'), t.get('TP2'), '[{"text":"Fold in half"},{"text":"Fold sleeves in"}]'::jsonb, '300x400', 50, 'LDPE', '400x300x200', 5, 12, 12, '{"S":4,"M":4,"L":4}'::jsonb, 'ratio')
    RETURNING id INTO p;
  PERFORM t.put('PKG', p::text);
END $$;
SELECT t.denied('second packaging row for the same pack is rejected',
  format($q$INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id) VALUES (%L, %L)$q$, t.get('T1'), t.get('TP2')),
  'unique|duplicate');

-- ---------------------------------------------------------------------
-- 9. Lock after approval: TP is approved (S600); new children are locked
-- ---------------------------------------------------------------------
SELECT t.act(t.get('S'));
SELECT t.denied('pom marker insert on approved pack fails',
  format($q$INSERT INTO tech_pack_pom_markers(tenant_id, tech_pack_id, pom_id, view, x1, y1, x2, y2) VALUES (%L, %L, %L, 'front', 0.3, 0.1, 0.3, 0.9)$q$, t.get('T1'), t.get('TP'), t.get('POM')),
  'approved|cannot be edited');
SELECT t.denied('label insert on approved pack fails',
  format($q$INSERT INTO tech_pack_labels(tenant_id, tech_pack_id, kind) VALUES (%L, %L, 'main')$q$, t.get('T1'), t.get('TP')),
  'approved|cannot be edited');
SELECT t.denied('hangtag insert on approved pack fails',
  format($q$INSERT INTO tech_pack_hangtags(tenant_id, tech_pack_id) VALUES (%L, %L)$q$, t.get('T1'), t.get('TP')),
  'approved|cannot be edited');
SELECT t.denied('packaging insert on approved pack fails',
  format($q$INSERT INTO tech_pack_packaging(tenant_id, tech_pack_id) VALUES (%L, %L)$q$, t.get('T1'), t.get('TP')),
  'approved|cannot be edited');
SELECT t.denied('colorway component insert on approved pack fails',
  format($q$INSERT INTO tech_pack_colorway_components(tenant_id, tech_pack_id, colorway_id, bom_line_id) VALUES (%L, %L, %L, %L)$q$, t.get('T1'), t.get('TP'), t.get('CW'), t.get('BOM1')),
  'approved|cannot be edited');

-- ---------------------------------------------------------------------
-- 10. Clone: archive TP2, create its successor, new children follow
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE tp2b uuid;
BEGIN
  PERFORM ds_transition_tech_pack(t.get('TP2'), 'archived', 'superseded by test');
  tp2b := ds_create_tech_pack(t.get('D2'), NULL, NULL, NULL, NULL);
  PERFORM t.put('TP2B', tp2b::text);
END $$;
SELECT t.ok('clone carries the pom marker', t.cnt(format('SELECT 1 FROM tech_pack_pom_markers WHERE tech_pack_id = %L', t.get('TP2B'))) = 1);
SELECT t.ok('clone carries the label', t.cnt(format('SELECT 1 FROM tech_pack_labels WHERE tech_pack_id = %L', t.get('TP2B'))) = 1);
SELECT t.ok('clone carries the hangtag', t.cnt(format('SELECT 1 FROM tech_pack_hangtags WHERE tech_pack_id = %L', t.get('TP2B'))) = 1);
SELECT t.ok('clone carries the packaging', t.cnt(format('SELECT 1 FROM tech_pack_packaging WHERE tech_pack_id = %L', t.get('TP2B'))) = 1);
SELECT t.ok('clone carries the colorway component on the new BOM line',
  t.cnt(format('SELECT 1 FROM tech_pack_colorway_components c JOIN tech_pack_bom_lines b ON b.id = c.bom_line_id WHERE c.tech_pack_id = %L AND b.tech_pack_id = %L', t.get('TP2B'), t.get('TP2B'))) = 1);
SELECT t.ok('clone carries the description and grade',
  (SELECT description FROM tech_packs WHERE id = t.get('TP2B')) = 'Boxy tee, dropped shoulder'
  AND (SELECT count(*) FROM tech_pack_measurements WHERE tech_pack_id = t.get('TP2B') AND grade = 2) = 1);

-- ---------------------------------------------------------------------
-- 11. Snapshots: all 11 sections; supplier snapshot strips costs
-- ---------------------------------------------------------------------
SELECT t.act(t.get('O'));
DO $$
DECLARE v jsonb; s jsonb;
BEGIN
  UPDATE tech_packs SET template_id = t.get('TPL') WHERE id = t.get('TP2B');
  v := ds_tech_pack_snapshot(t.get('TP2B'));
  PERFORM t.ok('snapshot has the S600 keys', v ? 'tech_pack' AND v ? 'design' AND v ? 'size_range' AND v ? 'colorways' AND v ? 'bom' AND v ? 'measurements' AND v ? 'construction' AND v ? 'artwork');
  PERFORM t.ok('snapshot has the S615 keys', v ? 'header' AND v ? 'pom_markers' AND v ? 'colorway_components' AND v ? 'labels' AND v ? 'hangtags' AND v ? 'packaging' AND v ? 'template');
  PERFORM t.ok('snapshot header carries style + main fabric', (v -> 'header' ->> 'style_number') = 'MT-27-002' AND (v -> 'header' -> 'main_fabric' ->> 'description') = 'Body fabric (main)');
  PERFORM t.ok('snapshot measurement carries the grade', (v -> 'measurements' -> 0 ->> 'grade')::numeric = 2);
  s := ds_tech_pack_supplier_snapshot(t.get('TP2B'));
  PERFORM t.ok('supplier snapshot has no unit_cost', s::text NOT LIKE '%unit_cost%');
  PERFORM t.ok('supplier snapshot has no supplier_note', s::text NOT LIKE '%supplier_note%');
  PERFORM t.ok('internal snapshot keeps unit_cost', v::text LIKE '%unit_cost%');
END $$;

SELECT count(*) AS s615_checks_passed FROM t.results WHERE ok;
