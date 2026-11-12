import NewDesignClient from './NewDesignClient';
import { listGarmentTemplates } from '@/server/actions/designs';

export default async function NewDesignPage() {
  const res = await listGarmentTemplates();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">New design</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Pick a garment template — the canvas opens with its dashed print areas.
      </p>
      <div className="mt-6">
        <NewDesignClient dbTemplates={res.ok ? res.data : []} />
      </div>
    </main>
  );
}
