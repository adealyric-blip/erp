'use client';

/**
 * Design Studio — New design canvas screen.
 *
 * What we imported from upload/canvas.html (per user instruction):
 *   ✅ The canvas viewport (dotted bg, product mockup, drag-drop).
 *   ✅ The top toolbar (Undo/Redo + Edit/Preview toggle + Help).
 *   ✅ The bottom bar (zoom + product label + Save/Publish).
 *
 * What we did NOT import (kept the existing StudioDrawer overlay instead,
 * because it aligns with the global theme — RecordDrawer / Bills drawer / etc.):
 *   ❌ The integrated right rail (Upload/AI/Add text/Product Info/Mockup View).
 *   ❌ The catalog/wizard/orders/my-stores rail content.
 *   ❌ The variant/publish modals inside the canvas screen.
 *
 * New (this pass):
 *   • Print-area pills at the bottom of the canvas — product-type dependent:
 *     - Tops: Front side / Back side / Sleeve left / Sleeve right / Neck label inner
 *     - Books: Front matter / Back matter / Binder
 *     - Drinkware (mugs/tumblers): row list — Wrap / Both sides / Handle only
 *   • Preview mode: canvas shows the mockup angles strip inline.
 */
import { useState, type DragEvent } from 'react';
import {
  BLANKS,
  PRINT_AREAS,
  useDesignCanvas,
} from '@/lib/designCanvasStore';
import styles from './DesignCanvas.module.css';

interface DesignCanvasScreenProps {
  onToast: (msg: string) => void;
}

// Mockup angles shown in Preview mode (per image 1 & 2).
const MOCKUP_ANGLES = [
  'Front', 'Back', 'Folded', 'Folded 2', 'Lifestyle 2', 'Lifestyle 3', 'Person 1', 'Person 2',
];

export default function DesignCanvasScreen({ onToast }: DesignCanvasScreenProps) {
  const product = useDesignCanvas((s) => s.product);
  const mode = useDesignCanvas((s) => s.mode);
  const printArea = useDesignCanvas((s) => s.printArea);
  const setMode = useDesignCanvas((s) => s.setMode);
  const setPrintArea = useDesignCanvas((s) => s.setPrintArea);
  const loadBlank = useDesignCanvas((s) => s.loadBlank);

  const [dragover, setDragover] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [activeAngle, setActiveAngle] = useState(0);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragover(false);
    const type = e.dataTransfer.getData('blank-type');
    if (type && BLANKS[type]) {
      loadBlank(type);
      onToast(`${BLANKS[type].name} loaded.`);
    }
  };

  // Print-area pills depend on the loaded product's family.
  const family = product?.family ?? 'tops';
  const areas = PRINT_AREAS[family];
  const isDrinkware = family === 'drinkware';

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

          {/* Preview mode: mockup angle strip (inline, not a drawer) */}
          {product && mode === 'preview' && (
            <div className={styles.angleStrip}>
              {MOCKUP_ANGLES.map((a, i) => (
                <button
                  key={a}
                  type="button"
                  className={`${styles.angleThumb} ${i === activeAngle ? styles.angleActive : ''}`}
                  onClick={() => setActiveAngle(i)}
                  title={a}
                >
                  <img src={product.img} alt={a} />
                  <span>{a}</span>
                </button>
              ))}
            </div>
          )}
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

          {/* Print-area pills — the "pills for every product type" (user spec).
              Tops → pills; Books → pills; Drinkware (mugs/tumblers) → row list. */}
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
          <button type="button" className={styles.saveBtn} onClick={() => onToast('Draft saved.')}>
            Save product
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={() => onToast('Publish — select channels in the publish drawer.')}
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
