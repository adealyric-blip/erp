// suppliers.spec.ts — T16 acceptance tests (Lane 1).
//
// Guard tests run against any dev server (no stack): unauthenticated
// /studio/suppliers/* redirects to /login. The interactive flows run
// against the fixture demo pages (/demo/suppliers), which render the
// real production components with `*.example` data — no stack needed.
// The live-stack flows (invite email in Mailpit, token in no log line)
// are skipped without SUPPLIER_E2E_LIVE=1; see the open items in
// docs/phase3-proof/lane-1/. Do not fake them.
import { expect, test } from '@playwright/test';
import {
  expectRedirectToLogin,
  getMailpitBody,
  liveOnly,
  loginStaff,
  tokenAbsentFromLogs,
  PROOF_DIR,
} from './_support/supplier-setup';

test('unauthenticated /studio/suppliers redirects to /login', async ({ page }) => {
  await expectRedirectToLogin(page, '/studio/suppliers');
});

test('unauthenticated /studio/suppliers/:id redirects to /login', async ({ page }) => {
  await expectRedirectToLogin(page, '/studio/suppliers/00000000-0000-0000-0000-000000000000');
});

test('guard proof: /studio/suppliers lands on /login', async ({ page }) => {
  await page.goto('/studio/suppliers');
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: `${PROOF_DIR}/05-login-guard-suppliers.png`, fullPage: true });
});

test.describe('supplier form (demo)', () => {
  test('empty submit shows the contact-channel + legal-name errors', async ({ page }) => {
    await page.goto('/demo/suppliers');
    await page.getByTestId('supplier-new-open').click();
    await expect(page.getByTestId('supplier-drawer')).toBeVisible();
    await page.getByTestId('supplier-save').click();
    await expect(page.getByTestId('supplier-contact-error')).toContainText(/at least one contact channel/i);
    await expect(page.getByText('Legal name is required')).toBeVisible();
    // The drawer is scrollable — bring the errors into the captured frame.
    await page.getByTestId('supplier-contact-error').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${PROOF_DIR}/06-supplier-form-validation.png`, fullPage: true });
  });

  test('duplicate email warns (does not block)', async ({ page }) => {
    await page.goto('/demo/suppliers');
    await page.getByTestId('supplier-new-open').click();
    await page.getByTestId('supplier-legal-name').fill('Porto Knit Mill 2');
    await page.getByTestId('supplier-email').fill('ops@portoknit.example');
    await expect(page.getByTestId('supplier-duplicate-warning')).toContainText(/already used by “Porto Knit Mill”/);
    // The warning is not a block: the save button stays enabled.
    await expect(page.getByTestId('supplier-save')).toBeEnabled();
    await page.screenshot({ path: `${PROOF_DIR}/07-supplier-duplicate-warning.png`, fullPage: true });
  });

  test('zone editor rejects a non-ISO code', async ({ page }) => {
    await page.goto('/demo/suppliers');
    await page.getByTestId('supplier-new-open').click();
    await page.getByTestId('zone-input').fill('XX');
    await page.getByTestId('zone-add').click();
    await expect(page.getByText('“XX” is not an ISO-3166 country code')).toBeVisible();
  });

  test('zone filter narrows the directory', async ({ page }) => {
    await page.goto('/demo/suppliers');
    await page.getByTestId('supplier-zone-filter').selectOption('CN');
    await expect(page.getByTestId('supplier-card-demo-vendor-gz')).toBeVisible();
    await expect(page.getByTestId('supplier-card-demo-vendor-porto')).toBeHidden();
    await expect(page.getByTestId('supplier-active-filters')).toContainText('zone CN — 1 supplier');
    await page.screenshot({ path: `${PROOF_DIR}/08-supplier-zone-filter.png`, fullPage: true });
  });
});

test.describe.serial('invite email (local stack)', () => {
  liveOnly('invite email arrives in Mailpit; token appears in no log line', async (page) => {
    await loginStaff(page);
    // Seeded vendor (S600_tests V-001) — open its detail page and invite.
    await page.goto('/studio/suppliers');
    await expect(page.getByTestId('supplier-list')).toBeVisible();
    await page.getByRole('link', { name: /Guangzhou Cut & Sew/ }).first().click();
    await expect(page.getByTestId('supplier-detail-actions')).toBeVisible();
    await page.getByTestId('invite-email').fill('ops+invite@atelier.test');
    await page.getByTestId('invite-send').click();
    await expect(page.getByText(/invite/i)).toBeVisible();

    const body = await getMailpitBody('ops+invite@atelier.test', /\/supplier\/invite\//);
    const token = body.match(/\/supplier\/invite\/([A-Za-z0-9]+)/)?.[1];
    expect(token, 'invite email must contain /supplier/invite/{token}').toBeTruthy();
    if (token) {
      const check = tokenAbsentFromLogs(token);
      expect(check.checked, 'dev server log must exist to verify the token is absent').toBe(true);
      expect(check.found, 'invite token must appear in no log line').toBe(false);
    }
  });
});
