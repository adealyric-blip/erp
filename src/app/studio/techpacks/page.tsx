// Tech packs list — T13. Staff only (requireStaff redirects to /login).
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { listTechPacks } from '@/server/actions/techpacks';

export default async function TechPacksPage() {
  await requireStaff();
  const packs = await listTechPacks();
  const rows = packs.ok ? packs.data : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="techpacks-list">
      <h1 className="text-3xl font-bold">Tech packs</h1>
      <p className="mt-2 text-neutral-600">
        Eleven pages per style — sketch, construction, measurement guide and chart, BOM, materials,
        colorways, artwork, labels, hang tag, packaging. Approving a pack locks it and renders the
        internal PDF and the watermarked supplier preview.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        <Link href="/studio/techpacks/demo" className="text-blue-700 underline">Open the demo pack (Boxy Tee fixture)</Link>
        {' '}— the 11-tab editor with live template preview, no sign-in required for the demo.
      </p>
      {rows.length === 0 && (
        <p className="mt-6 rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
          No tech packs yet. Create one from a design (ds_create_tech_pack) — the editor will appear here.
        </p>
      )}
      <ul className="mt-6 space-y-2">
        {rows.map((r) => (
          <li key={String(r.id)} className="rounded-md border border-neutral-300 bg-white px-4 py-3">
            <Link href={`/studio/techpacks/${String(r.id)}`} className="font-medium text-blue-700 underline">
              {String(r.style_number ?? '')} — {String(r.title ?? '')}
            </Link>
            <span className="ml-3 text-sm text-neutral-500">
              REV {String(r.revision ?? 1)} · {String(r.status ?? '')} · base {String(r.base_size ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
