// Tech pack editor page — T13/T13b. Loads the live snapshot + lookups +
// server-rendered preview; when there is no live pack (demo route, or the
// database is unreachable from this VM) it renders the Boxy Tee fixture in
// demo mode so the 11-tab editor is still demonstrable.
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import { boxyTeeFixture } from '@/lib/techpack-render/fixture';
import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '@/features/techpack/types';
import TechPackEditor from '@/features/techpack/components/TechPackEditor';
import { requireStaff } from '@/server/auth/requireStaff';
import { getDemoTechPackPreview, getTechPackPreview, getTechPackSnapshot, listTechPackLookups } from '@/server/actions/techpacks';

function demoLookups(snapshot: TechPackSnapshot): TechPackLookups {
  const bom = snapshot.bom ?? [];
  return {
    materials: bom.map((b, i) => ({
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

export default async function TechPackEditorPage({ params }: { params: Promise<{ tpId: string }> }) {
  const { tpId } = await params;
  const isDemo = tpId === 'demo';

  if (isDemo) {
    const snapshot = boxyTeeFixture();
    const preview = await getDemoTechPackPreview();
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold">Tech pack — Boxy Tee (demo)</h1>
        <div className="mt-4">
          <TechPackEditor
            designId="00000000-0000-0000-0000-000000000002"
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

  // Live pack. requireStaff runs OUTSIDE the try/catch so its /login
  // redirect still fires — the auth guard is not disabled. Only a
  // Result failure (DB unreachable from this VM) falls back to the
  // fixture, labelled as demo.
  await requireStaff();
  const [snap, lookups, preview] = await Promise.all([
    getTechPackSnapshot(tpId),
    listTechPackLookups(),
    getTechPackPreview(tpId, 'internal'),
  ]);
  if (snap.ok && lookups.ok && preview.ok) {
      const designId = String((snap.data.design as Record<string, unknown> | undefined)?.id ?? '');
      return (
        <main className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-2xl font-bold">Tech pack — {String((snap.data.tech_pack as Record<string, unknown>)?.title ?? tpId)}</h1>
          <div className="mt-4">
            <TechPackEditor
              designId={designId}
              techPackId={tpId}
              initialSnapshot={snap.data}
              lookups={{
                materials: lookups.data.materials as unknown as TechPackLookups['materials'],
                poms: lookups.data.poms as unknown as TechPackLookups['poms'],
                seasons: lookups.data.seasons as unknown as TechPackLookups['seasons'],
                sizeRanges: lookups.data.sizeRanges as unknown as TechPackLookups['sizeRanges'],
                colorways: (snap.data.colorways ?? []) as unknown as TechPackLookups['colorways'],
                assets: lookups.data.assets as unknown as TechPackLookups['assets'],
              }}
              previewPages={preview.data.pages}
              validation={preview.data.validation}
              demoMode={false}
            />
          </div>
        </main>
      );
  }
  const snapshot = boxyTeeFixture();
  const demoPreview = await getDemoTechPackPreview();
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold">Tech pack — Boxy Tee (demo)</h1>
      <p className="mt-2 text-sm text-neutral-500">Live pack {tpId} could not be loaded from this environment — showing the demo fixture instead.</p>
      <div className="mt-4">
        <TechPackEditor
          designId="00000000-0000-0000-0000-000000000002"
          techPackId={null}
          initialSnapshot={snapshot}
          lookups={demoLookups(snapshot)}
          previewPages={demoPreview.pages}
          validation={demoPreview.validation}
          demoMode
        />
      </div>
    </main>
  );
}
