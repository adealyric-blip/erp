// Render station page — T14. Staff only. Keep this tab open on the studio
// computer and it claims + runs browser render jobs (thumbnails, background
// removal, tech pack PDFs). One tab is enough; closing it mid-job requeues
// the job for the next tab (ds_reap_stale_jobs).
export const dynamic = 'force-dynamic'; // Auth-gated: never prerendered (requireStaff needs a request).

import { requireStaff } from '@/server/auth/requireStaff';
import RenderStationClient from '@/features/render/RenderStationClient';

export default async function RenderStationPage() {
  const { tenantId } = await requireStaff();
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="render-station-page">
      <h1 className="text-3xl font-bold">Render station</h1>
      <p className="mt-2 text-neutral-600">
        This tab is the render station. It runs Craft WASM jobs in the browser: thumbnails, background
        removal, and the tech pack PDFs (internal master + watermarked supplier preview).
      </p>
      <div className="mt-6">
        <RenderStationClient tenantId={tenantId} />
      </div>
    </main>
  );
}
