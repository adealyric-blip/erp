// RfqBuilder — T17. Three sections: (1) Details, (2) Lines, (3) Suppliers.
//
// - Lines only come from approved/released tech packs (the `packs` prop
//   is pre-filtered server-side; the builder re-checks status per line).
// - Size breakdown must sum to the line quantity (JSONB size_breakdown).
// - Estimated unit cost is INTERNAL (target_unit_cost) — never sent to
//   suppliers; the builder shows the estimated line/RFQ totals for staff.
// - Qty over the 100-unit cap shows the RFQ2 carve-out banner.
// - Supplier selection is zone/capability filtered (zones from
//   `acct_vendors.metadata.zones`; no ad-hoc grants table).
// - The PO draft is a JSONB array and must fit the embed budget.
// - The live publish checklist previews the `ds_publish_rfq` checks;
//   the actual publish (with version pins) happens on the RFQ page.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  buildPoDraft,
  checkCarveOut,
  computePublishChecklist,
  estimatedLineTotal,
  estimatedRfqTotal,
  poDraftByteLength,
  poDraftFitsEmbed,
  sizeBreakdownError,
  validateRfqLine,
  RFQ_LINE_CAP,
  type RfqLineInput,
} from '../lib/validation';
import { filterSuppliers, type SupplierListRow } from '@/features/suppliers/lib/validation';
import { ISO_COUNTRY_CODES } from '@/features/suppliers/lib/validation';

export interface ApprovedPackOption {
  id: string;
  title: string;
  styleNumber?: string | null;
  status: string;
  revision: number;
  sizes: string[];
}

export interface CreateRfqInput {
  title: string;
  bidDeadline: string | null;
  currency: string;
  incoterm: string | null;
  sealed: boolean;
  shipToCountry: string | null;
  lines: RfqLineInput[];
  vendorIds: string[];
}

export interface CreateRfqResult {
  ok: boolean;
  rfqId?: string;
  error?: { message: string; hint?: string };
}

const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

const DEMO_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

interface DraftLine {
  key: string;
  techPackId: string;
  quantity: number;
  sizeBreakdown: Record<string, number>;
  targetUnitCost: string;
  notes: string;
}

let keySeq = 0;
const nextKey = () => `line-${++keySeq}-${Date.now()}`;

export function RfqBuilder({
  packs,
  suppliers,
  activeNdaId,
  initialPackId,
  demo = false,
  onCreate,
}: {
  packs: ApprovedPackOption[];
  suppliers: SupplierListRow[];
  activeNdaId: string | null;
  initialPackId?: string | null;
  demo?: boolean;
  onCreate: (input: CreateRfqInput) => Promise<CreateRfqResult>;
}) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [bidDeadline, setBidDeadline] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [incoterm, setIncoterm] = useState('');
  const [sealed, setSealed] = useState(true);
  const [shipToCountry, setShipToCountry] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialPackId
      ? [{ key: nextKey(), techPackId: initialPackId, quantity: 0, sizeBreakdown: {}, targetUnitCost: '', notes: '' }]
      : [],
  );
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateRfqResult | null>(null);
  const [creating, setCreating] = useState(false);

  const packById = useMemo(() => new Map(packs.map((p) => [p.id, p])), [packs]);

  const draftLines: RfqLineInput[] = useMemo(
    () =>
      lines.map((l) => {
        const pack = packById.get(l.techPackId);
        return {
          techPackId: l.techPackId,
          techPackTitle: pack?.title,
          techPackStatus: pack?.status,
          quantity: l.quantity,
          sizeBreakdown: l.sizeBreakdown,
          targetUnitCost: l.targetUnitCost === '' ? null : Number(l.targetUnitCost),
          notes: l.notes || null,
        };
      }),
    [lines, packById],
  );

  const carveOut = useMemo(() => checkCarveOut(draftLines.map((l) => l.quantity)), [draftLines]);

  const filteredSuppliers = useMemo(
    () => filterSuppliers(suppliers, { zone: shipToCountry || null, capability: capabilityFilter || null }),
    [suppliers, shipToCountry, capabilityFilter],
  );

  const poDraft = useMemo(
    () =>
      buildPoDraft(
        draftLines.map((l, i) => ({
          id: `draft-${i + 1}`,
          techPackId: l.techPackId,
          quantity: l.quantity,
          targetUnitCost: l.targetUnitCost,
        })),
      ),
    [draftLines],
  );
  const poBytes = poDraftByteLength(poDraft);
  const poFits = poDraftFitsEmbed(poDraft);

  const checklist = useMemo(
    () =>
      computePublishChecklist({
        status: 'draft',
        bidDeadline: bidDeadline || null,
        ndaId: activeNdaId,
        lines: draftLines.map((l) => ({
          techPackId: l.techPackId,
          techPackStatus: l.techPackStatus,
          hasPreview: true, // packs prop is pre-filtered to approved/released WITH a preview
        })),
        inviteCount: vendorIds.length,
        pins: [], // pinned at publish time, on the RFQ page
      }),
    [bidDeadline, activeNdaId, draftLines, vendorIds],
  );

  const lineErrors = useMemo(() => draftLines.map((l) => validateRfqLine(l)), [draftLines]);
  const allLinesValid = lines.length > 0 && lineErrors.every((e) => e.length === 0);

  const capabilities = useMemo(
    () => [...new Set(suppliers.flatMap((s) => s.capabilities.map((c) => c.category)))].sort(),
    [suppliers],
  );

  const addLine = () =>
    setLines([...lines, { key: nextKey(), techPackId: '', quantity: 0, sizeBreakdown: {}, targetUnitCost: '', notes: '' }]);

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const setSizeQty = (key: string, size: string, value: string) => {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    const next = { ...line.sizeBreakdown };
    const n = value === '' ? 0 : Number(value);
    if (Number.isNaN(n)) return;
    next[size] = n;
    updateLine(key, { sizeBreakdown: next });
  };

  const create = async () => {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Give the RFQ a title first.');
      setStep(1);
      return;
    }
    if (!allLinesValid) {
      setFormError('Fix the line errors before creating the RFQ.');
      setStep(2);
      return;
    }
    if (vendorIds.length === 0) {
      setFormError('Invite at least one supplier — publishing requires ≥ 1 invite.');
      setStep(3);
      return;
    }
    setCreating(true);
    try {
      const res = await onCreate({
        title: title.trim(),
        bidDeadline: bidDeadline || null,
        currency,
        incoterm: incoterm || null,
        sealed,
        shipToCountry: shipToCountry || null,
        lines: draftLines,
        vendorIds,
      });
      setCreated(res);
      if (!res.ok) setFormError(res.error?.message ?? 'Could not create the RFQ');
    } finally {
      setCreating(false);
    }
  };

  const stepBtn = (n: number, label: string) => (
    <button
      type="button"
      data-testid={`builder-step-${n}`}
      data-state={step === n ? 'current' : step > n ? 'done' : 'upcoming'}
      onClick={() => setStep(n)}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        step === n ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-600'
      }`}
    >
      {n}. {label}
    </button>
  );

  return (
    <div data-testid="rfq-builder" className="space-y-6">
      {demo && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Demo — fixture data only. The RFQ is not created.
        </p>
      )}

      <div className="flex flex-wrap gap-2" aria-label="Builder sections">
        {stepBtn(1, 'Details')}
        {stepBtn(2, 'Lines')}
        {stepBtn(3, 'Suppliers')}
      </div>

      {carveOut.needsCarveOut && (
        <div role="alert" data-testid="rfq2-carveout-banner"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">RFQ2 carve-out — quantity exceeds the {RFQ_LINE_CAP}-unit RFQ cap</p>
          <p>
            Total quantity is {carveOut.totalQuantity}
            {carveOut.overCapLines.length > 0 &&
              `; line(s) ${carveOut.overCapLines.join(', ')} exceed ${RFQ_LINE_CAP} units each`}.
            Carve the excess out as a second RFQ (RFQ2) instead of inflating this one.
          </p>
        </div>
      )}

      {step === 1 && (
        <section data-testid="builder-section-details" className="space-y-4">
          <h2 className="text-lg font-semibold">1 · Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-title">Title *</label>
              <input id="rfq-title" data-testid="rfq-title" value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-deadline">Bid deadline *</label>
              <input id="rfq-deadline" data-testid="rfq-deadline" type="datetime-local" value={bidDeadline}
                onChange={(e) => setBidDeadline(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
              <p className="mt-1 text-xs text-neutral-500">Publishing requires a deadline at least 1 hour away.</p>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-currency">Currency</label>
              <select id="rfq-currency" data-testid="rfq-currency" value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
                {['USD', 'EUR', 'GBP', 'CNY'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-incoterm">Incoterm</label>
              <select id="rfq-incoterm" data-testid="rfq-incoterm" value={incoterm}
                onChange={(e) => setIncoterm(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
                <option value="">—</option>
                {INCOTERMS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-ship-to">Ship-to country (zone filter)</label>
              <select id="rfq-ship-to" data-testid="rfq-ship-to" value={shipToCountry}
                onChange={(e) => setShipToCountry(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
                <option value="">All countries</option>
                {ISO_COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                Supplier selection in step 3 is filtered to vendors declaring this zone.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input id="rfq-sealed" data-testid="rfq-sealed" type="checkbox" checked={sealed}
                onChange={(e) => setSealed(e.target.checked)} />
              <label className="text-sm font-medium" htmlFor="rfq-sealed">Sealed bids (suppliers cannot see each other)</label>
            </div>
          </div>
          <p className="text-sm text-neutral-600">
            NDA: {activeNdaId ? 'an active NDA is attached to new RFQs (ds_create_rfq)' : 'no active NDA — activate one in Suppliers → NDAs before publishing.'}
          </p>
          <button type="button" data-testid="builder-next-1" onClick={() => setStep(2)}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">Continue to lines →</button>
        </section>
      )}

      {step === 2 && (
        <section data-testid="builder-section-lines" className="space-y-4">
          <h2 className="text-lg font-semibold">2 · Lines</h2>
          <p className="text-sm text-neutral-600">
            Lines only come from approved or released tech packs — the picker lists nothing else.
            The Tech Packs page offers only “RFQ” as the outbound action: no email, print, or export alternative.
          </p>
          {lines.length === 0 && (
            <p className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
              No lines yet. Add a line from an approved or released tech pack.
            </p>
          )}
          {lines.map((line, i) => {
            const pack = packById.get(line.techPackId);
            const errs = lineErrors[i] ?? [];
            const sbErr = sizeBreakdownError(draftLines[i]);
            const lineTotal = estimatedLineTotal(draftLines[i]);
            return (
              <article key={line.key} data-testid={`rfq-line-${i + 1}`}
                className="space-y-3 rounded-md border border-neutral-300 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Line {i + 1}</h3>
                  <button type="button" aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                    className="text-sm text-red-700 underline">Remove</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm" htmlFor={`line-pack-${i}`}>Tech pack *</label>
                    <select id={`line-pack-${i}`} data-testid={`line-pack-${i}`} value={line.techPackId}
                      onChange={(e) => {
                        const p = packById.get(e.target.value);
                        updateLine(line.key, { techPackId: e.target.value, sizeBreakdown: p ? Object.fromEntries(p.sizes.map((s) => [s, 0])) : {} });
                      }}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
                      <option value="">Choose an approved pack…</option>
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.styleNumber ? `${p.styleNumber} — ` : ''}{p.title} (rev {p.revision}, {p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm" htmlFor={`line-qty-${i}`}>Quantity *</label>
                    <input id={`line-qty-${i}`} data-testid={`line-qty-${i}`} type="number" min={1}
                      value={line.quantity || ''} onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                  </div>
                  <div>
                    <label className="text-sm" htmlFor={`line-cost-${i}`}>Estimated unit cost ({currency}) — internal</label>
                    <input id={`line-cost-${i}`} data-testid={`line-cost-${i}`} type="number" min={0} step="0.01"
                      value={line.targetUnitCost} onChange={(e) => updateLine(line.key, { targetUnitCost: e.target.value })}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm" />
                    <p className="mt-1 text-xs text-neutral-500">Never sent to suppliers.</p>
                  </div>
                </div>
                {pack && (
                  <div>
                    <span className="text-sm font-medium">Size breakdown — must sum to {line.quantity}</span>
                    <div className="mt-1 flex flex-wrap gap-2" data-testid={`line-sizes-${i}`}>
                      {(pack.sizes.length > 0 ? pack.sizes : DEMO_SIZES).map((size) => (
                        <label key={size} className="flex items-center gap-1 text-sm">
                          {size}
                          <input data-testid={`line-size-${i}-${size}`} type="number" min={0}
                            value={line.sizeBreakdown[size] ?? 0}
                            onChange={(e) => setSizeQty(line.key, size, e.target.value)}
                            className="w-16 rounded-md border border-neutral-300 px-1 py-0.5 text-sm" />
                        </label>
                      ))}
                    </div>
                    {sbErr && <p role="alert" className="mt-1 text-sm text-red-700">{sbErr}</p>}
                  </div>
                )}
                {lineTotal != null && (
                  <p className="text-sm text-neutral-600">Estimated line total: {currency} {lineTotal.toFixed(2)} (internal)</p>
                )}
                {errs.length > 0 && (
                  <ul role="alert" className="text-sm text-red-700">
                    {errs.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" data-testid="line-add" onClick={addLine}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">Add line</button>
            <button type="button" data-testid="builder-next-2" onClick={() => setStep(3)}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">Continue to suppliers →</button>
          </div>
          {estimatedRfqTotal(draftLines) != null && (
            <p data-testid="rfq-estimated-total" className="text-sm font-medium">
              Estimated RFQ total (internal): {currency} {estimatedRfqTotal(draftLines)!.toFixed(2)}
            </p>
          )}
          <p data-testid="po-draft-status" className="text-xs text-neutral-500">
            PO draft: {poDraft.length} row(s) as a JSONB array, {poBytes} bytes —{' '}
            {poFits ? `fits the ${8 * 1024}-byte embed budget` : 'EXCEEDS the embed budget — split the RFQ before awarding'}.
          </p>
        </section>
      )}

      {step === 3 && (
        <section data-testid="builder-section-suppliers" className="space-y-4">
          <h2 className="text-lg font-semibold">3 · Suppliers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="rfq-capability-filter">Capability filter</label>
              <select id="rfq-capability-filter" data-testid="rfq-capability-filter" value={capabilityFilter}
                onChange={(e) => setCapabilityFilter(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm">
                <option value="">All capabilities</option>
                {capabilities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <p className="self-end text-sm text-neutral-600" data-testid="supplier-filter-count">
              {filteredSuppliers.length} of {suppliers.length} suppliers match
              {shipToCountry ? ` zone ${shipToCountry}` : ''}
              {capabilityFilter ? ` + ${capabilityFilter}` : ''}.
            </p>
          </div>
          {filteredSuppliers.length === 0 && (
            <p className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
              No suppliers match the zone/capability filter. Vendors with no zones declared never match a
              zone filter — add zones on the supplier record.
            </p>
          )}
          <ul className="space-y-2" data-testid="rfq-vendor-picker">
            {filteredSuppliers.map((s) => (
              <li key={s.id} className="flex items-start gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2">
                <input type="checkbox" data-testid={`vendor-pick-${s.id}`} aria-label={`Invite ${s.legalName}`}
                  checked={vendorIds.includes(s.id)}
                  onChange={(e) =>
                    setVendorIds(e.target.checked ? [...vendorIds, s.id] : vendorIds.filter((v) => v !== s.id))
                  }
                  className="mt-1" />
                <span>
                  <span className="font-medium">{s.legalName}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    zones: {s.zones.length > 0 ? s.zones.join(', ') : 'none declared'} ·{' '}
                    {s.capabilities.map((c) => c.category).join(', ') || 'no capabilities'}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <h3 className="text-sm font-medium">Publish checklist preview (ds_publish_rfq)</h3>
          <ul className="space-y-1" data-testid="builder-checklist">
            {checklist.map((item) => (
              <li key={item.id} data-testid={`builder-checklist-${item.id}`} data-met={String(item.met)}
                className={`rounded-md border px-3 py-1.5 text-sm ${item.met ? 'border-green-300 bg-green-50' : 'border-neutral-300 bg-white'}`}>
                {item.met ? '✓' : '○'} {item.label}
                {item.id === 'pins' && <span className="block text-xs text-neutral-500">Version pins are taken at publish time, on the RFQ page.</span>}
              </li>
            ))}
          </ul>
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          {created?.ok && (
            <p role="status" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
              RFQ created — <Link href={`/studio/rfqs/${created.rfqId}`} className="underline">open it to review &amp; publish</Link>.
            </p>
          )}
          <button type="button" data-testid="rfq-create" onClick={create} disabled={creating}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {creating ? 'Creating…' : 'Create RFQ (draft)'}
          </button>
        </section>
      )}
    </div>
  );
}
