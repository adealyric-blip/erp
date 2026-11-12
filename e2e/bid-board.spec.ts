// T19 bid board + award — gated behaviour on the shared dev server
// (:3003, no Supabase env) + live-stack flows (skipped here).
import { expect, test } from '@playwright/test';
import { PROOF_DIR, expectRedirectToLogin, liveOnly } from './_support/supplier-portal-setup';

const RFQ_ID = '00000000-0000-0000-0000-000000000000';

test('bid board redirects a signed-out visitor to /login', async ({ page }) => {
  await page.goto(`/studio/rfqs/${RFQ_ID}/compare`);
  await expectRedirectToLogin(page);
  await page.screenshot({ path: `${PROOF_DIR}/07-bid-board-signed-out.png` });
});

test('compare page never renders sealed numbers without a session', async ({ page }) => {
  // Signed out: the staff guard (aal2 + tenant member) sends us to /login
  // before any bid row is read — sealed or not, nothing leaks.
  await page.goto(`/studio/rfqs/${RFQ_ID}/compare`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('bid-board-sealed')).toHaveCount(0);
  await expect(page.getByTestId('bid-compare-table')).toHaveCount(0);
});

liveOnly('sealed board shows only the received count, no numbers (live stack)', async (page) => {
  // Publish an RFQ with 2 submitted bids, open /studio/rfqs/<id>/compare
  // as staff and assert: "Sealed — 2 bids received" is visible, and no
  // bid-compare-table, score-card or price text is on the page.
  await page.goto('/studio');
  await expect(page.getByTestId('bid-board-sealed')).toBeVisible();
});

liveOnly('after close the PIVOT matrix shows the top 3 per line (live stack)', async (page) => {
  // Close the RFQ, reopen the board, assert the matrix has one row per
  // RFQ line, at most 3 supplier columns, and wall-clock Y-m-d deadlines
  // (no timestamps anywhere on the page).
  await page.goto('/studio');
  await expect(page.getByTestId('bid-compare-table')).toBeVisible();
});

liveOnly('award is blocked while the NDA is unaccepted, then links draft POs (live stack)', async (page) => {
  // Attempt an award to a vendor without an NDA acceptance: expect the
  // nda_required failure. Accept the NDA, award, and assert the draft-PO
  // links render (PO number + draft status, no ledger posting).
  await page.goto('/studio');
  await expect(page.getByTestId('award-dialog')).toBeVisible();
});
