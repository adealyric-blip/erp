import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams } from '@/lib/financeServer';

/** GET /api/v1/finance/bank/transactions?accountId=&matchStatus= — bank transactions, date desc. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { limit, offset } = pageParams(url);
    let query = supabaseAdmin().from('acct_bank_transactions').select('*', { count: 'exact' }).eq('tenant_id', TENANT);
    const accountId = url.searchParams.get('accountId');
    const matchStatus = url.searchParams.get('matchStatus');
    if (accountId) query = query.eq('bank_account_id', accountId);
    if (matchStatus) query = query.eq('match_status', matchStatus);
    const { data, error, count } = await query.order('transaction_date', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_bank_transactions: ${error.message}`);
    return Response.json({ items: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}
