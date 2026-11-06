import styles from './StudioDrawer.module.css';
import {
  SUPPLIER_CATEGORY_DATA,
  useDesignCanvas,
} from '@/lib/designCanvasStore';

export type StudioDrawerKind =
  | 'Upload'
  | 'AI'
  | 'Add text'
  | 'My library'
  | 'Graphics'
  | 'My templates'
  | 'Images'
  | 'Supplier'
  | 'Queue';

interface StudioDrawerProps {
  open: boolean;
  kind: string;
  onClose: () => void;
  onToast: (message: string) => void;
}

const KIND_META: Record<string, { icon: string; subtitle: string; action: string }> = {
  Upload: { icon: 'cloud_upload', subtitle: 'Bring your own art into the studio', action: 'Browse files' },
  AI: { icon: 'auto_awesome', subtitle: 'Generate art from a prompt', action: 'Generate' },
  'Add text': { icon: 'text_fields', subtitle: 'Drop a text layer on the canvas', action: 'Add to canvas' },
  'My library': { icon: 'folder_special', subtitle: 'Your saved studio assets', action: 'Upload to library' },
  Graphics: { icon: 'interests', subtitle: 'Shapes, icons, and embellishments', action: 'Open in studio' },
  'My templates': { icon: 'view_quilt', subtitle: 'Reuse a design you already built', action: 'Use template' },
  Images: { icon: 'image', subtitle: 'Search and license imagery', action: 'Search' },
  Supplier: { icon: 'inventory_2', subtitle: 'Live API data — select a variant to begin designing', action: 'Design with this SKU' },
  Queue: { icon: 'playlist_add', subtitle: 'Products queued for batch design', action: 'Start designing' },
};

const TEXT_PRESETS = [
  { label: 'Add a heading', sample: 'Aa', size: 32 },
  { label: 'Add a subheading', sample: 'Aa', size: 22 },
  { label: 'Add a little bit of body text', sample: 'Aa', size: 15 },
];

const GRAPHIC_CATEGORIES = ['Shapes', 'Badges', 'Icons', 'Symbols', 'Labels', 'Borders'];
const IMAGE_FILTERS = ['Photos', 'Illustrations', 'Vectors', 'Textures'];
const LIBRARY_FOLDERS = ['Logos', 'Seasonal', 'Mockups', 'Exports'];

const TEMPLATES = [
  { name: 'Vintage Tee — Front', kind: 'T-shirt · 300 DPI', updated: '2 days ago' },
  { name: 'Holiday Crewneck', kind: 'Crewneck · 300 DPI', updated: '1 week ago' },
  { name: 'Mug Wrap — 11oz', kind: 'Mug · 1200×1500', updated: '2 weeks ago' },
  { name: 'Tote Base', kind: 'Tote · 300 DPI', updated: '1 month ago' },
];

const AI_STYLES = ['Illustration', 'Photo', 'Vector', 'Watercolor'];

export default function StudioDrawer({ open, kind, onClose, onToast }: StudioDrawerProps) {
  const meta = KIND_META[kind] || KIND_META.Upload;

  const handleAction = () => {
    onToast(`${meta.action} — ${kind}`);
  };

  return (
    <>
      <div
        id="studio-scrim"
        className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
        onClick={onClose}
      />
      <div
        id="studio-drawer"
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-label={`${kind} panel`}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={`material-symbols-outlined ${styles.icon20Primary}`}>{meta.icon}</span>
            <div>
              <div id="studio-drawer-title" className={styles.title}>
                {kind}
              </div>
              <div className={styles.subtitle}>{meta.subtitle}</div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button type="button" className={styles.iconBtn} title="Maximize">
              <span className={`material-symbols-outlined ${styles.icon18}`}>open_in_full</span>
            </button>
            <button
              id="studio-drawer-close"
              type="button"
              className={styles.iconBtn}
              title="Close"
              onClick={onClose}
            >
              <span className={`material-symbols-outlined ${styles.icon18}`}>close</span>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {kind === 'Upload' && (
            <>
              <button
                type="button"
                className={styles.dropzone}
                data-studio-dropzone
                onClick={handleAction}
              >
                <span className={`material-symbols-outlined ${styles.dropzoneIcon}`}>
                  cloud_upload
                </span>
                <span className={styles.dropzoneTitle}>Drag &amp; drop or browse</span>
                <span className={styles.dropzoneHint}>PNG, JPG, SVG, PDF — up to 25 MB</span>
              </button>
              <div className={styles.sectionHeading}>Recent uploads</div>
              <ul className={styles.listRows}>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-asset', 'brand-mark-v4.svg');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
                  <span className={styles.rowLabel}>brand-mark-v4.svg</span>
                  <span className={styles.rowMeta}>SVG · 18 KB</span>
                </li>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-asset', 'front-print.png');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
                  <span className={styles.rowLabel}>front-print.png</span>
                  <span className={styles.rowMeta}>PNG · 2.1 MB</span>
                </li>
              </ul>
            </>
          )}

          {kind === 'AI' && (
            <>
              <label className={styles.fieldLabel}>Describe the art you need</label>
              <textarea
                className={styles.promptArea}
                placeholder="e.g. retro mountain sunset with bold outline, 3-color screen print…"
              />
              <div className={styles.fieldLabel}>Style</div>
              <div className={styles.chipRow}>
                {AI_STYLES.map((s, i) => (
                  <span
                    key={s}
                    className={`${styles.chip} ${i === 0 ? styles.chipActive : ''}`}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <button type="button" className={styles.primaryBtn} data-ai-generate onClick={handleAction}>
                <span className={`material-symbols-outlined ${styles.icon16}`}>auto_awesome</span>
                Generate 4 variations
              </button>
              <div className={styles.sectionHeading}>Recent generations</div>
              <div className={styles.tileGrid}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={styles.tile}
                    data-ai-variation={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `ai-variation-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    style={{ cursor: 'grab' }}
                  />
                ))}
              </div>
            </>
          )}

          {kind === 'Add text' && (
            <>
              <div className={styles.sectionHeading}>Text presets</div>
              <div className={styles.textPresets}>
                {TEXT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={styles.textPresetBtn}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-text', p.label);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={handleAction}
                  >
                    <span className={styles.textPresetSample} style={{ fontSize: p.size }}>
                      {p.sample}
                    </span>
                    <span className={styles.textPresetLabel}>{p.label}</span>
                  </button>
                ))}
              </div>
              <div className={styles.sectionHeading}>Fonts</div>
              <ul className={styles.listRows}>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Anton');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={styles.fontSample}>Anton</span>
                  <span className={styles.rowMeta}>Display</span>
                </li>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Inter');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={styles.fontSample}>Inter</span>
                  <span className={styles.rowMeta}>Sans</span>
                </li>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Playfair Display');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={styles.fontSample}>Playfair Display</span>
                  <span className={styles.rowMeta}>Serif</span>
                </li>
                <li
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Bebas Neue');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={styles.fontSample}>Bebas Neue</span>
                  <span className={styles.rowMeta}>Condensed</span>
                </li>
              </ul>
            </>
          )}

          {kind === 'My library' && (
            <>
              <div className={styles.sectionHeading}>Folders</div>
              <div className={styles.chipRow}>
                {LIBRARY_FOLDERS.map((f, i) => (
                  <span key={f} className={`${styles.chip} ${i === 0 ? styles.chipActive : ''}`}>
                    {f}
                  </span>
                ))}
              </div>
              <div className={styles.tileGrid}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={styles.tile}
                    data-library-asset={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `library-asset-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    style={{ cursor: 'grab' }}
                  />
                ))}
              </div>
            </>
          )}

          {kind === 'Graphics' && (
            <>
              <div className={styles.searchRow}>
                <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Search graphics…"
                />
              </div>
              <div className={styles.chipRow}>
                {GRAPHIC_CATEGORIES.map((c, i) => (
                  <span key={c} className={`${styles.chip} ${i === 0 ? styles.chipActive : ''}`}>
                    {c}
                  </span>
                ))}
              </div>
              <div className={styles.tileGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className={styles.tile}
                    data-graphic-tile={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-graphic', `graphic-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    style={{ cursor: 'grab' }}
                  />
                ))}
              </div>
            </>
          )}

          {kind === 'My templates' && (
            <ul className={styles.listRows}>
              {TEMPLATES.map((t) => (
                <li
                  key={t.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-template', t.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <span className={`material-symbols-outlined ${styles.rowIcon}`}>view_quilt</span>
                  <span className={styles.rowLabel}>
                    {t.name}
                    <span className={styles.rowSub}>{t.kind}</span>
                  </span>
                  <span className={styles.rowMeta}>{t.updated}</span>
                </li>
              ))}
            </ul>
          )}

          {kind === 'Images' && (
            <>
              <div className={styles.searchRow}>
                <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
                <input
                  className={styles.searchInput}
                  type="text"
                  placeholder="Search images…"
                />
              </div>
              <div className={styles.chipRow}>
                {IMAGE_FILTERS.map((f, i) => (
                  <span key={f} className={`${styles.chip} ${i === 0 ? styles.chipActive : ''}`}>
                    {f}
                  </span>
                ))}
              </div>
              <div className={styles.tileGrid}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div
                    key={i}
                    className={styles.tile}
                    data-image-tile={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `image-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    style={{ cursor: 'grab' }}
                  />
                ))}
              </div>
            </>
          )}

          {kind === 'Supplier' && <SupplierInspector onToast={onToast} />}

          {kind === 'Queue' && <QueueInspector onToast={onToast} />}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Close
          </button>
          <button type="button" className={styles.primaryBtn} onClick={handleAction}>
            {meta.action}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Supplier inspector — shown when a top-bar category is clicked.
//    Displays the mock supplier API data: product name, supplier, SKU,
//    available colors (with SKU codes), sizes, and mockup models.
//    The "Design with this SKU" CTA (footer) loads the blank onto the canvas.
function SupplierInspector({ onToast }: { onToast: (msg: string) => void }) {
  const supplierCategory = useDesignCanvas((s) => s.supplierCategory);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const data = SUPPLIER_CATEGORY_DATA;

  if (!supplierCategory) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--d-mut)', padding: 24 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4 }}>
          inventory_2
        </span>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Select a category from the top bar to view supplier data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb header */}
      <div
        style={{
          background: 'var(--d-lo, #f4f3f7)',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: '#5f6b5a', marginBottom: 4 }}>
          {supplierCategory.category} / {supplierCategory.subcategory}
        </div>
        <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>
          {data.productName}
        </h2>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
          <span style={{ background: '#eeedf1', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#5f6b5a' }}>
            Supplier: {data.supplier}
          </span>
          <span style={{ background: '#eeedf1', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#5f6b5a' }}>
            SKU: {data.sku}
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#5f6b5a' }}>
          Live API data. Select a variant to begin designing.
        </p>
      </div>

      {/* Available Colors */}
      <h4 style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600 }}>
        Available Colors ({data.colors.length})
      </h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          marginTop: 8,
        }}
      >
        {data.colors.map((c, i) => (
          <button
            key={c.sku}
            type="button"
            onClick={() => onToast(`Selected SKU: ${c.sku}`)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: 6,
              border: i === 0 ? '2px solid #0a6400' : '1px solid #dad9dd',
              borderRadius: 6,
              background: i === 0 ? '#e8f5e9' : '#fff',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: c.hex,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 600 }}>{c.name}</span>
            <span style={{ fontSize: 8, color: '#5f6b5a' }}>{c.sku}</span>
          </button>
        ))}
      </div>

      {/* Available Sizes */}
      <h4 style={{ margin: '16px 0 4px', fontSize: 12, fontWeight: 600 }}>
        Available Sizes
      </h4>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.sizes.map((s) => (
          <span
            key={s}
            style={{
              padding: '4px 10px',
              border: '1px solid #dad9dd',
              borderRadius: 999,
              fontSize: 12,
              cursor: 'pointer',
              background: '#fff',
            }}
            onClick={() => onToast(`Size ${s} selected`)}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Available Models (Mockups) */}
      <h4 style={{ margin: '16px 0 4px', fontSize: 12, fontWeight: 600 }}>
        Available Models (Mockups)
      </h4>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {data.models.map((m, i) => (
          <div
            key={m}
            style={{
              width: 60,
              height: 60,
              flexShrink: 0,
              border: i === 0 ? '2px solid #0a6400' : '2px solid transparent',
              borderRadius: 6,
              background: '#f4f3f7',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => onToast(`Model: ${m}`)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#5f6b5a' }}>
              image
            </span>
          </div>
        ))}
      </div>

      {/* Design with this SKU + View product page link */}
      <button
        type="button"
        onClick={() => {
          loadBlank('tee');
          onToast(`${data.productName} loaded onto canvas.`);
        }}
        style={{
          width: '100%',
          marginTop: 16,
          padding: '10px 16px',
          background: '#0a6400',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Design with this SKU
      </button>
      <button
        type="button"
        onClick={() => onToast('Opening product page…')}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '8px 16px',
          background: 'transparent',
          color: '#0077c5',
          border: 0,
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 12,
          cursor: 'pointer',
          textDecoration: 'underline',
          textAlign: 'center',
        }}
      >
        View product page →
      </button>
    </>
  );
}

// ── Queue inspector — shown when the Design Queue button is clicked.
//    Lists all queued products with thumbnails. Clicking a product opens
//    the variant drawer (Supplier inspector) for that product.
function QueueInspector({ onToast }: { onToast: (msg: string) => void }) {
  const designQueue = useDesignCanvas((s) => s.designQueue);
  const removeFromQueue = useDesignCanvas((s) => s.removeFromQueue);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const setSupplierCategory = useDesignCanvas((s) => s.setSupplierCategory);

  if (designQueue.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#5f6b5a', padding: 24 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4 }}>
          playlist_add
        </span>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          No items in queue. Add products from the category dropdowns above.
        </p>
      </div>
    );
  }

  return (
    <>
      {designQueue.map((q) => (
        <div
          key={q.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            border: '1px solid #dad9dd',
            borderRadius: 8,
            background: '#fff',
            cursor: 'pointer',
          }}
          onClick={() => {
            // Clicking a queued product opens the variant drawer.
            // Set the supplier category, then switch the drawer kind.
            setSupplierCategory(q.name.split(' — ')[0] || 'Product', q.name);
            window.dispatchEvent(new CustomEvent('switch-studio-kind', { detail: 'Supplier' }));
            onToast(`Opening variant details for "${q.name}".`);
          }}
        >
          <img
            src={q.img}
            alt={q.name}
            style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', background: '#f4f3f7' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 12, display: 'block' }}>{q.name}</b>
            <span style={{ fontSize: 11, color: '#5f6b5a' }}>{q.brand} · ${q.price.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFromQueue(q.id);
              onToast(`Removed "${q.name}" from queue.`);
            }}
            style={{ border: 0, background: 'none', cursor: 'pointer', color: '#5f6b5a' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const first = designQueue[0];
          if (first) {
            loadBlank(first.blankKey);
            onToast(`Loaded "${first.name}" onto canvas. ${designQueue.length - 1} remaining.`);
          }
        }}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '10px 16px',
          background: '#0a6400',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Start designing ({designQueue.length})
      </button>
    </>
  );
}
