import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams } from '@/lib/financeServer';

/** GET /api/v1/finance/bank/reconciliations — reconciliations, latest first. */
export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = pageParams(new URL(req.url));
    const { data, error, count } = await supabaseAdmin()
      .from('acct_reconciliations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('as_of_date', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_reconciliations: ${error.message}`);
    return Response.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}
