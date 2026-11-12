import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, pageParams, round2 } from '@/lib/financeServer';

/** GET /api/v1/finance/bank/accounts — bank accounts with computed balance (Σ transactions). */
export async function GET(req: NextRequest) {
  try {
    const { limit, offset } = pageParams(new URL(req.url));
    const { data, error, count } = await supabaseAdmin()
      .from('acct_bank_accounts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', TENANT)
      .order('is_active', { ascending: false })
      .order('name')
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_bank_accounts: ${error.message}`);
    const accounts = data ?? [];
    const ids = accounts.map((a: any) => a.id);
    const balances = new Map<string, number>();
    if (ids.length > 0) {
      const { data: tx, error: txError } = await supabaseAdmin()
        .from('acct_bank_transactions')
        .select('bank_account_id, amount')
        .eq('tenant_id', TENANT)
        .in('bank_account_id', ids);
      if (txError) throw new Error(`acct_bank_transactions: ${txError.message}`);
      for (const t of tx ?? []) {
        const id = String((t as any).bank_account_id);
        balances.set(id, round2((balances.get(id) ?? 0) + Number((t as any).amount ?? 0)));
      }
    }
    return Response.json({
      items: accounts.map((a: any) => ({ ...a, balance: balances.get(String(a.id)) ?? 0 })),
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
