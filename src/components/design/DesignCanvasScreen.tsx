'use client';

/**
 * Design Studio — New design canvas screen.
 *
 * Spec source: upload/canvas.html (Unsaid Studio — Supplier Variant Inspector).
 *
 * Layout (inside the existing workspace content area):
 *   ┌──────────────────────────────┬──────────────────┐
 *   │  Canvas viewport              │  Right rail      │
 *   │  (dotted bg, product mockup)  │  (supplier       │
 *   │                               │   inspector)      │
 *   │  [toolbar: Edit/Preview]     │                   │
 *   ├───────────────────────────────┤                   │
 *   │  Zoom · label · Save/Publish  │                   │
 *   └──────────────────────────────┴──────────────────┘
 *
 * The right rail swaps content based on:
 *   - which sidebar tool is active (Upload/AI/Add text/…),
 *   - whether a product is loaded + the Edit/Preview mode,
 *   - catalog "Design" actions (loads blank → product info rail).
 *
 * Drag-and-drop: blanks from the upload rail can be dragged onto the
 * canvas viewport to load them.
 */
import { useState, type DragEvent } from 'react';
import {
  BLANKS,
  SUPPLIER_COLORS,
  SUPPLIER_SIZES,
  SUPPLIER_MODELS,
  useDesignCanvas,
  type BlankColor,
  type RailKind,
} from '@/lib/designCanvasStore';
import styles from './DesignCanvas.module.css';

interface DesignCanvasScreenProps {
  onToast: (msg: string) => void;
}

// ── Static rail content data (1:1 with canvas.html) ──
const AI_STYLES = [
  { name: 'None', icon: 'block' },
  { name: 'Anime', icon: 'face' },
  { name: 'Photographic', icon: 'photo_camera' },
  { name: 'Digital Art', icon: 'palette' },
  { name: 'Comic Book', icon: 'auto_stories' },
  { name: 'Fantasy Art', icon: 'auto_awesome' },
  { name: 'Line Art', icon: 'gesture' },
  { name: 'Analog Film', icon: 'camera_roll' },
  { name: 'Isometric', icon: 'view_in_ar' },
];

const GRAPHIC_CATEGORIES: { name: string; items: string[]; shape?: boolean }[] = [
  {
    name: 'Shapes',
    items: ['star', 'favorite', 'remove', 'change_history', 'circle', 'square'],
    shape: true,
  },
  {
    name: 'Curved Text',
    items: ['art lover boutique', 'NEW DAY', 'WHOLENESS', 'SWEET DREAMS', 'SURFING THE WAVE', 'Progress'],
  },
  {
    name: 'Text elements',
    items: ['HAPPY', 'BRIDE', "I'M WITH", 'I love you', 'eyes', 'thank you'],
  },
  { name: 'Americana', items: ['🇺🇸', '🔥', '🍔', '🍻', '⭐', '🗽'] },
  { name: 'Eco-friendly', items: ['🌍', '🌿', '🌻', '🍃', '♻️', '🌱'] },
  { name: 'Love', items: ['❤️', '💖', '💘', '💝', '💕', '💌'] },
];

const FONT_LIST = [
  { name: 'ABeeZee', style: {} },
  { name: 'Abel', style: {} },
  { name: 'Abhaya Libre', style: { fontFamily: 'monospace' } },
  { name: 'ABORETO', style: { fontWeight: 700 } },
  { name: 'Abril Fatface', style: { fontFamily: 'cursive' } },
  { name: 'Acme', style: { fontFamily: 'fantasy' } },
];

const WIZARD_PRODUCTS = [
  { name: 'Heavyweight Tee', meta: 'Sold: 412 units', blankKey: 'tee' },
  { name: 'Pullover Hoodie', meta: 'Sold: 268 units', blankKey: 'hoodie' },
];

const ORDERS = [
  { id: '#D-2041', kind: 'Sample', status: 'In production', tone: 'w' as const },
  { id: '#D-2037', kind: 'Bulk', status: 'Shipped', tone: 'a' as const },
  { id: '#D-2030', kind: 'Sample', status: 'Delivered', tone: 'o' as const },
];

const CHANNELS = [
  { name: 'Storefront (unsaidmemories.com)', sub: 'Your primary Shopify store.', connected: true },
  { name: 'TikTok Shop', sub: 'Connect to sell directly in the app.', connected: false },
  { name: 'Etsy', sub: 'List as a digital or physical product.', connected: false },
];

// ── Helpers ──
function railTitle(kind: RailKind, product: unknown, catalogLabel: string): string {
  if (product && kind === 'product info') return 'Product Info & Variants';
  if (product && kind === 'mockup view') return 'Mockup View';
  switch (kind) {
    case 'upload':
      return 'Upload';
    case 'ai':
      return 'AI';
    case 'add text':
      return 'Add text';
    case 'my library':
      return 'My library';
    case 'graphics':
      return 'Graphics';
    case 'my templates':
      return 'My templates';
    case 'images':
      return 'Images';
    case 'catalog':
      return `${catalogLabel} Catalog`;
    case 'create order':
      return 'Create Order';
    case 'my stores':
      return 'My Stores';
    case 'orders':
      return 'My Orders';
    case 'wizard':
      return `${catalogLabel} Wizard`;
    default:
      return 'Inspector';
  }
}

// ── Sub-views ──
function UploadRail({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      <div
        className={styles.uploadZone}
        onClick={() => onToast('File picker would open.')}
      >
        <span className="material-symbols-outlined">cloud_upload</span>
        <b>Upload Design</b>
        <p style={{ fontSize: 11, margin: '4px 0 0' }}>PNG, JPG, SVG up to 100MB</p>
      </div>
      <p style={{ fontSize: 12, color: 'var(--d-mut)', margin: '8px 0' }}>
        Or drag a blank from the catalog below.
      </p>
      <div className={styles.libGrid}>
        {Object.values(BLANKS).map((b) => (
          <DraggableBlank key={b.key} blankKey={b.key} name={b.name} />
        ))}
      </div>
    </>
  );
}

function DraggableBlank({ blankKey, name }: { blankKey: string; name: string }) {
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('blank-type', blankKey);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <div
      className={styles.libItem}
      draggable
      onDragStart={handleDragStart}
      onClick={() => loadBlank(blankKey)}
    >
      <span className="material-symbols-outlined">checkroom</span>
      <span className={styles.libName}>{name}</span>
    </div>
  );
}

function AIRail({ onToast }: { onToast: (m: string) => void }) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  return (
    <>
      <div className={styles.aiHeader}>
        <span style={{ fontSize: 12, color: 'var(--d-mut)' }}>15/15 daily attempts</span>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          onClick={() => onToast('Example prompt loaded.')}
        >
          Try another
        </button>
      </div>
      <div className={styles.aiPreview}>
        <span className="material-symbols-outlined">image</span>
      </div>
      <textarea
        className={styles.aiPrompt}
        placeholder="Christian Faith Graphics. Christian faith apparel graphics with typography-led layouts..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <span className={styles.counter}>{prompt.length}/1000</span>
      <h4 style={{ margin: '8px 0 4px', fontSize: 12 }}>Style</h4>
      <div className={styles.aiStyleGrid}>
        {AI_STYLES.map((s) => (
          <div
            key={s.name}
            className={`${styles.aiStyleItem} ${
              selectedStyle === s.name ? styles.sel : ''
            }`}
            onClick={() => setSelectedStyle(s.name)}
          >
            <div className={styles.aiStyleIcon}>
              <span className="material-symbols-outlined">{s.icon}</span>
            </div>
            <span className={styles.aiStyleName}>{s.name}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
        style={{ marginTop: 12 }}
        onClick={() => onToast('Generating image...')}
      >
        Generate image
      </button>
    </>
  );
}

function TextRail({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      <input className={styles.fontInput} placeholder="Search fonts..." />
      <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>Curved Text</h4>
      <div className={styles.graphicsGrid}>
        {['art lover boutique', 'NEW DAY', 'WHOLENESS'].map((t) => (
          <div
            key={t}
            className={styles.graphicItem}
            onClick={() => onToast(`Added curved text: ${t}`)}
            style={{ fontSize: 10 }}
          >
            {t}
          </div>
        ))}
      </div>
      <h4 style={{ margin: '16px 0 8px', fontSize: 12 }}>My fonts</h4>
      <button type="button" className={`${styles.btn} ${styles.btnFull}`} style={{ marginBottom: 12 }}>
        <span className="material-symbols-outlined">upload</span> Upload font
      </button>
      <h4 style={{ margin: '16px 0 8px', fontSize: 12 }}>Discover fonts</h4>
      <div className={styles.fontTags}>
        {['Display', 'Handwriting', 'Monospace'].map((t) => (
          <span key={t} className={styles.tag}>
            {t}
          </span>
        ))}
      </div>
      <div>
        {FONT_LIST.map((f) => (
          <div
            key={f.name}
            className={styles.fontRow}
            style={f.style}
            onClick={() => onToast(`Font: ${f.name}`)}
          >
            {f.name}
          </div>
        ))}
      </div>
    </>
  );
}

function GraphicsRail({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      {GRAPHIC_CATEGORIES.map((cat) => (
        <div key={cat.name}>
          <h4 style={{ margin: '0 0 8px', fontSize: 12 }}>{cat.name}</h4>
          <div className={styles.graphicsGrid}>
            {cat.items.map((g) => (
              <div
                key={g}
                className={styles.graphicItem}
                onClick={() => onToast(`Added: ${g}`)}
              >
                {cat.shape ? <span className="material-symbols-outlined">{g}</span> : g}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyRail({ kind }: { kind: 'my library' | 'my templates' | 'images' }) {
  const label = kind === 'my library' ? 'design files' : kind === 'my templates' ? 'templates' : 'images';
  return (
    <div className={styles.railEmpty}>
      <span className="material-symbols-outlined">folder_open</span>
      <h3>Nothing here yet</h3>
      <p>Your {label} will appear here once added.</p>
    </div>
  );
}

function CatalogRail({ label }: { label: string }) {
  return (
    <>
      <div className={styles.heroCard}>
        <h2>{label}&apos;s Clothing</h2>
        <p className={styles.sub}>Browse blanks for {label.toLowerCase()}.</p>
      </div>
      <div style={{ borderTop: '1px solid var(--d-line)', paddingTop: 16 }}>
        <h4 style={{ margin: '0 0 8px' }}>Available Blanks</h4>
        <div className={styles.libGrid}>
          {Object.values(BLANKS).map((b) => (
            <DraggableBlank key={b.key} blankKey={b.key} name={b.name} />
          ))}
        </div>
      </div>
    </>
  );
}

function ProductInfoRail() {
  const product = useDesignCanvas((s) => s.product);
  const color = useDesignCanvas((s) => s.color);
  const sizes = useDesignCanvas((s) => s.sizes);
  const selectColor = useDesignCanvas((s) => s.selectColor);
  const toggleSize = useDesignCanvas((s) => s.toggleSize);
  const setVariantsOpen = useDesignCanvas((s) => s.setVariantsOpen);
  const [openAcc, setOpenAcc] = useState<Record<string, boolean>>({
    cost: true,
    printArea: false,
    guidelines: true,
  });

  if (!product) return null;
  const toggleAcc = (k: string) => setOpenAcc((p) => ({ ...p, [k]: !p[k] }));

  return (
    <>
      <div className={styles.productHero}>
        <img src={product.img} alt="mockup" />
        <div className={styles.productInfo}>
          <b>{product.name}</b>
          <span className={styles.muted}>{product.brand}</span>
          <span className={styles.stock}>In Stock</span>
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} style={{ marginTop: 6 }}>
            See details
          </button>
        </div>
      </div>
      <button type="button" className={`${styles.btn} ${styles.btnFull}`}>
        <span className="material-symbols-outlined">download</span> Download template
      </button>

      {/* Production cost accordion */}
      <div className={`${styles.accItem} ${openAcc.cost ? styles.open : ''}`}>
        <button type="button" className={styles.accHead} onClick={() => toggleAcc('cost')}>
          Production cost
          <span className={`material-symbols-outlined ${styles.accChev}`}>expand_more</span>
        </button>
        <div className={styles.accBody}>
          <div className={styles.kv}>
            <span className={styles.key}>Blank product</span>
            <span>USD 11.48–19.13</span>
          </div>
          <div className={styles.kv}>
            <span className={styles.key}>Print front side</span>
            <span>USD 6.38–6.19</span>
          </div>
          <div className={styles.kv}>
            <b>Subtotal</b>
            <b>USD {product.price.toFixed(2)}–25.32</b>
          </div>
        </div>
      </div>

      {/* Print area accordion */}
      <div className={`${styles.accItem} ${openAcc.printArea ? styles.open : ''}`}>
        <button type="button" className={styles.accHead} onClick={() => toggleAcc('printArea')}>
          Print area size
          <span className={`material-symbols-outlined ${styles.accChev}`}>expand_more</span>
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
          <div className={styles.kv}>
            <span className={styles.key}>Print area</span>
            <span>3852 × 4398 px</span>
          </div>
        </div>
      </div>

      {/* Variants */}
      <div style={{ marginTop: 8 }}>
        <h3 className={styles.sectionLabel}>Variants</h3>
        <div className={styles.variantCard}>
          <div>
            <div className={styles.variantCount}>{sizes.length} sizes</div>
            <div className={styles.variantColor}>Color: {color.name}</div>
          </div>
          <button type="button" className={styles.btn} onClick={() => setVariantsOpen(true)}>
            Select
          </button>
        </div>
      </div>

      {/* Inline variant editor */}
      <div>
        <h3 className={styles.sectionLabel}>Color</h3>
        <div className={styles.colorGrid}>
          {SUPPLIER_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`${styles.colorBtn} ${c.name === color.name ? styles.active : ''}`}
              onClick={() => selectColor(c)}
              title={c.name}
            >
              <div className={styles.swatch} style={{ background: c.hex }} />
              <span className={styles.colorName}>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className={styles.sectionLabel}>Sizes</h3>
        <div className={styles.sizesRow}>
          {SUPPLIER_SIZES.map((s) => (
            <span
              key={s}
              className={`${styles.tag} ${sizes.includes(s) ? styles.on : ''}`}
              onClick={() => toggleSize(s)}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Guidelines accordion */}
      <div className={`${styles.accItem} ${openAcc.guidelines ? styles.open : ''}`}>
        <button type="button" className={styles.accHead} onClick={() => toggleAcc('guidelines')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>
              info
            </span>
            Design guidelines
          </span>
          <span className={`material-symbols-outlined ${styles.accChev}`}>expand_more</span>
        </button>
        <div className={styles.guidelines}>
          <p>
            <b>Semi-transparencies and gradients may not print as shown</b>
          </p>
          <p>
            Please note: DTF prints have a white underbase and cannot offer full transparency. When
            gradients and semi-transparencies are used in a design, the printed outcome will differ
            from what is seen in the mockups.
          </p>
          <p>
            <b>Design limitations (Single-color prints)</b>
          </p>
          <p>
            The process used for creating single-color print products will impact the final look of
            colors and designs. Before creating this product, please review the guide here.
          </p>
        </div>
      </div>
    </>
  );
}

function MockupViewRail() {
  const product = useDesignCanvas((s) => s.product);
  const color = useDesignCanvas((s) => s.color);
  const selectColor = useDesignCanvas((s) => s.selectColor);
  const [colorMode, setColorMode] = useState<'cmyk' | 'rgb'>('rgb');
  if (!product) return null;
  return (
    <>
      <div className={styles.modelThumbs}>
        {SUPPLIER_MODELS.map((m, i) => (
          <div key={m} className={`${styles.modelThumb} ${i === 0 ? styles.active : ''}`}>
            <img src={product.img} alt={m} />
          </div>
        ))}
      </div>
      <button type="button" className={`${styles.btn} ${styles.btnFull}`} style={{ marginTop: 8 }}>
        Show more
      </button>
      <div className={styles.kv}>
        <span className={styles.key}>Preview product size</span>
        <span>L</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>Mockup color mode</div>
      <label className={styles.radioRow}>
        <input
          type="radio"
          name="cm"
          checked={colorMode === 'cmyk'}
          onChange={() => setColorMode('cmyk')}
        />
        Realistic (CMYK)
      </label>
      <label className={styles.radioRow}>
        <input
          type="radio"
          name="cm"
          checked={colorMode === 'rgb'}
          onChange={() => setColorMode('rgb')}
        />
        Bright (RGB)
      </label>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>Colors</div>
      <div className={styles.dots}>
        {SUPPLIER_COLORS.map((c: BlankColor) => (
          <div
            key={c.name}
            className={styles.dot}
            style={{
              background: c.hex,
              outline: c.name === color.name ? '2px solid var(--d-pri)' : 'none',
              outlineOffset: 1,
            }}
            title={c.name}
            onClick={() => selectColor(c)}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>Mockup background</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={styles.btn} style={{ flex: 1 }}>
          <span className="material-symbols-outlined">add_photo_alternate</span> Add image
        </button>
        <button type="button" className={styles.btn} style={{ flex: 1 }}>
          White
        </button>
      </div>
    </>
  );
}

function CreateOrderRail({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      <div className={styles.heroCard}>
        <h3 style={{ margin: '0 0 8px' }}>Order Samples</h3>
        <p className={styles.sub}>Order a sample of your design to check quality.</p>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Select Product</label>
        <select className={styles.fieldSelect}>
          <option>Unisex Heavy Blend Crewneck</option>
          <option>Pullover Hoodie</option>
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Quantity</label>
        <input type="number" defaultValue={1} min={1} className={styles.fieldInput} />
      </div>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
        onClick={() => onToast('Order placed for sample.')}
      >
        Place Order
      </button>
    </>
  );
}

function MyStoresRail({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--d-mut)' }}>Connect your stores to sync products.</p>
      <div className={styles.storeRow}>
        <div>
          <b>Storefront</b>
          <div className={`${styles.storeStatus} ${styles.on}`}>Connected</div>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          onClick={() => onToast('Opening store settings.')}
        >
          Manage
        </button>
      </div>
      <div className={styles.storeRow}>
        <div>
          <b>TikTok Shop</b>
          <div className={`${styles.storeStatus} ${styles.off}`}>Not connected</div>
        </div>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          onClick={() => onToast('Opening connection flow.')}
        >
          Connect
        </button>
      </div>
    </>
  );
}

function OrdersRail() {
  return (
    <>
      <div className={styles.heroCard}>
        <h3 style={{ margin: '0 0 8px' }}>Order History</h3>
        <p className={styles.sub}>Track your samples and bulk orders.</p>
      </div>
      {ORDERS.map((o) => (
        <div key={o.id} className={styles.orderRow}>
          <span>
            <b>{o.id}</b> - {o.kind}
          </span>
          <span className={`${styles.tag} ${styles.on}`}>{o.status}</span>
        </div>
      ))}
    </>
  );
}

function WizardRail({ label, onToast }: { label: string; onToast: (m: string) => void }) {
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const closeRail = useDesignCanvas((s) => s.closeRail);
  return (
    <>
      <div className={styles.heroCard}>
        <h3 style={{ margin: '0 0 8px' }}>Start with {label}</h3>
        <p className={styles.sub}>Pick a winning product to design.</p>
      </div>
      {WIZARD_PRODUCTS.map((p) => (
        <div key={p.name} className={styles.wizRow}>
          <div>
            <div className={styles.wizName}>{p.name}</div>
            <div className={styles.wizMeta}>{p.meta}</div>
          </div>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
            onClick={() => {
              loadBlank(p.blankKey);
              closeRail();
              onToast(`Product loaded from ${label} wizard.`);
            }}
          >
            Design
          </button>
        </div>
      ))}
    </>
  );
}

// ── Modals ──
function VariantsModal() {
  const open = useDesignCanvas((s) => s.variantsOpen);
  const setOpen = useDesignCanvas((s) => s.setVariantsOpen);
  const color = useDesignCanvas((s) => s.color);
  const selectColor = useDesignCanvas((s) => s.selectColor);
  if (!open) return null;
  return (
    <div className={`${styles.overlay} ${styles.on}`} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Select variants</h2>
          <button type="button" className={styles.btnIco} onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.modalBody}>
          {SUPPLIER_COLORS.map((c) => (
            <label key={c.name} className={styles.varRow}>
              <input
                type="checkbox"
                checked={c.name === color.name}
                onChange={() => selectColor(c)}
              />
              <div className={styles.swatch} style={{ background: c.hex }} />
              <div style={{ flex: 1 }}>
                <div className={styles.varName}>{c.name}</div>
                <div className={styles.varSku}>{c.sku}</div>
              </div>
              <span className="material-symbols-outlined" style={{ color: 'var(--d-mut)' }}>
                expand_more
              </span>
            </label>
          ))}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btn} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setOpen(false)}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function PublishModal({ onToast }: { onToast: (m: string) => void }) {
  const open = useDesignCanvas((s) => s.publishOpen);
  const setOpen = useDesignCanvas((s) => s.setPublishOpen);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    Storefront: true,
    'TikTok Shop': false,
    Etsy: false,
  });
  if (!open) return null;
  return (
    <div className={`${styles.overlay} ${styles.on}`} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Publish Product</h2>
          <button type="button" className={styles.btnIco} onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.sub}>Select the sales channels where you want this product to appear.</p>
          {CHANNELS.map((ch) => (
            <label key={ch.name} className={styles.channelRow}>
              <input
                type="checkbox"
                checked={!!checked[ch.name]}
                onChange={() => setChecked((p) => ({ ...p, [ch.name]: !p[ch.name] }))}
              />
              <div className={styles.channelInfo}>
                <b>{ch.name}</b>
                <div className={styles.sub}>{ch.sub}</div>
              </div>
            </label>
          ))}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btn} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => {
              setOpen(false);
              onToast('Product published to Storefront!');
            }}
          >
            Publish Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main screen ──
export default function DesignCanvasScreen({ onToast }: DesignCanvasScreenProps) {
  const product = useDesignCanvas((s) => s.product);
  const mode = useDesignCanvas((s) => s.mode);
  const railKind = useDesignCanvas((s) => s.railKind);
  const railOpen = useDesignCanvas((s) => s.railOpen);
  const catalogLabel = useDesignCanvas((s) => s.catalogLabel);
  const setMode = useDesignCanvas((s) => s.setMode);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const setRailKind = useDesignCanvas((s) => s.setRailKind);
  const closeRail = useDesignCanvas((s) => s.closeRail);

  const [dragover, setDragover] = useState(false);
  const [zoom, setZoom] = useState(100);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
    const type = e.dataTransfer.getData('blank-type');
    if (type && BLANKS[type]) {
      loadBlank(type);
      onToast(`${BLANKS[type].name} loaded.`);
    }
  };

  const renderRailBody = () => {
    // Loaded-product states take priority.
    if (product && mode === 'edit' && (railKind === 'product info' || railKind === 'mockup view')) {
      return <ProductInfoRail />;
    }
    if (product && mode === 'preview' && (railKind === 'product info' || railKind === 'mockup view')) {
      return <MockupViewRail />;
    }
    switch (railKind) {
      case 'upload':
        return <UploadRail onToast={onToast} />;
      case 'ai':
        return <AIRail onToast={onToast} />;
      case 'add text':
        return <TextRail onToast={onToast} />;
      case 'graphics':
        return <GraphicsRail onToast={onToast} />;
      case 'my library':
      case 'my templates':
      case 'images':
        return <EmptyRail kind={railKind} />;
      case 'catalog':
        return <CatalogRail label={catalogLabel} />;
      case 'create order':
        return <CreateOrderRail onToast={onToast} />;
      case 'my stores':
        return <MyStoresRail onToast={onToast} />;
      case 'orders':
        return <OrdersRail />;
      case 'wizard':
        return <WizardRail label={catalogLabel} onToast={onToast} />;
      default:
        return <UploadRail onToast={onToast} />;
    }
  };

  const title = railTitle(railKind, product, catalogLabel);

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        {/* Canvas viewport */}
        <div
          className={`${styles.viewport} ${dragover ? styles.dragover : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
        >
          <div className={styles.dropZone} />
          {!product ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined">upload_file</span>
              <h3>Canvas is empty</h3>
              <p>Select a tool from the sidebar or drag a blank to begin.</p>
            </div>
          ) : (
            <img src={product.img} className={styles.item} alt="Design Mockup" />
          )}
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnIco} title="Undo" onClick={() => onToast('Undo')}>
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button type="button" className={styles.btnIco} title="Redo" onClick={() => onToast('Redo')}>
            <span className="material-symbols-outlined">redo</span>
          </button>
          <div className={styles.div} />
          <div className={styles.seg}>
            <button
              type="button"
              className={`${styles.segBtn} ${mode === 'edit' ? styles.on : ''}`}
              onClick={() => setMode('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${mode === 'preview' ? styles.on : ''}`}
              onClick={() => setMode('preview')}
            >
              Preview
            </button>
          </div>
          <div className={styles.div} />
          <button
            type="button"
            className={styles.btnIco}
            title="Toggle inspector"
            onClick={() => useDesignCanvas.getState().toggleRail()}
          >
            <span className="material-symbols-outlined">
              {railOpen ? 'right_panel_close' : 'right_panel_open'}
            </span>
          </button>
          <button
            type="button"
            className={styles.btnIco}
            title="Help"
            onClick={() => onToast('Help — shortcuts: Ctrl+Shift+> next view, Ctrl+Shift+C center H')}
          >
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>

        {/* Bottom bar */}
        <div className={styles.bottom}>
          <div className={styles.zoom}>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoom((z) => Math.max(15, z - 5))}
            >
              −
            </button>
            <span className={styles.zoomVal}>{zoom}%</span>
            <button
              type="button"
              className={styles.zoomBtn}
              onClick={() => setZoom((z) => Math.min(200, z + 5))}
            >
              +
            </button>
          </div>
          <span className={styles.label}>{product ? product.name : 'No product selected'}</span>
          <div className={styles.spacer} />
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => onToast('Draft saved.')}
          >
            Save product
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={() => useDesignCanvas.getState().setPublishOpen(true)}
          >
            Publish
          </button>
        </div>
      </div>

      {/* Right rail */}
      <div className={`${styles.rail} ${railOpen ? '' : styles.closed}`}>
        <div className={styles.railHeader}>
          <h2 className={styles.railTitle}>{title}</h2>
          <button type="button" className={styles.btnIco} title="Close inspector" onClick={closeRail}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.railBody}>{renderRailBody()}</div>
      </div>

      {/* When rail is closed, show a reopen affordance by routing sidebar clicks
          (handled in GlobalShell) — but also expose a default upload rail if no
          product is loaded and the rail was explicitly closed. */}
      {!railOpen && !product && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSmall}`}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 31 }}
          onClick={() => setRailKind('upload')}
        >
          <span className="material-symbols-outlined">right_panel_open</span>
          Open inspector
        </button>
      )}

      <VariantsModal />
      <PublishModal onToast={onToast} />
    </div>
  );
}
