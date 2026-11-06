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

  const [dragover, setDragover] = useState(false);
  const [zoom, setZoom] = useState(100);
  // Create-action toolbar: popped up (expanded) or collapsed to a + button.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  // Which top-bar category dropdown is open (null = none).
  const [openNav, setOpenNav] = useState<string | null>(null);
  // Which subcategory is active in the open dropdown (shows its products).
  const [activeSub, setActiveSub] = useState<string | null>(null);

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
      {/* Category top bar — mega-menu dropdown with LEFT=subcategories,
          RIGHT=product cards with images. Each card has:
          - "Design this" → opens the variant drawer (supplier inspector)
          - "Add to queue" → adds to the design queue
          When the queue has items, the StudioDrawer shows the queue list.
          Clicking a queued product opens the variant drawer for that product. */}
      <div className={styles.topNav}>
        <div className={styles.navLogo}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
          Studio
        </div>
        <div className={styles.navLinks}>
          {Object.entries(TOP_NAV).map(([category, items]) => (
            <div
              key={category}
              className={`${styles.navItem} ${openNav === category ? styles.open : ''}`}
            >
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => {
                  if (openNav === category) {
                    setOpenNav(null);
                  } else {
                    setOpenNav(category);
                    setActiveSub(items[0]);
                  }
                }}
              >
                {category}
                <span className="material-symbols-outlined">expand_more</span>
              </button>
              {/* Mega-menu: LEFT=subcategories, RIGHT=product cards */}
              {openNav === category && (
                <div className={styles.megaMenu}>
                  {/* Left: subcategory list */}
                  <div className={styles.megaChildren}>
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.megaChildItem} ${activeSub === item ? styles.megaChildActive : ''}`}
                        onClick={() => setActiveSub(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {/* Right: product cards with images + Design this + Add to queue */}
                  <div className={styles.megaProducts}>
                    <div className={styles.megaProductsHeader}>
                      Select {activeSub} for queue
                    </div>
                    {activeSub && getCategoryProducts(category, activeSub).map((p) => (
                      <div key={p.id} className={styles.megaProductRow}>
                        <img src={p.img} alt={p.name} className={styles.megaProductImg} />
                        <div className={styles.megaProductInfo}>
                          <b>{p.name}</b>
                          <span>{p.brand} · ${p.price.toFixed(2)}</span>
                        </div>
                        <div className={styles.megaProductActions}>
                          {/* "Design this" → opens the variant drawer */}
                          <button
                            type="button"
                            className={styles.megaDesignBtn}
                            title="View variant details & design this product"
                            onClick={() => {
                              setSupplierCategory(category, activeSub);
                              setOpenNav(null);
                              onToast(`${p.name} — variant drawer opened.`);
                            }}
                          >
                            Design this
                          </button>
                          {/* "Add to queue" → adds to the design queue */}
                          <button
                            type="button"
                            className={styles.megaQueueBtn}
                            title="Add to design queue"
                            onClick={() => {
                              addToQueue(p);
                              onToast(`Added "${p.name}" to queue.`);
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                            Add to queue
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Design Queue button with badge — opens the StudioDrawer as queue */}
        <button
          type="button"
          className={styles.queueBtn}
          onClick={() => {
            if (designQueue.length > 0) {
              // Open the StudioDrawer with the Queue kind via GlobalShell's
              // studioDrawer state. We use a custom event so GlobalShell
              // can pick it up without a direct prop connection.
              window.dispatchEvent(new CustomEvent('open-studio-queue'));
            } else {
              onToast('Queue is empty — add products from the category dropdowns.');
            }
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>playlist_add</span>
          Design Queue
          {designQueue.length > 0 && (
            <span className={styles.queueBadge}>{designQueue.length}</span>
          )}
        </button>
      </div>

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
