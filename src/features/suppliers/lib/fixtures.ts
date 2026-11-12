// Demo fixtures — T16/T17 visual proof only.
// Static, clearly fake data (`*.example`) used by the public demo pages
// and the Playwright proof captures. Never written to the DB, never
// sent anywhere.
import type { SupplierListRow } from './validation';
import type { ExistingVendorRef } from './validation';

export const DEMO_SUPPLIERS: SupplierListRow[] = [
  {
    id: 'demo-vendor-gz',
    legalName: 'Guangzhou Cut & Sew Ltd',
    email: 'ops@gzcutsew.example',
    website: 'https://gzcutsew.example',
    isActive: true,
    zones: ['CN'],
    capabilities: [
      { category: 'cut&sew', techniques: ['overlock', 'coverstitch'], countryCode: 'CN' },
      { category: 'tops', techniques: ['screen print'], countryCode: 'CN' },
    ],
    memberStatus: 'active',
  },
  {
    id: 'demo-vendor-porto',
    legalName: 'Porto Knit Mill',
    email: 'ops@portoknit.example',
    website: 'https://portoknit.example',
    isActive: true,
    zones: ['PT'],
    capabilities: [{ category: 'knitwear', techniques: ['fully-fashioned'], countryCode: 'PT' }],
    memberStatus: 'active',
  },
  {
    id: 'demo-vendor-istanbul',
    legalName: 'Istanbul Denim Atelier',
    email: 'hello@istdenim.example',
    website: 'https://istdenim.example',
    isActive: true,
    zones: ['TR'],
    capabilities: [{ category: 'denim', techniques: ['stone wash', 'laser'], countryCode: 'TR' }],
    memberStatus: 'invited',
  },
  {
    id: 'demo-vendor-unzoned',
    legalName: 'Unzoned Trading Co',
    email: 'sales@unzoned.example',
    website: 'https://unzoned.example',
    isActive: true,
    zones: [],
    capabilities: [{ category: 'cut&sew', techniques: [], countryCode: null }],
    memberStatus: null,
  },
];

export const DEMO_EXISTING_VENDORS: ExistingVendorRef[] = DEMO_SUPPLIERS.map((s) => ({
  id: s.id,
  legalName: s.legalName,
  email: s.email,
  website: s.website,
}));
