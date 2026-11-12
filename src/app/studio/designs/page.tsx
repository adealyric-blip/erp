import Link from 'next/link';
import { listDesigns } from '@/server/actions/designs';

export default async function StudioDesignsPage() {
  const res = await listDesigns();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Designs</h1>
        <Link href="/studio/designs/new" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          New design
        </Link>
      </div>
      {!res.ok && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="designs-error">
          Could not load designs: {res.error.message} — the database may be unreachable.
        </p>
      )}
      {res.ok && res.data.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">No designs yet — create one from a template.</p>
      )}
      {res.ok && (
        <ul className="mt-6 space-y-2">
          {res.data.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
              <div>
                <Link href={`/studio/designs/${d.id}`} className="font-medium text-blue-700 hover:underline">
                  {d.name}
                </Link>
                <p className="text-xs text-neutral-500">
                  {d.style_number ?? 'No style number'} · updated {new Date(d.updated_at).toLocaleString()}
                </p>
              </div>
              <Link href={`/studio/designs/${d.id}/history`} className="text-sm text-neutral-600 hover:underline">
                History →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
