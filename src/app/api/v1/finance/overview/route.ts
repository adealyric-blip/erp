import { NextRequest } from 'next/server';
import { supabaseAdmin, TENANT, toErrorResponse, round2 } from '@/lib/financeServer';

/**
 * GET /api/v1/finance/overview — KPIs computed from live rows.
 * Cash = Σ bank transactions per account; open AP/AR = Σ unpaid totals;
 * overdue counts from due dates; recent activity = latest journal entries
 * + bank transactions. All zero today (empty tables) — honest empty state.
 */
export async function GET(_req: NextRequest) {
  try {
    const [bankTx, bills, invoices, journals] = await Promise.all([
      supabaseAdmin().from('acct_bank_transactions').select('amount').eq('tenant_id', TENANT),
      supabaseAdmin().from('acct_ap_bills').select('total, amount_paid, amount_credited, due_date, status').eq('tenant_id', TENANT),
      supabaseAdmin().from('acct_ar_invoices').select('total, amount_paid, amount_credited, due_date, status').eq('tenant_id', TENANT),
      supabaseAdmin().from('acct_journal_entries').select('entry_date, memo, total_debit').eq('tenant_id', TENANT).order('entry_date', { ascending: false }).limit(10),
    ]);
    for (const r of [bankTx, bills, invoices, journals]) {
      if (r.error) throw new Error(r.error.message);
    }
    const cash = round2((bankTx.data ?? []).reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0));
    const openBills = (bills.data ?? []).filter((b: any) => b.status !== 'Paid' && b.status !== 'Void');
    const openInvoices = (invoices.data ?? []).filter((i: any) => i.status !== 'Paid' && i.status !== 'Void');
    const openAp = round2(openBills.reduce((s: number, b: any) => s + Number(b.total ?? 0) - Number(b.amount_paid ?? 0) - Number(b.amount_credited ?? 0), 0));
    const openAr = round2(openInvoices.reduce((s: number, i: any) => s + Number(i.total ?? 0) - Number(i.amount_paid ?? 0) - Number(i.amount_credited ?? 0), 0));
    const today = new Date().toISOString().slice(0, 10);
    const overdueBills = openBills.filter((b: any) => b.due_date && b.due_date < today).length;
    const overdueInvoices = openInvoices.filter((i: any) => i.due_date && i.due_date < today).length;
    const recentActivity = (journals.data ?? []).map((j: any) => ({
      date: String(j.entry_date ?? '').slice(0, 10),
      text: String(j.memo ?? 'Journal entry'),
      amount: round2(j.total_debit),
    }));
    return Response.json({ cash, openAp, openAr, overdueBills, overdueInvoices, recentActivity });
  } catch (e) {
    return toErrorResponse(e);
  }
}
