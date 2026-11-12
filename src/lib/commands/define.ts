// Command registry — plan/04 §Command registry, adapted to this repo:
// plan `packages/commands/*` maps to `src/lib/commands/*` (T03 precedent).
// Types and semantics are the plan's verbatim; only the import path changes.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import type { Result } from '@/server/result';

export type Permission = 'member' | 'admin';
export type CommandScope = 'studio' | 'techpack' | 'rfq' | 'media' | 'library';

/** Minimal canvas API a clientOnly command may drive. Implemented by the
 *  Konva canvas store (src/features/studio/store/canvasStore.ts). */
export interface CanvasApi {
  addLayer: (layer: Record<string, unknown>) => string;
  removeLayer: (id: string) => void;
  alignSelection: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  fitSelectionToPrintArea: () => void;
  setColorwayFill: (fill: string) => void;
  getScene: () => Record<string, unknown>;
}

export interface CommandContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  tenantId: string;
  /** Present only for clientOnly commands running in the browser. */
  canvas?: CanvasApi;
  signal?: AbortSignal;
}

export interface Command<I extends z.ZodTypeAny, O> {
  id: string;
  title: string;
  description: string;
  scope: CommandScope;
  permission: Permission;
  input: I;
  /** Canvas-only commands run in the browser; MCP drives them via the canvas session. */
  clientOnly?: boolean;
  run(ctx: CommandContext, input: z.infer<I>): Promise<Result<O>>;
}

export function defineCommand<I extends z.ZodTypeAny, O>(c: Command<I, O>): Command<I, O> {
  return c;
}

/** zod → JSON Schema (plan T06 accept: unit tests for registry + zod → JSON Schema).
 *  zod v4 ships `z.toJSONSchema`; this is a thin wrapper so the registry has
 *  one stable entry point and tests can pin the output shape. */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const out = z.toJSONSchema(schema) as unknown as Record<string, unknown>;
  return out;
}
