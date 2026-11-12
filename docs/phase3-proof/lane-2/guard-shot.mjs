// Guard proof: unauthenticated visit to the revisions route must redirect to /login.
// Run: node docs/phase3-proof/lane-2/guard-shot.mjs  (dev server on :3003 must be up)
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto('http://localhost:3003/studio/techpacks/demo-boxy-tee/revisions', {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(1500);
console.log('final URL:', page.url());
await page.screenshot({ path: 'docs/phase3-proof/lane-2/01-revisions-guard-login.png' });
await browser.close();
