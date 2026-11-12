// Demo: supplier directory — fixture data only, no sign-in, no DB.
// Exists ONLY so the T16 flows can be captured with Playwright without
// the local Supabase stack (none on this VM). Every control is the real
// production component; saving runs client validation and reports a
// demo success, never a write. Remove with the demo RFQ page in one
// commit if Jaizon wants the demo surface gone.
'use client';

import { SupplierDirectory } from '@/features/suppliers/components/SupplierDirectory';
import { DEMO_EXISTING_VENDORS, DEMO_SUPPLIERS } from '@/features/suppliers/lib/fixtures';

const DEMO_NDAS = [
  {
    id: 'demo-nda-v3',
    version: 3,
    title: 'Mutual NDA v3',
    bodyMd: 'Demo NDA body — fixture text, not a legal document.',
    bodySha256: 'demo-sha256-not-a-real-hash-00000000000000000000000000000000',
    isActive: true,
    createdAt: '2026-11-11T10:00:00.000Z',
  },
];

export default function DemoSuppliersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="demo-suppliers-page">
      <h1 className="text-3xl font-bold">Suppliers — demo</h1>
      <p className="mt-2 text-neutral-600">
        Fixture data only (<code>*.example</code>). The real directory lives at{' '}
        <code>/studio/suppliers</code> behind staff sign-in.
      </p>
      <div className="mt-6">
        <SupplierDirectory
          rows={DEMO_SUPPLIERS}
          existing={DEMO_EXISTING_VENDORS}
          ndas={DEMO_NDAS}
          activeNdaId="demo-nda-v3"
          onSave={async () => ({ ok: true, vendorId: 'demo-vendor-new', warnings: [] })}
          onCreateNda={async () => ({ ok: true, data: DEMO_NDAS[0] })}
          onActivateNda={async () => ({ ok: true, data: { activated: true as const } })}
          demo
        />
      </div>
    </main>
  );
}
