// Render station — job handlers (T14). Each handler runs in a staff
// browser tab (the render station) and returns output bytes for the
// /api/studio/jobs/[jobId]/output route. Nothing here fakes a result: a
// handler whose dependency is missing throws a named error and the job
// is requeued/failed by ds_finish_browser_job.
//
// Spike verdicts (plan/wasm-spike.md) baked in:
//   DesignCraft 0.20.1 has NO in-browser drive surface → techpack_pdf
//   uses the plan/09 fallback (techpack-render fill + jsPDF/svg2pdf.js,
//   no server needed). True PDF/X-4 stays a server-runner open item.
//   PdfCraft 0.21.1 DOES have the host bridge → the preview pass-through
//   opens the supplier PDF there and saves it back (flatten); the
//   watermark stamp is already in the filled SVG (fill() stamps
//   watermarkText), because edit.watermark opens a dialog the spike did
//   not drive — see the open item in station.ts.
//   VectorCraft 0.24.0 exports SVG/PDF/DXF via execute() (browser).
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { fill } from '@/lib/techpack-render/fill';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import { runHeadless } from '@/lib/craft-bridge/runHeadless';

export interface RenderJob {
  id: string;
  kind: string;
  tenant_id: string;
  subject_id: string | null;
  subject_type: string | null;
  input: Record<string, unknown>;
}

export interface HandlerContext {
  job: RenderJob;
  /** Filled-template SVGs from GET /api/studio/techpack-templates. */
  fetchTemplates: () => Promise<string[]>;
  /** Snapshot via ds_tech_pack_snapshot / ds_tech_pack_supplier_snapshot. */
  fetchSnapshot: (techPackId: string, supplier: boolean) => Promise<TechPackSnapshot>;
  /** POST bytes to the output route; resolves with the new asset id. */
  uploadOutput: (bytes: Uint8Array, filename: string, mimeType: string) => Promise<string>;
  log: (line: string) => void;
}

export interface HandlerOutput {
  asset_id: string;
  bytes: number;
  note?: string;
}

/** A4 landscape pages (297 x 210 mm) — the template's native size. */
export async function buildPdfFromSvgs(svgs: string[]): Promise<Uint8Array> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const parser = new DOMParser();
  for (let i = 0; i < svgs.length; i++) {
    if (i > 0) pdf.addPage('a4', 'landscape');
    const doc = parser.parseFromString(svgs[i], 'image/svg+xml');
    const el = doc.documentElement as unknown as SVGSVGElement;
    await svg2pdf(el, pdf, { x: 0, y: 0, width: 297, height: 210 });
  }
  return new Uint8Array(pdf.output('arraybuffer'));
}

async function runTechPackPdf(ctx: HandlerContext, supplier: boolean): Promise<HandlerOutput> {
  const input = ctx.job.input ?? {};
  const techPackId = String(input.tech_pack_id ?? ctx.job.subject_id ?? '');
  if (!techPackId) throw new Error('techpack job has no tech_pack_id');
  const [svgs, snapshot] = await Promise.all([ctx.fetchTemplates(), ctx.fetchSnapshot(techPackId, supplier)]);
  const watermark = supplier ? String(input.watermark_text ?? 'SUPPLIER PREVIEW') : undefined;
  const { pages } = fill(svgs, snapshot, supplier ? 'supplier' : 'internal', { watermarkText: watermark });
  ctx.log(`filled ${pages.length} pages (${supplier ? 'supplier' : 'internal'} mode)`);
  let bytes = await buildPdfFromSvgs(pages.map((p) => p.svg));
  let note = 'techpack-render fill + jsPDF/svg2pdf.js (DesignCraft has no browser drive surface; see wasm-spike.md)';
  if (supplier) {
    // PdfCraft pass-through (host bridge per the spike): open + save back
    // so the file is flattened by a real PDF engine. Falls back to the
    // jsPDF bytes when PdfCraft is not served in this environment.
    try {
      const headless = await runHeadless('pdfcraft', { readyTimeoutMs: 30_000 });
      try {
        headless.open(bytes.buffer as ArrayBuffer, 'techpack-preview.pdf');
        const saved = await headless.exportViaCommand('file.save', {}, 60_000);
        if (saved.bytes && saved.bytes.byteLength > 0) {
          bytes = new Uint8Array(saved.bytes);
          note += '; PdfCraft file.save round-trip applied';
        }
      } finally {
        headless.dispose();
      }
    } catch (e) {
      note += `; PdfCraft pass-through skipped (${e instanceof Error ? e.message : 'unavailable'}) — watermark already stamped by fill()`;
      ctx.log(note);
    }
  }
  const assetId = await ctx.uploadOutput(bytes, supplier ? 'techpack-preview.pdf' : 'techpack.pdf', 'application/pdf');
  return { asset_id: assetId, bytes: bytes.byteLength, note };
}

/** Thumbnail: VectorCraft browser export, then canvas rasterization to PNG. */
async function runThumbnail(ctx: HandlerContext): Promise<HandlerOutput> {
  const input = ctx.job.input ?? {};
  const svgText = String(input.svg ?? '');
  if (!svgText) throw new Error('thumbnail job has no input.svg');
  const width = Number(input.width ?? 800);
  const height = Number(input.height ?? 800);
  let svgBytes = new TextEncoder().encode(svgText);
  try {
    const headless = await runHeadless('vectorcraft', { readyTimeoutMs: 30_000 });
    try {
      headless.open(svgBytes.buffer as ArrayBuffer, 'design.svg');
      const saved = await headless.exportViaCommand('document.export', { format: 'svg' }, 60_000);
      if (saved.bytes && saved.bytes.byteLength > 0) svgBytes = new Uint8Array(saved.bytes);
    } finally {
      headless.dispose();
    }
  } catch (e) {
    ctx.log(`VectorCraft export skipped (${e instanceof Error ? e.message : 'unavailable'}) — rasterizing the input SVG directly`);
  }
  const blob = new Blob([svgBytes as unknown as BlobPart], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('could not rasterize thumbnail SVG'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('no 2d canvas context for thumbnail');
    g.drawImage(img, 0, 0, width, height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png'),
    );
    const bytes = new Uint8Array(await png.arrayBuffer());
    const assetId = await ctx.uploadOutput(bytes, 'thumbnail.png', 'image/png');
    return { asset_id: assetId, bytes: bytes.byteLength, note: 'VectorCraft export + canvas rasterize' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Background removal (onnxruntime-web, U²-Net). The model file is NOT in
 * this repo: set NEXT_PUBLIC_BG_REMOVE_MODEL_URL to a URL serving a
 * U²-Net ONNX model (e.g. the u2net.onnx release asset). Without it the
 * handler throws a named error instead of pretending to remove a background.
 */
async function runBgRemove(ctx: HandlerContext): Promise<HandlerOutput> {
  const modelUrl = process.env.NEXT_PUBLIC_BG_REMOVE_MODEL_URL ?? '';
  if (!modelUrl) {
    throw new Error('BG_REMOVE_MODEL_NOT_CONFIGURED: set NEXT_PUBLIC_BG_REMOVE_MODEL_URL to a U²-Net ONNX model URL');
  }
  const input = ctx.job.input ?? {};
  const imageUrl = String(input.image_url ?? '');
  if (!imageUrl) throw new Error('bg_remove job has no input.image_url');
  const ort = await import('onnxruntime-web');
  const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`could not load ${imageUrl}`));
    img.src = imageUrl;
  });
  const S = 320;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2d canvas context for bg_remove');
  g.drawImage(img, 0, 0, S, S);
  const { data } = g.getImageData(0, 0, S, S);
  const inputData = new Float32Array(3 * S * S);
  for (let i = 0; i < S * S; i++) {
    inputData[i] = data[i * 4] / 255;
    inputData[S * S + i] = data[i * 4 + 1] / 255;
    inputData[2 * S * S + i] = data[i * 4 + 2] / 255;
  }
  const tensor = new ort.Tensor('float32', inputData, [1, 3, S, S]);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const mask = (out[session.outputNames[0]].data as Float32Array).slice(0, S * S);
  // Apply the mask at full resolution.
  const full = document.createElement('canvas');
  full.width = img.naturalWidth;
  full.height = img.naturalHeight;
  const fg = full.getContext('2d');
  if (!fg) throw new Error('no 2d canvas context for bg_remove output');
  fg.drawImage(img, 0, 0);
  const frame = fg.getImageData(0, 0, full.width, full.height);
  for (let y = 0; y < full.height; y++) {
    for (let x = 0; x < full.width; x++) {
      const mx = Math.min(S - 1, Math.floor((x / full.width) * S));
      const my = Math.min(S - 1, Math.floor((y / full.height) * S));
      frame.data[(y * full.width + x) * 4 + 3] = Math.round(mask[my * S + mx] * 255);
    }
  }
  fg.putImageData(frame, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) =>
    full.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png'),
  );
  const bytes = new Uint8Array(await png.arrayBuffer());
  const assetId = await ctx.uploadOutput(bytes, 'bg-removed.png', 'image/png');
  return { asset_id: assetId, bytes: bytes.byteLength, note: 'onnxruntime-web U²-Net (wasm)' };
}

export const HANDLERS: Record<string, (ctx: HandlerContext) => Promise<HandlerOutput>> = {
  techpack_pdf: (ctx) => runTechPackPdf(ctx, false),
  techpack_preview_pdf: (ctx) => runTechPackPdf(ctx, true),
  thumbnail: runThumbnail,
  bg_remove: runBgRemove,
};

export function handlerFor(kind: string): ((ctx: HandlerContext) => Promise<HandlerOutput>) | null {
  return HANDLERS[kind] ?? null;
}
