// techpack-proof.spec.ts — visual proof captures (T13/T13b/T14).
//
// 1. Guard screenshot: the running app redirects unauthenticated
//    /studio/techpacks/demo to /login (the proxy + studio layout require
//    a signed-in aal2 staff session — the demo page is NOT public).
// 2. Filled-template renders: the 11-page fill is pure (fill() +
//    boxyTeeFixture) and renders identically in the browser; these
//    captures show the filled pages themselves. The authenticated
//    in-app editor / switcher / station screenshots are blocked on the
//    local Supabase stack (no local stack on this VM) — open item.
import { expect, test } from '@playwright/test';
import { fill } from '@/lib/techpack-render/fill';
import { boxyTeeFixture } from '@/lib/techpack-render/fixture';
import { loadTemplateSvgs } from '@/lib/techpack-render/loadTemplates';

const PROOF = 'docs/phase3-proof/lane-1';

test('proof: unauthenticated tech pack route lands on /login', async ({ page }) => {
  await page.goto('/studio/techpacks/demo');
  await expect(page).toHaveURL(/\/login/);
  await page.screenshot({ path: `${PROOF}/01-login-guard-techpacks-demo.png`, fullPage: true });
});

test('proof: filled template pages render (sketch, chart 2/2, supplier BOM)', async ({ page }) => {
  const svgs = await loadTemplateSvgs();
  const snapshot = boxyTeeFixture();
  const internal = fill(svgs, snapshot, 'internal');
  const supplier = fill(svgs, snapshot, 'supplier', { watermarkText: 'SUPPLIER PREVIEW — VIEWER: DEMO' });
  expect(internal.pages).toHaveLength(12); // 11 + 1 continuation
  const chart2 = internal.pages.find((p) => p.svg.includes('MEASUREMENT CHART (2/2)'));
  const sketch = internal.pages.find((p) => p.pageId === 'sketch');
  const bomSupplier = supplier.pages.find((p) => p.pageId === 'bom');
  expect(chart2?.svg).toContain('MEASUREMENT CHART (2/2)');
  expect(bomSupplier?.svg).not.toContain('UNIT COST');
  expect(bomSupplier?.svg).toContain('SUPPLIER PREVIEW');

  const show = async (svg: string, name: string) => {
    await page.setContent(
      `<html><head><style>body{margin:0;background:#fff}svg{width:1122px;height:auto;display:block}</style></head><body>${svg}</body></html>`,
    );
    await page.screenshot({ path: `${PROOF}/${name}`, fullPage: true });
  };
  await show(sketch?.svg ?? '', '02-filled-sketch-page.png');
  await show(chart2?.svg ?? '', '03-filled-measurement-chart-2-of-2.png');
  await show(bomSupplier?.svg ?? '', '04-supplier-bom-no-unit-cost.png');
});
