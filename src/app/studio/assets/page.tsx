// Studio → Assets (T09). Staff-only library of internal assets stored in
// design-private, with an upload form. Images render through the staff
// stream route (/api/studio/assets/[assetId]) — never a signed URL.
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import { requireStaff } from '@/server/auth/requireStaff';
import { UploadForm } from './UploadForm';

interface AssetRow {
  id: string;
  kind: string;
  storage_path: string;
  bucket: string;
  mime_type: string | null;
  sha256: string | null;
  size_bytes: number | null;
  created_at: string;
}

export default async function StudioAssetsPage() {
  const { supabase, tenantId, role } = await requireStaff();
  const { data } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: AssetRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
  })
    .from('design_assets')
    .select('id,kind,storage_path,bucket,mime_type,sha256,size_bytes,created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  const assets = data ?? [];
  const isImage = (m: string | null) => !!m && m.startsWith('image/');

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold">Assets</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Internal files live in the private <code>design-private</code> bucket and stream through the staff route.
        Signed in as staff (role: {role}).
      </p>

      <section className="mt-6 rounded border p-4">
        <h2 className="font-semibold">Upload</h2>
        <UploadForm />
        <p className="mt-2 text-xs text-neutral-500">
          PNG, JPG, GIF, WebP, SVG, PDF or GLB, up to 100 MB. The file type is sniffed from its bytes; a
          thumbnail job is queued for images and appears here once the render station finishes it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Library ({assets.length})</h2>
        {assets.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No assets yet — upload one above.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="py-2 pr-3">Preview</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b align-middle">
                  <td className="py-2 pr-3">
                    {isImage(a.mime_type) ? (
                      <img
                        src={`/api/studio/assets/${a.id}`}
                        alt=""
                        className="h-12 w-12 rounded border object-cover"
                      />
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{a.kind}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{a.storage_path}</td>
                  <td className="py-2 pr-3">{a.mime_type ?? '—'}</td>
                  <td className="py-2 pr-3">{a.size_bytes ? `${(a.size_bytes / 1024).toFixed(1)} KB` : '—'}</td>
                  <td className="py-2 font-mono text-xs">{a.sha256 ? `${a.sha256.slice(0, 16)}…` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
