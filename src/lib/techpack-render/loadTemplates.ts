// techpack-render — template loader (T13b). The 11 SVG masters live in
// this package (seeded from plan/templates/techpack/svg/*) so fill() and
// the editor preview always read the same files the validator checks.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TEMPLATE_PAGES } from './types';

export async function loadTemplateSvgs(dir?: string): Promise<string[]> {
  const base =
    dir ?? join(process.cwd(), 'src', 'lib', 'techpack-render', 'templates');
  return Promise.all(
    TEMPLATE_PAGES.map((p) => readFile(join(base, p.file), 'utf8')),
  );
}
