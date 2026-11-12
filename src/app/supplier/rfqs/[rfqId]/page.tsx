export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (guard needs a request).

import Link from 'next/link';
import { requireSupplier } from '@/server/auth/requireSupplier';
import { acceptNda, loadNda, loadRfq, saveBid, submitBid, withdrawBid } from '@/server/actions/supplier-portal';
import NdaGate from '@/features/supplier/NdaGate';
import BidForm from '@/features/supplier/BidForm';
import RfqDetail from '@/features/supplier/RfqDetail';
import SecurePreview from '@/features/supplier/SecurePreview';
import SecurePdfViewer from '@/features/supplier/SecurePdfViewer';
import { toDay } from '@/features/supplier/dates';

// Supplier RFQ view — T18.
// Gate order is deliberate: requireSupplier (portal member or 404) →
// supplier_get_rfq (invitation + revocation, minimised payload) →
// supplier_get_nda (accepted? show the gate). Previews and the bid form
// only render once the NDA is accepted, because the authorize RPCs deny
// everything until then. Deadlines render as wall-clock Y-m-d only.

export default async function SupplierRfqPage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  await requireSupplier();
  const res = await loadRfq(rfqId);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not open this RFQ: {res.error.message}
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
  const ndaRes = await loadNda(rfqId);
  const nda = ndaRes.ok ? ndaRes.data : null;
  const ndaAccepted = nda?.accepted === true;
  const questionsClosed =
    view.rfq.status !== 'published' ||
    (view.rfq.questions_deadline != null && new Date(view.rfq.questions_deadline).getTime() <= Date.now());

  return (
    <main data-testid="supplier-rfq" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/supplier" className="text-blue-700 underline">
          ← My RFQs
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        {view.rfq.rfq_number} — {view.rfq.title}
      </h1>
      <p className="mt-2 text-neutral-600">
        Status {view.rfq.status} · {view.rfq.currency}
        {view.rfq.incoterm ? ` · ${view.rfq.incoterm}` : ''}
        {view.rfq.bid_deadline ? ` · bids due ${toDay(view.rfq.bid_deadline)}` : ''}
        {view.rfq.target_delivery_date ? ` · target delivery ${toDay(view.rfq.target_delivery_date)}` : ''}
        {view.rfq.ship_to ? ` · ship to ${view.rfq.ship_to}` : ''}
      </p>
      {view.production_release && (
        <p className="mt-3 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm">
          You were awarded work on this RFQ — the production pack is on the{' '}
          <Link href={`/supplier/releases/${rfqId}`} className="text-blue-700 underline">
            releases page
          </Link>
          .
        </p>
      )}

      {!ndaAccepted && nda && (
        <div className="mt-6">
          <NdaGate rfqId={rfqId} nda={nda} onAccept={acceptNda} />
        </div>
      )}
      {!ndaAccepted && !nda && (
        <p className="mt-6 rounded-md border px-4 py-3 text-sm text-neutral-600">
          The NDA for this RFQ could not be loaded ({ndaRes.ok ? '' : ndaRes.error.message}). Previews and
          bidding stay locked until the NDA is accepted.
        </p>
      )}

      {ndaAccepted && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="text-lg font-semibold">Lines</h2>
            <ul className="mt-2 space-y-2">
              {view.lines.map((l) => (
                <li key={l.rfq_line_id} className="rounded-md border bg-white px-4 py-3 text-sm">
                  <p className="font-medium">
                    Line {l.line_no} — {l.tech_pack.title} ({l.tech_pack.style_number ?? 'no style no.'}) rev{' '}
                    {l.tech_pack.revision} · qty {l.quantity}
                  </p>
                  {l.notes && <p className="mt-1 text-neutral-600">{l.notes}</p>}
                  {l.colorway && (
                    <p className="mt-1 text-neutral-500">
                      Colourway {l.colorway.name}
                      {l.colorway.garment_color_hex ? ` · ${l.colorway.garment_color_hex}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Previews</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Watermarked previews only — no storage URLs, no downloads from this viewer.
            </p>
            <div className="mt-3 space-y-4">
              {view.lines.flatMap((l) => l.tech_pack.preview_images).map((img) => (
                <SecurePreview
                  key={img.asset_id}
                  rfqId={rfqId}
                  assetId={img.asset_id}
                  surface={img.surface}
                  width={img.width}
                  height={img.height}
                />
              ))}
              {view.lines
                .filter((l) => l.tech_pack.preview_asset_id)
                .map((l) => (
                  <SecurePdfViewer
                    key={l.tech_pack.id}
                    rfqId={rfqId}
                    assetId={l.tech_pack.preview_asset_id as string}
                    title={`${l.tech_pack.title} — tech-pack preview`}
                  />
                ))}
              {view.lines.every((l) => l.tech_pack.preview_images.length === 0 && !l.tech_pack.preview_asset_id) && (
                <p className="text-sm text-neutral-500">No previews attached yet.</p>
              )}
            </div>
          </section>

          <BidForm
            rfq={view.rfq}
            lines={view.lines}
            myBid={view.my_bid}
            allowRevisions={view.rfq.allow_bid_revisions}
            onSaveDraft={saveBid.bind(null, rfqId)}
            onSubmit={submitBid}
            onWithdraw={withdrawBid}
          />

          {view.questions.length > 0 && (
            <section className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Questions &amp; answers</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {view.questions.map((q) => (
                  <li key={q.id} className="rounded-md border bg-white px-3 py-2">
                    <p>
                      {q.mine ? 'You asked: ' : 'Q: '}
                      {q.question}
                    </p>
                    {q.answer ? (
                      <p className="mt-1 text-neutral-600">
                        A{q.answered_at ? ` (${toDay(q.answered_at)})` : ''}: {q.answer}
                      </p>
                    ) : (
                      <p className="mt-1 text-neutral-500">Awaiting answer.</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RfqDetail rfqId={rfqId} questionsClosed={questionsClosed} declined={false} />
        </div>
      )}
    </main>
  );
}
