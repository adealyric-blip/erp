// T10c browser proof (one-off, run with node).
// Bundles the pure splitter with esbuild, loads it in real Chromium, and
// renders the split pieces (synthetic fixture-3 + real MBS003 PDF) as live
// SVG in the page — split SVGs use an feImage filter chain and render
// black in sharp, so the browser is the only valid proof surface.
// Screenshots land in docs/phase2-proof/lane-b-t10c/.
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const REPO = '/home/hatch/workspace/erp-2026-11-07';
const PROOF = join(REPO, 'docs/phase2-proof/lane-b-t10c');
const TMP = '/tmp/t10c-proof';

async function rasterizePdf(pdfPath, work) {
  const png = join(work, 'page.png');
  execFileSync('pdftoppm', ['-r', '72', '-gray', '-png', '-f', '1', '-l', '1', pdfPath, join(work, 'page')], {
    stdio: 'ignore',
  });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const ink = new Uint8Array(info.width * info.height);
  for (let i = 0; i < ink.length; i++) ink[i] = data[i] < 250 ? 1 : 0;
  return { width: info.width, height: info.height, ink: Array.from(ink) };
}

const HTML = (title, cards) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;margin:16px} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px} .card{border:1px solid #999;padding:8px} .card svg{width:100%;height:auto;background:#fff} h1{font-size:18px} .ok{color:green}.bad{color:red} code{font-size:12px}</style>
<h1>${title}</h1>
<p>Strategy + validator verdicts are computed in the browser by the bundled splitter.</p>
<div class="grid">${cards}</div>
<script src="./bundle.js"></script>`;

const page = await chromium.launch();
const browser = page;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pg = await ctx.newPage();

// --- 1. synthetic fixture-3 (3-garment set) in the browser ---
const fixture3 = readFileSync(join(REPO, 'src/lib/flat-gen/test-fixtures/fixture-3-group-set.svg'), 'utf-8');
await pg.goto(`file://${TMP}/index.html`);
const f3 = await pg.evaluate((svg) => {
  const FS = window.FlatSplit;
  const result = FS.splitBundle([{ pageIndex: 0, svg }], { sourceCategory: 'hoodie', fileName: 'set.svg' });
  return {
    strategy: result.strategy,
    pieces: result.pieces.map((p) => {
      const cal = FS.calibratePiece(p, FS.scaleFromMeasurement(420, p.bbox.w));
      const v = FS.validateFlatSvg(cal.svgMm);
      return { id: p.id, view: p.view, pairKey: p.pairKey, svgMm: cal.svgMm, valid: v.ok, errors: v.errors };
    }),
  };
}, fixture3);
console.log('fixture-3:', f3.strategy, f3.pieces.map((p) => `${p.view}/${p.pairKey}/${p.valid}`).join(' '));
await pg.setContent(
  HTML(
    'Fixture 3 — 3-garment set (hoodie / jogger / jacket), split in-browser',
    f3.pieces
      .map(
        (p) =>
          `<div class="card"><h3>${p.id} — ${p.view} · ${p.pairKey ?? 'unpaired'}</h3><p class="${p.valid ? 'ok' : 'bad'}">7-layer validator: ${p.valid ? 'PASS' : 'FAIL ' + p.errors.join('; ')}</p>${p.svgMm}</div>`,
      )
      .join(''),
  ),
);
await pg.screenshot({ path: join(PROOF, '02-split-fixture3-browser.png'), fullPage: true });

// --- 2. real VecFashion PDF (MBS003) in the browser ---
const work = mkdtempSync(join(tmpdir(), 't10c-proof-'));
const pdf = join(REPO, 'src/lib/flat-gen/test/fixtures/.fixtures-private/MBS003-Nautical Themed Swim Shorts.pdf');
const svg = (() => {
  const out = join(work, 'page.svg');
  execFileSync('pdftocairo', ['-svg', '-f', '1', '-l', '1', pdf, out], { stdio: 'ignore' });
  return readFileSync(out, 'utf-8');
})();
const raster = await rasterizePdf(pdf, work);
const rail = await pg.evaluate(
  ({ svgText, rasterData }) => {
    const FS = window.FlatSplit;
    const result = FS.splitBundle(
      [{ pageIndex: 0, svg: svgText, raster: { width: rasterData.width, height: rasterData.height, ink: new Uint8Array(rasterData.ink) } }],
      { sourceCategory: 'bottoms', fileName: 'MBS003.pdf' },
    );
    return {
      strategy: result.strategy,
      pieces: result.pieces.map((p) => {
        const cal = FS.calibratePiece(p, FS.scaleFromMeasurement(420, p.bbox.w));
        const v = FS.validateFlatSvg(cal.svgMm);
        return { id: p.id, view: p.view, pairKey: p.pairKey, bbox: p.bbox, svgMm: cal.svgMm, valid: v.ok, errors: v.errors };
      }),
    };
  },
  { svgText: svg, rasterData: raster },
);
console.log('MBS003:', rail.strategy, rail.pieces.map((p) => `${p.view}/${p.pairKey}/${p.valid}`).join(' '));
await pg.setContent(
  HTML(
    'Real VecFashion PDF MBS003 — raster cluster split in-browser (front / side / back)',
    rail.pieces
      .map(
        (p) =>
          `<div class="card"><h3>${p.id} — ${p.view} · ${p.pairKey ?? 'unpaired'}</h3><p><code>${JSON.stringify(p.bbox)}</code></p><p class="${p.valid ? 'ok' : 'bad'}">7-layer validator: ${p.valid ? 'PASS' : 'FAIL ' + p.errors.join('; ')}</p>${p.svgMm}</div>`,
      )
      .join(''),
  ),
);
await pg.screenshot({ path: join(PROOF, '03-split-mbs003-browser.png'), fullPage: true });

// --- 3. review page guard (live dev server :3003) ---
const guard = await ctx.newPage();
await guard.goto('http://localhost:3003/studio/library/flats/import/00000000-0000-0000-0000-000000000000');
await guard.waitForURL(/\/login/, { timeout: 15000 });
await guard.screenshot({ path: join(PROOF, '01-review-guard-login.png'), fullPage: true });
console.log('guard URL:', guard.url());

await browser.close();
console.log('proof done — screenshots in', PROOF);
