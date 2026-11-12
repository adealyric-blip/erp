import { chromium } from '@playwright/test';
const BASE = process.env.CANVAS_BASE || 'http://127.0.0.1:3004';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
const hydrated = async (timeoutMs = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate(() => {
      const keys = Object.keys(document.body || {});
      return keys.some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'));
    });
    if (ok) return true;
    await page.waitForTimeout(1000);
  }
  return false;
};
console.log('goto', `${BASE}/?view=design:new-design`);
await page.goto(`${BASE}/?view=design:new-design`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
console.log('hydrated:', await hydrated());
console.log('has Tech Packs btn:', await page.evaluate(() => document.body.innerText.includes('Tech Packs')));
console.log('has No product selected:', await page.evaluate(() => document.body.innerText.includes('No product selected')));
await page.screenshot({ path: 'docs/phase3-proof/shot-canvas-01-empty.png' });
// Dump visible buttons to find the product picker opener.
const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => ((b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)) + (b.title ? ' [' + b.title + ']' : '')).filter(Boolean).slice(0, 60));
console.log('buttons:', JSON.stringify(buttons, null, 0).slice(0, 2500));
// Try to load a product: find the picker. Look for a button mentioning Browse/Catalog/Products/queue, else click a product row with 'oversized'.
const tryPicker = async () => {
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pick = btns.find((b) => /browse|catalog|products|queue|blank/i.test((b.textContent || '') + ' ' + (b.title || '')));
    if (pick) { pick.click(); return (pick.textContent || '').trim().slice(0, 50); }
    return null;
  });
  console.log('picker opener clicked:', clicked);
  await page.waitForTimeout(6000);
  const rows = await page.evaluate(() => document.body.innerText.match(/oversized[^\n]*/gi));
  console.log('oversized matches in text:', JSON.stringify(rows));
  return rows;
};
let rows = await tryPicker();
// If a product row with 'oversized' is a clickable row, click it; else click the first product row in the flyout.
const loaded = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('[class*="flyoutProductRow"], [class*="productRow"]'));
  const over = els.find((el) => /oversized/i.test(el.textContent || ''));
  const target = over || els[0];
  if (!target) return 'no product rows';
  const btn = target.querySelector('button') || target;
  btn.click();
  return 'clicked row: ' + (target.textContent || '').trim().slice(0, 80);
});
console.log('load product:', loaded);
await page.waitForTimeout(12000);
console.log('product name now:', await page.evaluate(() => { const m = document.body.innerText.match(/([^\n]*oversized[^\n]*)/i); return m ? m[0] : document.body.innerText.slice(0, 200).replace(/\n/g, ' | '); }));
await page.screenshot({ path: 'docs/phase3-proof/shot-canvas-02-product.png' });
// Model surface (render-only photo).
const modelClicked = await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find((el) => (el.title || '').startsWith('Model photo'));
  if (b) { b.click(); return true; } return false;
});
console.log('Model clicked:', modelClicked);
await page.waitForTimeout(6000);
await page.screenshot({ path: 'docs/phase3-proof/shot-canvas-03-model.png' });
await browser.close();
