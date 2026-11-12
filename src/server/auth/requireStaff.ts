import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createUserClient } from '@/server/supabase/server';
import type { Database } from '@/lib/db';

export interface StaffContext {
  supabase: SupabaseClient<Database>;
  user: User;
  tenantId: string;
  role: string;
}

/**
 * requireStaff — the gate for /studio (and /craft) pages and actions.
 * Decisions (plan/04, T04 accept):
 * - no session            -> redirect /login
 * - session but not aal2  -> redirect /mfa (TOTP enrollment)
 * - aal2 but not a tenant member (or not a member of the requested tenant)
 *                         -> notFound() — 404, never 403, so a supplier
 *                           probing /studio learns nothing.
 * Membership is read from tenant_memberships with the user's own JWT (RLS).
 */
export async function requireStaff(tenantId?: string): Promise<StaffContext> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== 'aal2') redirect('/mfa');

  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('active', true);
  if (error || !memberships || memberships.length === 0) notFound();

  if (tenantId) {
    const match = memberships.find((m) => m.tenant_id === tenantId);
    if (!match) notFound();
    return { supabase, user, tenantId, role: match.role };
  }
  const first = memberships[0];
  if (!first) notFound();
  return { supabase, user, tenantId: first.tenant_id, role: first.role };
}
