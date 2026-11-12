// ZoneTags — regional gating tags (T16).
// Zones are ISO-3166-1 alpha-2 codes stored on `acct_vendors.metadata.zones`.
// A vendor with no zones declared is unzoned, not worldwide.
'use client';

import { useState } from 'react';
import { countryName, isIsoCountryCode } from '../lib/validation';

export function ZoneTag({ code }: { code: string }) {
  const upper = code.toUpperCase();
  return (
    <span
      data-testid={`zone-tag-${upper}`}
      title={`${countryName(upper)} (${upper}) — ISO-3166`}
      className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-800"
    >
      {upper} · {countryName(upper)}
    </span>
  );
}

export function ZoneTags({ zones }: { zones: string[] }) {
  if (!zones || zones.length === 0) {
    return <span className="text-xs italic text-neutral-500">No zones declared — unzoned (matches no zone filter)</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="zone-tags">
      {zones.map((z) => (
        <ZoneTag key={z} code={z} />
      ))}
    </span>
  );
}

export function ZoneEditor({
  zones,
  onChange,
}: {
  zones: string[];
  onChange: (zones: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (!isIsoCountryCode(code)) {
      setError(`“${code}” is not an ISO-3166 country code`);
      return;
    }
    if (zones.includes(code)) {
      setError(`Zone ${code} is already listed`);
      return;
    }
    setError(null);
    setDraft('');
    onChange([...zones, code]);
  };

  return (
    <div data-testid="zone-editor">
      <div className="flex flex-wrap items-center gap-1">
        <ZoneTags zones={zones} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          data-testid="zone-input"
          aria-label="Add a zone (ISO-3166 country code)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. CN"
          maxLength={2}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm uppercase"
        />
        <button
          type="button"
          data-testid="zone-add"
          onClick={add}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm"
        >
          Add zone
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-neutral-500">
        Regional gating uses these ISO-3166 codes — no ad-hoc grants table. A supplier only matches a
        zone-filtered RFQ for a country it declares here.
      </p>
    </div>
  );
}
