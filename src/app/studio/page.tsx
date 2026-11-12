import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { listDesigns } from '@/server/actions/designs';

/** Studio home — T06 shell landing. */
export default async function StudioPage() {
  const { tenantId, role } = await requireStaff();
  const designs = await listDesigns();
  const count = designs.ok ? designs.data.length : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Studio</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as staff (role: {role}) in tenant {tenantId}.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Press <kbd className="rounded border border-neutral-300 bg-white px-1">⌘K</kbd> anywhere in the studio to
        run a command. {count === null ? 'Designs could not be loaded (database unreachable).' : `You have ${count} design${count === 1 ? '' : 's'}.`}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/studio/designs/new" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
          New design
        </Link>
        <Link href="/studio/designs" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
          All designs
        </Link>
        <Link href="/studio/library" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
          Library
        </Link>
        <Link href="/studio/library/flats" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
          Flats
        </Link>
        <Link href="/studio/assets" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
          Assets
        </Link>
      </div>
      <ul className="mt-8 list-disc space-y-1 pl-5 text-sm text-neutral-600">
        <li>Canvas: Konva stage per view, dashed print areas from the garment template.</li>
        <li>Versions: autosave every 30 s, history with restore-as-new-version.</li>
        <li>
          Library: seasons, size ranges, POMs, materials, garment templates and flats —{' '}
          <Link href="/studio/library" className="underline">open the library</Link>.
        </li>
      </ul>
    </main>
  );
}
