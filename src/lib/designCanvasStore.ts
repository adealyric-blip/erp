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

// ── Top category bar (canvas.html TOP_NAV) ──
// The "two doors to entry" — users can browse by category dropdown, or
// drag a blank directly onto the canvas. These are the same departments
// as the Catalog sidebar group, but presented as a quick-glance top bar.
export const TOP_NAV: Record<string, string[]> = {
  Women: ['Sweatshirts', 'T-shirts', 'Hoodies', 'Long Sleeves', 'Tank Tops', 'Bottoms', 'Outerwear', 'Sportswear', 'Skirts & Dresses', 'Swimwear', 'Shoes', 'Underwear', 'Workwear'],
  Men: ['Sweatshirts', 'Hoodies', 'T-shirts', 'Long Sleeves', 'Tank Tops', 'Sportswear', 'Bottoms', 'Swimwear', 'Shoes', 'Outerwear', 'Underwear', 'Workwear'],
  Kids: ['T-shirts', 'Long Sleeves', 'Sweatshirts', 'Baby Clothing', 'Sportswear', 'Bottoms', 'Other'],
  Accessories: ['Jewelry & Pins', 'Books', 'Phone Cases', 'Bags', 'Socks', 'Hats', 'Baby', 'Mouse Pads', 'Car Accessories', 'Tech Accessories', 'Travel Accessories', 'Stationery Accessories', 'Sports & Games', 'Pet Accessories', 'Patches', 'Keychains', 'Other', 'Trendy Picks'],
  'Home & Living': ['Mugs', 'Candles', 'Ornaments', 'Seasonal Decorations', 'Glassware', 'Bottles & Tumblers', 'Canvas', 'Posters', 'Postcards', 'Journals & Notebooks', 'Magnets & Stickers', 'Home Decor', 'Blankets', 'Pillows & Covers', 'Towels', 'Bathroom', 'Rugs & Mats', 'Bedding', 'Baby & Kids Essentials', 'Kitchen Accessories', 'Wall Art'],
  Books: ['All Books'],
  PDFs: ['All PDFs'],
};

// ── Supplier category data (mock supplier API) ──
// When a user clicks a category/subcategory in the top bar, the supplier
// inspector opens with this data. In production, this would be a live API
// call to Printify/Printful.
export interface SupplierCategoryData {
  productName: string;
  supplier: string;
  sku: string;
  basePrice: number;
  colors: { name: string; hex: string; sku: string }[];
  sizes: string[];
  models: string[];
}

export const SUPPLIER_CATEGORY_DATA: SupplierCategoryData = {
  productName: 'Unisex Heavy Blend Crewneck',
  supplier: 'Printify',
  sku: 'GILDAN-18000',
  basePrice: 17.87,
  colors: [
    { name: 'White', hex: '#ffffff', sku: '18000-WHT' },
    { name: 'Ash', hex: '#e5e5e5', sku: '18000-ASH' },
    { name: 'Sport Grey', hex: '#b0b0b0', sku: '18000-SPG' },
    { name: 'Black', hex: '#000000', sku: '18000-BLK' },
    { name: 'Navy', hex: '#1d2a44', sku: '18000-NVY' },
    { name: 'Maroon', hex: '#6b1e28', sku: '18000-MRN' },
    { name: 'Forest Green', hex: '#1d4422', sku: '18000-FGR' },
    { name: 'Royal', hex: '#1d3e8a', sku: '18000-RYL' },
  ],
  sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
  models: ['Front', 'Back', 'Folded', 'Lifestyle 1', 'Lifestyle 2'],
};

// ── Category products — shown in the top-bar flyout with images ──
// Each subcategory maps to a list of products with thumbnail SVG images,
// names, brands, and prices. Users can select multiple to queue for design.
export interface CategoryProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  blankKey: string;
  /** Inline SVG thumbnail — different shape per product family. */
  img: string;
}

// SVG thumbnail generators (same style as BLANKS but smaller, for the flyout).
function thumbTee(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><path d="M36 24 L24 48 L24 96 L96 96 L96 48 L84 24 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbHoodie(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><path d="M30 24 L18 60 L24 96 L96 96 L102 60 L90 24 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbMug(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="36" y="30" width="36" height="60" rx="6" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/><path d="M72 44 Q84 44 84 56 Q84 68 72 68" fill="none" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbTumbler(fill = '#c0c0c0', stroke = '#999') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="42" y="20" width="36" height="80" rx="4" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbBook(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="24" y="18" width="72" height="84" rx="2" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/><line x1="60" y1="18" x2="60" y2="102" stroke="${encodeURIComponent(stroke)}" stroke-width="1"/></svg>`;
}
function thumbBag(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><path d="M30 48 L30 96 L90 96 L90 48 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/><path d="M42 48 Q42 30 60 30 Q78 30 78 48" fill="none" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbHat(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><path d="M24 72 Q60 48 96 72 L96 78 L24 78 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/><rect x="24" y="78" width="72" height="6" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1"/></svg>`;
}
function thumbPhone(fill = '#1a1a2e', stroke = '#444') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="40" y="18" width="40" height="84" rx="8" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbSock(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><path d="M48 18 L48 72 L30 84 L30 96 L54 96 L72 78 L72 18 Z" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbPoster(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="30" y="18" width="60" height="84" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbPillow(fill = '#fff', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="24" y="30" width="72" height="60" rx="8" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}
function thumbBlanket(fill = '#e8e8e8', stroke = '#ccc') {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="%23f4f3f7"/><rect x="18" y="24" width="84" height="72" rx="4" fill="${encodeURIComponent(fill)}" stroke="${encodeURIComponent(stroke)}" stroke-width="1.5"/></svg>`;
}

// Generate products for a subcategory — returns 4-8 products with images.
// In production, this would be a live API call returning real supplier products.
function genProducts(category: string, sub: string): CategoryProduct[] {
  const key = `${category}/${sub}`;
  const baseId = key.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Pick a thumbnail generator based on the subcategory.
  const lowerSub = sub.toLowerCase();
  let imgFn = thumbTee;
  let blankKey = 'tee';
  let brandPrefix = 'Gildan';
  let basePrice = 17.87;

  if (lowerSub.includes('hoodie')) { imgFn = thumbHoodie; blankKey = 'hoodie'; brandPrefix = 'Gildan'; basePrice = 28.5; }
  else if (lowerSub.includes('sweat')) { imgFn = thumbHoodie; blankKey = 'hoodie'; brandPrefix = 'Independent'; basePrice = 24.0; }
  else if (lowerSub.includes('mug')) { imgFn = thumbMug; blankKey = 'mug'; brandPrefix = 'Orca'; basePrice = 6.5; }
  else if (lowerSub.includes('tumbler') || lowerSub.includes('bottle')) { imgFn = thumbTumbler; blankKey = 'tumbler'; brandPrefix = 'Generic'; basePrice = 12.95; }
  else if (lowerSub.includes('book')) { imgFn = thumbBook; blankKey = 'book'; brandPrefix = 'BookBaby'; basePrice = 4.5; }
  else if (lowerSub.includes('bag') || lowerSub.includes('tote')) { imgFn = thumbBag; blankKey = 'tee'; brandPrefix = 'API'; basePrice = 8.5; }
  else if (lowerSub.includes('hat') || lowerSub.includes('cap')) { imgFn = thumbHat; blankKey = 'tee'; brandPrefix = 'Yupoong'; basePrice = 7.95; }
  else if (lowerSub.includes('phone')) { imgFn = thumbPhone; blankKey = 'tee'; brandPrefix = 'CaseMate'; basePrice = 9.95; }
  else if (lowerSub.includes('sock')) { imgFn = thumbSock; blankKey = 'tee'; brandPrefix = 'Printify'; basePrice = 4.5; }
  else if (lowerSub.includes('poster') || lowerSub.includes('canvas') || lowerSub.includes('wall')) { imgFn = thumbPoster; blankKey = 'tee'; brandPrefix = 'Generic'; basePrice = 14.95; }
  else if (lowerSub.includes('pillow')) { imgFn = thumbPillow; blankKey = 'tee'; brandPrefix = 'Generic'; basePrice = 16.95; }
  else if (lowerSub.includes('blanket') || lowerSub.includes('bedding') || lowerSub.includes('bathroom') || lowerSub.includes('towel')) { imgFn = thumbBlanket; blankKey = 'tee'; brandPrefix = 'Generic'; basePrice = 22.95; }
  else if (lowerSub.includes('t-shirt') || lowerSub.includes('tee') || lowerSub.includes('long sleeve') || lowerSub.includes('tank')) { imgFn = thumbTee; blankKey = 'tee'; brandPrefix = 'Bella+Canvas'; basePrice = 14.95; }
  else if (lowerSub.includes('bottom') || lowerSub.includes('pant') || lowerSub.includes('short')) { imgFn = thumbTee; blankKey = 'shorts'; brandPrefix = 'Badger'; basePrice = 22.27; }

  // Product name variations for visual variety.
  const nameVariants = [
    { suffix: 'Classic', fill: '#fff' },
    { suffix: 'Premium', fill: '#e5e5e5' },
    { suffix: 'Heavyweight', fill: '#b0b0b0' },
    { suffix: 'Performance', fill: '#1a1c1e' },
    { suffix: 'Eco Blend', fill: '#d4e8d4' },
    { suffix: 'Vintage Wash', fill: '#c4b8a0' },
  ];

  const count = Math.min(nameVariants.length, lowerSub.includes('all') ? 4 : 6);
  const products: CategoryProduct[] = [];
  for (let i = 0; i < count; i++) {
    const v = nameVariants[i];
    products.push({
      id: `${baseId}-${i}`,
      name: `${sub} — ${v.suffix}`,
      brand: `${brandPrefix} ${1000 + i * 137}`,
      price: +(basePrice + i * 1.5).toFixed(2),
      blankKey,
      img: imgFn(v.fill),
    });
  }
  return products;
}

// Pre-generate products for all categories (lazy-memoized).
const _categoryProductsCache: Record<string, CategoryProduct[]> = {};
export function getCategoryProducts(category: string, sub: string): CategoryProduct[] {
  const key = `${category}/${sub}`;
  if (!_categoryProductsCache[key]) {
    _categoryProductsCache[key] = genProducts(category, sub);
  }
  return _categoryProductsCache[key];
}

// ── Published products — go live to the global Catalog domain ──
export interface PublishedProduct {
  id: string;
  name: string;
  brand: string;
  blankKey: string;
  color: string;
  sizes: string[];
  printArea: string;
  supplier: string;
  publishedAt: string;
}

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
  /** Published products — go live to the global Catalog (Published Items & SKUs). */
  published: PublishedProduct[];
  /** Active supplier category (set when a top-bar dropdown item is clicked).
   *  Drives the supplier inspector content in the StudioDrawer. */
  supplierCategory: { category: string; subcategory: string } | null;
  /** Design queue — products selected from the top-bar flyout for batch design. */
  designQueue: CategoryProduct[];

  loadBlank: (key: string) => void;
  setMode: (mode: 'edit' | 'preview') => void;
  setPrintArea: (id: string) => void;
  selectColor: (c: BlankColor) => void;
  openProductPage: (p: CatalogProduct) => void;
  closeProductPage: () => void;
  setConfirmOpen: (open: boolean) => void;
  clearProduct: () => void;
  publishProduct: (supplier: string) => PublishedProduct;
  setSupplierCategory: (cat: string, sub: string) => void;
  clearSupplierCategory: () => void;
  addToQueue: (p: CategoryProduct) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
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
  published: [],
  supplierCategory: null,
  designQueue: [],

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

  publishProduct: (supplier) => {
    const s = get();
    const product = s.product;
    const ts = new Date().toISOString();
    const published: PublishedProduct = {
      id: `pub-${Date.now()}`,
      name: product?.name ?? 'Custom Design',
      brand: product?.brand ?? 'Unsaid Studio',
      blankKey: product?.key ?? 'tee',
      color: s.color.name,
      sizes: ['S', 'M', 'L', 'XL'],
      printArea: s.printArea,
      supplier,
      publishedAt: ts,
    };
    set({ published: [published, ...s.published] });
    return published;
  },

  setSupplierCategory: (cat, sub) =>
    set({ supplierCategory: { category: cat, subcategory: sub } }),
  clearSupplierCategory: () => set({ supplierCategory: null }),

  addToQueue: (p) =>
    set((s) => {
      if (s.designQueue.some((q) => q.id === p.id)) return s; // dedup
      return { designQueue: [...s.designQueue, p] };
    }),
  removeFromQueue: (id) =>
    set((s) => ({ designQueue: s.designQueue.filter((q) => q.id !== id) })),
  clearQueue: () => set({ designQueue: [] }),
}));
