// Render station — job kinds (T14). Which craft_jobs the browser station
// claims, derived from the T11 spike verdicts (plan/wasm-spike.md):
//   thumbnail          — VectorCraft browser export (spike: PDF/SVG/DXF
//                        via execute()) + canvas rasterization to PNG.
//   bg_remove          — onnxruntime-web in the tab (browser). Gated on a
//                        configured model URL (see handlers.ts).
//   techpack_pdf       — techpack-render fill + jsPDF/svg2pdf.js in the
//                        tab. DesignCraft has NO drive surface in
//                        0.20.1, so the plan/09 fallback (svg2pdf.js +
//                        pdf-lib, no server needed) is the browser path;
//                        true PDF/X-4 stays a server-runner open item.
//   techpack_preview_pdf — supplier-mode fill + PdfCraft headless
//                        (host bridge works per the spike) for the
//                        per-viewer watermark + flatten.
//   virus_scan is NEVER claimed by a browser tab (S605 forces it to the
//   server runner; the scan-worker claims it with ds_claim_jobs).
import { browserJobKinds } from '@/lib/craft-bridge/apps';

export const BROWSER_JOB_KINDS = ['thumbnail', 'bg_remove', 'techpack_pdf', 'techpack_preview_pdf'] as const;
export type BrowserJobKind = (typeof BROWSER_JOB_KINDS)[number];

/** Cross-check against the craft-bridge spike table (informational). */
export function spikeBrowserKinds(): string[] {
  return browserJobKinds();
}

/** Bucket + classification per job kind for the output route (S600
 *  design_assets checks: supplier_preview lives only in
 *  supplier-previews and needs derived_from_asset_id; internal lives in
 *  design-private). */
export function outputTarget(kind: string): { bucket: string; classification: string } {
  switch (kind) {
    case 'techpack_preview_pdf':
      return { bucket: 'supplier-previews', classification: 'supplier_preview' };
    case 'techpack_pdf':
    case 'thumbnail':
    case 'bg_remove':
    default:
      return { bucket: 'design-private', classification: 'internal' };
  }
}
