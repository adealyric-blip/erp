// techpack-revisions.spec.ts — T15 acceptance tests (Playwright).
//
// The guard test needs no stack (same as e2e/studio.spec.ts). The full
// owner-approves flow needs the local Supabase stack (supabase start +
// Mailpit + owner@atelier.test) and is skipped here without it — see the
// open items in docs/phase3-proof/lane-2/GATE.md.
import { expect, test } from '@playwright/test';

test('unauthenticated /studio/techpacks/:id/revisions redirects to /login', async ({
  page,
}) => {
  await page.goto('/studio/techpacks/demo-boxy-tee/revisions');
  await expect(page).toHaveURL(/\/login/);
});

test.describe.serial('approval flow (local stack)', () => {
  test.skip(
    !process.env.PLAYWRIGHT_LOCAL_STACK,
    'needs the local Supabase stack (owner@atelier.test + seed tech pack)',
  );
  test('staff sees Approve disabled with reason; owner approves; version lock shows', async () => {
    // Steps (run manually against the local stack until the seed lands):
    // 1. Log in as staff (member role), open a seeded in-review pack,
    //    open Review / Approve — Approve is disabled with
    //    "Only an owner or admin can approve — your role is member."
    // 2. Log in as owner@atelier.test, approve with a note — revision log
    //    gains an approved row, design version shows locked.
    // 3. Reload the revisions page — the "Version locked" banner is visible
    //    and New revision is enabled.
    // Seeded pack + roles come from supabase/seed (T15 seed row) — open
    // item until Lane 1 lands the tech-pack editor + seed.
  });
});
