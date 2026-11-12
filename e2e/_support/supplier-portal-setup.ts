// Shared helpers for the Lane 2 (T18–T20) Playwright specs.
//
// There is NO local Supabase stack on this VM (no Docker / Supabase CLI)
// and the shared dev server on :3003 has NO Supabase env, so the proxy
// fails closed: /api/* returns 500 JSON ("auth not configured") and
// guarded pages redirect to /login. The specs below therefore assert the
// GATED behaviour that is verifiable here and SKIP the live-stack flows.
//
// To run the live flows: start the local stack (`supabase start`, seed
// with supplier@atelier.test + owner@atelier.test), run the dev server
// with the local Supabase env, and set SUPPLIER_E2E_LIVE=1.
import { expect, test, type Page } from '@playwright/test';

/** True only when the live stack is up and the caller asked for live tests. */
export const LIVE_STACK = process.env.SUPPLIER_E2E_LIVE === '1';

/** Mark a test live-only: skipped with a reason when there is no stack. */
export function liveOnly(name: string, fn: (page: Page) => Promise<void>) {
  test(name, async ({ page }) => {
    test.skip(!LIVE_STACK, 'needs the local Supabase stack (SUPPLIER_E2E_LIVE=1)');
    await fn(page);
  });
}

/** The dev server fails closed without Supabase env: /api/* is 401 (no
 *  session) or 500 (auth not configured). Either proves no data leaks;
 *  200 would be a failure. */
export async function expectApiGated(res: { status: () => number }, bodyText: string) {
  expect([401, 500]).toContain(res.status());
  expect(res.status()).not.toBe(200);
  expect(bodyText).not.toContain('signedUrl');
  expect(bodyText).not.toContain('supabase.co');
}

/** A guarded page must send a signed-out visitor to /login (never render
 *  supplier/staff content and never 500 with data). */
export async function expectRedirectToLogin(page: Page) {
  await expect(page).toHaveURL(/\/login/);
}

export const PROOF_DIR = 'docs/phase3-proof/lane-2';
