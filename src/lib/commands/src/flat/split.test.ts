// flat.split / flat.piece.* commands — fake-client run tests (no DB).
// The fake implements the same postgrest chains the commands use, plus
// in-memory storage, so accept → template creation is exercised end to
// end without a live Supabase stack.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCommand } from '@/lib/commands/registry';
import {
  flatSplit,
  flatPieceAccept,
  flatPieceMerge,
  flatPieceCut,
  flatPiecePair,
  flatPieceScale,
} from './split';

type Row = Record<string, unknown>;
type PgErr = { code?: string; message: string } | null;

function uuid(): string {
  return crypto.randomUUID();
}

class FakeQb {
  private rows: Row[];
  private patch: Row | null = null;
  private mode: 'select' | 'update' | 'delete';
  private table: string;
  private store: FakeClient;

  constructor(store: FakeClient, table: string, rows: Row[], mode: 'select' | 'update' | 'delete' = 'select') {
    this.store = store;
    this.table = table;
    this.rows = rows;
    this.mode = mode;
  }

  eq(col: string, v: unknown): this {
    this.rows = this.rows.filter((r) => r[col] === v);
    return this;
  }

  neq(col: string, v: unknown): this {
    this.rows = this.rows.filter((r) => r[col] !== v);
    return this;
  }

  limit(n: number): this {
    this.rows = this.rows.slice(0, n);
    return this;
  }

  order(): this {
    return this;
  }

  select(): this {
    return this;
  }

  async single(): Promise<{ data: Row | null; error: PgErr }> {
    if (this.mode === 'update' && this.patch) {
      for (const r of this.rows) Object.assign(r, this.patch);
    }
    if (this.mode === 'delete') {
      const all = this.store.tables[this.table] ?? [];
      this.store.tables[this.table] = all.filter((r) => !this.rows.includes(r));
      this.rows = [];
    }
    const first = this.rows[0] ?? null;
    return first
      ? { data: first, error: null }
      : { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
  }

  async maybeSingle(): Promise<{ data: Row | null; error: PgErr }> {
    if (this.rows.length === 0) return { data: null, error: null };
    return { data: this.rows[0], error: null };
  }

  then<R>(onful: (v: { data: Row[] | null; error: PgErr }) => R): Promise<R> {
    if (this.mode === 'update' && this.patch) {
      for (const r of this.rows) Object.assign(r, this.patch);
    }
    if (this.mode === 'delete') {
      const all = this.store.tables[this.table] ?? [];
      this.store.tables[this.table] = all.filter((r) => !this.rows.includes(r));
      this.rows = [];
    }
    return Promise.resolve(onful({ data: [...this.rows], error: null }));
  }
}

class FakeClient {
  tables: Record<string, Row[]> = {};
  storageBlobs = new Map<string, Blob>();

  from(table: string) {
    const all = () => this.tables[table] ?? (this.tables[table] = []);
    return {
      select: () => new FakeQb(this, table, [...all()]),
      insert: (row: Row | Row[]) => ({
        select: () => ({
          single: async (): Promise<{ data: Row | null; error: PgErr }> => {
            const rows = (Array.isArray(row) ? row : [row]).map((r) => ({ id: uuid(), ...r }));
            all().push(...rows);
            return { data: rows[0], error: null };
          },
        }),
      }),
      upsert: (row: Row) => ({
        select: () => ({
          single: async (): Promise<{ data: Row | null; error: PgErr }> => {
            const r = { id: uuid(), ...row };
            all().push(r);
            return { data: r, error: null };
          },
        }),
      }),
      update: (patch: Row) => {
        const qb = new FakeQb(this, table, [...all()], 'update');
        qb['patch' as unknown as string] = patch;
        (qb as unknown as { patch: Row }).patch = patch;
        return qb;
      },
      delete: () => new FakeQb(this, table, [...all()], 'delete'),
    };
  }

  storage = {
    from: () => ({
      upload: async (path: string, body: Blob) => {
        this.storageBlobs.set(path, body);
        return { error: null };
      },
      download: async (path: string) => {
        const blob = this.storageBlobs.get(path);
        return blob ? { data: blob, error: null } : { data: null, error: { message: `not found: ${path}` } };
      },
    }),
  };
}

const FIXTURE_3 = readFileSync(
  new URL('../../../flat-gen/test-fixtures/fixture-3-group-set.svg', import.meta.url),
  'utf-8',
);

const TENANT = uuid();
const USER = uuid();
const LICENSE = uuid();
const BATCH = uuid();

function seededClient(): FakeClient {
  const c = new FakeClient();
  c.tables.ds_flat_import_batches = [
    {
      id: BATCH,
      tenant_id: TENANT,
      source_asset_id: null,
      license_id: LICENSE,
      source_category: 'hoodie',
      status: 'queued',
      strategy: null,
      piece_count: 0,
      error: null,
    },
  ];
  c.tables.ds_flat_pieces = [];
  c.tables.design_assets = [];
  c.tables.ds_garment_templates = [];
  return c;
}

const ctx = (client: FakeClient) => ({ supabase: client, userId: USER, tenantId: TENANT } as never);

async function splitFixture3(client: FakeClient) {
  const res = await flatSplit.run(ctx(client), { batchId: BATCH, svgText: FIXTURE_3, fileName: 'set.svg' });
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error('split failed');
  return res.data;
}

describe('flat.split / flat.piece.* (fake client)', () => {
  it('registers all six commands', () => {
    for (const id of ['flat.split', 'flat.piece.accept', 'flat.piece.merge', 'flat.piece.cut', 'flat.piece.pair', 'flat.piece.scale']) {
      expect(getCommand(id)).toBeDefined();
    }
  });

  it('flat.split: fixture-3 set → 6 proposed pieces, 3 pairs, batch in review', async () => {
    const client = seededClient();
    const data = await splitFixture3(client);
    expect(data.strategy).toBe('group');
    expect(data.pieceCount).toBe(6);
    expect(data.pieces.map((p) => p.view)).toEqual(['front', 'back', 'front', 'back', 'front', 'back']);
    expect(new Set(data.pieces.map((p) => p.pairKey).filter(Boolean)).size).toBe(3);
    const batch = client.tables.ds_flat_import_batches[0];
    expect(batch.status).toBe('review');
    expect(batch.piece_count).toBe(6);
    const pieces = client.tables.ds_flat_pieces;
    expect(pieces).toHaveLength(6);
    expect(pieces.every((p) => p.status === 'proposed')).toBe(true);
    // Every piece asset carries the batch license (S610 guard prerequisite).
    const assets = client.tables.design_assets;
    expect(assets).toHaveLength(6);
    expect(assets.every((a) => a.license_id === LICENSE)).toBe(true);
    expect(assets.every((a) => a.bucket === 'design-private')).toBe(true);
  });

  it('flat.split: a batch already in review cannot be re-split', async () => {
    const client = seededClient();
    client.tables.ds_flat_import_batches[0].status = 'review';
    const res = await flatSplit.run(ctx(client), { batchId: BATCH, svgText: FIXTURE_3 });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error.code).toBe('invalid_state');
  });

  it('flat.piece.scale shares the scale with the pair partner', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [front, back] = client.tables.ds_flat_pieces;
    const res = await flatPieceScale.run(ctx(client), {
      pieceId: String(front.id),
      knownMeasurementMm: 420,
      measuredUnits: 210,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('scale failed');
    expect(res.data.scaleMmPerUnit).toBe(2);
    expect(res.data.partnerPieceId).toBe(String(back.id));
    expect(front.scale_mm_per_unit).toBe(2);
    expect(back.scale_mm_per_unit).toBe(2);
  });

  it('flat.piece.accept: front alone leaves no template; back completes the pair', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [front, back] = client.tables.ds_flat_pieces;
    const frontRes = await flatPieceAccept.run(ctx(client), {
      pieceId: String(front.id),
      knownMeasurementMm: 420,
      measuredUnits: 210,
    });
    expect(frontRes.ok).toBe(true);
    if (!frontRes.ok) throw new Error('front accept failed');
    expect(frontRes.data.templateId).toBeNull();
    expect(frontRes.data.pairComplete).toBe(false);
    expect(front.status).toBe('accepted');
    expect(front.reviewed_by).toBe(USER);
    const backRes = await flatPieceAccept.run(ctx(client), {
      pieceId: String(back.id),
      knownMeasurementMm: 420,
      measuredUnits: 210,
    });
    expect(backRes.ok).toBe(true);
    if (!backRes.ok) throw new Error('back accept failed');
    expect(backRes.data.pairComplete).toBe(true);
    expect(backRes.data.templateId).toBeTruthy();
    const templates = client.tables.ds_garment_templates;
    expect(templates).toHaveLength(1);
    const tpl = templates[0];
    expect(tpl.views).toEqual(['front', 'back']);
    expect(tpl.license_id).toBe(LICENSE);
    expect(tpl.category).toBe('hoodie');
    expect(Object.keys(tpl.print_areas as Record<string, unknown>)).toContain('front');
    expect(Object.keys(tpl.print_areas as Record<string, unknown>)).toContain('back');
    expect(front.template_id).toBe(tpl.id);
    expect(back.template_id).toBe(tpl.id);
    // The accepted pieces point at calibrated mm SVGs (same license).
    const mmAssets = client.tables.design_assets.filter((a) => String(a.file_name).endsWith('-mm.svg'));
    expect(mmAssets).toHaveLength(2);
    expect(mmAssets.every((a) => a.license_id === LICENSE)).toBe(true);
  });

  it('flat.piece.accept: missing scale is refused', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [front] = client.tables.ds_flat_pieces;
    const res = await flatPieceAccept.run(ctx(client), { pieceId: String(front.id) });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.error.code).toBe('invalid_state');
    expect(front.status).toBe('proposed');
  });

  it('flat.piece.merge: two pieces become one proposed piece', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [a, b] = client.tables.ds_flat_pieces;
    const res = await flatPieceMerge.run(ctx(client), { pieceIds: [String(a.id), String(b.id)] });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('merge failed');
    expect(client.tables.ds_flat_pieces).toHaveLength(7);
    expect(a.status).toBe('merged');
    expect(b.status).toBe('merged');
    const merged = client.tables.ds_flat_pieces.find((p) => p.id === res.data.mergedPieceId);
    expect(merged?.status).toBe('proposed');
  });

  it('flat.piece.cut: one piece becomes two proposed halves', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [front] = client.tables.ds_flat_pieces;
    const res = await flatPieceCut.run(ctx(client), { pieceId: String(front.id), axis: 'vertical', at: 150 });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('cut failed');
    expect(res.data.pieceIds).toHaveLength(2);
    expect(client.tables.ds_flat_pieces).toHaveLength(8);
    expect(front.status).toBe('merged');
  });

  it('flat.piece.pair: two unpaired pieces share a pair_key', async () => {
    const client = seededClient();
    await splitFixture3(client);
    const [a, b] = client.tables.ds_flat_pieces;
    // Break the pair first (flat.split paired them); pair() must re-pair.
    a.pair_key = null;
    b.pair_key = null;
    const res = await flatPiecePair.run(ctx(client), { pieceIds: [String(a.id), String(b.id)] });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('pair failed');
    expect(a.pair_key).toBe(res.data.pairKey);
    expect(b.pair_key).toBe(res.data.pairKey);
  });
});
