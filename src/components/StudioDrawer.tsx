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
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-asset', 'brand-mark-v4.svg');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
                >
                  <span className={`material-symbols-outlined ${styles.rowIcon}`}>image</span>
                  <span className={styles.rowLabel}>brand-mark-v4.svg</span>
                  <span className={styles.rowMeta}>SVG · 18 KB</span>
                </li>
                <li
                  draggable
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-asset', 'front-print.png');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
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
                    className={` `}
                    data-ai-variation={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `ai-variation-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    
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
                    className={` `}
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
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Anton');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
                >
                  <span className={styles.fontSample}>Anton</span>
                  <span className={styles.rowMeta}>Display</span>
                </li>
                <li
                  draggable
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Inter');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
                >
                  <span className={styles.fontSample}>Inter</span>
                  <span className={styles.rowMeta}>Sans</span>
                </li>
                <li
                  draggable
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Playfair Display');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
                >
                  <span className={styles.fontSample}>Playfair Display</span>
                  <span className={styles.rowMeta}>Serif</span>
                </li>
                <li
                  draggable
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-font', 'Bebas Neue');
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
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
                    className={` `}
                    data-library-asset={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `library-asset-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    
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
                    className={` `}
                    data-graphic-tile={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-graphic', `graphic-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    
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
                  className={styles.draggable}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('studio-template', t.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  
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
                    className={` `}
                    data-image-tile={i}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('studio-asset', `image-${i}`);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    
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
function SupplierInspector({ onToast }: { onToast: (msg: string) => void }) {
  const supplierCategory = useDesignCanvas((s) => s.supplierCategory);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const data = SUPPLIER_CATEGORY_DATA;

  if (!supplierCategory) {
    return (
      <div className={styles.supplierEmpty}>
        <span className={`material-symbols-outlined ${styles.supplierEmptyIcon}`}>
          inventory_2
        </span>
        <p className={styles.supplierEmptyText}>
          Select a category from the top bar to view supplier data.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Breadcrumb header */}
      <div className={styles.supplierHero}>
        <div className={styles.supplierBreadcrumb}>
          {supplierCategory.category} / {supplierCategory.subcategory}
        </div>
        <h2 className={styles.supplierProductName}>{data.productName}</h2>
        <div className={styles.supplierTags}>
          <span className={styles.supplierTag}>Supplier: {data.supplier}</span>
          <span className={styles.supplierTag}>SKU: {data.sku}</span>
        </div>
        <p className={styles.supplierHint}>
          Live API data. Select a variant to begin designing.
        </p>
      </div>

      {/* Available Colors */}
      <h4 className={styles.supplierSectionTitle}>
        Available Colors ({data.colors.length})
      </h4>
      <div className={styles.supplierColorGrid}>
        {data.colors.map((c, i) => (
          <button
            key={c.sku}
            type="button"
            className={`${styles.supplierColorBtn} ${i === 0 ? styles.supplierColorBtnActive : ''}`}
            onClick={() => {
              useDesignCanvas.getState().selectColor({ name: c.name, hex: c.hex, sku: c.sku });
              onToast(`Selected color: ${c.name} (${c.sku})`);
            }}
          >
            <div
              className={styles.supplierColorSwatch}
              style={{ background: c.hex }}
            />
            <span className={styles.supplierColorName}>{c.name}</span>
            <span className={styles.supplierColorSku}>{c.sku}</span>
          </button>
        ))}
      </div>

      {/* Available Sizes */}
      <h4 className={styles.supplierSectionTitleSpaced}>Available Sizes</h4>
      <div className={styles.supplierSizes}>
        {data.sizes.map((s) => (
          <span
            key={s}
            className={styles.supplierSizeTag}
            onClick={() => onToast(`Size ${s} selected`)}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Available Models (Mockups) */}
      <h4 className={styles.supplierSectionTitleSpaced}>
        Available Models (Mockups)
      </h4>
      <div className={styles.supplierModels}>
        {data.models.map((m, i) => (
          <div
            key={m}
            className={`${styles.supplierModelThumb} ${i === 0 ? styles.supplierModelThumbActive : ''}`}
            onClick={() => onToast(`Model: ${m}`)}
          >
            <span className={`material-symbols-outlined ${styles.supplierModelIcon}`}>
              image
            </span>
          </div>
        ))}
      </div>

      {/* Design with this SKU + View product page link */}
      <button
        type="button"
        className={styles.supplierDesignBtn}
        onClick={() => {
          loadBlank('tee');
          onToast(`${data.productName} loaded onto canvas.`);
        }}
      >
        Design with this SKU
      </button>
      <button
        type="button"
        className={styles.supplierProductPageLink}
        onClick={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('navigate-product-page'));
          }
        }}
      >
        View product page →
      </button>
    </>
  );
}

// ── Queue inspector — shown when the Design Queue button is clicked.
function QueueInspector({ onToast }: { onToast: (msg: string) => void }) {
  const designQueue = useDesignCanvas((s) => s.designQueue);
  const removeFromQueue = useDesignCanvas((s) => s.removeFromQueue);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const setSupplierCategory = useDesignCanvas((s) => s.setSupplierCategory);

  if (designQueue.length === 0) {
    return (
      <div className={styles.queueEmpty}>
        <span className={`material-symbols-outlined ${styles.queueEmptyIcon}`}>
          playlist_add
        </span>
        <p className={styles.queueEmptyText}>
          No items in queue. Add products from the category flyout.
        </p>
      </div>
    );
  }

  return (
    <>
      {designQueue.map((q) => (
        <div
          key={q.id}
          className={styles.queueItem}
          onClick={() => {
            setSupplierCategory(q.name.split(' — ')[0] || 'Product', q.name);
            window.dispatchEvent(new CustomEvent('switch-studio-kind', { detail: 'Supplier' }));
            onToast(`Opening variant details for "${q.name}".`);
          }}
        >
          <img src={q.img} alt={q.name} className={styles.queueItemImg} />
          <div className={styles.queueItemInfo}>
            <b className={styles.queueItemName}>{q.name}</b>
            <span className={styles.queueItemMeta}>
              {q.brand} · ${q.price.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            className={styles.queueItemRemove}
            onClick={(e) => {
              e.stopPropagation();
              removeFromQueue(q.id);
              onToast(`Removed "${q.name}" from queue.`);
            }}
          >
            <span className={`material-symbols-outlined ${styles.queueItemRemoveIcon}`}>
              close
            </span>
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.queueStartBtn}
        onClick={() => {
          const first = designQueue[0];
          if (first) {
            loadBlank(first.blankKey);
            onToast(`Loaded "${first.name}" onto canvas. ${designQueue.length - 1} remaining.`);
          }
        }}
      >
        Start designing ({designQueue.length})
      </button>
    </>
  );
}
