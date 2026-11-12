// Supplier detail — T16. Staff only.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/server/auth/requireStaff';
import { getSupplier, inviteSupplier, revokeSupplier, unbanSupplier } from '@/server/actions/suppliers';
import { SupplierDetailActions } from '@/features/suppliers/components/SupplierDetailActions';
import { ZoneTags } from '@/features/suppliers/components/ZoneTags';
import { isApprovedSupplier, zonesFromMetadata, whatsappFromMetadata } from '@/features/suppliers/lib/validation';

export default async function SupplierDetailPage({ params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const { role } = await requireStaff();
  const res = await getSupplier(supplierId);
  if (!res.ok) notFound();
  const { vendor, members, capabilities } = res.data;
  const memberStatus = (members[0]?.status as string | null) ?? null;
  const approved = isApprovedSupplier({ isActive: Boolean(vendor.is_active), memberStatus });
  const zones = zonesFromMetadata(vendor.metadata);
  const whatsapp = whatsappFromMetadata(vendor.metadata);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12" data-testid="supplier-detail-page">
      <Link href="/studio/suppliers" className="text-sm text-blue-700 underline">← All suppliers</Link>
      <h1 className="mt-2 text-3xl font-bold">{String(vendor.legal_name ?? vendor.display_name ?? '')}</h1>
      <p className="mt-2 text-neutral-600">
        {String(vendor.display_name ?? '')} · {String(vendor.email ?? 'no email')} · {String(vendor.phone ?? 'no phone')}
        {whatsapp ? ` · WhatsApp ${whatsapp}` : ''} · {String(vendor.website ?? 'no website')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">Zones:</span>
        <ZoneTags zones={zones} />
        <span className="text-sm text-neutral-600">· Vendor #{String(vendor.vendor_number ?? '')}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${vendor.is_active ? 'bg-green-100 text-green-900' : 'bg-neutral-200 text-neutral-700'}`}>
          {vendor.is_active ? 'Active' : 'Inactive'}
        </span>
        <span className="text-sm text-neutral-600">· Portal: {memberStatus ?? 'never invited'}</span>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Capabilities</h2>
        {capabilities.length === 0 ? (
          <p className="text-sm text-neutral-500">No capabilities recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {capabilities.map((c) => (
              <li key={String(c.id)}>
                <span className="font-medium">{String(c.category)}</span>
                {Array.isArray(c.techniques) && c.techniques.length > 0 && <span className="text-neutral-500"> — {(c.techniques as string[]).join(', ')}</span>}
                {typeof c.country_code === 'string' && c.country_code !== '' && <span className="text-neutral-500"> · {c.country_code}</span>}
                {c.moq != null && <span className="text-neutral-500"> · MOQ {String(c.moq)}</span>}
                {c.lead_time_days != null && <span className="text-neutral-500"> · {String(c.lead_time_days)} days</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6">
        <SupplierDetailActions
          vendorId={supplierId}
          vendorName={String(vendor.legal_name ?? '')}
          isApproved={approved}
          memberStatus={memberStatus}
          canUnban={role === 'owner'}
          onInvite={inviteSupplier}
          onRevoke={revokeSupplier}
          onUnban={unbanSupplier}
        />
      </div>
    </main>
  );
}
