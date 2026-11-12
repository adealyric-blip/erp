// useCraftApp.ts — T11. React hook over CraftHost: `open(bytes, name)`,
// `execute(cmd, params)`, `export(format)` (via the app's export command),
// `onDirty`, plus the iframe ref the app mounts into.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CRAFT_APP_TABLE, type CraftExportFormat } from './apps';
import { CraftHost, type CraftSave } from './host';
import type { CraftApp, CraftReadyMessage } from './protocol';

export interface UseCraftAppResult {
  /** Ref for the <iframe> the app mounts into. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** True once the app posted `<app>:ready`. */
  ready: boolean;
  /** App release from `ready.appVersion`, when the app reports it. */
  appVersion: string | null;
  /** Unsaved-changes flag from `<app>:dirty`. */
  dirty: boolean;
  lastError: string | null;
  lastSave: CraftSave | null;
  /** Open a document as File › Open would. Dropping bytes transfers them. */
  open: (bytes: ArrayBuffer, name: string) => void;
  /** Run one command from the app's registry. */
  execute: (command: string, params?: Record<string, unknown>) => Promise<unknown>;
  /** List the app's command registry. */
  commands: () => Promise<unknown>;
  /** Run the app's export command for a format; resolves with the bytes. */
  exportFormat: (format: CraftExportFormat, command: string, params?: Record<string, unknown>) => Promise<CraftSave>;
  /** Answer a save that carried an id. */
  saved: (id: string) => void;
  /** Extra dirty listener (the hook already tracks `dirty` state). */
  onDirty: (listener: (dirty: boolean) => void) => () => void;
}

export function useCraftApp(
  app: CraftApp,
  opts: { onSave?: (save: CraftSave) => void | Promise<void>; renderer?: 'webgl' | 'cpu' } = {},
): UseCraftAppResult {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<CraftHost | null>(null);
  const dirtyListeners = useRef(new Set<(dirty: boolean) => void>());
  const [ready, setReady] = useState(false);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSave, setLastSave] = useState<CraftSave | null>(null);
  const onSaveRef = useRef(opts.onSave);
  useEffect(() => {
    onSaveRef.current = opts.onSave;
  });

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const host = new CraftHost(app, {
      onReady: (msg: CraftReadyMessage) => {
        setAppVersion(msg.appVersion ?? null);
        setReady(true);
      },
      onSave: (save) => {
        setLastSave(save);
        void onSaveRef.current?.(save);
      },
      onDirty: (d) => {
        setDirty(d);
        for (const l of dirtyListeners.current) l(d);
      },
      onFailed: (error) => setLastError(error),
      onHandoff: () => setLastError(`${app} handed off a file this host does not route`),
    });
    hostRef.current = host;
    host.mount(iframe, { renderer: opts.renderer });
    host.ready().catch((e: unknown) => setLastError(e instanceof Error ? e.message : String(e)));
    return () => {
      host.destroy();
      hostRef.current = null;
    };
  }, [app]);

  const open = useCallback((bytes: ArrayBuffer, name: string) => {
    hostRef.current?.open(bytes, name);
  }, []);

  const execute = useCallback(async (command: string, params?: Record<string, unknown>) => {
    if (!hostRef.current) throw new Error('Craft app is not mounted');
    return hostRef.current.execute(command, params);
  }, []);

  const commands = useCallback(async () => {
    if (!hostRef.current) throw new Error('Craft app is not mounted');
    await hostRef.current.waitForApi();
    return hostRef.current.api().commands();
  }, []);

  const exportFormat = useCallback(
    async (format: CraftExportFormat, command: string, params?: Record<string, unknown>) => {
      if (!hostRef.current) throw new Error('Craft app is not mounted');
      const cap = CRAFT_APP_TABLE[app];
      if (!cap.wantedFormats.includes(format)) {
        throw new Error(`${app} does not export ${format} (wanted: ${cap.wantedFormats.join(', ')})`);
      }
      return hostRef.current.exportViaCommand(command, params);
    },
    [app],
  );

  const saved = useCallback((id: string) => {
    hostRef.current?.saved(id);
  }, []);

  const onDirty = useCallback((listener: (d: boolean) => void) => {
    dirtyListeners.current.add(listener);
    return () => {
      dirtyListeners.current.delete(listener);
    };
  }, []);

  return { iframeRef, ready, appVersion, dirty, lastError, lastSave, open, execute, commands, exportFormat, saved, onDirty };
}
