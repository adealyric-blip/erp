// New design — T07 accept entry: pick a garment template, create the
// design via design.create, land on the canvas. When the DB has no template
// rows (or is unreachable) the seed templates create a local draft instead.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { runCommand } from '@/server/actions/commands';
import { SEED_TEMPLATES } from '@/features/studio/lib/printAreas';

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  views: string[];
}

export default function NewDesignClient(props: { dbTemplates: TemplateRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const create = async (t: TemplateRow | { id: string; name: string }) => {
    setBusy(t.id);
    try {
      const isSeed = t.id.startsWith('seed-');
      if (isSeed) {
        // Local draft: no DB row. The editor labels it and saves versions
        // to this browser only.
        router.push(`/studio/designs/demo-${t.id}-${Date.now().toString(36)}?template=${t.id}`);
        return;
      }
      const res = await runCommand('design.create', { name: `${t.name} — new design`, garmentTemplateId: t.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      router.push(`/studio/designs/${(res.data as { designId: string }).designId}`);
    } finally {
      setBusy(null);
    }
  };

  const templates: Array<TemplateRow | { id: string; name: string; category?: string; views?: string[] }> =
    props.dbTemplates.length > 0
      ? props.dbTemplates
      : SEED_TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, views: t.views }));

  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="template-picker">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={busy !== null}
          onClick={() => void create(t)}
          className="rounded-lg border border-neutral-200 bg-white p-5 text-left hover:border-blue-500 disabled:opacity-50"
        >
          <span className="block font-semibold">{t.name}</span>
          <span className="mt-1 block text-sm text-neutral-500">
            {t.category ?? ''} · {(t.views ?? []).join(', ')}
          </span>
          <span className="mt-3 block text-sm font-medium text-blue-700">
            {busy === t.id ? 'Creating…' : 'Create design →'}
          </span>
        </button>
      ))}
      {props.dbTemplates.length === 0 && (
        <p className="text-sm text-neutral-500 sm:col-span-3">
          Showing the seed templates — the database template rows are not reachable, so these create local drafts.
        </p>
      )}
    </div>
  );
}
