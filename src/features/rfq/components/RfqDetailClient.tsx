// RFQ detail — T17. Stepper, lines (internal target cost flagged),
// invitations with the NDA gate (award/release blocked until the NDA
// is accepted), the publish dialog with version pins, and the PO draft
// (JSONB array, embed budget). Award itself is T19; this page shows the
// gate state it will enforce.
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RfqStatusStepper } from './RfqStatusStepper';
import { PublishDialog, type PublishResult } from './PublishDialog';
import type { RfqDetail } from '@/server/actions/rfq';
import type { ChecklistItem, TechPackVersionPin } from '../lib/validation';
import { buildPoDraft, checkCarveOut, poDraftByteLength, poDraftFitsEmbed, RFQ_LINE_CAP } from '../lib/validation';

export function RfqDetailClient({
  detail,
  checklist,
  pins,
  onPublish,
  onClose,
  demo = false,
}: {
  detail: RfqDetail;
  checklist: ChecklistItem[];
  pins: TechPackVersionPin[];
  onPublish: () => Promise<PublishResult>;
  onClose: () => Promise<{ ok: boolean; error?: { message: string } }>;
  demo?: boolean;
}) {
  const { rfq, lines, invitations, ndaAcceptances } = detail;
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const acceptedVendorIds = new Set(ndaAcceptances.map((a) => String(a.vendor_id)));
  const carveOut = checkCarveOut(lines.map((l) => Number(l.quantity ?? 0)));
  const poDraft = buildPoDraft(
    lines.map((l) => ({
      id: String(l.id),
      techPackId: String(l.tech_pack_id),
      quantity: Number(l.quantity ?? 0),
      targetUnitCost: (l.target_unit_cost as number | null) ?? null,
    })),
  );
  const poFits = poDraftFitsEmbed(poDraft);

  const close = async () => {
    const res = await onClose();
    setCloseMsg(res.ok ? 'RFQ closed.' : res.error?.message ?? 'Could not close the RFQ');
  };

  return (
    <div data-testid="rfq-detail" className="space-y-6">
      {demo && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Demo — fixture data only. No RFQ state changes.
        </p>
      )}
      <RfqStatusStepper status={String(rfq.status ?? 'draft')} />

      {carveOut.needsCarveOut && (
        <div role="alert" data-testid="rfq2-carveout-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">RFQ2 carve-out — quantity exceeds the {RFQ_LINE_CAP}-unit RFQ cap</p>
          <p>Total quantity is {carveOut.totalQuantity}. Carve the excess out as a second RFQ (RFQ2).</p>
        </div>
      )}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-neutral-500">Bid deadline</dt><dd>{rfq.bid_deadline ? String(rfq.bid_deadline) : '—'}</dd></div>
        <div><dt className="text-neutral-500">Currency / incoterm</dt><dd>{String(rfq.currency ?? '')} / {String(rfq.incoterm ?? '—')}</dd></div>
        <div><dt className="text-neutral-500">Sealed</dt><dd>{rfq.sealed ? 'Yes' : 'No'}</dd></div>
        <div><dt className="text-neutral-500">NDA</dt><dd>{rfq.nda_id ? `Attached (${String(rfq.nda_id).slice(0, 8)}…)` : 'None — publish requires one'}</dd></div>
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Lines</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Tech pack</th>
              <th className="py-1 pr-2">Qty</th>
              <th className="py-1 pr-2">Size breakdown</th>
              <th className="py-1 pr-2">Est. unit cost (internal)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const tp = (l.tech_packs ?? l.tech_pack ?? {}) as Record<string, unknown>;
              return (
                <tr key={String(l.id)} className="border-b" data-testid={`rfq-line-row-${String(l.line_no)}`}>
                  <td className="py-1 pr-2">{String(l.line_no)}</td>
                  <td className="py-1 pr-2">{String(tp.title ?? l.tech_pack_id)} (rev {String(tp.revision ?? '?')}, {String(tp.status ?? '?')})</td>
                  <td className="py-1 pr-2">{String(l.quantity)}</td>
                  <td className="py-1 pr-2 font-mono text-xs">{JSON.stringify(l.size_breakdown ?? {})}</td>
                  <td className="py-1 pr-2">{l.target_unit_cost != null ? `${String(l.target_unit_cost)} (internal — never sent to suppliers)` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p data-testid="po-draft-status" className="mt-2 text-xs text-neutral-500">
          PO draft: {poDraft.length} row(s) as a JSONB array, {poDraftByteLength(poDraft)} bytes —{' '}
          {poFits ? 'fits the embed budget' : 'EXCEEDS the embed budget — split the RFQ before awarding'}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Invitations &amp; NDA gate</h2>
        <p className="text-sm text-neutral-600">
          An award or release requires the NDA to be accepted first — the vendor must sign the exact
          text shown (hash-checked by supplier_accept_nda). See T09 NDA upload / Suppliers → NDAs.
        </p>
        {invitations.length === 0 && <p className="mt-2 text-sm text-neutral-500">No suppliers invited yet.</p>}
        <ul className="mt-2 space-y-2">
          {invitations.map((inv) => {
            const vendor = (inv.acct_vendors ?? {}) as Record<string, unknown>;
            const accepted = acceptedVendorIds.has(String(inv.vendor_id));
            return (
              <li key={String(inv.id)} data-testid={`invitation-${String(inv.vendor_id)}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
                <span className="font-medium">{String(vendor.legal_name ?? inv.vendor_id)}</span>
                <span className="text-neutral-500">status: {String(inv.status)}</span>
                {accepted ? (
                  <span data-testid={`nda-accepted-${String(inv.vendor_id)}`} className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900">NDA accepted</span>
                ) : (
                  <span data-testid={`nda-pending-${String(inv.vendor_id)}`} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">NDA not accepted — award blocked</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        {String(rfq.status) === 'draft' && (
          <PublishDialog
            rfqTitle={String(rfq.title ?? '')}
            rfqNumber={String(rfq.rfq_number ?? '')}
            checklist={checklist}
            pins={pins}
            onPublish={onPublish}
            demo={demo}
          />
        )}
        {String(rfq.status) === 'published' && (
          <button type="button" data-testid="rfq-close" onClick={close}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm">
            Close RFQ
          </button>
        )}
        <Link href="/studio/rfqs" className="self-center text-sm text-blue-700 underline">← All RFQs</Link>
        {closeMsg && <p role="status" className="self-center text-sm text-neutral-700">{closeMsg}</p>}
      </div>
    </div>
  );
}
