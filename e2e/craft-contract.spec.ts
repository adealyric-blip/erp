import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * craft-contract.spec.ts — T11 Accept: "contract test loads the real builds
 * in Playwright, opens an SVG, runs one command, exports PDF bytes".
 *
 * The builds are served from the repo's public/craft/ (fetched by
 * scripts/fetch-craft.ts) by a static server owned by this test — NOT by
 * the Next dev server, because /craft/* is staff-only behind the proxy
 * (aal2) and this environment has no local Supabase to sign in with. The
 * static server sends the same COOP/COEP/CORP headers the Next craft
 * paths send (see headers.test.ts), so the builds run under production
 * isolation. The authenticated Next-path round-trip (T12 page → document
 * stream → save back) is covered by the T12 page + routes, and its live
 * run needs a staff session — open item, see plan/wasm-spike.md.
 *
 * VectorCraft (control API, no host bridge) and PdfCraft (host bridge) are
 * the two verified drive surfaces; both are exercised here.
 */

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
};

const SVG_FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <path d="M140 40 L260 40 L300 60 L340 120 L300 150 L280 130 L280 360 L120 360 L120 130 L100 150 L60 120 L100 60 Z"
    fill="#f5f0e6" stroke="#222" stroke-width="2"/>
  <rect x="160" y="120" width="80" height="120" fill="none" stroke="#c00" stroke-dasharray="6 4" stroke-width="1.5"/>
  <text x="200" y="200" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#222">SPIKE</text>
</svg>`;

const PDF_FIXTURE = (() => {
  const objs = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    '<< /Length 120 >>\nstream\nBT /F1 24 Tf 200 500 Td (SPIKE) Tj ET\n1 0 0 RG 2 w 180 420 120 160 re S\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(pdf);
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(pdf);
  const n = objs.length;
  pdf += `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return pdf;
})();

let server: ReturnType<typeof createServer>;
let origin: string;

/** The harness API the fixture page installs on its own window. */
interface SpikeApi {
  waitReady: (timeoutMs?: number) => Promise<{ version: string; appVersion?: string; file?: boolean }>;
  waitApi: (timeoutMs?: number) => Promise<boolean>;
  open: (name: string, b64: string) => boolean;
  lastSaveB64: () => { name: string; size: number; b64: string } | null;
}

interface CraftPageApi {
  execute: (command: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  docInspect: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    __spike: SpikeApi;
  }
}

test.beforeAll(async () => {
  const craftRoot = join(process.cwd(), 'public', 'craft');
  const harness = await readFile(join(process.cwd(), 'e2e', 'fixtures', 'craft-harness.html'));
  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      if (url.pathname === '/harness.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(harness);
        return;
      }
      if (!url.pathname.startsWith('/craft/')) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const file = normalize(join(craftRoot, decodeURIComponent(url.pathname.slice('/craft/'.length))));
      if (!file.startsWith(craftRoot)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  origin = `http://127.0.0.1:${port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.setTimeout(240_000);

test('vectorcraft: open an SVG, run one command, export PDF bytes', async ({ page }) => {
  test.skip(!process.env.CRAFT_CONTRACT, 'needs the fetched builds in public/craft (scripts/fetch-craft.ts)');
  await page.goto(`${origin}/harness.html?app=vectorcraft`, { waitUntil: 'load' });
  await page.evaluate(() => window.__spike.waitApi(120_000));
  const svgB64 = Buffer.from(SVG_FIXTURE).toString('base64');
  const opened = await page.evaluate(async (b64) => {
    const frame = document.querySelector('iframe')?.contentWindow as unknown as { vectorcraft: CraftPageApi };
    return frame.vectorcraft.execute('document.open', { name: 'fixture.svg', dataBase64: b64 });
  }, svgB64);
  expect(opened).toMatchObject({ format: 'svg', title: 'fixture.svg' });
  const doc = await page.evaluate(async () => {
    const frame = document.querySelector('iframe')?.contentWindow as unknown as { vectorcraft: CraftPageApi };
    return frame.vectorcraft.docInspect();
  });
  expect((doc as { artboards?: unknown[] }).artboards).toHaveLength(1);
  const pdf = await page.evaluate(async () => {
    const frame = document.querySelector('iframe')?.contentWindow as unknown as { vectorcraft: CraftPageApi };
    return frame.vectorcraft.execute('document.exportPdf', {});
  });
  const bytes = Buffer.from(String(pdf.dataBase64), 'base64');
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(1000);
  await page.screenshot({ path: 'docs/phase2-proof/lane-c/contract-vectorcraft.png' });
});

test('pdfcraft: host bridge opens a PDF and file.save returns its bytes', async ({ page }) => {
  test.skip(!process.env.CRAFT_CONTRACT, 'needs the fetched builds in public/craft (scripts/fetch-craft.ts)');
  await page.goto(`${origin}/harness.html?app=pdfcraft`, { waitUntil: 'load' });
  const ready = await page.evaluate(() => window.__spike.waitReady(120_000));
  expect(ready.version).toBe('1');
  expect(ready.appVersion).toBe('0.21.1');
  const pdfB64 = Buffer.from(PDF_FIXTURE).toString('base64');
  await page.evaluate((b64) => window.__spike.open('fixture.pdf', b64), pdfB64);
  await page.waitForTimeout(4000);
  const doc = await page.evaluate(async () => {
    const frame = document.querySelector('iframe')?.contentWindow as unknown as { pdfcraft: CraftPageApi };
    return frame.pdfcraft.docInspect();
  });
  expect((doc as { active: { doc: number } }).active.doc).toBe(1);
  await page.evaluate(async () => {
    const frame = document.querySelector('iframe')?.contentWindow as unknown as { pdfcraft: CraftPageApi };
    return frame.pdfcraft.execute('file.save', {});
  });
  await page.waitForTimeout(3000);
  const save = await page.evaluate(() => window.__spike.lastSaveB64());
  expect(save).not.toBeNull();
  const bytes = Buffer.from(save!.b64, 'base64');
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(100);
  await page.screenshot({ path: 'docs/phase2-proof/lane-c/contract-pdfcraft.png' });
});
