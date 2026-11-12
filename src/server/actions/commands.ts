// runCommand — plan/04 §Server action wrapper, verbatim in behavior.
// ClientOnly commands never run here (they have no RPC effect).
'use server';

import { revalidatePath } from 'next/cache';
import { getCommand } from '@/lib/commands/registry';
import { requireStaff } from '@/server/auth/requireStaff';
import type { Result } from '@/server/result';
import { fail } from '@/server/result';

export async function runCommand(id: string, raw: unknown): Promise<Result<unknown>> {
  const cmd = getCommand(id);
  if (!cmd || cmd.clientOnly) {
    return fail('not_found', `Unknown or client-only command: ${id}`);
  }
  const { supabase, user, tenantId } = await requireStaff();
  const parsed = cmd.input.safeParse(raw);
  if (!parsed.success) {
    return fail('invalid_state', parsed.error.message);
  }
  const res = await cmd.run({ supabase, userId: user.id, tenantId }, parsed.data as never);
  if (res.ok) {
    revalidatePath('/studio/designs');
  }
  return res;
}
