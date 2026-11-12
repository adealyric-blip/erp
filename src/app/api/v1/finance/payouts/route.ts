import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams } from '@/lib/financeServer';

/** GET /api/v1/finance/payouts — payouts, latest first. */
export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = pageParams(new URL(req.url));
    const { data, error, count } = await supabaseAdmin()
      .from('acct_payouts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_payouts: ${error.message}`);
    return Response.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}
