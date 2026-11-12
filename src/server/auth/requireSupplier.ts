import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createUserClient } from '@/server/supabase/server';
import type { Database } from '@/lib/db';

export interface SupplierContext {
  supabase: SupabaseClient<Database>;
  user: User;
  vendorIds: string[];
}

/**
 * requireSupplier — the gate for /supplier pages and actions.
 * Decisions (plan/04, T04 accept):
 * - no session -> redirect /login
 * - session but no active supplier_portal_members row -> notFound() (404,
 *   never 403). A staff user who is not also a portal member gets the same
 *   404, so the portal's existence can't be probed.
 * Membership is proven with the SECURITY DEFINER RPC ds_my_vendor_ids:
 * suppliers are NOT tenant members, so a direct SELECT on
 * supplier_portal_members (tenant_read) would return nothing for them.
 */
export async function requireSupplier(): Promise<SupplierContext> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: vendorIds, error } = await supabase.rpc('ds_my_vendor_ids');
  if (error || !vendorIds || vendorIds.length === 0) notFound();
  return { supabase, user, vendorIds: vendorIds as string[] };
}
