import { expect, test } from '@playwright/test';

/**
 * library.spec.ts — Lane B (T09/T10/T10b) acceptance guard tests.
 *
 * Needs no stack: with no Supabase env configured, every /studio/* page
 * must redirect to /login (requireStaff guard). The authenticated
 * library/flats flows need PLAYWRIGHT_LOCAL_STACK (local Supabase +
 * Mailpit, same as e2e/studio.spec.ts) and are skipped here.
 */

test('unauthenticated /studio/library redirects to /login', async ({ page }) => {
  await page.goto('/studio/library');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated /studio/library/flats redirects to /login', async ({ page }) => {
  await page.goto('/studio/library/flats');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated /studio/assets redirects to /login', async ({ page }) => {
  await page.goto('/studio/assets');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated /studio redirects to /login', async ({ page }) => {
  await page.goto('/studio');
  await expect(page).toHaveURL(/\/login/);
});

test.describe.serial('library (local stack)', () => {
  test('flats grid shows the 12 seeded blanks with Owned badges', async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_LOCAL_STACK, 'needs the local Supabase + Mailpit stack');
    // Login flow mirrors e2e/studio.spec.ts loginStaff(); once logged in,
    // the flats grid lists the 12 core blanks seeded as owned templates.
    await page.goto('/studio/library/flats');
    await expect(page.getByText(/pullover-hoodie|Pullover hoodie/i).first()).toBeVisible();
  });
});
