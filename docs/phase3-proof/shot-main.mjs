// Fresh screenshot of the running app (dev server :3003) — the Design
// Studio canvas ("New design") showing the Tech Packs switcher.
// Run: node docs/phase3-proof/shot-main.mjs  (dev server on :3003 must be up)
import { chromium } from '@playwright/test';

const OUT = 'docs/phase3-proof/shot-main';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://127.0.0.1:3003/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);

// Rail is icon-only; the Design Studio domain button carries title="Design Studio".
await page.locator('button[title="Design Studio"]').click({ timeout: 8000 });
await page.waitForTimeout(2000);

// "New design" is the first child of the Studio domain — opens the canvas.
const nd = page.locator('button:has-text("New design"), a:has-text("New design")').first();
await nd.click({ timeout: 8000 });
try {
  await page.waitForFunction(
    () => document.body.innerText.includes('Tech Packs'),
    { timeout: 60000 },
  );
  console.log('Tech Packs switcher visible');
} catch {
  console.log('Tech Packs text NOT found within 60s');
}
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}-02-canvas-techpacks.png` });
console.log('final URL:', page.url());
await browser.close();
