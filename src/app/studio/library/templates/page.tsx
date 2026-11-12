// Garment templates — table + form (T10). License scope comes from S610.
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';
import { deleteTemplate } from '@/server/actions/library';
import { getRow, listRows, str } from '../_lib';
import { DeleteButton } from '../components';
import { TemplateForm } from './TemplateForm';

const COLS =
  'id,name,category,archetype,views,print_areas,size_range_id,flat_sketch_asset_id,pattern_asset_id,model_asset_id,turntable_frames,license_scope,is_active,created_at';

function badge(scope: string) {
  const map: Record<string, string> = {
    owned: 'bg-green-100 text-green-800',
    licensed: 'bg-blue-100 text-blue-800',
    printful_only: 'bg-amber-100 text-amber-800',
    unlicensed: 'bg-neutral-200 text-neutral-700',
  };
  const label: Record<string, string> = {
    owned: 'Owned',
    licensed: 'Licensed',
    printful_only: 'Printful only',
    unlicensed: 'Unlicensed',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${map[scope] ?? map.unlicensed}`}>
      {label[scope] ?? scope}
    </span>
  );
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { supabase, tenantId } = await requireStaff();
  const { edit } = await searchParams;
  const rows = await listRows(supabase, 'ds_garment_templates', COLS, tenantId);
  const ranges = await listRows(supabase, 'ds_size_ranges', 'id,name', tenantId);
  const editing = edit ? await getRow(supabase, 'ds_garment_templates', COLS, tenantId, edit) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <p className="text-sm text-neutral-500">
        <Link href="/studio/library" className="underline">Library</Link> / Garment templates
      </p>
      <h1 className="mt-1 text-2xl font-bold">Garment templates</h1>
      <section className="mt-6">
        <h2 className="font-semibold">{editing ? `Edit ${str(editing, 'name')}` : 'New garment template'}</h2>
        <TemplateForm
          initial={editing}
          sizeRanges={ranges.map((r) => ({ id: String(r.id), name: str(r, 'name') }))}
        />
      </section>
      <section className="mt-8">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-neutral-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Views</th>
              <th className="py-2 pr-3">License</th>
              <th className="py-2 pr-3">Turntable</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="py-2 pr-3">{str(r, 'name')}</td>
                <td className="py-2 pr-3">{str(r, 'category')}</td>
                <td className="py-2 pr-3 font-mono text-xs">
                  {Array.isArray(r.views) ? (r.views as string[]).join(', ') : ''}
                </td>
                <td className="py-2 pr-3">{badge(str(r, 'license_scope') || 'unlicensed')}</td>
                <td className="py-2 pr-3">{typeof r.turntable_frames === 'number' ? `${r.turntable_frames} frames` : '—'}</td>
                <td className="py-2 text-right">
                  <Link href={`/studio/library/templates?edit=${String(r.id)}`} className="mr-3 underline">Edit</Link>
                  <DeleteButton label={str(r, 'name')} onDelete={() => deleteTemplate(String(r.id))} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-neutral-500">No garment templates yet — generate one in Flats.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
