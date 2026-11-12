// RFQ list — T17. Staff only.
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { listRfqs } from '@/server/actions/rfq';

export default async function RfqsPage() {
  await requireStaff();
  const rows = await listRfqs();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="rfqs-page">
      <h1 className="text-3xl font-bold">RFQs</h1>
      <p className="mt-2 text-neutral-600">
        Requests for quote, built from approved or released tech packs. Publishing pins each line to
        its tech-pack snapshot version; an award or release additionally requires the NDA accepted.
      </p>
      <p className="mt-3">
        <Link href="/studio/rfqs/new" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
          New RFQ
        </Link>
      </p>
      {rows.ok && rows.data.length === 0 && (
        <p className="mt-6 rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
          No RFQs yet. Build one from an approved tech pack — the Tech Packs page offers only “RFQ”,
          no email/print/export alternative.
        </p>
      )}
      {!rows.ok && (
        <p role="alert" className="mt-6 text-sm text-red-700">Could not load RFQs.</p>
      )}
      <ul className="mt-6 space-y-2">
        {(rows.ok ? rows.data : []).map((r) => (
          <li key={r.id} className="rounded-md border border-neutral-300 bg-white px-4 py-3">
            <Link href={`/studio/rfqs/${r.id}`} className="font-medium text-blue-700 underline">
              {r.rfqNumber} — {r.title}
            </Link>
            <span className="ml-3 text-sm text-neutral-500">
              {r.status} · bids due {r.bidDeadline ? r.bidDeadline.slice(0, 16).replace('T', ' ') : '—'} · {r.currency}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
