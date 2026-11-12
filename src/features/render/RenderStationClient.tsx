// Render station client (T14): one studio tab = one render station.
// Start claims browser jobs (thumbnail, bg_remove, techpack_pdf,
// techpack_preview_pdf), heartbeats every 30 s, uploads outputs and
// finishes them. Closing the tab mid-job leaves the heartbeat stale —
// ds_reap_stale_jobs requeues it and the next tab finishes it once.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/server/supabase/browser';
import { startRenderStation, type StationHandle } from './station';
import { BROWSER_JOB_KINDS } from './jobs';

export default function RenderStationClient(props: { tenantId: string }) {
  const { tenantId } = props;
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [finished, setFinished] = useState(0);
  const [failed, setFailed] = useState(0);
  const handleRef = useRef<StationHandle | null>(null);

  const appendLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((lines) => [...lines.slice(-199), `[${ts}] ${line}`]);
  }, []);

  const start = useCallback(() => {
    const supabase = createBrowserSupabaseClient();
    const handle = startRenderStation({
      supabase,
      tenantId,
      log: appendLog,
      onJobFinished: (_job, ok) => {
        if (ok) setFinished((n) => n + 1);
        else setFailed((n) => n + 1);
      },
    });
    handleRef.current = handle;
    setSessionId(handle.sessionId);
    setRunning(true);
  }, [tenantId, appendLog]);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => () => handleRef.current?.stop(), []);

  return (
    <div data-testid="render-station">
      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button type="button" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white" onClick={start}>
            Start render station
          </button>
        ) : (
          <button type="button" className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm" onClick={stop}>
            Stop render station
          </button>
        )}
        <span className="text-sm text-neutral-600">
          {running ? `Running — session ${sessionId}` : 'Stopped — no jobs are claimed while stopped.'}
        </span>
        <span className="text-sm text-neutral-600">Finished: {finished} · Failed: {failed}</span>
      </div>
      <p className="mt-3 text-sm text-neutral-600">
        Claims: {BROWSER_JOB_KINDS.join(', ')}. Virus scans stay on the server (scan-worker) — this tab
        never opens an untrusted supplier upload. Approving a tech pack enqueues both PDFs; with this tab
        open they render in under 2 minutes.
      </p>
      <div className="mt-4 h-64 overflow-y-auto rounded-md border border-neutral-300 bg-neutral-900 p-3 font-mono text-xs text-green-200" data-testid="render-station-log">
        {log.length === 0 ? (
          <p className="text-neutral-400">Station log — start the station to claim jobs.</p>
        ) : (
          log.map((line, i) => <p key={i}>{line}</p>)
        )}
      </div>
    </div>
  );
}
