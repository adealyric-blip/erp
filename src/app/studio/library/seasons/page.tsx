// Seasons — table + form (T10).
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { deleteSeason } from '@/server/actions/library';
import { getRow, listRows, str } from '../_lib';
import { DeleteButton } from '../components';
import { SeasonForm } from './SeasonForm';

const COLS = 'id,code,name,starts_on,ends_on,status,created_at';

export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, tenantId } = await requireStaff();
  const { edit } = await searchParams;
  const rows = await listRows(supabase, 'ds_seasons', COLS, tenantId);
  const editing = edit ? await getRow(supabase, 'ds_seasons', COLS, tenantId, edit) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / Seasons
      </p>
      <h1 className="mt-1 text-2xl font-bold">Seasons</h1>
      <section className="mt-6">
        <h2 className="font-semibold">{editing ? `Edit ${str(editing, 'code')}` : 'New season'}</h2>
        <SeasonForm initial={editing} />
      </section>
      <section className="mt-8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Starts</th>
              <th className="py-2 pr-3">Ends</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="py-2 pr-3 font-mono">{str(r, 'code')}</td>
                <td className="py-2 pr-3">{str(r, 'name')}</td>
                <td className="py-2 pr-3">{str(r, 'starts_on') || '—'}</td>
                <td className="py-2 pr-3">{str(r, 'ends_on') || '—'}</td>
                <td className="py-2 pr-3">{str(r, 'status')}</td>
                <td className="py-2 text-right">
                  <Link href={`/studio/library/seasons?edit=${String(r.id)}`} className="mr-3 underline">Edit</Link>
                  <DeleteButton label={str(r, 'code')} onDelete={() => deleteSeason(String(r.id))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-neutral-500">No seasons yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
