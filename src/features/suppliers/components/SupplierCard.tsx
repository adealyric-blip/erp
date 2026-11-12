// SupplierCard + SupplierList (T16). List renders the directory; the card
// is the per-vendor summary with zones, capabilities, portal status, and
// the invite / revoke / unban entry points (wired on the detail page).
'use client';

import Link from 'next/link';
import type { SupplierListRow } from '../lib/validation';
import { ZoneTags } from './ZoneTags';

export function SupplierCard({ row }: { row: SupplierListRow }) {
  return (
    <article data-testid={`supplier-card-${row.id}`} className="rounded-md border border-neutral-300 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/studio/suppliers/${row.id}`} className="font-medium text-blue-700 underline">
            {row.legalName}
          </Link>
          <p className="text-sm text-neutral-500">
            {row.email ?? 'no email'} · {row.memberStatus ? `portal: ${row.memberStatus}` : 'portal: never invited'}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive ? 'bg-green-100 text-green-900' : 'bg-neutral-200 text-neutral-700'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="mt-2">
        <ZoneTags zones={row.zones} />
      </div>
      {row.capabilities.length > 0 && (
        <p className="mt-2 text-sm text-neutral-600">
          {row.capabilities.map((c) => c.category).join(' · ')}
        </p>
      )}
    </article>
  );
}

export function SupplierList({
  rows,
  zoneFilter,
  capabilityFilter,
}: {
  rows: SupplierListRow[];
  zoneFilter?: string | null;
  capabilityFilter?: string | null;
}) {
  return (
    <div data-testid="supplier-list">
      {(zoneFilter || capabilityFilter) && (
        <p data-testid="supplier-active-filters" className="mb-3 text-sm text-neutral-600">
          Filtered by
          {zoneFilter ? ` zone ${zoneFilter.toUpperCase()}` : ''}
          {zoneFilter && capabilityFilter ? ' and ' : ''}
          {capabilityFilter ? ` capability ${capabilityFilter}` : ''} — {rows.length} supplier(s).
        </p>
      )}
      {rows.length === 0 && (
        <p className="rounded-md border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-600">
          No suppliers match. Suppliers are `acct_vendors` rows — create one from the form, or in the
          existing Finance → Vendors UI.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <SupplierCard row={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}
