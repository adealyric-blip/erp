-- =====================================================================
-- S605_browser_runner.sql  —  WASM-first rendering
-- Lets a signed-in STAFF browser tab (the "render station") claim and run
-- craft_jobs with the Craft WebAssembly builds. Server-only work (virus
-- scanning untrusted supplier uploads) stays on the server runner.
-- Requires S590 + S600. Idempotent: safe to re-run.
-- =====================================================================
BEGIN;

-- step ledger (unify) ---------------------------------------------------
DO $$ BEGIN
  IF to_regclass('unify.step_order') IS NOT NULL THEN
    INSERT INTO unify.step_order(step, label, file, pos) VALUES ('605','ds2','S605_browser_runner.sql',16)
    ON CONFLICT (step) DO UPDATE SET label = excluded.label, file = excluded.file, pos = excluded.pos;
    UPDATE unify.step_order SET pos = 17 WHERE step = '900';
    PERFORM unify.require('605');
  END IF;
END $$;

-- 1. Which runner may execute a job ------------------------------------
ALTER TABLE public.craft_jobs ADD COLUMN IF NOT EXISTS runner text NOT NULL DEFAULT 'browser';
ALTER TABLE public.craft_jobs DROP CONSTRAINT IF EXISTS craft_jobs_runner_check;
ALTER TABLE public.craft_jobs ADD CONSTRAINT craft_jobs_runner_check CHECK (runner IN ('browser','server'));
CREATE INDEX IF NOT EXISTS craft_jobs_browser_ready_idx
  ON public.craft_jobs (tenant_id, priority, run_after) WHERE status = 'queued' AND runner = 'browser';

-- Supplier uploads are untrusted: they are never opened in a staff browser
-- before a server-side scan. The runner is forced, not chosen by the caller.
CREATE OR REPLACE FUNCTION public.ds__job_runner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF NEW.kind = 'virus_scan' THEN NEW.runner := 'server'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.runner IS DISTINCT FROM OLD.runner AND OLD.kind = 'virus_scan' THEN
    NEW.runner := 'server';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_craft_jobs_runner ON public.craft_jobs;
CREATE TRIGGER trg_craft_jobs_runner BEFORE INSERT OR UPDATE ON public.craft_jobs
  FOR EACH ROW EXECUTE FUNCTION public.ds__job_runner();
UPDATE public.craft_jobs SET runner = 'server' WHERE kind = 'virus_scan' AND runner <> 'server';

-- 2. Browser runner RPCs (authenticated staff only) ---------------------
-- claimed_by = 'browser:<user id>:<tab session id>' so ownership is checkable.
CREATE OR REPLACE FUNCTION public.ds__browser_tag(p_session text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public, pg_catalog AS $$
BEGIN
  IF p_session IS NULL OR p_session !~ '^[A-Za-z0-9_-]{8,64}$' THEN
    RAISE EXCEPTION 'invalid runner session id' USING ERRCODE = '22023';
  END IF;
  RETURN 'browser:' || auth.uid()::text || ':' || p_session;
END $$;

CREATE OR REPLACE FUNCTION public.ds_claim_browser_jobs(p_tenant uuid, p_session text, p_kinds text[] DEFAULT NULL, p_limit int DEFAULT 1)
RETURNS SETOF public.craft_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_tag text;
BEGIN
  PERFORM public.ds__assert_member(p_tenant);
  v_tag := public.ds__browser_tag(p_session);
  RETURN QUERY
  UPDATE public.craft_jobs j SET status = 'running', claimed_by = v_tag, claimed_at = now(), heartbeat_at = now(), attempts = j.attempts + 1
   WHERE j.id IN (SELECT id FROM public.craft_jobs
                   WHERE tenant_id = p_tenant AND runner = 'browser' AND status = 'queued' AND run_after <= now()
                     AND (p_kinds IS NULL OR kind = ANY (p_kinds))
                   ORDER BY priority, run_after FOR UPDATE SKIP LOCKED LIMIT greatest(1, least(p_limit, 5)))
  RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION public.ds_heartbeat_browser_job(p_job uuid, p_session text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE n int;
BEGIN
  UPDATE public.craft_jobs SET heartbeat_at = now()
   WHERE id = p_job AND claimed_by = public.ds__browser_tag(p_session) AND status = 'running';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;     -- false => the job was reaped or cancelled; the tab must stop
END $$;

-- Output assets are written by the Next.js route /api/studio/jobs/[id]/output
-- (service key, after checking the claim). This RPC only accepts asset ids that
-- belong to the job's tenant, then reuses ds_finish_job's side effects.
CREATE OR REPLACE FUNCTION public.ds_finish_browser_job(p_job uuid, p_session text, p_ok boolean, p_output jsonb DEFAULT NULL, p_error text DEFAULT NULL)
RETURNS public.craft_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE j public.craft_jobs; v_tag text; v_asset uuid;
BEGIN
  v_tag := public.ds__browser_tag(p_session);
  SELECT * INTO j FROM public.craft_jobs WHERE id = p_job FOR UPDATE;
  IF j.id IS NULL OR j.claimed_by IS DISTINCT FROM v_tag OR j.status <> 'running' OR j.runner <> 'browser' THEN
    RAISE EXCEPTION 'job not running for this browser session' USING ERRCODE = '42501';
  END IF;
  PERFORM public.ds__assert_member(j.tenant_id);
  IF p_ok AND (p_output ->> 'asset_id') IS NOT NULL THEN
    v_asset := (p_output ->> 'asset_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.design_assets WHERE id = v_asset AND tenant_id = j.tenant_id) THEN
      RAISE EXCEPTION 'output asset does not belong to this workspace' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN public.ds_finish_job(p_job, v_tag, p_ok, p_output, left(p_error, 2000));
END $$;

-- 3. Grants ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ds__job_runner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ds__browser_tag(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ds__browser_tag(text) TO service_role;
REVOKE ALL ON FUNCTION public.ds_claim_browser_jobs(uuid, text, text[], int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ds_heartbeat_browser_job(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ds_finish_browser_job(uuid, text, boolean, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ds_claim_browser_jobs(uuid, text, text[], int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ds_heartbeat_browser_job(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ds_finish_browser_job(uuid, text, boolean, jsonb, text) TO authenticated, service_role;

COMMENT ON COLUMN public.craft_jobs.runner IS 'browser = staff render-station tab running Craft WASM; server = trusted server process (virus_scan)';

DO $$ BEGIN IF to_regprocedure('unify.done(text)') IS NOT NULL THEN PERFORM unify.done('605'); END IF; END $$;
COMMIT;
