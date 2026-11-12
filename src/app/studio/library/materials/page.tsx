// Materials — table + form (T10). Certifications as a comma list; the
// nominated vendor is a vendor id (leave blank for none).
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { deleteMaterial } from '@/server/actions/library';
import { getRow, listRows, str } from '../_lib';
import { DeleteButton } from '../components';
import { MaterialForm } from './MaterialForm';

const COLS = 'id,kind,code,name,composition,weight_gsm,vendor_id,certifications,is_active,created_at';

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, tenantId } = await requireStaff();
  const { edit } = await searchParams;
  const rows = await listRows(supabase, 'ds_materials', COLS, tenantId);
  const editing = edit ? await getRow(supabase, 'ds_materials', COLS, tenantId, edit) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / Materials
      </p>
      <h1 className="mt-1 text-2xl font-bold">Materials</h1>
      <section className="mt-6">
        <h2 className="font-semibold">{editing ? `Edit ${str(editing, 'code')}` : 'New material'}</h2>
        <MaterialForm initial={editing} />
      </section>
      <section className="mt-8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Kind</th>
              <th className="py-2 pr-3">Composition</th>
              <th className="py-2 pr-3">Weight</th>
              <th className="py-2 pr-3">Certifications</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="py-2 pr-3 font-mono">{str(r, 'code')}</td>
                <td className="py-2 pr-3">{str(r, 'name')}</td>
                <td className="py-2 pr-3">{str(r, 'kind')}</td>
                <td className="py-2 pr-3">{str(r, 'composition') || '—'}</td>
                <td className="py-2 pr-3">{typeof r.weight_gsm === 'number' ? `${r.weight_gsm} gsm` : '—'}</td>
                <td className="py-2 pr-3">{Array.isArray(r.certifications) ? (r.certifications as string[]).join(', ') : ''}</td>
                <td className="py-2 pr-3">{r.is_active === false ? 'no' : 'yes'}</td>
                <td className="py-2 text-right">
                  <Link href={`/studio/library/materials?edit=${String(r.id)}`} className="mr-3 underline">Edit</Link>
                  <DeleteButton label={str(r, 'code')} onDelete={() => deleteMaterial(String(r.id))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="py-4 text-neutral-500">No materials yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
