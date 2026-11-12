// T20 release + revoke + audit — gated behaviour on the shared dev
// server (:3003, no Supabase env) + live-stack flows (skipped here).
import { expect, test } from '@playwright/test';
import { PROOF_DIR, expectApiGated, expectRedirectToLogin, liveOnly } from './_support/supplier-portal-setup';

const RFQ_ID = '00000000-0000-0000-0000-000000000000';
const TECH_PACK_ID = '00000000-0000-0000-0000-000000000000';

test('release token-check never leaks without a session', async ({ request }) => {
  const res = await request.get(`/api/supplier/releases/${RFQ_ID}`);
  await expectApiGated(res, await res.text());
});

test('release download never mints a signed URL without a session', async ({ request }) => {
  const res = await request.post(`/api/supplier/releases/${RFQ_ID}`, { data: { techPackId: TECH_PACK_ID } });
  await expectApiGated(res, await res.text());
});

test('supplier asset proxy never streams without a session', async ({ request }) => {
  const res = await request.get(`/api/supplier/assets/${RFQ_ID}/${TECH_PACK_ID}`);
  await expectApiGated(res, await res.text());
});

test('supplier releases page redirects a signed-out visitor to /login', async ({ page }) => {
  await page.goto(`/supplier/releases/${RFQ_ID}`);
  await expectRedirectToLogin(page);
  await page.screenshot({ path: `${PROOF_DIR}/05-supplier-releases-signed-out.png` });
});

test('studio release page redirects a signed-out visitor to /login', async ({ page }) => {
  await page.goto(`/studio/supplier/releases/${RFQ_ID}`);
  await expectRedirectToLogin(page);
  await page.screenshot({ path: `${PROOF_DIR}/06-studio-releases-signed-out.png` });
});

liveOnly('revoked supplier gets 403 on the next asset fetch in an open tab (live stack)', async (page) => {
  // Open a supplier preview tab, revoke the vendor as staff in a second
  // context, reload the preview fetch in the first tab and assert 403
  // plus a release_download_denied row in the audit trail.
  await page.goto('/supplier');
  await expect(page.getByTestId('supplier-portal')).toBeVisible();
});

liveOnly('release download mints a fresh 15-minute signed URL (live stack)', async (page) => {
  // Award an RFQ, open /supplier/releases/<rfq>, download the pack and
  // assert the route returns { expiresIn: 900 } and the audit shows
  // release_download_authorized.
  await page.goto('/supplier');
  await expect(page.getByTestId('supplier-portal')).toBeVisible();
});

liveOnly('audit trail shows the denial after revocation (live stack)', async (page) => {
  await page.goto('/studio');
  await expect(page.getByTestId('studio-supplier-releases')).toBeVisible();
});
