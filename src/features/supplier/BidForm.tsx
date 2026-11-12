'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BidPayload } from '@/lib/db/schemas';
import type { SupplierBid, SupplierRfqView } from './types';
import { toDay } from './dates';

// BidForm — T18. Autosaves the draft via supplier_save_bid (debounced
// 800 ms after the last edit) and submits via supplier_submit_bid.
// Rules enforced here AND in the DB (the RPC is the authority):
//  - viewer role cannot edit (RPC raises 42501);
//  - bidding closes at the RFQ deadline or when status != published;
//  - submit requires every line priced (RPC raises 23502 otherwise);
//  - revisions only if the RFQ allows them (supplier_save_bid decides).
// The form never shows target cost, other bids, or storage paths —
// supplier_get_rfq never returns them, and this form never asks for them.

export interface BidFormProps {
  rfq: SupplierRfqView['rfq'];
  lines: SupplierRfqView['lines'];
  myBid: SupplierBid | null;
  allowRevisions: boolean;
  onSaveDraft: (payload: unknown) => Promise<{ ok: boolean; error?: { message: string } }>;
  onSubmit: (bidId: string) => Promise<{ ok: boolean; error?: { message: string } }>;
  onWithdraw: (bidId: string) => Promise<{ ok: boolean; error?: { message: string } }>;
  /** Optional refresh hook (e.g. revalidate). The actions revalidate the path themselves. */
  onSaved?: () => void;
}

type LineEdit = { unit_price: string; moq: string; lead_time_days: string; sample_cost: string; tooling_cost: string; notes: string };

const emptyLine = (): LineEdit => ({ unit_price: '', moq: '', lead_time_days: '', sample_cost: '', tooling_cost: '', notes: '' });

export default function BidForm({ rfq, lines, myBid, allowRevisions, onSaveDraft, onSubmit, onWithdraw, onSaved }: BidFormProps) {
  const [edits, setEdits] = useState<Record<string, LineEdit>>(() => {
    const init: Record<string, LineEdit> = {};
    for (const l of lines) {
      const saved = myBid?.lines.find((b) => b.rfq_line_id === l.rfq_line_id);
      init[l.rfq_line_id] = saved
        ? {
            unit_price: String(saved.unit_price ?? ''),
            moq: String(saved.moq ?? ''),
            lead_time_days: String(saved.lead_time_days ?? ''),
            sample_cost: String(saved.sample_cost ?? ''),
            tooling_cost: String(saved.tooling_cost ?? ''),
            notes: saved.notes ?? '',
          }
        : emptyLine();
    }
    return init;
  });
  const [leadTime, setLeadTime] = useState(myBid?.lead_time_days != null ? String(myBid.lead_time_days) : '');
  const [validUntil, setValidUntil] = useState(myBid?.valid_until ? toDay(myBid.valid_until) : '');
  const [paymentTerms, setPaymentTerms] = useState(myBid?.payment_terms ?? '');
  const [notes, setNotes] = useState(myBid?.notes ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitted = myBid?.status === 'submitted';
  const closed = rfq.status !== 'published' || (rfq.bid_deadline != null && new Date(rfq.bid_deadline).getTime() <= Date.now());
  const readOnly = submitted || closed;

  const buildPayload = useCallback(() => {
    const payloadLines = lines
      .map((l) => {
        const e = edits[l.rfq_line_id] ?? emptyLine();
        if (e.unit_price === '') return null;
        return {
          rfq_line_id: l.rfq_line_id,
          unit_price: Number(e.unit_price),
          moq: e.moq === '' ? undefined : Number(e.moq),
          lead_time_days: e.lead_time_days === '' ? undefined : Number(e.lead_time_days),
          sample_cost: e.sample_cost === '' ? undefined : Number(e.sample_cost),
          tooling_cost: e.tooling_cost === '' ? undefined : Number(e.tooling_cost),
          notes: e.notes || undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      valid_until: validUntil || undefined,
      lead_time_days: leadTime === '' ? undefined : Number(leadTime),
      payment_terms: paymentTerms || undefined,
      incoterm: rfq.incoterm ?? undefined,
      notes: notes || undefined,
      lines: payloadLines,
    };
  }, [edits, lines, leadTime, validUntil, paymentTerms, notes, rfq.incoterm]);

  const saveDraft = useCallback(async () => {
    const payload = buildPayload();
    const parsed = BidPayload.safeParse(payload);
    if (!parsed.success) {
      setSaveState('error');
      setError(parsed.error.issues[0]?.message ?? 'Invalid bid values.');
      return;
    }
    setSaveState('saving');
    const res = await onSaveDraft(parsed.data);
    if (!res.ok) {
      setSaveState('error');
      setError(res.error?.message ?? 'Could not save the draft.');
      return;
    }
    setSaveState('saved');
    setError(null);
    onSaved?.();
  }, [buildPayload, onSaveDraft, onSaved]);

  // Autosave: debounce 800 ms after the last edit.
  useEffect(() => {
    if (readOnly) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveDraft(), 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [edits, leadTime, validUntil, paymentTerms, notes]);

  const pricedCount = lines.filter((l) => (edits[l.rfq_line_id]?.unit_price ?? '') !== '').length;

  async function submit() {
    if (!myBid) {
      await saveDraft();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSubmit(myBid.id);
    setBusy(false);
    if (!res.ok) setError(res.error?.message ?? 'Could not submit the bid.');
    else onSaved?.();
  }

  async function withdraw() {
    if (!myBid) return;
    setBusy(true);
    setError(null);
    const res = await onWithdraw(myBid.id);
    setBusy(false);
    if (!res.ok) setError(res.error?.message ?? 'Could not withdraw the bid.');
    else onSaved?.();
  }

  return (
    <section data-testid="bid-form" className="rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Your bid</h2>
      <p className="mt-1 text-sm text-neutral-600">
        {closed
          ? 'Bidding is closed for this RFQ.'
          : submitted
            ? `Bid revision ${myBid?.revision} submitted${myBid?.submitted_at ? ` on ${toDay(myBid.submitted_at)}` : ''}. ${allowRevisions ? 'Revisions are allowed — editing creates a new revision.' : 'Revisions are not allowed.'}`
            : 'Draft autosaves as you type. Price every line before submitting.'}
      </p>
      {myBid && (
        <p className="mt-1 text-xs text-neutral-500">
          Draft status: {myBid.status} · revision {myBid.revision}
          {myBid.total_amount != null ? ` · total ${myBid.total_amount} ${myBid.currency}` : ''}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {lines.map((l) => {
          const e = edits[l.rfq_line_id] ?? emptyLine();
          return (
            <div key={l.rfq_line_id} className="rounded-md border p-3">
              <p className="text-sm font-medium">
                Line {l.line_no} — {l.tech_pack.title} ({l.tech_pack.style_number ?? 'no style no.'}) · qty {l.quantity}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs">
                  Unit price ({rfq.currency}) *
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readOnly}
                    value={e.unit_price}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [l.rfq_line_id]: { ...e, unit_price: ev.target.value } }))}
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  MOQ
                  <input
                    type="number"
                    min={1}
                    step={1}
                    disabled={readOnly}
                    value={e.moq}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [l.rfq_line_id]: { ...e, moq: ev.target.value } }))}
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Lead time (days)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    disabled={readOnly}
                    value={e.lead_time_days}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [l.rfq_line_id]: { ...e, lead_time_days: ev.target.value } }))}
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Sample cost ({rfq.currency})
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readOnly}
                    value={e.sample_cost}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [l.rfq_line_id]: { ...e, sample_cost: ev.target.value } }))}
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Tooling cost ({rfq.currency})
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readOnly}
                    value={e.tooling_cost}
                    onChange={(ev) => setEdits((prev) => ({ ...prev, [l.rfq_line_id]: { ...e, tooling_cost: ev.target.value } }))}
                    className="rounded-md border px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          Overall lead time (days)
          <input
            type="number"
            min={1}
            step={1}
            disabled={readOnly}
            value={leadTime}
            onChange={(e) => setLeadTime(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Prices valid until (date)
          <input
            type="date"
            disabled={readOnly}
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Payment terms
          <input
            type="text"
            maxLength={200}
            disabled={readOnly}
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm"
            placeholder="e.g. 30% deposit"
          />
        </label>
      </div>
      <label className="mt-2 flex flex-col gap-1 text-xs">
        Notes to the buyer
        <textarea
          maxLength={4000}
          disabled={readOnly}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border px-2 py-1.5 text-sm"
          rows={2}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!readOnly && (
          <button
            type="button"
            onClick={() => void saveDraft()}
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Save draft
          </button>
        )}
        {!closed && !submitted && (
          <button
            type="button"
            disabled={busy || pricedCount < lines.length}
            onClick={() => void submit()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : `Submit bid (${pricedCount}/${lines.length} lines priced)`}
          </button>
        )}
        {submitted && !closed && (
          <button type="button" disabled={busy} onClick={() => void withdraw()} className="rounded-md border px-4 py-2 text-sm font-medium">
            Withdraw bid
          </button>
        )}
        <span data-testid="bid-save-state" className="text-xs text-neutral-500">
          {saveState === 'saving' ? 'Saving draft…' : saveState === 'saved' ? 'Draft saved' : saveState === 'error' ? 'Draft not saved' : ''}
        </span>
      </div>
    </section>
  );
}
