#!/usr/bin/env node
// capture.mjs — screenshot the running app for Phase 1 proof.
// Usage:
//   node scripts/capture.mjs <url> <out.png> [--wait <ms>] [--full-page]
// Uses the repo's own @playwright/test (Chromium already downloaded).
// Screenshots land in docs/phase1-proof/ by convention.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/capture.mjs <url> <out.png> [--wait <ms>] [--full-page]');
  process.exit(1);
}
const waitMs = Number(rest[rest.indexOf('--wait') + 1] ?? 1500);
const fullPage = rest.includes('--full-page');

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(waitMs);
await page.screenshot({ path: out, fullPage });
await browser.close();
console.log(`captured ${url} -> ${out}`);
