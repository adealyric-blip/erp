// useAutosave — T08: save every 30 s when dirty.
// Save = design.save → ds_create_design_version (via runCommand).
// Local-demo designs (id starts with `demo-`) persist to localStorage
// instead — they have no DB row, and the UI labels them "Local draft".
'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { runCommand } from '@/server/actions/commands';

export const AUTOSAVE_INTERVAL_MS = 30_000;

const LS_KEY = (designId: string) => `atelier:design:${designId}:local-versions`;

export function saveLocalDraftVersion(designId: string, scene: unknown, message?: string): string {
  const key = LS_KEY(designId);
  let list: Array<{ id: string; version_no: number; created_at: string; message: string | null; canvas_state: unknown }> = [];
  try {
    list = JSON.parse(localStorage.getItem(key) ?? '[]') as typeof list;
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  const entry = {
    id: `local-${Date.now().toString(36)}`,
    version_no: (list[list.length - 1]?.version_no ?? 0) + 1,
    created_at: new Date().toISOString(),
    message: message ?? null,
    canvas_state: scene,
  };
  list.push(entry);
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* quota — the in-memory scene is still the source of truth */
  }
  return entry.id;
}

export function loadLocalDraftVersions(designId: string): Array<{
  id: string;
  version_no: number;
  created_at: string;
  message: string | null;
  canvas_state: unknown;
}> {
  try {
    const list = JSON.parse(localStorage.getItem(LS_KEY(designId)) ?? '[]') as unknown;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function useAutosave(opts: { designId: string | null; enabled?: boolean }) {
  const { designId, enabled = true } = opts;
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'local'>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveNow = async (message?: string): Promise<boolean> => {
    const s = useCanvasStore.getState();
    if (!designId || !s.dirty) return false;
    setStatus('saving');
    setError(null);
    try {
      if (designId.startsWith('demo-')) {
        const versionId = saveLocalDraftVersion(designId, s.toCanvasState(), message);
        s.markSaved(versionId);
        setStatus('local');
        return true;
      }
      const res = await runCommand('design.save', {
        designId,
        canvasState: s.toCanvasState(),
        message,
      });
      if (!res.ok) {
        setStatus('error');
        setError(res.error.message);
        return false;
      }
      const versionId = (res.data as { versionId?: string } | null)?.versionId ?? null;
      s.markSaved(versionId);
      setStatus('saved');
      return true;
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Save failed');
      return false;
    }
  };

  useEffect(() => {
    if (!enabled || !designId) return;
    timer.current = setInterval(() => {
      const s = useCanvasStore.getState();
      if (s.dirty) void saveNow('Autosave');
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [designId, enabled]);

  return { saveNow, status, error };
}
