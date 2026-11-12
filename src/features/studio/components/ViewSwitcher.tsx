// ViewSwitcher — T07: one button per template view + the surface switcher.
// Labels are data-driven (VIEW_LABELS / SURFACE_OPTIONS from printAreas.ts);
// Phase 3 (T13/T13b) relabels Flat → Tech Packs by editing that data, not
// this component.
'use client';

import { SURFACE_OPTIONS, VIEW_LABELS, type ViewId } from '../lib/printAreas';
import { useCanvasStore } from '../store/canvasStore';

export type SurfaceId = 'flat' | 'techpack' | 'model';

export default function ViewSwitcher(props: {
  views: ViewId[];
  surface: SurfaceId;
  onSurfaceChange: (s: SurfaceId) => void;
}) {
  const { views, surface, onSurfaceChange } = props;
  const activeView = useCanvasStore((s) => s.activeView);
  const setActiveView = useCanvasStore((s) => s.setActiveView);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="view-switcher">
      <div className="flex overflow-hidden rounded-md border border-neutral-300">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setActiveView(v)}
            aria-pressed={activeView === v}
            className={`px-3 py-1.5 text-sm ${activeView === v ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-100'}`}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-md border border-neutral-300" data-testid="surface-switcher">
        {SURFACE_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSurfaceChange(s.id as SurfaceId)}
            aria-pressed={surface === s.id}
            className={`px-3 py-1.5 text-sm ${surface === s.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-neutral-100'}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
