// Supplier directory — client + server validation (T16).
// Pure functions: no DB, no network, unit-tested in validation.test.ts.
//
// Data model (S600 + baseline):
// - A "supplier" in the Design Studio is an `acct_vendors` row (the
//   canonical vendor). There is NO `suppliers.zones` column and NO
//   `ds_supplier_zones` RPC in S600 — regional gating is stored in
//   `acct_vendors.metadata` as `{ zones: ["CN","PT"], whatsapp: "+…" }`
//   (see zonesFromMetadata / withZones). A future S620 step file could
//   formalise this as a `zones text[]` column + `ds_supplier_zones` RPC;
//   until then nothing here invents an ad-hoc grants table — gating reads
//   `metadata.zones` (plus `supplier_capabilities.country_code`).
// - Contact channels live on the vendor row: `email`, `phone`
//   (`acct_vendors`), `whatsapp` (inside `metadata`).
// - Capabilities live in `supplier_capabilities` (category, techniques,
//   moq, lead_time_days, certifications, country_code).

export const ISO_COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
  'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
  'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
  'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
  'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
  'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
  'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
  'QA',
  'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
  'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
  'WF', 'WS',
  'YE', 'YT',
  'ZA', 'ZM', 'ZW',
] as const;

export type IsoCountryCode = (typeof ISO_COUNTRY_CODES)[number];

const ISO_SET = new Set<string>(ISO_COUNTRY_CODES);

export function isIsoCountryCode(code: string): boolean {
  return ISO_SET.has(code.trim().toUpperCase());
}

/** A few common names for the ZoneTags display; unknown codes render as the code itself. */
export const COUNTRY_NAMES: Record<string, string> = {
  CN: 'China', PT: 'Portugal', TR: 'Turkey', VN: 'Vietnam', BD: 'Bangladesh', IN: 'India',
  PK: 'Pakistan', US: 'United States', GB: 'United Kingdom', DE: 'Germany', IT: 'Italy',
  FR: 'France', ES: 'Spain', NL: 'Netherlands', BE: 'Belgium', PL: 'Poland', RO: 'Romania',
  KR: 'South Korea', JP: 'Japan', TW: 'Taiwan', TH: 'Thailand', ID: 'Indonesia', KH: 'Cambodia',
  MX: 'Mexico', BR: 'Brazil', CO: 'Colombia', PE: 'Peru', CL: 'Chile', AR: 'Argentina',
  EG: 'Egypt', MA: 'Morocco', TN: 'Tunisia', ET: 'Ethiopia', KE: 'Kenya', NG: 'Nigeria',
  ZA: 'South Africa', MU: 'Mauritius', MG: 'Madagascar', LK: 'Sri Lanka', NP: 'Nepal',
  MM: 'Myanmar', LA: 'Laos', PH: 'Philippines', MY: 'Malaysia', SG: 'Singapore', HK: 'Hong Kong',
  CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IE: 'Ireland', SE: 'Sweden', DK: 'Denmark',
  FI: 'Finland', NO: 'Norway', CH: 'Switzerland', AT: 'Austria', CZ: 'Czechia', HU: 'Hungary',
  GR: 'Greece', HR: 'Croatia', SI: 'Slovenia', RS: 'Serbia', BA: 'Bosnia', UA: 'Ukraine',
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

// --- Supplier form -----------------------------------------------------------

export interface SupplierCapabilityInput {
  category: string;
  techniques: string[];
  moq?: number | null;
  leadTimeDays?: number | null;
  certifications: string[];
  countryCode?: string | null;
}

export interface SupplierFormInput {
  legalName: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  zones: string[];
  capabilities: SupplierCapabilityInput[];
  /** AP control account id, picked in the existing Finance UI. Required when no acct_vendors row exists yet. */
  apAccountId?: string | null;
  notes?: string | null;
}

export type SupplierFormErrors = Partial<Record<'legalName' | 'contact' | 'email' | 'phone' | 'whatsapp' | 'website' | 'zones' | 'capabilities' | 'apAccountId', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9 ()\-]{6,19}$/;

/**
 * T16 accept: create REQUIRES at least one contact channel present
 * (email / phone / WhatsApp). A supplier with no way to reach it cannot
 * be invited, so the form blocks instead of saving a dead row.
 */
export function validateSupplierForm(input: SupplierFormInput): SupplierFormErrors {
  const errors: SupplierFormErrors = {};
  if (!input.legalName || input.legalName.trim().length < 2) {
    errors.legalName = 'Legal name is required (at least 2 characters)';
  }
  const email = (input.email ?? '').trim();
  const phone = (input.phone ?? '').trim();
  const whatsapp = (input.whatsapp ?? '').trim();
  if (!email && !phone && !whatsapp) {
    errors.contact = 'At least one contact channel is required — email, phone, or WhatsApp';
  }
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number';
  if (whatsapp && !PHONE_RE.test(whatsapp)) errors.whatsapp = 'Enter a valid WhatsApp number';
  const website = (input.website ?? '').trim();
  if (website && !/^https?:\/\/.+\..+/.test(website)) {
    errors.website = 'Website must start with http:// or https://';
  }
  const badZones = (input.zones ?? []).filter((z) => !isIsoCountryCode(z));
  if (badZones.length > 0) {
    errors.zones = `Not ISO-3166 country codes: ${badZones.join(', ')}`;
  }
  for (const cap of input.capabilities ?? []) {
    if (!cap.category || cap.category.trim().length === 0) {
      errors.capabilities = 'Every capability needs a category (e.g. knitwear, denim, headwear)';
      break;
    }
    if (cap.countryCode && !isIsoCountryCode(cap.countryCode)) {
      errors.capabilities = `Capability country "${cap.countryCode}" is not an ISO-3166 code`;
      break;
    }
    if (cap.moq != null && cap.moq <= 0) {
      errors.capabilities = 'MOQ must be greater than 0';
      break;
    }
    if (cap.leadTimeDays != null && cap.leadTimeDays <= 0) {
      errors.capabilities = 'Lead time must be greater than 0 days';
      break;
    }
  }
  return errors;
}

export interface ExistingVendorRef {
  id: string;
  legalName: string;
  email?: string | null;
  website?: string | null;
}

/**
 * T16 accept: duplicate contact_email / website must WARN (not block —
 * a group can legitimately share a website, and an email typo must not
 * silently create a second vendor row; the warning is shown inline).
 */
export function findDuplicateWarnings(
  existing: ExistingVendorRef[],
  input: SupplierFormInput,
  selfId?: string | null,
): string[] {
  const warnings: string[] = [];
  const email = (input.email ?? '').trim().toLowerCase();
  const website = (input.website ?? '').trim().toLowerCase().replace(/\/$/, '');
  for (const v of existing) {
    if (selfId && v.id === selfId) continue;
    if (email && (v.email ?? '').trim().toLowerCase() === email) {
      warnings.push(`Email ${input.email} is already used by “${v.legalName}”`);
    }
    if (website && (v.website ?? '').trim().toLowerCase().replace(/\/$/, '') === website) {
      warnings.push(`Website ${input.website} is already used by “${v.legalName}”`);
    }
  }
  return [...new Set(warnings)];
}

// --- Zones in metadata -------------------------------------------------------

export function zonesFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const zones = (metadata as Record<string, unknown>).zones;
  if (!Array.isArray(zones)) return [];
  return zones.filter((z): z is string => typeof z === 'string').map((z) => z.toUpperCase());
}

export function whatsappFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const w = (metadata as Record<string, unknown>).whatsapp;
  return typeof w === 'string' && w.trim() ? w.trim() : null;
}

export function metadataWithZones(
  metadata: Record<string, unknown> | null | undefined,
  zones: string[],
  whatsapp?: string | null,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };
  next.zones = [...new Set(zones.map((z) => z.toUpperCase()))];
  if (whatsapp !== undefined) {
    if (whatsapp) next.whatsapp = whatsapp.trim();
    else delete next.whatsapp;
  }
  return next;
}

// --- Filtering (RFQ supplier selection reuses this) --------------------------

export interface SupplierListRow {
  id: string;
  legalName: string;
  email?: string | null;
  website?: string | null;
  isActive: boolean;
  zones: string[];
  capabilities: { category: string; techniques: string[]; countryCode?: string | null }[];
  memberStatus?: string | null;
}

export interface SupplierFilter {
  zone?: string | null;
  capability?: string | null;
  query?: string | null;
}

/**
 * Zone / capability filtering for supplier selection (T17). A vendor
 * matches a zone filter when its `metadata.zones` include the code; a
 * vendor with NO zones declared never matches an active zone filter
 * (it is unzoned, not worldwide — declared zones are the gate).
 */
export function filterSuppliers(rows: SupplierListRow[], filter: SupplierFilter): SupplierListRow[] {
  const zone = (filter.zone ?? '').trim().toUpperCase();
  const capability = (filter.capability ?? '').trim().toLowerCase();
  const query = (filter.query ?? '').trim().toLowerCase();
  return rows.filter((r) => {
    if (zone && !r.zones.includes(zone)) return false;
    if (capability && !r.capabilities.some((c) => c.category.toLowerCase() === capability)) return false;
    if (query) {
      const hay = `${r.legalName} ${r.email ?? ''} ${r.website ?? ''}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

/** "Approved" for the invite gate (T16): an active vendor record that is not revoked/suspended. */
export function isApprovedSupplier(row: { isActive: boolean; memberStatus?: string | null }): boolean {
  if (!row.isActive) return false;
  return row.memberStatus !== 'revoked' && row.memberStatus !== 'suspended';
}

/** Unban is an owner-only act: only the tenant owner may lift a suspension. */
export function canUnbanSupplier(role: string | null | undefined): boolean {
  return role === 'owner';
}
