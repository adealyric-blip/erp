/**
 * Design Studio canvas state — shared between the New design canvas screen,
 * the global SideRail (tool clicks → StudioDrawer), and catalog list rows
 * (thumbnail click → product page modal → Start designing → loads canvas).
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
  /** Product family — drives which print-area pills render on the canvas. */
  family: 'tops' | 'books' | 'drinkware';
}

function svgTee(fill: string, stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M60 40 L40 80 L40 160 L160 160 L160 80 L140 40 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}"/></svg>`;
}
function svgHoodie(fill: string, stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M50 40 L30 100 L40 160 L160 160 L170 100 L150 40 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}"/></svg>`;
}
function svgMug(fill: string, stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><rect x="60" y="50" width="60" height="100" rx="10" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}"/></svg>`;
}
function svgBook(fill: string, stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M40 30 L40 170 L100 170 L100 30 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}"/><path d="M100 30 L100 170 L160 170 L160 30 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" opacity="0.85"/></svg>`;
}

export const BLANKS: Record<string, Blank> = {
  tee: { key: 'tee', name: 'Unisex Heavy Blend Crewneck', brand: 'Gildan 18000', price: 17.87, img: svgTee('#ffffff'), family: 'tops' },
  hoodie: { key: 'hoodie', name: 'Pullover Hoodie', brand: 'Gildan 18500', price: 28.5, img: svgHoodie('#ffffff'), family: 'tops' },
  mug: { key: 'mug', name: 'Ceramic Mug 11oz', brand: 'Generic', price: 6.5, img: svgMug('#ffffff'), family: 'drinkware' },
  tumbler: { key: 'tumbler', name: 'Stainless Tumbler 20oz', brand: 'Generic', price: 12.95, img: svgMug('#c0c0c0'), family: 'drinkware' },
  book: { key: 'book', name: 'Perfect-Bound Paperback', brand: 'BookBaby', price: 4.5, img: svgBook('#ffffff'), family: 'books' },
  shorts: { key: 'shorts', name: 'Unisex B-Core Pocketed 7" Shorts', brand: 'Badger 412700', price: 22.27, img: svgTee('#ffffff'), family: 'tops' },
};

// ── Print-area pills per product family ──
// Tops: Front side / Back side / Sleeve left / Sleeve right / Neck label inner
// Books: Front matter / Back matter / Binder (spine)
// Drinkware (mugs/tumblers): row list — Wrap / Both sides / Handle only
export interface PrintArea {
  id: string;
  label: string;
}
export const PRINT_AREAS: Record<Blank['family'], PrintArea[]> = {
  tops: [
    { id: 'front', label: 'Front side' },
    { id: 'back', label: 'Back side' },
    { id: 'sleeve-l', label: 'Sleeve left' },
    { id: 'sleeve-r', label: 'Sleeve right' },
    { id: 'neck', label: 'Neck label inner' },
  ],
  books: [
    { id: 'front-matter', label: 'Front matter' },
    { id: 'back-matter', label: 'Back matter' },
    { id: 'binder', label: 'Binder' },
  ],
  drinkware: [
    { id: 'wrap', label: 'Wrap' },
    { id: 'both-sides', label: 'Both sides' },
    { id: 'handle', label: 'Handle only' },
  ],
};

export interface BlankColor {
  name: string;
  hex: string;
  sku?: string;
}

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

// ── Catalog products (for thumbnails + product page modal) ──
export interface CatalogProduct {
  id: string;
  name: string;
  brand: string;
  blankKey: string;
  department: string;
  eligibility: string;
  status: string;
  bestseller?: boolean;
  fabric?: string;
  fit?: string;
  features?: string[];
}

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  { id: 'p1', name: 'Heavyweight Tee', brand: 'Gildan 18000', blankKey: 'tee', department: 'Men', eligibility: 'Front / back / sleeves', status: 'Eligible', bestseller: true, fabric: '100% Cotton', fit: 'Classic', features: ['Heavyweight 5.3 oz fabric', 'Double-needle stitching', 'Taped shoulder-to-shoulder', 'Tear-away label'] },
  { id: 'p2', name: 'Performance Polo', brand: 'Port Authority L518', blankKey: 'tee', department: 'Men', eligibility: 'Left chest', status: 'Eligible', fabric: '100% Polyester', fit: 'Athletic', features: ['Moisture-wicking', 'UV protection UPF 40', 'Flat knit collar', '3-button placket'] },
  { id: 'p3', name: 'Fleece Crewneck', brand: 'Independent 2050', blankKey: 'hoodie', department: 'Men', eligibility: 'Front / back', status: 'Eligible', fabric: '80/20 cotton/poly', fit: 'Relaxed', features: ['Air jet yarn for soft feel', 'Ribbed cuffs and waistband', 'Double-needle stitching'] },
  { id: 'p4', name: 'Camp Collar Shirt', brand: 'Cotton & Cloud 4001', blankKey: 'tee', department: 'Men', eligibility: 'All-over print', status: 'Review', fabric: '100% Rayon', fit: 'Relaxed', features: ['All-over print capability', 'Camp collar', 'Loop button closure'] },
  { id: 'p5', name: 'Vintage Wash Tee', brand: 'Comfort Colors 1717', blankKey: 'tee', department: 'Men', eligibility: 'Front / back', status: 'Eligible', fabric: '100% Ring-spun cotton', fit: 'Relaxed', features: ['Garment-dyed vintage wash', 'Pre-shrunk', 'Relaxed fit'] },
  { id: 'p6', name: 'Utility Jacket', brand: 'Rabbit Skins 3350', blankKey: 'tee', department: 'Men', eligibility: 'Embroidery only', status: 'Discontinued', fabric: '100% Cotton canvas', fit: 'Workwear', features: ['Heavy-duty canvas', 'Multiple pockets', 'Embroidery-ready'] },
  { id: 'p7', name: 'Relaxed Boyfriend Tee', brand: 'Bella+Canvas 3001CVC', blankKey: 'tee', department: 'Women', eligibility: 'Front / back', status: 'Eligible', bestseller: true, fabric: '52/48 cotton/poly', fit: 'Relaxed', features: ['Side-seamed', 'Relaxed boyfriend fit', 'Pre-shrunk'] },
  { id: 'p8', name: 'Cropped Crewneck', brand: 'Comfort Colors 6016', blankKey: 'hoodie', department: 'Women', eligibility: 'Front', status: 'Eligible', fabric: '80/20 cotton/poly', fit: 'Cropped', features: ['Cropped silhouette', 'Ribbed hem', 'Garment-dyed'] },
  { id: 'p9', name: '11oz Mug', brand: 'Orca Coating 6111', blankKey: 'mug', department: 'Home Living', eligibility: 'Wrap / both sides', status: 'Eligible', bestseller: true, fabric: 'Ceramic', fit: '11oz', features: ['Dishwasher safe', 'Orca coating', 'Full wrap print'] },
  { id: 'p10', name: 'Stainless Tumbler 20oz', brand: 'Generic', blankKey: 'tumbler', department: 'Home Living', eligibility: 'Wrap', status: 'Eligible', fabric: '18/8 Stainless', fit: '20oz', features: ['Double-wall vacuum', 'Keeps cold 24h', 'Includes lid + straw'] },
  { id: 'p11', name: 'Perfect-Bound Paperback', brand: 'BookBaby', blankKey: 'book', department: 'Home Living', eligibility: 'Cover / spine', status: 'Eligible', fabric: 'Paper', fit: 'Standard', features: ['Perfect binding', 'Matte cover finish', '60lb cream paper'] },
  { id: 'p12', name: 'Youth Tee', brand: 'Gildan 18000B', blankKey: 'tee', department: 'Children', eligibility: 'Front / back', status: 'Eligible', fabric: '100% Cotton', fit: 'Youth', features: ['Heavyweight fabric', 'Taped neck', 'Double-needle hem'] },
];

// ── Supplier fulfillment data (productguide.html) ──
export interface SupplierData {
  key: string;
  name: string;
  badge: string;
  price: number;
  premiumPrice: number;
  shipping: number;
  delivery: string;
  origin: string;
  colors: string[];
  sizes: string[];
  printAreas: string[];
}

export const SUPPLIERS: Record<string, SupplierData> = {
  'printify-choice': {
    key: 'printify-choice', name: 'Printify Choice', badge: 'Trusted network of quality providers',
    price: 22.27, premiumPrice: 16.36, shipping: 4.49, delivery: '2.8 days',
    origin: 'United States (Network)',
    colors: ['#ffffff', '#e5e5e5', '#b0b0b0', '#000000', '#6b1e28', '#1d4422', '#1d2a44', '#1d3e8a'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    printAreas: ['Front left leg', 'Front right leg'],
  },
  printful: {
    key: 'printful', name: 'Printful', badge: 'Fastest delivery',
    price: 24.5, premiumPrice: 18.0, shipping: 5.99, delivery: '1.5 days',
    origin: 'Charlotte, NC',
    colors: ['#ffffff', '#000000', '#1d2a44', '#6b1e28'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    printAreas: ['Front', 'Back'],
  },
  'printify-standard': {
    key: 'printify-standard', name: 'Printify Standard', badge: 'Lowest price',
    price: 20.0, premiumPrice: 15.0, shipping: 3.99, delivery: '4-6 days',
    origin: 'Global partners',
    colors: ['#ffffff', '#e5e5e5', '#b0b0b0', '#000000'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    printAreas: ['Front left leg'],
  },
};

// ── Store ──
interface DesignCanvasState {
  /** Loaded blank (null = empty canvas). */
  product: Blank | null;
  /** Active mockup color (drives the rendered product image). */
  color: BlankColor;
  /** Edit vs Preview — Edit shows the design + print areas; Preview shows mockup angles. */
  mode: 'edit' | 'preview';
  /** Selected print-area pill (e.g. 'front', 'back'). */
  printArea: string;
  /** Product page modal — open with a catalog product when a thumbnail is clicked. */
  productPage: CatalogProduct | null;
  /** Confirmation modal (productguide.html "Supplier Selected" → Enter Studio). */
  confirmOpen: boolean;

  loadBlank: (key: string) => void;
  setMode: (mode: 'edit' | 'preview') => void;
  setPrintArea: (id: string) => void;
  selectColor: (c: BlankColor) => void;
  openProductPage: (p: CatalogProduct) => void;
  closeProductPage: () => void;
  setConfirmOpen: (open: boolean) => void;
  clearProduct: () => void;
}

function blankImage(blank: Blank, hex: string): string {
  const enc = encodeURIComponent;
  switch (blank.family) {
    case 'tops':
      return blank.key === 'hoodie'
        ? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M50 40 L30 100 L40 160 L160 160 L170 100 L150 40 Z" fill="${enc(hex)}" stroke="%23ccc"/></svg>`
        : `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M60 40 L40 80 L40 160 L160 160 L160 80 L140 40 Z" fill="${enc(hex)}" stroke="%23ccc"/></svg>`;
    case 'drinkware':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><rect x="60" y="50" width="60" height="100" rx="10" fill="${enc(hex)}" stroke="%23ccc"/></svg>`;
    case 'books':
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f4f3f7"/><path d="M40 30 L40 170 L100 170 L100 30 Z" fill="${enc(hex)}" stroke="%23ccc"/><path d="M100 30 L100 170 L160 170 L160 30 Z" fill="${enc(hex)}" stroke="%23ccc" opacity="0.85"/></svg>`;
  }
}

export const useDesignCanvas = create<DesignCanvasState>((set, get) => ({
  product: null,
  color: SUPPLIER_COLORS[0],
  mode: 'edit',
  printArea: 'front',
  productPage: null,
  confirmOpen: false,

  loadBlank: (key) => {
    const blank = BLANKS[key];
    if (!blank) return;
    const color = get().color;
    const family = blank.family;
    set({
      product: { ...blank, img: blankImage(blank, color.hex) },
      mode: 'edit',
      printArea: PRINT_AREAS[family][0].id,
    });
  },

  setMode: (mode) => set({ mode }),

  setPrintArea: (id) => set({ printArea: id }),

  selectColor: (c) =>
    set((s) => ({
      color: c,
      product: s.product ? { ...s.product, img: blankImage(s.product, c.hex) } : null,
    })),

  openProductPage: (p) => set({ productPage: p }),
  closeProductPage: () => set({ productPage: null }),
  setConfirmOpen: (open) => set({ confirmOpen: open }),

  clearProduct: () => set({ product: null, mode: 'edit', printArea: 'front' }),
}));
