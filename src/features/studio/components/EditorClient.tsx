// Design editor — T07 canvas + T08 autosave/realtime, client side.
// The server page loads design + template + latest version; this component
// owns the canvas store, the view switcher, the layer list and the
// outside-print-area warning.
'use client';

import { useEffect, useState } from 'react';
import StudioShell from '../components/StudioShell';
import CanvasStage from '../components/CanvasStage';
import LayerList from '../components/LayerList';
import ColorwayBar from '../components/ColorwayBar';
import ViewSwitcher, { type SurfaceId } from '../components/ViewSwitcher';
import { useCanvasStore, parseCanvasState } from '../store/canvasStore';
import { parsePrintAreas, SEED_TEMPLATES, type ViewId } from '../lib/printAreas';
import { loadLocalDraftVersions } from '../hooks/useAutosave';
import type { DesignEditorData } from '@/server/actions/designs';

export default function EditorClient(props: { data: DesignEditorData }) {
  const { data } = props;
  const [surface, setSurface] = useState<SurfaceId>('flat');
  const activeView = useCanvasStore((s) => s.activeView);
  const colorwayFill = useCanvasStore((s) => s.colorwayFill);
  const outsidePrintArea = useCanvasStore((s) => s.outsidePrintArea);
  const dirty = useCanvasStore((s) => s.dirty);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);

  // Template: DB row when present, else the seed mirror (same data).
  const templateViews: ViewId[] =
    (data.template?.views as ViewId[] | undefined) ??
    SEED_TEMPLATES.find((t) => t.id === data.design.garment_template_id)?.views ??
    SEED_TEMPLATES[0]?.views ??
    ['front', 'back'];
  const printAreas = parsePrintAreas(
    data.template?.print_areas ??
      SEED_TEMPLATES.find((t) => t.id === data.design.garment_template_id)?.print_areas ??
      SEED_TEMPLATES[0]?.print_areas ??
      {},
  );

  useEffect(() => {
    const scene = parseCanvasState(data.design.canvas_state);
    useCanvasStore.getState().init({
      designId: data.design.id,
      designName: data.design.name,
      templateId: data.design.garment_template_id,
      templateName: data.template?.name ?? null,
      initialView: templateViews[0] ?? 'front',
      scene,
    });
  }, [data.design.id]);

  const isDemo = data.design.id.startsWith('demo-');
  const localVersions = isDemo ? loadLocalDraftVersions(data.design.id) : [];

  return (
    <StudioShell designId={data.design.id} title={data.design.name}>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {isDemo && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="demo-banner">
            Local draft — no database row. Saves go to this browser only (demo versions below); create a real design
            from the studio home once you are signed in with a staff account.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewSwitcher views={templateViews} surface={surface} onSurfaceChange={setSurface} />
          <p className="text-xs text-neutral-500" data-testid="editor-status">
            {dirty ? 'Unsaved changes' : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'No unsaved changes'}
            {data.latestVersion ? ` · latest v${data.latestVersion.version_no}` : ''}
            {isDemo && localVersions.length > 0 ? ` · ${localVersions.length} local version(s)` : ''}
          </p>
        </div>

        {outsidePrintArea && (
          <div
            role="alert"
            data-testid="outside-print-area-warning"
            className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          >
            ⚠️ Outside print area — the selected layer extends beyond the dashed print area. Move it inside or use
            “Fit to print area”.
          </div>
        )}

        {surface === 'model' ? (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500" data-testid="model-view">
            Model view is render-only — the design surface is Flat. Full model renders land with the T21 mockup
            pipeline.
          </div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_260px]">
            <div>
              <CanvasStage view={activeView} printArea={printAreas[activeView] ?? null} colorwayFill={colorwayFill} />
              <div className="mt-4">
                <ColorwayBar />
              </div>
            </div>
            <aside className="space-y-6">
              <LayerList />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Template</h3>
                <p className="mt-1 text-sm">
                  {data.template?.name ?? 'Boxy tee'} · {templateViews.length} views
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Print areas from the garment template (normalized + mm). Dashed blue = printable.
                </p>
                <a href={`/studio/designs/${data.design.id}/history`} className="mt-3 inline-block text-sm text-blue-700 underline">
                  Version history →
                </a>
              </div>
            </aside>
          </div>
        )}
      </main>
    </StudioShell>
  );
}
