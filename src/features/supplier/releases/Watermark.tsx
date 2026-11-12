// Watermark — T20 release surfaces (src/features/supplier/releases/).
//
// The visible watermark is an overlay, NOT the security boundary: the
// boundary is the server-side authorize RPC + short-lived signed URL.
// Auditable copies (snapshot / vault / audit exports) must NOT be
// watermarked — this component is only ever rendered on supplier-facing
// preview / release views, never on staff audit or snapshot surfaces.

export interface WatermarkProps {
  /** Per-viewer text, e.g. "Vendor Name · user@example.com · 2026-11-12 03:14Z". */
  text: string;
  /** Diagonal tiled repeat (default) or a single centred stamp. */
  variant?: 'tiled' | 'single';
  className?: string;
}

/** Diagonal tiled watermark text, pointer-events none, non-selectable. */
export default function Watermark({ text, variant = 'tiled', className }: WatermarkProps) {
  if (variant === 'single') {
    return (
      <div
        aria-hidden="true"
        data-testid="watermark"
        className={className ?? 'pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none'}
      >
        <span className="rotate-[-24deg] text-lg font-semibold text-neutral-900/25">{text}</span>
      </div>
    );
  }
  const tiles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <div
      aria-hidden="true"
      data-testid="watermark"
      className={className ?? 'pointer-events-none absolute inset-0 overflow-hidden select-none'}
    >
      <div className="absolute inset-[-50%] grid grid-cols-3 gap-10">
        {tiles.map((i) => (
          <span key={i} className="rotate-[-24deg] text-sm font-semibold whitespace-nowrap text-neutral-900/20">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The tiled SVG overlay the asset proxy burns into raster previews
 *  (sharp composite). Kept in one place so the proxy and the on-screen
 *  overlay can never drift apart. */
export function watermarkSvg(text: string, width: number, height: number): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows: string[] = [];
  for (let y = 40; y < height + 200; y += 180) {
    for (let x = -100; x < width + 200; x += 420) {
      rows.push(
        `<text x="${x}" y="${y}" font-family="sans-serif" font-size="28" font-weight="600" fill="rgba(0,0,0,0.18)" transform="rotate(-24 ${x} ${y})">${escaped}</text>`,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rows.join('')}</svg>`;
}
