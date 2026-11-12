// Print-area editor (T10): draw a rectangle on the flat per view.
// One rect per view (plan/04 GarmentPrintAreas). Rects are stored normalised
// 0..1 against the flat's viewBox, with real mm sizes alongside. Without a
// flat asset, draw on a blank 600x800 canvas.
'use client';

import { useEffect, useRef, useState } from 'react';

export interface PrintAreaIn {
  x: number;
  y: number;
  w: number;
  h: number;
  width_mm: number;
  height_mm: number;
}

type Rects = Record<string, PrintAreaIn>;

function toSvgPoint(e: React.PointerEvent<SVGSVGElement>, svg: SVGSVGElement, vbW: number, vbH: number) {
  const r = svg.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * vbW,
    y: ((e.clientY - r.top) / r.height) * vbH,
  };
}

export function PrintAreaEditor({
  initial,
  views,
  flatAssetId,
}: {
  initial: Rects;
  views: string[];
  flatAssetId: string | null;
}) {
  const [view, setView] = useState(views[0] ?? 'front');
  const [rects, setRects] = useState<Rects>(initial);
  const [flat, setFlat] = useState<{ svg: string; w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ mode: 'draw' | 'move'; startX: number; startY: number; orig?: PrintAreaIn } | null>(null);

  const vbW = flat?.w ?? 600;
  const vbH = flat?.h ?? 800;

  useEffect(() => {
    setView(views[0] ?? 'front');
  }, [views.join(',')]);

  useEffect(() => {
    if (!flatAssetId) {
      setFlat(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/studio/assets/${flatAssetId}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (cancelled || !text) return;
        const m = text.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
        setFlat({ svg: text, w: m ? Number(m[3]) : 600, h: m ? Number(m[4]) : 800 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [flatAssetId]);

  const rect = rects[view];
  const mm = (frac: number, total: number) => Math.round(frac * total);

  function updateRect(patch: Partial<PrintAreaIn>) {
    if (!rect) return;
    const next = { ...rect, ...patch };
    next.width_mm = mm(next.w, vbW);
    next.height_mm = mm(next.h, vbH);
    setRects((r) => ({ ...r, [view]: next }));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const p = toSvgPoint(e, svg, vbW, vbH);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if ((e.target as Element).getAttribute('data-rect') === '1' && rect) {
      dragRef.current = { mode: 'move', startX: p.x, startY: p.y, orig: { ...rect } };
    } else {
      dragRef.current = { mode: 'draw', startX: p.x, startY: p.y };
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const p = toSvgPoint(e, svg, vbW, vbH);
    if (drag.mode === 'draw') {
      const x = Math.min(drag.startX, p.x) / vbW;
      const y = Math.min(drag.startY, p.y) / vbH;
      const w = Math.abs(p.x - drag.startX) / vbW;
      const h = Math.abs(p.y - drag.startY) / vbH;
      setRects((r) => ({ ...r, [view]: { x, y, w, h, width_mm: mm(w, vbW), height_mm: mm(h, vbH) } }));
    } else if (drag.orig) {
      const dx = (p.x - drag.startX) / vbW;
      const dy = (p.y - drag.startY) / vbH;
      const nx = Math.min(Math.max(0, drag.orig.x + dx), 1 - drag.orig.w);
      const ny = Math.min(Math.max(0, drag.orig.y + dy), 1 - drag.orig.h);
      setRects((r) => ({ ...r, [view]: { ...drag.orig!, x: nx, y: ny } }));
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded border px-2 py-1 text-xs ${view === v ? 'bg-black text-white' : ''}`}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Drag on the flat to draw the {view} print area (drag the blue rect to move it). Sizes are stored in mm.
      </p>
      <div className="relative mt-2 max-w-md border">
        {flat && <div dangerouslySetInnerHTML={{ __html: flat.svg }} className="[&_svg]:h-auto [&_svg]:w-full" />}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${vbW} ${vbH}`}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {!flat && <rect x={0} y={0} width={vbW} height={vbH} fill="#fafafa" />}
          {rect && (
            <rect
              data-rect="1"
              x={rect.x * vbW}
              y={rect.y * vbH}
              width={rect.w * vbW}
              height={rect.h * vbH}
              fill="rgba(37,99,235,0.15)"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
        </svg>
      </div>
      {rect && (
        <div className="mt-2 grid max-w-md grid-cols-4 gap-2 text-xs">
          <label>
            x (0–1)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={rect.x.toFixed(2)}
              onChange={(e) => updateRect({ x: Number(e.target.value) })}
              className="mt-1 w-full rounded border px-1 py-1"
            />
          </label>
          <label>
            y (0–1)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={rect.y.toFixed(2)}
              onChange={(e) => updateRect({ y: Number(e.target.value) })}
              className="mt-1 w-full rounded border px-1 py-1"
            />
          </label>
          <label>
            w (0–1)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={rect.w.toFixed(2)}
              onChange={(e) => updateRect({ w: Number(e.target.value) })}
              className="mt-1 w-full rounded border px-1 py-1"
            />
          </label>
          <label>
            h (0–1)
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={rect.h.toFixed(2)}
              onChange={(e) => updateRect({ h: Number(e.target.value) })}
              className="mt-1 w-full rounded border px-1 py-1"
            />
          </label>
          <p className="col-span-4 text-neutral-600">
            {view}: {rect.width_mm} × {rect.height_mm} mm
            <button
              type="button"
              className="ml-3 text-red-700 underline"
              onClick={() => setRects((r) => {
                const next = { ...r };
                delete next[view];
                return next;
              })}
            >
              Clear
            </button>
          </p>
        </div>
      )}
      <input type="hidden" name="print_areas" value={JSON.stringify(rects)} />
    </div>
  );
}
