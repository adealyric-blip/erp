import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, round2 } from '@/lib/financeServer';

/**
 * GET /api/v1/finance/reports/summary?periodId= — computed P&L-ish summary.
 * Revenue = Σ posted/paid AR invoices; expenses = Σ posted/paid AP bills.
 * With ?periodId=, restricted to the period's date range; without it, all time.
 */
export async function GET(req: NextRequest) {
  try {
    const periodId = new URL(req.url).searchParams.get('periodId');
    let start: string | null = null;
    let end: string | null = null;
    let period: any = null;
    if (periodId) {
      const { data, error } = await supabaseAdmin()
        .from('acct_periods')
        .select('*')
        .eq('tenant_id', TENANT)
        .eq('id', periodId)
        .single();
      if (error || !data) throw new Error(`period ${periodId} not found`);
      period = data;
      start = String(data.start_date);
      end = String(data.end_date);
    }
    let invQuery = supabaseAdmin().from('acct_ar_invoices').select('total, status').eq('tenant_id', TENANT).in('status', ['Posted', 'Paid']);
    let billQuery = supabaseAdmin().from('acct_ap_bills').select('total, status').eq('tenant_id', TENANT).in('status', ['Posted', 'Paid']);
    if (start && end) {
      invQuery = invQuery.gte('invoice_date', start).lte('invoice_date', end);
      billQuery = billQuery.gte('bill_date', start).lte('bill_date', end);
    }
    const [inv, bills] = await Promise.all([invQuery, billQuery]);
    if (inv.error) throw new Error(`acct_ar_invoices: ${inv.error.message}`);
    if (bills.error) throw new Error(`acct_ap_bills: ${bills.error.message}`);
    const revenue = round2((inv.data ?? []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0));
    const expenses = round2((bills.data ?? []).reduce((s: number, b: any) => s + Number(b.total ?? 0), 0));
    return Response.json({
      period: period ? { id: period.id, name: period.name, start_date: period.start_date, end_date: period.end_date, status: period.status } : null,
      revenue,
      expenses,
      net: round2(revenue - expenses),
      invoiceCount: (inv.data ?? []).length,
      billCount: (bills.data ?? []).length,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
