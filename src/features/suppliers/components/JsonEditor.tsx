// JsonEditor — raw JSON editing with parse validation (T16).
// Used for supplier metadata / capability JSON on the supplier form.
'use client';

import { useState } from 'react';

export function JsonEditor({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string, parsed: unknown | null, error: string | null) => void;
  testId?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const handle = (text: string) => {
    if (!text.trim()) {
      setError(null);
      onChange(text, null, null);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      setError(null);
      onChange(text, parsed, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      setError(msg);
      onChange(text, null, msg);
    }
  };

  return (
    <div data-testid={testId ?? 'json-editor'}>
      <label className="text-sm font-medium">{label}</label>
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => handle(e.target.value)}
        rows={5}
        spellCheck={false}
        className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
      />
      {error ? (
        <p role="alert" className="mt-1 text-sm text-red-700">
          Invalid JSON: {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-neutral-500">Valid JSON. Stored as-is on the vendor record.</p>
      )}
    </div>
  );
}
