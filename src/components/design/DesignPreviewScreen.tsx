'use client';

/**
 * Design Studio — Preview & Publish page.
 * Source: upload/mockup preview.html (Studio Preview Screen).
 *
 * This is the canvas preview screen as its own page. Users land here from:
 *   - The Edit/Preview toggle on the canvas (New design) screen.
 *   - The "Preview & Publish" button on the canvas.
 *   - The "Preview" sidebar item in the Studio group.
 *
 * Layout (1:1 with mockup preview.html):
 *   ┌─────────────────────────────┬──────────────┐
 *   │  Center mockup               │  Right rail   │
 *   │  [Edit/Preview toggle]       │  (Mockup view │
 *   │  [Variant Screen] btn        │   controls)   │
 *   │  [Product Info] btn           │               │
 *   │                               │               │
 *   ├───────────────────────────────┤               │
 *   │  Download · Save · PUBLISH    │               │
 *   └───────────────────────────────┴──────────────┘
 *
 * Publish → creates a published product entry that goes live to the
 * global Catalog domain (Published Items & SKUs) on the main icon rail.
 */
import { useEffect, useState } from 'react';
import {
  SUPPLIER_COLORS,
  useDesignCanvas,
} from '@/lib/designCanvasStore';
import { getPrice, publishDesign, type PriceQuote } from '@/lib/podApi';
import type { DomainKey } from '@/data/shellData';
import styles from './DesignPreview.module.css';

interface DesignPreviewScreenProps {
  onToast: (msg: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}

const MOCKUP_ANGLES = ['Front', 'Back', 'Folded', 'Folded 2'];

// Variant modal colors (from mockup preview.html).
const VARIANT_COLORS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Ash', hex: '#e5e5e5' },
  { name: 'Sport Grey', hex: '#b0b0b0' },
  { name: 'Graphite Heather', hex: '#555555' },
  { name: 'Dark Heather', hex: '#444444' },
  { name: 'Charcoal', hex: '#333333' },
  { name: 'Black', hex: '#000000' },
  { name: 'Antique Cherry Red', hex: '#a32b3d' },
];

export default function DesignPreviewScreen({ onToast, onNavigate }: DesignPreviewScreenProps) {
  const product = useDesignCanvas((s) => s.product);
  const color = useDesignCanvas((s) => s.color);
  const selectColor = useDesignCanvas((s) => s.selectColor);
  const designId = useDesignCanvas((s) => s.designId);
  const blankDetail = useDesignCanvas((s) => s.blankDetail);

  // The card's pricing: base cost flowing in from the printer, the printer,
  // its estimated delivery, and the suggested retail — the suggestion is
  // not the price. The user sets their own price before publishing.
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [userPrice, setUserPrice] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!designId) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void getPrice(designId)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setQuoteError(null);
        // Prefill with the price the user already set, else the suggestion.
        setUserPrice((q.userPrice ?? q.suggestedRetailPrice).toFixed(2));
      })
      .catch((e: Error) => {
        if (!cancelled) setQuoteError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [designId]);

  const [activeAngle, setActiveAngle] = useState(0);
  const [colorMode, setColorMode] = useState<'cmyk' | 'rgb'>('rgb');
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [scalingModalOpen, setScalingModalOpen] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [variantTab, setVariantTab] = useState<'color' | 'size'>('color');
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
    new Set(['White'])
  );
  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({
    cost: true,
    printArea: true,
    guidelines: true,
  });

  const toggleVariant = (name: string) => {
    setSelectedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handlePublish = async () => {
    if (!designId || !quote) return;
    const price = Number.parseFloat(userPrice);
    if (!(price > 0)) {
      setPublishError('Enter your price (above 0).');
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await publishDesign(
        designId,
        {
          price,
          supplierSlug: quote.printer.slug,
          variants: [...selectedVariants].map((c) => ({
            color: c,
            size: blankDetail?.variants.sizes[0] ?? 'M',
          })),
        },
        crypto.randomUUID(),
      );
      setPublishConfirmOpen(false);
      if (res.status === 'published') {
        onToast(`"${product?.name}" published at USD ${price.toFixed(2)}.`);
      } else {
        onToast(
          `"${product?.name}" saved as a draft at USD ${price.toFixed(2)} — ${res.supplier.warnings[0] ?? 'supplier step pending.'}`,
        );
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  const toggleAcc = (k: string) => setOpenAcc((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className={styles.root}>
      {/* Center canvas (the mockup) */}
      <main className={styles.center}>
        {product ? (
          <img className={styles.mockupImage} src={product.img} alt="Mockup" />
        ) : (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined">image</span>
            <h3>No product loaded</h3>
            <p>Go back to New design and load a blank, or drag one from the catalog.</p>
          </div>
        )}

        {/* Top toggle (Edit / Preview) */}
        <div className={styles.topToggle}>
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => onNavigate('design', 'new-design')}
          >
            Edit
          </button>
          <button type="button" className={`${styles.toggleBtn} ${styles.on}`}>
            Preview
          </button>
        </div>

        {/* Action overlay — the 2 buttons from mockup preview.html */}
        <div className={styles.actionOverlay}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setVariantModalOpen(true)}
          >
            <span className="material-symbols-outlined">palette</span>
            Variant Screen
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setInfoModalOpen(true)}
          >
            <span className="material-symbols-outlined">info</span>
            Product Info Screen
          </button>
        </div>
      </main>

      {/* Right rail — Mockup view controls */}
      <aside className={styles.rightRail}>
        <div className={styles.railHeader}>
          <h2>Mockup view</h2>
        </div>
        <div className={styles.railBody}>
          {/* Mockup thumbs */}
          <div className={styles.mockupThumbs}>
            {MOCKUP_ANGLES.map((a, i) => (
              <button
                key={a}
                type="button"
                className={`${styles.mockupThumb} ${i === activeAngle ? styles.active : ''}`}
                onClick={() => setActiveAngle(i)}
                title={a}
              >
                {product && <img src={product.img} alt={a} />}
              </button>
            ))}
          </div>
          <button type="button" className={`${styles.btnOutline} ${styles.btnFull}`}>
            <span className="material-symbols-outlined">add</span>
            Show more
          </button>

          <div className={styles.muted}>
            Preview product size: L
            <br />
            Design is scaled down on smaller sizes.
          </div>
          <button
            type="button"
            className={`${styles.btnOutline} ${styles.btnFull}`}
            onClick={() => setScalingModalOpen(true)}
          >
            Design scaling
          </button>

          <div className={styles.sectionLabel}>
            Mockup color mode{' '}
            <span className={`material-symbols-outlined ${styles.icon14}`}>
              open_in_new
            </span>
          </div>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="color-mode"
              checked={colorMode === 'cmyk'}
              onChange={() => setColorMode('cmyk')}
            />
            Realistic (CMYK)
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              name="color-mode"
              checked={colorMode === 'rgb'}
              onChange={() => setColorMode('rgb')}
            />
            Bright/colourful (RGB)
          </label>

          <div className={styles.sectionLabel}>{product?.brand ?? 'Gildan'} Colors</div>
          <div className={styles.colorDots}>
            {SUPPLIER_COLORS.map((c) => (
              <div
                key={c.name}
                className={`${styles.colorDot} ${c.name === color.name ? styles.active : ''}`}
                style={{ background: c.hex }}
                title={c.name}
                onClick={() => selectColor(c)}
              />
            ))}
          </div>

          <div className={styles.sectionLabel}>Mockup background</div>
          <p className={`${styles.muted} ${styles.mutedNoMargin}`}>
            Recommended resolution 2048 x 2048px. Max resolution 30000 x 30000px. JPG and PNG up to
            100 MiB. SVG up to 20 MiB.
          </p>
          <div className={styles.bgRow}>
            <button type="button" className={`${styles.btnOutline} ${styles.btnFlex}`}>
              <span className="material-symbols-outlined">add_photo_alternate</span>
              Add image
            </button>
            <button type="button" className={`${styles.btnOutline} ${styles.bgWhiteBtn}`}>
              White
            </button>
          </div>
        </div>
      </aside>

      {/* Bottom bar */}
      <div className={styles.bottom}>
        <button type="button" className={styles.downloadBtn} onClick={() => onToast('Downloading mockup…')}>
          <span className="material-symbols-outlined">download</span>
          Download mockup
        </button>
        <div className={styles.spacer} />
        <button type="button" className={styles.saveBtn} onClick={() => onToast('Draft saved.')}>
          Save product
        </button>
        <button
          type="button"
          className={styles.publishBtn}
          onClick={() => setPublishConfirmOpen(true)}
          disabled={!product}
        >
          <span className="material-symbols-outlined">publish</span>
          Publish
        </button>
      </div>

      {/* ── Variant modal ── */}
      {variantModalOpen && (
        <div className={styles.overlay} onClick={() => setVariantModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Select variants</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setVariantModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.varTabs}>
                <button
                  type="button"
                  className={`${styles.varTab} ${variantTab === 'color' ? styles.active : ''}`}
                  onClick={() => setVariantTab('color')}
                >
                  Color
                </button>
                <button
                  type="button"
                  className={`${styles.varTab} ${variantTab === 'size' ? styles.active : ''}`}
                  onClick={() => setVariantTab('size')}
                >
                  Size
                </button>
              </div>
              <p className={`${styles.muted} ${styles.variantHint}`}>
                Optimal listings have between 5-15 variants
              </p>
              <div className={styles.selectAllRow}>
                <input
                  type="checkbox"
                  checked={selectedVariants.size === VARIANT_COLORS.length}
                  onChange={(e) =>
                    setSelectedVariants(e.target.checked ? new Set(VARIANT_COLORS.map((c) => c.name)) : new Set())
                  }
                />
                <label>Select all (max 100)</label>
                <span className={styles.muted}>{selectedVariants.size} variants selected</span>
              </div>
              {VARIANT_COLORS.map((c) => (
                <label key={c.name} className={styles.varRow}>
                  <input
                    type="checkbox"
                    checked={selectedVariants.has(c.name)}
                    onChange={() => toggleVariant(c.name)}
                  />
                  <div className={styles.varSwatch} style={{ background: c.hex }} />
                  <div className={styles.varName}>{c.name}</div>
                  <span className={`material-symbols-outlined ${styles.varChevron}`}>
                    expand_more
                  </span>
                </label>
              ))}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnOutline} onClick={() => setVariantModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btnOutline} ${styles.btnApply}`}
                onClick={() => {
                  setVariantModalOpen(false);
                  onToast(`${selectedVariants.size} variants applied.`);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Info modal ── */}
      {infoModalOpen && product && (
        <div className={styles.overlay} onClick={() => setInfoModalOpen(false)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Important product information</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setInfoModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.infoHero}>
                <img src={product.img} alt={product.name} />
                <div className={styles.infoHeroInfo}>
                  <b>{product.name}</b>
                  <span className={styles.muted}>{product.brand}</span>
                  <span className={styles.muted}>
                    Fulfilled by {quote?.printer.name ?? blankDetail?.supplier ?? '—'}
                  </span>
                  <span className={styles.muted}>
                    Estimated delivery:{' '}
                    {quote?.estimatedDelivery
                      ? `≈${quote.estimatedDelivery.average} ${quote.estimatedDelivery.unit.replace(/_/g, ' ')}`
                      : '—'}
                  </span>
                  <button
                    type="button"
                    className={`${styles.btnOutline} ${styles.seeDetailsBtn}`}
                  >
                    See details
                  </button>
                </div>
              </div>

              <button type="button" className={`${styles.btnOutline} ${styles.btnFull}`}>
                <span className="material-symbols-outlined">download</span>
                Download design template
              </button>

              {/* Production cost accordion — real numbers from the quote. */}
              <div className={`${styles.accItem} ${openAcc.cost ? styles.open : ''}`}>
                <button type="button" className={styles.accHead} onClick={() => toggleAcc('cost')}>
                  Base price: USD {quote ? quote.cost.toFixed(2) : '—'}
                  <span className={`material-symbols-outlined ${styles.chev}`}>expand_more</span>
                </button>
                <div className={styles.accBody}>
                  <div className={styles.kv}>
                    <span className={styles.key}>Printer</span>
                    <span>{quote?.printer.name ?? blankDetail?.supplier ?? '—'}</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.key}>Estimated delivery</span>
                    <span>
                      {quote?.estimatedDelivery
                        ? `≈${quote.estimatedDelivery.average} ${quote.estimatedDelivery.unit.replace(/_/g, ' ')}`
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.key}>Suggested retail</span>
                    <span>
                      {quote ? `USD ${quote.suggestedRetailPrice.toFixed(2)} (suggestion — you set the price)` : '—'}
                    </span>
                  </div>
                  <div className={`${styles.kv} ${styles.kvSubtotal}`}>
                    <b>Base price</b>
                    <b>USD {quote ? quote.cost.toFixed(2) : '—'}</b>
                  </div>
                </div>
              </div>

              {/* Print area accordion — real print areas from the provider. */}
              <div className={`${styles.accItem} ${openAcc.printArea ? styles.open : ''}`}>
                <button type="button" className={styles.accHead} onClick={() => toggleAcc('printArea')}>
                  Print area size:{' '}
                  {blankDetail?.printAreas[0]
                    ? `${blankDetail.printAreas[0].widthPx} × ${blankDetail.printAreas[0].heightPx} px`
                    : '—'}
                  <span className={`material-symbols-outlined ${styles.chev}`}>expand_more</span>
                </button>
                <div className={styles.accBody}>
                  <div className={styles.kv}>
                    <span className={styles.key}>DPI</span>
                    <span>300</span>
                  </div>
                  <div className={styles.kv}>
                    <span className={styles.key}>Product size</span>
                    <span>L</span>
                  </div>
                </div>
              </div>

              {/* Guidelines */}
              <div className={`${styles.accItem} ${openAcc.guidelines ? styles.open : ''}`}>
                <button type="button" className={styles.accHead} onClick={() => toggleAcc('guidelines')}>
                  <span className={styles.accHeadLabel}>
                    <span className="material-symbols-outlined">info</span>
                    Product and design guidelines
                  </span>
                  <span className={`material-symbols-outlined ${styles.chev}`}>expand_more</span>
                </button>
                <div className={styles.guidelines}>
                  <p>
                    <b>Semi-transparencies and gradients may not print as shown</b>
                  </p>
                  <p>
                    Please note: DTF prints have a white underbase and cannot offer full transparency.
                  </p>
                  <p>
                    <b>Design limitations (Single-color prints)</b>
                  </p>
                  <p>The process used for creating single-color print products will impact the final look.</p>
                  <p>
                    <b>Your design should NOT contain:</b>
                  </p>
                  <ul>
                    <li>Photos</li>
                    <li>Gradients</li>
                    <li>Small details (&lt; 0.05&quot;)</li>
                    <li>Small text (&lt; 0.25&quot;)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Design scaling modal ── */}
      {scalingModalOpen && (
        <div className={styles.overlay} onClick={() => setScalingModalOpen(false)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Design scaling</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setScalingModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.muted}>
                Our Product Creator shows the L apparel size and allows you to place the design on that
                size only. While we scale down the design automatically for smaller apparel sizes, as
                shown in the image below, it will not be scaled up for sizes larger than L.
              </p>
              <div className={styles.scalingDiagram}>
                {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                  <div key={sz} className={styles.scalingItem}>
                    <svg viewBox="0 0 100 100">
                      <path
                        d="M20 10 L10 30 L10 90 L90 90 L90 30 L80 10 Z"
                        fill="var(--d-bg)"
                        stroke="var(--d-line)"
                      />
                      <rect x="25" y="30" width="50" height="50" fill="var(--d-ink)" />
                    </svg>
                    {sz}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Publish confirmation ── */}
      {publishConfirmOpen && (
        <div className={styles.overlay} onClick={() => setPublishConfirmOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalBody}>
              <div className={styles.publishConfirm}>
                <span className="material-symbols-outlined">check_circle</span>
                <h2>Publish to Global Catalog?</h2>
                <p>
                  This will make <b>{product?.name}</b> live in the global Catalog domain (Published
                  Items &amp; SKUs) on the icon rail. Customers will be able to purchase it across all
                  connected channels.
                </p>
                {quote ? (
                  <>
                    <div className={styles.kv}>
                      <span className={styles.key}>Base price</span>
                      <span>USD {quote.cost.toFixed(2)}</span>
                    </div>
                    <div className={styles.kv}>
                      <span className={styles.key}>Printer</span>
                      <span>{quote.printer.name}</span>
                    </div>
                    <div className={styles.kv}>
                      <span className={styles.key}>Estimated delivery</span>
                      <span>
                        {quote.estimatedDelivery
                          ? `≈${quote.estimatedDelivery.average} ${quote.estimatedDelivery.unit.replace(/_/g, ' ')}`
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.kv}>
                      <span className={styles.key}>Suggested retail</span>
                      <span>USD {quote.suggestedRetailPrice.toFixed(2)}</span>
                    </div>
                    <label className={styles.kv}>
                      <span className={styles.key}>Your price (USD)</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={userPrice}
                        onChange={(e) => setUserPrice(e.target.value)}
                        aria-label="Your price in USD"
                      />
                    </label>
                    <p className={styles.muted}>
                      You set the price — the suggestion above is not the price.
                    </p>
                  </>
                ) : (
                  <p className={styles.muted}>
                    {designId
                      ? (quoteError ?? 'Loading the base price…')
                      : 'No design draft yet — start designing from the product page first.'}
                  </p>
                )}
                {publishError && <p className={styles.muted}>{publishError}</p>}
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={() => void handlePublish()}
                  disabled={!quote || publishing}
                >
                  {publishing ? 'Publishing…' : 'Publish now'}
                </button>
                <button
                  type="button"
                  className={`${styles.btnOutline} ${styles.confirmCancelBtn}`}
                  onClick={() => setPublishConfirmOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
