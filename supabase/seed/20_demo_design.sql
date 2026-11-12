-- 20_demo_design.sql — the 3 garment templates T02 requires, with print areas.
-- Print areas are normalized (x/y/w/h in 0..1) plus real mm sizes, per plan/04
-- (PrintArea / GarmentPrintAreas). Front/back 12x16in = 305x406mm tees & hoodie;
-- sleeves 4x12in = 102x305mm; cap crown/visor in mm.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.ds_garment_templates
  (tenant_id, name, category, archetype, views, print_areas, size_range_id)
SELECT
  '11111111-1111-4111-8111-111111111111', 'Boxy tee', 'tops', 'APPAREL',
  ARRAY['front','back','left_sleeve','right_sleeve'],
  '{
    "front":       {"x":0.18,"y":0.20,"w":0.64,"h":0.60,"width_mm":300,"height_mm":400},
    "back":        {"x":0.18,"y":0.20,"w":0.64,"h":0.60,"width_mm":300,"height_mm":400},
    "left_sleeve": {"x":0.30,"y":0.20,"w":0.40,"h":0.60,"width_mm":102,"height_mm":305},
    "right_sleeve":{"x":0.30,"y":0.20,"w":0.40,"h":0.60,"width_mm":102,"height_mm":305}
  }'::jsonb,
  (SELECT id FROM public.ds_size_ranges
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND name = 'Unisex XS-XL')
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.ds_garment_templates
  (tenant_id, name, category, archetype, views, print_areas, size_range_id)
SELECT
  '11111111-1111-4111-8111-111111111111', 'Pullover hoodie', 'tops', 'APPAREL',
  ARRAY['front','back','left_sleeve','right_sleeve','hood'],
  '{
    "front":       {"x":0.17,"y":0.22,"w":0.66,"h":0.58,"width_mm":305,"height_mm":406},
    "back":        {"x":0.17,"y":0.22,"w":0.66,"h":0.58,"width_mm":305,"height_mm":406},
    "left_sleeve": {"x":0.30,"y":0.20,"w":0.40,"h":0.60,"width_mm":102,"height_mm":305},
    "right_sleeve":{"x":0.30,"y":0.20,"w":0.40,"h":0.60,"width_mm":102,"height_mm":305},
    "hood":        {"x":0.35,"y":0.05,"w":0.30,"h":0.25,"width_mm":200,"height_mm":180}
  }'::jsonb,
  (SELECT id FROM public.ds_size_ranges
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND name = 'Unisex XS-XL')
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO public.ds_garment_templates
  (tenant_id, name, category, archetype, views, print_areas, size_range_id)
SELECT
  '11111111-1111-4111-8111-111111111111', '6-panel cap', 'headwear', 'APPAREL',
  ARRAY['front','back','side'],
  '{
    "front": {"x":0.30,"y":0.25,"w":0.40,"h":0.35,"width_mm":110,"height_mm":90},
    "back":  {"x":0.30,"y":0.25,"w":0.40,"h":0.35,"width_mm":110,"height_mm":90},
    "side":  {"x":0.35,"y":0.30,"w":0.30,"h":0.30,"width_mm":90,"height_mm":80}
  }'::jsonb,
  (SELECT id FROM public.ds_size_ranges
    WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND name = 'Unisex XS-XL')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- One demo design on the boxy tee (no versions yet: versions are created
-- through ds_create_design_version by a signed-in member, see T06/T07).
INSERT INTO public.designs (tenant_id, name, style_number, source, season_id, garment_template_id)
SELECT
  '11111111-1111-4111-8111-111111111111', 'Boxy Tee — Atelier Logo', 'MT-27-001', 'konva',
  (SELECT id FROM public.ds_seasons WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND code = 'SS27'),
  (SELECT id FROM public.ds_garment_templates WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND name = 'Boxy tee')
WHERE NOT EXISTS (
  SELECT 1 FROM public.designs
  WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND style_number = 'MT-27-001'
);

COMMIT;
