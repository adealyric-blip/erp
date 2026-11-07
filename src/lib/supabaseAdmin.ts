import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service role key.
 * Used by API routes (server-only) — bypasses RLS for service operations.
 * NEVER import this in a client component.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/** The tenant_id we use for this platform instance.
 *  In production, this comes from the authenticated user's session.
 *  For now, we use the first tenant in the database (set below).
 */
export const DEFAULT_TENANT_ID = '652fd2be-d19a-4778-835d-db38094d7718';
