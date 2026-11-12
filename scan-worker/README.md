# Scan worker (T14)

Small Node + ClamAV service that virus-scans supplier uploads. It is the
**server runner** for `virus_scan` jobs: the S605 trigger forces that kind
to `runner='server'`, and the browser render station never claims it, so an
untrusted supplier upload is never opened in a staff browser before it is
marked clean. The supplier portal hides an upload until
`rfq_files.scan_status = 'clean'` (the `ds_finish_job` side effect).

## Run locally (needs Docker — absent on the build VM, so the container
## deploy is an open item, not something faked here)

```sh
docker build -t atelier-scan-worker scan-worker/
docker run --rm -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... \
  atelier-scan-worker
```

## Deploy (Lightsail, per plan Phase 0)

One small instance (2 GB RAM is enough for ClamAV), static IP, same env
vars as above. `CLAMD_HOST` / `CLAMD_PORT` default to the local daemon.
`SCAN_WORKER_POLL_MS` (default 5000) sets the claim interval.

## Behaviour

- Claims only `virus_scan` via `ds_claim_jobs` (worker id
  `scan-worker:<hostname>`), one job at a time, heartbeat every 30 s.
- Downloads the file from the `supplier-uploads` bucket with the service
  key, streams it to clamd (`zINSTREAM`), SHA-256s it, and finishes with
  `ds_finish_job`:
  - clean → `p_ok: true, output: { clean: true, sha256 }` → `scan_status='clean'`
  - infected → `p_ok: true, output: { clean: false, sha256, signature }` →
    `scan_status='infected'` (a final state — never retried)
  - clamd/downstream failure → `p_ok: false` → requeue with backoff
