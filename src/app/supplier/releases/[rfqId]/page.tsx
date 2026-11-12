import Link from 'next/link';
import { requireSupplier } from '@/server/auth/requireSupplier';
import { loadRfq } from '@/server/actions/supplier-portal';
import { supplierAuthorizeRelease } from '@/lib/db';
import ReleaseDownload, { type ReleasePack } from '@/features/supplier/releases/ReleaseDownload';

// Supplier release page — T20 (supplier side).
// Each pack is authorized individually through supplier_authorize_release
// (grant + revocation + licence, per tech pack). A denied pack renders as
// denied — never as a link. The download itself mints a fresh signed URL
// (ttlSeconds 900) in the route handler, never here, and never at page
// load: the URL only exists inside the download POST response.

export default async function SupplierReleasePage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const { supabase } = await requireSupplier();
  const res = await loadRfq(rfqId);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not open releases: {res.error.message}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/supplier" className="text-blue-700 underline">
            Back to My RFQs
          </Link>
        </p>
      </main>
    );
  }
  const view = res.data;

  const packs: ReleasePack[] = [];
  for (const line of view.lines) {
    const { data, error } = await supplierAuthorizeRelease(supabase, { p_tech_pack: line.tech_pack.id });
    const row = data as unknown as { allowed?: boolean; reason?: string } | null;
    packs.push({
      techPackId: line.tech_pack.id,
      title: line.tech_pack.title,
      styleNumber: line.tech_pack.style_number,
      revision: line.tech_pack.revision,
      allowed: error ? false : row?.allowed === true,
      reason: error ? error.message : row?.reason,
    });
  }

  return (
    <main data-testid="supplier-releases" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href={`/supplier/rfqs/${rfqId}`} className="text-blue-700 underline">
          ← Back to {view.rfq.rfq_number}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">Production releases</h1>
      <p className="mt-2 text-neutral-600">
        {view.rfq.rfq_number} — {view.rfq.title}. Production packs are released to you only for the lines you
        were awarded. Each download uses a fresh 15-minute link and is recorded in the audit trail.
      </p>
      <div className="mt-6">
        <ReleaseDownload rfqId={rfqId} packs={packs} />
      </div>
    </main>
  );
}
