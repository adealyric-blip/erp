// Studio → Library (T10). Reference data for the design studio: seasons,
// size ranges, POM library, materials, garment templates, and flats.
import Link from 'next/link';
import { requireStaff } from '@/server/auth/requireStaff';

const SECTIONS = [
  { href: '/studio/library/seasons', title: 'Seasons', desc: 'SS27, FW27… — planning, active, closed, archived.' },
  { href: '/studio/library/size-ranges', title: 'Size ranges', desc: 'XS–XL with a base size (base size must be in the range).' },
  { href: '/studio/library/poms', title: 'POM library', desc: 'Points of measure with tolerances and diagram uploads.' },
  { href: '/studio/library/materials', title: 'Materials', desc: 'Fabrics, trims, labels — certifications and nominated vendor.' },
  { href: '/studio/library/templates', title: 'Garment templates', desc: 'Blanks with print areas, GLB model and turntable frames.' },
  { href: '/studio/library/flats', title: 'Flats', desc: 'Generated + licensed flats with their license badge.' },
];

export default async function LibraryPage() {
  await requireStaff();
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold">Library</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Reference data every design, tech pack and RFQ builds on. Entries are per workspace.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded border p-4 hover:border-black">
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-neutral-600">{s.desc}</p>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm">
        <Link href="/studio/assets" className="underline">
          Assets
        </Link>{' '}
        — uploads live in the private design-private bucket.
      </p>
    </main>
  );
}
