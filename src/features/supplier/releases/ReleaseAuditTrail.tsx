'use client';

import { useMemo, useState } from 'react';
import type { AccessEventRow } from '../types';

// ReleaseAuditTrail — T20 staff audit view.
//
// Rows come from ds_access_events (append-only; staff read via the tenant
// RLS policy). Filters: vendor, RFQ, event, date. CSV export downloads
// exactly the filtered rows shown — the export is an auditable copy and is
// NOT watermarked (watermarks belong on supplier-facing previews only).
// A denial row (asset_view_denied / release_download_denied) renders in red:
// that is how legal sees a revoked supplier's blocked attempt.

export interface ReleaseAuditTrailProps {
  events: AccessEventRow[];
  vendors: Array<{ id: string; name: string }>;
  rfqs: Array<{ id: string; number: string }>;
}

const ALL_EVENTS = [
  'rfq_viewed',
  'asset_view_authorized',
  'asset_view_denied',
  'asset_streamed',
  'nda_accepted',
  'bid_saved',
  'bid_submitted',
  'bid_withdrawn',
  'question_asked',
  'rfq_declined',
  'upload_registered',
  'release_download_authorized',
  'release_download_denied',
  'supplier_invited',
  'supplier_accepted',
  'supplier_revoked',
  'rfq_published',
  'rfq_closed',
  'rfq_awarded',
  'techpack_transition',
  'print_attempt',
  'devtools_hint',
  'copy_attempt',
] as const;

function isDenial(event: string): boolean {
  return event.endsWith('_denied');
}

function toCsv(rows: AccessEventRow[]): string {
  const head = ['occurred_at', 'event', 'actor_vendor_id', 'actor_user_id', 'rfq_id', 'asset_id', 'subject_type', 'subject_id', 'metadata'];
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.occurred_at,
      r.event,
      r.actor_vendor_id,
      r.actor_user_id,
      r.rfq_id,
      r.asset_id,
      r.subject_type,
      r.subject_id,
      JSON.stringify(r.metadata ?? {}),
    ]
      .map(esc)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n');
}

export default function ReleaseAuditTrail({ events, vendors, rfqs }: ReleaseAuditTrailProps) {
  const [vendor, setVendor] = useState('');
  const [rfq, setRfq] = useState('');
  const [event, setEvent] = useState('');
  const [date, setDate] = useState('');

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (vendor === '' || e.actor_vendor_id === vendor) &&
          (rfq === '' || e.rfq_id === rfq) &&
          (event === '' || e.event === event) &&
          (date === '' || (e.occurred_at ?? '').slice(0, 10) === date),
      ),
    [events, vendor, rfq, event, date],
  );

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-audit-${date || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? id ?? '—';
  const rfqNumber = (id: string | null) => rfqs.find((r) => r.id === id)?.number ?? id ?? '—';

  return (
    <section data-testid="release-audit-trail" className="rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Access audit trail</h2>
        <button type="button" onClick={exportCsv} className="rounded-md border px-3 py-1.5 text-sm font-medium">
          Export CSV ({filtered.length} rows)
        </button>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Append-only log (ds_access_events). Denials render in red — including a revoked supplier&apos;s blocked
        download attempts. CSV exports are auditable copies and are not watermarked.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          Vendor
          <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          RFQ
          <select value={rfq} onChange={(e) => setRfq(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="">All RFQs</option>
            {rfqs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Event
          <select value={event} onChange={(e) => setEvent(e.target.value)} className="rounded-md border px-2 py-1.5 text-sm">
            <option value="">All events</option>
            {ALL_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Date (Y-m-d)
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No access events match these filters.</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-neutral-500">
              <th className="py-2 pr-2">When</th>
              <th className="py-2 pr-2">Event</th>
              <th className="py-2 pr-2">Vendor</th>
              <th className="py-2 pr-2">RFQ</th>
              <th className="py-2">Subject</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} data-testid="audit-row" className={`border-b ${isDenial(e.event) ? 'bg-red-50 text-red-800' : ''}`}>
                <td className="py-2 pr-2 whitespace-nowrap">{(e.occurred_at ?? '').slice(0, 10)}</td>
                <td className="py-2 pr-2 font-mono text-xs">{e.event}</td>
                <td className="py-2 pr-2">{vendorName(e.actor_vendor_id)}</td>
                <td className="py-2 pr-2">{rfqNumber(e.rfq_id)}</td>
                <td className="py-2 font-mono text-xs">{e.subject_type ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
