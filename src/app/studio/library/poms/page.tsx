// POM library — table + form (T10). Diagram upload goes through the staff
// asset route: upload the diagram in Assets, paste the asset id.
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { deletePom } from '@/server/actions/library';
import { getRow, listRows, str } from '../_lib';
import { DeleteButton } from '../components';
import { PomForm } from './PomForm';

const COLS = 'id,code,name,how_to_measure,category,default_tol_plus,default_tol_minus,diagram_asset_id,sort,created_at';

export default async function PomsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, tenantId } = await requireStaff();
  const { edit } = await searchParams;
  const rows = await listRows(supabase, 'ds_pom_library', COLS, tenantId);
  const editing = edit ? await getRow(supabase, 'ds_pom_library', COLS, tenantId, edit) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / POM library
      </p>
      <h1 className="mt-1 text-2xl font-bold">Points of measure</h1>
      <section className="mt-6">
        <h2 className="font-semibold">{editing ? `Edit ${str(editing, 'code')}` : 'New point of measure'}</h2>
        <PomForm initial={editing} />
      </section>
      <section className="mt-8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Tol ±</th>
              <th className="py-2 pr-3">Diagram</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="py-2 pr-3 font-mono">{str(r, 'code')}</td>
                <td className="py-2 pr-3">{str(r, 'name')}</td>
                <td className="py-2 pr-3">{str(r, 'category') || '—'}</td>
                <td className="py-2 pr-3">
                  {typeof r.default_tol_plus === 'number' ? `+${r.default_tol_plus}` : ''}/
                  {typeof r.default_tol_minus === 'number' ? `−${r.default_tol_minus}` : ''}
                </td>
                <td className="py-2 pr-3">{str(r, 'diagram_asset_id') ? '✓' : '—'}</td>
                <td className="py-2 text-right">
                  <Link href={`/studio/library/poms?edit=${String(r.id)}`} className="mr-3 underline">Edit</Link>
                  <DeleteButton label={str(r, 'code')} onDelete={() => deletePom(String(r.id))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-neutral-500">No points of measure yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
