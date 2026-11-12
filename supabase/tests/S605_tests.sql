-- =====================================================================
-- S605_tests.sql — browser runner (WASM-first). Run right after S600_tests.sql
-- in the same throwaway database (reuses its users, tenants and t.* helpers).
-- =====================================================================
\set ON_ERROR_STOP 1
SET client_min_messages = warning;
DELETE FROM t.results;

SELECT t.act(t.get('O'));
SELECT t.put('J_MOCK', ds_enqueue_job(t.get('T1'), 'mockup_render', 'photocraft', '{"views":["front"]}', 'design', t.get('D'), 's605-mock')::text);
SELECT t.put('J_SCAN', ds_enqueue_job(t.get('T1'), 'virus_scan', 'clamav', '{}', 'rfq_file', gen_random_uuid(), 's605-scan')::text);
SELECT t.act(NULL);
UPDATE craft_jobs SET status = 'cancelled' WHERE tenant_id = t.get('T1') AND status = 'queued'
   AND id NOT IN (t.get('J_MOCK'), t.get('J_SCAN'));
SELECT t.ok('virus_scan is forced onto the server runner', (SELECT runner FROM craft_jobs WHERE id = t.get('J_SCAN')) = 'server');
SELECT t.ok('render jobs default to the browser runner', (SELECT runner FROM craft_jobs WHERE id = t.get('J_MOCK')) = 'browser');
UPDATE craft_jobs SET runner = 'browser' WHERE id = t.get('J_SCAN');
SELECT t.ok('virus_scan cannot be moved to the browser', (SELECT runner FROM craft_jobs WHERE id = t.get('J_SCAN')) = 'server');

-- outsiders
SELECT t.act(t.get('SU'));
SELECT t.denied('supplier cannot claim studio jobs', format($q$SELECT * FROM ds_claim_browser_jobs(%L, 'tab_supplier01')$q$, t.get('T1')), 'member');
SELECT t.act(t.get('X'));
SELECT t.denied('other fashion house cannot claim your jobs', format($q$SELECT * FROM ds_claim_browser_jobs(%L, 'tab_rival0001')$q$, t.get('T1')), 'member');
SELECT t.act(t.get('EVIL'));
SELECT t.denied('random user cannot claim jobs', format($q$SELECT * FROM ds_claim_browser_jobs(%L, 'tab_evil00001')$q$, t.get('T1')), 'member');
SELECT t.act(NULL);
SET ROLE anon;
SELECT t.denied('anon cannot call the browser runner', format($q$SELECT * FROM ds_claim_browser_jobs(%L, 'tab_anon00001')$q$, t.get('T1')), 'permission');
RESET ROLE;

-- staff render station
SELECT t.act(t.get('S'));
SELECT t.denied('session id is validated', format($q$SELECT * FROM ds_claim_browser_jobs(%L, 'bad id; drop')$q$, t.get('T1')), 'session');
DO $$
DECLARE n int; k text[];
BEGIN
  SELECT count(*), array_agg(kind) INTO n, k FROM ds_claim_browser_jobs(t.get('T1'), 'tab_staff0001', NULL, 5);
  PERFORM t.ok('staff tab claims the render job only', n = 1 AND k = ARRAY['mockup_render'], coalesce(array_to_string(k, ','), 'none'));
END $$;
SELECT t.ok('claim is tagged with user and tab',
  (SELECT claimed_by FROM craft_jobs WHERE id = t.get('J_MOCK')) = 'browser:' || t.get('S') || ':tab_staff0001');
SELECT t.ok('heartbeat works for the owning tab', ds_heartbeat_browser_job(t.get('J_MOCK'), 'tab_staff0001'));
SELECT t.ok('heartbeat refused for another tab', NOT ds_heartbeat_browser_job(t.get('J_MOCK'), 'tab_other0001'));

SELECT t.act(t.get('O'));
SELECT t.denied('another staff member cannot finish someone else''s job',
  format($q$SELECT ds_finish_browser_job(%L, 'tab_staff0001', true, '{}')$q$, t.get('J_MOCK')), 'browser session');

-- an asset from another workspace cannot be attached as output
SELECT t.act(NULL);
DO $$ DECLARE a uuid; BEGIN
  INSERT INTO design_assets(tenant_id, kind, storage_path, bucket, classification, mime_type)
  VALUES (t.get('T2'), 'mockup', t.get('T2') || '/designs/r.png', 'design-private', 'internal', 'image/png') RETURNING id INTO a;
  PERFORM t.put('ASSET_RIVAL', a::text);
END $$;
SELECT t.act(t.get('S'));
SELECT t.denied('cannot attach another workspace''s asset as output',
  format($q$SELECT ds_finish_browser_job(%L, 'tab_staff0001', true, jsonb_build_object('asset_id', %L::text))$q$, t.get('J_MOCK'), t.get('ASSET_RIVAL')), 'workspace');
SELECT t.ok('owning tab finishes the job',
  (ds_finish_browser_job(t.get('J_MOCK'), 'tab_staff0001', true, jsonb_build_object('asset_id', t.get('ASSET_INTERNAL')))).status = 'succeeded');

-- tab closed mid-job -> reaper requeues
SELECT t.act(t.get('O'));
SELECT t.put('J_VID', ds_enqueue_job(t.get('T1'), 'promo_video', 'filmcraft', '{}', 'design', t.get('D'), 's605-vid')::text);
SELECT count(*) FROM ds_claim_browser_jobs(t.get('T1'), 'tab_owner0001', ARRAY['promo_video'], 1);
SELECT t.act(NULL);
UPDATE craft_jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id = t.get('J_VID');
SELECT ds_reap_stale_jobs();
SELECT t.ok('closed tab: job goes back to the queue', (SELECT status FROM craft_jobs WHERE id = t.get('J_VID')) = 'queued');
SELECT t.ok('server worker RPCs still service-role only', NOT has_function_privilege('authenticated', 'ds_claim_jobs(text,text[],integer)', 'EXECUTE'));

SELECT count(*) AS s605_checks_passed FROM t.results WHERE ok;
