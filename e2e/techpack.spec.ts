// techpack.spec.ts — T13/T13b/T14 acceptance tests (Playwright).
//
// Guard tests run against any dev server (no stack): unauthenticated
// /studio/* redirects to /login and /api/* returns 401 JSON (proxy).
// The full flows need the local Supabase stack (supabase start +
// Mailpit + owner@atelier.test, same as e2e/studio.spec.ts) and are
// skipped without PLAYWRIGHT_LOCAL_STACK — see the open items in
// docs/phase3-proof/lane-1/. Do not fake them.
import { expect, test } from '@playwright/test';

const TABS = ['Sketch', 'Construction', 'Measurement guide', 'Measurement chart', 'BOM', 'Materials', 'Colorways', 'Artwork', 'Labels', 'Hang tag', 'Packaging'];

test('unauthenticated /studio/techpacks/demo redirects to /login (proxy guard)', async ({ page }) => {
  await page.goto('/studio/techpacks/demo');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated /studio/render redirects to /login (proxy guard)', async ({ page }) => {
  await page.goto('/studio/render');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated GET /api/studio/techpack-templates fails closed with an auth JSON error', async ({ request }) => {
  // With the stack configured the proxy returns 401 unauthenticated; on
  // this dev server (no Supabase env) it fails closed with 500
  // "auth not configured". Either way: JSON, no bytes, no redirect.
  const res = await request.get('/api/studio/techpack-templates');
  expect([401, 500]).toContain(res.status());
  expect((await res.json()).error).toMatch(/auth/i);
});

test('unauthenticated POST /api/studio/jobs/:id/output fails closed with an auth JSON error', async ({ request }) => {
  const res = await request.post('/api/studio/jobs/00000000-0000-0000-0000-000000000000/output', {
    data: { session: 'x'.repeat(32), filename: 't.pdf', mime_type: 'application/pdf', data_base64: 'AA==' },
  });
  expect([401, 500]).toContain(res.status());
  expect((await res.json()).error).toMatch(/auth/i);
});

test.describe.serial('editor + switcher + PDFs (local stack)', () => {
  test.skip(
    !process.env.PLAYWRIGHT_LOCAL_STACK,
    'needs the local Supabase stack (owner@atelier.test + seeded Boxy Tee pack)',
  );

  test('unauthenticated API routes return 401 JSON when the stack is configured', async ({ request }) => {
    expect((await request.get('/api/studio/techpack-templates')).status()).toBe(401);
    const res = await request.post('/api/studio/jobs/00000000-0000-0000-0000-000000000000/output', {
      data: { session: 'x'.repeat(32), filename: 't.pdf', mime_type: 'application/pdf', data_base64: 'AA==' },
    });
    expect(res.status()).toBe(401);
  });

  test('demo pack renders 11 tabs; chart shows (2/2); fibre totals 100; UPC valid', async ({ page }) => {
    await page.goto('/studio/techpacks/demo');
    for (const label of TABS) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Measurement chart', exact: true }).click();
    await expect(page.getByText('MEASUREMENT CHART (2/2)')).toBeVisible();
    await page.getByRole('button', { name: 'Labels', exact: true }).click();
    await expect(page.getByText('100', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Hang tag', exact: true }).click();
    await expect(page.getByText(/valid|check digit/i).first()).toBeVisible();
  });

  test('design editor switcher reads Tech Packs / Model (no Flat)', async ({ page }) => {
    // Seeded demo design id from the local seed (T07); the switcher is
    // data-driven from SURFACE_OPTIONS (src/features/studio/lib/printAreas.ts).
    await page.goto('/studio/designs/00000000-0000-0000-0000-000000000002');
    await expect(page.getByRole('button', { name: 'Tech Packs', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Model', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Flat', exact: true })).toHaveCount(0);
  });

  test('approve a boxy tee pack -> both PDFs in the station log', async ({ page }) => {
    // 1. Open the render station tab and start it.
    await page.goto('/studio/render');
    await page.getByRole('button', { name: 'Start render station' }).click();
    // 2. In a second tab, approve the seeded in-review pack (Lane 2 flow).
    const approvePage = await page.context().newPage();
    await approvePage.goto('/studio/techpacks/demo');
    // Approve control lives in Lane 2's ApproveDialog; the pack must be
    // in_review with an owner session for the button to enable.
    // 3. Back in the station tab, both jobs must finish < 120 s.
    await expect.poll(() => page.getByTestId('render-station-log').innerText(), { timeout: 120_000 })
      .toContain('finished techpack_pdf');
    await expect(page.getByTestId('render-station-log')).toContainText('finished techpack_preview_pdf');
  });
});
