// flat-gen — parametric flat library (plan/08_FLAT_LIBRARY.md).
// Pure TypeScript, no DOM: block + style options -> mm-unit SVG per view
// with the 7 fixed layer ids; grade across a size range.
export { BLANKS, getBlank } from './blanks';
export { generateFlat, gradeFlat, GENERATOR_VERSION } from './generate';
export { validateFlatSvg } from './validate';
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
