// VersionTimeline — T08: version history. Locked versions show a lock
// and "Duplicate to edit"; restore saves the old canvas_state as a NEW
// version (versions are append-only).
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { runCommand } from '@/server/actions/commands';
import { parseCanvasState } from '../store/canvasStore';
import type { DesignVersionRow } from '@/server/actions/designs';

export default function VersionTimeline(props: { designId: string; versions: DesignVersionRow[]; isDemo: boolean }) {
  const { designId, versions, isDemo } = props;
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  const restore = async (v: DesignVersionRow) => {
    setBusyId(v.id);
    const scene = parseCanvasState(v.canvas_state);
    if (!scene) {
      toast.error('That version has no canvas state to restore.');
      setBusyId(null);
      return;
    }
    const res = await runCommand('design.save', {
      designId,
      canvasState: scene as unknown as Record<string, unknown>,
      message: `Restored from v${v.version_no}`,
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(`Restored v${v.version_no} as a new version.`);
    router.refresh();
  };

  const duplicate = async () => {
    const res = await runCommand('design.duplicate', { designId });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    const id = (res.data as { designId: string }).designId;
    router.push(`/studio/designs/${id}`);
  };

  if (versions.length === 0) {
    return <p className="text-sm text-neutral-500">No versions yet — save the design to create v1.</p>;
  }

  return (
    <ol className="space-y-3" data-testid="version-timeline">
      {versions.map((v) => (
        <li key={v.id} className="flex items-start justify-between rounded-lg border border-neutral-200 bg-white p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">v{v.version_no}</span>
              {v.is_locked && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title="Locked on tech-pack approval">
                  🔒 Locked
                </span>
              )}
              <span className="text-xs text-neutral-400">{v.source_app}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600">{v.message ?? 'No message'}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {new Date(v.created_at).toLocaleString()}
              {v.created_by ? ` · ${v.created_by.slice(0, 8)}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {v.is_locked ? (
              <button
                type="button"
                onClick={() => void duplicate()}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Duplicate to edit
              </button>
            ) : (
              <button
                type="button"
                disabled={busyId === v.id || isDemo}
                onClick={() => void restore(v)}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {busyId === v.id ? 'Restoring…' : 'Restore'}
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
