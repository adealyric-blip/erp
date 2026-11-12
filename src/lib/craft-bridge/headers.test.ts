// headers.test.ts — T11/T12. COOP/COEP live ONLY on the craft paths
// (plan/05): site-wide isolation would break Google sign-in popups and
// Maps. next.config.ts is the single source; this test pins it.
import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';

describe('craft COOP/COEP headers (next.config.ts)', () => {
  it('sets isolation headers only on craft paths', async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toBeDefined();
    const bySource = new Map((headers ?? []).map((h) => [h.source, h.headers]));
    const expected = new Set([
      'Cross-Origin-Opener-Policy: same-origin',
      'Cross-Origin-Embedder-Policy: require-corp',
      'Cross-Origin-Resource-Policy: same-origin',
    ]);
    // The editor route segment is [id] in this repo; the plan names it
    // [designId]. Both source patterns are listed so the isolation headers
    // land on the real route.
    for (const source of [
      '/craft/:path*',
      '/studio/designs/:designId/craft/:app',
      '/studio/designs/:id/craft/:app',
      '/studio/render',
    ]) {
      const found = bySource.get(source);
      expect(found, source).toBeDefined();
      const keys = new Set((found ?? []).map((h) => `${h.key}: ${h.value}`));
      expect(keys).toEqual(expected);
    }
    // Nothing site-wide, nothing on /studio or /supplier.
    for (const source of bySource.keys()) {
      expect(['/', '/:path*', '/studio/:path*', '/supplier/:path*']).not.toContain(source);
    }
  });
});
