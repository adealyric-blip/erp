// techpack-render — types (T13b). Pure TS: the renderer fills the 11-page
// SVG template from a ds_tech_pack_snapshot (or ds_tech_pack_supplier_
// snapshot) JSON. No DOM, no Craft dependency — it runs in Node (tests,
// server jobs) and in the browser (live preview, render station).
//
// Template binding rules (plan/09): data-field="x.y" on <text> writes the
// value; data-slot="x.y" on <rect>/<g> fits an image/flat (or a colour
// chip); data-repeat="name" on <g> with data-x/y/row-h/rows/cols/widths
// renders rows from the snapshot array, repeating the page when there are
// more rows than fit ("MEASUREMENT CHART (2/2)").

export type FillMode = 'internal' | 'supplier';

export interface TechPackSnapshot {
  tech_pack: Record<string, unknown>;
  design?: Record<string, unknown> | null;
  size_range?: Record<string, unknown> | null;
  header?: Record<string, unknown> | null;
  colorways?: Record<string, unknown>[];
  bom?: Record<string, unknown>[];
  measurements?: Record<string, unknown>[];
  construction?: Record<string, unknown>[];
  artwork?: Record<string, unknown>[];
  pom_markers?: Record<string, unknown>[];
  colorway_components?: Record<string, unknown>[];
  labels?: Record<string, unknown>[];
  hangtags?: Record<string, unknown>[];
  packaging?: Record<string, unknown> | null;
  template?: Record<string, unknown> | null;
  /** Optional enrichment the SQL snapshot does not carry yet (material
   *  code / composition / supplier name per BOM line, POM how-to text). */
  pom_library?: Record<string, unknown>[];
  [key: string]: unknown;
}

export interface FillOptions {
  /** Per-viewer watermark text, stamped on every page in supplier mode
   *  (plan/09: vendor · email · UTC time). */
  watermarkText?: string;
}

export interface FilledPage {
  /** 0-based page id from the template set ('sketch', 'construction', …). */
  pageId: string;
  /** 1-based page number in the emitted pack (continuation pages count). */
  pageNo: number;
  /** Total pages in the emitted pack. */
  totalPages: number;
  svg: string;
}

export interface FillResult {
  pages: FilledPage[];
  mode: FillMode;
}

export interface TemplateValidation {
  /** data-field ids present in the template with no value in the snapshot. */
  missingFields: string[];
  /** data-slot ids present with no image/colour data bound. */
  missingSlots: string[];
  /** data-repeat names present with an empty source array. */
  missingRepeats: string[];
}

/** The 11 template pages, in order. Filenames match plan/templates/techpack/svg/. */
export const TEMPLATE_PAGES = [
  { id: 'sketch', file: '01_technical_sketch.svg', title: 'TECHNICAL SKETCH' },
  { id: 'construction', file: '02_construction_details.svg', title: 'CONSTRUCTION DETAILS' },
  { id: 'measurement_guide', file: '03_measurement_guide.svg', title: 'MEASUREMENT GUIDE' },
  { id: 'measurement_chart', file: '04_measurement_chart.svg', title: 'MEASUREMENT CHART' },
  { id: 'bom', file: '05_bill_of_materials.svg', title: 'BILL OF MATERIALS' },
  { id: 'materials', file: '06_material_and_trims.svg', title: 'MATERIAL AND TRIMS' },
  { id: 'colorways', file: '07_colorways.svg', title: 'COLORWAYS' },
  { id: 'artwork', file: '08_artwork_details.svg', title: 'ARTWORK DETAILS' },
  { id: 'labels', file: '09_label_details.svg', title: 'LABEL DETAILS' },
  { id: 'hangtag', file: '10_hang_tag.svg', title: 'HANG TAG' },
  { id: 'packaging', file: '11_packaging.svg', title: 'PACKAGING' },
] as const;

export type TemplatePageId = (typeof TEMPLATE_PAGES)[number]['id'];

/** ISO 3758 care-symbol codes the LabelEditor offers (plan/09 §Labels). */
export const ISO_3758_SYMBOLS = [
  'wash_30', 'wash_40', 'wash_60', 'wash_hand', 'wash_no',
  'bleach_yes', 'bleach_no', 'bleach_nonchlorine',
  'tumble_low', 'tumble_medium', 'tumble_high', 'tumble_no',
  'dry_flat', 'dry_hang', 'dry_shade',
  'iron_low', 'iron_medium', 'iron_high', 'iron_no', 'iron_steam_no',
  'dryclean_yes', 'dryclean_no', 'dryclean_petroleum',
] as const;
