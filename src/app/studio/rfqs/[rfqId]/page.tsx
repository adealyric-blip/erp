// RFQ detail — T17. Staff only.
import { notFound } from 'next/navigation';
import { requireStaff } from '@/server/auth/requireStaff';
import { closeRfq, getRfq, getRfqPublishPreview, publishRfq } from '@/server/actions/rfq';
import { RfqDetailClient } from '@/features/rfq/components/RfqDetailClient';

export default async function RfqDetailPage({ params }: { params: Promise<{ rfqId: string }> }) {
  await requireStaff();
  const { rfqId } = await params;
  const [detail, preview] = await Promise.all([getRfq(rfqId), getRfqPublishPreview(rfqId)]);
  if (!detail.ok) notFound();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="rfq-detail-page">
      <h1 className="text-3xl font-bold">
        {String(detail.data.rfq.rfq_number ?? '')} — {String(detail.data.rfq.title ?? '')}
      </h1>
      <div className="mt-6">
        <RfqDetailClient
          detail={detail.data}
          checklist={preview.ok ? preview.data.checklist : []}
          pins={preview.ok ? preview.data.pins : []}
          onPublish={async () => {
            'use server';
            const r = await publishRfq(rfqId);
            return r.ok
              ? { ok: true as const, status: r.data.status, pins: r.data.pins }
              : { ok: false as const, error: r.error };
          }}
          onClose={async () => {
            'use server';
            const r = await closeRfq(rfqId);
            return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
          }}
        />
      </div>
      {!preview.ok && (
        <p role="alert" className="mt-4 text-sm text-red-700">Could not load the publish checklist.</p>
      )}
    </main>
  );
}
