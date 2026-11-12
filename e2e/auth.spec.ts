import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

/**
 * auth.spec.ts — T04 acceptance tests. Requires the local stack:
 *   1. `supabase start` (local Supabase with the dev seed)
 *   2. `pnpm dev` with the local Supabase env vars, or PLAYWRIGHT_BASE_URL
 *      pointing at a running web app:
 *        NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
 *        NEXT_PUBLIC_SITE_URL=http://localhost:3000
 *      Mailpit (local SMTP) must be up — OTP codes are read back from
 *      http://127.0.0.1:54324/api/v1/messages (MAILPIT_URL override).
 *
 * Users come from supabase/seed: owner@atelier.test (staff, tenant owner,
 * no MFA enrolled at seed time) and supplier@atelier.test (active portal
 * member, no tenant membership).
 *
 * Serial: the owner enrolls MFA in test 2, so test 1 (no MFA -> /mfa)
 * must run first, and later owner logins are aal1 again until re-verified.
 */

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const OWNER = 'owner@atelier.test';
const SUPPLIER = 'supplier@atelier.test';

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

/** RFC 6238 TOTP, 6 digits, 30 s step, SHA-1 (matches Gotrue TOTP). */
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

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
}

/** Latest 6-digit code sent to `email`, polling mailpit. */
async function getOtpCode(email: string): Promise<string> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=20`).then((r) => r.json());
    const messages: MailpitMessage[] = list.messages ?? [];
    const mine = messages.find((m) => m.To.some((t) => t.Address === email));
    if (mine) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${mine.ID}`).then((r) => r.json());
      const body: string = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`;
      const match = body.match(/\b(\d{6})\b/);
      if (match?.[1]) return match[1];
    }
    if (Date.now() > deadline) throw new Error(`no OTP email found for ${email}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

async function loginWithOtp(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('you@factory.example').fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in code' }).click();
  await expect(page.getByPlaceholder('123456')).toBeVisible();
  const code = await getOtpCode(email);
  await page.getByPlaceholder('123456').fill(code);
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  // Lands on /studio (staff, redirected to /mfa by the proxy) or /supplier.
  await page.waitForURL(/\/(studio|supplier|mfa)/);
}

async function enrollTotp(page: Page): Promise<void> {
  await page.goto('/mfa');
  await page.getByRole('button', { name: 'Set up authenticator app' }).click();
  await expect(page.getByTestId('totp-secret')).toBeVisible();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim();
  if (!secret) throw new Error('MFA page did not show a TOTP secret');
  await page.getByPlaceholder('123456').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Verify and continue to the studio' }).click();
  await expect(page).toHaveURL(/\/studio/);
}

test.describe.serial('auth guards', () => {
  test('unauthenticated /studio redirects to /login', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login/);
  });

  test('staff without MFA is redirected to /mfa', async ({ page }) => {
    await loginWithOtp(page, OWNER);
    await expect(page).toHaveURL(/\/mfa/);
    await expect(page.getByText('Set up authenticator app')).toBeVisible();
  });

  test('staff with MFA reaches /studio', async ({ page }) => {
    await loginWithOtp(page, OWNER);
    await enrollTotp(page);
    await expect(page.getByRole('heading', { name: 'Studio' })).toBeVisible();
  });

  test('supplier cannot open /studio (404, not 403)', async ({ page }) => {
    await loginWithOtp(page, SUPPLIER);
    // Supplier must reach aal2 first (proxy aal-gates /studio), then the
    // membership check 404s — a fully-authenticated supplier still gets
    // "not found", never a login loop or a 403.
    await enrollTotp(page);
    const response = await page.goto('/studio');
    expect(response?.status()).toBe(404);
  });

  test('supplier can open /supplier', async ({ page }) => {
    await loginWithOtp(page, SUPPLIER);
    await page.goto('/supplier');
    await expect(page.getByRole('heading', { name: 'My RFQs' })).toBeVisible();
  });

  test('staff cannot open /supplier unless also a portal member (404)', async ({ page }) => {
    await loginWithOtp(page, OWNER);
    const response = await page.goto('/supplier');
    expect(response?.status()).toBe(404);
  });
});
