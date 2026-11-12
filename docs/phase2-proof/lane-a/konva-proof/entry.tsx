import React from 'react';
import { createRoot } from 'react-dom/client';
import CanvasStage from '../../../../src/features/studio/components/CanvasStage';
import { useCanvasStore } from '../../../../src/features/studio/store/canvasStore';

useCanvasStore.getState().init({
  designId: 'demo-proof',
  designName: 'Proof — Boxy tee',
  templateId: 'seed-boxy-tee',
  templateName: 'Boxy tee',
});
const s = useCanvasStore.getState();
s.addLayer({ kind: 'text', text: 'Atelier', fontFamily: 'Anton', fontSize: 44, x: 250, y: 200 });
s.addLayer({ kind: 'shape', shape: 'star', fill: '#db2777', x: 420, y: 300, width: 90, height: 90 });
s.addLayer({ kind: 'text', text: 'OUTSIDE', fontFamily: 'Inter', fontSize: 20, x: 40, y: 40 });
useCanvasStore.getState().setOutsidePrintArea(true);

function App() {
  const outside = useCanvasStore((st) => st.outsidePrintArea);
  const layers = useCanvasStore((st) => st.layers);
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', padding: 16, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>Konva CanvasStage — browser render proof (component-level)</h1>
      <p>Layers: {layers.length} · Outside-print-area warning: {outside ? 'SHOWN' : 'hidden'}</p>
      {outside && (
        <div data-testid="outside-print-area-warning" style={{ background: '#fef3c7', border: '1px solid #f59e0b', padding: 12, borderRadius: 8, margin: '12px 0' }}>
          Outside print area — the selected layer extends beyond the dashed print area.
        </div>
      )}
      <CanvasStage view="front" printArea={{ x: 0.18, y: 0.2, w: 0.64, h: 0.6, width_mm: 300, height_mm: 400 }} colorwayFill="#ffffff" />
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
