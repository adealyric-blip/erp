import Link from 'next/link';
import { awardRfq, loadBidBoard } from '@/server/actions/supplier-portal';
import BidBoard from '@/features/supplier/BidBoard';
import BidCompareTable from '@/features/supplier/BidCompareTable';
import ScoreCard from '@/features/supplier/ScoreCard';
import AwardDialog from '@/features/supplier/AwardDialog';
import { normalizeWeights, scoreFactors, weightedTotal, type FactorScores } from '@/features/supplier/scoring';

// Staff bid board — T19. No left rail: this page lives in the existing
// studio drawer system like every other studio page.
// Sealed: the loader reads NO bid rows at all — only the invitation-status
// count — so no number can leak through the page. Unsealed: the PIVOT
// matrix (top 3 per line), per-bid score cards (4 weighted factors) and
// the split-award dialog. Awards only if the NDA is accepted (enforced in
// awardRfq); award creates draft-PO links only — finance ledger work is
// PAUSED, nothing here posts to a ledger.

export default async function ComparePage({ params }: { params: Promise<{ rfqId: string }> }) {
  const { rfqId } = await params;
  const res = await loadBidBoard(rfqId);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not open the bid board: {res.error.message}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/studio" className="text-blue-700 underline">
            ← Studio
          </Link>
        </p>
      </main>
    );
  }
  const data = res.data;
  const weights = normalizeWeights(data.rfq.evaluation_weights);

  // Per-bid factor scores for the score cards (same math as the matrix).
  const live = data.bids.filter((b) => b.status !== 'withdrawn' && b.status !== 'superseded');
  const priceRange = {
    min: live.length ? Math.min(...live.map((b) => b.landed_total)) : 0,
    max: live.length ? Math.max(...live.map((b) => b.landed_total)) : 0,
  };
  const leadValues = live.map((b) => b.lead_time_days).filter((v): v is number => v != null);
  const leadRange = { min: leadValues.length ? Math.min(...leadValues) : 0, max: leadValues.length ? Math.max(...leadValues) : 0 };
  const scored = new Map<string, { factors: FactorScores; total: number; scored: Array<keyof FactorScores> }>(
    live.map((b) => {
      const factors = scoreFactors(
        { bid_id: b.bid_id, vendor_id: b.vendor_id, landed_total: b.landed_total, lead_time_days: b.lead_time_days, quality: b.quality, compliance: b.compliance },
        priceRange,
        leadRange,
      );
      return [b.bid_id, { factors, ...weightedTotal(factors, weights) }] as const;
    }),
  );

  return (
    <main data-testid="bid-board-page" className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-sm">
        <Link href="/studio" className="text-blue-700 underline">
          ← Studio
        </Link>
      </p>
      <div className="mt-2">
        <BidBoard data={data}>
          <BidCompareTable lines={data.lines} bids={data.bids} weights={data.rfq.evaluation_weights} currency={data.rfq.currency} />

          <section>
            <h2 className="text-lg font-semibold">Scores (4 weighted factors)</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {[...live]
                .sort((a, b) => (scored.get(b.bid_id)?.total ?? 0) - (scored.get(a.bid_id)?.total ?? 0))
                .map((b) => {
                  const s = scored.get(b.bid_id);
                  if (!s) return null;
                  return (
                    <ScoreCard
                      key={b.bid_id}
                      vendorName={b.vendor_name}
                      bidStatus={b.status}
                      currency={b.currency}
                      landedTotal={b.landed_total}
                      leadTimeDays={b.lead_time_days}
                      factors={s.factors}
                      total={s.total}
                      scoredFactors={s.scored}
                      weights={weights}
                    />
                  );
                })}
            </div>
          </section>

          <AwardDialog
            rfqId={rfqId}
            rfqStatus={data.rfq.status}
            lines={data.lines}
            bids={data.bids}
            ndaAcceptedByVendor={data.ndaAcceptedByVendor}
            onAward={awardRfq.bind(null, rfqId)}
          />

          {data.purchaseOrders.length > 0 && (
            <section data-testid="po-links" className="rounded-lg border p-5">
              <h2 className="text-lg font-semibold">Draft purchase orders</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Created by the award. Draft only — no ledger posting (finance work is paused). There is no
                dedicated ERP PO page in this repo yet, so each PO opens its award record on this page.
              </p>
              <ul className="mt-3 space-y-2">
                {data.purchaseOrders.map((po) => (
                  <li key={po.po_id} className="rounded-md border bg-white px-4 py-3 text-sm">
                    <a id={`po-${po.po_id}`} href={`#po-${po.po_id}`} className="font-medium text-blue-700 underline">
                      PO {po.po_number}
                    </a>
                    <span className="ml-3 text-neutral-600">
                      {po.status}
                      {po.total != null ? ` · total ${po.total.toFixed(2)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.awards.length > 0 && (
            <p className="text-sm text-neutral-600">
              Awarded {data.awards.length} line{data.awards.length === 1 ? '' : 's'}.
            </p>
          )}
        </BidBoard>
      </div>
    </main>
  );
}
