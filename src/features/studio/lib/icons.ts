// Curated icon set for the Graphics drawer panel (T07: "Iconify graphics").
// Plan/05 wants @iconify/json subsets self-hosted; that package is large
// (~100 MB of icon data) and is an open item for the full subset. These 12
// MIT-style geometric icons use Iconify-style ids (`studio:*`) and the same
// { id, label, path } shape, so swapping in the real @iconify/json subset
// later is a data-only change — the panel and the Konva renderer stay the same.
// Paths are hand-drawn 24×24 viewBox geometry (no third-party icon data).
export interface StudioIcon {
  id: string;
  label: string;
  /** SVG path data in a 24×24 viewBox. */
  path: string;
}

const P = (label: string, path: string): StudioIcon => ({ id: `studio:${label.toLowerCase().replace(/[^a-z]+/g, '-')}`, label, path });

export const STUDIO_ICONS: StudioIcon[] = [
  P('Star', 'M12 2 L14.9 8.6 L22 9.3 L16.7 14 L18.2 21 L12 17.5 L5.8 21 L7.3 14 L2 9.3 L9.1 8.6 Z'),
  P('Heart', 'M12 21 C5 16 2 12 3.5 8 C4.7 5 8.5 4.5 12 8 C15.5 4.5 19.3 5 20.5 8 C22 12 19 16 12 21 Z'),
  P('Bolt', 'M13 2 L4 14 H11 L10 22 L20 10 H13 Z'),
  P('Sun', 'M12 6 a6 6 0 1 0 0 12 a6 6 0 1 0 0-12 Z M12 1 v3 M12 20 v3 M1 12 h3 M20 12 h3 M4.2 4.2 l2.1 2.1 M17.7 17.7 l2.1 2.1 M19.8 4.2 l-2.1 2.1 M6.3 17.7 l-2.1 2.1 Z'),
  P('Moon', 'M20 13 A8.5 8.5 0 0 1 11 4 A8.5 8.5 0 1 0 20 13 Z'),
  P('Leaf', 'M5 19 C5 9 11 4 20 4 C20 13 15 19 5 19 Z M5 19 C8 14 12 10 17 8'),
  P('Crown', 'M3 18 L4 8 L9 12 L12 5 L15 12 L20 8 L21 18 Z'),
  P('Badge', 'M12 2 L15 5 L19 4.5 L19.5 8.5 L22.5 11 L19.5 13.5 L20 17.5 L16 17 L14 20.5 L12 18 L10 20.5 L8 17 L4 17.5 L4.5 13.5 L1.5 11 L4.5 8.5 L5 4.5 L9 5 Z'),
  P('Smile', 'M12 3 a9 9 0 1 0 0 18 a9 9 0 1 0 0-18 Z M8.5 10 a1.3 1.3 0 1 0 0 2.6 a1.3 1.3 0 1 0 0-2.6 Z M15.5 10 a1.3 1.3 0 1 0 0 2.6 a1.3 1.3 0 1 0 0-2.6 Z M8 14.5 C9.5 16.5 14.5 16.5 16 14.5'),
  P('Arrow', 'M4 12 H19 M13 6 L19 12 L13 18'),
  P('Circle', 'M12 3 a9 9 0 1 0 0 18 a9 9 0 1 0 0-18 Z'),
  P('Sparkle', 'M12 2 L13.8 9.2 L21 11 L13.8 12.8 L12 20 L10.2 12.8 L3 11 L10.2 9.2 Z M18.5 15 L19.5 18 L22.5 19 L19.5 20 L18.5 23 L17.5 20 L14.5 19 L17.5 18 Z'),
];

export function iconById(id: string): StudioIcon | undefined {
  return STUDIO_ICONS.find((i) => i.id === id);
}

/** Data-URI SVG for an icon at a fill color (used by <img> previews). */
export function iconDataUri(icon: StudioIcon, fill = '#111111'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${icon.path}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
