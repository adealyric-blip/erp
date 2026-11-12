// real-pdfs.test.ts — T10c splitter against the 5 bought VecFashion PDFs
// (plan/06 T10c Accept: "Get 3–5 real VecFashion PDFs (bought ones) as
// private fixtures before starting; keep them out of git").
// The PDFs live in src/lib/flat-gen/test/fixtures/.fixtures-private/
// (gitignored). Each is a 1-page 1000x1000pt sheet with 2–3 views side by
// side; the reference split
// (~/workspace/vecfashion-11006/split/manifest.json) measured real cuts
// (median ~414pt) — this test proves the splitter finds the same views.
// Two inputs per PDF, exactly like production: the normalized SVG
// (pdftocairo -svg stands in for the VectorCraft export; the spike
// verified VectorCraft exports SVG from PDF in the browser) AND the low-res
// ink raster (plan/08 step 3d), because these PDFs' artwork is raster —
// the SVG holds <image> tiles and almost no vector paths.
//
// Skipped when the private fixtures, pdftocairo, or sharp are absent (CI
// without the licensed files). Shells out to poppler only — no network, no DB.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { splitBundle, calibratePiece, scaleFromMeasurement } from './index';
import { validateFlatSvg } from '../../validate';
import type { PageRaster } from './types';

const PRIVATE_DIR = fileURLToPath(new URL('../../test/fixtures/.fixtures-private/', import.meta.url));
const HAVE_PDFS = existsSync(PRIVATE_DIR) && readdirSync(PRIVATE_DIR).some((f) => f.endsWith('.pdf'));
let HAVE_POPPLER = false;
try {
  execFileSync('which', ['pdftocairo'], { stdio: 'ignore' });
  execFileSync('which', ['pdftoppm'], { stdio: 'ignore' });
  HAVE_POPPLER = true;
} catch {
  HAVE_POPPLER = false;
}

// The reference split's verdicts (manifest.json) are 3 views each — but
// MBS021 is a 2-garment sweatsuit (hoodie over joggers): the reference
// pipeline only ever cut in one orientation, so its "front" (331.9×
// 633.6pt) conflates both garments. The splitter cuts the second
// orientation inside each column on the review pass (viewSplit), so a
// Fashion Set correctly yields one template per garment: 6 pieces here
// (hoodie front/side/back + jogger front/side/back).
const EXPECTED: Record<string, { pieces: number; views: string[]; pairs: number }> = {
  'MBS003-Nautical Themed Swim Shorts.pdf': { pieces: 3, views: ['front', 'side', 'back'], pairs: 1 },
  'MBS010-Mens Swimming Trunks.pdf': { pieces: 3, views: ['front', 'side', 'back'], pairs: 1 },
  'MBS016-Mens Pedal Pushers Board Shorts.pdf': { pieces: 3, views: ['front', 'side', 'back'], pairs: 1 },
  'MBS018-Mens Short Length Swim Shorts.pdf': { pieces: 3, views: ['front', 'side', 'back'], pairs: 1 },
  'MBS021-Men Beach Summer Sweatsuit.pdf': {
    pieces: 6,
    views: ['front', 'front', 'side', 'side', 'back', 'back'],
    pairs: 2,
  },
};

/** Rasterize one PDF page to a low-res ink raster (72 dpi ⇒ 1 px = 1 pt). */
async function rasterizePdf(pdfPath: string, work: string): Promise<PageRaster> {
  const prefix = join(work, 'page');
  execFileSync('pdftoppm', ['-r', '72', '-gray', '-png', '-f', '1', '-l', '1', '-singlefile', pdfPath, prefix], {
    stdio: 'ignore',
  });
  const { data, info } = await sharp(`${prefix}.png`)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ink = new Uint8Array(info.width * info.height);
  for (let i = 0; i < ink.length; i++) ink[i] = data[i * info.channels] < 128 ? 1 : 0;
  return { width: info.width, height: info.height, ink };
}

describe.skipIf(!HAVE_PDFS || !HAVE_POPPLER)('T10c splitter — real VecFashion PDFs', () => {
  const pdfs = readdirSync(PRIVATE_DIR).filter((f) => f.endsWith('.pdf')).sort();
  expect(pdfs.length).toBeGreaterThanOrEqual(3);

  for (const pdf of pdfs) {
    it(`${pdf} splits into the expected views and every piece validates`, async () => {
      const work = mkdtempSync(join(tmpdir(), 't10c-pdf-'));
      try {
        const outSvg = join(work, 'page.svg');
        execFileSync('pdftocairo', ['-svg', '-f', '1', '-l', '1', join(PRIVATE_DIR, pdf), outSvg], {
          stdio: 'ignore',
        });
        const svg = readFileSync(outSvg, 'utf-8');
        const raster = await rasterizePdf(join(PRIVATE_DIR, pdf), work);
        const result = splitBundle([{ pageIndex: 0, svg, raster }], {
          sourceCategory: 'bottoms',
          fileName: pdf,
        });
        const expected = EXPECTED[pdf];
        expect(result.strategy).toBe('cluster');
        expect(result.pieces).toHaveLength(expected.pieces);
        expect(result.pieces.map((p) => p.view).sort()).toEqual([...expected.views].sort());
        expect(new Set(result.pieces.map((p) => p.pairKey).filter(Boolean)).size).toBe(expected.pairs);
        for (const piece of result.pieces) {
          // Calibrate: waist 420 mm over the piece width (staff would enter
          // a real measurement; the width proxy proves the scale path).
          const calibrated = calibratePiece(piece, scaleFromMeasurement(420, piece.bbox.w));
          const res = validateFlatSvg(calibrated.svgMm!);
          expect(res.errors).toEqual([]);
          expect(res.ok).toBe(true);
          expect(piece.silhouetteSource).toBe('union-trace');
        }
      } finally {
        // /tmp is a 512M tmpfs shared with the other lanes — never leak it.
        rmSync(work, { recursive: true, force: true });
      }
    }, 180_000);
  }
});
