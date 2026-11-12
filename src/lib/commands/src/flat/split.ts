// flat.split + flat.piece.* commands — plan/08_FLAT_LIBRARY.md §Splitting
// bundles, plan/04 §Command list. T10c.
// flat.split takes a normalized SVG (one page; the render station's
// flat_split handler normalizes a bundle to SVG pages and calls this
// per page, or the review screen re-runs it) and writes proposed
// ds_flat_pieces + their SVGs (design-private, batch license, derived
// from the bundle asset). flat.piece.accept validates the calibrated
// mm SVG with the 7-layer validator and creates/updates the garment
// template when the pair completes (or immediately for an unpaired
// piece). Raw piece SVGs are never supplier-viewable — S610's
// ds__asset_license_viewable() returns false for any asset that is a
// piece svg_asset_id, so the supplier-deny check is a DB guarantee,
// not a UI one.
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { mapPgError } from '@/server/errors';
import { defineCommand } from '../../define';
import { validateFlatSvg } from '@/lib/flat-gen';
import {
  calibratePiece,
  mergePieces,
  cutPiece,
  scaleFromMeasurement,
  splitBundle,
} from '@/lib/flat-gen/src/split';
import type { SplitPiece } from '@/lib/flat-gen/src/split/types';
import type { ValidationResult } from '@/lib/flat-gen/validate';

export const SPLIT_GENERATOR_VERSION = 'flat-split/1';
const BUCKET = 'design-private';
type Row = Record<string, unknown>;
type PgErr = { code?: string; message: string } | null;
interface PgRes<T> {
  data: T | null;
  error: PgErr;
}

/** The exact postgrest chains these commands use, cast from the real client. */
interface Qb {
  eq(col: string, v: unknown): Qb;
  neq(col: string, v: unknown): Qb;
  limit(n: number): Qb;
  order(col: string, opts?: { ascending?: boolean }): Qb;
  select(cols: string): Qb;
  single(): Promise<PgRes<Row>>;
  maybeSingle(): Promise<PgRes<Row>>;
  then<R>(onful: (v: PgRes<Row[]>) => R, onrej?: (e: unknown) => R): Promise<R>;
}
interface MutQb {
  eq(col: string, v: unknown): MutQb;
  select(cols: string): MutQb;
  single(): Promise<PgRes<Row>>;
  then<R>(onful: (v: PgRes<Row[]>) => R, onrej?: (e: unknown) => R): Promise<R>;
}
interface AnyClient {
  from: (table: string) => {
    select: (cols: string) => Qb;
    insert: (row: Row | Row[]) => { select: (cols?: string) => { single: () => Promise<PgRes<Row>> } };
    upsert: (row: Row, opts?: Record<string, unknown>) => { select: (cols?: string) => { single: () => Promise<PgRes<Row>> } };
    update: (patch: Row) => MutQb;
    delete: () => MutQb;
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, body: Blob, opts?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: { message: string } | null }>;
    };
  };
}

const asAny = (c: SupabaseClient<Database>): AnyClient => c as unknown as AnyClient;
const fail = (code: 'invalid_state' | 'missing_data' | 'not_found' | 'unknown', message: string) =>
  ({ ok: false as const, error: { code, message } });
/** mapPgError returns a Result, not a string — extract its message. */
const pgMsg = (e: { code?: string; message?: string } | null | undefined): string => {
  if (!e) return 'database error';
  const mapped = mapPgError(e);
  return mapped.ok ? 'database error' : mapped.error.message;
};
const str = (r: Row, k: string): string | null => (typeof r[k] === 'string' ? (r[k] as string) : null);
const num = (r: Row, k: string): number | null => (typeof r[k] === 'number' ? (r[k] as number) : null);

/** Rebuild the splitter's piece object from a DB row + its SVG text. */
export function pieceRowToSplitPiece(row: Row, svgText: string): SplitPiece {
  const bbox = (row.bbox as { x: number; y: number; w: number; h: number } | null) ?? { x: 0, y: 0, w: 0, h: 0 };
  return {
    id: str(row, 'id') ?? 'piece',
    sourceRef: str(row, 'source_ref') ?? str(row, 'id') ?? 'piece',
    pageIndex: 0,
    bbox,
    view: (str(row, 'view') as SplitPiece['view']) ?? 'front',
    viewFromLabel: false,
    pairKey: str(row, 'pair_key'),
    category: str(row, 'category') ?? 'uncategorised',
    svg: svgText,
    svgMm: null,
    scaleMmPerUnit: num(row, 'scale_mm_per_unit'),
    silhouetteSource: 'union-trace',
    strategy: 'cluster',
    notes: [],
  };
}

async function loadBatch(client: AnyClient, tenantId: string, batchId: string) {
  const { data, error } = await client
    .from('ds_flat_import_batches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', batchId)
    .single();
  if (error) return { batch: null, error: pgMsg(error) };
  if (!data) return { batch: null, error: 'batch not found' };
  return { batch: data, error: null };
}

async function loadPiece(client: AnyClient, tenantId: string, pieceId: string) {
  const { data, error } = await client
    .from('ds_flat_pieces')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', pieceId)
    .single();
  if (error) return { piece: null, error: pgMsg(error) };
  if (!data) return { piece: null, error: 'piece not found' };
  return { piece: data, error: null };
}

async function loadAssetSvg(client: AnyClient, tenantId: string, assetId: string) {
  const { data: asset, error } = await client
    .from('design_assets')
    .select('id, file_path, bucket, license_id')
    .eq('tenant_id', tenantId)
    .eq('id', assetId)
    .single();
  if (error || !asset) return { text: null, asset: null, error: error ? pgMsg(error) : 'asset not found' };
  const { data: blob, error: dlErr } = await client
    .storage.from(str(asset, 'bucket') ?? BUCKET)
    .download(str(asset, 'file_path') ?? '');
  if (dlErr || !blob) return { text: null, asset, error: dlErr ? dlErr.message : 'asset download failed' };
  return { text: await blob.text(), asset, error: null };
}

/** Upload one piece SVG to design-private and register the design_asset row. */
async function uploadPieceSvg(
  client: AnyClient,
  tenantId: string,
  userId: string,
  batch: Row,
  name: string,
  svgText: string,
  derivedFromAssetId: string | null,
) {
  const path = `${tenantId}/library/flats/imports/${str(batch, 'id')}/${name}`;
  const up = await client.storage.from(BUCKET).upload(path, new Blob([svgText], { type: 'image/svg+xml' }), {
    upsert: true,
    contentType: 'image/svg+xml',
  });
  if (up.error) return { asset: null, error: up.error.message };
  const { data: asset, error } = await client
    .from('design_assets')
    .insert({
      tenant_id: tenantId,
      file_name: name,
      file_path: path,
      file_size: new Blob([svgText]).size,
      bucket: BUCKET,
      kind: 'flat_sketch',
      classification: 'internal',
      created_by: userId,
      license_id: str(batch, 'license_id'),
      derived_from_asset_id: derivedFromAssetId,
      metadata: { import_batch_id: str(batch, 'id'), source: 'flat-split' },
    })
    .select('id, file_path, bucket')
    .single();
  if (error || !asset) return { asset: null, error: error ? pgMsg(error) : 'asset insert failed' };
  return { asset, error: null };
}

/** mm width/height from a calibrated SVG's width/height attributes. */
function mmDims(svgMm: string): { w: number; h: number } {
  const m = svgMm.match(/width="([\d.]+)mm" height="([\d.]+)mm"/);
  return { w: m ? Number(m[1]) : 0, h: m ? Number(m[2]) : 0 };
}

/** Validator print areas → template print_areas jsonb (normalized + mm). */
export function printAreasNormalized(
  svgMm: string,
  validation: ValidationResult,
): Record<string, { x: number; y: number; w: number; h: number; width_mm: number; height_mm: number }> {
  const { w, h } = mmDims(svgMm);
  const out: Record<string, { x: number; y: number; w: number; h: number; width_mm: number; height_mm: number }> =
    {};
  for (const a of validation.printAreas) {
    out[a.area] = {
      x: w ? a.x / w : 0,
      y: h ? a.y / h : 0,
      w: w ? a.w / w : 0,
      h: h ? a.h / h : 0,
      width_mm: a.w,
      height_mm: a.h,
    };
  }
  return out;
}

/** Deterministic template name so front+back of a pair land on one row. */
export function templateNameFor(category: string, batchId: string, pairKey: string | null, pieceId: string): string {
  const tag = pairKey ?? `single-${pieceId.slice(0, 8)}`;
  return `${category} · import ${batchId.slice(0, 8)} · ${tag}`;
}

/** Insert the template for a piece (and its accepted partner), or update the
 * existing row when the pair completes after the first side accepted. */
async function ensureTemplate(
  client: AnyClient,
  tenantId: string,
  batch: Row,
  pieces: { row: Row; mmSvg: string; validation: ValidationResult }[],
) {
  const first = pieces[0].row;
  const category = str(first, 'category') ?? 'uncategorised';
  const pairKey = str(first, 'pair_key');
  const name = templateNameFor(category, str(batch, 'id') ?? '', pairKey, str(first, 'id') ?? '');
  // Canonical view order (front first) regardless of which side accepted first.
  const rank = (v: string | null) => ({ front: 0, back: 1, side: 2, detail: 3 })[v ?? 'front'] ?? 4;
  const ordered = [...pieces].sort((a, b) => rank(str(a.row, 'view')) - rank(str(b.row, 'view')));
  const views = ordered.map((p) => str(p.row, 'view') ?? 'front');
  const printAreas: Record<string, unknown> = {};
  for (const p of pieces) {
    Object.assign(printAreas, printAreasNormalized(p.mmSvg, p.validation));
  }
  const frontPiece = pieces.find((p) => str(p.row, 'view') === 'front') ?? pieces[0];
  const row = {
    tenant_id: tenantId,
    name,
    category,
    archetype: 'APPAREL',
    views,
    print_areas: printAreas,
    flat_sketch_asset_id: str(frontPiece.row, 'svg_asset_id'),
    license_id: str(batch, 'license_id'),
    block: null,
    style_options: { import_batch_id: str(batch, 'id'), pair_key: pairKey, source: 'flat-split' },
    generator_version: SPLIT_GENERATOR_VERSION,
  };
  const { data: existing, error: findErr } = await client
    .from('ds_garment_templates')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .maybeSingle();
  if (findErr) return { template: null, error: pgMsg(findErr) };
  if (existing) {
    const { data, error } = await client
      .from('ds_garment_templates')
      .update({
        views,
        print_areas: printAreas,
        flat_sketch_asset_id: str(frontPiece.row, 'svg_asset_id'),
        license_id: str(batch, 'license_id'),
      })
      .eq('tenant_id', tenantId)
      .eq('id', str(existing, 'id') ?? '')
      .select('id')
      .single();
    if (error || !data) return { template: null, error: error ? pgMsg(error) : 'template update failed' };
    return { template: data, error: null };
  }
  const { data, error } = await client.from('ds_garment_templates').insert(row).select('id, name').single();
  if (error || !data) return { template: null, error: error ? pgMsg(error) : 'template insert failed' };
  return { template: data, error: null };
}

export const flatSplit = defineCommand({
  id: 'flat.split',
  title: 'Split a flat bundle',
  scope: 'library',
  permission: 'member',
  description:
    'Split one normalized flat SVG page into proposed pieces (artboard → layer → group → cluster). Writes piece SVGs to design-private under the batch license and proposed ds_flat_pieces rows; the batch moves to review. Nothing is auto-accepted.',
  input: z.object({
    batchId: z.string().uuid(),
    svgText: z.string().min(1).max(10_000_000),
    fileName: z.string().max(200).optional(),
    sourceCategory: z.string().max(80).optional(),
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { batch, error: batchErr } = await loadBatch(client, ctx.tenantId, i.batchId);
    if (!batch) return fail('not_found', batchErr ?? 'batch not found');
    const status = str(batch, 'status');
    if (status !== 'queued' && status !== 'splitting') {
      return fail('invalid_state', `batch is ${status}; only a queued batch can be (re-)split`);
    }
    await client.from('ds_flat_import_batches').update({ status: 'splitting', error: null }).eq('id', i.batchId).eq('tenant_id', ctx.tenantId);
    // Idempotent re-run: drop the previous round's proposed pieces first
    // (their assets stay in design-private as an audit trail).
    await client
      .from('ds_flat_pieces')
      .delete()
      .eq('tenant_id', ctx.tenantId)
      .eq('batch_id', i.batchId)
      .eq('status', 'proposed');
    let result;
    try {
      result = splitBundle([{ pageIndex: 0, svg: i.svgText }], {
        sourceCategory: i.sourceCategory ?? str(batch, 'source_category') ?? undefined,
        fileName: i.fileName,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'split failed';
      await client.from('ds_flat_import_batches').update({ status: 'failed', error: msg }).eq('id', i.batchId).eq('tenant_id', ctx.tenantId);
      return fail('invalid_state', msg);
    }
    if (result.pieces.length === 0) {
      await client
        .from('ds_flat_import_batches')
        .update({ status: 'failed', error: 'split produced no pieces' })
        .eq('id', i.batchId)
        .eq('tenant_id', ctx.tenantId);
      return fail('invalid_state', 'split produced no pieces');
    }
    const pieces: { pieceId: string; view: string; pairKey: string | null; sourceRef: string }[] = [];
    for (const piece of result.pieces) {
      const { asset, error: upErr } = await uploadPieceSvg(
        client,
        ctx.tenantId,
        ctx.userId,
        batch,
        `${piece.id}.svg`,
        piece.svg,
        str(batch, 'source_asset_id'),
      );
      if (!asset) return fail('unknown', `piece upload failed: ${upErr}`);
      const { data: pieceRow, error } = await client
        .from('ds_flat_pieces')
        .insert({
          tenant_id: ctx.tenantId,
          batch_id: i.batchId,
          source_ref: piece.sourceRef,
          bbox: piece.bbox,
          view: piece.view,
          category: piece.category,
          pair_key: piece.pairKey,
          scale_mm_per_unit: null,
          svg_asset_id: str(asset, 'id'),
          status: 'proposed',
        })
        .select('id')
        .single();
      if (error || !pieceRow) return fail('unknown', `piece insert failed: ${error ? pgMsg(error) : 'unknown'}`);
      pieces.push({
        pieceId: str(pieceRow, 'id') ?? '',
        view: piece.view,
        pairKey: piece.pairKey,
        sourceRef: piece.sourceRef,
      });
    }
    await client
      .from('ds_flat_import_batches')
      .update({ status: 'review', strategy: result.strategy, piece_count: pieces.length, error: null })
      .eq('id', i.batchId)
      .eq('tenant_id', ctx.tenantId);
    return {
      ok: true as const,
      data: { batchId: i.batchId, strategy: result.strategy, pieceCount: pieces.length, pieces, warnings: result.warnings },
    };
  },
});

const scaleInput = {
  scaleMmPerUnit: z.number().positive().optional(),
  knownMeasurementMm: z.number().positive().optional(),
  measuredUnits: z.number().positive().optional(),
};

function resolveScale(piece: Row, i: { scaleMmPerUnit?: number; knownMeasurementMm?: number; measuredUnits?: number }) {
  if (typeof i.scaleMmPerUnit === 'number') return { scale: i.scaleMmPerUnit, error: null };
  if (typeof i.knownMeasurementMm === 'number' && typeof i.measuredUnits === 'number') {
    try {
      return { scale: scaleFromMeasurement(i.knownMeasurementMm, i.measuredUnits), error: null };
    } catch {
      return { scale: null, error: 'measurement must be positive' };
    }
  }
  const existing = num(piece, 'scale_mm_per_unit');
  if (existing && existing > 0) return { scale: existing, error: null };
  return { scale: null, error: 'scale required: pass scaleMmPerUnit or knownMeasurementMm + measuredUnits' };
}

export const flatPieceScale = defineCommand({
  id: 'flat.piece.scale',
  title: 'Set a piece scale',
  scope: 'library',
  permission: 'member',
  description:
    'Calibrate one proposed piece from a known garment measurement (e.g. waist 420 mm over N source units). The scale is shared with its pair partner so front and back stay in register.',
  input: z.object({ pieceId: z.string().uuid(), ...scaleInput }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { piece, error: pieceErr } = await loadPiece(client, ctx.tenantId, i.pieceId);
    if (!piece) return fail('not_found', pieceErr ?? 'piece not found');
    if (str(piece, 'status') === 'merged' || str(piece, 'status') === 'rejected') {
      return fail('invalid_state', `cannot scale a ${str(piece, 'status')} piece`);
    }
    const { scale, error: scaleErr } = resolveScale(piece, i);
    if (!scale) return fail('invalid_state', scaleErr ?? 'scale required');
    await client
      .from('ds_flat_pieces')
      .update({ scale_mm_per_unit: scale })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', i.pieceId);
    let partnerPieceId: string | null = null;
    const pairKey = str(piece, 'pair_key');
    if (pairKey) {
      const { data: partners } = await client
        .from('ds_flat_pieces')
        .select('id, status')
        .eq('tenant_id', ctx.tenantId)
        .eq('batch_id', str(piece, 'batch_id') ?? '')
        .eq('pair_key', pairKey)
        .neq('id', i.pieceId);
      const partner = (partners ?? []).find((p) => str(p, 'status') === 'proposed');
      if (partner) {
        partnerPieceId = str(partner, 'id');
        await client
          .from('ds_flat_pieces')
          .update({ scale_mm_per_unit: scale })
          .eq('tenant_id', ctx.tenantId)
          .eq('id', partnerPieceId ?? '');
      }
    }
    return { ok: true as const, data: { pieceId: i.pieceId, scaleMmPerUnit: scale, partnerPieceId } };
  },
});

export const flatPieceAccept = defineCommand({
  id: 'flat.piece.accept',
  title: 'Accept a split piece',
  scope: 'library',
  permission: 'member',
  description:
    'Accept one proposed piece: calibrates its SVG to mm, validates it with the 7-layer validator, and creates (or completes, when its pair partner already accepted) the garment template. The S610 guard enforces category + view + scale + reviewer on the row.',
  input: z.object({
    pieceId: z.string().uuid(),
    category: z.string().max(80).optional(),
    view: z.enum(['front', 'back', 'side', 'detail']).optional(),
    ...scaleInput,
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { piece, error: pieceErr } = await loadPiece(client, ctx.tenantId, i.pieceId);
    if (!piece) return fail('not_found', pieceErr ?? 'piece not found');
    if (str(piece, 'status') !== 'proposed') {
      return fail('invalid_state', `piece is ${str(piece, 'status')}; only a proposed piece can be accepted`);
    }
    const { batch, error: batchErr } = await loadBatch(client, ctx.tenantId, str(piece, 'batch_id') ?? '');
    if (!batch) return fail('not_found', batchErr ?? 'batch not found');
    const category = i.category ?? str(piece, 'category');
    const view = i.view ?? str(piece, 'view');
    if (!category) return fail('invalid_state', 'category is required to accept a piece');
    if (!view) return fail('invalid_state', 'view is required to accept a piece');
    const { scale, error: scaleErr } = resolveScale(piece, i);
    if (!scale) return fail('invalid_state', scaleErr ?? 'scale required');
    const assetId = str(piece, 'svg_asset_id');
    if (!assetId) return fail('missing_data', 'piece has no SVG asset');
    const { text, error: svgErr } = await loadAssetSvg(client, ctx.tenantId, assetId);
    if (!text) return fail('missing_data', `piece SVG could not be loaded: ${svgErr}`);
    const sp = { ...pieceRowToSplitPiece(piece, text), category, view: view as SplitPiece['view'] };
    const calibrated = calibratePiece(sp, scale);
    if (!calibrated.svgMm) return fail('invalid_state', 'calibration produced no mm SVG');
    const validation = validateFlatSvg(calibrated.svgMm);
    if (!validation.ok) {
      return fail('invalid_state', `calibrated piece fails the 7-layer validator: ${validation.errors.join('; ')}`);
    }
    // Store the calibrated mm SVG as a new asset (same license, derived
    // from the source-unit piece asset) and point the piece at it.
    const { asset: mmAsset, error: upErr } = await uploadPieceSvg(
      client,
      ctx.tenantId,
      ctx.userId,
      batch,
      `${str(piece, 'id')}-mm.svg`,
      calibrated.svgMm,
      assetId,
    );
    if (!mmAsset) return fail('unknown', `mm SVG upload failed: ${upErr}`);
    const { data: updated, error: updErr } = await client
      .from('ds_flat_pieces')
      .update({
        status: 'accepted',
        category,
        view,
        scale_mm_per_unit: scale,
        svg_asset_id: str(mmAsset, 'id'),
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', i.pieceId)
      .select('id, batch_id, pair_key, view, category, svg_asset_id')
      .single();
    if (updErr || !updated) return fail('unknown', `piece accept failed: ${updErr ? pgMsg(updErr) : 'unknown'}`);
    // Template: completes when the pair partner is already accepted, or
    // immediately for an unpaired piece.
    const pairKey = str(piece, 'pair_key');
    let templateId: string | null = null;
    let pairComplete = false;
    const acceptedPieces: { row: Row; mmSvg: string; validation: ValidationResult }[] = [
      { row: updated, mmSvg: calibrated.svgMm, validation },
    ];
    if (pairKey) {
      const { data: partners } = await client
        .from('ds_flat_pieces')
        .select('*')
        .eq('tenant_id', ctx.tenantId)
        .eq('batch_id', str(piece, 'batch_id') ?? '')
        .eq('pair_key', pairKey)
        .neq('id', i.pieceId);
      const partner = (partners ?? []).find((p) => str(p, 'status') === 'accepted');
      if (partner) {
        const pAssetId = str(partner, 'svg_asset_id');
        if (pAssetId) {
          const { text: pText, error: pErr } = await loadAssetSvg(client, ctx.tenantId, pAssetId);
          if (!pText) return fail('missing_data', `partner SVG could not be loaded: ${pErr}`);
          const pValidation = validateFlatSvg(pText);
          if (!pValidation.ok) {
            return fail('invalid_state', `partner piece fails the 7-layer validator: ${pValidation.errors.join('; ')}`);
          }
          acceptedPieces.push({ row: partner, mmSvg: pText, validation: pValidation });
          pairComplete = true;
        }
      }
    } else {
      pairComplete = true;
    }
    if (pairComplete) {
      const { template, error: tplErr } = await ensureTemplate(client, ctx.tenantId, batch, acceptedPieces);
      if (!template) return fail('unknown', `template creation failed: ${tplErr}`);
      templateId = str(template, 'id');
      for (const p of acceptedPieces) {
        await client
          .from('ds_flat_pieces')
          .update({ template_id: templateId })
          .eq('tenant_id', ctx.tenantId)
          .eq('id', str(p.row, 'id') ?? '');
      }
    }
    return {
      ok: true as const,
      data: { pieceId: i.pieceId, status: 'accepted' as const, templateId, pairComplete },
    };
  },
});

async function loadPieceSvg(client: AnyClient, tenantId: string, pieceId: string) {
  const { piece, error: pieceErr } = await loadPiece(client, tenantId, pieceId);
  if (!piece) return { piece: null, text: null, error: pieceErr ?? 'piece not found' };
  const assetId = str(piece, 'svg_asset_id');
  if (!assetId) return { piece, text: null, error: 'piece has no SVG asset' };
  const { text, error: svgErr } = await loadAssetSvg(client, tenantId, assetId);
  if (!text) return { piece, text: null, error: `piece SVG could not be loaded: ${svgErr}` };
  return { piece, text, error: null };
}

export const flatPieceMerge = defineCommand({
  id: 'flat.piece.merge',
  title: 'Merge two pieces',
  scope: 'library',
  permission: 'member',
  description:
    'Merge two proposed pieces of one batch into one (the splitter over-split). The originals are marked merged; the new piece is proposed and must be re-reviewed before accepting.',
  input: z.object({ pieceIds: z.tuple([z.string().uuid(), z.string().uuid()]) }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const [a, b] = await Promise.all([
      loadPieceSvg(client, ctx.tenantId, i.pieceIds[0]),
      loadPieceSvg(client, ctx.tenantId, i.pieceIds[1]),
    ]);
    if (!a.piece || !a.text) return fail('not_found', a.error ?? 'first piece not found');
    if (!b.piece || !b.text) return fail('not_found', b.error ?? 'second piece not found');
    if (str(a.piece, 'batch_id') !== str(b.piece, 'batch_id')) {
      return fail('invalid_state', 'pieces are from different batches');
    }
    for (const p of [a.piece, b.piece]) {
      if (str(p, 'status') !== 'proposed') return fail('invalid_state', `piece ${str(p, 'id')} is ${str(p, 'status')}`);
    }
    const { batch, error: batchErr } = await loadBatch(client, ctx.tenantId, str(a.piece, 'batch_id') ?? '');
    if (!batch) return fail('not_found', batchErr ?? 'batch not found');
    const merged = mergePieces(pieceRowToSplitPiece(a.piece, a.text), pieceRowToSplitPiece(b.piece, b.text));
    const { asset, error: upErr } = await uploadPieceSvg(
      client,
      ctx.tenantId,
      ctx.userId,
      batch,
      `${str(a.piece, 'id')?.slice(0, 8)}-${str(b.piece, 'id')?.slice(0, 8)}-merged.svg`,
      merged.svg,
      str(a.piece, 'svg_asset_id'),
    );
    if (!asset) return fail('unknown', `merged SVG upload failed: ${upErr}`);
    const { data: row, error } = await client
      .from('ds_flat_pieces')
      .insert({
        tenant_id: ctx.tenantId,
        batch_id: str(a.piece, 'batch_id'),
        source_ref: merged.sourceRef,
        bbox: merged.bbox,
        view: merged.view,
        category: merged.category,
        pair_key: null,
        scale_mm_per_unit: null,
        svg_asset_id: str(asset, 'id'),
        status: 'proposed',
      })
      .select('id')
      .single();
    if (error || !row) return fail('unknown', `merged piece insert failed: ${error ? pgMsg(error) : 'unknown'}`);
    for (const id of i.pieceIds) {
      await client.from('ds_flat_pieces').update({ status: 'merged' }).eq('tenant_id', ctx.tenantId).eq('id', id);
    }
    return { ok: true as const, data: { mergedPieceId: str(row, 'id') ?? '', bbox: merged.bbox } };
  },
});

export const flatPieceCut = defineCommand({
  id: 'flat.piece.cut',
  title: 'Cut a piece',
  scope: 'library',
  permission: 'member',
  description:
    'Cut one proposed piece along a vertical or horizontal line (source units from the piece edge). The original is marked merged; the two halves are proposed and must be re-reviewed before accepting.',
  input: z.object({
    pieceId: z.string().uuid(),
    axis: z.enum(['vertical', 'horizontal']),
    at: z.number().positive(),
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const { piece, text, error: loadErr } = await loadPieceSvg(client, ctx.tenantId, i.pieceId);
    if (!piece || !text) return fail('not_found', loadErr ?? 'piece not found');
    if (str(piece, 'status') !== 'proposed') return fail('invalid_state', `piece is ${str(piece, 'status')}`);
    const { batch, error: batchErr } = await loadBatch(client, ctx.tenantId, str(piece, 'batch_id') ?? '');
    if (!batch) return fail('not_found', batchErr ?? 'batch not found');
    const [left, right] = cutPiece(pieceRowToSplitPiece(piece, text), i.axis, i.at);
    const ids: string[] = [];
    for (const [half, suffix] of [
      [left, 'a'],
      [right, 'b'],
    ] as const) {
      const { asset, error: upErr } = await uploadPieceSvg(
        client,
        ctx.tenantId,
        ctx.userId,
        batch,
        `${str(piece, 'id')}-cut-${suffix}.svg`,
        half.svg,
        str(piece, 'svg_asset_id'),
      );
      if (!asset) return fail('unknown', `cut SVG upload failed: ${upErr}`);
      const { data: row, error } = await client
        .from('ds_flat_pieces')
        .insert({
          tenant_id: ctx.tenantId,
          batch_id: str(piece, 'batch_id'),
          source_ref: half.sourceRef,
          bbox: half.bbox,
          view: half.view,
          category: half.category,
          pair_key: null,
          scale_mm_per_unit: null,
          svg_asset_id: str(asset, 'id'),
          status: 'proposed',
        })
        .select('id')
        .single();
      if (error || !row) return fail('unknown', `cut piece insert failed: ${error ? pgMsg(error) : 'unknown'}`);
      ids.push(str(row, 'id') ?? '');
    }
    await client.from('ds_flat_pieces').update({ status: 'merged' }).eq('tenant_id', ctx.tenantId).eq('id', i.pieceId);
    return { ok: true as const, data: { pieceIds: ids as [string, string] } };
  },
});

export const flatPiecePair = defineCommand({
  id: 'flat.piece.pair',
  title: 'Pair two pieces',
  scope: 'library',
  permission: 'member',
  description:
    'Give two pieces of one batch the same pair_key so they accept into one garment template (front + back). Pass a pairKey to reuse one, or omit it to create one.',
  input: z.object({
    pieceIds: z.tuple([z.string().uuid(), z.string().uuid()]),
    pairKey: z.string().min(1).max(60).optional(),
  }),
  async run(ctx, i) {
    const client = asAny(ctx.supabase);
    const [a, b] = await Promise.all([
      loadPiece(client, ctx.tenantId, i.pieceIds[0]),
      loadPiece(client, ctx.tenantId, i.pieceIds[1]),
    ]);
    if (!a.piece) return fail('not_found', a.error ?? 'first piece not found');
    if (!b.piece) return fail('not_found', b.error ?? 'second piece not found');
    if (str(a.piece, 'batch_id') !== str(b.piece, 'batch_id')) {
      return fail('invalid_state', 'pieces are from different batches');
    }
    for (const p of [a.piece, b.piece]) {
      if (str(p, 'status') === 'merged' || str(p, 'status') === 'rejected') {
        return fail('invalid_state', `cannot pair a ${str(p, 'status')} piece`);
      }
    }
    const pairKey = i.pairKey ?? `pair-${str(a.piece, 'id')?.slice(0, 8)}`;
    for (const id of i.pieceIds) {
      await client
        .from('ds_flat_pieces')
        .update({ pair_key: pairKey })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', id);
    }
    return { ok: true as const, data: { pairKey } };
  },
});
