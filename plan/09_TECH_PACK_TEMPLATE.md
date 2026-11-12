# 09 — Tech pack template (11 pages)

This is the tech pack the studio produces for every style and the template the suppliers receive (as a watermarked
preview during bidding, as the production pack after award). Runbook task: **T13b** (with T13). DB step: **S615** (spec below,
written by the T13b agent with its tests).

## Files in this folder
| File | What it is |
|---|---|
| `templates/techpack/blank_tech_pack_template.pdf` | Blank 11-page template, A4 landscape, fonts embedded. Print it, hand-fill it, or open it in Illustrator / VectorCraft |
| `templates/techpack/svg/01_…11_*.svg` | One SVG master per page, mm units (`viewBox 0 0 297 210`). These are what the renderer fills |
| `templates/techpack/build_template.py` | Rebuilds the SVGs + PDF (`pip install cairosvg pypdf`, Space Mono font installed) |

**About "AI":** Illustrator opens both the PDF and the SVGs as editable vectors; use File → Save As → Adobe Illustrator to get
a `.ai`. Keep the SVG as the master, because the field ids live there. If you restyle the template in Illustrator or VectorCraft,
export SVG again and don't rename the ids. The T13b validator rejects a template that lost a required id.

## Layout (every page)
- Title row: **TECH PACK** left, page title right, rule under it.
- Header block (identical on every page): brand logo box + 3 × 3 grid
  | | col 1 | col 2 | col 3 |
  |---|---|---|---|
  | row 1 | BRAND | DESIGNER | SIZE RANGE |
  | row 2 | SEASON | DATE | MAIN FABRIC |
  | row 3 | STYLE | CATEGORY | DESCRIPTION |
- Footer: confidentiality line, REV, STATUS, APPROVED BY, PAGE n / 11.
- `watermark` slot: empty on the internal master. On supplier copies PdfCraft stamps vendor · email · UTC time there and across the page.

## Template binding rules
- `data-field="x.y"` on `<text>`: the renderer writes the value as text (one line, shrink to fit, then ellipsis).
- `data-slot="x.y"` on `<rect>` or `<g>`: an image or flat is fitted inside the box (contain, centered). Flats come from
  `08_FLAT_LIBRARY.md` (the `silhouette`/`seams`/`stitches` layers, recolored for colorways).
- `data-repeat="name"` on `<g>` with `data-x/y/row-h/rows/cols/widths`: rows from the snapshot array. When there are more rows
  than fit, the page repeats as "MEASUREMENT CHART (2/2)" etc. and the page count in the footer updates.
- Header fields are the same ids on every page, so they're filled once.

## Pages and where each field comes from
| # | Page | What's on it | Data source |
|---|---|---|---|
| — | Header (all) | brand, season, style no, designer, date, category, size range, main fabric, description, logo | `tenants` (brand, logo), `ds_seasons.code`, `tech_packs.style_number`, `tech_packs.designer_id` → profile name, `tech_packs.updated_at` (or approval date), `ds_garment_templates.category`, `ds_size_ranges.sizes`, BOM line with `is_main_fabric`, `tech_packs.description` |
| 1 | Technical sketch | front + back flat; main fabric name + swatch; 2 Pantone chips; reference images | template flats (`sketch.front/back`), main-fabric `ds_materials` (`swatch_asset_id`, `composition`), default colorway `pantone_codes[0..1]`, `tech_packs.reference_asset_ids` |
| 2 | Construction details | front + back flat with numbered red leader callouts; table #, area, operation, ISO 4915 stitch, SPI, seam allowance, notes | `tech_pack_construction` + S615 callout anchors (`view`, `anchor_x/y`, `label_x/y`) |
| 3 | Measurement guide | flat with POM arrows (A, B, C…); POM code, description, how to measure | `tech_pack_pom_markers` (S615) defaulted from the flat's `callouts` layer; `ds_pom_library.how_to_measure`, `diagram_asset_id` |
| 4 | Measurement chart | POM × sizes (up to 8 per page), tol +/–, grade, unit, base size shaded | `tech_pack_measurements`, `ds_size_ranges` (size labels rename S1…S8), grade = per-size increment from the grading dialog |
| 5 | Bill of materials | #, component, placement, material code, description, composition/gsm, color, supplier, qty, UOM, unit cost | `tech_pack_bom_lines` ⨝ `ds_materials` ⨝ `acct_vendors`. **Unit cost is removed on supplier copies** |
| 6 | Material and trims | up to 12 swatch cards: name, code, composition, gsm, color, supplier, use | distinct `ds_materials` used by the BOM (fabric first, then trims) |
| 7 | Colorways | up to 4 colorway renders + body hex + Pantone; component × colorway color matrix | `design_colorways` + recolored flat; `tech_pack_colorway_components` (S615) |
| 8 | Artwork details | artwork image, placement on front/back flats, table: technique, W × H mm, offset from HPS/CF/hem, Pantone/thread, stitch count | `tech_pack_artwork` (already in S600) |
| 9 | Label details | main/brand, size, care/content, additional label: artwork, type, size mm, material, color, attachment, position, text; care: fibre %, country, care text, ISO 3758 symbols | `tech_pack_labels` (S615) |
| 10 | Hang tag | front + back artwork, spec (size, shape, stock/gsm, print, finish, eyelet, fastener + color, attach position, barcode/UPC, price, supplier, notes), attachment diagram | `tech_pack_hangtags` (S615) |
| 11 | Packaging | 4 folding steps with captions; polybag spec; carton spec (dimensions, ply, max weight, units per carton, size ratio, assortment, tape, markings); carton marking artwork | `tech_pack_packaging` (S615) |

## Supplier copy vs internal master
| | Internal master (`techpack_pdf`) | Supplier copy (`techpack_preview_pdf`, production release) |
|---|---|---|
| Unit cost column (p5) | shown | removed |
| RFQ target cost | never printed | never printed |
| Watermark | none | per viewer, every page, flattened |
| Copy / print | allowed | disabled during bidding; production release allows print |
| Images | full res | preview: downsampled; production release: full res |

## S615 spec (the T13b agent writes `db/S615_tech_pack_template.sql` + `db/S615_tests.sql`)
Same rules as S605/S610: new step file, registered `('615','ds4','S615_tech_pack_template.sql',18)`, `900` moves to 19,
idempotent, single transaction. Every new child table: `tenant_id NOT NULL`, member RLS through the registry, `updated_at`
trigger, and the S600 `ds__tp_child_guard` lock trigger, so nothing changes once the pack is approved.

**Column adds**
- `tech_packs`: `description text`, `designer_id uuid` FK auth.users, `reference_asset_ids uuid[] DEFAULT '{}'`,
  `measure_unit text DEFAULT 'cm' CHECK IN ('cm','in')`, `template_id uuid` FK `ds_tech_pack_templates`.
- `tech_pack_bom_lines.is_main_fabric boolean DEFAULT false` + partial unique index (one main fabric per pack).
- `tech_pack_construction`: `callout_no int`, `view text CHECK IN ('front','back','side','detail')`, `anchor_x`, `anchor_y`,
  `label_x`, `label_y numeric CHECK BETWEEN 0 AND 1` (normalized to the flat box).
- `tech_pack_measurements.grade numeric(8,2)` (increment shown in the GRADE column).

**New tables**
- `ds_tech_pack_templates`: tenant, name, version, `page_svg_asset_ids jsonb` (page id → asset), `pages text[]` (which of the 11
  are on), `is_default` (one per tenant). Mode: admin. Seeded with the files in this folder.
- `tech_pack_pom_markers`: tech pack, `pom_id`, `view`, `x1,y1,x2,y2` (arrow ends, normalized), `label_x,label_y`. Unique (tech pack, pom, view).
- `tech_pack_colorway_components`: tech pack, `colorway_id`, `bom_line_id`, `color_name`, `pantone`, `hex` (hex CHECK).
  Unique (tech pack, colorway, bom line); colorway must belong to the pack's design.
- `tech_pack_labels`: tech pack, `kind` (`main`,`size`,`care`,`content`,`flag`,`extra`), `label_type` (`woven`,`printed`,
  `heat_transfer`,`satin`,`leather`,`patch`,`other`), `material_id`, `width_mm`, `height_mm` (> 0), `color`, `attachment`
  (`sewn_in_seam`,`sewn_4_sides`,`loop`,`heat_seal`,`other`), `placement`, `text`, `fibre_content jsonb` (`[{fibre, pct}]`, pct sums
  to 100 when present), `country_of_origin char(2)`, `care_symbols text[]` (ISO 3758 codes), `artwork_asset_id`, `sort`.
- `tech_pack_hangtags`: tech pack, `front_asset_id`, `back_asset_id`, `width_mm`, `height_mm`, `shape`, `stock`, `gsm`,
  `print`, `finish`, `eyelet`, `fastener`, `fastener_color`, `placement`, `barcode_type` (`upc_a`,`ean_13`,`code_128`,`qr`),
  `barcode_value` (UPC-A/EAN-13 check digit validated), `retail_price numeric`, `currency char(3)`, `vendor_id`, `material_id`, `notes`.
- `tech_pack_packaging` (one per pack): `fold_steps jsonb` (≤ 4 × `{asset_id, text}`), polybag `size_mm`, `thickness_micron`,
  `material`, `closure`, `warning_text`, `print`, `sticker`, `units_per_bag`; carton `size_mm`, `ply`, `max_weight_kg`,
  `units_per_carton`, `size_ratio jsonb` (sizes must exist in the pack's size range, sum = units_per_carton), `assortment`
  (`solid`,`ratio`), `tape`, `markings_asset_id`.

**Snapshot and supplier view**
- `CREATE OR REPLACE ds_tech_pack_snapshot` adds `header`, `pom_markers`, `colorway_components`, `labels`, `hangtags`,
  `packaging`, `template`, keeping every existing key unchanged (S600 tests must still pass).
- `ds_tech_pack_supplier_snapshot(tp)` (new, SECURITY DEFINER, used only by the preview/release renderers) = the same JSON
  with `bom[].unit_cost`, `bom[].supplier_note` (internal), and any RFQ target cost stripped.

**S615_tests.sql must prove (at least):** child rows lock after approval (insert/update/delete all fail); two main fabrics
fail; a colorway from another design fails; size ratio with an unknown size or wrong sum fails; fibre % ≠ 100 fails; bad
UPC check digit fails; rival tenant and suppliers see none of the new tables; snapshot contains all 11 sections; supplier
snapshot has no `unit_cost`; S600, S605, S610 counts unchanged.

## Renderer (T13b + T14)
`packages/techpack-render` (pure TS): `fill(templateSvgs, snapshot, mode: 'internal'|'supplier') → svg[]`. Handles fields,
slots, repeats + continuation pages, callout leaders (red `#d62828`, dot at anchor, numbered label), POM arrows, base-size
shading, colorway recolor of the flat's `silhouette` fill. Then the render station's `techpack_pdf` job opens the filled pages
in DesignCraft and exports PDF/X-4; `techpack_preview_pdf` runs the supplier-mode fill and PdfCraft stamps + flattens.
If the T11 spike shows DesignCraft can't import SVG pages, use `svg2pdf.js` + `pdf-lib` in the same job (no server needed).
