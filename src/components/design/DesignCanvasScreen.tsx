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
  const designQueue = useDesignCanvas((s) => s.designQueue);
  const addToQueue = useDesignCanvas((s) => s.addToQueue);
  const removeFromQueue = useDesignCanvas((s) => s.removeFromQueue);
  const clearQueue = useDesignCanvas((s) => s.clearQueue);

  const [dragover, setDragover] = useState(false);
  const [zoom, setZoom] = useState(100);
  // Create-action toolbar: popped up (expanded) or collapsed to a + button.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  // Right-side product flyout — open/closed state.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Which category tab is active in the flyout.
  const [activeCat, setActiveCat] = useState<string>('Men');
  // Which subcategory within the active category is selected.
  const [activeSub, setActiveSub] = useState<string>('Sweatshirts');
  // Products selected in the flyout (not yet added to the queue).
  const [flyoutSelected, setFlyoutSelected] = useState<Set<string>>(new Set());

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
      {/* Category top bar — the "two doors to entry" from canvas.html.
          Categories are simple text labels (not dropdowns). The "Browse
          Products" button on the right opens a right-side flyout panel
          with product images + checkboxes for multi-select queueing. */}
      <div className={styles.topNav}>
        <div className={styles.navLogo}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>palette</span>
          Studio
        </div>
        <div className={styles.navLinks}>
          {Object.keys(TOP_NAV).map((category) => (
            <button
              key={category}
              type="button"
              className={styles.navBtn}
              onClick={() => {
                setActiveCat(category);
                setActiveSub(TOP_NAV[category][0]);
                setFlyoutOpen(true);
              }}
              style={{ cursor: 'pointer' }}
            >
              {category}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.browseBtn}
          onClick={() => setFlyoutOpen(true)}
        >
          <span className="material-symbols-outlined">browse_gallery</span>
          Browse Products
          {designQueue.length > 0 && (
            <span className={styles.browseBtnBadge}>{designQueue.length}</span>
          )}
        </button>
      </div>

      {/* Design queue bar — shows when products are queued for batch design */}
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

      {/* ── Right-side product flyout panel ──
          Slides in from the right. Shows category tabs, subcategory chips,
          product grid with images + checkboxes, and an "Add Selected to
          Queue" button. This is a FLYOUT, not a dropdown. */}
      <div
        className={`${styles.productFlyoutScrim} ${flyoutOpen ? styles.open : ''}`}
        onClick={() => setFlyoutOpen(false)}
      />
      <div className={`${styles.productFlyout} ${flyoutOpen ? styles.open : ''}`}>
        {/* Header */}
        <div className={styles.flyoutPanelHeader}>
          <div className={styles.flyoutPanelTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>inventory_2</span>
            Select Products for Queue
          </div>
          <button
            type="button"
            className={styles.btnIco}
            title="Close"
            onClick={() => setFlyoutOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body — category tabs + subcategory chips + product grid */}
        <div className={styles.flyoutPanelBody}>
          {/* Category tabs */}
          <div className={styles.catTabs}>
            {Object.keys(TOP_NAV).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.catTab} ${activeCat === cat ? styles.active : ''}`}
                onClick={() => {
                  setActiveCat(cat);
                  setActiveSub(TOP_NAV[cat][0]);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Subcategory chips */}
          <div className={styles.subChips}>
            {TOP_NAV[activeCat]?.map((sub) => (
              <button
                key={sub}
                type="button"
                className={`${styles.subChip} ${activeSub === sub ? styles.active : ''}`}
                onClick={() => setActiveSub(sub)}
              >
                {sub}
              </button>
            ))}
          </div>

          {/* Product grid with images + checkboxes */}
          <div className={styles.flyoutProductGrid}>
            {getCategoryProducts(activeCat, activeSub).map((p) => {
              const selected = flyoutSelected.has(p.id);
              const queued = designQueue.some((q) => q.id === p.id);
              return (
                <div
                  key={p.id}
                  className={`${styles.flyoutProductCard} ${selected ? styles.flyoutProductCardSelected : ''}`}
                  onClick={() => {
                    setFlyoutSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('blank-type', p.blankKey);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title={`${p.name} — ${p.brand} · $${p.price}`}
                >
                  <div className={styles.flyoutProductImg}>
                    <img src={p.img} alt={p.name} />
                  </div>
                  <div className={styles.flyoutProductInfo}>
                    <div className={styles.flyoutProductName}>{p.name}</div>
                    <div className={styles.flyoutProductBrand}>{p.brand}</div>
                    <div className={styles.flyoutProductPrice}>${p.price.toFixed(2)}</div>
                  </div>
                  <div
                    className={`${styles.flyoutCheckbox} ${selected || queued ? styles.flyoutCheckboxChecked : ''}`}
                  >
                    {(selected || queued) && (
                      <span className="material-symbols-outlined">check</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — selected count + Add to Queue button */}
        <div className={styles.flyoutPanelFooter}>
          <span className={styles.flyoutSelectedCount}>
            {flyoutSelected.size} selected · {designQueue.length} in queue
          </span>
          <button
            type="button"
            className={styles.addToQueueBtn}
            disabled={flyoutSelected.size === 0}
            onClick={() => {
              // Add all selected products to the design queue.
              const products = getCategoryProducts(activeCat, activeSub);
              flyoutSelected.forEach((id) => {
                const p = products.find((pp) => pp.id === id);
                if (p) addToQueue(p);
              });
              onToast(`Added ${flyoutSelected.size} product(s) to the design queue.`);
              setFlyoutSelected(new Set());
            }}
          >
            <span className="material-symbols-outlined">add</span>
            Add Selected to Queue
          </button>
        </div>
      </div>
    </div>
  );
}
