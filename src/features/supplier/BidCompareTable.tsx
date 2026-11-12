'use client';

import { useMemo } from 'react';
import { normalizeWeights, scoreFactors, top3PerLine, weightedTotal, landedCostLine, type EvaluationWeights } from './scoring';
import { toDay } from './dates';
import type { BoardBid, BoardLine } from './bidBoardTypes';

// BidCompareTable — T19 PIVOT matrix.
//
// Rows are RFQ lines (PO rows); columns are suppliers. Each cell shows the
// top-3 suppliers per PO row only: a supplier appears in a cell only when
// they are among the three best for that line (ranked by weighted total,
// ties by lower landed cost). Every other cell is "—". The header row shows
// each supplier's weighted total; the footer shows their landed total
// across priced lines. All dates are wall-clock Y-m-d only.

export interface BidCompareTableProps {
  lines: BoardLine[];
  bids: BoardBid[];
  weights: Record<string, unknown> | null;
  currency: string;
}

interface Column {
  vendor_id: string;
  vendor_name: string;
  total: number;
  landed_total: number;
}

export default function BidCompareTable({ lines, bids, weights, currency }: BidCompareTableProps) {
  const normalized: EvaluationWeights = useMemo(() => normalizeWeights(weights), [weights]);

  const { columns, top3 } = useMemo(() => {
    const live = bids.filter((b) => b.status !== 'withdrawn' && b.status !== 'superseded');
    // Ranges are computed over the bids only — a 0 fallback here would
    // corrupt the scale (cheapest would score against 0, not the max).
    const priceMin = live.length ? Math.min(...live.map((b) => b.landed_total)) : 0;
    const priceMax = live.length ? Math.max(...live.map((b) => b.landed_total)) : 0;
    const leadValues = live.map((b) => b.lead_time_days).filter((v): v is number => v != null);
    const leadMin = leadValues.length ? Math.min(...leadValues) : 0;
    const leadMax = leadValues.length ? Math.max(...leadValues) : 0;
    const scored = new Map(
      live.map((b) => {
        const factors = scoreFactors(
          { bid_id: b.bid_id, vendor_id: b.vendor_id, landed_total: b.landed_total, lead_time_days: b.lead_time_days, quality: b.quality, compliance: b.compliance },
          { min: priceMin, max: priceMax },
          { min: leadMin, max: leadMax },
        );
        return [b.bid_id, { factors, ...weightedTotal(factors, normalized) }] as const;
      }),
    );
    const ranked = live.map((b) => ({
      bid_id: b.bid_id,
      vendor_id: b.vendor_id,
      total: scored.get(b.bid_id)?.total ?? 0,
      landed_total: b.landed_total,
    }));
    const bidsByLine: Record<string, string[]> = {};
    for (const l of lines) {
      bidsByLine[l.rfq_line_id] = live.filter((b) => b.lines.some((bl) => bl.rfq_line_id === l.rfq_line_id)).map((b) => b.bid_id);
    }
    const top3 = top3PerLine(ranked, bidsByLine);
    const inMatrix = new Set(Object.values(top3).flat().map((r) => r.bid_id));
    const columns: Column[] = live
      .filter((b) => inMatrix.has(b.bid_id))
      .map((b) => ({ vendor_id: b.vendor_id, vendor_name: b.vendor_name, total: scored.get(b.bid_id)?.total ?? 0, landed_total: b.landed_total }))
      .sort((a, b) => b.total - a.total || a.landed_total - b.landed_total);
    return { columns, top3 };
  }, [bids, lines, normalized]);

  if (bids.length === 0) {
    return <p className="text-sm text-neutral-500">No bids were submitted for this RFQ.</p>;
  }
  if (columns.length === 0) {
    return <p className="text-sm text-neutral-500">No priced bids to compare.</p>;
  }

  const bidByVendor = new Map(bids.map((b) => [b.vendor_id, b]));
  const lineById = new Map(lines.map((l) => [l.rfq_line_id, l]));

  return (
    <section data-testid="bid-compare-table">
      <h2 className="text-lg font-semibold">Bid comparison (top 3 per line)</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Ranked by weighted total (price {Math.round(normalized.price * 100)}%, lead time{' '}
        {Math.round(normalized.lead_time * 100)}%, quality {Math.round(normalized.quality * 100)}%, compliance{' '}
        {Math.round(normalized.compliance * 100)}%). Cells show unit price and landed cost; “—” means the supplier
        is not in the top 3 for that line.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-3">Line</th>
              {columns.map((c) => (
                <th key={c.vendor_id} className="py-2 pr-3">
                  {c.vendor_name}
                  <span className="block text-xs font-normal text-neutral-500">weighted {c.total.toFixed(2)} / 5</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const top = top3[l.rfq_line_id] ?? [];
              const topVendorIds = new Set(top.map((r) => r.vendor_id));
              return (
                <tr key={l.rfq_line_id} data-testid="bid-matrix-row" className="border-b">
                  <td className="py-2 pr-3 font-medium">
                    Line {l.line_no} — {l.tech_pack_title}
                    <span className="block text-xs font-normal text-neutral-500">qty {l.quantity}</span>
                  </td>
                  {columns.map((c) => {
                    const bid = bidByVendor.get(c.vendor_id);
                    const bl = bid?.lines.find((x) => x.rfq_line_id === l.rfq_line_id);
                    if (!topVendorIds.has(c.vendor_id) || !bl) return <td key={c.vendor_id} className="py-2 pr-3 text-neutral-400">—</td>;
                    const line = lineById.get(l.rfq_line_id);
                    const landed = landedCostLine({
                      rfq_line_id: l.rfq_line_id,
                      quantity: line?.quantity ?? 0,
                      unit_price: bl.unit_price,
                      tooling_cost: bl.tooling_cost,
                      sample_cost: bl.sample_cost,
                    });
                    return (
                      <td key={c.vendor_id} className="py-2 pr-3">
                        <span className="font-medium">
                          {bl.unit_price.toFixed(2)} {currency}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          landed {landed.toFixed(2)} {currency}
                          {bl.lead_time_days != null ? ` · ${bl.lead_time_days}d` : ''}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr data-testid="bid-matrix-totals" className="border-b font-medium">
              <td className="py-2 pr-3">Landed total</td>
              {columns.map((c) => (
                <td key={c.vendor_id} className="py-2 pr-3">
                  {c.landed_total.toFixed(2)} {currency}
                  <span className="block text-xs font-normal text-neutral-500">
                    valid until {toDay(bidByVendor.get(c.vendor_id)?.valid_until) || '—'}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
