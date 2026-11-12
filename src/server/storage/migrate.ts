// Migration selection — T09. Which existing `design-assets` objects should
// be private, and where they go in design-private (plan/02 path convention).
// Pure functions: unit-tested here, driven by scripts/migrate-design-assets-private.ts.
import { DESIGN_PRIVATE_BUCKET, LEGACY_PUBLIC_BUCKET } from './paths';

export interface LegacyAsset {
  id: string;
  tenant_id: string | null;
  design_id: string | null;
  kind: string;
  bucket: string;
  storage_path: string;
  classification: string;
}

/** Kinds that are design IP even without a design link. */
const SENSITIVE_KINDS = new Set(['mockup', 'flat_sketch', 'techpack_pdf', 'pattern', 'model']);

/**
 * An asset should move to design-private when it sits in the legacy
 * `design-assets` bucket, is internal, and is either linked to a design
 * or is a sensitive kind (flat/mockup/tech-pack/pattern/model).
 * Supplier-facing classes and supplier uploads never match (they live in
 * their own buckets already, and the move must not touch them).
 */
export function shouldMigrateToPrivate(asset: LegacyAsset): boolean {
  if (asset.bucket !== LEGACY_PUBLIC_BUCKET) return false;
  if (asset.classification !== 'internal') return false;
  if (asset.design_id) return true;
  return SENSITIVE_KINDS.has(asset.kind);
}

/** Target path in design-private for a migrating asset. */
export function privatePathFor(asset: LegacyAsset): string | null {
  if (!asset.tenant_id) return null;
  const base = asset.storage_path.split('/').pop() ?? asset.storage_path;
  if (asset.design_id) {
    return `${asset.tenant_id}/designs/${asset.design_id}/1/${base}`;
  }
  return `${asset.tenant_id}/library/flats/migrated/${base}`;
}

export interface MigrationPlan {
  assetId: string;
  fromBucket: string;
  fromPath: string;
  toBucket: string;
  toPath: string;
}

export function planMigration(assets: LegacyAsset[]): MigrationPlan[] {
  const out: MigrationPlan[] = [];
  for (const a of assets) {
    if (!shouldMigrateToPrivate(a)) continue;
    const toPath = privatePathFor(a);
    if (!toPath) continue;
    out.push({ assetId: a.id, fromBucket: a.bucket, fromPath: a.storage_path, toBucket: DESIGN_PRIVATE_BUCKET, toPath });
  }
  return out;
}
