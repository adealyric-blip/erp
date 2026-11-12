export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (guard needs a request).

import Link from 'next/link';
import { requireSupplier } from '@/server/auth/requireSupplier';
import { loadMyRfqs } from '@/server/actions/supplier-portal';
import { toDay } from '@/features/supplier/dates';

// Supplier portal home ("My RFQs") — T18.
// The list shows the supplier ONLY their current RFQs: supplier_my_rfqs
// derives the vendor set from auth.uid() and excludes revoked invitations
// and draft RFQs. Nothing here is filtered client-side.

export default async function SupplierPage() {
  const { vendorIds } = await requireSupplier();
  const res = await loadMyRfqs();
  const rfqs = res.ok ? res.data : [];

  return (
    <main data-testid="supplier-portal" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">My RFQs</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as a supplier for {vendorIds.length} vendor{vendorIds.length === 1 ? '' : 's'}.
      </p>
      {!res.ok && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your RFQs: {res.error.message}
        </p>
      )}
      {res.ok && rfqs.length === 0 && (
        <p className="mt-6 rounded-md border bg-white px-4 py-3 text-sm text-neutral-600">
          No RFQs have been sent to you yet. New invitations arrive here — and only here.
        </p>
      )}
      <ul className="mt-6 space-y-2">
        {rfqs.map((r) => (
          <li key={r.rfq_id} data-testid="supplier-rfq-row" className="rounded-md border bg-white px-4 py-3">
            <Link href={`/supplier/rfqs/${r.rfq_id}`} className="font-medium text-blue-700 underline">
              {r.rfq_number} — {r.title}
            </Link>
            <span className="ml-3 text-sm text-neutral-500">
              {r.status} · invitation {r.invitation_status}
              {r.bid_deadline ? ` · bids due ${toDay(r.bid_deadline)}` : ''}
              {r.my_bid_status ? ` · your bid: ${r.my_bid_status}` : ''}
            </span>
            <span className="ml-3 text-sm">
              <Link href={`/supplier/releases/${r.rfq_id}`} className="text-blue-700 underline">
                Releases
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
