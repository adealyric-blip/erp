'use client';

/**
 * Product page — a full screen (not a modal) for viewing a product's
 * details, supplier fulfillment options, variants, and the "Start designing"
 * call to action.
 *
 * Source: upload/productguide.html (Product Details page).
 *
 * Reached from:
 *   - The "View product page" sidebar item (below "New design" in the
 *     Studio group).
 *   - Catalog thumbnail clicks (which open this as a page, not a modal).
 *
 * Start designing → loads the blank into the canvas + shows the
 * "Supplier Selected" confirmation → Enter Studio (navigates to new-design).
 */
import { useEffect, useState } from 'react';
import {
  getBlankOrders,
  getBlankPrice,
  listDesigns,
  type BlankOrderRow,
  type DesignListItem,
  type PriceQuote,
} from '@/lib/podApi';
import {
  CATALOG_PRODUCTS,
  SUPPLIERS,
  blankCardToCatalogProduct,
  useDesignCanvas,
  type CatalogProduct,
  type SupplierData,
} from '@/lib/designCanvasStore';
import type { DomainKey } from '@/data/shellData';
import styles from './ProductPageModal.module.css';

interface ProductPageScreenProps {
  onToast: (msg: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}

const PRODUCT_THUMBS: Record<string, string[]> = {
  default: [
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e8e8e8"/><path d="M30 30 L30 90 L45 90 L45 50 L50 40 L55 50 L55 90 L70 90 L70 30 Z" fill="%23fff" stroke="%23ccc"/></svg>',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e8e8e8"/><path d="M30 30 L30 90 L45 90 L45 50 L50 40 L55 50 L55 90 L70 90 L70 30 Z" fill="%23e5e5e5" stroke="%23ccc"/></svg>',
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e8e8e8"/><path d="M30 30 L30 90 L45 90 L45 50 L50 40 L55 50 L55 90 L70 90 L70 30 Z" fill="%23000" stroke="%23ccc"/></svg>',
  ],
};

function getProductImages(product: CatalogProduct): string[] {
  return PRODUCT_THUMBS[product.blankKey] ?? PRODUCT_THUMBS.default;
}

function getProductSpecs(product: CatalogProduct) {
  const specs: { label: string; value: string }[] = [];
  if (product.fabric) specs.push({ label: 'Fabric', value: product.fabric });
  if (product.fit) specs.push({ label: 'Fit', value: product.fit });
  specs.push({ label: 'Eligibility', value: product.eligibility });
  specs.push({ label: 'Department', value: product.department });
  return specs;
}

export default function ProductPageScreen({ onToast, onNavigate }: ProductPageScreenProps) {
  // Top category nav — the SAME persisted selection as the canvas. It lives
  // in the store, so it survives canvas ↔ products-page navigation.
  const activeCategory = useDesignCanvas((s) => s.activeCategory);
  const activeSubcategory = useDesignCanvas((s) => s.activeSubcategory);
  const setCategory = useDesignCanvas((s) => s.setCategory);
  const navMap = useDesignCanvas((s) => s.navMap);
  const loadNavCategories = useDesignCanvas((s) => s.loadNavCategories);
  const catalogCards = useDesignCanvas((s) => s.catalogCards);
  const catalogStatus = useDesignCanvas((s) => s.catalogStatus);
  const loadCategoryProducts = useDesignCanvas((s) => s.loadCategoryProducts);
  const blankDetail = useDesignCanvas((s) => s.blankDetail);
  const loadBlankDetail = useDesignCanvas((s) => s.loadBlankDetail);
  const startDesign = useDesignCanvas((s) => s.startDesign);

  useEffect(() => {
    void loadNavCategories();
    void loadCategoryProducts();
  }, [loadNavCategories, loadCategoryProducts]);

  // The page shows the loaded provider detail when there is one; otherwise
  // the store's product page, the first card of the active category, or the
  // legacy first catalog product.
  const storeProduct = useDesignCanvas((s) => s.productPage);
  const product: CatalogProduct = blankDetail
    ? blankCardToCatalogProduct(blankDetail, activeCategory, activeSubcategory)
    : (storeProduct ??
      (catalogCards[0]
        ? blankCardToCatalogProduct(catalogCards[0], activeCategory, activeSubcategory)
        : CATALOG_PRODUCTS[0]));

  // Gallery: the provider's own skeleton views when loaded, else the
  // legacy thumbnails.
  const images = blankDetail
    ? blankDetail.views.map((v) => v.baseUrl)
    : getProductImages(product);
  const specs = getProductSpecs(product);
  if (blankDetail) {
    specs.push({ label: 'Supplier', value: blankDetail.supplier });
    specs.push({
      label: 'Base price',
      value: blankDetail.baseCost != null ? `USD ${blankDetail.baseCost.toFixed(2)}` : '—',
    });
  }
  const features = product.features ?? [];

  const [activeImg, setActiveImg] = useState(0);
  const [activeSupplier, setActiveSupplier] = useState<string>('printify-choice');
  const [selectedColor, setSelectedColor] = useState<string>('#ffffff');
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Product page tabs (customer-profile pattern: one record, tabs
  // for Product page, Variants, Orders, Shipping, Pricing, Associated
  // designs). Each tab reads the live tables; nothing is invented. ──
  type ProductTab = 'product' | 'variants' | 'orders' | 'shipping' | 'pricing' | 'designs';
  const [tab, setTab] = useState<ProductTab>('product');
  const [tabOrders, setTabOrders] = useState<BlankOrderRow[] | null>(null);
  const [tabPrice, setTabPrice] = useState<PriceQuote | null>(null);
  const [tabDesigns, setTabDesigns] = useState<DesignListItem[] | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const openStudio = useDesignCanvas((s) => s.openStudio);
  useEffect(() => {
    if (!blankDetail || tab === 'product' || tab === 'variants' || tab === 'shipping') return;
    setTabError(null);
    if (tab === 'orders') {
      setTabOrders(null);
      void getBlankOrders(blankDetail.id)
        .then((r) => setTabOrders(r.orders))
        .catch((e: Error) => setTabError(e.message));
    } else if (tab === 'pricing') {
      setTabPrice(null);
      void getBlankPrice(blankDetail.id)
        .then((q) => setTabPrice(q))
        .catch((e: Error) => setTabError(e.message));
    } else if (tab === 'designs') {
      setTabDesigns(null);
      void listDesigns({ blankId: blankDetail.id, limit: 50 })
        .then((r) => setTabDesigns(r.items))
        .catch((e: Error) => setTabError(e.message));
    }
  }, [tab, blankDetail?.id]);

  const loadBlank = useDesignCanvas((s) => s.loadBlank);

  // Every printer carrying this same/similar product type — one tab each,
  // real base price + live production time per printer. Legacy blanks keep
  // the three hardcoded supplier tabs below.
  const formatDelivery = (d: { average: number; unit: string } | null): string =>
    d ? `≈${d.average} ${d.unit.replace(/_/g, ' ')}` : '—';
  const printerTabs: SupplierData[] = blankDetail
    ? blankDetail.printers.map((p) => ({
        key: p.slug,
        name: p.name,
        badge: 'Base price',
        price: p.baseCost ?? 0,
        premiumPrice: p.baseCost ?? 0,
        shipping: 0,
        delivery: formatDelivery(p.estimatedDelivery),
        origin: blankDetail.shippingFrom,
        colors: blankDetail.variants.colors.map((c) => c.hex),
        sizes: blankDetail.variants.sizes,
        printAreas: blankDetail.variants.printAreas,
      }))
    : [];
  // When a detail loads, select its own printer's tab.
  useEffect(() => {
    if (blankDetail) setActiveSupplier(blankDetail.supplierSlug);
  }, [blankDetail?.id]);
  const supplier: SupplierData =
    printerTabs.find((t) => t.key === activeSupplier) ??
    printerTabs[0] ??
    SUPPLIERS[activeSupplier] ??
    SUPPLIERS['printify-choice'];

  const handleStartDesign = () => {
    if (blankDetail) {
      void startDesign(blankDetail, selectedColor)
        .then(() => setConfirmOpen(true))
        .catch((e: Error) => onToast(`Could not create the design: ${e.message}`));
    } else {
      loadBlank(product.blankKey);
      setConfirmOpen(true);
    }
  };

  const handleEnterStudio = () => {
    setConfirmOpen(false);
    onNavigate('design', 'new-design');
    onToast(`${product.name} loaded into the studio.`);
  };

  return (
    <div className={styles.pageRoot}>
      <div className={styles.pageCard}>
        {/* Top category nav — persisted from the canvas. Same selection,
            same categories, in both places. */}
        <div className={styles.topNav}>
          {Object.keys(navMap).map((category) => (
            <button
              key={category}
              type="button"
              className={`${styles.topNavBtn} ${activeCategory === category ? styles.topNavBtnActive : ''}`}
              onClick={() => setCategory(category, navMap[category][0])}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Detail cards for the active category — the first place the
            selection lands. Clicking a card loads its provider detail. */}
        <div className={styles.cardsStrip}>
          {catalogStatus === 'loading' && catalogCards.length === 0 && (
            <span>Loading products…</span>
          )}
          {catalogCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={`${styles.cardBtn} ${blankDetail?.id === card.id ? styles.cardBtnActive : ''}`}
              onClick={() => void loadBlankDetail(card.id)}
            >
              <img src={card.mockupThumbUrl} alt={card.name} className={styles.cardThumb} />
              <span className={styles.cardName}>{card.name}</span>
              <span className={styles.cardPrice}>
                {card.baseCost != null ? `USD ${card.baseCost.toFixed(2)}` : 'Price —'}
              </span>
            </button>
          ))}
        </div>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={`material-symbols-outlined ${styles.icon18}`}>
              inventory_2
            </span>
            Product Details
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            title="Back to New design"
            onClick={() => onNavigate('design', 'new-design')}
          >
            <span className={`material-symbols-outlined ${styles.icon18}`}>
              arrow_back
            </span>
          </button>
        </div>

        {/* Tabs Navigation — customer-profile pattern (one record, tabs). */}
        <div className="border-b border-surface-dim mb-4 overflow-x-auto">
          <div className="flex items-center gap-6 min-w-max">
            {(
              [
                ['product', 'Product page'],
                ['variants', 'Variants'],
                ['orders', 'Orders'],
                ['shipping', 'Shipping'],
                ['pricing', 'Pricing'],
                ['designs', 'Associated designs'],
              ] as [ProductTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`pb-3 text-[14px] tab-underline ${
                  tab === id ? 'active' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body — the Product page tab. Other tabs render below. */}
        <div className={styles.body} style={tab !== 'product' ? { display: 'none' } : undefined}>
          <div className={styles.hero}>
            {/* Gallery */}
            <div className={styles.gallery}>
              <div className={styles.mainImage}>
                <img
                  src={images[Math.min(activeImg, images.length - 1)]}
                  alt={product.name}
                />
              </div>
              <div className={styles.thumbRow}>
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`${styles.thumb} ${i === activeImg ? styles.active : ''}`}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={img} alt={`Thumb ${i + 1}`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Info column */}
            <div className={styles.infoCol}>
              <div>
                {product.bestseller && (
                  <div className={styles.badge}>
                    <span className={`material-symbols-outlined ${styles.icon14}`}>
                      local_fire_department
                    </span>
                    Bestseller
                  </div>
                )}
                <h1 className={styles.title}>{product.name}</h1>
                <p className={styles.brand}>
                  {product.brand}{' '}
                  <span className={styles.productDetailsLink}>
                    Product details
                  </span>
                </p>
              </div>

              {/* Specs */}
              <div className={styles.specs}>
                {specs.map((s) => (
                  <div key={s.label} className={styles.spec}>
                    <b>{s.label}</b>
                    <span>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Unified fulfillment */}
              <div className={styles.fulfillment}>
                <div className={styles.fulfillHeader}>
                  <h2 className={styles.fulfillTitle}>Select fulfillment option</h2>
                </div>

                {/* Supplier tabs — one tab per real printer carrying this
                    product type, else the legacy three tabs. */}
                <div className={styles.supplierTabs}>
                  {printerTabs.length > 0 ? (
                    printerTabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`${styles.supplierTab} ${
                          activeSupplier === t.key ? styles.active : ''
                        }`}
                        onClick={() => setActiveSupplier(t.key)}
                      >
                        {t.name}
                      </button>
                    ))
                  ) : (
                    Object.values(SUPPLIERS).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className={`${styles.supplierTab} ${
                          activeSupplier === s.key ? styles.active : ''
                        }`}
                        onClick={() => setActiveSupplier(s.key)}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>

                {/* Supplier name + badge */}
                <div className={styles.supplierName}>
                  <b>{supplier.name}</b>
                  <span className={styles.supplierBadge}>{supplier.badge}</span>
                </div>

                {/* Summary boxes */}
                <div className={styles.summary}>
                  <div className={styles.summaryBox}>
                    <div className={styles.summaryLabel}>Lowest Price</div>
                    <div className={styles.summaryValue}>From USD {supplier.price.toFixed(2)}</div>
                    <div className={styles.summarySub}>
                      {printerTabs.length > 0
                        ? 'Base production cost'
                        : `From USD ${supplier.premiumPrice.toFixed(2)} with Printify Premium`}
                    </div>
                  </div>
                  <div className={styles.summaryBox}>
                    <div className={styles.summaryLabel}>Most Shipping Options</div>
                    <div className={styles.summaryValue}>
                      {printerTabs.length > 0 ? 'Calculated at checkout' : `From USD ${supplier.shipping.toFixed(2)}`}
                    </div>
                    <div className={styles.summarySub}>Economy or Standard shipping</div>
                  </div>
                  <div className={styles.summaryBox}>
                    <div className={styles.summaryLabel}>Fastest Delivery</div>
                    <div className={styles.summaryValue}>{supplier.delivery}</div>
                    <div className={styles.summarySub}>* avg. production time</div>
                  </div>
                  <div className={styles.summaryBox}>
                    <div className={styles.summaryLabel}>Origin</div>
                    <div className={`${styles.summaryValue} ${styles.summaryValueSm}`}>
                      {supplier.origin}
                    </div>
                  </div>
                </div>

                {/* Variants */}
                <div className={styles.variantSection}>
                  <div className={styles.variantTitle}>
                    Widest selection of colors &amp; sizes *
                  </div>

                  <div className={styles.variantGroupColors}>
                    <div className={styles.variantGroupLabel}>
                      Colors • {supplier.colors.length}
                    </div>
                    <div className={styles.swatches}>
                      {supplier.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`${styles.swatchBtn} ${
                            c === selectedColor ? styles.active : ''
                          }`}
                          onClick={() => setSelectedColor(c)}
                          title={c}
                        >
                          <div className={styles.swatchInner} style={{ background: c }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.variantGroup}>
                    <div className={styles.variantGroupLabel}>
                      Sizes • {supplier.sizes.length}
                    </div>
                    <div className={styles.sizes}>
                      {supplier.sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.sizeBtn} ${
                            s === selectedSize ? styles.active : ''
                          }`}
                          onClick={() => setSelectedSize(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.variantGroup}>
                    <div className={styles.variantGroupLabel}>
                      Print areas • {supplier.printAreas.length}
                    </div>
                    <div className={styles.printAreas}>
                      {supplier.printAreas.map((p) => (
                        <span key={p} className={styles.printArea}>
                          <span className={`material-symbols-outlined ${styles.icon14}`}>
                            crop_square
                          </span>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Shipping */}
                <div className={styles.shipping}>
                  <span className={`material-symbols-outlined ${styles.icon16}`}>
                    local_shipping
                  </span>
                  Shipping from: {supplier.origin}
                </div>

                {/* CTA */}
                <button type="button" className={styles.cta} onClick={handleStartDesign}>
                  Start designing
                  <span className={`material-symbols-outlined ${styles.icon18}`}>
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Features list */}
          {features.length > 0 && (
            <div className={styles.featuresSection}>
              <h3 className={styles.featuresTitle}>Key Features</h3>
              <ul className={styles.featuresList}>
                {features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tab panels — Variants, Orders, Shipping, Pricing, Associated designs. */}
        {tab !== 'product' && (
          <div className={styles.body}>
            {!blankDetail && (
              <p>No product loaded. Pick a product from the cards above.</p>
            )}
            {blankDetail && tabError && <p>Could not load this tab: {tabError}</p>}
            {blankDetail && tab === 'variants' && (
              <div>
                <h3>Variants — real colors and sizes from the supplier</h3>
                <p>
                  Colors • {blankDetail.variants.colors.length} &nbsp;·&nbsp; Sizes •{' '}
                  {blankDetail.variants.sizes.length} &nbsp;·&nbsp; Print areas •{' '}
                  {blankDetail.variants.printAreas.length}
                </p>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Color</th>
                      <th>Hex</th>
                      <th>Sizes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blankDetail.variants.colors.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 14,
                              height: 14,
                              background: c.hex,
                              border: '1px solid #ccc',
                              marginRight: 6,
                              verticalAlign: 'middle',
                            }}
                          />
                          {c.hex}
                        </td>
                        <td>{blankDetail.variants.sizes.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>Print areas: {blankDetail.variants.printAreas.join(' · ') || '—'}</p>
              </div>
            )}
            {blankDetail && tab === 'orders' && (
              <div>
                <h3>Orders for this product</h3>
                {tabOrders === null && !tabError && <p>Loading orders…</p>}
                {tabOrders !== null && tabOrders.length === 0 && <p>No orders yet.</p>}
                {tabOrders !== null && tabOrders.length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Status</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Order total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabOrders.map((o) => (
                        <tr key={o.id}>
                          <td>{o.orderNumber ?? o.orderId}</td>
                          <td>{o.status ?? '—'}</td>
                          <td>{o.quantity}</td>
                          <td>{o.unitPrice != null ? `USD ${o.unitPrice.toFixed(2)}` : '—'}</td>
                          <td>{o.orderTotal != null ? `USD ${o.orderTotal.toFixed(2)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {blankDetail && tab === 'shipping' && (
              <div>
                <h3>Shipping — live production time per printer</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Printer</th>
                      <th>Base cost</th>
                      <th>Estimated delivery</th>
                      <th>Ships from</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blankDetail.printers.map((p) => (
                      <tr key={p.slug}>
                        <td>{p.name}</td>
                        <td>{p.baseCost != null ? `USD ${p.baseCost.toFixed(2)}` : '—'}</td>
                        <td>
                          {p.estimatedDelivery
                            ? `≈${p.estimatedDelivery.average} ${p.estimatedDelivery.unit.replace(/_/g, ' ')}`
                            : '—'}
                        </td>
                        <td>{blankDetail.shippingFrom || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Fulfillment routes are created per variant when an order is placed; none
                  are stored for this blank yet.
                </p>
              </div>
            )}
            {blankDetail && tab === 'pricing' && (
              <div>
                <h3>Pricing — server-computed, suggestion only</h3>
                {tabPrice === null && !tabError && <p>Loading pricing…</p>}
                {tabPrice !== null && (
                  <div>
                    <p>
                      Base cost (from {tabPrice.printer.name}): USD {tabPrice.cost.toFixed(2)}
                    </p>
                    <p>Shipping tier: USD {tabPrice.shippingTier.toFixed(2)}</p>
                    <p>
                      Suggested retail: USD {tabPrice.suggestedRetailPrice.toFixed(2)} (cost ×
                      markup + shipping)
                    </p>
                    <p>Margin at suggested: USD {tabPrice.marginAtSuggested.toFixed(2)}</p>
                    <p>
                      Estimated delivery:{' '}
                      {tabPrice.estimatedDelivery
                        ? `≈${tabPrice.estimatedDelivery.average} ${tabPrice.estimatedDelivery.unit.replace(/_/g, ' ')}`
                        : '—'}
                    </p>
                    <p>
                      The suggested retail is not the price. The user sets their own price on
                      the card before publishing; publish stores exactly the price sent.
                    </p>
                  </div>
                )}
              </div>
            )}
            {blankDetail && tab === 'designs' && (
              <div>
                <h3>Associated designs</h3>
                {tabDesigns === null && !tabError && <p>Loading designs…</p>}
                {tabDesigns !== null && tabDesigns.length === 0 && (
                  <p>No designs use this blank yet.</p>
                )}
                {tabDesigns !== null && tabDesigns.length > 0 && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Design</th>
                        <th>Status</th>
                        <th>Color</th>
                        <th>Retail price</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabDesigns.map((d) => (
                        <tr key={d.id}>
                          <td>{d.name}</td>
                          <td>{d.status}</td>
                          <td>{d.garment_color ?? '—'}</td>
                          <td>
                            {d.retail_price != null ? `USD ${d.retail_price.toFixed(2)}` : '—'}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                void openStudio({ entry: 'catalog', designId: d.id }).then(() =>
                                  onNavigate('design', 'new-design'),
                                );
                              }}
                            >
                              Open in Studio
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation sub-modal (productguide.html "Supplier Selected") */}
      {confirmOpen && (
        <div className={styles.confirmOverlay} onClick={(e) => e.stopPropagation()}>
          <div className={styles.confirmBox}>
            <span
              className={`material-symbols-outlined ${styles.confirmIcon}`}
            >
              check_circle
            </span>
            <h2>Supplier Selected</h2>
            <p>
              You have selected <b>{supplier.name}</b> for this product. You will now be redirected
              to the Studio to begin your design.
            </p>
            <button type="button" className={styles.confirmBtn} onClick={handleEnterStudio}>
              Enter Studio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
