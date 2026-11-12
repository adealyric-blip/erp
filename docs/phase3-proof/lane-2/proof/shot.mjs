// Screenshots for every T15 proof view. Run after the bundle is built and
// `python3 -m http.server 8821` is serving docs/phase3-proof/lane-2/proof/.
// Run from the repo root: node docs/phase3-proof/lane-2/proof/shot.mjs
import { chromium } from '@playwright/test';

const views = [
  ['staff', '02-approve-dialog-staff.png'],
  ['owner', '03-approve-dialog-owner.png'],
  ['diff', '04-revision-diff.png'],
  ['pdf', '05-pdf-status.png'],
  ['revisions', '06-revisions-page.png'],
  ['revisions-locked', '07-revisions-page-locked.png'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e?.stack ?? e).slice(0, 600)));
for (const [view, file] of views) {
  await page.goto(`http://localhost:8821/index.html?view=${view}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1500);
  const counts = {
    dialog: await page.locator('[data-testid="approve-dialog"]').count(),
    approveDisabledReason: await page.locator('[data-testid="transition-reason-approved"]').count(),
    diff: await page.locator('[data-testid="revision-diff"]').count(),
    pdf: await page.locator('[data-testid="pdf-status"]').count(),
    revisions: await page.locator('[data-testid="revisions-page"]').count(),
    lock: await page.locator('[data-testid="version-lock"]').count(),
  };
  console.log(view, '->', file, JSON.stringify(counts));
  await page.screenshot({ path: `docs/phase3-proof/lane-2/${file}`, fullPage: true });
}
await browser.close();
