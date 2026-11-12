import { NextRequest } from 'next/server';
import {
  supabaseAdmin, TENANT, FinanceError, toErrorResponse, getDocument, createJournal,
  withIdempotency,
} from '@/lib/financeServer';

/** GET /api/v1/finance/documents/:id?type= — one document + lines. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const type = new URL(req.url).searchParams.get('type') ?? undefined;
    const doc = await getDocument(id, type);
    if (!doc) return Response.json({ error: { code: 'NOT_FOUND', message: `document ${id} not found` } }, { status: 404 });
    return Response.json(doc);
  } catch (e) {
    return toErrorResponse(e);
  }
}

const TABLES: Record<string, { table: string; dueCol?: string; notesCol?: string; voidCol?: string }> = {
  Bill: { table: 'acct_ap_bills', dueCol: 'due_date' },
  Invoice: { table: 'acct_ar_invoices', dueCol: 'due_date', notesCol: 'notes', voidCol: 'voided_at' },
  Estimate: { table: 'acct_estimates', dueCol: 'expiry_date', notesCol: 'notes' },
  PurchaseOrder: { table: 'acct_ap_purchase_orders', dueCol: 'expected_date' },
  SalesReceipt: { table: 'acct_ar_receipts' },
  CreditMemo: { table: 'acct_ar_credit_memos' },
  JournalEntry: { table: 'acct_journal_entries' },
  Expense: { table: 'acct_expense_reports' },
  Check: { table: 'acct_ap_payments' },
  RMA: { table: 'erp_return_authorizations', notesCol: 'notes' },
  SalesOrder: { table: 'orders' },
};

/**
 * PATCH /api/v1/finance/documents/:id?type= — status transitions + field
 * updates. status Posted on a Bill/Invoice/CreditMemo posts the accrual
 * journal (see contracts §3). Expense posting is unsupported; journal
 * entries are reversed, not voided; estimates convert via the convert endpoint.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const type = new URL(req.url).searchParams.get('type') ?? String(body.type ?? '');
    const cfg = TABLES[type];
    if (!cfg) throw new FinanceError('VALIDATION', 'query ?type= is required (or body.type)', 400);
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, { id, type, ...body }, () => patchDocument(id, type, cfg, body));
    return Response.json(result);
  } catch (e) {
    return toErrorResponse(e);
  }
}

async function patchDocument(id: string, type: string, cfg: (typeof TABLES)[string], body: any): Promise<any> {
  const { data: row, error } = await supabaseAdmin()
    .from(cfg.table)
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', id)
    .single();
  if (error || !row) throw new FinanceError('NOT_FOUND', `${type} ${id} not found`, 404);

  const status = body.status ? String(body.status) : null;
  if (status === 'Posted') {
    if (type === 'Expense') throw new FinanceError('VALIDATION', 'expense posting is unsupported (legs not defined in this contract set)', 400);
    if (type === 'Bill' || type === 'Invoice' || type === 'CreditMemo') {
      if (row.posted_journal_id) throw new FinanceError('VALIDATION', `${type} is already posted`, 400);
      await postAccrual(type, row);
      return getDocument(id, type);
    }
    throw new FinanceError('VALIDATION', `status Posted is not a transition for ${type}`, 400);
  }
  if (status === 'Void') {
    if (type === 'JournalEntry') throw new FinanceError('VALIDATION', 'journal entries are reversed, not voided', 400);
    if (type === 'SalesOrder') throw new FinanceError('VALIDATION', 'orders are voided by the checkout, not here', 400);
  }
  if (status === 'Converted' && type === 'Estimate') {
    throw new FinanceError('VALIDATION', 'use POST /finance/estimates/:id/convert', 400);
  }
  if (status === 'Paid' && (type === 'Bill' || type === 'Invoice')) {
    throw new FinanceError('VALIDATION', `use the pay / record-payment endpoint for ${type}`, 400);
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (body.dueDate !== undefined) {
    if (!cfg.dueCol) throw new FinanceError('VALIDATION', `${type} stores no due date`, 400);
    updates[cfg.dueCol] = String(body.dueDate);
  }
  if (body.notes !== undefined) {
    if (!cfg.notesCol) throw new FinanceError('VALIDATION', `${type} stores no notes`, 400);
    updates[cfg.notesCol] = String(body.notes);
  }
  if (status === 'Void' && cfg.voidCol) updates[cfg.voidCol] = new Date().toISOString();
  if (Object.keys(updates).length === 0) throw new FinanceError('VALIDATION', 'nothing to update', 400);
  const { error: upError } = await supabaseAdmin().from(cfg.table).update(updates).eq('id', id);
  if (upError) throw new FinanceError('INTERNAL', `${cfg.table}: ${upError.message}`, 500);
  return getDocument(id, type);
}

async function postAccrual(type: string, row: any): Promise<void> {
  const entryDate = String(row.bill_date ?? row.invoice_date ?? row.memo_date ?? '').slice(0, 10);
  if (type === 'Bill') {
    const { data: lines } = await supabaseAdmin().from('acct_ap_bill_lines').select('*').eq('bill_id', row.id).order('line_no');
    const { data: vendor } = await supabaseAdmin().from('acct_vendors').select('ap_account_id').eq('id', row.vendor_id).single();
    const apAccount = vendor?.ap_account_id as string | undefined;
    if (!apAccount) throw new FinanceError('VALIDATION', 'vendor has no AP account', 400);
    const journalLines: any[] = [];
    for (const l of lines ?? []) {
      if (!l.expense_account_id) throw new FinanceError('VALIDATION', `bill line ${l.line_no} has no expense account`, 400);
      journalLines.push({ accountId: String(l.expense_account_id), debit: Number(l.line_subtotal), description: String(l.description ?? ''), vendorId: row.vendor_id });
    }
    journalLines.push({ accountId: apAccount, credit: Number(row.total), description: `Bill ${row.bill_number}`, vendorId: row.vendor_id });
    const journal = await createJournal({ entryDate, source: 'bill_accrual', sourceId: row.id, memo: `Accrue bill ${row.bill_number}`, reference: row.bill_number, lines: journalLines });
    await supabaseAdmin().from('acct_ap_bills').update({ status: 'Posted', posted_journal_id: journal.id }).eq('id', row.id);
    return;
  }
  if (type === 'Invoice') {
    const { data: lines } = await supabaseAdmin().from('acct_ar_invoice_lines').select('*').eq('invoice_id', row.id).order('line_no');
    const { data: customer } = await supabaseAdmin().from('acct_customers').select('ar_account_id, default_revenue_account_id').eq('id', row.customer_id).single();
    const arAccount = customer?.ar_account_id as string | undefined;
    if (!arAccount) throw new FinanceError('VALIDATION', 'customer has no AR account', 400);
    const journalLines: any[] = [{ accountId: arAccount, debit: Number(row.total), description: `Invoice ${row.invoice_number}`, customerId: row.customer_id }];
    for (const l of lines ?? []) {
      const rev = (l.revenue_account_id as string | undefined) ?? (customer?.default_revenue_account_id as string | undefined);
      if (!rev) throw new FinanceError('VALIDATION', `invoice line ${l.line_no} has no revenue account`, 400);
      journalLines.push({ accountId: rev, credit: Number(l.line_subtotal), description: String(l.description ?? ''), customerId: row.customer_id });
    }
    const journal = await createJournal({ entryDate, source: 'invoice_accrual', sourceId: row.id, memo: `Accrue invoice ${row.invoice_number}`, reference: row.invoice_number, lines: journalLines });
    await supabaseAdmin().from('acct_ar_invoices').update({ status: 'Posted', posted_journal_id: journal.id }).eq('id', row.id);
    return;
  }
  // CreditMemo
  const { data: customer } = await supabaseAdmin().from('acct_customers').select('ar_account_id, default_revenue_account_id').eq('id', row.customer_id).single();
  const arAccount = customer?.ar_account_id as string | undefined;
  const revAccount = customer?.default_revenue_account_id as string | undefined;
  if (!arAccount || !revAccount) throw new FinanceError('VALIDATION', 'customer has no AR / default revenue account', 400);
  const journal = await createJournal({
    entryDate,
    source: 'credit_memo_accrual',
    sourceId: row.id,
    memo: `Credit memo ${row.memo_number}`,
    reference: row.memo_number,
    lines: [
      { accountId: revAccount, debit: Number(row.total), description: `Credit memo ${row.memo_number}`, customerId: row.customer_id },
      { accountId: arAccount, credit: Number(row.total), description: `Credit memo ${row.memo_number}`, customerId: row.customer_id },
    ],
  });
  await supabaseAdmin().from('acct_ar_credit_memos').update({ status: 'Posted', posted_journal_id: journal.id }).eq('id', row.id);
}
