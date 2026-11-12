// Tech pack template detail — T13b. Shows the template row, which of the
// 11 pages are on, and the validator output for the demo fixture (filled
// from the SVG masters, so a missing id here means the template lost it).
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/server/auth/requireStaff';
import { listTechPackTemplates } from '@/server/actions/techpacks';
import { getDemoTechPackPreview } from '@/server/actions/techpacks';
import { TEMPLATE_PAGES } from '@/lib/techpack-render/types';

export default async function TechPackTemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const templates = await listTechPackTemplates();
  const row = templates.ok ? templates.data.find((r) => String(r.id) === id) : undefined;
  if (!row) notFound();
  const preview = await getDemoTechPackPreview();
  const pagesOn: string[] = Array.isArray(row.pages) ? (row.pages as string[]) : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="techpack-template-detail">
      <p className="text-sm text-neutral-500"><Link href="/studio/library/techpack-templates" className="text-blue-700 underline">← Templates</Link></p>
      <h1 className="mt-2 text-3xl font-bold">{String(row.name ?? '')}</h1>
      <p className="mt-2 text-neutral-600">
        Version {String(row.version ?? 1)}{Boolean(row.is_default) ? ' · default template' : ''}
      </p>
      <h2 className="mt-6 text-lg font-semibold">Pages on this template</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {TEMPLATE_PAGES.map((p) => (
          <li key={p.id} className={pagesOn.includes(p.id) ? '' : 'text-neutral-400 line-through'}>
            {pagesOn.includes(p.id) ? '✓' : '✗'} {p.title}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Validator — demo fixture (Boxy Tee)</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Filled from the SVG masters. Missing ids mean the snapshot has no data for them (image slots
        need an asset attached; the optional ids — extra label, cards beyond the fixture&apos;s
        materials/colorways — are expected).
      </p>
      <div className="mt-2 text-sm">
        <p><span className="font-semibold">Missing data-field: </span>{preview.validation.missingFields.length === 0 ? 'none' : preview.validation.missingFields.join(', ')}</p>
        <p><span className="font-semibold">Missing data-slot: </span>{preview.validation.missingSlots.length === 0 ? 'none' : preview.validation.missingSlots.join(', ')}</p>
        <p><span className="font-semibold">Missing data-repeat: </span>{preview.validation.missingRepeats.length === 0 ? 'none' : preview.validation.missingRepeats.join(', ')}</p>
      </div>
      <p className="mt-4 text-sm text-neutral-500">
        Filled preview: {preview.pages.length} pages ({preview.pages.filter((p) => p.pageId === 'measurement_chart').length} measurement-chart pages — the 30-POM fixture spills onto a second page).
      </p>
    </main>
  );
}
