// split/types.ts — T10c flat splitter types (plan/08 §Splitting bundles).
// Pure TypeScript, no DOM: runs in Node, the browser, and the render station.
// A bundle is one or more normalized SVG pages (VectorCraft SVG export,
// T11 spike: document.export {format:'svg'} is browser-verified). The
// splitter tries strategies in order — artboard → layer → group → cluster —
// and keeps the first that gives a clean answer. A person approves every
// piece before it becomes a template; nothing auto-accepts.

export type SplitStrategy = 'artboard' | 'layer' | 'group' | 'cluster';

export type PieceView = 'front' | 'back' | 'side' | 'detail';

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One normalized SVG page (one PDF page / one artboard file). */
export interface SvgPage {
  /** Page/artboard index, 0-based. */
  pageIndex: number;
  /** Full SVG document text (VectorCraft export, or a fixture). */
  svg: string;
  /**
   * Low-res ink raster of the page (plan/08 step 3d: "rasterize at low
   * res, find connected regions"). Required for bundles whose artwork is
   * raster (most bought VecFashion PDFs embed the flats as images — the
   * normalized SVG then holds <image> tiles and almost no vector paths).
   * `ink` is 1 byte per pixel (1 = ink), row-major, `width`×`height`
   * pixels covering the page's viewBox. In the browser the render
   * station produces it from a canvas; in Node tests, from pdftoppm.
   */
  raster?: PageRaster;
}

/** Low-res ink raster of one page. */
export interface PageRaster {
  width: number;
  height: number;
  ink: Uint8Array;
}

export interface SplitPiece {
  /** Stable id within the split run: `<strategy>-<n>`. */
  id: string;
  /** What produced it: artboard/page id, layer name, group id, or cluster no. */
  sourceRef: string;
  /** Page the piece came from. */
  pageIndex: number;
  bbox: BBox;
  view: PieceView;
  /** True when the view came from a text label ("FRONT"/"BACK"); the
   * review screen shows these as confirmed, position-derived views as
   * guesses staff should check. */
  viewFromLabel: boolean;
  /** front/back of one garment share a pair_key; side/detail stand alone. */
  pairKey: string | null;
  category: string;
  /** Rebuilt 7-layer SVG in SOURCE units (pt for VecFashion PDFs). */
  svg: string;
  /** Same SVG re-expressed in real mm once a scale is known (null until then). */
  svgMm: string | null;
  /** mm per source unit; null until staff calibrate (flat.piece.scale). */
  scaleMmPerUnit: number | null;
  /** How the silhouette was produced. */
  silhouetteSource: 'union-trace' | 'bbox-fallback';
  /** Which strategy level produced this piece (view-split inside a group etc.). */
  strategy: SplitStrategy;
  /** Human-readable notes, e.g. watermark text dropped, fallback used. */
  notes: string[];
}

export interface SplitResult {
  strategy: SplitStrategy;
  /** The strategy that produced the pieces (a group candidate may still
   * sub-split its views by clustering — that stays the group strategy). */
  pieces: SplitPiece[];
  /** Page size in source units, per page. */
  pageSize: { w: number; h: number };
  warnings: string[];
}

/** Category print-area defaults (mm), plan/08: e.g. tee front chest 300x400. */
export const PRINT_AREA_DEFAULTS_MM: Record<string, { w: number; h: number }> = {
  tee: { w: 300, h: 400 },
  hoodie: { w: 300, h: 400 },
  sweatshirt: { w: 300, h: 400 },
  polo: { w: 280, h: 350 },
  jacket: { w: 300, h: 400 },
  short: { w: 280, h: 350 },
  pant: { w: 280, h: 380 },
  jogger: { w: 280, h: 380 },
  cap: { w: 150, h: 120 },
  default: { w: 280, h: 350 },
};

export function printAreaDefaultMm(category: string): { w: number; h: number } {
  const key = category.trim().toLowerCase();
  return PRINT_AREA_DEFAULTS_MM[key] ?? PRINT_AREA_DEFAULTS_MM.default;
}
