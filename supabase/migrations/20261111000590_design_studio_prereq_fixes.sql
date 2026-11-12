-- =====================================================================
-- S590_design_studio_prereq_fixes.sql   (canonical step 590)
-- Fixes found while loading the baseline into a clean Postgres 18 and
-- running every step file S100..S500. Run BEFORE S600. Idempotent.
--
--   1. platform_admins.user_id had FK -> portal_users(id) ON DELETE SET NULL.
--      user_id is the PRIMARY KEY and is compared to auth.uid() by
--      platform_is_admin(), so it must reference auth.users. The bad FK
--      makes it impossible to grant a platform admin.
--   2. design_files has two identical FKs to designs.
--   3. design_publications has duplicate FKs to designs and product_variants
--      (the composite (product_variant_id, tenant_id) FK is the correct one).
--   4. design_assets.tenant_id and projects.tenant_id are nullable; every
--      tenant table must be NOT NULL or RLS silently hides/leaks rows.
--   5. designs / projects / design_assets have updated_at but no trigger.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- step ledger (unify) ---------------------------------------------------
DO $$ BEGIN
  IF to_regclass('unify.step_order') IS NOT NULL THEN
    INSERT INTO unify.step_order(step, label, file, pos) VALUES
      ('590','ds0','S590_design_studio_prereq_fixes.sql',14),
      ('600','ds1','S600_design_studio_production.sql',15)
    ON CONFLICT (step) DO UPDATE SET label = excluded.label, file = excluded.file, pos = excluded.pos;
    UPDATE unify.step_order SET pos = 16 WHERE step = '900';
    PERFORM unify.require('590');
  END IF;
END $$;

-- 1. platform_admins FK --------------------------------------------------
ALTER TABLE public.platform_admins DROP CONSTRAINT IF EXISTS fk_platform_admins_user_id;
ALTER TABLE public.platform_admins
  ADD CONSTRAINT fk_platform_admins_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2/3. duplicate FKs -----------------------------------------------------
ALTER TABLE public.design_files        DROP CONSTRAINT IF EXISTS fk_design_files_design_id;
ALTER TABLE public.design_publications DROP CONSTRAINT IF EXISTS fk_design_publications_design_id;
ALTER TABLE public.design_publications DROP CONSTRAINT IF EXISTS fk_design_publications_product_variant_id;

-- 4. tenant_id NOT NULL (backfill first; orphans go to unify default tenant or fail loudly)
UPDATE public.design_assets a SET tenant_id = d.tenant_id
  FROM public.designs d WHERE a.tenant_id IS NULL AND a.design_id = d.id;
UPDATE public.design_assets a SET tenant_id = p.tenant_id
  FROM public.projects p WHERE a.tenant_id IS NULL AND a.project_id = p.id AND p.tenant_id IS NOT NULL;
UPDATE public.projects p SET tenant_id = (SELECT d.tenant_id FROM public.designs d WHERE d.project_id = p.id LIMIT 1)
  WHERE p.tenant_id IS NULL;
DO $$
DECLARE n_a int; n_p int;
BEGIN
  SELECT count(*) INTO n_a FROM public.design_assets WHERE tenant_id IS NULL;
  SELECT count(*) INTO n_p FROM public.projects WHERE tenant_id IS NULL;
  IF n_a > 0 OR n_p > 0 THEN
    RAISE EXCEPTION 'S590: % design_assets and % projects still have NULL tenant_id. Assign them (or delete) and re-run.', n_a, n_p;
  END IF;
END $$;
ALTER TABLE public.design_assets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.projects      ALTER COLUMN tenant_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_tenant_id_fk') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. updated_at triggers -------------------------------------------------
ALTER TABLE public.design_assets ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP TRIGGER IF EXISTS trg_designs_updated_at ON public.designs;
CREATE TRIGGER trg_designs_updated_at BEFORE UPDATE ON public.designs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_design_assets_updated_at ON public.design_assets;
CREATE TRIGGER trg_design_assets_updated_at BEFORE UPDATE ON public.design_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$ BEGIN IF to_regprocedure('unify.done(text)') IS NOT NULL THEN PERFORM unify.done('590'); END IF; END $$;
COMMIT;
