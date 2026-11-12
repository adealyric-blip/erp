// scan-worker — virus scanning for supplier uploads (T14).
// A small Node service (see Dockerfile: Node + ClamAV) that claims ONLY
// virus_scan jobs with ds_claim_jobs. Supplier uploads are untrusted:
// they are NEVER opened in a staff browser before this worker marks them
// clean — the S605 runner trigger forces virus_scan to runner='server',
// and the browser station never claims the kind.
//
// Flow per job (input: { rfq_file_id } or subject rfq_files row):
//   download bytes from the supplier-uploads bucket (service key) ->
//   stream to clamd over TCP (INSTREAM) -> ds_finish_job with
//   { clean, sha256 }. ds_finish_job's virus_scan side effect writes
//   rfq_files.scan_status ('clean' | 'infected'); the supplier portal
//   hides the upload until scan_status = 'clean'.
//   Infected files finish OK with clean:false (a final state — never a
//   retry). A clamd outage finishes NOT ok so the job requeues with
//   backoff. Heartbeat every 30 s while scanning.
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Socket } from 'node:net';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const CLAMD_HOST = process.env.CLAMD_HOST ?? '127.0.0.1';
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310);
const WORKER = `scan-worker:${process.env.HOSTNAME ?? 'local'}`;
const POLL_MS = Number(process.env.SCAN_WORKER_POLL_MS ?? 5000);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stream bytes to clamd (zINSTREAM) and return the verdict. */
function scanWithClamd(bytes) {
  return new Promise((resolve, reject) => {
    const sock = new Socket();
    let out = '';
    let settled = false;
    const done = (err, verdict) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      if (err) reject(err);
      else resolve(verdict);
    };
    sock.setTimeout(120_000, () => done(new Error('clamd timeout')));
    sock.on('error', done);
    sock.on('data', (chunk) => {
      out += chunk.toString('utf8');
      if (out.includes('OK')) done(null, { clean: true });
      else if (out.includes('FOUND')) done(null, { clean: false, signature: out.trim() });
    });
    sock.connect(CLAMD_PORT, CLAMD_HOST, () => {
      sock.write('zINSTREAM\0');
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const part = bytes.subarray(i, i + CHUNK);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        sock.write(len);
        sock.write(part);
      }
      const end = Buffer.alloc(4);
      sock.write(end);
    });
  });
}

async function runOne(job) {
  const jobId = job.id;
  const beat = setInterval(async () => {
    try {
      await supabase.rpc('ds_heartbeat_job', { p_job: jobId, p_worker: WORKER });
    } catch {
      // heartbeat is best-effort; the reaper covers a dead worker
    }
  }, 30_000);
  try {
    const input = job.input ?? {};
    const fileId = input.rfq_file_id ?? job.subject_id;
    if (!fileId) throw new Error('virus_scan job has no rfq_file_id');
    const { data: file, error: fileErr } = await supabase
      .from('rfq_files')
      .select('id, bucket, storage_path')
      .eq('id', fileId)
      .single();
    if (fileErr || !file) throw new Error(`rfq_file not found: ${fileErr?.message ?? fileId}`);
    const { data: blob, error: dlErr } = await supabase.storage.from(file.bucket).download(file.storage_path);
    if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message ?? file.storage_path}`);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const verdict = await scanWithClamd(bytes);
    console.log(`job ${jobId}: ${file.storage_path} -> ${verdict.clean ? 'clean' : `INFECTED (${verdict.signature ?? 'unknown'})`} (${bytes.length} bytes)`);
    const { error: finErr } = await supabase.rpc('ds_finish_job', {
      p_job: jobId,
      p_worker: WORKER,
      // Infected finishes OK with clean:false — a final state, never retried.
      p_ok: true,
      p_output: { clean: verdict.clean, sha256, signature: verdict.signature ?? null },
      p_error: null,
    });
    if (finErr) throw new Error(`finish failed: ${finErr.message}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown scan error';
    console.error(`job ${jobId} failed: ${message}`);
    // Transient failure (clamd down, download flake): requeue with backoff.
    await supabase.rpc('ds_finish_job', {
      p_job: jobId,
      p_worker: WORKER,
      p_ok: false,
      p_output: null,
      p_error: message.slice(0, 2000),
    });
  } finally {
    clearInterval(beat);
  }
}

async function tick() {
  const { data: jobs, error } = await supabase.rpc('ds_claim_jobs', {
    p_worker: WORKER,
    p_kinds: ['virus_scan'],
    p_limit: 1,
  });
  if (error) {
    console.error(`claim failed: ${error.message}`);
    return;
  }
  for (const job of jobs ?? []) {
    console.log(`claimed virus_scan ${job.id}`);
    await runOne(job);
  }
}

console.log(`scan-worker started (${WORKER}) — clamd ${CLAMD_HOST}:${CLAMD_PORT}`);
for (;;) {
  try {
    await tick();
  } catch (err) {
    console.error(`tick failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  await sleep(POLL_MS);
}
