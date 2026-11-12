'use client';

// CraftEditor — T12. The open-in-Craft surface: a staff-only page inside the
// existing studio shell (no rail, no new sidebar — the layout's drawer
// system is untouched). One iframe, one app, one document:
//   staff document stream → iframe → save back → upload → new design version.
// Open path per app (T11 spike): host-bridge apps (pdfcraft, filmcraft,
// lightcraft-legacy) open via `<app>:open` postMessage once `ready` posts;
// control-only apps (vectorcraft, effectcraft) never post ready, so the
// document opens through the control channel (`document.open` with base64
// bytes). Apps with no drive surface in their web build (photocraft,
// texturecraft, designcraft) show the app with an honest notice instead of
// a fake open.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CRAFT_APP_TABLE } from '@/lib/craft-bridge/apps';
import { useCraftApp } from '@/lib/craft-bridge/useCraftApp';
import type { CraftApp } from '@/lib/craft-bridge/protocol';
import type { CraftSave } from '@/lib/craft-bridge/host';

const CONTROL_OPEN_APPS: Partial<Record<CraftApp, { command: string }>> = {
  // Spike-verified: VectorCraft opens inline bytes via document.open.
  vectorcraft: { command: 'document.open' },
};

/** Apps whose web build posts `<app>:ready` (spike-verified). */
const HOST_BRIDGE_APPS: CraftApp[] = ['pdfcraft', 'filmcraft', 'lightcraft'];

function toBase64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export interface CraftEditorProps {
  designId: string;
  designName: string;
  app: CraftApp;
  /** Staff document-stream URL, when ?asset= named an asset. */
  documentUrl: string | null;
  documentName: string | null;
  saveUrl: string;
}

export default function CraftEditor({ designId, designName, app, documentUrl, documentName, saveUrl }: CraftEditorProps) {
  const [status, setStatus] = useState<string>('Loading app…');
  const [lastVersion, setLastVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const openedRef = useRef(false);
  const savedRef = useRef<(id: string) => void>(() => {});

  const saveBack = useCallback(
    async (save: CraftSave) => {
      setSaving(true);
      setStatus(`Saving ${save.name}…`);
      try {
        const form = new FormData();
        form.set('designId', designId);
        form.set('name', save.name);
        form.set('file', new Blob([save.bytes]), save.name);
        const res = await fetch(saveUrl, { method: 'POST', body: form, credentials: 'include' });
        const body = (await res.json()) as { ok?: boolean; data?: { version_id?: string }; error?: { message?: string } };
        if (!res.ok || !body.ok || !body.data?.version_id) {
          setStatus(`Save failed: ${body.error?.message ?? res.statusText}`);
          return;
        }
        setLastVersion(body.data.version_id);
        setStatus(`Saved as version ${body.data.version_id.slice(0, 8)}`);
        if (save.id) savedRef.current(save.id);
      } catch (e) {
        setStatus(`Save failed: ${e instanceof Error ? e.message : 'network error'}`);
      } finally {
        setSaving(false);
      }
    },
    [designId, saveUrl],
  );

  const { iframeRef, ready, appVersion, dirty, lastError, saved, open, execute } = useCraftApp(app, { onSave: saveBack });
  useEffect(() => {
    savedRef.current = saved;
  });

  const openDocument = useCallback(async () => {
    if (openedRef.current || !documentUrl) return;
    openedRef.current = true;
    setStatus('Opening document…');
    try {
      const res = await fetch(documentUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`document stream returned ${res.status}`);
      const bytes = await res.arrayBuffer();
      const name = documentName ?? 'document';
      if (ready) {
        open(bytes, name);
        setStatus('Document open — editing in app');
      } else if (CONTROL_OPEN_APPS[app]) {
        await execute(CONTROL_OPEN_APPS[app].command, { name, dataBase64: toBase64(bytes) });
        setStatus('Document open — editing in app (control channel)');
      } else {
        setStatus('This build cannot open documents from the studio yet — use File › Open inside the app');
      }
    } catch (e) {
      setStatus(`Could not open document: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
  }, [documentUrl, documentName, ready, app, open, execute]);

  useEffect(() => {
    if (!documentUrl) return undefined;
    // Host-bridge apps open as soon as ready posts; control-only apps get
    // a grace window for their API to install before the fallback runs.
    const delay = ready ? 0 : 15000;
    const t = setTimeout(() => void openDocument(), delay);
    return () => clearTimeout(t);
  }, [ready, documentUrl, openDocument]);

  const cap = CRAFT_APP_TABLE[app];
  const noDriveSurface = !HOST_BRIDGE_APPS.includes(app) && !CONTROL_OPEN_APPS[app];

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Link href={`/studio/designs/${designId}`} className="text-sm text-muted-foreground underline">
          ← {designName}
        </Link>
        <span className="text-sm font-medium">
          {app} {appVersion ? `v${appVersion}` : `v${cap.version}`}
        </span>
        <span className="text-xs text-muted-foreground">{cap.role}</span>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {dirty && (
            <span aria-label="unsaved changes" title="Unsaved changes">
              ● Unsaved
            </span>
          )}
          {saving && <span>Saving…</span>}
          {lastVersion && <span>Version {lastVersion.slice(0, 8)} saved</span>}
          <span className="text-xs text-muted-foreground">{status}</span>
        </span>
      </div>
      {lastError && (
        <div role="alert" className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {lastError}
        </div>
      )}
      {noDriveSurface && documentUrl && (
        <div role="note" className="border-b bg-amber-50 px-4 py-2 text-sm">
          This {app} web build ({cap.version}) has no host bridge or control API in its release, so the studio cannot
          open or save documents through it yet. Its jobs run on the server runner (see plan/wasm-spike.md).
        </div>
      )}
      <div className="min-h-0 flex-1">
        <iframe
          ref={iframeRef}
          title={`${app} editor`}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
          allowFullScreen
        />
      </div>
    </div>
  );
}
