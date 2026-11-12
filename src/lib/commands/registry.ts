// Command registry — the single list of registered commands (plan/04 §Command list, v1).
// Server commands are the full v1 set this lane owns; techpack/rfq/media
// commands land with their lanes (T13/T17/T21) — their ids are reserved
// here as open items, not stubbed.
import { z } from 'zod';
import type { Command } from './define';
import {
  assetRemoveBg,
  assetUpscale,
  colorwayCreate,
  designCreate,
  designDuplicate,
  designSave,
  mockupRender,
} from './design';
import {
  colorwayRecolor,
  layerAddImage,
  layerAddShape,
  layerAddText,
  layerAlign,
  layerDelete,
  printAreaFit,
} from './layer';
import { flatGenerate, flatGrade, flatImport } from './src/flat';
import {
  flatSplit,
  flatPieceAccept,
  flatPieceMerge,
  flatPieceCut,
  flatPiecePair,
  flatPieceScale,
} from './src/flat/split';

export type AnyCommand = Command<z.ZodTypeAny, unknown>;

export const registry: ReadonlyMap<string, AnyCommand> = new Map(
  (
    [
      designCreate,
      designSave,
      designDuplicate,
      colorwayCreate,
      colorwayRecolor,
      assetRemoveBg,
      assetUpscale,
      mockupRender,
      layerAddText,
      layerAddImage,
      layerAddShape,
      layerAlign,
      layerDelete,
      printAreaFit,
      flatGenerate,
      flatGrade,
      flatImport,
      flatSplit,
      flatPieceAccept,
      flatPieceMerge,
      flatPieceCut,
      flatPiecePair,
      flatPieceScale,
    ] as unknown as Array<AnyCommand>
  ).map((c) => [c.id, c]),
);

export function getCommand(id: string): AnyCommand | undefined {
  return registry.get(id);
}

export function listCommands(): Array<AnyCommand> {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Server-runnable commands only (clientOnly commands run in the browser). */
export function listServerCommands(): Array<AnyCommand> {
  return listCommands().filter((c) => !c.clientOnly);
}
