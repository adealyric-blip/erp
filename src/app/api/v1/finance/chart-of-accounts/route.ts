import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams } from '@/lib/financeServer';

/** GET /api/v1/finance/chart-of-accounts — the COA tree, active first. */
export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = pageParams(new URL(req.url));
    const { data, error, count } = await supabaseAdmin()
      .from('acct_chart_of_accounts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('is_active', { ascending: false })
      .order('code')
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_chart_of_accounts: ${error.message}`);
    return Response.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}
