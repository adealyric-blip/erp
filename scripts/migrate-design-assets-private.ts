// migrate-design-assets-private.ts — T09 migration script.
// Moves existing `design-assets` objects that should be private into
// design-private, and updates their design_assets rows (bucket + path).
// Selection + target paths live in src/server/storage/migrate.ts (unit-tested).
//
// Run:  node scripts/migrate-design-assets-private.ts [--dry-run] [--apply]
//        [--tenant <uuid>] [--limit <n>]
//   Default is --dry-run: lists what would move, changes nothing.
//   --apply copies each object (download + upload), updates the row, and
//   leaves the legacy object in place (delete it only after verifying the
//   new copy — the script prints the legacy paths it left behind).
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (local Supabase or a
// throwaway project — never the live project).
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[++i] ?? 'true');
}
const apply = args.has('apply');
const tenantFilter = args.get('tenant') ?? null;
const limit = Number(args.get('limit') ?? 500);

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }
  // Bundle the (pure-TS) migration helpers — Node strip-types cannot load
  // extensionless relative imports, so esbuild first (same as seed-flats).
  const bundle = join(tmpdir(), `migrate-helpers-${process.pid}.mjs`);
  execFileSync(join(REPO, 'node_modules', '.bin', 'esbuild'), [
    join(REPO, 'src', 'server', 'storage', 'migrate.ts'),
    '--bundle',
    '--format=esm',
    '--platform=node',
    `--outfile=${bundle}`,
  ], { stdio: 'inherit' });
  const { planMigration } = (await import(bundle)) as {
    planMigration: (assets: Array<Record<string, unknown>>) => Array<{
      assetId: string; fromBucket: string; fromPath: string; toBucket: string; toPath: string;
    }>;
  };
  const { createClient } = (await import('@supabase/supabase-js')) as typeof import('@supabase/supabase-js');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let query = admin
    .from('design_assets')
    .select('id,tenant_id,design_id,kind,bucket,storage_path,classification')
    .eq('bucket', 'design-assets')
    .eq('classification', 'internal')
    .is('deleted_at', null)
    .limit(limit);
  if (tenantFilter) query = query.eq('tenant_id', tenantFilter);
  const { data: assets, error } = await query;
  if (error) throw new Error(`asset list failed: ${error.message}`);
  const plan = planMigration((assets ?? []) as Array<Record<string, unknown>>);
  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${plan.length} asset(s) to move (of ${(assets ?? []).length} legacy internal rows scanned)`);
  for (const p of plan) console.log(`  ${p.assetId}  ${p.fromBucket}/${p.fromPath}  ->  ${p.toBucket}/${p.toPath}`);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to move them. Legacy objects are left in place either way.');
    return;
  }
  let moved = 0;
  for (const p of plan) {
    const dl = await admin.storage.from(p.fromBucket).download(p.fromPath);
    if (dl.error || !dl.data) {
      console.error(`  SKIP ${p.assetId}: download failed: ${dl.error?.message ?? 'no data'}`);
      continue;
    }
    const up = await admin.storage.from(p.toBucket).upload(p.toPath, dl.data, { upsert: true });
    if (up.error) {
      console.error(`  SKIP ${p.assetId}: upload failed: ${up.error.message}`);
      continue;
    }
    const upd = await admin.from('design_assets').update({ bucket: p.toBucket, storage_path: p.toPath }).eq('id', p.assetId);
    if (upd.error) {
      console.error(`  SKIP ${p.assetId}: row update failed: ${upd.error.message}`);
      continue;
    }
    moved++;
    console.log(`  MOVED ${p.assetId}`);
  }
  console.log(`Moved ${moved}/${plan.length}. Legacy objects were NOT deleted — verify the new copies, then remove the legacy ones.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
