import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
await page.goto('http://127.0.0.1:3003/', { waitUntil: 'domcontentloaded' });
// Wait up to 90s for React to attach.
let fiber = false;
for (let i = 0; i < 18; i++) {
  fiber = await page.evaluate(() => Object.keys(document.body || {}).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactContainer')));
  if (fiber) { console.log('React attached after', (i + 1) * 5, 's'); break; }
  await page.waitForTimeout(5000);
}
console.log('React attached:', fiber);
if (fiber) {
  await page.locator('button[title="Design Studio"]').click({ timeout: 8000 });
  await page.waitForTimeout(4000);
  console.log('New design visible:', await page.evaluate(() => document.body.innerText.includes('New design')));
}
await browser.close();
