// Tech pack — open-or-create for a design (T13b switcher target).
// The design module's Tech Packs switcher lands here with a designId:
// create the pack (ds_create_tech_pack, auth-guarded) and redirect to its
// editor. When creation fails (no session → /login via requireStaff; no
// live database from this VM) the demo fixture editor renders instead,
// labelled as demo.
import { redirect } from 'next/navigation';
import { requireStaff } from '@/server/auth/requireStaff';
import { createTechPack, getDemoTechPackPreview } from '@/server/actions/techpacks';
import { boxyTeeFixture } from '@/lib/techpack-render/fixture';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '@/features/techpack/types';
import TechPackEditor from '@/features/techpack/components/TechPackEditor';

function demoLookups(snapshot: TechPackSnapshot): TechPackLookups {
  return {
    materials: (snapshot.bom ?? []).map((b, i) => ({
      id: String(b.material_id ?? `mat-${i}`),
      code: String(b.material_code ?? ''),
      name: String(b.description ?? ''),
      kind: String(b.kind ?? 'fabric'),
      composition: String(b.composition ?? ''),
      weight_gsm: b.weight_gsm === undefined ? null : Number(b.weight_gsm),
    })),
    poms: (snapshot.pom_library ?? []).map((p, i) => ({
      id: String(p.id ?? `pom-${i}`),
      code: String(p.code ?? ''),
      name: String(p.name ?? ''),
      how_to_measure: String(p.how_to_measure ?? ''),
    })),
    seasons: [{ id: 'ss27', code: 'SS27', name: 'Spring Summer 27' }],
    sizeRanges: [{ id: 'sr-1', name: 'Unisex XS-XL', sizes: ['XS', 'S', 'M', 'L', 'XL'], base_size: 'M' }],
    colorways: (snapshot.colorways ?? []).map((c) => ({
      id: String(c.id ?? ''),
      name: String(c.name ?? ''),
      garment_color_hex: String(c.garment_color_hex ?? c.hex ?? ''),
      pantone_codes: Array.isArray(c.pantone_codes) ? (c.pantone_codes as string[]) : [],
    })),
    assets: [],
  };
}

export default async function NewTechPackPage({ searchParams }: { searchParams: Promise<{ designId?: string }> }) {
  const { designId } = await searchParams;
  await requireStaff();
  if (!designId) redirect('/studio/techpacks/demo');
  const created = await createTechPack(designId);
  if (created.ok) redirect(`/studio/techpacks/${created.data}`);
  const snapshot = boxyTeeFixture();
  const preview = await getDemoTechPackPreview();
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Tech pack — Boxy Tee (demo)</h1>
      <p className="mt-2 text-sm text-neutral-500">
        A live pack could not be created for this design here ({created.error?.message ?? 'unknown error'}) — showing the demo fixture instead.
      </p>
      <div className="mt-4">
        <TechPackEditor
          designId={designId}
          techPackId={null}
          initialSnapshot={snapshot}
          lookups={demoLookups(snapshot)}
          previewPages={preview.pages}
          validation={preview.validation}
          demoMode
        />
      </div>
    </main>
  );
}
