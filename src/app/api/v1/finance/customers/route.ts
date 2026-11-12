import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams } from '@/lib/financeServer';

/** GET /api/v1/finance/customers — customers, active first. */
export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = pageParams(new URL(req.url));
    const { data, error, count } = await supabaseAdmin()
      .from('acct_customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('is_active', { ascending: false })
      .order('legal_name')
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_customers: ${error.message}`);
    return Response.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}
