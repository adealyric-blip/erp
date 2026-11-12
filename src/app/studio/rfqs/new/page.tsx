// New RFQ — T17. Staff only. `?designId=xx` pre-selects that design's
// approved/released tech pack as the first line.
import { requireStaff } from '@/server/auth/requireStaff';
import { createRfq, listApprovedTechPacks } from '@/server/actions/rfq';
import { getActiveNda, listSuppliers } from '@/server/actions/suppliers';
import { RfqBuilder } from '@/features/rfq/components/RfqBuilder';

export default async function NewRfqPage({ searchParams }: { searchParams: Promise<{ designId?: string }> }) {
  await requireStaff();
  const { designId } = await searchParams;
  const [packs, suppliers, nda] = await Promise.all([
    listApprovedTechPacks(designId ?? null),
    listSuppliers(),
    getActiveNda(),
  ]);
  const packRows = packs.ok ? packs.data : [];
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="rfq-new-page">
      <h1 className="text-3xl font-bold">New RFQ</h1>
      <p className="mt-2 text-neutral-600">
        Three sections: details, lines (approved/released packs only), suppliers (zone/capability
        filtered). Publishing is a separate step on the RFQ page, with the tech-pack version pin.
      </p>
      {!packs.ok && <p role="alert" className="mt-4 text-sm text-red-700">Could not load approved tech packs.</p>}
      {packs.ok && packRows.length === 0 && (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No approved or released tech packs with a watermarked preview
          {designId ? ' for this design' : ''} — approve a pack first (Tech Packs).
        </p>
      )}
      <div className="mt-6">
        <RfqBuilder
          packs={packRows.map((p) => ({
            id: p.id,
            title: p.title,
            styleNumber: p.styleNumber,
            status: p.status,
            revision: p.revision,
            sizes: p.sizes,
          }))}
          suppliers={suppliers.ok ? suppliers.data : []}
          activeNdaId={nda.ok && nda.data ? nda.data.id : null}
          initialPackId={designId && packRows.length > 0 ? packRows[0].id : null}
          onCreate={async (input) => {
            'use server';
            const r = await createRfq({
              title: input.title,
              bidDeadline: input.bidDeadline,
              currency: input.currency,
              incoterm: input.incoterm,
              sealed: input.sealed,
              shipToCountry: input.shipToCountry,
              lines: input.lines,
              vendorIds: input.vendorIds,
            });
            return r.ok ? { ok: true as const, rfqId: r.data.rfqId } : { ok: false as const, error: r.error };
          }}
        />
      </div>
    </main>
  );
}
