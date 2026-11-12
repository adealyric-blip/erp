// Storage path conventions — plan/02 §Storage buckets (T09).
// All studio buckets are private. Staff images are streamed via the staff
// route (src/app/api/studio/assets/[assetId]); no signed URLs are ever
// embedded in HTML.
export const DESIGN_PRIVATE_BUCKET = 'design-private';
export const SUPPLIER_PREVIEWS_BUCKET = 'supplier-previews';
export const SUPPLIER_UPLOADS_BUCKET = 'supplier-uploads';
export const PRODUCTION_RELEASES_BUCKET = 'production-releases';
export const LEGACY_PUBLIC_BUCKET = 'design-assets';

/** {tenant}/designs/{design}/{version}/{file} — plan/02. */
export function designVersionPath(
  tenantId: string,
  designId: string,
  versionNo: number,
  fileName: string,
): string {
  return `${tenantId}/designs/${designId}/${versionNo}/${sanitizeFileName(fileName)}`;
}

/** {tenant}/library/flats/{blank}/{view}.svg — generated / imported flats. */
export function libraryFlatPath(tenantId: string, blankId: string, view: string): string {
  return `${tenantId}/library/flats/${blankId}/${view}.svg`;
}

/** {tenant}/library/poms/{pomCode}/{file} — POM diagram uploads. */
export function pomDiagramPath(tenantId: string, pomCode: string, fileName: string): string {
  return `${tenantId}/library/poms/${pomCode}/${sanitizeFileName(fileName)}`;
}

/** {tenant}/library/materials/{code}/{file} — material swatch uploads. */
export function materialSwatchPath(tenantId: string, materialCode: string, fileName: string): string {
  return `${tenantId}/library/materials/${materialCode}/${sanitizeFileName(fileName)}`;
}

/** {tenant}/uploads/{assetId}-{file} — ad-hoc studio uploads. */
export function studioUploadPath(tenantId: string, fileName: string): string {
  return `${tenantId}/uploads/${sanitizeFileName(fileName)}`;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 120);
}

/** Tenant id from the first path segment (mirrors ds__path_tenant). */
export function pathTenantId(path: string): string | null {
  const first = path.split('/')[0];
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first) ? first : null;
}

/** Buckets that must never be served by a public URL. */
export function isPrivateBucket(bucket: string): boolean {
  return (
    bucket === DESIGN_PRIVATE_BUCKET ||
    bucket === SUPPLIER_PREVIEWS_BUCKET ||
    bucket === SUPPLIER_UPLOADS_BUCKET ||
    bucket === PRODUCTION_RELEASES_BUCKET
  );
}
