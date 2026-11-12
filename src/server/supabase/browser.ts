import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db';

/**
 * Browser client for client components (login, MFA enrollment, supplier
 * portal). Uses the anon key; RLS applies. Never the service role.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
