import VersionTimeline from '@/features/studio/components/VersionTimeline';
import { listDesignVersions } from '@/server/actions/designs';

// History is a server page, but local-demo versions live in localStorage —
// they render through a small client reader below.
import HistoryClient from './HistoryClient';

export default async function DesignHistoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (id.startsWith('demo-')) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">Version history — local draft</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Local drafts keep their versions in this browser only.
        </p>
        <div className="mt-6">
          <HistoryClient designId={id} />
        </div>
      </main>
    );
  }
  const res = await listDesignVersions(id);
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">Version history</h1>
      <p className="mt-2 text-sm text-neutral-500">
        <a href={`/studio/designs/${id}`} className="text-blue-700 underline">
          ← Back to the canvas
        </a>
      </p>
      <div className="mt-6">
        {!res.ok ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{res.error.message}</p>
        ) : (
          <VersionTimeline designId={id} versions={res.data} isDemo={false} />
        )}
      </div>
    </main>
  );
}
