'use client';

/**
 * Product page modal — opens when a catalog thumbnail is clicked.
 * Source: upload/productguide.html (Product Details page).
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  Gallery (main + thumbs) │ Info col    │
 *   │                         │ - badge      │
 *   │                         │ - title      │
 *   │                         │ - specs      │
 *   │                         │ - fulfillment │
 *   │                         │   (supplier   │
 *   │                         │    tabs +     │
 *   │                         │    variants)  │
 *   │                         │ - Start       │
 *   │                         │   designing   │
 *   └──────────────────────────────────────┘
 *
 * Start designing → loads the blank into the canvas + shows the
 * "Supplier Selected" confirmation → Enter Studio (closes modal).
 */
import { useState } from 'react';
import {
  CATALOG_PRODUCTS,
  SUPPLIERS,
  useDesignCanvas,
  type CatalogProduct,
  type SupplierData,
} from '@/lib/designCanvasStore';
import styles from './ProductPageModal.module.css';

interface ProductPageModalProps {
  product: CatalogProduct;
  onClose: () => void;
  onEnterStudio: () => void;
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

export default function ProductPageModal({ product, onClose, onEnterStudio }: ProductPageModalProps) {
  const images = getProductImages(product);
  const specs = getProductSpecs(product);
  const features = product.features ?? [];

  const [activeImg, setActiveImg] = useState(0);
  const [activeSupplier, setActiveSupplier] = useState<string>('printify-choice');
  const [selectedColor, setSelectedColor] = useState<string>('#ffffff');
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const loadBlankDetail = useDesignCanvas((s) => s.loadBlankDetail);

  const supplier: SupplierData = SUPPLIERS[activeSupplier] ?? SUPPLIERS['printify-choice'];

  const handleStartDesign = () => {
    // API cards load the provider detail (skeletons, base price, variant
    // colors) onto the canvas; legacy rows fall back to the local blank.
    void loadBlankDetail(product.id)
      .then((detail) => {
        if (!detail) loadBlank(product.blankKey);
        setConfirmOpen(true);
      })
      .catch(() => {
        loadBlank(product.blankKey);
        setConfirmOpen(true);
      });
  };

  const handleEnterStudio = () => {
    setConfirmOpen(false);
    onClose();
    onEnterStudio();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              <span className={`material-symbols-outlined ${styles.icon18}`}>
                inventory_2
              </span>
              Product Details
            </div>
            <button type="button" className={styles.closeBtn} title="Close" onClick={onClose}>
              <span className={`material-symbols-outlined ${styles.icon18}`}>
                close
              </span>
            </button>
          </div>

          {/* Body */}
          <div className={styles.body}>
            <div className={styles.hero}>
              {/* Gallery */}
              <div className={styles.gallery}>
                <div className={styles.mainImage}>
                  <img src={images[activeImg]} alt={product.name} />
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

                  {/* Supplier tabs */}
                  <div className={styles.supplierTabs}>
                    {Object.values(SUPPLIERS).map((s) => (
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
                    ))}
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
                        From USD {supplier.premiumPrice.toFixed(2)} with Printify Premium
                      </div>
                    </div>
                    <div className={styles.summaryBox}>
                      <div className={styles.summaryLabel}>Most Shipping Options</div>
                      <div className={styles.summaryValue}>From USD {supplier.shipping.toFixed(2)}</div>
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
        </div>
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
    </>
  );
}
