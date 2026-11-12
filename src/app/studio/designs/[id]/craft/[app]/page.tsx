export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import { notFound } from 'next/navigation';
import { getDesignEditorData } from '@/server/actions/designs';
import { CraftAppSchema } from '@/lib/craft-bridge/protocol';
import CraftEditor from './CraftEditor';

/**
 * T12 open-in-Craft page. Route (adapted from the plan's
 * `designs/[designId]/craft/[app]`: this repo names the design segment
 * `[id]`, and Next forbids two different slug names at the same level).
 *
 * Staff-only: getDesignEditorData (Lane A) runs requireStaff (signed-in +
 * aal2 + tenant member; 404 for anyone else — never 403) and reads the
 * design with the user's own JWT, so a design the caller cannot see is a
 * 404. `?asset=<assetId>` names the document to open; the asset's tenant
 * is re-checked by the document-stream route itself — the page never
 * trusts the parameter. Without ?asset the app opens empty and the user
 * opens a file inside the app.
 * COOP/COEP headers for this path come from next.config.ts (T11).
 */
export default async function CraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; app: string }>;
  searchParams: Promise<{ asset?: string }>;
}) {
  const { id, app } = await params;
  const { asset } = await searchParams;
  const parsedApp = CraftAppSchema.safeParse(app);
  if (!parsedApp.success) notFound();
  const craftApp = parsedApp.data;

  const res = await getDesignEditorData(id);
  if (!res.ok) notFound();

  return (
    <CraftEditor
      designId={res.data.design.id}
      designName={res.data.design.name}
      app={craftApp}
      documentUrl={asset ? `/api/craft/${craftApp}/document/${asset}` : null}
      documentName={null}
      saveUrl={`/api/craft/${craftApp}/save`}
    />
  );
}
