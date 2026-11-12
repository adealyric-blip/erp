// StudioShell — T06 shell. NO left rail, no sidebar (Jaizon 21:34 CST):
// everything lives in a DRAWER over the canvas. The drawer reuses the
// existing StudioDrawer panels (Upload/AI/Text/Shapes/…) via
// StudioPanelContent, extended with the T07 Konva panels (Uploads/Images/
// Graphics) and the onPlace* callbacks that drop layers onto the canvas.
'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { StudioPanelContent, type StudioShape } from '@/components/StudioDrawer';
import CommandPalette, { openCommandPalette } from './CommandPalette';
import UploadsPanel from './panels/UploadsPanel';
import StockImagesPanel from './panels/StockImagesPanel';
import GraphicsPanel from './panels/GraphicsPanel';
import { useCanvasStore } from '../store/canvasStore';
import { useCommand } from '../hooks/useCommand';
import { useAutosave } from '../hooks/useAutosave';
import { useRealtimeDesign } from '../hooks/useRealtimeDesign';

export type DrawerKind = 'Upload' | 'Images' | 'Graphics' | 'Shapes' | 'Text' | 'AI' | 'My library' | 'My templates';

const DRAWER_TOOLS: Array<{ kind: DrawerKind; label: string }> = [
  { kind: 'Upload', label: 'Uploads' },
  { kind: 'Images', label: 'Images' },
  { kind: 'Graphics', label: 'Graphics' },
  { kind: 'Shapes', label: 'Shapes' },
  { kind: 'Text', label: 'Text' },
  { kind: 'AI', label: 'AI' },
];

export default function StudioShell(props: {
  designId: string | null;
  title: string;
  children: ReactNode;
}) {
  const { designId, title, children } = props;
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [primary, setPrimary] = useState<{ label: string; run: () => void } | null>(null);
  const { run } = useCommand();
  const { saveNow, status } = useAutosave({ designId });
  const peers = useCanvasStore((s) => s.peers);
  useRealtimeDesign({ designId: designId?.startsWith('demo-') ? null : designId });

  const onToast = useCallback((m: string) => toast(m), []);

  const onPlaceText = useCallback(
    (value: string, font: string, sizePt: number) => {
      void run('layer.add_text', { kind: 'text', text: value, fontFamily: font, fontSize: sizePt });
    },
    [run],
  );

  const onPlaceShape = useCallback(
    (shape: StudioShape, color: string) => {
      void run('layer.add_shape', { kind: 'shape', shape: shape.render, fill: color, width: 120, height: 120 });
    },
    [run],
  );

  const onPlaceImage = useCallback(
    (src: string, name: string) => {
      void run('layer.add_image', { kind: 'image', src, width: 240, height: 240 }).then((res) => {
        if (res.ok) toast(`Added ${name} to the canvas.`);
      });
    },
    [run],
  );

  const onPrimary = useCallback((label: string, fn: () => void) => {
    setPrimary({ label, run: fn });
  }, []);

  const handleSave = async () => {
    const okSaved = await saveNow('Manual save');
    if (okSaved) toast.success('Design saved as a new version.');
    else if (status === 'error') toast.error('Save failed — see the status line.');
    else toast('Nothing to save — the canvas is unchanged.');
  };

  const handlePreviewPublish = async () => {
    await saveNow('Preview & Publish');
    toast('Version saved — publish to the catalog ships with the listing flow (open item).');
    if (designId) router.push(`/studio/designs/${designId}/history`);
  };

  const handleRotate = () => {
    // 360° turntable frames are T22 (Phase 5). Until then, Rotate steps
    // through the template views — labelled honestly in the toast.
    const s = useCanvasStore.getState();
    const order = ['front', 'back', 'left_sleeve', 'right_sleeve', 'hood', 'side'] as const;
    const next = order[(order.indexOf(s.activeView as (typeof order)[number]) + 1) % order.length];
    s.setActiveView(next as never);
    toast(`View: ${next} — full 360° turntable frames land in T22.`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50" data-testid="studio-shell">
      <Toaster />
      <CommandPalette />
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
        <a href="/studio/designs" className="text-sm font-semibold text-neutral-900">
          ← Designs
        </a>
        <h1 className="text-base font-bold">{title}</h1>
        <span className="text-xs text-neutral-500" data-testid="save-status">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'local' ? 'Saved locally (demo)' : status === 'error' ? 'Save error' : 'Unsaved changes saved every 30 s'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Presence avatars (T08). */}
          <div className="flex items-center" data-testid="presence-avatars" title="People editing this design">
            {peers.map((p) => (
              <span
                key={p.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white"
                style={{ background: p.color, marginLeft: -6 }}
                title={p.name}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => openCommandPalette()} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm" title="Command palette (⌘K)">
            ⌘K Commands
          </button>
          <button type="button" onClick={() => void handleSave()} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
            Save
          </button>
          <button type="button" onClick={() => void handlePreviewPublish()} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white">
            Preview &amp; Publish
          </button>
          <button type="button" onClick={handleRotate} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            ⟳ 360 Rotate Product
          </button>
        </div>
      </header>

      {/* Drawer tool buttons — the only "rail": a flat row of buttons that
          open drawers OVER the canvas. No left rail, no sidebar. */}
      <nav className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2" aria-label="Studio tools">
        {DRAWER_TOOLS.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => setDrawer(drawer === t.kind ? null : t.kind)}
            aria-pressed={drawer === t.kind}
            className={`rounded-md px-3 py-1.5 text-sm ${drawer === t.kind ? 'bg-blue-600 text-white' : 'border border-neutral-300 hover:bg-neutral-100'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDrawer('My templates')}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          My templates
        </button>
      </nav>

      <div className="relative flex-1">{children}</div>

      {/* The drawer — slides over the canvas. Text/Shapes/AI reuse the
          existing StudioDrawer panels; Uploads/Images/Graphics are the new
          T07 panels. */}
      {drawer && (
        <div
          id="studio-drawer"
          role="dialog"
          aria-label={`${drawer} panel`}
          data-testid="studio-drawer"
          className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <div id="studio-drawer-title" className="font-semibold">{drawer}</div>
              <div className="text-xs text-neutral-500">
                {drawer === 'Upload' && 'PNG, JPG, SVG — up to 25 MB'}
                {drawer === 'Images' && 'Stock images via /api/stock'}
                {drawer === 'Graphics' && 'Icons and graphics'}
                {drawer === 'Shapes' && 'Basic vector shapes'}
                {drawer === 'Text' && 'Add a text layer'}
                {drawer === 'AI' && 'Generate art from a prompt'}
                {drawer === 'My templates' && 'Your saved designs'}
                {drawer === 'My library' && 'Your saved assets'}
              </div>
            </div>
            <button type="button" aria-label="Close drawer" onClick={() => setDrawer(null)} className="rounded px-2 py-1 text-lg hover:bg-neutral-100">
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {drawer === 'Upload' && <UploadsPanel onToast={onToast} />}
            {drawer === 'Images' && <StockImagesPanel onToast={onToast} />}
            {drawer === 'Graphics' && <GraphicsPanel onToast={onToast} />}
            {(drawer === 'Text' || drawer === 'Shapes' || drawer === 'AI' || drawer === 'My templates' || drawer === 'My library') && (
              <StudioPanelContent
                kind={drawer}
                onToast={onToast}
                designId={null}
                blankDetail={null}
                printArea="front"
                onPrimary={onPrimary}
                onPlaceShape={onPlaceShape}
                onPlaceText={onPlaceText}
                onPlaceImage={onPlaceImage}
                onClosePanel={() => setDrawer(null)}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-neutral-200 p-3">
            <button type="button" onClick={() => setDrawer(null)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
              Close
            </button>
            {primary && (
              <button type="button" onClick={() => primary.run()} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white">
                {primary.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
