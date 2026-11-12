import { NextRequest } from 'next/server';
import {
  supabaseAdmin, TENANT, toErrorResponse, pageParams, createJournal,
  journalToDoc, withIdempotency,
} from '@/lib/financeServer';

/** GET /api/v1/finance/journal?bookId=&periodId= — entries + lines, date desc. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { limit, offset } = pageParams(url);
    let query = supabaseAdmin().from('acct_journal_entries').select('*', { count: 'exact' }).eq('tenant_id', TENANT);
    const bookId = url.searchParams.get('bookId');
    const periodId = url.searchParams.get('periodId');
    if (bookId) query = query.eq('book_id', bookId);
    if (periodId) query = query.eq('period_id', periodId);
    const { data, error, count } = await query.order('entry_date', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(`acct_journal_entries: ${error.message}`);
    const entries = data ?? [];
    const ids = entries.map((e: any) => e.id);
    let linesByEntry = new Map<string, any[]>();
    if (ids.length > 0) {
      const { data: lines, error: le } = await supabaseAdmin().from('acct_journal_lines').select('*').in('journal_entry_id', ids).order('line_no');
      if (le) throw new Error(`acct_journal_lines: ${le.message}`);
      for (const l of lines ?? []) {
        const list = linesByEntry.get(String(l.journal_entry_id)) ?? [];
        list.push(l);
        linesByEntry.set(String(l.journal_entry_id), list);
      }
    }
    return Response.json({
      items: entries.map((e: any) => journalToDoc(e, linesByEntry.get(String(e.id)) ?? [])),
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** POST /api/v1/finance/journal — manual balanced entry (open period required). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, body, () =>
      createJournal({
        bookId: body.bookId ? String(body.bookId) : undefined,
        entryDate: String(body.entryDate ?? new Date().toISOString().slice(0, 10)),
        source: 'manual',
        sourceId: String(body.sourceId ?? 'manual'),
        memo: body.memo ?? '',
        reference: body.reference ?? null,
        lines: (body.lines ?? []).map((l: any) => ({
          accountId: l.accountId ?? l.account,
          debit: Number(l.debit ?? 0),
          credit: Number(l.credit ?? 0),
          description: l.description ?? '',
          customerId: l.customerId ?? null,
          vendorId: l.vendorId ?? null,
          employeeId: l.employeeId ?? null,
          taxCodeId: l.taxCodeId ?? null,
        })),
      }),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
