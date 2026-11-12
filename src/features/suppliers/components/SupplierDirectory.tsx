// SupplierDirectory — T16 list + create drawer + NDA manager.
// Client container: zone/capability filters, the create form in a drawer
// (no left rail — everything lives in a drawer over the page), and the
// NDA versions section. In demo mode everything runs on fixture data
// and nothing is saved.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SupplierForm, type SupplierSaveResult } from './SupplierForm';
import { SupplierList } from './SupplierCard';
import { NdaManager } from './NdaManager';
import {
  filterSuppliers,
  type ExistingVendorRef,
  type SupplierFormInput,
  type SupplierListRow,
} from '../lib/validation';
import type { NdaRow } from '@/server/actions/suppliers';
import type { Result } from '@/server/result';

export function SupplierDirectory({
  rows,
  existing,
  ndas,
  activeNdaId,
  onSave,
  onCreateNda,
  onActivateNda,
  demo = false,
}: {
  rows: SupplierListRow[];
  existing: ExistingVendorRef[];
  ndas: NdaRow[];
  activeNdaId: string | null;
  onSave: (input: SupplierFormInput) => Promise<SupplierSaveResult>;
  onCreateNda: (title: string, bodyMd: string) => Promise<Result<NdaRow>>;
  onActivateNda: (ndaId: string) => Promise<Result<{ activated: true }>>;
  demo?: boolean;
}) {
  const [zoneFilter, setZoneFilter] = useState('');
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(
    () => filterSuppliers(rows, { zone: zoneFilter || null, query: query || null }),
    [rows, zoneFilter, query],
  );

  const demoSave: (input: SupplierFormInput) => Promise<SupplierSaveResult> = async () => ({
    ok: true,
    vendorId: 'demo-vendor-new',
    warnings: [],
  });

  return (
    <div data-testid="supplier-directory" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          data-testid="supplier-search"
          aria-label="Search suppliers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, website…"
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        />
        <select
          data-testid="supplier-zone-filter"
          aria-label="Filter by zone"
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="">All zones</option>
          {[...new Set(rows.flatMap((r) => r.zones))].sort().map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <button
          type="button"
          data-testid="supplier-new-open"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          New supplier
        </button>
        <Link href="/studio/rfqs" className="text-sm text-blue-700 underline">RFQs →</Link>
      </div>

      <SupplierList rows={filtered} zoneFilter={zoneFilter || null} />

      {drawerOpen && (
        <div role="dialog" aria-modal="true" aria-label="New supplier"
          data-testid="supplier-drawer"
          className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <div className="max-h-full w-full max-w-xl overflow-auto bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">New supplier</h2>
              <button type="button" data-testid="supplier-drawer-close" onClick={() => setDrawerOpen(false)}
                className="rounded-md border border-neutral-300 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4">
              <SupplierForm existing={existing} onSave={demo ? demoSave : onSave} demo={demo} />
            </div>
          </div>
        </div>
      )}

      <section data-testid="nda-manager-section" className="rounded-md border border-neutral-300 bg-white p-4">
        <h2 className="text-lg font-semibold">NDAs</h2>
        <p className="text-sm text-neutral-600">
          New version = new row; exactly one version is active. NDA text is immutable once created —
          an NDA must be accepted before an award or release.
        </p>
        <div className="mt-3">
          <NdaManager ndas={ndas} activeNdaId={activeNdaId} onCreate={onCreateNda} onActivate={onActivateNda} demo={demo} />
        </div>
      </section>
    </div>
  );
}
