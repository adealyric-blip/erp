// PublishDialog — T17 publish with tech-pack version pin.
//
// Shows the PublishChecklist (mirrors ds_publish_rfq exactly) and the
// per-line tech-pack version pin (tp_specSnapshot: revision + sha256 of
// the `ds_tech_pack_snapshot` JSON at publish time). Publish is disabled
// until every checklist item is met — the dialog never calls the RPC
// with a precondition unmet. The pin is recorded in the publish result
// (S600 has no version-pin column on `rfqs`; the pin is returned with
// the publish call and shown on the RFQ page — see the open item in
// docs/phase3-proof/lane-1/).
'use client';

import { useState } from 'react';
import type { ChecklistItem, TechPackVersionPin } from '../lib/validation';
import { publishChecklistMet } from '../lib/validation';

export interface PublishResult {
  ok: boolean;
  status?: string;
  pins?: TechPackVersionPin[];
  error?: { message: string; hint?: string };
}

export function PublishDialog({
  rfqTitle,
  rfqNumber,
  checklist,
  pins,
  onPublish,
  demo = false,
}: {
  rfqTitle: string;
  rfqNumber: string;
  checklist: ChecklistItem[];
  pins: TechPackVersionPin[];
  onPublish: () => Promise<PublishResult>;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const allMet = publishChecklistMet(checklist);

  const publish = async () => {
    setPublishing(true);
    try {
      setResult(await onPublish());
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div data-testid="publish-dialog-root">
      <button
        type="button"
        data-testid="publish-open"
        onClick={() => setOpen(true)}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
      >
        Review &amp; publish
      </button>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={`Publish ${rfqNumber}`}
          data-testid="publish-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">Publish {rfqNumber} — {rfqTitle}</h2>
            {demo && (
              <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Demo — fixture data only. No RFQ is published.
              </p>
            )}

            <h3 className="mt-4 text-sm font-medium">Publish checklist (mirrors ds_publish_rfq)</h3>
            <ul className="mt-2 space-y-1" data-testid="publish-checklist">
              {checklist.map((item) => (
                <li key={item.id} data-testid={`checklist-${item.id}`} data-met={String(item.met)}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    item.met ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
                  }`}>
                  <span aria-hidden>{item.met ? '✓' : '✗'}</span>
                  <span>
                    <span className="font-medium">{item.label}</span>
                    <span className="block text-xs text-neutral-500">{item.rpcNote}</span>
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-4 text-sm font-medium">Tech-pack version pin (tp_specSnapshot)</h3>
            {pins.length === 0 ? (
              <p className="mt-1 text-sm text-neutral-500">No pins yet — pins are taken from the live tech-pack snapshot at publish time.</p>
            ) : (
              <ul className="mt-2 space-y-1" data-testid="publish-pins">
                {pins.map((pin) => (
                  <li key={pin.techPackId} data-testid={`pin-${pin.techPackId}`}
                    className="rounded-md border border-neutral-200 px-3 py-2 font-mono text-xs">
                    {pin.techPackId} · rev {pin.revision} · snapshot {pin.snapshotSha256.slice(0, 16)}…
                    <span className="block text-neutral-500">full sha256: {pin.snapshotSha256}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Publishing pins each line to the tech-pack revision it was quoted against. A later revision
              does not silently change a published RFQ.
            </p>

            {result && !result.ok && (
              <div role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                {result.error?.message}
                {result.error?.hint && <span className="block text-xs">{result.error.hint}</span>}
              </div>
            )}
            {result && result.ok && (
              <div role="status" className="mt-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
                Published. Status: {result.status ?? 'published'}.
                {result.pins && result.pins.length > 0 && (
                  <span className="block text-xs">Pinned {result.pins.length} tech-pack version(s).</span>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button type="button" data-testid="publish-confirm" onClick={publish}
                disabled={!allMet || publishing || (result?.ok ?? false)}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {publishing ? 'Publishing…' : result?.ok ? 'Published' : 'Publish RFQ'}
              </button>
              <button type="button" data-testid="publish-cancel" onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
                {result?.ok ? 'Close' : 'Cancel'}
              </button>
              {!allMet && (
                <p className="self-center text-xs text-neutral-500">Publish is disabled until every checklist item is met.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
