#!/usr/bin/env node
/**
 * fetch-craft.ts — T11. Downloads the eight pinned Craft web builds into
 * public/craft/<app>/ (gitignored). Never tracks upstream main: every build
 * is pinned to a release tag below, and each zip is verified against the
 * release's published SHA-256 before extraction.
 *
 * Pinned sources (verified 2026-11-12, all releases published 2026-11-11/12):
 *   storytold/craft-libs @ 09dcbc225b95232998498a40ca56e24716571d53
 *   (crates/web-host + crates/web-api — the host contract in
 *   src/lib/craft-bridge/protocol.ts is written from that SHA)
 *   storytold/<app> releases, asset <app>-web-<version>.zip
 *
 * Usage:  npx tsx scripts/fetch-craft.ts [--force] [--app vectorcraft]
 *   (tsx is a devDependency-free fallback: the script also runs under
 *   `node --experimental-strip-types` on Node 22.6+.)
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

export interface CraftBuild {
  /** Directory under public/craft/ and the window.<app> id. */
  app: string;
  repo: string;
  version: string;
  /** Pinned release tag. */
  tag: string;
  /** Release asset name. */
  asset: string;
  /** SHA-256 of the release zip, from the release's SHA256SUMS.txt. */
  sha256: string;
}

/** Pinned craft-libs commit the host protocol is written from. */
export const CRAFT_LIBS_SHA = '09dcbc225b95232998498a40ca56e24716571d53';

export const CRAFT_BUILDS: CraftBuild[] = [
  {
    app: 'vectorcraft',
    repo: 'storytold/vectorcraft',
    version: '0.24.0',
    tag: 'v0.24.0',
    asset: 'vectorcraft-web-0.24.0.zip',
    sha256: '902ce32c5ff2e8bb003c8815ae2a0972ca470fac0cd7fda1ae3b97773d93e43b',
  },
  {
    app: 'photocraft',
    repo: 'storytold/photocraft',
    version: '0.23.0',
    tag: 'v0.23.0',
    asset: 'photocraft-web-0.23.0.zip',
    sha256: '363cb0c04462f277012d603b4ce5d18cae9f841a2398546142230e86b365b7bc',
  },
  {
    app: 'texturecraft',
    repo: 'storytold/texturecraft',
    version: '0.6.1',
    tag: 'v0.6.1',
    asset: 'texturecraft-web-0.6.1.zip',
    sha256: '6dea6a9f77a161cba3258ab4c6db591bdb4dd32b7385d16a7db997ab671a5f3b',
  },
  {
    app: 'designcraft',
    repo: 'storytold/designcraft',
    version: '0.20.1',
    tag: 'v0.20.1',
    asset: 'designcraft-web-0.20.1.zip',
    sha256: '50fb2bebce1f48065318953393626b84b25cd1736c556e523275dadc46ae6906',
  },
  {
    app: 'pdfcraft',
    repo: 'storytold/pdfcraft',
    version: '0.21.1',
    tag: 'v0.21.1',
    asset: 'pdfcraft-web-0.21.1.zip',
    sha256: 'fe9708d46af191aebb56f70eb32cf8b112b0b9452d17ae6ba3a8c4a8665fe748',
  },
  {
    app: 'lightcraft',
    repo: 'storytold/lightcraft',
    version: '0.21.0',
    tag: 'v0.21.0',
    asset: 'lightcraft-web-0.21.0.zip',
    sha256: '5d032efb28c2859ac86e72ff592b5dcef8014dd63a7a9744d952e291e7c7f63f',
  },
  {
    app: 'effectcraft',
    repo: 'storytold/effectcraft',
    version: '0.24.1',
    tag: 'v0.24.1',
    asset: 'effectcraft-web-0.24.1.zip',
    sha256: '8adc985f345d73207abc69a27938905aba1729b63c6c9b332d0244a7567424f1',
  },
  {
    app: 'filmcraft',
    repo: 'storytold/filmcraft',
    version: '0.20.1',
    tag: 'v0.20.1',
    asset: 'filmcraft-web-0.20.1.zip',
    sha256: '1cf3072e3f3b6535fcd024d6f6ab2a16cf7776345d868037dc630de0ad0dbbb8',
  },
];

export function buildUrl(build: CraftBuild): string {
  return `https://github.com/${build.repo}/releases/download/${build.tag}/${build.asset}`;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await readFile(path));
  return hash.digest('hex');
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${url} -> HTTP ${res.status}`);
  }
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
}

/**
 * Fetch + verify + extract one build. Skips the download when the target
 * directory already holds an index.html and --force is not set.
 */
export async function fetchCraftBuild(
  build: CraftBuild,
  opts: { root?: string; force?: boolean } = {},
): Promise<{ app: string; version: string; skipped: boolean; dir: string }> {
  const root = opts.root ?? join(process.cwd(), 'public', 'craft');
  const dir = join(root, build.app);
  if (!opts.force && existsSync(join(dir, 'index.html'))) {
    return { app: build.app, version: build.version, skipped: true, dir };
  }
  const tmp = join(tmpdir(), `craft-${build.app}-${build.version}.zip`);
  await download(buildUrl(build), tmp);
  const actual = await sha256File(tmp);
  if (actual !== build.sha256) {
    throw new Error(
      `SHA-256 mismatch for ${build.asset}: expected ${build.sha256}, got ${actual}. ` +
        `Refusing to extract — re-pin the release before retrying.`,
    );
  }
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  await promisify(execFile)('unzip', ['-q', '-o', tmp, '-d', dir]);
  // The zip holds a single top-level folder <app>-web-<version>/; flatten it.
  const entries = await readdir(dir);
  if (entries.length === 1 && (await stat(join(dir, entries[0]))).isDirectory()) {
    const inner = join(dir, entries[0]);
    const { execFile: ef } = await import('node:child_process');
    await promisify(ef)('bash', ['-c', `mv "${inner}"/* "${inner}"/.[!.]* "${dir}/" 2>/dev/null; rmdir "${inner}"`]);
  }
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`extracted ${build.asset} but no index.html in ${dir}`);
  }
  return { app: build.app, version: build.version, skipped: false, dir };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.find((a) => a.startsWith('--app='))?.slice('--app='.length);
  const builds = only ? CRAFT_BUILDS.filter((b) => b.app === only) : CRAFT_BUILDS;
  if (only && builds.length === 0) throw new Error(`unknown app: ${only}`);
  for (const build of builds) {
    const r = await fetchCraftBuild(build, { force });
    console.log(`${r.skipped ? 'skip  ' : 'fetched'} ${r.app} ${r.version} -> ${r.dir}`);
  }
  console.log(`craft-libs protocol pin: ${CRAFT_LIBS_SHA}`);
}

const isMain = process.argv[1]?.endsWith('fetch-craft.ts');
if (isMain) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
