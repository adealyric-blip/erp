import { chromium } from '@playwright/test';
const BASE = process.env.CANVAS_BASE || 'http://127.0.0.1:3004';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
await page.goto(`${BASE}/?view=design:new-design`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
// Activate the New design tab (it may already be active from the ?view boot).
await page.evaluate(() => {
  const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((el) => (el.textContent || '').includes('New design'));
  if (tab) tab.click();
});
await page.waitForTimeout(3000);
console.log('canvas empty state:', await page.evaluate(() => document.body.innerText.includes('Canvas is empty')));
// Open the product picker via the canvas's own Browse products button.
await page.locator('button:has-text("Browse products")').first().click({ timeout: 10000 });
console.log('Browse products clicked');
await page.waitForTimeout(10000);
// What does the picker show? Dump the flyout text (first 1500 chars of the flyout/picker region).
const pickerText = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('*')).find((e) => e.children.length < 80 && (e.textContent || '').includes('Browse products') && (e.textContent || '').length < 4000);
  return document.body.innerText.slice(0, 2500);
});
console.log('picker text (head):', JSON.stringify(pickerText.slice(0, 1200)));
// Wait up to 60s for product rows to appear.
let rowsFound = false;
for (let i = 0; i < 12; i++) {
  rowsFound = await page.evaluate(() => document.querySelectorAll('[class*="flyoutProductRow"]').length > 0);
  if (rowsFound) break;
  await page.waitForTimeout(5000);
}
console.log('product rows present:', rowsFound);
const rowInfo = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[class*="flyoutProductRow"]'));
  return rows.slice(0, 12).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90));
});
console.log('rows:', JSON.stringify(rowInfo));
// Click the row whose text mentions oversized; else the first row.
const clicked = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[class*="flyoutProductRow"]'));
  if (!rows.length) return 'no rows';
  const over = rows.find((r) => /oversized/i.test(r.textContent || ''));
  const target = over || rows[0];
  const btn = target.querySelector('button') || target;
  btn.click();
  return 'clicked: ' + (target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
});
console.log(clicked);
await page.waitForTimeout(15000);
console.log('product name now:', await page.evaluate(() => {
  const m = document.body.innerText.match(/([^\n]*(oversized|tee|shirt|hoodie)[^\n]*)/i);
  return m ? m[0].slice(0, 120) : 'none';
}));
console.log('canvas still empty?', await page.evaluate(() => document.body.innerText.includes('Canvas is empty')));
await page.screenshot({ path: 'docs/phase3-proof/shot-canvas-02-product.png' });
// Model surface.
const modelClicked = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((el) => (el.title || '').startsWith('Model photo'));
  if (b) { b.click(); return true; } return false;
});
console.log('Model clicked:', modelClicked);
await page.waitForTimeout(8000);
await page.screenshot({ path: 'docs/phase3-proof/shot-canvas-03-model.png' });
await browser.close();
