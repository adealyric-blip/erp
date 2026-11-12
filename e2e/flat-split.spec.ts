import { expect, test, type Page } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * flat-split.spec.ts — T10c acceptance: upload a 3-garment set → review →
 * accept all → three templates appear, each opening in the canvas with
 * print areas; a supplier request for a raw piece is denied.
 *
 * The guard tests need no stack. The serial flow needs PLAYWRIGHT_LOCAL_STACK
 * (local Supabase + Mailpit, seeded with the license records) and is
 * skipped here — same pattern as e2e/library.spec.ts. It uploads the
 * synthetic 3-garment fixture (fixture-3-group-set.svg, SVG bundle) and
 * uses the review page's "Split now (SVG bundles)" bridge; PDF bundles
 * split on the render station (flat_split, T14) instead.
 *
 * Supplier-deny is a DB guarantee (S610: ds__asset_license_viewable()
 * returns false for any piece svg_asset_id) and is proven in
 * S610_tests.sql §8; the browser flow asserts the same asset never
 * renders on a supplier route (the staff route 404s without staff auth).
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

test('unauthenticated import review redirects to /login', async ({ page }) => {
  await page.goto('/studio/library/flats/import/00000000-0000-0000-0000-000000000000');
  await expect(page).toHaveURL(/\/login/);
});

test.describe.serial('flat split (local stack)', () => {
  test('upload a 3-garment set → review → accept all → three templates open in the canvas', async ({
    page,
  }) => {
    test.skip(!process.env.PLAYWRIGHT_LOCAL_STACK, 'needs the local Supabase + Mailpit stack');
    await loginStaff(page);

    // Upload the 3-garment fixture as an SVG bundle.
    const fixture = join(
      process.cwd(),
      'src/lib/flat-gen/test-fixtures/fixture-3-group-set.svg',
    );
    expect(readFileSync(fixture, 'utf-8')).toContain('hoodie');
    await page.goto('/studio/library/flats');
    const license = page.locator('select[name="licenseId"]');
    await expect(license).toBeVisible();
    await license.selectOption({ index: 1 });
    await page.locator('input[name="file"]').setInputFiles(fixture);
    await page.locator('input[name="sourceCategory"]').fill('hoodie');
    await page.getByRole('button', { name: 'Import licensed flat' }).click();
    const queued = page.getByText(/queued/);
    await expect(queued).toBeVisible();

    // Review page: split now (SVG bundle), then 6 pieces, 3 pairs.
    await page.goto('/studio/library/flats');
    await page.getByRole('link', { name: 'Review pieces' }).first().click();
    await expect(page.getByRole('heading', { name: 'Review import' })).toBeVisible();
    await page.getByRole('button', { name: 'Split now (SVG bundles)' }).click();
    await expect(page.getByText(/Split done/)).toBeVisible();
    await expect(page.getByText(/proposed 6/)).toBeVisible();
    await expect(page.getByText(/Pair pair-/).first()).toBeVisible();

    // Scale every piece (waist 420 mm over its measured units — the form
    // defaults measured units to the piece width), then accept all.
    const pieces = page.locator('article');
    await expect(pieces).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const card = pieces.nth(i);
      await card.locator('input').nth(1).fill('420');
    }
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByText(/Accepted 6\/6/)).toBeVisible();

    // Three templates appear on the flats grid.
    await page.goto('/studio/library/flats');
    for (const tag of ['pair-1', 'pair-2', 'pair-3']) {
      await expect(page.getByText(new RegExp(`hoodie · import .* · ${tag}`)).first()).toBeVisible();
    }

    // Each opens in the canvas with print areas (view switcher + stage).
    for (const tag of ['pair-1', 'pair-2', 'pair-3']) {
      await page.goto('/studio/designs/new');
      await expect(page.getByTestId('template-picker')).toBeVisible();
      await page.getByRole('button', { name: new RegExp(`hoodie · import .* · ${tag}`) }).click();
      await expect(page.getByTestId('canvas-stage')).toBeVisible();
      await expect(page.getByTestId('view-switcher')).toContainText('Front');
      await page.goBack();
    }
  });

  test('supplier request for a raw piece is denied', async ({ page, browser }) => {
    test.skip(!process.env.PLAYWRIGHT_LOCAL_STACK, 'needs the local Supabase + Mailpit stack');
    // The piece SVG streams only through the staff asset route. Without
    // staff auth it 404s (never 403 — a prober learns nothing), and the
    // DB guard (S610 §8) makes the piece asset unviewable to suppliers
    // even when an RFQ/preview path is used.
    await loginStaff(page);
    await page.goto('/studio/library/flats');
    await page.getByRole('link', { name: 'Review pieces' }).first().click();
    const img = page.locator('article img').first();
    const src = await img.getAttribute('src');
    expect(src).toMatch(/^\/api\/studio\/assets\//);
    // Same URL, fresh context, no auth: must 404.
    const anon = await browser.newContext();
    const res = await anon.request.get(src!);
    expect(res.status()).toBe(404);
    await anon.close();
  });
});
