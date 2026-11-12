// split/index.ts — T10c flat splitter (plan/08 §Splitting bundles).
// Pure TypeScript, no DOM: splitBundle runs in Node, the browser, and
// the render station. runFlatSplitJob is the render-station handler for
// job kind `flat_split` (see handler.ts).
export { splitBundle, mergePieces, cutPiece } from './split';
export type { SplitOptions } from './split';
export { calibratePiece, calibratePair, scaleFromMeasurement } from './scale';
export { rebuildPiece, scaleSvgToMm, printAreaMm, traceMaskToOutlines, traceRasterToOutlines } from './rebuild';
export type { RebuiltPiece } from './rebuild';
export { parseSvg, flattenPath, bboxOfPoints } from './svg';
export type { DrawItem, ParsedSvg, SvgNode } from './svg';
export { artboardStrategy, layerStrategy, groupStrategy, clusterStrategy, viewSplit } from './strategies';
export type { Candidate } from './strategies';
export { classifyView, classifyRows, pairPieces, splitTextItems, viewFromText, classifyCategory } from './classify';
export { runFlatSplitJob, FLAT_SPLIT_JOB_KIND, normalizeBundleToSvg } from './handler';
export type { FlatSplitJobInput, FlatSplitJobOutput, FlatSplitStore } from './handler';
export type { BBox, SplitPiece, SplitResult, SplitStrategy, SvgPage, PieceView, PageRaster } from './types';
export { PRINT_AREA_DEFAULTS_MM, printAreaDefaultMm } from './types';
