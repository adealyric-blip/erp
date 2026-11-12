// Lane A proof screenshots: guard, canvas, drawer (Shapes), drawer (Text).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3003';
const OUT = 'docs/phase2-proof/lane-a';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/studio/designs/new`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/01-studio-guard-login.png` });
console.log('guard url:', page.url());

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('[aria-label="Design Studio"], [title="Design Studio"]').first().click();
await page.waitForTimeout(1500);
await page.locator('text=New design').first().click({ force: true }).catch(() => undefined);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/03-design-canvas.png` });

// Open the slide drawer over the canvas via the floating + button.
const plus = page.locator('[class*="floatingPlus"]').first();
console.log('floatingPlus count:', await plus.count());
if (await plus.count()) {
  await plus.click({ force: true });
  await page.waitForTimeout(1800);
}
const slideCls = await page.evaluate(() => document.querySelector('[class*="slideTool"]')?.className ?? 'none');
console.log('slide class:', slideCls.slice(0, 160));
await page.screenshot({ path: `${OUT}/03b-drawer-open.png` });

async function openRail(label, shot) {
  const btn = page.locator('[class*="slideTool"] button', { hasText: label }).first();
  console.log(label, 'rail buttons:', await btn.count());
  if (await btn.count()) {
    await btn.click({ force: true });
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: `${OUT}/${shot}` });
}

await openRail('Shapes', '04-drawer-shapes.png');
await openRail('Add text', '05-drawer-text.png');
await browser.close();
console.log('done');
