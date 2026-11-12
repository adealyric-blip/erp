# 08 — Flat library: what you mock up on

The studio needs blanks before anyone can design. This file says where those blanks come from, who owns them, and how the
render pipeline uses them. Runbook task: **T10b** (after T10, before T13). DB step: **S610** (written by the T10b agent).

## The rule
Every flat, mockup base, and 3D model in the studio has a **license record**. The proxy and the RFQ publish step check it.
A file that isn't cleared for supplier viewing never reaches a supplier, even as a watermarked preview.

## Where the blanks come from (priority order)
| # | Source | What you get | License | How it's used |
|---|---|---|---|---|
| 1 | **Parametric flats (built by us, T10b)** | ~12 core blanks generated from your own POM, size range, and grading tables | `owned` — yours outright | Default for everything: designing, tech packs, supplier previews, production release |
| 2 | **VecFashion** (free pack, 140 flats for an email; paid packs) | Illustrator CC / EPS / PDF / JPEG flats | `licensed_commercial`, no redistribution; showing your designs to manufacturers is allowed ([FAQ](https://vecfashion.com/pages/faqs), [free pack](https://vecfashion.com/blogs/news/60-new-free-vector-fashion-flat-sketches-just-dropped)) | Import as tenant-only assets. Fine inside tech packs sent to your suppliers. Never offered as a downloadable template |
| 3 | **FashionDesign411 / Designers Nexus** (membership, 250+ flats) | AI / SVG / PNG flats | `licensed_commercial`, no redistribution "as templates, clip-art, downloads" ([terms](https://www.designersnexus.com/terms-of-service/), [site](https://www.fashiondesign411.com/)) | Same as VecFashion |
| 4 | **OpenTechPack** (Coats Digital, MIT) | Only `seams/example1.svg` and `tools/tape.svg`; no garment flats ([repo](https://github.com/coatsdigital/opentechpack)) | `open_source` (MIT) | Seam and stitch symbol references for the `seams` / `stitches` layers |
| 5 | **Printful mockups** (34 models already imported) | Photo mockups: base + shading + mask | `vendor_restricted` — "may only be used in connection with... Printful's Products and may not be used... in conjunction with products from other manufacturers" ([Printful ToS §4.6](https://www.printful.com/policies/download/terms-of-service)) | Keep, tag `printful_only`. Only for Printful-fulfilled products. **Blocked** from RFQs, supplier previews, and production release |
| — | AI TechPacks | Paid SaaS, not an open library ([site](https://aitechpacks.com/)) | n/a | Not used |

Reference code worth reading (not copying blind): [morfemartin/techpack-ai-builder](https://github.com/morfemartin/techpack-ai-builder)
(open-source SVG tech pack generator). Check its license file at the pinned SHA before reusing any code.

## Splitting bundles into single designable pieces (T10c)
VecFashion sells by category (Men 577, Women 625, Kids 131, plus bags, hats, footwear, add-ons), and many downloads hold
several things in one file: front + back, several style variants, or a whole **Fashion Set** ("coordinated tops, bottoms, and
outerwear pieces styled together", [VecFashion Fashion Sets](https://vecfashion.com/collections/fashion-sets)). Each download
comes as Illustrator CC, EPS 10, PDF, and JPEG ([example product](https://vecfashion.com/products/mens-cargo-shorts-bermuda-length)).
VecFashion doesn't document how files are layered or grouped, so the splitter can't assume a structure. It tries several
strategies and a person confirms the result.

Splitting for your own use is editing, which their FAQ allows (files are "fully editable"). What's banned is reselling or
redistributing the vectors. Sending a finished design to a manufacturer is explicitly fine ([VecFashion FAQ](https://vecfashion.com/pages/faqs)).
So every split piece **inherits the bundle's license row** (`allow_redistribution = false`), and suppliers only ever see the
finished design as a watermarked preview or production pack, never the raw piece file.

### Pipeline (runs on the render station, job kind `flat_split`)
1. **Upload the bundle.** Library → Flats → Import → drop the PDF (preferred: present in every download, opens most reliably)
   or the `.ai` / `.eps`, or a zip of many. Pick the license record. Original goes to `design-private`, classification `internal`.
   Zips are expanded and each file becomes its own batch item. Bulk folders of hundreds of files are fine; jobs queue.
2. **Normalize to SVG.** VectorCraft web build opens the file and exports SVG (T11 spike must confirm AI/EPS/PDF import; if EPS
   fails in WASM, that one conversion goes to `runner='server'` with Ghostscript on the Lightsail worker).
3. **Find the pieces**, trying in order and keeping the first strategy that gives a clean answer:
   a. **Artboards / PDF pages** — one artboard = one candidate.
   b. **Named layers** — layers named like Front, Back, Side, Detail, or a garment name.
   c. **Top-level groups** — each top-level `<g>` whose bounding box doesn't overlap another.
   d. **Spatial clustering** — for flattened files: rasterize at low res, find connected regions (gaps > 2% of page width
      separate garments), map paths back to the region they fall in.
   Text labels ("FRONT", "BACK", style names) and VecFashion watermark/logo text are detected and dropped from the piece but kept
   as hints.
4. **Classify each piece.** View (front / back / side / detail) from the label hints, else from shape: a front and back of the
   same garment have nearly the same outline width and height and sit side by side, so they get the same `pair_key`. Category
   (tee, hoodie, short, …) comes from the source category plus the file name; staff confirm it.
5. **Rebuild into the layer standard.** For each piece:
   - `silhouette` = boolean union of all filled closed paths (paper.js / Clipper), keep the largest outer ring; if the union is
     messy, fall back to tracing the outer contour of the raster mask and simplifying it.
   - Dashed strokes → `stitches`; other interior strokes → `seams`; small closed shapes near edges (buttons, zipper pulls,
     labels) → `trims`. Anything unclassified stays in `seams` so nothing is lost.
   - `print_areas` start from the category defaults (e.g. tee front chest 300 × 400 mm), shown for staff to drag into place.
   - `callouts` empty until POMs are mapped in the tech pack.
6. **Set real-world scale.** VecFashion flats aren't drawn to a size. Staff enter one known measurement for the base size
   (e.g. half chest = 54 cm, or waist = 42 cm); the piece is scaled to mm so print areas and placements are true size.
   Front and back in a pair share one scale.
7. **Review screen** (`/studio/library/flats/import/[batchId]`): grid of proposed pieces over the original page. Staff can
   accept, reject, merge two pieces, split one by drawing a line, fix the view, pair or unpair, set category and scale.
   Accept creates a `ds_garment_templates` row (views from the pair) with the piece SVGs as flat assets, `derived_from_asset_id`
   pointing at the bundle, and the bundle's `license_id`.
8. **Fashion Sets** produce several templates (one per garment) plus an optional "set" grouping so you can still view the look
   together.

Done right, one Fashion Set file becomes, say, a hoodie template (front + back), a jogger template (front + back) and a jacket
template (front + back), each designable on its own in the canvas and in VectorCraft.

### What the splitter must never do
- Never auto-accept. A person approves every piece before it shows up in the designer.
- Never strip the license link or let a piece be downloaded as a file outside staff routes.
- Never send the original bundle or a raw piece SVG to a supplier.

## Core blanks to generate (T10b)
Men's/unisex first, each with front + back views (sleeves where relevant):

1. Classic tee 2. Oversized / boxy tee 3. Long-sleeve tee 4. Pullover hoodie 5. Zip hoodie 6. Crewneck sweatshirt
7. Jogger 8. Cargo pant 9. Short 10. Denim / trucker jacket 11. Polo 12. 6-panel cap

## How a parametric flat is built
Input: a garment template's `block` JSON (key measurements of the base size, from `ds_pom_library` + `ds_size_ranges`) plus
style options (neck: crew/v/mock; sleeve: set-in/raglan/drop; hem: straight/curved/rib; pockets; hood; closure).

Output: one SVG per view in mm units (`viewBox` = real mm at base size), with these **fixed layer ids** (`<g id="...">`):

| Layer id | Contents | Used by |
|---|---|---|
| `silhouette` | single closed outer path, filled | the **mask** in the mockup render; 3D UV reference |
| `seams` | seam lines (stroke only) | tech pack, VectorCraft editing |
| `stitches` | topstitch / coverstitch (dashed) | tech pack |
| `trims` | rib, zipper, drawcord, buttons, labels | tech pack, BOM callouts |
| `print_areas` | one `<rect data-area="front">` etc. per print area, mm-accurate | the Konva print-area overlay; writes `ds_garment_templates.print_areas` |
| `callouts` | POM arrows + codes (A, B, C…) tied to `ds_pom_library.code` | tech pack measurement page |
| `shading` | optional fold/shadow paths, grey, for the multiply layer | the **realism / wash** layer |

Grading: the same generator re-runs for every size in the range using the grade rules, so the size-set flats and the POM
table always agree. Changing a measurement re-generates the flat; it never drifts.

The generator lives in `packages/flat-gen` (pure TypeScript, no DOM, runs in Node, the browser, and the render station).
It's a registry command, so the MCP gateway gets it for free: `flat.generate`, `flat.grade`, `flat.import`.

## How the render uses a flat (same three layers as the mockups)
1. **Silhouette mask** — the `silhouette` layer (flats) or the mask PNG (photo mockups). Everything below is clipped to it.
2. **Artwork layer** — the design (AOP, spot prints, embroidery preview), clipped to the mask and placed inside the `print_areas`.
   AOP tiles across the whole silhouette; spots stay inside their rect.
3. **Realism / wash overlay** — the `shading` layer or shading PNG set to multiply (folds, wash, garment dye), plus the base
   colorway fill under everything.

Same code path for flats and photo mockups, so a design made on a flat drops onto a licensed photo mockup with no rework.

## S610 spec (the T10b agent writes `db/S610_flat_library.sql` + `db/S610_tests.sql`)
Follow the S605 pattern: register `('610','ds3','S610_flat_library.sql',17)` in `unify.step_order`, move `900` to pos 18,
`unify.require('610')` … `unify.done('610')`, idempotent, single transaction.

**New table `ds_asset_licenses`** (mode: admin — owners/admins write, members read):
| Column | Type / rule |
|---|---|
| `id`, `tenant_id` | uuid; tenant NOT NULL, FK tenants ON DELETE CASCADE |
| `source` | text NOT NULL CHECK IN (`generated`,`vecfashion`,`fashiondesign411`,`opentechpack`,`printful`,`other`) |
| `license_type` | text NOT NULL CHECK IN (`owned`,`open_source`,`licensed_commercial`,`vendor_restricted`) |
| `license_name` | text (e.g. "MIT", "VecFashion Standard", "Printful ToS") |
| `license_url` | text, required unless `license_type='owned'` |
| `proof_asset_id` | uuid FK design_assets — receipt / license PDF (internal bucket) |
| `allow_supplier_view` | boolean NOT NULL — may appear in watermarked supplier previews and tech packs sent to suppliers |
| `allow_redistribution` | boolean NOT NULL DEFAULT false — may be given out as a template file |
| `restricted_to_vendor_id` | uuid FK acct_vendors, NULL unless the license limits use to one vendor's products |
| `acquired_at`, `expires_at`, `notes`, `created_by`, timestamps | standard |
| CHECKs | `vendor_restricted` ⇒ `restricted_to_vendor_id IS NOT NULL` and `allow_supplier_view = false`; `owned` ⇒ `source='generated'` |

**Import tables (for T10c)**
- `ds_flat_import_batches`: tenant, `source_asset_id` (the bundle, internal), `license_id` NOT NULL, `source_category` text,
  `status` (`queued`,`splitting`,`review`,`done`,`failed`), `strategy` (`artboard`,`layer`,`group`,`cluster`), `piece_count`,
  `error`, `created_by`, timestamps. Mode: member.
- `ds_flat_pieces`: tenant, `batch_id` FK ON DELETE CASCADE, `source_ref` (artboard/page/layer/group id or cluster no.),
  `bbox jsonb`, `view` CHECK IN (`front`,`back`,`side`,`detail`), `category`, `pair_key`, `scale_mm_per_unit numeric`,
  `svg_asset_id` FK design_assets, `status` (`proposed`,`accepted`,`rejected`,`merged`), `template_id` FK ds_garment_templates,
  `reviewed_by`, `reviewed_at`. Mode: member. Trigger: `svg_asset_id`'s `license_id` must equal the batch's `license_id`;
  `status='accepted'` requires `category`, `view`, `scale_mm_per_unit`, and `reviewed_by`.

**Column adds**
- `design_assets.license_id uuid` FK `ds_asset_licenses` ON DELETE RESTRICT.
- `ds_garment_templates.license_id uuid` FK, `block jsonb`, `style_options jsonb`, `generator_version text`.
- `ds_garment_templates.license_scope text GENERATED` from the license: `owned` / `licensed` / `printful_only` (`vendor_restricted`) / `unlicensed`.

**Rules (triggers / RPC checks)**
1. Inserting or updating a `design_assets` row with `classification IN ('supplier_preview','production_release')` fails if the
   asset or its `derived_from_asset_id` chain links to a license with `allow_supplier_view = false`.
2. `ds_publish_rfq` (S600) gets a wrapper check: an RFQ line whose design's garment template is `printful_only` or `unlicensed`
   cannot be published. Error code `DS_LICENSE_BLOCKED`.
3. `supplier_authorize_asset_view` and `supplier_authorize_release` deny (return `allowed:false`, logged) if the asset's license chain is not supplier-viewable. Raw `flat_sketch` piece assets from an import batch are always denied to suppliers; only finished previews pass.
4. Back-fill: every existing Printful import gets one `printful` license row (`vendor_restricted`, linked to the Printful vendor
   row) and its assets/templates point at it. Anything left without a license is `unlicensed` and stays staff-only.
5. Licenses can't be deleted while referenced; `expires_at` in the past makes the asset behave as `allow_supplier_view=false`.

**S610_tests.sql must prove (at least):** staff can read but not write licenses; owner can; rival tenant sees nothing;
supplier sees nothing; a `vendor_restricted` license with `allow_supplier_view=true` is rejected; a supplier preview derived
from a Printful asset is rejected; an RFQ on a `printful_only` template can't publish; one on a generated flat can;
`supplier_authorize_asset_view` / `supplier_authorize_release` deny and log for a restricted asset; expired license blocks; S600 (82) and S605 (17) still pass.

## Owner actions (you)
- Download the VecFashion free pack and any FashionDesign411 files you've paid for; keep the receipt/license PDF. Upload them
  through **Library → Flats → Import licensed flat**, which forces you to pick the license record.
- Don't upload anything you only have a screenshot or trial of.
