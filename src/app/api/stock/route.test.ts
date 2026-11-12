// T06 unit test: /api/stock handler returns curated images with attribution.
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('/api/stock', () => {
  it('returns curated Unsplash images with provider + attribution (no keys configured)', async () => {
    const res = await GET(new Request('http://localhost:3001/api/stock?q=tshirt&limit=4'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      images: Array<{ id: string; url: string; thumbUrl: string; alt: string; provider: string; attribution: string }>;
      provider: string;
    };
    expect(body.images.length).toBeGreaterThan(0);
    expect(body.images.length).toBeLessThanOrEqual(4);
    for (const img of body.images) {
      expect(img.url).toContain('images.unsplash.com');
      expect(img.attribution).toBeTruthy();
      expect(img.provider).toBe('unsplash-direct');
    }
    expect(body.provider).toContain('unsplash-direct');
  });

  it('falls back to the full curated set for an unmatched query', async () => {
    const res = await GET(new Request('http://localhost:3001/api/stock?q=zzzz-no-match&limit=3'));
    const body = (await res.json()) as { images: unknown[] };
    expect(body.images.length).toBe(3);
  });
});
