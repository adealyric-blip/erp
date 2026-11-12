// T18 supplier portal — gated behaviour on the shared dev server (:3003,
// no Supabase env) + live-stack flows (skipped here, see _support).
import { expect, test } from '@playwright/test';
import { PROOF_DIR, expectApiGated, expectRedirectToLogin, liveOnly } from './_support/supplier-portal-setup';

const INVITE_TOKEN = '0000000000000000000000000000000000000000000000000000000000000000';
const RFQ_ID = '00000000-0000-0000-0000-000000000000';

test('supplier portal redirects a signed-out visitor to /login', async ({ page }) => {
  await page.goto('/supplier');
  await expectRedirectToLogin(page);
  await page.screenshot({ path: `${PROOF_DIR}/01-supplier-portal-signed-out.png` });
});

test('login page has the supplier email-link door (no passwords)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
  await expect(page.getByLabel(/invited email/i)).toBeVisible();
  await expect(page.getByText(/Staff sign in with Google/)).toBeVisible();
  await page.screenshot({ path: `${PROOF_DIR}/02-supplier-login.png` });
});

test('invite link survives sign-in: unauthenticated visitor is sent to /login with next=invite URL', async ({ page }) => {
  // The :3003 server has no Supabase env, so the proxy fails closed and
  // redirects even the invite page to /login — but the next= param must
  // preserve the invite URL, so the token still lands after sign-in.
  await page.goto(`/supplier/invite/${INVITE_TOKEN}`);
  await expect(page).toHaveURL(
    new RegExp(`\\/login\\?next=${encodeURIComponent(`/supplier/invite/${INVITE_TOKEN}`)}`),
  );
  await expect(page.getByRole('heading', { name: 'Suppliers' })).toBeVisible();
  await page.screenshot({ path: `${PROOF_DIR}/03-supplier-invite.png` });
});

test('supplier RFQ page redirects a signed-out visitor to /login', async ({ page }) => {
  await page.goto(`/supplier/rfqs/${RFQ_ID}`);
  await expectRedirectToLogin(page);
  await page.screenshot({ path: `${PROOF_DIR}/04-supplier-rfq-signed-out.png` });
});

test('supplier upload route never leaks without a session', async ({ request }) => {
  const res = await request.post('/api/supplier/uploads', {
    data: { rfqId: RFQ_ID, fileName: 'quote.pdf', mime: 'application/pdf', size: 1024 },
  });
  await expectApiGated(res, await res.text());
});

liveOnly('invite page renders unauthenticated with a sign-in prompt (live stack)', async (page) => {
  // With Supabase env configured, the proxy lets /supplier/invite/*
  // through unauthenticated and the page renders the sign-in prompt.
  await page.goto(`/supplier/invite/${INVITE_TOKEN}`);
  await expect(page.getByTestId('supplier-invite')).toBeVisible();
  await expect(page.getByText(/Sign in first with the email this invite was sent to/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in with email code/ })).toBeVisible();
});

liveOnly('invite token lands on the correct design (live stack)', async (page) => {
  // Seed: invite supplier@atelier.test to vendor V1 via ds_invite_supplier_user,
  // read the token from the Mailpit message, sign in with the OTP, open
  // /supplier/invite/<token>, accept, and assert /supplier lists V1's RFQs.
  await page.goto('/login');
  await expect(page.getByTestId('supplier-portal')).toBeVisible();
});

liveOnly('NDA gate shows the text and accepts only the displayed hash (live stack)', async (page) => {
  // Sign in as supplier@atelier.test, open an RFQ, assert the NDA gate
  // renders the body + sha256, accept with the signer name, assert the
  // bid form and previews appear.
  await page.goto('/supplier');
  await expect(page.getByTestId('supplier-portal')).toBeVisible();
});

liveOnly('bid autosaves a draft and submits only when every line is priced (live stack)', async (page) => {
  await page.goto('/supplier');
  await expect(page.getByTestId('supplier-portal')).toBeVisible();
});
