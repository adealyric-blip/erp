import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/env';
import type { Database } from '@/lib/db';

/**
 * User-scoped Supabase client for Server Components / Route Handlers /
 * Server Actions. RLS applies; the user's JWT is read from cookies.
 * Follows the @supabase/ssr Next.js App Router pattern.
 */
export async function createUserClient() {
  const cookieStore = await cookies();
  const env = getEnv();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll from a Server Component is a no-op (Next.js restriction);
          // the proxy refreshes the session cookie instead.
        }
      },
    },
  });
}
