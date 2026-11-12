import EditorClient from '@/features/studio/components/EditorClient';
import { getDesignEditorData, type DesignEditorData } from '@/server/actions/designs';
import { SEED_TEMPLATES } from '@/features/studio/lib/printAreas';

function demoData(id: string, templateId: string | null): DesignEditorData {
  const template = SEED_TEMPLATES.find((t) => t.id === templateId) ?? SEED_TEMPLATES[0];
  return {
    design: {
      id,
      name: `${template?.name ?? 'Boxy tee'} — local draft`,
      style_number: null,
      garment_template_id: template?.id ?? null,
      canvas_state: null,
    },
    template: template
      ? { id: template.id, name: template.name, views: [...template.views], print_areas: template.print_areas as Record<string, unknown> }
      : null,
    latestVersion: null,
    versionCount: 0,
  };
}

export default async function DesignEditorPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { id } = await props.params;
  const { template } = await props.searchParams;

  // Local draft (no DB row): staff-only, saves to this browser only.
  if (id.startsWith('demo-')) {
    return <EditorClient data={demoData(id, template ?? null)} />;
  }

  const res = await getDesignEditorData(id);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">Design not found</h1>
        <p className="mt-2 text-sm text-neutral-500">{res.error.message}</p>
        <p className="mt-4 text-sm">
          <a href="/studio/designs/new" className="text-blue-700 underline">
            Create a new design →
          </a>
        </p>
      </main>
    );
  }
  return <EditorClient data={res.data} />;
}
