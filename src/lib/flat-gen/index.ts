// flat-gen — parametric flat library (plan/08_FLAT_LIBRARY.md).
// Pure TypeScript, no DOM: block + style options -> mm-unit SVG per view
// with the 7 fixed layer ids; grade across a size range.
export { BLANKS, getBlank } from './blanks';
export { generateFlat, gradeFlat, GENERATOR_VERSION } from './generate';
export { validateFlatSvg } from './validate';
// T10c splitter (plan/08 §Splitting bundles).
export { splitBundle, mergePieces, cutPiece, calibratePiece, calibratePair, scaleFromMeasurement } from './src/split';
export type { SplitPiece, SplitResult, SplitStrategy, SvgPage } from './src/split';
export type { ValidationResult } from './validate';
export { LAYER_IDS } from './types';
export type {
  BlankDefinition,
  Block,
  GeneratedFlat,
  GeneratedView,
  GradeRule,
  PrintAreaRect,
  StyleOptions,
  ViewName,
} from './types';
