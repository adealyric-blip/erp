import { expect, test } from '@playwright/test';

/**
 * craft-headers.spec.ts — T12 Accept: "COOP/COEP present only on craft
 * paths (header test)". Runs against the Next dev server
 * (PLAYWRIGHT_BASE_URL, e.g. http://localhost:3003). No auth is available
 * in this environment, so the craft paths answer with the proxy's 307 to
 * /login — and the isolation headers must be present on that redirect,
 * and absent everywhere else.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003';

test('COOP/COEP are present on craft paths and absent elsewhere', async ({ request }) => {
  const craft = await request.get(`${baseURL}/craft/vectorcraft/index.html`, { maxRedirects: 0 });
  expect(craft.status()).toBe(307);
  expect(craft.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(craft.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  expect(craft.headers()['cross-origin-resource-policy']).toBe('same-origin');
  expect(craft.headers()['location'] ?? '').toContain('/login');

  const studio = await request.get(`${baseURL}/studio`, { maxRedirects: 0 });
  expect(studio.status()).toBe(307);
  expect(studio.headers()['cross-origin-opener-policy']).toBeUndefined();
  expect(studio.headers()['cross-origin-embedder-policy']).toBeUndefined();

  const home = await request.get(`${baseURL}/`);
  expect(home.status()).toBe(200);
  expect(home.headers()['cross-origin-opener-policy']).toBeUndefined();
  expect(home.headers()['cross-origin-embedder-policy']).toBeUndefined();
});

test('unauthenticated /api/craft document stream fails closed as JSON, not a redirect', async ({ request }) => {
  const res = await request.get(`${baseURL}/api/craft/vectorcraft/document/00000000-0000-0000-0000-000000000000`, {
    maxRedirects: 0,
  });
  // No Supabase env is configured on this dev server, so the proxy fails
  // closed with 500 {"error":"auth not configured"}; with Supabase
  // configured it 401s. Either way it is JSON, never a redirect to an
  // HTML login page, and the route never runs unauthenticated.
  expect([401, 500]).toContain(res.status());
  expect(res.headers()['content-type'] ?? '').toContain('application/json');
});

test('unknown craft app fails closed on the document stream', async ({ request }) => {
  const res = await request.get(`${baseURL}/api/craft/wordcraft/document/00000000-0000-0000-0000-000000000000`, {
    maxRedirects: 0,
  });
  // 404 is the route's own answer (with a session); 401/500 is the proxy
  // failing closed before the route runs (this environment). Either is
  // fail-closed; the route-level 404 needs a staff session to observe.
  expect([401, 404, 500]).toContain(res.status());
});
