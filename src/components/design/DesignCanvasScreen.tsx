'use client';

/**
 * Design Studio — New design canvas screen.
 *
 * What we imported from upload/canvas.html (per user instruction):
 *   - The canvas viewport (dotted bg, product mockup, drag-drop).
 *   - The top toolbar (Undo/Redo + Edit/Preview toggle + Help).
 *   - The bottom bar (zoom + product label + Save/Publish).
 *
 * What we did NOT import (kept the existing StudioDrawer overlay instead,
 * because it aligns with the global theme — RecordDrawer / Bills drawer / etc.):
 *   - The integrated right rail (Upload/AI/Add text/Product Info/Mockup View).
 *   - The catalog/wizard/orders rail content.
 *   - The variant/publish modals inside the canvas screen.
 *
 * New (this pass):
 *   - Everything that has content is draggable onto the canvas — catalog
 *     thumbnails, StudioDrawer assets/AI/text/fonts/graphics/images/templates.
 *   - Floating create-action toolbar (tldraw-style) — Select/Text/Rect/Ellipse/
 *     Draw/Arrow/Line/Triangle. Pops up; collapses to a single + button.
 *   - Preview button navigates to the design-preview screen (its own page)
 *     where users can select variants and publish.
 *   - Publish button also navigates to the preview page.
 */
import { useState, type DragEvent } from 'react';
import {
  BLANKS,
  PRINT_AREAS,
  TOP_NAV,
  getCategoryProducts,
  useDesignCanvas,
  type CategoryProduct,
} from '@/lib/designCanvasStore';
import type { DomainKey } from '@/data/shellData';
import styles from './DesignCanvas.module.css';

interface DesignCanvasScreenProps {
  onToast: (msg: string) => void;
  onNavigate: (domain: DomainKey, screenId: string) => void;
}

// Create-action toolbar tools (tldraw-style floating toolbar).
type ToolId = 'select' | 'text' | 'rect' | 'ellipse' | 'draw' | 'arrow' | 'line' | 'triangle';
const TOOLS: { id: ToolId; icon: string; label: string }[] = [
  { id: 'select', icon: 'navigation', label: 'Select' },
  { id: 'text', icon: 'text_fields', label: 'Text' },
  { id: 'rect', icon: 'crop_square', label: 'Rectangle' },
  { id: 'ellipse', icon: 'circle', label: 'Ellipse' },
  { id: 'draw', icon: 'draw', label: 'Draw' },
  { id: 'arrow', icon: 'arrow_right_alt', label: 'Arrow' },
  { id: 'line', icon: 'horizontal_rule', label: 'Line' },
  { id: 'triangle', icon: 'change_history', label: 'Triangle' },
];

export default function DesignCanvasScreen({ onToast, onNavigate }: DesignCanvasScreenProps) {
  const product = useDesignCanvas((s) => s.product);
  const printArea = useDesignCanvas((s) => s.printArea);
  const setPrintArea = useDesignCanvas((s) => s.setPrintArea);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);
  const setSupplierCategory = useDesignCanvas((s) => s.setSupplierCategory);
  const designQueue = useDesignCanvas((s) => s.designQueue);
  const addToQueue = useDesignCanvas((s) => s.addToQueue);
  const removeFromQueue = useDesignCanvas((s) => s.removeFromQueue);
  const clearQueue = useDesignCanvas((s) => s.clearQueue);

  const [dragover, setDragover] = useState(false);
  const [zoom, setZoom] = useState(100);
  // Create-action toolbar: popped up (expanded) or collapsed to a + button.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  // Mega-menu — which top-bar category dropdown is open (null = none).
  const [openMega, setOpenMega] = useState<string | null>(null);
  // Which subcategory is active in the mega-menu (left side highlight).
  const [megaChild, setMegaChild] = useState<string | null>(null);
  // Products checked in the mega-menu (not yet added to the queue).
  const [megaChecked, setMegaChecked] = useState<Set<string>>(new Set());
  // Design Queue small flyout — open/closed.
  const [queueFlyoutOpen, setQueueFlyoutOpen] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
    // Catalog thumbnails drag a blank-type + catalog-product-id.
    const blankType = e.dataTransfer.getData('blank-type');
    if (blankType && BLANKS[blankType]) {
      loadBlank(blankType);
      onToast(`${BLANKS[blankType].name} loaded onto canvas.`);
      return;
    }
    // StudioDrawer content — assets, text, fonts, graphics, templates.
    const asset = e.dataTransfer.getData('studio-asset');
    if (asset) {
      onToast(`Asset "${asset}" dropped on canvas.`);
      return;
    }
    const text = e.dataTransfer.getData('studio-text');
    if (text) {
      onToast(`Text layer "${text}" added to canvas.`);
      return;
    }
    const font = e.dataTransfer.getData('studio-font');
    if (font) {
      onToast(`Text layer with ${font} font added to canvas.`);
      return;
    }
    const graphic = e.dataTransfer.getData('studio-graphic');
    if (graphic) {
      onToast(`Graphic "${graphic}" added to canvas.`);
      return;
    }
    const template = e.dataTransfer.getData('studio-template');
    if (template) {
      onToast(`Template "${template}" applied to canvas.`);
      return;
    }
  };

  const handleToolClick = (tool: ToolId) => {
    setActiveTool(tool);
    if (tool !== 'select') {
      onToast(`${TOOLS.find((t) => t.id === tool)?.label} tool — click on canvas to place.`);
    }
  };

  // Print-area pills depend on the loaded product's family.
  const family = product?.family ?? 'tops';
  const areas = PRINT_AREAS[family];
  const isDrinkware = family === 'drinkware';

  return (
    <div className={styles.root}>
      {/* Category top bar — mega-menu dropdowns (like flyout.html).
          Click a category → dropdown appears below with LEFT=subcategories,
          RIGHT=products with checkboxes + images + "Add selected to queue".
          A "Design Queue" button with red badge sits on the top-right. */}
      <div className={styles.topNav}>
        <div className={styles.navLogo}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
          Studio
        </div>
        <div className={styles.navLinks}>
          {Object.entries(TOP_NAV).map(([category, items]) => (
            <div
              key={category}
              className={`${styles.navItem} ${openMega === category ? styles.open : ''}`}
            >
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => {
                  if (openMega === category) {
                    setOpenMega(null);
                  } else {
                    setOpenMega(category);
                    setMegaChild(items[0]);
                  }
                }}
              >
                {category}
                <span className="material-symbols-outlined">expand_more</span>
              </button>
              {/* Mega-menu dropdown — LEFT=subcategories, RIGHT=products */}
              {openMega === category && (
                <div className={styles.megaMenu}>
                  {/* Left: subcategory list */}
                  <div className={styles.megaChildren}>
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.megaChildItem} ${megaChild === item ? styles.megaChildActive : ''}`}
                        onClick={() => setMegaChild(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {/* Right: product list with checkboxes + images */}
                  <div className={styles.megaProducts}>
                    <div className={styles.megaProductsHeader}>
                      Select {megaChild} for queue
                    </div>
                    {megaChild && getCategoryProducts(category, megaChild).map((p) => {
                      const checked = megaChecked.has(p.id) || designQueue.some((q) => q.id === p.id);
                      return (
                        <div
                          key={p.id}
                          className={styles.megaProductRow}
                          onClick={() => {
                            setMegaChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 16, height: 16, accentColor: 'var(--d-ink)' }}
                          />
                          <img src={p.img} alt={p.name} className={styles.megaProductImg} />
                          <div className={styles.megaProductInfo}>
                            <b>{p.name}</b>
                            <span>{p.brand} · ${p.price.toFixed(2)}</span>
                          </div>
                          {/* Click the product name to open the supplier inspector (StudioDrawer) */}
                          <button
                            type="button"
                            className={styles.megaProductDesign}
                            title="View product info & supplier details"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSupplierCategory(category, megaChild);
                              onToast(`${category} / ${megaChild} — supplier inspector opened.`);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
                          </button>
                        </div>
                      );
                    })}
                    {/* Footer: Add selected to queue */}
                    <div className={styles.megaFooter}>
                      <button
                        type="button"
                        className={styles.megaAddBtn}
                        disabled={megaChecked.size === 0}
                        onClick={() => {
                          const products = getCategoryProducts(category, megaChild || '');
                          megaChecked.forEach((id) => {
                            const p = products.find((pp) => pp.id === id);
                            if (p) addToQueue(p);
                          });
                          onToast(`Added ${megaChecked.size} product(s) to the design queue.`);
                          setMegaChecked(new Set());
                          setOpenMega(null);
                        }}
                      >
                        Add selected to queue
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Design Queue button with red badge — opens a small flyout dropdown */}
        <div className={styles.queueBtnContainer}>
          <button
            type="button"
            className={styles.queueBtn}
            onClick={() => setQueueFlyoutOpen(!queueFlyoutOpen)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>playlist_add</span>
            Design Queue
            <span className={styles.queueBadge}>{designQueue.length}</span>
          </button>
          {/* Small flyout dropdown showing queued items */}
          {queueFlyoutOpen && (
            <div className={styles.queueFlyout}>
              <div className={styles.queueFlyoutHeader}>
                Design Queue
                <button
                  type="button"
                  onClick={() => setQueueFlyoutOpen(false)}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--d-mut)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
              <div className={styles.queueFlyoutBody}>
                {designQueue.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--d-mut)', fontSize: 12 }}>
                    No items in queue.
                  </div>
                ) : (
                  designQueue.map((q) => (
                    <div key={q.id} className={styles.queueFlyoutItem}>
                      <img src={q.img} alt={q.name} />
                      <div className={styles.queueFlyoutItemInfo}>
                        <b>{q.name}</b>
                        <span>{q.brand}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          removeFromQueue(q.id);
                          onToast(`Removed "${q.name}" from queue.`);
                        }}
                        style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--d-mut)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
              {designQueue.length > 0 && (
                <div className={styles.queueFlyoutFooter}>
                  <button
                    type="button"
                    className={styles.queueFlyoutStartBtn}
                    onClick={() => {
                      const first = designQueue[0];
                      if (first) {
                        loadBlank(first.blankKey);
                        onToast(`Loaded "${first.name}" onto canvas. ${designQueue.length - 1} remaining.`);
                        setQueueFlyoutOpen(false);
                      }
                    }}
                  >
                    Start designing
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Design queue bar — shows when products are queued */}
      {designQueue.length > 0 && (
        <div className={styles.queueBar}>
          <span className={styles.queueLabel}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>queue</span>
            Design Queue ({designQueue.length})
          </span>
          <div className={styles.queueItems}>
            {designQueue.map((q) => (
              <div key={q.id} className={styles.queueItem} title={q.name}>
                <div className={styles.queueItemImg}>
                  <img src={q.img} alt={q.name} />
                </div>
                <span className={styles.queueItemName}>{q.name}</span>
                <button
                  type="button"
                  className={styles.queueItemRemove}
                  title="Remove from queue"
                  onClick={() => {
                    removeFromQueue(q.id);
                    onToast(`Removed "${q.name}" from queue.`);
                  }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.queueClear}
            onClick={() => {
              clearQueue();
              onToast('Design queue cleared.');
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            className={styles.queueStartBtn}
            onClick={() => {
              const first = designQueue[0];
              if (first) {
                loadBlank(first.blankKey);
                onToast(`Loaded "${first.name}" onto canvas. ${designQueue.length - 1} remaining in queue.`);
              }
            }}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Start designing
          </button>
        </div>
      )}

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
              <p>Drag a product from the catalog, or content from the studio drawers.</p>
            </div>
          ) : (
            <img src={product.img} className={styles.item} alt="Design Mockup" />
          )}

          {/* Floating create-action toolbar (tldraw-style, bottom-left of canvas) */}
          <div className={styles.createToolbar}>
            {toolbarOpen ? (
              <div className={styles.toolbarExpanded}>
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.toolBtn} ${activeTool === t.id ? styles.toolBtnActive : ''}`}
                    title={t.label}
                    onClick={() => handleToolClick(t.id)}
                  >
                    <span className="material-symbols-outlined">{t.icon}</span>
                  </button>
                ))}
                <div className={styles.toolDivider} />
                <button
                  type="button"
                  className={styles.toolBtn}
                  title="Collapse toolbar"
                  onClick={() => setToolbarOpen(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.toolbarCollapsed}
                title="Create — open toolbar"
                onClick={() => setToolbarOpen(true)}
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar (top center) */}
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnIco} title="Undo" onClick={() => onToast('Undo')}>
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button type="button" className={styles.btnIco} title="Redo" onClick={() => onToast('Redo')}>
            <span className="material-symbols-outlined">redo</span>
          </button>
          <div className={styles.div} />
          <div className={styles.seg}>
            <button type="button" className={`${styles.segBtn} ${styles.on}`}>
              Edit
            </button>
            <button
              type="button"
              className={styles.segBtn}
              onClick={() => onNavigate('design', 'design-preview')}
              title="Open the preview page — select variants & publish"
            >
              Preview
            </button>
          </div>
          <div className={styles.div} />
          <button
            type="button"
            className={styles.btnIco}
            title="Help — shortcuts"
            onClick={() => onToast('Help — Ctrl+Shift+> next view, Ctrl+Shift+C center H')}
          >
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>

        {/* Bottom bar: zoom · label · print-area pills · Save/Publish */}
        <div className={styles.bottom}>
          <div className={styles.zoom}>
            <button type="button" className={styles.zoomBtn} onClick={() => setZoom((z) => Math.max(15, z - 5))}>
              −
            </button>
            <span className={styles.zoomVal}>{zoom}%</span>
            <button type="button" className={styles.zoomBtn} onClick={() => setZoom((z) => Math.min(200, z + 5))}>
              +
            </button>
          </div>
          <span className={styles.label}>{product ? product.name : 'No product selected'}</span>

          {/* Print-area pills */}
          {product && (
            <div className={`${styles.pillRow} ${isDrinkware ? styles.pillRowList : ''}`}>
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.pill} ${printArea === a.id ? styles.pillActive : ''}`}
                  onClick={() => setPrintArea(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.spacer} />
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => {
              if (product) {
                onToast(`Draft saved — ${product.name}.`);
              } else {
                onToast('Nothing to save — load a product first.');
              }
            }}
          >
            Save product
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={() => onNavigate('design', 'design-preview')}
          >
            Preview &amp; Publish
          </button>
        </div>
      </div>
    </div>
  );
}
