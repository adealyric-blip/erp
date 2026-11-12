import { requireStaff } from '@/server/auth/requireStaff';

/**
 * Studio home — minimal placeholder for T04. The real shell, nav and
 * dashboard land in T06; this page exists so the T04 guards have a route
 * to protect (and to 404 for non-members).
 */
export default async function StudioPage() {
  const { tenantId, role } = await requireStaff();
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Studio</h1>
      <p className="mt-2 text-neutral-600">
        Signed in as staff (role: {role}) in tenant {tenantId}.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        The studio shell, canvas and libraries land in Phase 2 (T06–T12).
      </p>
    </main>
  );
}
