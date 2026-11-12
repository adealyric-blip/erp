// Supplier directory — T16. Staff only (requireStaff redirects to /login).
import { requireStaff } from '@/server/auth/requireStaff';
import { listSuppliers, listExistingVendorRefs, listNdas, getActiveNda, createSupplier, createNdaVersion, activateNda } from '@/server/actions/suppliers';
import { SupplierDirectory } from '@/features/suppliers/components/SupplierDirectory';

export default async function SuppliersPage() {
  await requireStaff();
  const [rows, existing, ndas, active] = await Promise.all([
    listSuppliers(),
    listExistingVendorRefs(),
    listNdas(),
    getActiveNda(),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="suppliers-page">
      <h1 className="text-3xl font-bold">Suppliers</h1>
      <p className="mt-2 text-neutral-600">
        Design Studio suppliers are <code>acct_vendors</code> rows — capabilities, zones, and portal
        membership hang off the vendor record. Regional gating uses the vendor&apos;s ISO-3166 zones
        (no ad-hoc grants table). The AP control account is set in the existing Finance → Vendors UI.
      </p>
      <div className="mt-6">
        <SupplierDirectory
          rows={rows.ok ? rows.data : []}
          existing={existing.ok ? existing.data : []}
          ndas={ndas.ok ? ndas.data : []}
          activeNdaId={active.ok && active.data ? active.data.id : null}
          onSave={createSupplier}
          onCreateNda={createNdaVersion}
          onActivateNda={activateNda}
        />
      </div>
      {(!rows.ok || !existing.ok) && (
        <p role="alert" className="mt-4 text-sm text-red-700">Could not load the supplier directory.</p>
      )}
    </main>
  );
}
