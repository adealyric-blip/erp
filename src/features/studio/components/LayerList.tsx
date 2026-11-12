// LayerList — T07: layers for the active view, select + delete.
'use client';

import { useMemo } from 'react';
import { useCanvasStore } from '../store/canvasStore';

const KIND_LABEL: Record<string, string> = { text: 'Text', image: 'Image', shape: 'Shape', icon: 'Icon' };

export default function LayerList() {
  const activeView = useCanvasStore((s) => s.activeView);
  // Same rule as CanvasStage: select the raw array, memoize the filter.
  const allLayers = useCanvasStore((s) => s.layers);
  const layers = useMemo(() => allLayers.filter((l) => l.view === activeView), [allLayers, activeView]);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectLayer = useCanvasStore((s) => s.selectLayer);
  const removeLayer = useCanvasStore((s) => s.removeLayer);

  return (
    <div data-testid="layer-list">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Layers — {activeView}</h3>
      {layers.length === 0 && <p className="mt-2 text-sm text-neutral-500">No layers on this view yet.</p>}
      <ul className="mt-2 space-y-1">
        {[...layers].reverse().map((l) => (
          <li key={l.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => selectLayer(l.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') selectLayer(l.id);
              }}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedId === l.id ? 'bg-blue-50 font-medium text-blue-900' : 'hover:bg-neutral-100'
              }`}
              data-layer-row={l.id}
            >
              <span className="truncate">
                <span className="mr-2 text-xs text-neutral-400">{KIND_LABEL[l.kind] ?? l.kind}</span>
                {l.name}
              </span>
              <button
                type="button"
                aria-label={`Delete ${l.name}`}
                className="rounded px-1 text-neutral-400 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(l.id);
                }}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
