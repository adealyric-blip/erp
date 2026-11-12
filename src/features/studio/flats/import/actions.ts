// Reject a split piece — the one review action without a command
// (flat.piece.accept / merge / cut / pair / scale are commands; reject is
// a status flip, no geometry). Staff-only; the piece must be proposed.
'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/server/auth/requireStaff';
import type { Result } from '@/server/result';
import { fail, ok } from '@/server/result';

export async function rejectPiece(pieceId: string): Promise<Result<{ pieceId: string }>> {
  const { supabase, user, tenantId } = await requireStaff();
  const { data: piece, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          eq: (col: string, v: string) => {
            maybeSingle: () => Promise<{ data: { status: string; batch_id: string } | null; error: { message: string } | null }>;
          };
        };
      };
    };
  })
    .from('ds_flat_pieces')
    .select('status,batch_id')
    .eq('tenant_id', tenantId)
    .eq('id', pieceId)
    .maybeSingle();
  if (error || !piece) return fail('not_found', 'piece not found');
  if (piece.status !== 'proposed') return fail('invalid_state', `piece is ${piece.status}; only a proposed piece can be rejected`);
  const { error: updErr } = await (supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (col: string, v: string) => {
          eq: (col: string, v: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .from('ds_flat_pieces')
    .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', pieceId);
  if (updErr) return fail('unknown', updErr.message);
  revalidatePath(`/studio/library/flats/import/${piece.batch_id}`);
  return ok({ pieceId });
}
