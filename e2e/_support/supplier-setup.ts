// Shared helpers for the Lane 1 (T16 + T17) Playwright specs.
//
// There is NO local Supabase stack on this VM (no Docker / Supabase CLI)
// and the shared dev server on :3003 has NO Supabase env, so the proxy
// fails closed: guarded pages redirect to /login and /api/* returns 500
// JSON ("auth not configured"). The specs therefore assert the GATED
// behaviour that is verifiable here, drive the real components through
// the fixture demo pages (/demo/suppliers, /demo/rfqs) for the
// interactive flows, and SKIP the live-stack flows.
//
// To run the live flows: start the local stack (`supabase start`, seed
// with owner@atelier.test + a seeded vendor), run the dev server with
// the local Supabase env, and set SUPPLIER_E2E_LIVE=1.
//
// Login helpers are adapted from e2e/studio.spec.ts (same OTP + TOTP
// enrollment flow for owner@atelier.test).
import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** True only when the live stack is up and the caller asked for live tests. */
export const LIVE_STACK = process.env.SUPPLIER_E2E_LIVE === '1';

export const PROOF_DIR = 'docs/phase3-proof/lane-1';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
export const OWNER = 'owner@atelier.test';

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

export async function loginStaff(page: Page): Promise<void> {
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

/** A guarded page must send a signed-out visitor to /login. */
export async function expectRedirectToLogin(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);
}

/** Find a Mailpit message to `email` whose body matches `pattern`; returns the full body text. */
export async function getMailpitBody(email: string, pattern: RegExp, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const list = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`).then((r) => r.json());
    const mine = (list.messages ?? []).find((m: { To: Array<{ Address: string }> }) =>
      m.To.some((t) => t.Address === email),
    );
    if (mine) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${mine.ID}`).then((r) => r.json());
      const body = `${detail.Text ?? ''}\n${detail.HTML ?? ''}`;
      if (pattern.test(body)) return body;
    }
    if (Date.now() > deadline) throw new Error(`no Mailpit message for ${email} matching ${pattern}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

/**
 * T16 accept: the invite token appears in NO log line. Reads the dev
 * server log (DEV_LOG_PATH, default dev.log) and asserts the token
 * string is absent. Returns false when there is no log file to check
 * (caller must treat that as "not verified", not "passed").
 */
export function tokenAbsentFromLogs(token: string): { checked: boolean; found: boolean } {
  const logPath = process.env.DEV_LOG_PATH ?? 'dev.log';
  if (!fs.existsSync(logPath)) return { checked: false, found: false };
  const content = fs.readFileSync(logPath, 'utf8');
  return { checked: true, found: content.includes(token) };
}

/** Mark a test live-only: skipped with a reason when there is no stack. */
export function liveOnly(name: string, fn: (page: Page) => Promise<void>) {
  test(name, async ({ page }) => {
    test.skip(!LIVE_STACK, 'needs the local Supabase stack (SUPPLIER_E2E_LIVE=1)');
    await fn(page);
  });
}
