/**
 * Design Studio canvas state — shared between the New design canvas screen,
 * the global SideRail (tool clicks), and catalog list rows (Design action).
 *
 * Client-only Zustand store. Imported by 'use client' components.
 */
import { create } from 'zustand';

// ── Blanks (supplier mockups) ──
export interface Blank {
  key: string;
  name: string;
  brand: string;
  price: number;
  /** Inline SVG data URI — keeps the mockup self-contained, no asset fetch. */
  img: string;
}

const svgTee = (fill: string, stroke = '#ccc') =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M60 40 L40 80 L40 160 L160 160 L160 80 L140 40 Z" fill="${encodeURIComponent(
    fill
  )}" stroke="${encodeURIComponent(stroke)}"/></svg>`;
const svgHoodie = (fill: string, stroke = '#ccc') =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M50 40 L30 100 L40 160 L160 160 L170 100 L150 40 Z" fill="${encodeURIComponent(
    fill
  )}" stroke="${encodeURIComponent(stroke)}"/></svg>`;
const svgMug = (fill: string, stroke = '#ccc') =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><rect x="60" y="50" width="60" height="100" rx="10" fill="${encodeURIComponent(
    fill
  )}" stroke="${encodeURIComponent(stroke)}"/></svg>`;

export const BLANKS: Record<string, Blank> = {
  tee: {
    key: 'tee',
    name: 'Unisex Heavy Blend Crewneck',
    brand: 'Gildan 18000',
    price: 17.87,
    img: svgTee('#ffffff'),
  },
  hoodie: {
    key: 'hoodie',
    name: 'Pullover Hoodie',
    brand: 'Gildan 18500',
    price: 28.5,
    img: svgHoodie('#ffffff'),
  },
  mug: {
    key: 'mug',
    name: 'Ceramic Mug 11oz',
    brand: 'Generic',
    price: 6.5,
    img: svgMug('#ffffff'),
  },
};

export interface BlankColor {
  name: string;
  hex: string;
  sku?: string;
}

// Supplier API mock — colors available per blank.
export const SUPPLIER_COLORS: BlankColor[] = [
  { name: 'White', hex: '#ffffff', sku: '18000-WHT' },
  { name: 'Ash', hex: '#e5e5e5', sku: '18000-ASH' },
  { name: 'Sport Grey', hex: '#b0b0b0', sku: '18000-SPG' },
  { name: 'Black', hex: '#000000', sku: '18000-BLK' },
  { name: 'Navy', hex: '#1d2a44', sku: '18000-NVY' },
  { name: 'Maroon', hex: '#6b1e28', sku: '18000-MRN' },
  { name: 'Forest Green', hex: '#1d4422', sku: '18000-FGR' },
  { name: 'Royal', hex: '#1d3e8a', sku: '18000-RYL' },
];

export const SUPPLIER_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
export const SUPPLIER_MODELS = [
  'Front',
  'Back',
  'Folded',
  'Lifestyle 1',
  'Lifestyle 2',
];

// ── Right-rail content kinds ──
// Mirrors the sidebar tool labels + catalog/loaded-product states.
export type RailKind =
  | 'upload'
  | 'ai'
  | 'add text'
  | 'my library'
  | 'graphics'
  | 'my templates'
  | 'images'
  | 'catalog'
  | 'product info'
  | 'mockup view'
  | 'create order'
  | 'my stores'
  | 'orders'
  | 'wizard';

interface DesignCanvasState {
  /** Loaded blank (null = empty canvas). */
  product: Blank | null;
  /** Active mockup color (drives the rendered product image). */
  color: BlankColor;
  /** Selected sizes for variants. */
  sizes: string[];
  /** Edit vs Preview — swaps the right-rail content. */
  mode: 'edit' | 'preview';
  /** Which right-rail content to render. */
  railKind: RailKind;
  /** Rail is open (visible) or closed. */
  railOpen: boolean;
  /** Variants modal open state. */
  variantsOpen: boolean;
  /** Publish modal open state. */
  publishOpen: boolean;
  /** Catalog context (e.g. "Men" / "Women") when railKind === 'catalog'. */
  catalogLabel: string;

  loadBlank: (key: string) => void;
  setMode: (mode: 'edit' | 'preview') => void;
  setRailKind: (kind: RailKind, opts?: { catalogLabel?: string }) => void;
  toggleRail: () => void;
  closeRail: () => void;
  selectColor: (c: BlankColor) => void;
  toggleSize: (s: string) => void;
  setVariantsOpen: (open: boolean) => void;
  setPublishOpen: (open: boolean) => void;
  clearProduct: () => void;
}

/** Render the blank's SVG with a chosen color fill. */
function blankImage(blank: Blank, hex: string): string {
  const enc = encodeURIComponent;
  if (blank.key === 'tee') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M60 40 L40 80 L40 160 L160 160 L160 80 L140 40 Z" fill="${enc(
      hex
    )}" stroke="%23ccc"/></svg>`;
  }
  if (blank.key === 'hoodie') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M50 40 L30 100 L40 160 L160 160 L170 100 L150 40 Z" fill="${enc(
      hex
    )}" stroke="%23ccc"/></svg>`;
  }
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><rect x="60" y="50" width="60" height="100" rx="10" fill="${enc(
    hex
  )}" stroke="%23ccc"/></svg>`;
}

export const useDesignCanvas = create<DesignCanvasState>((set, get) => ({
  product: null,
  color: SUPPLIER_COLORS[0],
  sizes: ['S', 'M', 'L'],
  mode: 'edit',
  railKind: 'upload',
  railOpen: true,
  variantsOpen: false,
  publishOpen: false,
  catalogLabel: '',

  loadBlank: (key) => {
    const blank = BLANKS[key];
    if (!blank) return;
    const color = get().color;
    set({
      product: { ...blank, img: blankImage(blank, color.hex) },
      railKind: 'product info',
      railOpen: true,
      mode: 'edit',
    });
  },

  setMode: (mode) =>
    set((s) => ({
      mode,
      // Swap rail content to match the mode when a product is loaded.
      railKind:
        s.product && mode === 'preview'
          ? 'mockup view'
          : s.product && mode === 'edit'
            ? 'product info'
            : s.railKind,
    })),

  setRailKind: (kind, opts) =>
    set({
      railKind: kind,
      railOpen: true,
      catalogLabel: opts?.catalogLabel ?? get().catalogLabel,
    }),

  toggleRail: () => set((s) => ({ railOpen: !s.railOpen })),
  closeRail: () => set({ railOpen: false }),

  selectColor: (c) =>
    set((s) => {
      const product = s.product
        ? { ...s.product, img: blankImage(s.product, c.hex) }
        : null;
      return { color: c, product };
    }),

  toggleSize: (sz) =>
    set((s) => ({
      sizes: s.sizes.includes(sz)
        ? s.sizes.filter((x) => x !== sz)
        : [...s.sizes, sz],
    })),

  setVariantsOpen: (open) => set({ variantsOpen: open }),
  setPublishOpen: (open) => set({ publishOpen: open }),

  clearProduct: () =>
    set({
      product: null,
      railKind: 'upload',
      mode: 'edit',
      railOpen: true,
    }),
}));
