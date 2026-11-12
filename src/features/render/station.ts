// Render station — the browser loop (T14).
// One studio tab = one render station: it claims browser jobs with
// ds_claim_browser_jobs, runs them through the handlers, heartbeats every
// 30 s with ds_heartbeat_browser_job (a false return means the job was
// reaped or cancelled — stop immediately), POSTs the output bytes to
// /api/studio/jobs/[jobId]/output (the route checks claimed_by starts
// with browser:<uid>:, writes the bucket + design_assets row with the
// service key), then finishes with ds_finish_browser_job.
//
// Idempotency: approving a pack enqueues techpack_pdf +
// techpack_preview_pdf with idempotency keys
// (techpack_pdf:<tp>:<to>); ds_finish_job requeues on transient failure
// with backoff, and ds_reap_stale_jobs requeues a job whose tab closed
// mid-run (heartbeat older than 5 min) — the next tab finishes it once.
// Open items: PdfCraft watermark-dialog driving (spike), true PDF/X-4
// (server runner), no-copy/no-print permission bits on the jsPDF
// fallback (see handlers.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
import { dsClaimBrowserJobs, dsFinishBrowserJob, dsHeartbeatBrowserJob } from '@/lib/db/rpc';
import { handlerFor, type HandlerContext, type RenderJob } from './handlers';
import { BROWSER_JOB_KINDS } from './jobs';

export interface StationHandle {
  sessionId: string;
  stop: () => void;
  /** Jobs finished by this tab in this session. */
  finishedCount: () => number;
}

export interface StationOptions {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  /** Poll interval between claim attempts (default 5 s). */
  pollMs?: number;
  log: (line: string) => void;
  /** Called after each finished job (for the station UI). */
  onJobFinished?: (job: RenderJob, ok: boolean) => void;
}

/** Tab session id: crypto.randomUUID without dashes (ds__browser_tag). */
export function newSessionId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function startRenderStation(opts: StationOptions): StationHandle {
  const { supabase, tenantId, log } = opts;
  const pollMs = opts.pollMs ?? 5000;
  const sessionId = newSessionId();
  let stopped = false;
  let finished = 0;
  let busy = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const uploadOutput = async (jobId: string, bytes: Uint8Array, filename: string, mimeType: string): Promise<string> => {
    // Base64 in JSON (the output route is same-origin fetch, no multipart).
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const res = await fetch(`/api/studio/jobs/${jobId}/output`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session: sessionId, filename, mime_type: mimeType, data_base64: btoa(binary) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`output upload failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as { asset_id?: string; error?: string };
    if (!body.asset_id) throw new Error(`output upload failed: ${body.error ?? 'no asset_id returned'}`);
    return body.asset_id;
  };

  const fetchTemplates = async (): Promise<string[]> => {
    const res = await fetch('/api/studio/techpack-templates');
    if (!res.ok) throw new Error(`template fetch failed (${res.status})`);
    const body = (await res.json()) as { pages?: { svg: string }[] };
    const pages = body.pages ?? [];
    if (pages.length !== 11) throw new Error(`expected 11 template pages, got ${pages.length}`);
    return pages.map((p) => p.svg);
  };

  const fetchSnapshot = async (techPackId: string, supplier: boolean) => {
    const fn = supplier ? 'ds_tech_pack_supplier_snapshot' : 'ds_tech_pack_snapshot';
    const { data, error } = await supabase.rpc(fn as 'ds_tech_pack_snapshot', { p_tp: techPackId });
    if (error || !data) throw new Error(`snapshot ${fn} failed: ${error?.message ?? 'no data'}`);
    return data as unknown as import('@/lib/techpack-render/types').TechPackSnapshot;
  };

  const runOne = async (jobRow: Record<string, unknown>): Promise<void> => {
    const job: RenderJob = {
      id: String(jobRow.id ?? ''),
      kind: String(jobRow.kind ?? ''),
      tenant_id: String(jobRow.tenant_id ?? ''),
      subject_id: jobRow.subject_id === null || jobRow.subject_id === undefined ? null : String(jobRow.subject_id),
      subject_type: jobRow.subject_type === null || jobRow.subject_type === undefined ? null : String(jobRow.subject_type),
      input: (jobRow.input ?? {}) as Record<string, unknown>,
    };
    const handler = handlerFor(job.kind);
    if (!handler) {
      log(`no handler for kind ${job.kind} — finishing as failed`);
      await dsFinishBrowserJob(supabase, { p_job: job.id, p_session: sessionId, p_ok: false, p_output: null, p_error: `no browser handler for kind ${job.kind}` });
      return;
    }
    // Heartbeat every 30 s; a false return stops the run immediately.
    let alive = true;
    const beat = setInterval(async () => {
      const { data } = await dsHeartbeatBrowserJob(supabase, { p_job: job.id, p_session: sessionId });
      if (data === false) {
        alive = false;
        log(`heartbeat returned false for ${job.id} — stopping`);
      }
    }, 30_000);
    try {
      const ctx: HandlerContext = {
        job,
        fetchTemplates,
        fetchSnapshot,
        uploadOutput: (bytes, filename, mime) => uploadOutput(job.id, bytes, filename, mime),
        log,
      };
      const out = await handler(ctx);
      if (!alive) {
        log(`job ${job.id} was reaped mid-run — not finishing`);
        return;
      }
      await dsFinishBrowserJob(supabase, {
        p_job: job.id,
        p_session: sessionId,
        p_ok: true,
        p_output: { asset_id: out.asset_id, bytes: out.bytes, note: out.note ?? null },
        p_error: null,
      });
      finished += 1;
      log(`finished ${job.kind} ${job.id} → asset ${out.asset_id} (${out.bytes} bytes)`);
      opts.onJobFinished?.(job, true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown handler error';
      log(`job ${job.id} failed: ${message}`);
      try {
        await dsFinishBrowserJob(supabase, { p_job: job.id, p_session: sessionId, p_ok: false, p_output: null, p_error: message.slice(0, 2000) });
      } catch (finishErr) {
        log(`finish failed (job may have been reaped): ${finishErr instanceof Error ? finishErr.message : 'unknown'}`);
      }
      opts.onJobFinished?.(job, false);
    } finally {
      clearInterval(beat);
    }
  };

  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const { data, error } = await dsClaimBrowserJobs(supabase, {
        p_tenant: tenantId,
        p_session: sessionId,
        p_kinds: [...BROWSER_JOB_KINDS],
        p_limit: 1,
      });
      if (error) {
        log(`claim failed: ${error.message}`);
        return;
      }
      const jobs = (data ?? []) as Record<string, unknown>[];
      for (const j of jobs) {
        if (stopped) return;
        log(`claimed ${String(j.kind ?? '')} ${String(j.id ?? '')}`);
        await runOne(j);
      }
    } catch (e) {
      log(`station tick failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      busy = false;
    }
  };

  log(`render station started — session ${sessionId}`);
  void tick();
  timer = setInterval(() => void tick(), pollMs);

  return {
    sessionId,
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      log('render station stopped');
    },
    finishedCount: () => finished,
  };
}
