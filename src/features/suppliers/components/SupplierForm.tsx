// SupplierForm — T16 create/edit form.
//
// Accepts:
// - `existing`: vendor refs for the duplicate email/website warning.
// - `initial`: values when editing (absent = create).
// - `onSave`: the server action (real pages) or a demo no-op (demo page).
//   Client validation runs first; the server re-validates (never trust the
//   browser). Nothing here writes to the ledger — finance work is paused;
//   the AP control account is picked/created in the existing Finance UI,
//   and create returns a guided result (not a failure) when no
//   `acct_vendors` row exists yet and no AP account was supplied.
'use client';

import { useMemo, useState } from 'react';
import {
  findDuplicateWarnings,
  validateSupplierForm,
  type ExistingVendorRef,
  type SupplierCapabilityInput,
  type SupplierFormErrors,
  type SupplierFormInput,
} from '../lib/validation';
import { ZoneEditor } from './ZoneTags';
import { JsonEditor } from './JsonEditor';

export interface SupplierSaveResult {
  ok: boolean;
  vendorId?: string;
  reusedExistingVendor?: boolean;
  warnings?: string[];
  error?: { message: string; hint?: string };
}

export function SupplierForm({
  existing,
  initial,
  vendorId,
  onSave,
  demo = false,
}: {
  existing: ExistingVendorRef[];
  initial?: Partial<SupplierFormInput> | null;
  vendorId?: string | null;
  onSave: (input: SupplierFormInput) => Promise<SupplierSaveResult>;
  demo?: boolean;
}) {
  const [legalName, setLegalName] = useState(initial?.legalName ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [zones, setZones] = useState<string[]>(initial?.zones ?? []);
  const [apAccountId, setApAccountId] = useState(initial?.apAccountId ?? '');
  const [capCategory, setCapCategory] = useState('');
  const [capTechniques, setCapTechniques] = useState('');
  const [capCountry, setCapCountry] = useState('');
  const [capabilities, setCapabilities] = useState<SupplierCapabilityInput[]>(initial?.capabilities ?? []);
  const [metadataJson, setMetadataJson] = useState('');
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [errors, setErrors] = useState<SupplierFormErrors>({});
  const [result, setResult] = useState<SupplierSaveResult | null>(null);
  const [saving, setSaving] = useState(false);

  const input: SupplierFormInput = useMemo(
    () => ({
      legalName,
      displayName: displayName || null,
      email: email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      website: website || null,
      zones,
      capabilities,
      apAccountId: apAccountId || null,
    }),
    [legalName, displayName, email, phone, whatsapp, website, zones, capabilities, apAccountId],
  );

  // Live duplicate warning — warns, never blocks (T16 accept).
  const warnings = useMemo(
    () => findDuplicateWarnings(existing, input, vendorId),
    [existing, input, vendorId],
  );

  const inputCls = (bad?: string) =>
    `w-full rounded-md border px-2 py-1 text-sm ${bad ? 'border-red-500' : 'border-neutral-300'}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateSupplierForm(input);
    if (metadataError) errs.capabilities = `Metadata JSON is invalid: ${metadataError}`;
    setErrors(errs);
    setResult(null);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const res = await onSave(input);
      setResult(res);
    } finally {
      setSaving(false);
    }
  };

  const addCapability = () => {
    if (!capCategory.trim()) return;
    setCapabilities([
      ...capabilities,
      {
        category: capCategory.trim().toLowerCase(),
        techniques: capTechniques.split(',').map((t) => t.trim()).filter(Boolean),
        certifications: [],
        countryCode: capCountry.trim().toUpperCase() || null,
      },
    ]);
    setCapCategory('');
    setCapTechniques('');
    setCapCountry('');
  };

  return (
    <form onSubmit={submit} data-testid="supplier-form" noValidate className="space-y-4">
      {demo && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Demo — fixture data only. Validation runs in the browser; nothing is saved.
        </p>
      )}
      <div>
        <label className="text-sm font-medium" htmlFor="supplier-legal-name">Legal name *</label>
        <input id="supplier-legal-name" data-testid="supplier-legal-name" value={legalName}
          onChange={(e) => setLegalName(e.target.value)} className={inputCls(errors.legalName)} />
        {errors.legalName && <p role="alert" className="mt-1 text-sm text-red-700">{errors.legalName}</p>}
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="supplier-display-name">Display name</label>
        <input id="supplier-display-name" value={displayName}
          onChange={(e) => setDisplayName(e.target.value)} className={inputCls()} />
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-medium">Contact channels — at least one is required *</legend>
        {errors.contact && (
          <p role="alert" data-testid="supplier-contact-error" className="mb-2 text-sm text-red-700">{errors.contact}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-sm" htmlFor="supplier-email">Email</label>
            <input id="supplier-email" data-testid="supplier-email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls(errors.email)} />
            {errors.email && <p role="alert" className="mt-1 text-sm text-red-700">{errors.email}</p>}
          </div>
          <div>
            <label className="text-sm" htmlFor="supplier-phone">Phone</label>
            <input id="supplier-phone" data-testid="supplier-phone" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} className={inputCls(errors.phone)} />
            {errors.phone && <p role="alert" className="mt-1 text-sm text-red-700">{errors.phone}</p>}
          </div>
          <div>
            <label className="text-sm" htmlFor="supplier-whatsapp">WhatsApp</label>
            <input id="supplier-whatsapp" data-testid="supplier-whatsapp" type="tel" value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)} className={inputCls(errors.whatsapp)} />
            {errors.whatsapp && <p role="alert" className="mt-1 text-sm text-red-700">{errors.whatsapp}</p>}
          </div>
        </div>
        <div className="mt-3">
          <label className="text-sm" htmlFor="supplier-website">Website</label>
          <input id="supplier-website" data-testid="supplier-website" value={website}
            onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputCls(errors.website)} />
          {errors.website && <p role="alert" className="mt-1 text-sm text-red-700">{errors.website}</p>}
        </div>
      </fieldset>

      {warnings.length > 0 && (
        <div role="alert" data-testid="supplier-duplicate-warning"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Possible duplicate</p>
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">This is a warning, not a block — check the existing vendor before saving.</p>
        </div>
      )}

      <div>
        <span className="text-sm font-medium">Operating zones (ISO-3166)</span>
        <ZoneEditor zones={zones} onChange={setZones} />
        {errors.zones && <p role="alert" className="mt-1 text-sm text-red-700">{errors.zones}</p>}
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="supplier-ap-account">AP control account</label>
        <input id="supplier-ap-account" data-testid="supplier-ap-account" value={apAccountId}
          onChange={(e) => setApAccountId(e.target.value)} placeholder="AP account id (optional if the vendor already exists)"
          className={inputCls(errors.apAccountId)} />
        <p className="mt-1 text-xs text-neutral-500">
          The AP control account is created in the existing Finance → Vendors UI (or the Parties drawer) —
          never here, and never as a ledger posting. If no vendor record exists yet and no AP account is
          given, saving returns guidance instead of failing.
        </p>
        {errors.apAccountId && <p role="alert" className="mt-1 text-sm text-red-700">{errors.apAccountId}</p>}
      </div>

      <fieldset className="rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-medium">Capabilities</legend>
        <ul className="space-y-1" data-testid="supplier-capabilities">
          {capabilities.map((c, i) => (
            <li key={`${c.category}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="font-medium">{c.category}</span>
              {c.techniques.length > 0 && <span className="text-neutral-500">{c.techniques.join(', ')}</span>}
              {c.countryCode && <span className="text-neutral-500">· {c.countryCode}</span>}
              <button type="button" aria-label={`Remove ${c.category}`}
                onClick={() => setCapabilities(capabilities.filter((_, j) => j !== i))}
                className="text-red-700 underline">remove</button>
            </li>
          ))}
          {capabilities.length === 0 && <li className="text-sm text-neutral-500">No capabilities yet.</li>}
        </ul>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <input aria-label="Capability category" data-testid="cap-category" value={capCategory}
            onChange={(e) => setCapCategory(e.target.value)} placeholder="category e.g. knitwear" className={inputCls()} />
          <input aria-label="Capability techniques (comma separated)" data-testid="cap-techniques" value={capTechniques}
            onChange={(e) => setCapTechniques(e.target.value)} placeholder="techniques, comma separated" className={inputCls()} />
          <input aria-label="Capability country code" data-testid="cap-country" value={capCountry}
            onChange={(e) => setCapCountry(e.target.value)} placeholder="country e.g. PT" maxLength={2} className={inputCls()} />
          <button type="button" data-testid="cap-add" onClick={addCapability}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm">Add capability</button>
        </div>
        {errors.capabilities && <p role="alert" className="mt-1 text-sm text-red-700">{errors.capabilities}</p>}
      </fieldset>

      <JsonEditor
        label="Metadata (JSON, optional)"
        testId="supplier-metadata-editor"
        value={metadataJson}
        onChange={(_, __, err) => {
          setMetadataJson(_);
          setMetadataError(err);
        }}
      />

      {result && !result.ok && (
        <div role="alert" data-testid="supplier-save-error" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-medium">{result.error?.message}</p>
          {result.error?.hint && <p className="mt-1 text-xs">{result.error.hint}</p>}
        </div>
      )}
      {result && result.ok && (
        <div role="status" data-testid="supplier-save-ok" className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
          Supplier saved{result.reusedExistingVendor ? ' — matched an existing vendor record, which was updated' : ''}.
          {result.warnings && result.warnings.length > 0 && (
            <span className="block">Warnings: {result.warnings.join('; ')}</span>
          )}
        </div>
      )}

      <button type="submit" data-testid="supplier-save" disabled={saving}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Saving…' : vendorId ? 'Save supplier' : 'Create supplier'}
      </button>
    </form>
  );
}
