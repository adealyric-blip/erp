// useCommand — T06: run a registered command with optimistic UI + toast
// on Result error. Server commands go through the runCommand server action;
// clientOnly commands run against the canvas store directly.
'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { getCommand } from '@/lib/commands/registry';
import { runCommand } from '@/server/actions/commands';
import { useCanvasStore, type CanvasLayer } from '../store/canvasStore';
import type { CanvasApi } from '@/lib/commands/define';
import type { Result } from '@/server/result';

function canvasApi(): CanvasApi {
  const s = useCanvasStore.getState();
  return {
    addLayer: (layer) => s.addLayerFromCommand(layer),
    removeLayer: (id) => s.removeLayer(id),
    alignSelection: (mode) => s.alignSelection(mode),
    fitSelectionToPrintArea: () => s.fitSelectionToPrintArea(),
    setColorwayFill: (fill) => s.setColorwayFill(fill),
    getScene: () => s.getScene(),
  };
}

export function useCommand() {
  const run = useCallback(
    async <T = unknown>(
      id: string,
      input: unknown,
      opts?: { optimistic?: () => void; rollback?: () => void; silent?: boolean },
    ): Promise<Result<T>> => {
      const cmd = getCommand(id);
      if (!cmd) {
        const res: Result<T> = { ok: false, error: { code: 'not_found', message: `Unknown command: ${id}` } };
        if (!opts?.silent) toast.error(res.error.message);
        return res;
      }
      opts?.optimistic?.();
      const parsed = cmd.input.safeParse(input);
      if (!parsed.success) {
        const res: Result<T> = { ok: false, error: { code: 'invalid_state', message: parsed.error.message } };
        if (!opts?.silent) toast.error(res.error.message);
        return res;
      }
      let res: Result<unknown>;
      if (cmd.clientOnly) {
        res = await cmd.run({ supabase: null as never, userId: '', tenantId: '', canvas: canvasApi() }, parsed.data);
      } else {
        res = await runCommand(id, parsed.data);
      }
      if (!res.ok) {
        opts?.rollback?.();
        if (!opts?.silent) toast.error(res.error.message);
      }
      return res as Result<T>;
    },
    [],
  );

  const runClientLayer = useCallback((layer: Partial<CanvasLayer> & { kind: CanvasLayer['kind'] }) => {
    const id = useCanvasStore.getState().addLayer(layer);
    return id;
  }, []);

  return { run, runClientLayer };
}
