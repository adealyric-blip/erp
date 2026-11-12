// split.test.ts — T10c splitter unit tests (plan/06 T10c Accept).
// Fixtures (src/lib/flat-gen/test-fixtures/, synthetic — the bought
// VecFashion PDFs are covered separately in real-pdfs.test.ts):
//   (1) one garment front+back on one artboard — named layers
//   (2) two artboards — front page 1, back page 2
//   (3) a 3-garment set as top-level groups
//   (4) a flattened file with no groups
// Each must split into the right number of pieces with correct front/back
// pairs, and every accepted (calibrated) piece must pass the 7-layer
// validator.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitBundle, mergePieces, cutPiece, calibratePiece, calibratePair, scaleFromMeasurement } from './index';
import { runFlatSplitJob } from './handler';
import type { FlatSplitStore } from './index';
import { validateFlatSvg } from '../../validate';
import type { SplitResult } from './types';

const FIX_DIR = fileURLToPath(new URL('../../test-fixtures/', import.meta.url));
const FIX = (name: string) => readFileSync(join(FIX_DIR, name), 'utf-8');

function split1() {
  return splitBundle([{ pageIndex: 0, svg: FIX('fixture-1-layer-front-back.svg') }], {
    sourceCategory: 'tops',
    fileName: 'classic-tee.pdf',
  });
}

/** Calibrate every piece (half chest 540 mm over the piece width) and validate the mm SVG. */
function assertAllPiecesValid(result: SplitResult) {
  expect(result.pieces.length).toBeGreaterThan(0);
  for (const piece of result.pieces) {
    const scale = scaleFromMeasurement(540, piece.bbox.w);
    const calibrated = calibratePiece(piece, scale);
    expect(calibrated.svgMm).not.toBeNull();
    const res = validateFlatSvg(calibrated.svgMm!);
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.layersFound).toHaveLength(7);
    expect(res.printAreas.length).toBe(1);
  }
}

function assertPairs(result: SplitResult, expectedPairs: number) {
  const keys = result.pieces.map((p) => p.pairKey).filter(Boolean);
  expect(new Set(keys).size).toBe(expectedPairs);
  for (const key of new Set(keys)) {
    const members = result.pieces.filter((p) => p.pairKey === key);
    expect(members.map((m) => m.view).sort()).toEqual(['back', 'front']);
  }
}

describe('T10c splitter — the four Accept fixtures', () => {
  it('(1) one garment front+back on one artboard splits by named layer into a front/back pair', () => {
    const result = split1();
    expect(result.strategy).toBe('layer');
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces.map((p) => p.view)).toEqual(['front', 'back']);
    assertPairs(result, 1);
    assertAllPiecesValid(result);
  });

  it('(2) two artboards split into front (page 1) + back (page 2), paired', () => {
    const result = splitBundle(
      [
        { pageIndex: 0, svg: FIX('fixture-2-artboard-front.svg') },
        { pageIndex: 1, svg: FIX('fixture-2-artboard-back.svg') },
      ],
      { sourceCategory: 'tops', fileName: 'classic-tee.pdf' },
    );
    expect(result.strategy).toBe('artboard');
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces.map((p) => p.view)).toEqual(['front', 'back']);
    expect(result.pieces[0].pageIndex).toBe(0);
    expect(result.pieces[1].pageIndex).toBe(1);
    assertPairs(result, 1);
    assertAllPiecesValid(result);
  });

  it('(3) a 3-garment set as top-level groups splits into 6 pieces, 3 front/back pairs', () => {
    const result = splitBundle([{ pageIndex: 0, svg: FIX('fixture-3-group-set.svg') }], {
      sourceCategory: 'tops',
      fileName: 'fashion-set.pdf',
    });
    expect(result.strategy).toBe('group');
    expect(result.pieces).toHaveLength(6);
    expect(result.pieces.filter((p) => p.view === 'front')).toHaveLength(3);
    expect(result.pieces.filter((p) => p.view === 'back')).toHaveLength(3);
    assertPairs(result, 3);
    assertAllPiecesValid(result);
  });

  it('(4) a flattened file with no groups splits by spatial clustering into a front/back pair', () => {
    const result = splitBundle([{ pageIndex: 0, svg: FIX('fixture-4-flat-front-back.svg') }], {
      sourceCategory: 'tops',
      fileName: 'flat-tee.pdf',
    });
    expect(result.strategy).toBe('cluster');
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces.map((p) => p.view)).toEqual(['front', 'back']);
    assertPairs(result, 1);
    assertAllPiecesValid(result);
  });

  it('every fixture piece rebuilds a traced silhouette (not the bbox fallback)', () => {
    for (const result of [split1()]) {
      expect(result.pieces.every((p) => p.silhouetteSource === 'union-trace')).toBe(true);
    }
  });

  it('watermark text is dropped from pieces but kept as a warning hint', () => {
    const result = split1();
    expect(result.warnings.join(' ')).toMatch(/watermark/i);
    expect(result.pieces.every((p) => !p.svg.includes('VecFashion'))).toBe(true);
  });

  it('an unclassifiable bundle yields one flagged piece for manual review, never an empty split', () => {
    const blank = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#fff" stroke="#111"/></svg>`;
    const result = splitBundle([{ pageIndex: 0, svg: blank }], {});
    expect(result.pieces).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('T10c splitter — merge / cut / scale', () => {
  it('merge combines two pieces into one proposed piece', () => {
    const result = splitBundle([{ pageIndex: 0, svg: FIX('fixture-4-flat-front-back.svg') }], {});
    const merged = mergePieces(result.pieces[0], result.pieces[1]);
    expect(merged.bbox.w).toBeGreaterThan(result.pieces[0].bbox.w);
    const calibrated = calibratePiece(merged, scaleFromMeasurement(540, merged.bbox.w / 2));
    expect(validateFlatSvg(calibrated.svgMm!).ok).toBe(true);
  });

  it('cut splits one piece by a vertical line into two proposed pieces', () => {
    const result = splitBundle([{ pageIndex: 0, svg: FIX('fixture-4-flat-front-back.svg') }], {});
    const front = result.pieces[0];
    const [a, b] = cutPiece(front, 'vertical', front.bbox.w / 2);
    expect(a.bbox.w).toBeLessThan(front.bbox.w);
    expect(b.bbox.w).toBeLessThan(front.bbox.w);
    expect(a.id).not.toBe(b.id);
  });

  it('scaleFromMeasurement rejects non-positive inputs', () => {
    expect(() => scaleFromMeasurement(0, 100)).toThrow();
    expect(() => scaleFromMeasurement(540, 0)).toThrow();
    expect(scaleFromMeasurement(540, 270)).toBe(2);
  });

  it('calibratePair applies one scale to front and back', () => {
    const result = split1();
    const [front, back] = calibratePair(result.pieces[0], result.pieces[1], 2);
    expect(front.scaleMmPerUnit).toBe(2);
    expect(back.scaleMmPerUnit).toBe(2);
    expect(validateFlatSvg(front.svgMm!).ok).toBe(true);
    expect(validateFlatSvg(back.svgMm!).ok).toBe(true);
  });
});

describe('T10c flat_split handler (fake store)', () => {
  function fakeStore(): { store: FlatSplitStore; rows: unknown[]; batches: Record<string, Record<string, unknown>>; assets: string[] } {
    const rows: unknown[] = [];
    const batches: Record<string, Record<string, unknown>> = {};
    const assets: string[] = [];
    return {
      rows,
      batches,
      assets,
      store: {
        async uploadPieceSvg(_tenantId, _batchId, piece) {
          const id = `asset-${piece.id}`;
          assets.push(id);
          return id;
        },
        async insertPiece(row) {
          rows.push(row);
        },
        async updateBatch(batchId, patch) {
          batches[batchId] = { ...(batches[batchId] ?? {}), ...patch };
        },
      },
    };
  }

  it('splits a 3-garment set into review with piece rows and the batch license', async () => {
    const fake = fakeStore();
    const out = await runFlatSplitJob(
      {
        batchId: 'batch-1',
        tenantId: 'tenant-1',
        sourceAssetId: 'bundle-1',
        licenseId: 'lic-vecfashion',
        sourceCategory: 'tops',
        fileName: 'fashion-set.pdf',
        pages: [{ pageIndex: 0, svg: FIX('fixture-3-group-set.svg') }],
      },
      fake.store,
    );
    expect(out.strategy).toBe('group');
    expect(out.pieceCount).toBe(6);
    expect(fake.batches['batch-1'].status).toBe('review');
    expect(fake.batches['batch-1'].piece_count).toBe(6);
    expect(fake.rows).toHaveLength(6);
    for (const row of fake.rows as { status: string; pair_key: string | null }[]) {
      expect(row.status).toBe('proposed');
    }
    expect(new Set((fake.rows as { pair_key: string | null }[]).map((r) => r.pair_key)).size).toBe(3);
  });

  it('a bundle that cannot split marks the batch failed with the error', async () => {
    const fake = fakeStore();
    await expect(
      runFlatSplitJob(
        {
          batchId: 'batch-2',
          tenantId: 'tenant-1',
          sourceAssetId: 'bundle-2',
          licenseId: 'lic-vecfashion',
          pages: [],
        },
        fake.store,
      ),
    ).rejects.toThrow();
    expect(fake.batches['batch-2'].status).toBe('failed');
    expect(typeof fake.batches['batch-2'].error).toBe('string');
  });
});
