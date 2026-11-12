// Tech pack editor — ColorwayMatrix (T13b): component x colorway colour
// matrix (S615 tech_pack_colorway_components) + colourway renders.
'use client';

import type { TechPackSnapshot } from '@/lib/techpack-render/types';
import type { TechPackLookups } from '../types';

export default function ColorwayMatrix(props: {
  snapshot: TechPackSnapshot;
  lookups: TechPackLookups;
  locked: boolean;
  onUpsertColorwayComponent: (row: Record<string, unknown>) => void;
}) {
  const { snapshot, lookups, locked, onUpsertColorwayComponent } = props;
  const colorways = snapshot.colorways ?? [];
  const bom = snapshot.bom ?? [];
  const components = (snapshot.colorway_components ?? []) as Record<string, unknown>[];

  const entryFor = (bomLineId: string, colorwayId: string) =>
    components.find((c) => String(c.bom_line_id ?? '') === String(bomLineId) && String(c.colorway_id ?? '') === String(colorwayId));

  return (
    <section data-testid="techpack-colorways">
      <div className="mb-3 flex flex-wrap gap-3">
        {colorways.map((c) => (
          <div key={String(c.id)} className="flex items-center gap-2 rounded border border-neutral-300 px-2 py-1 text-sm">
            <span className="inline-block h-5 w-5 rounded-sm border border-neutral-300" style={{ background: String(c.garment_color_hex ?? c.hex ?? '#eee') }} />
            <span className="font-medium">{String(c.name ?? '')}</span>
            <span className="text-xs text-neutral-500">{String(c.garment_color_hex ?? c.hex ?? '')}</span>
            <span className="text-xs text-neutral-500">{Array.isArray(c.pantone_codes) ? (c.pantone_codes as string[])[0] ?? '' : ''}</span>
          </div>
        ))}
        {colorways.length === 0 && <p className="text-sm text-neutral-500">No colorways on this design yet.</p>}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-neutral-500">
            <th className="py-1 pr-2">Component</th>
            {colorways.map((c) => (<th key={String(c.id)} className="py-1 pr-2">{String(c.name ?? '')}</th>))}
          </tr>
        </thead>
        <tbody>
          {bom.map((b) => (
            <tr key={String(b.id)} className="border-b">
              <td className="py-1 pr-2">{String(b.description ?? '')}</td>
              {colorways.map((c) => {
                const entry = entryFor(String(b.id ?? ''), String(c.id ?? ''));
                return (
                  <td key={String(c.id)} className="py-1 pr-2">
                    <input
                      className="w-28 rounded border border-neutral-300 px-1 py-0.5"
                      placeholder="colour / Pantone"
                      value={String(entry?.color_name ?? '')}
                      disabled={locked}
                      onChange={(e) => onUpsertColorwayComponent({ ...(entry ?? {}), bom_line_id: b.id, colorway_id: c.id, color_name: e.target.value })}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500">
        Matrix source: tech_pack_colorway_components — a colourway from another design is rejected by the S615 guard.
        {lookups.colorways.length > 0 && ` Design colorways: ${lookups.colorways.map((c) => c.name).join(', ')}.`}
      </p>
    </section>
  );
}
