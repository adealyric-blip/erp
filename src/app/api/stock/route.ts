// /api/stock — T07: stock images for the Images drawer panel.
// Unsplash (UNSPLASH_ACCESS_KEY) first, then Pexels (PEXELS_API_KEY); with
// neither key configured it returns a curated set of public Unsplash photo
// URLs (same images.unsplash.com pattern the existing canvas already uses)
// and labels the provider honestly. Keys stay server-side; the client only
// ever sees image URLs + attribution.
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StockImage {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  provider: string;
  attribution: string;
}

/** Curated public Unsplash photos (no key needed) — garments / flat-lay. */
const CURATED: Array<{ id: string; alt: string; by: string }> = [
  { id: '1521572163474-6864f9cf17ab', alt: 'White t-shirt flat lay', by: 'Unsplash' },
  { id: '1576566588028-4147f3842f27', alt: 'T-shirt on hanger', by: 'Unsplash' },
  { id: '1503341504253-dff4815485f1', alt: 'Person in white tee', by: 'Unsplash' },
  { id: '1556821840-3a63f95609a7', alt: 'Hoodie flat lay', by: 'Unsplash' },
  { id: '1620799140408-edc6dcb6d633', alt: 'Folded t-shirts', by: 'Unsplash' },
  { id: '1618354691373-d851c5c3a990', alt: 'T-shirt mockup', by: 'Unsplash' },
  { id: '1583743814966-8936f5b7be1a', alt: 'Man in grey tee', by: 'Unsplash' },
  { id: '1596755094514-f87e34085b2c', alt: 'White shirt detail', by: 'Unsplash' },
  { id: '1562157873-818bc0726f68', alt: 'White tee on white', by: 'Unsplash' },
  { id: '1523381210434-271e8be1f52b', alt: 'Folded tees stack', by: 'Unsplash' },
  { id: '1578932750294-f5075e85f44a', alt: 'Hoodie on hanger', by: 'Unsplash' },
  { id: '1618354691438-25bc04584c23', alt: 'Tee back view', by: 'Unsplash' },
];

function curated(q: string, limit: number): StockImage[] {
  const query = q.trim().toLowerCase();
  const pool = query
    ? CURATED.filter((c) => c.alt.toLowerCase().includes(query))
    : CURATED;
  const list = (pool.length > 0 ? pool : CURATED).slice(0, limit);
  return list.map((c) => ({
    id: c.id,
    url: `https://images.unsplash.com/photo-${c.id}?auto=format&fit=crop&q=80&w=800`,
    thumbUrl: `https://images.unsplash.com/photo-${c.id}?auto=format&fit=crop&q=80&w=300`,
    alt: c.alt,
    provider: 'unsplash-direct',
    attribution: `Photo via ${c.by}`,
  }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? 'tshirt';
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get('limit') ?? 12) || 12));

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${limit}&client_id=${unsplashKey}`,
        { headers: { Accept: 'application/json' } },
      );
      if (res.ok) {
        const body = (await res.json()) as {
          results?: Array<{ id: string; urls?: { regular?: string; small?: string }; alt_description?: string | null; user?: { name?: string } }>;
        };
        const images: StockImage[] = (body.results ?? []).map((r) => ({
          id: r.id,
          url: r.urls?.regular ?? '',
          thumbUrl: r.urls?.small ?? r.urls?.regular ?? '',
          alt: r.alt_description ?? 'Stock photo',
          provider: 'unsplash',
          attribution: `Photo by ${r.user?.name ?? 'Unknown'} on Unsplash`,
        }));
        return NextResponse.json({ images, provider: 'unsplash' });
      }
    } catch {
      /* fall through to the next provider */
    }
  }

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${limit}`,
        { headers: { Authorization: pexelsKey } },
      );
      if (res.ok) {
        const body = (await res.json()) as {
          photos?: Array<{ id: number; src?: { large?: string; medium?: string }; alt?: string | null; photographer?: string }>;
        };
        const images: StockImage[] = (body.photos ?? []).map((p) => ({
          id: String(p.id),
          url: p.src?.large ?? '',
          thumbUrl: p.src?.medium ?? p.src?.large ?? '',
          alt: p.alt ?? 'Stock photo',
          provider: 'pexels',
          attribution: `Photo by ${p.photographer ?? 'Unknown'} on Pexels`,
        }));
        return NextResponse.json({ images, provider: 'pexels' });
      }
    } catch {
      /* fall through to curated */
    }
  }

  return NextResponse.json({ images: curated(q, limit), provider: 'unsplash-direct (no API key configured)' });
}
