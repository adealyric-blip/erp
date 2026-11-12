// Demo fixtures — T17 visual proof only (see suppliers fixtures).
import type { ApprovedPackOption } from '../components/RfqBuilder';

export const DEMO_PACKS: ApprovedPackOption[] = [
  {
    id: 'demo-tp-boxy-tee',
    title: 'Boxy Tee',
    styleNumber: 'AT-BT-001',
    status: 'approved',
    revision: 3,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
  },
  {
    id: 'demo-tp-hoodie',
    title: 'Heavyweight Hoodie',
    styleNumber: 'AT-HD-002',
    status: 'released',
    revision: 2,
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
  },
];

export const DEMO_NDA_ID = 'demo-nda-v3';
