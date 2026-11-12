// Flats library (T10b) — grid with license badges, Generate flat,
// Import licensed flat, and license records. Every flat carries a license:
// Owned / Licensed / Printful only / Unlicensed.
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { listRows, str } from '../_lib';
import { GenerateFlatForm } from './GenerateFlatForm';
import { ImportFlatForm } from './ImportFlatForm';
import { LicenseForm } from './LicenseForm';

const TEMPLATE_COLS = 'id,name,category,views,print_areas,license_scope,license_id,generator_version,created_at';

export function LicenseBadge({ scope }: { scope: string }) {
  const map: Record<string, string> = {
    owned: 'bg-green-100 text-green-800',
    licensed: 'bg-blue-100 text-blue-800',
    printful_only: 'bg-amber-100 text-amber-800',
    unlicensed: 'bg-neutral-200 text-neutral-700',
  };
  const label: Record<string, string> = {
    owned: 'Owned',
    licensed: 'Licensed',
    printful_only: 'Printful only',
    unlicensed: 'Unlicensed',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${map[scope] ?? map.unlicensed}`}>
      {label[scope] ?? scope}
    </span>
  );
}

export default async function FlatsPage() {
  const { supabase, tenantId, role } = await requireStaff();
  const templates = await listRows(supabase, 'ds_garment_templates', TEMPLATE_COLS, tenantId);
  const licenses = await listRows(
    supabase,
    'ds_asset_licenses',
    'id,source,license_type,license_name,license_url,allow_supplier_view,allow_redistribution,restricted_to_vendor_id,expires_at',
    tenantId,
  );
  const batches = await listRows(
    supabase,
    'ds_flat_import_batches',
    'id,source_category,status,strategy,piece_count,created_at',
    tenantId,
  );
  const isAdmin = role === 'owner' || role === 'admin';

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / Flats
      </p>
      <h1 className="mt-1 text-2xl font-bold">Flats</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Every flat has a license record. Owned flats work everywhere; Printful-only flats are blocked from
        RFQs, supplier previews and production release (DS_LICENSE_BLOCKED).
      </p>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded border p-4">
          <h2 className="font-semibold">Generate flat</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Parametric flat from a core blank (flat-gen). Saved as an owned template with print areas.
          </p>
          <GenerateFlatForm />
        </div>
        <div className="rounded border p-4">
          <h2 className="font-semibold">Import licensed flat</h2>
          <p className="mt-1 text-xs text-neutral-500">
            AI / EPS / PDF / SVG bundle (VecFashion, FashionDesign411…). A license record is required;
            conversion to SVG runs in VectorCraft (Lane C bridge) — the batch queues until then.
          </p>
          <ImportFlatForm
            licenses={licenses.map((l) => ({
              id: String(l.id),
              label: `${str(l, 'license_name') || str(l, 'source')} — ${str(l, 'license_type')}`,
            }))}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Flats grid ({templates.length})</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <article key={String(t.id)} className="rounded border p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{str(t, 'name')}</h3>
                <LicenseBadge scope={str(t, 'license_scope') || 'unlicensed'} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {str(t, 'category')} · {Array.isArray(t.views) ? (t.views as string[]).join(', ') : ''}
                {str(t, 'generator_version') ? ` · ${str(t, 'generator_version')}` : ''}
              </p>
              <p className="mt-2 text-xs">
                <Link href={`/studio/library/templates?edit=${String(t.id)}`} className="underline">
                  Open in templates
                </Link>
              </p>
            </article>
          ))}
          {templates.length === 0 && <p className="text-sm text-neutral-500">No flats yet — generate one above.</p>}
        </div>
      </section>

      {batches.length > 0 && (
        <section className="mt-8">
          <h2 className="font-semibold">Import batches ({batches.length})</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-neutral-500">
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Strategy</th>
                <th className="py-2 pr-3">Pieces</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={String(b.id)} className="border-b">
                  <td className="py-2 pr-3">{str(b, 'source_category') || '—'}</td>
                  <td className="py-2 pr-3">{str(b, 'status')}</td>
                  <td className="py-2 pr-3">{str(b, 'strategy') || '—'}</td>
                  <td className="py-2 pr-3">{typeof b.piece_count === 'number' ? b.piece_count : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-8 rounded border p-4">
        <h2 className="font-semibold">License records ({licenses.length})</h2>
        {isAdmin ? (
          <LicenseForm />
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Only owners and admins write license records. Ask one to add a record before importing a licensed flat.
          </p>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {licenses.map((l) => (
            <li key={String(l.id)}>
              <span className="font-mono text-xs">{str(l, 'license_type')}</span> —{' '}
              {str(l, 'license_name') || str(l, 'source')}
              {str(l, 'license_url') ? (
                <>
                  {' '}
                  (<a href={str(l, 'license_url')} target="_blank" rel="noreferrer" className="underline">terms</a>)
                </>
              ) : null}
              {l.allow_supplier_view ? '' : ' · staff-only'}
              {typeof l.expires_at === 'string' ? ` · expires ${l.expires_at.slice(0, 10)}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
