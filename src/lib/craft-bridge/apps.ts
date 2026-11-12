// apps.ts — T11. Per-app capabilities: which formats the plan needs from
// each Craft web build, which design-asset kind an export becomes, and the
// render-station job kinds each app serves (plan/04 + 05).
//
// `runner` is the T11 spike verdict per job kind (plan/wasm-spike.md):
// 'browser' means the web build exported the format in the spike;
// 'server' means it did not, and the job kind moves to the optional server
// runner (Craft CLIs + FFmpeg) — nothing else in the plan changes.
// The defaults below are the spike's measured results (2026-11-12); do not
// edit them without re-running the spike.
import type { CraftApp } from './protocol';

/** Export formats the plan needs, per app (plan/05 + 06 T11 spike list). */
export type CraftExportFormat =
  | 'pdf'
  | 'pdf-x4'
  | 'svg'
  | 'dxf'
  | 'psd'
  | 'png'
  | 'jpeg'
  | 'glb'
  | 'mp4';

export interface CraftAppCapabilities {
  app: CraftApp;
  /** Release version pinned in scripts/fetch-craft.ts. */
  version: string;
  /** What the app is for in the studio (plan/05). */
  role: string;
  /** Formats the spike asked the web build to export. */
  wantedFormats: CraftExportFormat[];
  /** Native document extensions the app opens via `<app>:open`. */
  openExtensions: string[];
  /** Design-asset kind an interactive save becomes (plan/05). */
  assetKind: string;
  /** Render-station job kinds served by this app (plan/04). */
  jobKinds: string[];
  /** Spike verdict per wanted format: measured, not guessed. */
  exportVerdict: Record<CraftExportFormat, { runner: 'browser' | 'server'; measuredMs?: number; note: string }>;
}

export const CRAFT_APP_VERSIONS: Record<CraftApp, string> = {
  vectorcraft: '0.24.0',
  photocraft: '0.23.0',
  texturecraft: '0.6.1',
  designcraft: '0.20.1',
  pdfcraft: '0.21.1',
  lightcraft: '0.21.0',
  effectcraft: '0.24.1',
  filmcraft: '0.20.1',
};

export const CRAFT_APP_TABLE: Record<CraftApp, CraftAppCapabilities> = {
  vectorcraft: {
    app: 'vectorcraft',
    version: '0.24.0',
    role: 'Garment flats & flat patterns (SVG/PDF/DXF)',
    wantedFormats: ['pdf', 'svg', 'dxf'],
    openExtensions: ['.svg', '.pdf', '.dxf', '.ai', '.eps', '.vectorcraft'],
    assetKind: 'flat_sketch',
    jobKinds: ['vector_export', 'pattern_export'],
    exportVerdict: {
      pdf: { runner: 'browser', measuredMs: 6800, note: 'spike 2026-11-12: document.exportPdf on opened fixture.svg → 9,514 B %PDF-1.7 via execute(); first call 6.8 s, repeat 4.8 s' },
      svg: { runner: 'browser', measuredMs: 2388, note: 'spike 2026-11-12: document.export {format:svg} → 738 B <?xml via execute()' },
      dxf: { runner: 'browser', measuredMs: 7080, note: 'spike 2026-11-12: document.exportDxf → 17,886 B DXF AC1032 via execute()' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  photocraft: {
    app: 'photocraft',
    version: '0.23.0',
    role: 'Mockups (PSD/PSB, 500+ command registry)',
    wantedFormats: ['psd', 'png'],
    openExtensions: ['.psd', '.psb', '.png', '.jpg', '.jpeg', '.pcraft'],
    assetKind: 'mockup',
    jobKinds: ['mockup_render', 'thumbnail'],
    exportVerdict: {
      psd: { runner: 'server', note: 'spike 2026-11-12: no drive surface in photocraft-web 0.23.0 — no <app>:ready in 90 s, no window.photocraft API, no craft-web-* dep in apps/photocraft-web/Cargo.toml' },
      png: { runner: 'server', note: 'spike 2026-11-12: same — no drive surface in web build 0.23.0' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  texturecraft: {
    app: 'texturecraft',
    version: '0.6.1',
    role: '3D garment painting (glTF/GLB in, textured GLB out)',
    wantedFormats: ['glb'],
    openExtensions: ['.glb', '.gltf', '.obj'],
    assetKind: 'model_glb',
    jobKinds: ['texture_bake', 'turntable_render'],
    exportVerdict: {
      glb: { runner: 'server', note: 'spike 2026-11-12: no drive surface in texturecraft-web 0.6.1 — no <app>:ready in 90 s, no window.texturecraft API, no craft-web-* dep' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  designcraft: {
    app: 'designcraft',
    version: '0.20.1',
    role: 'Tech packs & spec sheets (layout, PDF/X-4)',
    wantedFormats: ['pdf-x4'],
    openExtensions: ['.pdf'],
    assetKind: 'techpack_pdf',
    jobKinds: ['techpack_pdf'],
    exportVerdict: {
      'pdf-x4': { runner: 'server', note: 'spike 2026-11-12: no drive surface in designcraft-web 0.20.1 — no <app>:ready in 90 s, no window.designcraft API, no craft-web-* dep' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  pdfcraft: {
    app: 'pdfcraft',
    version: '0.21.1',
    role: 'PDF watermark / flatten (supplier preview copies)',
    wantedFormats: ['pdf'],
    openExtensions: ['.pdf'],
    assetKind: 'supplier_preview',
    jobKinds: ['techpack_preview_pdf'],
    exportVerdict: {
      pdf: { runner: 'browser', measuredMs: 500, note: 'spike 2026-11-12: file.save round-trips via host bridge — <pdfcraft:save> 615 B %PDF-1.4 in 0.5 s. Stamp: edit.watermark opens the Watermark dialog (dialog driving still open); flatten commands exist but are disabled on a plain PDF' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  lightcraft: {
    app: 'lightcraft',
    version: '0.21.0',
    role: 'Model & catalog photos (RAW develop, grading presets)',
    wantedFormats: ['jpeg'],
    openExtensions: ['.jpg', '.jpeg', '.png', '.dng', '.cr2', '.crw', '.nef'],
    assetKind: 'catalog_photo',
    jobKinds: ['photos_grade'],
    exportVerdict: {
      jpeg: { runner: 'browser', measuredMs: 898, note: 'spike 2026-11-12: app.export {path, longEdge:200} via legacy window.lightcraft.command → <lightcraft:save> spike-out.jpg 10,671 B, ff d8 ff e0, 0.9 s (file(1) confirms JFIF 133×200)' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  effectcraft: {
    app: 'effectcraft',
    version: '0.24.1',
    role: 'Product promo video — motion (Lottie)',
    wantedFormats: ['mp4'],
    openExtensions: ['.ecproj', '.json'],
    assetKind: 'promo_video',
    jobKinds: ['promo_video'],
    exportVerdict: {
      mp4: { runner: 'server', note: 'spike 2026-11-12: demo project "EffectCraft Intro" (300 frames, 1080p, H.264 Main @15 Mbps) rendered to /spike-30s.mp4 (11,170,598 B, ftyp/isom verified) in 332.1 s wall on CPU-only SwiftShader — 27–33× real time (300 frames at 24–30 fps ⇒ 10–12.5 s), far over the plan 3× threshold; runner=server per plan/05 §9. Unmeasured on GPU hardware.' },
    } as CraftAppCapabilities['exportVerdict'],
  },
  filmcraft: {
    app: 'filmcraft',
    version: '0.20.1',
    role: 'Product promo video — edit + assembly (650+ commands)',
    wantedFormats: ['mp4'],
    openExtensions: ['.mp4', '.mov', '.aaf', '.omf', '.edl'],
    assetKind: 'promo_video',
    jobKinds: ['promo_video'],
    exportVerdict: {
      mp4: { runner: 'server', note: 'spike 2026-11-12: H.264 export fails at encode start in headless Chromium on this VM — "encode: invalid configuration: cannot build the 1-thread pool: operation not supported on this platform" (2 s), even with crossOriginIsolated=true (COOP/COEP on top page + iframe, SharedArrayBuffer present). Full pipeline before it works: newProject → importDemoFootage → newSequence 1920×1080@30 → timeline.place → 540-frame sequence → export.queue.add (h264, status ready). ProRes path not cleanly exercised. runner=server per plan/05 §9.' },
    } as CraftAppCapabilities['exportVerdict'],
  },
};

/** Runner for one (app, format) pair — the spike's decision, per plan/05 §9. */
export function craftRunnerFor(app: CraftApp, format: CraftExportFormat): 'browser' | 'server' {
  return CRAFT_APP_TABLE[app].exportVerdict[format]?.runner ?? 'server';
}

/**
 * Render-station job kinds that stay in the browser. Anything the spike
 * could not export from the web build is runner='server' and must NOT be
 * claimed by a browser tab (ds_claim_browser_jobs kinds filter).
 */
export function browserJobKinds(): string[] {
  const kinds = new Set<string>();
  for (const cap of Object.values(CRAFT_APP_TABLE)) {
    for (const kind of cap.jobKinds) {
      const formats = cap.wantedFormats;
      if (formats.some((f) => cap.exportVerdict[f]?.runner === 'browser')) kinds.add(kind);
    }
  }
  return [...kinds];
}
