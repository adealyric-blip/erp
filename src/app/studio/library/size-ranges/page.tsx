// Size ranges — table + form (T10). Base size must be in the range:
// the zod check and the DB CHECK both reject it, and the error is shown inline.
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { deleteSizeRange } from '@/server/actions/library';
import { getRow, listRows, str } from '../_lib';
import { DeleteButton } from '../components';
import { SizeRangeForm } from './SizeRangeForm';

const COLS = 'id,name,sizes,base_size,unit,created_at';

export default async function SizeRangesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, tenantId } = await requireStaff();
  const { edit } = await searchParams;
  const rows = await listRows(supabase, 'ds_size_ranges', COLS, tenantId);
  const editing = edit ? await getRow(supabase, 'ds_size_ranges', COLS, tenantId, edit) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / Size ranges
      </p>
      <h1 className="mt-1 text-2xl font-bold">Size ranges</h1>
      <section className="mt-6">
        <h2 className="font-semibold">{editing ? `Edit ${str(editing, 'name')}` : 'New size range'}</h2>
        <SizeRangeForm initial={editing} />
      </section>
      <section className="mt-8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Sizes</th>
              <th className="py-2 pr-3">Base size</th>
              <th className="py-2 pr-3">Unit</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="py-2 pr-3">{str(r, 'name')}</td>
                <td className="py-2 pr-3 font-mono">{Array.isArray(r.sizes) ? (r.sizes as string[]).join(', ') : ''}</td>
                <td className="py-2 pr-3 font-mono">{str(r, 'base_size')}</td>
                <td className="py-2 pr-3">{str(r, 'unit')}</td>
                <td className="py-2 text-right">
                  <Link href={`/studio/library/size-ranges?edit=${String(r.id)}`} className="mr-3 underline">Edit</Link>
                  <DeleteButton label={str(r, 'name')} onDelete={() => deleteSizeRange(String(r.id))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-neutral-500">No size ranges yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
