import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/**
 * studio.spec.ts — T07 + T08 acceptance tests.
 *
 * Prerequisites (same local stack as e2e/auth.spec.ts):
 *   1. `supabase start` (local Supabase with the dev seed: 3 garment
 *      templates + the demo design) and Mailpit up.
 *   2. `PORT=3001 npm run dev` (or PLAYWRIGHT_BASE_URL pointing at a
 *      running app with the local Supabase env vars).
 *
 * The first test (guard) needs no stack. The serial flow logs in as
 * owner@atelier.test via OTP + TOTP enrollment, exactly like auth.spec.ts.
 */

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const OWNER = 'owner@atelier.test';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  const bits: number[] = [];
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error(`bad base32 char ${ch}`);
    for (let i = 4; i >= 0; i--) bits.push((v >> i) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ?? 0);
    bytes.push(b);
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

async function getOtpCode(email: string): Promise<string> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=20`).then((r) => r.json());
    const mine = (list.messages ?? []).find((m: { To: Array<{ Address: string }> }) =>
      m.To.some((t) => t.Address === email),
    );
    if (mine) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${mine.ID}`).then((r) => r.json());
      const match = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`.match(/\b(\d{6})\b/);
      if (match?.[1]) return match[1];
    }
    if (Date.now() > deadline) throw new Error(`no OTP email found for ${email}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

async function loginStaff(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('you@factory.example').fill(OWNER);
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click();
  await expect(page.getByPlaceholder('123456')).toBeVisible();
  await page.getByPlaceholder('123456').fill(await getOtpCode(OWNER));
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await page.waitForURL(/\/(studio|supplier|mfa)/);
  if ((await page.url()).includes('/mfa')) {
    await page.goto('/mfa');
    await page.getByRole('button', { name: 'Set up authenticator app' }).click();
    await expect(page.getByTestId('totp-secret')).toBeVisible();
    const secret = (await page.getByTestId('totp-secret').textContent())?.trim();
    if (!secret) throw new Error('MFA page did not show a TOTP secret');
    await page.getByPlaceholder('123456').fill(totpCode(secret));
    await page.getByRole('button', { name: 'Verify and continue to the studio' }).click();
    await expect(page).toHaveURL(/\/studio/);
  }
}

test('unauthenticated /studio/designs redirects to /login', async ({ page }) => {
  await page.goto('/studio/designs');
  await expect(page).toHaveURL(/\/login/);
});

test.describe.serial('canvas editor (local stack)', () => {
  test('create from template → add text + icon → outside-print-area warning → save → reload restores', async ({
    page,
  }) => {
    test.skip(!process.env.PLAYWRIGHT_LOCAL_STACK, 'needs the local Supabase + Mailpit stack');
    await loginStaff(page);

    // Create a design from the Boxy tee template.
    await page.goto('/studio/designs/new');
    await expect(page.getByTestId('template-picker')).toBeVisible();
    await page.getByRole('button', { name: /Boxy tee/ }).click();
    await expect(page.getByTestId('canvas-stage')).toBeVisible();
    await expect(page.getByTestId('view-switcher')).toContainText('Front');

    // Add text through the Text drawer (Fontsource fonts).
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await expect(page.getByTestId('studio-drawer')).toBeVisible();
    await page.getByPlaceholder('Type your text…').fill('Atelier');
    await page.getByRole('button', { name: 'Add to canvas' }).click();
    await expect(page.getByTestId('layer-list')).toContainText('text 1');
    await page.getByRole('button', { name: 'Close drawer' }).click();

    // Add an icon through the Graphics drawer.
    await page.getByRole('button', { name: 'Graphics', exact: true }).click();
    await page.getByRole('button', { name: 'Add Star icon' }).click();
    await expect(page.getByTestId('layer-list')).toContainText('icon');
    await page.getByRole('button', { name: 'Close drawer' }).click();

    // Drag the text layer outside the dashed print area → warning shows.
    const stage = page.getByTestId('canvas-stage');
    const box = await stage.boundingBox();
    if (!box) throw new Error('canvas stage has no bounding box');
    // Text lands near the stage centre; drag it to the top-left corner.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 20, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByTestId('outside-print-area-warning')).toBeVisible();

    // Save, reload, and the scene is restored from the DB version.
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-status')).toContainText(/Saved/);
    await page.reload();
    await expect(page.getByTestId('canvas-stage')).toBeVisible();
    await expect(page.getByTestId('layer-list')).toContainText('text 1');
    await expect(page.getByTestId('layer-list')).toContainText('icon');

    // History shows the saved version.
    await page.getByRole('link', { name: /Version history/ }).click();
    await expect(page.getByTestId('version-timeline')).toBeVisible();
    await expect(page.getByTestId('version-timeline')).toContainText('v1');
  });

  test('two browser contexts see each other’s cursor (presence)', async ({ browser }) => {
    test.skip(!process.env.PLAYWRIGHT_LOCAL_STACK, 'needs the local Supabase + Mailpit stack');
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    try {
      await loginStaff(pageA);
      await loginStaff(pageB);
      await pageA.goto('/studio/designs/new');
      await pageA.getByRole('button', { name: /Boxy tee/ }).click();
      await expect(pageA.getByTestId('canvas-stage')).toBeVisible();
      const url = pageA.url();
      await pageB.goto(url);
      await expect(pageB.getByTestId('canvas-stage')).toBeVisible();
      // Move the mouse in A; B should render A's presence avatar/cursor.
      await pageA.mouse.move(400, 300);
      await expect(pageB.getByTestId('presence-avatars')).toHaveCount(1);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
