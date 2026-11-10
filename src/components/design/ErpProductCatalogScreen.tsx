'use client';
/**
 * ErpProductCatalogScreen — EXACT 1:1 implementation of
 * upload/product cards.html ("Product Catalog — ERP").
 *
 * Structure, classes, fonts, colors, copy and interactions are the
 * design, verbatim. Data lives in src/data/erpCatalogData.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATALOG_CARDS,
  CATALOG_TOTAL_COUNT,
  type CatalogCardData,
} from '@/data/erpCatalogData';
import type { DomainKey } from '@/data/shellData';

/* The page's own <style> block, verbatim (scoped under .erp-catalog
   so pages don't fight each other; values unchanged). */
const CSS = `
.erp-catalog .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1c1e;color:#fff;padding:10px 16px;border-radius:8px;font:500 13px Inter;z-index:500;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw}
.erp-catalog .toast.show{opacity:1}

/* Supplier Badges */
.erp-catalog .supplier-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
.erp-catalog .supplier-printify { background: #e0f2fe; color: #0369a1; }
.erp-catalog .supplier-printful { background: #f3e8ff; color: #6b21a8; }
.erp-catalog .supplier-both { background: #fef3c7; color: #92400e; }

/* Product Card Specifics */
.erp-catalog .product-card {
  transition: transform 0.2s, box-shadow 0.2s;
}
.erp-catalog .product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
`;

interface ErpProductCatalogScreenProps {
  onToast: (message: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}

export default function ErpProductCatalogScreen({
  onToast,
  onNavigate,
}: ErpProductCatalogScreenProps) {
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* The design is a full-viewport app page (h-screen): fixed action bar,
     internally scrolling grid. Inside the shell the available height is
     the viewport minus the chrome above this screen — measured live so
     the page always fills exactly the visible area. */
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      if (rootRef.current) {
        setHeight(window.innerHeight - rootRef.current.getBoundingClientRect().top);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** The design's toast(): show for 2s. */
  const toast = useCallback((m: string) => {
    setToastMessage(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2000);
  }, []);

  return (
    <div
      ref={rootRef}
      className="erp-catalog flex flex-col bg-background font-sans text-body-md text-on-surface antialiased overflow-hidden"
      style={height ? { height } : { minHeight: 'calc(100vh - 124px)' }}
    >
      <style>{CSS}</style>

      <div className="flex flex-col h-full w-full">
        {/* Top Navigation Bar */}
        <header className="h-14 px-6 flex items-center justify-between bg-white border-b border-surface-dim shrink-0 z-10">
          <div className="flex items-center gap-4">
            <span className="text-[15px] font-semibold text-on-surface">Product Catalog</span>
            <div className="h-4 w-px bg-surface-dim"></div>
            <span className="text-[13px] text-on-surface-variant font-medium">
              All Products ({CATALOG_TOTAL_COUNT})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-8 px-3 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>Filter
            </button>
            <button
              type="button"
              className="h-8 px-4 rounded text-[13px] font-semibold bg-primary text-white hover:bg-primary-container flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>New Product
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {CATALOG_CARDS.map((card) => (
              <CatalogCard
                key={card.sku}
                card={card}
                onView={() => {
                  toast('Opening product details...');
                  onNavigate('design', 'product-page');
                }}
                onDesign={() => {
                  toast('Opening Design Studio...');
                  onNavigate('design', 'new-design');
                }}
                onEdit={() => toast('Edit product...')}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Toast */}
      <div className={`toast${toastMessage ? ' show' : ''}`}>{toastMessage}</div>
    </div>
  );
}

/** One product card — the design's markup, verbatim. */
function CatalogCard({
  card,
  onView,
  onDesign,
  onEdit,
}: {
  card: CatalogCardData;
  onView: () => void;
  onDesign: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="product-card bg-white border border-surface-dim rounded-xl overflow-hidden flex flex-col">
      {/* Image Area */}
      <div className="relative aspect-[4/3] bg-surface-container-low border-b border-surface-dim">
        <img src={card.imageUrl} alt={card.imageAlt} className="w-full h-full object-cover" />
        {/* Top Right Badge */}
        <div className="absolute top-3 right-3 flex gap-1">
          <span
            className={`supplier-badge supplier-${card.badge} shadow-sm border border-black/5`}
          >
            {card.badgeLabel}
          </span>
        </div>
        {/* Bottom Left Variant Badge */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded backdrop-blur-sm">
            {card.variantCount} Variants
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Title & SKU */}
        <div className="mb-3">
          <h3 className="text-[15px] font-semibold text-on-surface leading-tight mb-1 truncate">
            {card.name}
          </h3>
          <div className="text-[11px] text-on-surface-variant font-mono">SKU: {card.sku}</div>
        </div>

        {/* Key Data Points */}
        <div className="space-y-2 mb-4 flex-1">
          {/* Best Price */}
          <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded border border-surface-dim">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">sell</span> Best Price
            </span>
            <span className="text-[13px] font-semibold text-primary">{card.bestPrice}</span>
          </div>

          {/* Est Shipping */}
          <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded border border-surface-dim">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">local_shipping</span> Est. Shipping
            </span>
            <span className="text-[13px] font-semibold text-on-surface">{card.estShipping}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            className="flex-1 h-8 border border-surface-dim rounded text-[12px] font-semibold hover:bg-surface-container"
            onClick={onView}
          >
            View
          </button>
          <button
            type="button"
            className="flex-1 h-8 bg-[#1e6dc9] text-white rounded text-[12px] font-semibold hover:bg-[#0055a5]"
            onClick={onDesign}
          >
            Design
          </button>
          <button
            type="button"
            aria-label={`Edit ${card.name}`}
            className="w-8 h-8 border border-surface-dim rounded flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
            onClick={onEdit}
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
