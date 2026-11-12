// Clean-cache webpack build, with the live Supabase env the app embeds as
// fallbacks in src/lib/supabaseConfig.ts. Values read from that file and
// passed only to the build process — never printed.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const src = readFileSync('src/lib/supabaseConfig.ts', 'utf8');
const pick = (name) => {
  const re = new RegExp(name + "[\\s\\S]{0,120}?'([^']+)'");
  const m = src.match(re);
  if (!m) throw new Error('fallback not found: ' + name);
  return m[1];
};
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: pick('SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: pick('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: pick('SUPABASE_SERVICE_ROLE_KEY'),
};
console.log('env present:', !!env.NEXT_PUBLIC_SUPABASE_URL, !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY, !!env.SUPABASE_SERVICE_ROLE_KEY);
const r = spawnSync('npx', ['next', 'build', '--webpack'], { env, stdio: 'inherit', shell: false });
process.exit(r.status ?? 1);
