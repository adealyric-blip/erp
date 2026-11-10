'use client';
/**
 * ErpProductCatalogScreen — EXACT 1:1 implementation of
 * upload/product cards.html ("Product Catalog — ERP").
 *
 * Structure, classes, fonts, colors, copy and interactions are the
 * design, verbatim. DATA IS LIVE: the cards come from
 * GET /api/v1/blanks (keeper suppliers, grouped one card per canonical
 * product) — real images, real SKUs, real best prices, real supplier
 * badges, real variant counts — paginated with Load more so the whole
 * catalog (~12k keeper products) is reachable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listBlanks, type BlankCard } from '@/lib/podApi';
import {
  useDesignCanvas,
  blankCardToCatalogProduct,
} from '@/lib/designCanvasStore';
import type { DomainKey } from '@/data/shellData';

/* The page's own <style> block, verbatim (scoped under .erp-catalog
   so pages don't fight each other; values unchanged). One addition:
   .supplier-other — the neutral badge for keeper suppliers that are
   neither Printify nor Printful (e.g. Cloudprinter). */
const CSS = `
.erp-catalog .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1c1e;color:#fff;padding:10px 16px;border-radius:8px;font:500 13px Inter;z-index:500;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw}
.erp-catalog .toast.show{opacity:1}

/* Supplier Badges */
.erp-catalog .supplier-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
.erp-catalog .supplier-printify { background: #e0f2fe; color: #0369a1; }
.erp-catalog .supplier-printful { background: #f3e8ff; color: #6b21a8; }
.erp-catalog .supplier-both { background: #fef3c7; color: #92400e; }
.erp-catalog .supplier-other { background: #e7f0ec; color: #33503f; }

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
  /** The catalog node's department (root) name, e.g. 'Accessories'. */
  category?: string;
  /** The catalog node's leaf name, e.g. 'backpacks' or 'Bags'. */
  subcategory?: string;
}

const money = (n: number | null) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ErpProductCatalogScreen({
  onToast,
  onNavigate,
  category,
  subcategory,
}: ErpProductCatalogScreenProps) {
  const [toastMessage, setToastMessage] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Live catalog state ──
  const [items, setItems] = useState<BlankCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [matched, setMatched] = useState<boolean>(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Store wiring: View sets the product page product; Design opens the
  // studio with the blank loaded onto the canvas.
  const openStudio = useDesignCanvas((s) => s.openStudio);
  const openProductPage = useDesignCanvas((s) => s.openProductPage);

  const loadPage = useCallback(
    async (cur: string | null) => {
      try {
        if (cur) setLoadingMore(true);
        else setStatus('loading');
        const res = await listBlanks({
          category: category ?? 'All',
          ...(subcategory ? { subcategory } : {}),
          limit: 50,
          ...(cur ? { cursor: cur } : {}),
        });
        setItems((prev) => (cur ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
        setTotal(res.meta?.total ?? null);
        setMatched(res.meta?.matched !== false);
        setStatus('ready');
        setError(null);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load products.');
      } finally {
        setLoadingMore(false);
      }
    },
    [category, subcategory],
  );

  // Reload whenever the catalog node changes.
  useEffect(() => {
    setItems([]);
    setCursor(null);
    setTotal(null);
    void loadPage(null);
  }, [loadPage]);

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

  /** View → the ERP product page, with the real product in the store. */
  function handleView(card: BlankCard) {
    toast('Opening product details...');
    openProductPage(
      blankCardToCatalogProduct(card, category ?? 'Catalog', subcategory ?? ''),
    );
    onNavigate('design', 'product-page');
  }

  /** Design → the studio canvas, with this blank loaded on it. */
  async function handleDesign(card: BlankCard) {
    toast(`"${card.name}" loading onto canvas...`);
    await openStudio({ entry: 'catalog', blankIds: [card.id] });
    onNavigate('design', 'new-design');
  }

  const nodeLabel = category
    ? `${category}${subcategory ? ` · ${subcategory}` : ''}`
    : 'All Products';

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
              {nodeLabel}
              {total !== null ? ` (${total.toLocaleString('en-US')})` : ''}
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
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
              <span className="text-[13px] font-medium">Loading {nodeLabel}…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] text-error">error</span>
              <span className="text-[13px] font-medium">{error}</span>
              <button
                type="button"
                className="h-8 px-4 border border-surface-dim rounded text-[13px] font-semibold hover:bg-surface-container"
                onClick={() => void loadPage(null)}
              >
                Retry
              </button>
            </div>
          )}

          {status === 'ready' && !matched && (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">search_off</span>
              <span className="text-[13px] font-medium">
                No catalog node matches “{nodeLabel}”.
              </span>
              <span className="text-[12px]">Nothing was substituted — pick another node in the sidebar.</span>
            </div>
          )}

          {status === 'ready' && matched && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">inventory_2</span>
              <span className="text-[13px] font-medium">No products in {nodeLabel} yet.</span>
              <span className="text-[12px]">Keeper suppliers carry nothing under this node.</span>
            </div>
          )}

          {status === 'ready' && matched && items.length > 0 && (
            <>
              {/* Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map((card) => (
                  <CatalogCard
                    key={card.id}
                    card={card}
                    onView={() => handleView(card)}
                    onDesign={() => void handleDesign(card)}
                    onEdit={() => toast('Edit product...')}
                  />
                ))}
              </div>

              {/* Load more — the API pages 50 at a time; this reaches the
                  whole catalog (every keeper product) without dumping
                  12k cards into the DOM at once. */}
              {cursor && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <button
                    type="button"
                    disabled={loadingMore}
                    className="h-9 px-6 border border-surface-dim rounded bg-white text-[13px] font-semibold hover:bg-surface-container disabled:opacity-50 flex items-center gap-2"
                    onClick={() => void loadPage(cursor)}
                  >
                    {loadingMore ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Loading…
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                        Load more ({items.length.toLocaleString('en-US')}
                        {total !== null ? ` of ${total.toLocaleString('en-US')}` : ''})
                      </>
                    )}
                  </button>
                </div>
              )}
              {!cursor && total !== null && total > 50 && (
                <div className="text-center text-[12px] text-on-surface-variant py-6">
                  Showing all {items.length.toLocaleString('en-US')} products
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Toast */}
      <div className={`toast${toastMessage ? ' show' : ''}`}>{toastMessage}</div>
    </div>
  );
}

/** One product card — the design's markup, verbatim, on live data. */
function CatalogCard({
  card,
  onView,
  onDesign,
  onEdit,
}: {
  card: BlankCard;
  onView: () => void;
  onDesign: () => void;
  onEdit: () => void;
}) {
  const suppliers = card.suppliers ?? [];
  const supplierCount = card.supplierCount ?? (suppliers.length || 1);
  const badge =
    supplierCount > 1
      ? 'both'
      : card.supplierSlug === 'printful'
        ? 'printful'
        : card.supplierSlug === 'printify'
          ? 'printify'
          : 'other';
  const badgeLabel =
    supplierCount > 1 ? `${supplierCount} Suppliers` : card.supplier;

  return (
    <div className="product-card bg-white border border-surface-dim rounded-xl overflow-hidden flex flex-col">
      {/* Image Area */}
      <div className="relative aspect-[4/3] bg-surface-container-low border-b border-surface-dim">
        {card.mockupThumbUrl ? (
          <img
            src={card.mockupThumbUrl}
            alt={card.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">
              checkroom
            </span>
          </div>
        )}
        {/* Top Right Badge */}
        <div className="absolute top-3 right-3 flex gap-1">
          <span
            className={`supplier-badge supplier-${badge} shadow-sm border border-black/5`}
          >
            {badgeLabel}
          </span>
        </div>
        {/* Bottom Left Variant Badge */}
        <div className="absolute bottom-3 left-3">
          <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded backdrop-blur-sm">
            {card.variantCount ?? 0} Variants
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
          <div className="text-[11px] text-on-surface-variant font-mono">
            SKU: {card.sku ?? '—'}
          </div>
        </div>

        {/* Key Data Points */}
        <div className="space-y-2 mb-4 flex-1">
          {/* Best Price */}
          <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded border border-surface-dim">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">sell</span> Best Price
            </span>
            <span className="text-[13px] font-semibold text-primary">{money(card.baseCost)}</span>
          </div>

          {/* Est Shipping — the card payload carries no shipping estimate;
              the product page shows it (BlankDetail.shippingCost). */}
          <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded border border-surface-dim">
            <span className="text-[12px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">local_shipping</span> Est. Shipping
            </span>
            <span className="text-[13px] font-semibold text-on-surface">
              {card.fulfillment === 'POD' ? 'POD' : '—'}
            </span>
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
