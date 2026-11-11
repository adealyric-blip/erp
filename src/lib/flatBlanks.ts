/**
 * Flat blanks — the design surface for the studio canvas and preview.
 *
 * RULE (Jaizon): a human-model photo is a RENDER only, never the design
 * surface. The design surface is the FLAT: the vector tech-pack flat for
 * the product's designable pieces, each with its own dashed print-area
 * box. The canvas and preview default to the flat; the model photo is an
 * explicit opt-in "Model (render only)" surface.
 *
 * What exists today:
 * - Hugo Hoodie (FreeSewing v4.10.2, product_designs
 *   fc41cb95-e066-4545-a17d-4446632d4d40): per-piece pill flats with dashed
 *   print boxes — front/back 12x16in, sleeves 4x12in — in
 *   public/flats/hugo-hoodie/. Served same-origin so the canvas <img>
 *   loads them with no signed URL and no supplier hotlink.
 * - Brian Tee / Dress Block (product_designs): only the full PATTERN
 *   SHEET svg is on file. A pattern sheet is the cutting layout, NOT a
 *   flat technical, so neither is a design surface and neither is mapped
 *   here. Per-piece tee/dress flats are still missing — when they land,
 *   add a second entry below in the same shape.
 * - Every other blank: no flat on file. The surface falls back to the
 *   flat SKELETON — the same honest flat garment-color panel the render
 *   worker already draws server-side for skeleton renders (a 450x600
 *   panel in the garment color, print box from the placement's real
 *   inches). Never a model photo.
 *
 * Geometry note: the Hugo flats are drawn at 25.4 SVG units per inch
 * (front dashed rect 304.8 x 406.4 units = 12 x 16 in; sleeve dashed
 * rect 101.6 x 304.8 units = 4 x 12 in). The numbers below are measured
 * straight from the SVG files (viewBox + dashed <rect>), not estimated.
 */

export type FlatSurface = 'flat' | 'techpack' | 'model';

export const FLAT_SURFACE_LABELS: Record<FlatSurface, string> = {
  flat: 'Flat',
  techpack: 'Tech Pack',
  model: 'Model',
};

/** One designable piece of a flat (front / back / sleeve). */
export interface FlatPiece {
  /** Placement key the canvas pills use (placementBase form). */
  key: string;
  label: string;
  /** White-background pill flat (Tech Pack view). */
  techpackUrl: string;
  /** #e9e5dc-background flat (Muted Canvas view). */
  mutedUrl: string;
  /** The SVG viewBox the piece is drawn in. */
  viewBox: { x: number; y: number; w: number; h: number };
  /** The SVG's intrinsic size (width/height attrs) — the <img> natural size. */
  natural: { w: number; h: number };
  /** The dashed print-area rect, in viewBox units (measured from the file). */
  printRectUnits: { x: number; y: number; w: number; h: number };
  /** The print area in real inches (printed on the flat itself). */
  printIn: { w: number; h: number };
}

export interface FlatDesign {
  /** product_designs.id this flat was built from. */
  designId: string;
  name: string;
  /** Blank-name test — the flat applies to blanks whose name matches. */
  match: RegExp;
  pieces: FlatPiece[];
}

const HUGO_DIR = '/flats/hugo-hoodie';

export const HUGO_HOODIE: FlatDesign = {
  designId: 'fc41cb95-e066-4545-a17d-4446632d4d40',
  name: 'Hugo Hoodie — FreeSewing v4.10.2',
  match: /hoodie/i,
  pieces: [
    {
      key: 'front',
      label: 'Front',
      techpackUrl: `${HUGO_DIR}/front.svg`,
      mutedUrl: `${HUGO_DIR}/muted-canvas-front.svg`,
      viewBox: { x: -310.6, y: -4.4, w: 621.2, h: 587.4 },
      natural: { w: 520, h: 492 },
      printRectUnits: { x: -152.4, y: 71.8, w: 304.8, h: 406.4 },
      printIn: { w: 12, h: 16 },
    },
    {
      key: 'back',
      label: 'Back',
      techpackUrl: `${HUGO_DIR}/back.svg`,
      mutedUrl: `${HUGO_DIR}/muted-canvas-back.svg`,
      viewBox: { x: -310.6, y: -12.1, w: 621.2, h: 595.1 },
      natural: { w: 520, h: 498 },
      printRectUnits: { x: -152.4, y: 64.9, w: 304.8, h: 406.4 },
      printIn: { w: 12, h: 16 },
    },
    {
      key: 'left_sleeve',
      label: 'Left sleeve',
      techpackUrl: `${HUGO_DIR}/left-sleeve.svg`,
      mutedUrl: `${HUGO_DIR}/muted-canvas-left-sleeve.svg`,
      viewBox: { x: -220.5, y: -247.1, w: 441.0, h: 831.7 },
      natural: { w: 520, h: 981 },
      printRectUnits: { x: -50.8, y: 16.4, w: 101.6, h: 304.8 },
      printIn: { w: 4, h: 12 },
    },
    {
      key: 'right_sleeve',
      label: 'Right sleeve',
      techpackUrl: `${HUGO_DIR}/right-sleeve.svg`,
      mutedUrl: `${HUGO_DIR}/muted-canvas-right-sleeve.svg`,
      viewBox: { x: -220.5, y: -247.1, w: 441.0, h: 831.7 },
      natural: { w: 520, h: 981 },
      printRectUnits: { x: -50.8, y: 16.4, w: 101.6, h: 304.8 },
      printIn: { w: 4, h: 12 },
    },
  ],
};

export const FLAT_DESIGNS: FlatDesign[] = [HUGO_HOODIE];

/** The flat for a blank, by its product name. Null when no flat exists. */
export function flatDesignForBlank(name: string | null | undefined): FlatDesign | null {
  if (!name) return null;
  return FLAT_DESIGNS.find((d) => d.match.test(name)) ?? null;
}

/**
 * Normalize a canvas placement id to the flat-piece key space.
 * The canvas pills / family defaults use ids that are NOT the provider
 * placement names: 'front-matter' / 'back-matter' (books-family default
 * — and familyForTopCategory maps every non-Apparel top, Men included,
 * to 'books'), 'sleeve-l' / 'sleeve-r' (tops pill ids). Without this the
 * front flat never matches its own placement and the print box falls back
 * to the generic centered box.
 */
export function normalizeFlatPlacement(placement: string): string {
  const b = placement
    .toLowerCase()
    .replace(/_(dtf|dtg|embroidery|sublimation|screen_print|screenprint|vinyl|cut_sew)$/i, '');
  if (b === 'front-matter' || b === 'front') return 'front';
  if (b === 'back-matter' || b === 'back') return 'back';
  if (b === 'sleeve-l' || b === 'left_sleeve') return 'left_sleeve';
  if (b === 'sleeve-r' || b === 'right_sleeve') return 'right_sleeve';
  return b;
}

/**
 * The flat piece for a canvas placement (placementBase form: front, back,
 * left_sleeve, right_sleeve, left_chest, right_chest, neck, …).
 * Chest and neck placements sit ON the front piece; anything unmapped
 * also falls back to the front piece so the surface is always a flat.
 */
export function flatPieceForPlacement(
  design: FlatDesign,
  placement: string,
): FlatPiece | null {
  const base = normalizeFlatPlacement(placement);
  const byKey = (key: string) => design.pieces.find((p) => p.key === key) ?? null;
  if (base === 'back') return byKey('back');
  if (base === 'left_sleeve') return byKey('left_sleeve');
  if (base === 'right_sleeve') return byKey('right_sleeve');
  return byKey('front');
}

/** True when the placement IS the piece (its dashed box is the print box). */
export function pieceIsPlacement(piece: FlatPiece, placement: string): boolean {
  return piece.key === normalizeFlatPlacement(placement);
}

/** The flat URL for a surface: muted canvas for Flat, white pill flat for Tech Pack. */
export function flatPieceUrl(piece: FlatPiece, surface: FlatSurface): string {
  return surface === 'techpack' ? piece.techpackUrl : piece.mutedUrl;
}

/** SVG units per physical inch the Hugo flats are drawn at (25.4). */
export const FLAT_UNITS_PER_INCH = 25.4;

/**
 * The flat's dashed print rect, scaled into the loaded image's pixel space.
 * The <img> renders the SVG at its natural size, so viewBox units scale by
 * naturalW/viewBoxW (x) and naturalH/viewBoxH (y).
 */
export function flatPrintRectPx(
  piece: FlatPiece,
  imgW: number,
  imgH: number,
): { left: number; top: number; width: number; height: number } {
  const sx = imgW / piece.viewBox.w;
  const sy = imgH / piece.viewBox.h;
  const r = piece.printRectUnits;
  return {
    left: (r.x - piece.viewBox.x) * sx,
    top: (r.y - piece.viewBox.y) * sy,
    width: r.w * sx,
    height: r.h * sy,
  };
}

/** SVG px per physical inch for a loaded flat image. */
export function flatPpi(piece: FlatPiece, imgW: number): number {
  return FLAT_UNITS_PER_INCH * (imgW / piece.viewBox.w);
}

/* ── Flat skeleton fallback (no flat on file for the blank) ── */

/** Intrinsic size of the skeleton panel. The panel is declared 18 in wide. */
export const FLAT_SKELETON_SIZE = { w: 450, h: 600 };
/** SVG px per physical inch on the skeleton panel (450 px / 18 in). */
export const FLAT_SKELETON_PPI = 25;

/**
 * A flat garment-color panel as a data-URI SVG — the design surface when
 * no tech-pack flat exists for the blank. Same honest skeleton the render
 * worker draws server-side: garment color, no person, no photo. The canvas
 * overlay draws the dashed print box from the placement's real inches.
 */
export function flatSkeletonDataUri(garmentHex: string): string {
  const hex = /^#[0-9a-fA-F]{6}$/.test(garmentHex) ? garmentHex : '#d8d8d8';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 600" width="450" height="600">` +
    `<rect x="0" y="0" width="450" height="600" fill="${hex}"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
