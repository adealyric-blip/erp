// Client-only canvas commands — plan/04 §Command list (layer.*, print_area.fit).
// These run in the browser against the Konva canvas store (CanvasApi);
// runCommand refuses them server-side (they have no RPC effect).
import { z } from 'zod';
import { defineCommand } from './define';
import type { Result } from '@/server/result';

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const err = (message: string): Result<never> => ({
  ok: false,
  error: { code: 'invalid_state', message },
});

const layerInput = z.object({
  kind: z.enum(['text', 'image', 'shape', 'icon']),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotation: z.number().optional(),
  fill: z.string().optional(),
  text: z.string().max(500).optional(),
  fontFamily: z.string().max(120).optional(),
  fontSize: z.number().positive().optional(),
  src: z.string().max(2000).optional(),
  shape: z.string().max(80).optional(),
  view: z.enum(['front', 'back', 'left_sleeve', 'right_sleeve', 'hood', 'crown', 'visor', 'side']).optional(),
});

function needCanvas(ctx: { canvas?: unknown }): ctx is { canvas: NonNullable<import('./define').CanvasApi> } {
  return Boolean(ctx.canvas);
}

export const layerAddText = defineCommand({
  id: 'layer.add_text',
  title: 'Add text layer',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Add a text layer to the current canvas view at the given position.',
  input: layerInput,
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('layer.add_text needs the canvas');
    const id = ctx.canvas.addLayer({ ...i, kind: 'text' });
    return ok({ layerId: id });
  },
});

export const layerAddImage = defineCommand({
  id: 'layer.add_image',
  title: 'Add image layer',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Add an uploaded or stock image layer to the current canvas view.',
  input: layerInput,
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('layer.add_image needs the canvas');
    const id = ctx.canvas.addLayer({ ...i, kind: 'image' });
    return ok({ layerId: id });
  },
});

export const layerAddShape = defineCommand({
  id: 'layer.add_shape',
  title: 'Add shape layer',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Add a vector shape (rectangle, ellipse, star, …) to the current canvas view.',
  input: layerInput,
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('layer.add_shape needs the canvas');
    const id = ctx.canvas.addLayer({ ...i, kind: 'shape' });
    return ok({ layerId: id });
  },
});

export const layerAlign = defineCommand({
  id: 'layer.align',
  title: 'Align selection',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Align the selected layer(s) within the print area.',
  input: z.object({
    mode: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
  }),
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('layer.align needs the canvas');
    ctx.canvas.alignSelection(i.mode);
    return ok({ aligned: i.mode });
  },
});

export const layerDelete = defineCommand({
  id: 'layer.delete',
  title: 'Delete layer',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Delete a layer from the canvas.',
  input: z.object({ layerId: z.string() }),
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('layer.delete needs the canvas');
    ctx.canvas.removeLayer(i.layerId);
    return ok({ deleted: i.layerId });
  },
});

export const printAreaFit = defineCommand({
  id: 'print_area.fit',
  title: 'Fit to print area',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Scale and center the selection into the template print area.',
  input: z.object({}),
  async run(ctx) {
    if (!needCanvas(ctx)) return err('print_area.fit needs the canvas');
    ctx.canvas.fitSelectionToPrintArea();
    return ok({ fitted: true });
  },
});

export const colorwayRecolor = defineCommand({
  id: 'colorway.recolor',
  title: 'Recolor colorway',
  scope: 'studio',
  permission: 'member',
  clientOnly: true,
  description: 'Swap the canvas fill per colorway (client-side recolor; the colorway row itself is written by colorway.create).',
  input: z.object({ colorwayId: z.string().uuid().optional(), fill: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  async run(ctx, i) {
    if (!needCanvas(ctx)) return err('colorway.recolor needs the canvas');
    ctx.canvas.setColorwayFill(i.fill);
    return ok({ fill: i.fill });
  },
});
