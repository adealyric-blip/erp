'use client';

import { useState } from 'react';
import type { BoardBid, BoardLine, PurchaseOrderLink } from './bidBoardTypes';

// AwardDialog — T19. Split awards per line: each RFQ line picks its own
// winning bid. Two hard gates, both shown in the UI and re-checked
// server-side in awardRfq:
//  1. the RFQ must be closed (ds_award_rfq requires status 'closed');
//  2. awards only if the NDA is accepted — a line whose chosen vendor has
//     no NDA acceptance for this RFQ is blocked with the reason shown.
// Award creates DRAFT POs only (links). Finance ledger work is PAUSED:
// this dialog posts nothing to any ledger and creates no finance tables.
// PO links point at the award panel on this compare page (#po-<id>):
// there is no dedicated ERP PO page in this repo yet (open item).

export interface AwardDialogProps {
  rfqId: string;
  rfqStatus: string;
  lines: BoardLine[];
  bids: BoardBid[];
  ndaAcceptedByVendor: Record<string, boolean>;
  onAward: (awards: Array<{ rfq_line_id: string; bid_id: string }>) => Promise<{
    ok: boolean;
    data?: PurchaseOrderLink[];
    error?: { message: string };
  }>;
  /** Optional refresh hook. The action revalidates the path itself. */
  onAwarded?: () => void;
}

export default function AwardDialog({ rfqId, rfqStatus, lines, bids, ndaAcceptedByVendor, onAward, onAwarded }: AwardDialogProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<PurchaseOrderLink[] | null>(null);

  const closed = rfqStatus === 'closed' || rfqStatus === 'awarded';
  const alreadyAwarded = rfqStatus === 'awarded';
  const awardable = bids.filter((b) => b.status === 'submitted' || b.status === 'shortlisted');

  function ndaBlocked(lineId: string): string | null {
    const bidId = selection[lineId];
    if (!bidId) return null;
    const bid = awardable.find((b) => b.bid_id === bidId);
    if (!bid) return null;
    if (!ndaAcceptedByVendor[bid.vendor_id]) {
      return `${bid.vendor_name} has not accepted the NDA for this RFQ — award is blocked for this line.`;
    }
    return null;
  }

  const anyBlocked = lines.some((l) => ndaBlocked(l.rfq_line_id) !== null);
  // Partial awards are legal (ds_award_rfq accepts any non-empty subset of
  // lines); a line left on "No award" simply stays unawarded.
  const anyChosen = lines.some((l) => selection[l.rfq_line_id]);

  async function award() {
    setBusy(true);
    setError(null);
    const awards = lines
      .filter((l) => selection[l.rfq_line_id])
      .map((l) => ({ rfq_line_id: l.rfq_line_id, bid_id: selection[l.rfq_line_id] as string }));
    const res = await onAward(awards);
    setBusy(false);
    if (!res.ok) {
      setError(res.error?.message ?? 'Award failed.');
      return;
    }
    setPos(res.data ?? []);
    onAwarded?.();
  }

  if (pos) {
    return (
      <section data-testid="award-result" className="rounded-lg border border-green-300 bg-green-50 p-5">
        <h2 className="text-lg font-semibold">Awarded — draft purchase orders created</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Draft POs only. No ledger posting (finance work is paused). Open a PO to review it before it is sent.
        </p>
        <ul className="mt-3 space-y-2">
          {pos.map((po) => (
            <li key={po.po_id} data-testid="po-link-row" className="rounded-md border bg-white px-4 py-3 text-sm">
              <a id={`po-${po.po_id}`} href={`#po-${po.po_id}`} className="font-medium text-blue-700 underline">
                PO {po.po_number}
              </a>
              <span className="ml-3 text-neutral-600">
                {po.status} {po.total != null ? `· total ${po.total.toFixed(2)}` : ''}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <a href={`/studio/rfqs/${rfqId}/compare`} className="text-blue-700 underline">
            Back to the bid board
          </a>
        </p>
      </section>
    );
  }

  return (
    <section data-testid="award-dialog" className="rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Award (split per line)</h2>
      {!closed && (
        <p className="mt-1 text-sm text-amber-800">
          The RFQ must be closed before awarding. Close it first, then pick a winner per line.
        </p>
      )}
      {alreadyAwarded && <p className="mt-1 text-sm text-neutral-600">This RFQ is already awarded.</p>}
      {awardable.length === 0 && <p className="mt-1 text-sm text-neutral-500">No submitted bids to award.</p>}
      <div className="mt-4 space-y-3">
        {lines.map((l) => {
          const options = awardable.filter((b) => b.lines.some((bl) => bl.rfq_line_id === l.rfq_line_id));
          const blocked = ndaBlocked(l.rfq_line_id);
          return (
            <div key={l.rfq_line_id} className="rounded-md border bg-white px-4 py-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Line {l.line_no} — {l.tech_pack_title} (qty {l.quantity})
                <select
                  value={selection[l.rfq_line_id] ?? ''}
                  disabled={!closed || alreadyAwarded}
                  onChange={(e) => setSelection((s) => ({ ...s, [l.rfq_line_id]: e.target.value }))}
                  className="mt-1 rounded-md border px-2 py-1.5 font-normal"
                >
                  <option value="">No award for this line</option>
                  {options.map((b) => (
                    <option key={b.bid_id} value={b.bid_id}>
                      {b.vendor_name} — {b.lines.find((bl) => bl.rfq_line_id === l.rfq_line_id)?.unit_price.toFixed(2)} · rev{' '}
                      {b.revision} ({b.status})
                    </option>
                  ))}
                </select>
              </label>
              {blocked && <p className="mt-1 text-sm text-red-700">{blocked}</p>}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        disabled={!closed || alreadyAwarded || !anyChosen || anyBlocked || busy}
        onClick={() => void award()}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Awarding…' : 'Award selected lines'}
      </button>
      {!anyChosen && closed && !alreadyAwarded && (
        <p className="mt-2 text-xs text-neutral-500">Pick a winner for at least one line. Lines left on “No award” stay unawarded.</p>
      )}
    </section>
  );
}
