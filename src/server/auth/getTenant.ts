import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createUserClient } from '@/server/supabase/server';

export const TENANT_COOKIE = 'atelier_tenant';

export interface TenantMembership {
  tenant_id: string;
  role: string;
}

export interface TenantContext {
  user: User;
  tenantId: string;
  role: string;
  memberships: TenantMembership[];
}

/**
 * getTenant — resolve the working tenant for a signed-in staff user.
 * The `atelier_tenant` cookie is only a preference: it is validated against
 * tenant_memberships (user JWT, RLS) on every read, and any cookie value
 * that is not one of the user's active memberships is ignored in favour of
 * their first membership. Returns null when signed out or membership-less.
 */
export async function getTenant(): Promise<TenantContext | null> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships, error } = await supabase
    .from('tenant_memberships')
    .select('tenant_id, role')
    .eq('user_id', user.id)
    .eq('active', true);
  if (error || !memberships || memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(TENANT_COOKIE)?.value;
  const match = preferred ? memberships.find((m) => m.tenant_id === preferred) : undefined;
  const chosen = match ?? memberships[0];
  if (!chosen) return null;
  return { user, tenantId: chosen.tenant_id, role: chosen.role, memberships };
}

/**
 * Server action: switch the working tenant. The requested tenant is
 * validated against the caller's memberships before the cookie is set;
 * an unowned tenant id is silently ignored (cookie left unchanged).
 */
export async function setTenant(tenantId: string): Promise<void> {
  'use server';
  const ctx = await getTenant();
  if (!ctx) return;
  if (!ctx.memberships.some((m) => m.tenant_id === tenantId)) return;
  const cookieStore = await cookies();
  cookieStore.set(TENANT_COOKIE, tenantId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
