// Tech pack editor — TemplatePreview (T13b): live preview — the filled
// SVG pages rendered next to the editor, with the template validator's
// missing data-field / data-slot / data-repeat ids listed.
'use client';

import { useState } from 'react';
import type { TemplateValidation } from '@/lib/techpack-render/types';

export interface PreviewPage {
  pageId: string;
  pageNo: number;
  totalPages: number;
  svg: string;
}

export default function TemplatePreview(props: {
  pages: PreviewPage[];
  validation: TemplateValidation;
}) {
  const { pages, validation } = props;
  const [idx, setIdx] = useState(0);
  const page = pages[Math.min(idx, Math.max(0, pages.length - 1))];
  const missingCount =
    validation.missingFields.length + validation.missingSlots.length + validation.missingRepeats.length;

  return (
    <section className="rounded-md border border-neutral-300 bg-white p-3" data-testid="techpack-template-preview">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Live preview — filled template</h2>
        <span className="text-xs text-neutral-500">
          {pages.length === 0 ? 'No pages yet' : `Page ${page?.pageNo ?? 0} / ${page?.totalPages ?? 0} — ${page?.pageId ?? ''}`}
        </span>
        <span className="ml-auto flex gap-1">
          <button type="button" className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-50" disabled={idx <= 0} onClick={() => setIdx(idx - 1)}>← Prev</button>
          <button type="button" className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-50" disabled={idx >= pages.length - 1} onClick={() => setIdx(idx + 1)}>Next →</button>
        </span>
      </div>
      {page && (
        <div
          className="mt-2 overflow-auto rounded border border-neutral-200 bg-neutral-50"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: page.svg }}
        />
      )}
      <details className="mt-2 text-xs" open={missingCount > 0}>
        <summary className="cursor-pointer font-medium">
          Template validator — {missingCount === 0 ? 'all required ids populated' : `${missingCount} missing ids`}
        </summary>
        {validation.missingFields.length > 0 && (
          <p className="mt-1"><span className="font-semibold">Missing data-field: </span>{validation.missingFields.join(', ')}</p>
        )}
        {validation.missingSlots.length > 0 && (
          <p className="mt-1"><span className="font-semibold">Missing data-slot (no image/colour bound): </span>{validation.missingSlots.join(', ')}</p>
        )}
        {validation.missingRepeats.length > 0 && (
          <p className="mt-1"><span className="font-semibold">Missing data-repeat (empty): </span>{validation.missingRepeats.join(', ')}</p>
        )}
      </details>
    </section>
  );
}
