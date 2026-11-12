// flat-gen types — plan/08_FLAT_LIBRARY.md.
// Pure TypeScript, no DOM: runs in Node, the browser, and the render station.
// Units are millimetres throughout; one SVG per view, viewBox = real mm at base size.
export type ViewName =
  | 'front'
  | 'back'
  | 'left_sleeve'
  | 'right_sleeve'
  | 'hood'
  | 'crown'
  | 'visor'
  | 'side';

export interface Block {
  /** Key measurements of the BASE size, in mm. */
  chestMm: number; // full chest width, flat
  bodyLengthMm: number; // HPS to hem
  shoulderMm: number; // shoulder point to shoulder point
  sleeveLengthMm: number; // shoulder point to cuff
  sleeveWidthMm: number; // cuff width (flat)
  neckWidthMm: number;
  hemMm: number; // hem width, flat
  waistMm?: number; // bottoms: waist width, flat
  inseamMm?: number; // bottoms
  outseamMm?: number; // bottoms
  crownHeightMm?: number; // headwear
  visorLengthMm?: number; // headwear
}

export interface StyleOptions {
  neck?: 'crew' | 'v' | 'mock' | 'collar' | 'hood';
  sleeve?: 'set-in' | 'raglan' | 'drop' | 'long' | 'short';
  hem?: 'straight' | 'curved' | 'rib';
  pockets?: boolean;
  hood?: boolean;
  closure?: 'none' | 'zip' | 'buttons';
}

export interface PrintAreaRect {
  x: number; // mm from view left
  y: number; // mm from view top
  widthMm: number;
  heightMm: number;
  /** Normalised 0..1 rect against the view box (plan/04 PrintArea). */
  nx: number;
  ny: number;
  nw: number;
  nh: number;
}

export interface GeneratedView {
  view: ViewName;
  svg: string;
  widthMm: number;
  heightMm: number;
  printAreas: Record<string, PrintAreaRect>;
}

export interface GeneratedFlat {
  blankId: string;
  size: string;
  block: Block;
  style: StyleOptions;
  views: GeneratedView[];
}

export interface GradeRule {
  /** mm added per size step away from the base size. */
  chestMm: number;
  bodyLengthMm: number;
  shoulderMm: number;
  sleeveLengthMm: number;
  sleeveWidthMm: number;
  hemMm: number;
  waistMm?: number;
  inseamMm?: number;
}

export interface BlankDefinition {
  id: string;
  name: string;
  category: string; // tops | bottoms | outerwear | headwear
  archetype: string;
  views: ViewName[];
  block: Block;
  style: StyleOptions;
  grade: GradeRule;
  /** Print areas per view: [x, y, w, h] in mm, at base size. */
  printAreasMm: Partial<Record<ViewName, [number, number, number, number]>>;
}

/** The 7 fixed layer ids (plan/08). Every generated SVG has all of them. */
export const LAYER_IDS = [
  'silhouette',
  'seams',
  'stitches',
  'trims',
  'print_areas',
  'callouts',
  'shading',
] as const;
