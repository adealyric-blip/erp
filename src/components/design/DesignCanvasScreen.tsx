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
  // Full-page product flyout — open/closed.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Which category is active in the flyout.
  const [flyoutCat, setFlyoutCat] = useState<string>('Men');
  // Which subcategory is active in the flyout.
  const [flyoutSub, setFlyoutSub] = useState<string>('Sweatshirts');

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
      {/* Category top bar — clicking a category opens the full-page
          product flyout (like Navigation Hub / Create Flyout).
          The flyout has LEFT=scrollable subcategories,
          RIGHT=vertically stacked product cards that scroll. */}
      <div className={styles.topNav}>
        <div className={styles.navLogo}>
          <span className={`material-symbols-outlined ${styles.icon16}`}>palette</span>
          Studio
        </div>
        <div className={styles.navLinks}>
          {Object.keys(TOP_NAV).map((category) => (
            <button
              key={category}
              type="button"
              className={styles.navBtn}
              onClick={() => {
                setFlyoutCat(category);
                setFlyoutSub(TOP_NAV[category][0]);
                setFlyoutOpen(true);
              }}
            >
              {category}
            </button>
          ))}
        </div>
        {/* Design Queue button with badge */}
        <button
          type="button"
          className={styles.queueBtn}
          onClick={() => {
            if (designQueue.length > 0) {
              window.dispatchEvent(new CustomEvent('open-studio-queue'));
            } else {
              onToast('Queue is empty — add products from the category flyout.');
            }
          }}
        >
          <span className={`material-symbols-outlined ${styles.icon16}`}>playlist_add</span>
          Design Queue
          {designQueue.length > 0 && (
            <span className={styles.queueBadge}>{designQueue.length}</span>
          )}
        </button>
      </div>

      {/* Full-page product flyout — fills the entire viewport.
          LEFT=subcategories for the SELECTED category only (not all categories).
          RIGHT=vertically stacked product cards — THIS is what scrolls
          (20,000+ products). Subcategories are a fixed list, not scrollable. */}
      {flyoutOpen && (
        <div className={styles.flyoutOverlay} onClick={() => setFlyoutOpen(false)}>
          <div className={styles.flyoutPanel} onClick={(e) => e.stopPropagation()}>
            {/* Flyout header */}
            <div className={styles.flyoutHeader}>
              <div className={styles.flyoutHeaderLeft}>
                <span className={`material-symbols-outlined ${styles.icon20}`}>inventory_2</span>
                <h2>{flyoutCat} — Browse Products</h2>
              </div>
              <button
                type="button"
                className={styles.flyoutClose}
                onClick={() => setFlyoutOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Flyout body — LEFT=subcategories (fixed, no scroll),
                RIGHT=product cards (scrollable for 20,000+) */}
            <div className={styles.flyoutBody}>
              {/* Left: subcategories for THIS category only — not scrollable */}
              <div className={styles.flyoutSidebar}>
                <div className={styles.flyoutSubList}>
                  {TOP_NAV[flyoutCat]?.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      className={`${styles.flyoutSubItem} ${flyoutSub === sub ? styles.flyoutSubActive : ''}`}
                      onClick={() => setFlyoutSub(sub)}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: product cards stacked vertically — THIS SCROLLS */}
              <div className={styles.flyoutProducts}>
                <div className={styles.flyoutProductsHeader}>
                  {flyoutSub} — check products to add to queue
                </div>
                <div className={styles.flyoutProductList}>
                  {getCategoryProducts(flyoutCat, flyoutSub).map((p) => {
                    const queued = designQueue.some((q) => q.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className={`${styles.flyoutProductRow} ${queued ? styles.flyoutProductRowChecked : ''}`}
                      >
                        {/* Checkbox — toggle queue membership */}
                        <label className={styles.flyoutCheckboxLabel}>
                          <input
                            type="checkbox"
                            checked={queued}
                            onChange={() => {
                              if (queued) {
                                removeFromQueue(p.id);
                                onToast(`Removed "${p.name}" from queue.`);
                              } else {
                                addToQueue(p);
                                onToast(`Added "${p.name}" to queue (${designQueue.length + 1} total).`);
                              }
                            }}
                            className={styles.flyoutCheckbox}
                          />
                        </label>
                        <img src={p.img} alt={p.name} className={styles.flyoutProductImg} />
                        <div className={styles.flyoutProductInfo}>
                          <b>{p.name}</b>
                          <span>{p.brand} · ${p.price.toFixed(2)}</span>
                        </div>
                        {/* "Design this" → opens the variant drawer */}
                        <button
                          type="button"
                          className={styles.flyoutDesignBtn}
                          title="View variant details & design this product"
                          onClick={() => {
                            setSupplierCategory(flyoutCat, flyoutSub);
                            setFlyoutOpen(false);
                            onToast(`${p.name} — variant drawer opened.`);
                          }}
                        >
                          Design this
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* Sticky footer — queue count + View queue button */}
                <div className={styles.flyoutFooter}>
                  <span className={styles.flyoutQueueCount}>
                    {designQueue.length} in queue
                  </span>
                  <button
                    type="button"
                    className={styles.flyoutViewQueueBtn}
                    disabled={designQueue.length === 0}
                    onClick={() => {
                      setFlyoutOpen(false);
                      window.dispatchEvent(new CustomEvent('open-studio-queue'));
                    }}
                  >
                    View queue →
                  </button>
                </div>
              </div>
            </div>
          </div>
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
