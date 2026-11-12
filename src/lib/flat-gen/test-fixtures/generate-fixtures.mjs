// Generates the four synthetic T10c split fixtures (plan/06 T10c Accept):
//   (1) one garment front+back on one artboard — named layers (Front/Back)
//   (2) two artboards — front on page 1, back on page 2
//   (3) a 3-garment set as top-level groups — hoodie / jogger / jacket rows
//   (4) a flattened file with no groups — front+back as bare paths
// Each tee is a filled outline polygon + dashed stitch + seam + a small
// button (trim) + a FRONT/BACK label + a VecFashion watermark line.
// Run: node src/lib/flat-gen/test-fixtures/generate-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

// Tee outline, local coords (~340 wide, ~530 tall). `back` uses a
// shallower neck so front/back are distinguishable but similar in size
// (pairing tolerance is 12% on w/h).
function tee(dx, dy, back) {
  const ny = back ? 18 : 32;
  const d = [
    `M ${120 + dx} ${ny + dy}`,
    `L ${180 + dx} ${ny + dy}`,
    `L ${250 + dx} ${55 + dy}`,
    `L ${300 + dx} ${60 + dy}`,
    `L ${330 + dx} ${170 + dy}`,
    `L ${260 + dx} ${200 + dy}`,
    `L ${250 + dx} ${560 + dy}`,
    `L ${70 + dx} ${560 + dy}`,
    `L ${60 + dx} ${200 + dy}`,
    `L ${-10 + dx} ${170 + dy}`,
    `L ${20 + dx} ${60 + dy}`,
    `L ${70 + dx} ${55 + dy}`,
    'Z',
  ].join(' ');
  return [
    `<path d="${d}" fill="#ffffff" stroke="#111111" stroke-width="1.5"/>`,
    // dashed stitch near the hem
    `<path d="M ${80 + dx} ${520 + dy} L ${240 + dx} ${520 + dy}" fill="none" stroke="#111111" stroke-width="0.8" stroke-dasharray="4 3"/>`,
    // side seam
    `<path d="M ${70 + dx} ${200 + dy} L ${75 + dx} ${560 + dy}" fill="none" stroke="#111111" stroke-width="1"/>`,
    // small button near the neck (trim: small + near edge)
    `<circle cx="${160 + dx}" cy="${ny + 26 + dy}" r="6" fill="#ffffff" stroke="#111111" stroke-width="1"/>`,
    // view label (hint, kept out of the piece)
    `<text x="${130 + dx}" y="${300 + dy}" font-size="20" fill="#111111">${back ? 'BACK' : 'FRONT'}</text>`,
  ].join('\n');
}

const svgOpen = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">';
const svgOpenTall = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1800" width="1000" height="1800">';
const svgClose = '<text x="400" y="985" font-size="14" fill="#999999">VecFashion</text>\n</svg>';
const svgCloseTall = '<text x="400" y="1785" font-size="14" fill="#999999">VecFashion</text>\n</svg>';
const wrap = (inner) => `${svgOpen}\n${inner}\n${svgClose}\n`;
const wrapTall = (inner) => `${svgOpenTall}\n${inner}\n${svgCloseTall}\n`;

// (1) Named layers on one artboard.
writeFileSync(
  join(DIR, 'fixture-1-layer-front-back.svg'),
  wrap(
    `<g id="Front" data-layer="Front">\n${tee(60, 200, false)}\n</g>\n` +
      `<g id="Back" data-layer="Back">\n${tee(560, 200, true)}\n</g>`,
  ),
);

// (2) Two artboards: one page per view.
writeFileSync(join(DIR, 'fixture-2-artboard-front.svg'), wrap(tee(300, 200, false)));
writeFileSync(join(DIR, 'fixture-2-artboard-back.svg'), wrap(tee(300, 200, true)));

// (3) 3-garment set as top-level groups, one garment per row (tall page).
const row = (dy, id) =>
  `<g id="${id}">\n${tee(60, dy, false)}\n${tee(560, dy, true)}\n</g>`;
writeFileSync(
  join(DIR, 'fixture-3-group-set.svg'),
  wrapTall(`${row(20, 'hoodie')}\n${row(620, 'jogger')}\n${row(1220, 'jacket')}`),
);

// (4) Flattened: bare paths, no groups at all.
writeFileSync(join(DIR, 'fixture-4-flat-front-back.svg'), wrap(`${tee(60, 200, false)}\n${tee(560, 200, true)}`));

console.log('fixtures written to', DIR);
