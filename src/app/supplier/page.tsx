import { requireSupplier } from '@/server/auth/requireSupplier';

/**
 * Supplier portal home ("My RFQs") — minimal placeholder for T04. The real
 * portal lands in T18; this page exists so the T04 guards have a route to
 * protect (and to 404 for staff who are not portal members).
 */
export default async function SupplierPage() {
  const { vendorIds } = await requireSupplier();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">My RFQs</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as a supplier for {vendorIds.length} vendor{vendorIds.length === 1 ? '' : 's'}.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        The supplier portal (RFQ list, NDA gate, bids) lands in Phase 4 (T18).
      </p>
    </main>
  );
}
