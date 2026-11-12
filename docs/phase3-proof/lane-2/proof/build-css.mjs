// Build the harness CSS with the repo's own Tailwind v4 (PostCSS plugin).
// Run from the repo root: node docs/phase3-proof/lane-2/proof/build-css.mjs
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = `@import "tailwindcss";
@source "../../../../src/features/techpack";
@source "../../../../src/app/studio/techpacks";
`;
const result = await postcss([tailwindcss()]).process(css, {
  from: path.join(dir, 'input.css'),
  to: path.join(dir, 'bundle.css'),
});
fs.writeFileSync(path.join(dir, 'bundle.css'), result.css);
console.log('bundle.css written:', result.css.length, 'bytes');
