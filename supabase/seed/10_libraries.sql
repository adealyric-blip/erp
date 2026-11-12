-- 10_libraries.sql — dev season, size range, POMs, base material.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.ds_seasons (tenant_id, code, name, status)
VALUES ('11111111-1111-4111-8111-111111111111', 'SS27', 'Spring Summer 27', 'active')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.ds_size_ranges (tenant_id, name, sizes, base_size, unit)
VALUES ('11111111-1111-4111-8111-111111111111', 'Unisex XS-XL',
        ARRAY['XS','S','M','L','XL'], 'M', 'cm')
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.ds_pom_library (tenant_id, code, name, how_to_measure, category, sort) VALUES
  ('11111111-1111-4111-8111-111111111111', 'A',  'Body length from HPS', 'HPS to hem, garment flat', 'tops', 1),
  ('11111111-1111-4111-8111-111111111111', 'B',  'Chest width', 'Underarm to underarm, flat', 'tops', 2),
  ('11111111-1111-4111-8111-111111111111', 'C',  'Sleeve length', 'Shoulder point to cuff', 'tops', 3),
  ('11111111-1111-4111-8111-111111111111', 'D',  'Shoulder width', 'Shoulder point to shoulder point', 'tops', 4),
  ('11111111-1111-4111-8111-111111111111', 'E',  'Hem width', 'Hem edge to hem edge, flat', 'tops', 5),
  ('11111111-1111-4111-8111-111111111111', 'F',  'Hood height', 'Centre back neck to hood top', 'tops', 6),
  ('11111111-1111-4111-8111-111111111111', 'G',  'Crown height', 'Base of cap to crown top', 'headwear', 7),
  ('11111111-1111-4111-8111-111111111111', 'H',  'Visor length', 'Front seam to visor tip', 'headwear', 8)
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.ds_materials (tenant_id, kind, code, name, composition, weight_gsm, certifications)
VALUES ('11111111-1111-4111-8111-111111111111', 'fabric', 'JER-240', '240gsm jersey',
        '100% organic cotton', 240, ARRAY['GOTS', 'OEKO-TEX'])
ON CONFLICT (tenant_id, code) DO NOTHING;

COMMIT;
