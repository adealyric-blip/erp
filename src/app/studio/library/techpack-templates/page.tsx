// Tech pack templates library — T13b. Lists the tenant's templates and
// ensures the default 11-page master exists (S615 seed note: template rows
// are per-tenant, created on first visit, SVG masters live in
// src/lib/techpack-render/templates).
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { ensureDefaultTechPackTemplate, listTechPackTemplates } from '@/server/actions/techpacks';
import { TEMPLATE_PAGES } from '@/lib/techpack-render/types';

export default async function TechPackTemplatesPage() {
  await requireStaff();
  const ensured = await ensureDefaultTechPackTemplate();
  const templates = await listTechPackTemplates();
  const rows = templates.ok ? templates.data : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="techpack-templates-list">
      <h1 className="text-3xl font-bold">Tech pack templates</h1>
      <p className="mt-2 text-neutral-600">
        The 11-page master template. The renderer fills it from the tech pack snapshot; the validator
        lists any missing <code>data-field</code> / <code>data-slot</code> / <code>data-repeat</code> ids.
      </p>
      {!ensured.ok && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Default template could not be ensured ({ensured.error?.message ?? 'unknown error'}) — the SVG masters still live in src/lib/techpack-render/templates.
        </p>
      )}
      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={String(r.id)} className="rounded-md border border-neutral-300 bg-white px-4 py-3">
            <Link href={`/studio/library/techpack-templates/${String(r.id)}`} className="font-medium text-blue-700 underline">
              {String(r.name ?? '')} (v{String(r.version ?? 1)})
            </Link>
            {Boolean(r.is_default) && <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs text-white">Default</span>}
            <span className="ml-3 text-sm text-neutral-500">{Array.isArray(r.pages) ? (r.pages as string[]).length : 0} pages on</span>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-semibold">The 11 pages</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
        {TEMPLATE_PAGES.map((p) => (
          <li key={p.id}><span className="font-medium text-neutral-900">{p.title}</span> — {p.file}</li>
        ))}
      </ol>
    </main>
  );
}
