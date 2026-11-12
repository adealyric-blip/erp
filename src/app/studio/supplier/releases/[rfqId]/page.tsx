export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { getReleaseStatus, listAccessEvents, revokeSupplier, submitRelease } from '@/server/actions/revoke';
import StudioReleasePanel from '@/features/supplier/releases/StudioReleasePanel';

// Staff release overview — T20.
// One surface for the three staff-side release concerns: the release gate
// (approved pack + attached PDF), one-click revocation, and the access
// audit trail with CSV export for legal. No left rail: this page lives in
// the existing studio drawer system like every other studio page.

export default async function StudioSupplierReleasePage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  await requireStaff();
  const statusRes = await getReleaseStatus(rfqId);
  const auditRes = await listAccessEvents({ rfqId });

  if (!statusRes.ok) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load release status: {statusRes.error.message}
        </p>
      </main>
    );
  }

  return (
    <main data-testid="studio-supplier-releases" className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm">
        <Link href="/studio" className="text-blue-700 underline">
          ← Studio
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">Supplier releases</h1>
      <p className="mt-2 text-neutral-600">
        RFQ {rfqId}. After revocation, an open supplier tab gets 403 on its next image fetch or download — the
        denial shows in the audit trail below.
      </p>
      <div className="mt-6">
        <StudioReleasePanel
          status={statusRes.data}
          audit={auditRes.ok ? auditRes.data : { events: [], vendors: [], rfqs: [] }}
          onSubmitRelease={submitRelease}
          onRevoke={revokeSupplier}
        />
      </div>
    </main>
  );
}
