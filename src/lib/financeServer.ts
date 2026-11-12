import { createHash } from 'crypto';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import { apiError } from './podServer';

/**
 * Finance server lib — two-layer model (commerce events = source of truth,
 * acct_* = the ledger). Backend only: API routes + posting hooks. No page or
 * component is touched by this file.
 *
 * Conventions (see ~/workspace/your_files/finance-api-contracts-2026-11-08.md):
 * tenant-scoped to DEFAULT_TENANT_ID, money is numeric dollars (2dp),
 * dates ISO, writes are idempotent via acct_integration_idempotency
 * (provider='finance-api'). Nothing here invents data.
 */

export { DEFAULT_TENANT_ID, apiError, supabaseAdmin };

export const TENANT = DEFAULT_TENANT_ID;
/** The tenant's real entity (Unsaid Memories, the one acct_entities row). */
export const ENTITY_ID = 'dfc5bec6-c927-43c4-bb55-10705f17ee0f';
const IDEMPOTENCY_PROVIDER = 'finance-api';

export class FinanceError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(e: unknown): Response {
  if (e instanceof FinanceError) {
    return Response.json(
      { error: { code: e.code, message: e.message, requestId: crypto.randomUUID() } },
      { status: e.status },
    );
  }
  return apiError(e instanceof Error ? e.message : 'finance: unknown error', 500);
}

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Parse ?limit=&offset= the way the v1 routes do. */
export function pageParams(url: URL): { limit: number; offset: number } {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  return { limit, offset };
}

/** Next document number per tenant+type: PREFIX-(count+1). Count-based (see contracts §0). */
export async function nextNumber(prefix: string, table: string): Promise<string> {
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT);
  if (error) throw new FinanceError('INTERNAL', `${table}: ${error.message}`, 500);
  return `${prefix}-${(count ?? 0) + 1}`;
}

/** Next sequence value as a number (for bigint number columns like entry_no). */
export async function nextSeq(table: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT);
  if (error) throw new FinanceError('INTERNAL', `${table}: ${error.message}`, 500);
  return (count ?? 0) + 1;
}

/** The open acct_periods row covering entryDate, else VALIDATION. */
export async function openPeriod(entryDate: string): Promise<any> {
  const { data, error } = await supabaseAdmin()
    .from('acct_periods')
    .select('id, book_id, name')
    .eq('tenant_id', TENANT)
    .eq('status', 'open')
    .lte('start_date', entryDate)
    .gte('end_date', entryDate)
    .limit(1)
    .maybeSingle();
  if (error) throw new FinanceError('INTERNAL', `acct_periods: ${error.message}`, 500);
  if (!data) throw new FinanceError('VALIDATION', `no open period covering ${entryDate}`, 400);
  return data;
}

/** Primary book, else the first active book. */
export async function primaryBook(): Promise<any> {
  const { data, error } = await supabaseAdmin()
    .from('acct_books')
    .select('id, code, name, currency')
    .eq('tenant_id', TENANT)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new FinanceError('INTERNAL', `acct_books: ${error.message}`, 500);
  if (data) return data;
  const fallback = await supabaseAdmin()
    .from('acct_books')
    .select('id, code, name, currency')
    .eq('tenant_id', TENANT)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (fallback.error) throw new FinanceError('INTERNAL', `acct_books: ${fallback.error.message}`, 500);
  if (!fallback.data) throw new FinanceError('VALIDATION', 'no accounting book configured', 400);
  return fallback.data;
}

/**
 * Idempotent write. key=null runs fn once with no replay. With a key:
 * same key+body hash replays the stored response; same key+different hash
 * is a 409. Rows live in acct_integration_idempotency.
 */
export async function withIdempotency<T>(
  key: string | null,
  body: unknown,
  fn: () => Promise<T>,
): Promise<{ replayed: boolean; result: T }> {
  if (!key) return { replayed: false, result: await fn() };
  const hash = createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
  const { data: existing, error } = await supabaseAdmin()
    .from('acct_integration_idempotency')
    .select('request_hash, response_payload, status_code')
    .eq('tenant_id', TENANT)
    .eq('provider', IDEMPOTENCY_PROVIDER)
    .eq('idempotency_key', key)
    .limit(1)
    .maybeSingle();
  if (error) throw new FinanceError('INTERNAL', `idempotency: ${error.message}`, 500);
  if (existing) {
    if (existing.request_hash !== hash) {
      throw new FinanceError('CONFLICT', 'Idempotency-Key reused with a different body', 409);
    }
    return { replayed: true, result: JSON.parse(existing.response_payload as string) as T };
  }
  const result = await fn();
  // Best-effort record — a race here must not fail a completed write.
  await supabaseAdmin().from('acct_integration_idempotency').insert({
    tenant_id: TENANT,
    provider: IDEMPOTENCY_PROVIDER,
    idempotency_key: key,
    request_hash: hash,
    response_payload: JSON.stringify(result),
    status_code: 200,
  });
  return { replayed: false, result };
}

export interface JournalLineInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string;
  customerId?: string | null;
  vendorId?: string | null;
  employeeId?: string | null;
  taxCodeId?: string | null;
}

export interface CreateJournalInput {
  bookId?: string;
  entryDate: string;
  source: string;
  sourceId: string;
  memo?: string;
  reference?: string;
  lines: JournalLineInput[];
}

/**
 * Create a balanced, posted journal entry. Validates Σdebit = Σcredit BEFORE
 * any write (UNBALANCED), requires an open period covering entryDate
 * (PERIOD_CLOSED/VALIDATION). Returns the entry row.
 */
export async function createJournal(input: CreateJournalInput): Promise<any> {
  const lines = input.lines.map((l) => ({
    accountId: l.accountId,
    debit: round2(l.debit ?? 0),
    credit: round2(l.credit ?? 0),
    description: l.description ?? '',
    customerId: l.customerId ?? null,
    vendorId: l.vendorId ?? null,
    employeeId: l.employeeId ?? null,
    taxCodeId: l.taxCodeId ?? null,
  }));
  if (lines.length < 2) throw new FinanceError('UNBALANCED', 'a journal entry needs at least two lines', 422);
  for (const l of lines) {
    if (!l.accountId) throw new FinanceError('VALIDATION', 'every journal line needs an accountId', 400);
    if (l.debit < 0 || l.credit < 0) throw new FinanceError('VALIDATION', 'debit/credit must be >= 0', 400);
    if (l.debit > 0 && l.credit > 0) throw new FinanceError('VALIDATION', 'a line is debit or credit, not both', 400);
  }
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    throw new FinanceError('UNBALANCED', `debit ${totalDebit} != credit ${totalCredit}`, 422);
  }
  const period = await openPeriod(input.entryDate);
  const book = input.bookId
    ? { id: input.bookId }
    : await primaryBook();
  // Entries belong to a batch (batch_id is NOT NULL, no default): one batch
  // per entry, named after the source.
  const batchNo = await nextNumber('BATCH', 'acct_journal_batches');
  const { data: batch, error: batchError } = await supabaseAdmin()
    .from('acct_journal_batches')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      book_id: book.id,
      batch_no: batchNo,
      source: input.source,
      status: 'posted',
      description: input.memo ?? null,
    })
    .select()
    .single();
  if (batchError || !batch) throw new FinanceError('INTERNAL', `journal batch: ${batchError?.message}`, 500);
  const entryNo = await nextSeq('acct_journal_entries');
  const now = new Date().toISOString();
  const { data: entry, error: entryError } = await supabaseAdmin()
    .from('acct_journal_entries')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      book_id: book.id,
      batch_id: batch.id,
      period_id: period.id,
      entry_no: entryNo,
      entry_date: input.entryDate,
      document_date: input.entryDate,
      posting_date: input.entryDate,
      source: input.source,
      source_id: input.sourceId,
      reference: input.reference ?? null,
      memo: input.memo ?? '',
      currency: 'USD',
      exchange_rate: 1,
      total_debit: totalDebit,
      total_credit: totalCredit,
      status: 'Posted',
      posted_at: now,
    })
    .select()
    .single();
  if (entryError || !entry) throw new FinanceError('INTERNAL', `journal entry: ${entryError?.message}`, 500);
  const { error: linesError } = await supabaseAdmin()
    .from('acct_journal_lines')
    .insert(
      lines.map((l, i) => ({
        tenant_id: TENANT,
        entity_id: ENTITY_ID,
        journal_entry_id: entry.id,
        line_no: i + 1,
        account_id: l.accountId,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        transaction_currency: 'USD',
        transaction_debit: l.debit,
        transaction_credit: l.credit,
        exchange_rate: 1,
        customer_id: l.customerId,
        vendor_id: l.vendorId,
        employee_id: l.employeeId,
        tax_code_id: l.taxCodeId,
        dimensions: {},
      })),
    );
  if (linesError) throw new FinanceError('INTERNAL', `journal lines: ${linesError.message}`, 500);
  return entry;
}

/* ═══ Document shape (platformStore Document, verbatim field names) ═══ */

export type DocType =
  | 'Invoice' | 'Estimate' | 'Bill' | 'PurchaseOrder' | 'SalesReceipt'
  | 'CreditMemo' | 'SalesOrder' | 'VendorCredit' | 'JournalEntry' | 'RMA'
  | 'Expense' | 'Check';

export interface DocLine {
  id: string;
  itemId: string | null;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  taxRate: number;
  account: string;
  tags: string[];
}

export interface FinanceDocument {
  id: string;
  type: DocType;
  number: string;
  partyId: string;
  status: string;
  date: string;
  dueDate: string;
  lines: DocLine[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  amountPaid: number;
  balance: number;
  memo: string;
  notes: string;
  tags: string[];
  attachments: string[];
  orderId: string | null;
  poId: string | null;
  channelId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activity: { date: string; type: string; text: string; actor: string }[];
}

const isoDate = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 10) : '');
const isoStamp = (v: unknown): string => (typeof v === 'string' ? v : '');

/* Stored statuses are lowercase seed values (open/paid/partially_paid/
   received/posted/held/pending/settled/refund); the screens use the
   DocumentStatus enum (Open/Paid/Posted/…). Normalize on read so the API
   speaks the screens' language. Unknown values pass through unchanged —
   never silently relabeled. */
const DOC_STATUSES = new Set([
  'Draft', 'Sent', 'Unpaid', 'Overdue', 'Paid', 'Deposited', 'ForReview',
  'Approved', 'Shipped', 'Delivered', 'Returned', 'PartiallyReceived',
  'Received', 'Closed', 'Void', 'Open', 'Converted', 'Declined', 'Pending',
  'Requested', 'Fulfilled', 'Printed', 'Applied', 'Posted',
]);

export function toDocStatus(stored: unknown): string {
  const s = String(stored ?? '');
  const map: Record<string, string> = {
    posted: 'Posted',
    paid: 'Paid',
    open: 'Open',
    partially_paid: 'Unpaid',
    received: 'Received',
    draft: 'Draft',
    sent: 'Sent',
    approved: 'Approved',
    void: 'Void',
    overdue: 'Overdue',
    pending: 'Pending',
    held: 'ForReview',
    settled: 'Deposited',
    refund: 'Returned',
    requested: 'Requested',
    issued: 'Sent',
  };
  if (map[s]) return map[s];
  const capitalized = s.charAt(0).toUpperCase() + s.slice(1);
  return DOC_STATUSES.has(capitalized) ? capitalized : s;
}

function baseDoc(row: any, type: DocType): FinanceDocument {
  return {
    id: String(row.id),
    type,
    number: '',
    partyId: '',
    status: toDocStatus(row.status),
    date: '',
    dueDate: '',
    lines: [],
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0,
    amountPaid: 0,
    balance: 0,
    memo: '',
    notes: '',
    tags: [],
    attachments: [],
    orderId: null,
    poId: null,
    channelId: null,
    createdBy: String(row.created_by ?? ''),
    createdAt: isoStamp(row.created_at),
    updatedAt: isoStamp(row.updated_at ?? row.created_at),
    activity: [],
  };
}

export type TaxRateMap = Map<string, number>;
const taxRate = (m: TaxRateMap, codeId: unknown): number =>
  typeof codeId === 'string' ? (m.get(codeId) ?? 0) : 0;

export function billToDoc(row: any, lines: any[], tax: TaxRateMap): FinanceDocument {
  const d = baseDoc(row, 'Bill');
  d.number = String(row.bill_number ?? '');
  d.partyId = String(row.vendor_id ?? '');
  d.date = isoDate(row.bill_date);
  d.dueDate = isoDate(row.due_date);
  d.subtotal = round2(row.subtotal);
  d.tax = round2(row.tax_total);
  d.total = round2(row.total);
  d.amountPaid = round2(row.amount_paid);
  d.balance = round2(row.total - row.amount_paid - row.amount_credited);
  d.memo = String(row.memo ?? '');
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: l.item_ref ? String(l.item_ref) : null,
    description: String(l.description ?? ''),
    qty: Number(l.quantity ?? 0),
    rate: round2(l.unit_cost),
    amount: round2(l.line_subtotal),
    taxRate: taxRate(tax, l.tax_code_id),
    account: String(l.expense_account_id ?? ''),
    tags: [],
  }));
  return d;
}

export function invoiceToDoc(row: any, lines: any[], tax: TaxRateMap): FinanceDocument {
  const d = baseDoc(row, 'Invoice');
  d.number = String(row.invoice_number ?? '');
  d.partyId = String(row.customer_id ?? '');
  d.date = isoDate(row.invoice_date);
  d.dueDate = isoDate(row.due_date);
  d.subtotal = round2(row.subtotal);
  d.tax = round2(row.tax_total);
  d.shipping = 0;
  d.total = round2(row.total);
  d.amountPaid = round2(row.amount_paid);
  d.balance = round2(row.total - row.amount_paid - row.amount_credited);
  d.memo = String(row.notes ?? '');
  d.notes = String(row.terms ?? '');
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: l.item_ref ? String(l.item_ref) : null,
    description: String(l.description ?? ''),
    qty: Number(l.quantity ?? 0),
    rate: round2(l.unit_price),
    amount: round2(l.line_subtotal),
    taxRate: taxRate(tax, l.tax_code_id),
    account: String(l.revenue_account_id ?? ''),
    tags: [],
  }));
  return d;
}

export function estimateToDoc(row: any, lines: any[], tax: TaxRateMap): FinanceDocument {
  const d = baseDoc(row, 'Estimate');
  d.number = String(row.estimate_number ?? '');
  d.partyId = String(row.customer_id ?? '');
  d.date = isoDate(row.estimate_date ?? row.issue_date);
  d.dueDate = isoDate(row.expiry_date);
  d.subtotal = round2(row.subtotal);
  d.tax = round2(row.tax_total);
  d.total = round2(row.total);
  d.amountPaid = 0;
  d.balance = round2(row.total);
  d.memo = String(row.notes ?? '');
  d.notes = String(row.terms ?? '');
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: l.service_id ? String(l.service_id) : null,
    description: String(l.description ?? ''),
    qty: Number(l.quantity ?? 0),
    rate: round2(l.unit_price),
    amount: round2(l.line_total),
    taxRate: taxRate(tax, null),
    account: '',
    tags: [],
  }));
  return d;
}

export function poToDoc(row: any, lines: any[]): FinanceDocument {
  const d = baseDoc(row, 'PurchaseOrder');
  d.number = String(row.po_number ?? '');
  d.partyId = String(row.vendor_id ?? '');
  d.date = isoDate(row.order_date);
  d.dueDate = isoDate(row.expected_date);
  d.subtotal = round2(row.subtotal);
  d.tax = round2(row.tax_total);
  d.total = round2(row.total);
  d.amountPaid = 0;
  d.balance = round2(row.total);
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: null,
    description: String(l.description ?? ''),
    qty: Number(l.quantity ?? 0),
    rate: round2(l.unit_cost),
    amount: round2(l.quantity * l.unit_cost),
    taxRate: 0,
    account: String(l.expense_account_id ?? ''),
    tags: [],
  }));
  return d;
}

export function receiptToDoc(row: any): FinanceDocument {
  const d = baseDoc(row, 'SalesReceipt');
  d.number = String(row.receipt_number ?? '');
  d.partyId = String(row.customer_id ?? '');
  d.date = isoDate(row.receipt_date);
  d.dueDate = d.date;
  d.subtotal = round2(row.amount);
  d.tax = 0;
  d.total = round2(row.amount);
  d.amountPaid = round2(row.amount);
  d.balance = 0;
  d.lines = [{
    id: String(row.id),
    itemId: null,
    description: String(row.reference ?? 'Receipt'),
    qty: 1,
    rate: round2(row.amount),
    amount: round2(row.amount),
    taxRate: 0,
    account: String(row.deposit_account_id ?? ''),
    tags: [],
  }];
  return d;
}

export function creditMemoToDoc(row: any): FinanceDocument {
  const d = baseDoc(row, 'CreditMemo');
  d.number = String(row.memo_number ?? '');
  d.partyId = String(row.customer_id ?? '');
  d.date = isoDate(row.memo_date);
  d.dueDate = d.date;
  d.subtotal = round2(row.subtotal);
  d.tax = round2(row.tax_total);
  d.total = round2(row.total);
  d.amountPaid = round2(row.applied_amount);
  d.balance = round2(row.total - row.applied_amount);
  d.memo = String(row.reason ?? '');
  return d;
}

export function journalToDoc(row: any, lines: any[]): FinanceDocument {
  const d = baseDoc(row, 'JournalEntry');
  d.number = String(row.entry_no ?? '');
  d.date = isoDate(row.entry_date);
  d.dueDate = d.date;
  d.subtotal = round2(row.total_debit);
  d.tax = 0;
  d.total = round2(row.total_debit);
  d.amountPaid = 0;
  d.balance = round2(row.total_debit);
  d.memo = String(row.memo ?? '');
  d.notes = String(row.reference ?? '');
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: null,
    description: String(l.description ?? ''),
    qty: 1,
    rate: round2(l.debit || l.credit),
    amount: round2(l.debit || l.credit),
    taxRate: 0,
    account: String(l.account_id ?? ''),
    tags: [],
  }));
  return d;
}

export function expenseToDoc(row: any, lines: any[]): FinanceDocument {
  const d = baseDoc(row, 'Expense');
  d.number = String(row.report_number ?? '');
  d.partyId = String(row.employee_id ?? '');
  d.date = isoDate(row.report_date);
  d.dueDate = d.date;
  d.subtotal = round2(row.total_amount);
  d.tax = 0;
  d.total = round2(row.total_amount);
  d.amountPaid = 0;
  d.balance = round2(row.total_amount);
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: null,
    description: String(l.description ?? l.merchant ?? ''),
    qty: 1,
    rate: round2(l.amount),
    amount: round2(l.amount),
    taxRate: 0,
    account: String(l.expense_account_id ?? ''),
    tags: [],
  }));
  return d;
}

export function paymentToDoc(row: any): FinanceDocument {
  const d = baseDoc(row, 'Check');
  d.number = String(row.payment_number ?? '');
  d.partyId = String(row.vendor_id ?? '');
  d.date = isoDate(row.payment_date);
  d.dueDate = d.date;
  d.subtotal = round2(row.amount);
  d.total = round2(row.amount);
  d.amountPaid = round2(row.amount);
  d.balance = 0;
  d.memo = String(row.reference ?? '');
  d.lines = [{
    id: String(row.id),
    itemId: null,
    description: `Payment ${row.payment_method ?? ''}`.trim(),
    qty: 1,
    rate: round2(row.amount),
    amount: round2(row.amount),
    taxRate: 0,
    account: String(row.cash_account_id ?? ''),
    tags: [],
  }];
  return d;
}

export function rmaToDoc(row: any, lines: any[]): FinanceDocument {
  const d = baseDoc(row, 'RMA');
  d.number = String(row.rma_number ?? '');
  d.partyId = String(row.crm_customer_id ?? '');
  d.date = isoDate(row.requested_at);
  d.dueDate = d.date;
  d.total = round2((lines ?? []).reduce((s: number, l: any) => s + Number(l.refund_amount ?? 0), 0));
  d.balance = d.total;
  d.memo = String(row.notes ?? '');
  d.lines = (lines ?? []).map((l: any) => ({
    id: String(l.id),
    itemId: l.sku_id ? String(l.sku_id) : null,
    description: `Return line (${l.disposition ?? 'pending'})`,
    qty: Number(l.quantity_requested ?? 0),
    rate: round2(l.refund_amount),
    amount: round2(l.refund_amount),
    taxRate: 0,
    account: '',
    tags: [],
  }));
  return d;
}

export function orderToDoc(row: any, items: any[], productNames: Map<string, string>): FinanceDocument {
  const d = baseDoc(row, 'SalesOrder');
  d.number = `ORD-${String(row.id).slice(0, 8)}`;
  d.partyId = String(row.customer_id ?? '');
  d.date = isoDate(row.created_at);
  d.dueDate = d.date;
  d.shipping = round2(row.shipping_cost);
  d.total = round2(row.total);
  d.subtotal = round2(row.total - row.shipping_cost);
  d.amountPaid = 0;
  d.balance = round2(row.total);
  d.orderId = String(row.id);
  d.lines = (items ?? []).map((it: any) => {
    const name = productNames.get(String(it.supplier_catalog_variant_id ?? '')) ?? `Item ${String(it.supplier_catalog_variant_id ?? '').slice(0, 8)}`;
    return {
      id: String(it.id),
      itemId: it.supplier_catalog_variant_id ? String(it.supplier_catalog_variant_id) : null,
      description: name,
      qty: Number(it.quantity ?? 0),
      rate: round2(it.unit_price),
      amount: round2(it.quantity * it.unit_price),
      taxRate: 0,
      account: '',
      tags: [],
    };
  });
  return d;
}

/* ═══ Document listing / fetch ═══ */

export async function taxRateMap(): Promise<TaxRateMap> {
  const { data, error } = await supabaseAdmin()
    .from('acct_tax_rates')
    .select('id, rate_percent')
    .eq('tenant_id', TENANT)
    .eq('is_active', true);
  if (error) throw new FinanceError('INTERNAL', `acct_tax_rates: ${error.message}`, 500);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(String((r as any).id), Number((r as any).rate_percent ?? 0));
  return m;
}

interface HeaderQuery {
  type: DocType;
  table: string;
  partyCol: string | null;
  dateCol: string;
  toDoc: (row: any, lines: any[], tax: TaxRateMap) => FinanceDocument;
  lineTable?: string;
  lineFk?: string;
}

const HEADER_QUERIES: HeaderQuery[] = [
  { type: 'Bill', table: 'acct_ap_bills', partyCol: 'vendor_id', dateCol: 'bill_date', lineTable: 'acct_ap_bill_lines', lineFk: 'bill_id', toDoc: (r, l, t) => billToDoc(r, l, t) },
  { type: 'Invoice', table: 'acct_ar_invoices', partyCol: 'customer_id', dateCol: 'invoice_date', lineTable: 'acct_ar_invoice_lines', lineFk: 'invoice_id', toDoc: (r, l, t) => invoiceToDoc(r, l, t) },
  { type: 'Estimate', table: 'acct_estimates', partyCol: 'customer_id', dateCol: 'estimate_date', lineTable: 'acct_estimate_lines', lineFk: 'estimate_id', toDoc: (r, l, t) => estimateToDoc(r, l, t) },
  { type: 'PurchaseOrder', table: 'acct_ap_purchase_orders', partyCol: 'vendor_id', dateCol: 'order_date', lineTable: 'acct_ap_purchase_order_lines', lineFk: 'purchase_order_id', toDoc: (r, l) => poToDoc(r, l) },
  { type: 'SalesReceipt', table: 'acct_ar_receipts', partyCol: 'customer_id', dateCol: 'receipt_date', toDoc: (r) => receiptToDoc(r) },
  { type: 'CreditMemo', table: 'acct_ar_credit_memos', partyCol: 'customer_id', dateCol: 'memo_date', toDoc: (r) => creditMemoToDoc(r) },
  { type: 'JournalEntry', table: 'acct_journal_entries', partyCol: null, dateCol: 'entry_date', lineTable: 'acct_journal_lines', lineFk: 'journal_entry_id', toDoc: (r, l) => journalToDoc(r, l) },
  { type: 'Expense', table: 'acct_expense_reports', partyCol: 'employee_id', dateCol: 'report_date', lineTable: 'acct_expense_lines', lineFk: 'expense_report_id', toDoc: (r, l) => expenseToDoc(r, l) },
  { type: 'Check', table: 'acct_ap_payments', partyCol: 'vendor_id', dateCol: 'payment_date', toDoc: (r) => paymentToDoc(r) },
  { type: 'RMA', table: 'erp_return_authorizations', partyCol: 'crm_customer_id', dateCol: 'requested_at', lineTable: 'erp_return_lines', lineFk: 'rma_id', toDoc: (r, l) => rmaToDoc(r, l) },
  { type: 'SalesOrder', table: 'orders', partyCol: 'customer_id', dateCol: 'created_at', lineTable: 'order_items', lineFk: 'order_id', toDoc: (r, l) => orderToDoc(r, l, new Map()) },
];

export interface ListDocsParams {
  type?: string;
  status?: string;
  partyId?: string;
  limit: number;
  offset: number;
}

export async function listDocuments(p: ListDocsParams): Promise<{ items: FinanceDocument[]; total: number }> {
  const wanted = HEADER_QUERIES.filter((q) => !p.type || q.type === p.type);
  if (p.type && wanted.length === 0) throw new FinanceError('VALIDATION', `unknown document type ${p.type}`, 400);
  const tax = await taxRateMap();
  const all: FinanceDocument[] = [];
  // Headers first (one query per type), then lines for the page only.
  const byType = new Map<DocType, any[]>();
  await Promise.all(
    wanted.map(async (q) => {
      // Status is NOT filtered in the DB: stored values are lowercase seed
      // values (open/paid/posted) while callers use DocumentStatus
      // (Open/Paid/Posted). Filter in JS after toDocStatus normalizes.
      let query = supabaseAdmin().from(q.table).select('*').eq('tenant_id', TENANT);
      if (p.partyId && q.partyCol) query = query.eq(q.partyCol, p.partyId);
      const { data, error } = await query.order(q.dateCol, { ascending: false }).limit(200);
      if (error) throw new FinanceError('INTERNAL', `${q.table}: ${error.message}`, 500);
      byType.set(q.type, data ?? []);
    }),
  );
  for (const q of wanted) {
    for (const row of byType.get(q.type) ?? []) {
      all.push(q.toDoc(row, [], tax));
    }
  }
  all.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  const filtered = p.status ? all.filter((d) => d.status === p.status) : all;
  const total = filtered.length;
  const page = filtered.slice(p.offset, p.offset + p.limit);
  // Attach lines for the page only, bulk per line table.
  const pageByType = new Map<DocType, FinanceDocument[]>();
  for (const d of page) {
    const list = pageByType.get(d.type) ?? [];
    list.push(d);
    pageByType.set(d.type, list);
  }
  await Promise.all(
    [...pageByType.entries()].map(async ([type, docs]) => {
      const q = HEADER_QUERIES.find((h) => h.type === type)!;
      if (!q.lineTable || !q.lineFk) return;
      const ids = docs.map((d) => d.id);
      if (type === 'SalesOrder') {
        const { data: items, error } = await supabaseAdmin()
          .from('order_items')
          .select('*')
          .in('order_id', ids);
        if (error) throw new FinanceError('INTERNAL', `order_items: ${error.message}`, 500);
        const variantIds = [...new Set((items ?? []).map((i: any) => String(i.supplier_catalog_variant_id ?? '')).filter(Boolean))];
        const names = await productNamesForVariants(variantIds);
        for (const d of docs) {
          const lines = (items ?? []).filter((i: any) => String(i.order_id) === d.id);
          const mapped = orderToDoc(
            { id: d.id, customer_id: d.partyId, created_at: d.date, total: d.total, shipping_cost: d.shipping },
            lines,
            names,
          );
          d.lines = mapped.lines;
        }
        return;
      }
      const { data: lines, error } = await supabaseAdmin()
        .from(q.lineTable)
        .select('*')
        .in(q.lineFk, ids)
        .order('line_no', { ascending: true });
      if (error) throw new FinanceError('INTERNAL', `${q.lineTable}: ${error.message}`, 500);
      for (const d of docs) {
        const docLines = (lines ?? []).filter((l: any) => String(l[q.lineFk!]) === d.id);
        d.lines = q.toDoc({ ...docRowFor(d), id: d.id }, docLines, tax).lines;
      }
    }),
  );
  return { items: page, total };
}

function docRowFor(d: FinanceDocument): any {
  // Rebuild a minimal header row so the mapper can re-attach lines; the
  // mapped doc keeps its header fields (only .lines is taken from the result).
  return { id: d.id, status: d.status };
}

async function productNamesForVariants(variantIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (variantIds.length === 0) return names;
  const { data: variants, error } = await supabaseAdmin()
    .from('supplier_catalog_variants')
    .select('id, supplier_catalog_product_id')
    .in('id', variantIds);
  if (error || !variants) return names;
  const productIds = [...new Set((variants as any[]).map((v) => String(v.supplier_catalog_product_id ?? '')).filter(Boolean))];
  const variantToProduct = new Map((variants as any[]).map((v) => [String(v.id), String(v.supplier_catalog_product_id ?? '')]));
  if (productIds.length === 0) return names;
  const { data: products } = await supabaseAdmin()
    .from('supplier_catalog_products')
    .select('id, name')
    .in('id', productIds);
  const productName = new Map((products ?? []).map((p: any) => [String(p.id), String(p.name ?? '')]));
  for (const vid of variantIds) {
    const pid = variantToProduct.get(vid);
    if (pid && productName.get(pid)) names.set(vid, productName.get(pid)!);
  }
  return names;
}

export async function getDocument(id: string, type?: string): Promise<FinanceDocument | null> {
  const tax = await taxRateMap();
  const wanted = HEADER_QUERIES.filter((q) => !type || q.type === type);
  for (const q of wanted) {
    const { data: row, error } = await supabaseAdmin()
      .from(q.table)
      .select('*')
      .eq('tenant_id', TENANT)
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    if (error) throw new FinanceError('INTERNAL', `${q.table}: ${error.message}`, 500);
    if (!row) continue;
    let lines: any[] = [];
    if (q.lineTable && q.lineFk) {
      if (q.type === 'SalesOrder') {
        const { data: items } = await supabaseAdmin().from('order_items').select('*').eq('order_id', id);
        const variantIds = [...new Set((items ?? []).map((i: any) => String(i.supplier_catalog_variant_id ?? '')).filter(Boolean))];
        const names = await productNamesForVariants(variantIds);
        return orderToDoc(row, items ?? [], names);
      }
      const { data, error: lineError } = await supabaseAdmin()
        .from(q.lineTable)
        .select('*')
        .eq(q.lineFk, id)
        .order('line_no', { ascending: true });
      if (lineError) throw new FinanceError('INTERNAL', `${q.lineTable}: ${lineError.message}`, 500);
      lines = data ?? [];
    }
    return q.toDoc(row, lines, tax);
  }
  return null;
}

/* ═══ Posting hooks ═══ */

export interface PayBillInput {
  amount: number;
  paymentMethod: string;
  cashAccountId: string;
  paymentDate: string;
}

export async function payBill(billId: string, input: PayBillInput): Promise<any> {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new FinanceError('VALIDATION', 'amount must be > 0', 400);
  if (!input.cashAccountId) throw new FinanceError('VALIDATION', 'cashAccountId is required', 400);
  const { data: bill, error } = await supabaseAdmin()
    .from('acct_ap_bills')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', billId)
    .single();
  if (error || !bill) throw new FinanceError('NOT_FOUND', `bill ${billId} not found`, 404);
  if (bill.status === 'Paid') throw new FinanceError('VALIDATION', 'bill is already paid', 400);
  if (bill.status === 'Void') throw new FinanceError('VALIDATION', 'bill is void', 400);
  const balance = round2(bill.total - bill.amount_paid - bill.amount_credited);
  if (amount > balance) throw new FinanceError('VALIDATION', `amount ${amount} exceeds balance ${balance}`, 400);
  const { data: vendor } = await supabaseAdmin()
    .from('acct_vendors')
    .select('ap_account_id')
    .eq('tenant_id', TENANT)
    .eq('id', bill.vendor_id)
    .single();
  const apAccount = vendor?.ap_account_id as string | undefined;
  if (!apAccount) throw new FinanceError('VALIDATION', 'vendor has no AP account', 400);
  // Journal first (the immutable record), then payment, application, bill.
  const journal = await createJournal({
    entryDate: input.paymentDate,
    source: 'bill_payment',
    sourceId: billId,
    memo: `Pay bill ${bill.bill_number}`,
    reference: bill.bill_number,
    lines: [
      { accountId: apAccount, debit: amount, description: `Pay bill ${bill.bill_number}`, vendorId: bill.vendor_id },
      { accountId: input.cashAccountId, credit: amount, description: `Pay bill ${bill.bill_number}` },
    ],
  });
  const paymentNo = await nextNumber('PAY', 'acct_ap_payments');
  const { data: payment, error: payError } = await supabaseAdmin()
    .from('acct_ap_payments')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      vendor_id: bill.vendor_id,
      payment_number: paymentNo,
      payment_date: input.paymentDate,
      currency: bill.currency ?? 'USD',
      amount,
      payment_method: input.paymentMethod,
      status: 'Paid',
      cash_account_id: input.cashAccountId,
      reference: bill.bill_number,
      posted_journal_id: journal.id,
    })
    .select()
    .single();
  if (payError || !payment) throw new FinanceError('INTERNAL', `payment (journal ${journal.id} posted): ${payError?.message}`, 500);
  const { error: appError } = await supabaseAdmin()
    .from('acct_ap_payment_applications')
    .insert({ payment_id: payment.id, bill_id: billId, applied_amount: amount });
  if (appError) throw new FinanceError('INTERNAL', `application (payment ${payment.id}): ${appError.message}`, 500);
  const newPaid = round2(bill.amount_paid + amount);
  const { error: billError } = await supabaseAdmin()
    .from('acct_ap_bills')
    .update({ amount_paid: newPaid, status: newPaid >= round2(bill.total - bill.amount_credited) ? 'Paid' : bill.status })
    .eq('id', billId);
  if (billError) throw new FinanceError('INTERNAL', `bill update (payment ${payment.id}): ${billError.message}`, 500);
  return { payment, journalEntryId: journal.id, billId, amountPaid: newPaid };
}

export interface RecordReceiptInput {
  amount: number;
  paymentMethod: string;
  depositAccountId: string;
  paymentDate: string;
  saleId?: string | null;
}

export async function recordInvoicePayment(invoiceId: string, input: RecordReceiptInput): Promise<any> {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new FinanceError('VALIDATION', 'amount must be > 0', 400);
  if (!input.depositAccountId) throw new FinanceError('VALIDATION', 'depositAccountId is required', 400);
  const { data: invoice, error } = await supabaseAdmin()
    .from('acct_ar_invoices')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) throw new FinanceError('NOT_FOUND', `invoice ${invoiceId} not found`, 404);
  if (invoice.status === 'Paid') throw new FinanceError('VALIDATION', 'invoice is already paid', 400);
  if (invoice.status === 'Void') throw new FinanceError('VALIDATION', 'invoice is void', 400);
  const balance = round2(invoice.total - invoice.amount_paid - invoice.amount_credited);
  if (amount > balance) throw new FinanceError('VALIDATION', `amount ${amount} exceeds balance ${balance}`, 400);
  const { data: customer } = await supabaseAdmin()
    .from('acct_customers')
    .select('ar_account_id')
    .eq('tenant_id', TENANT)
    .eq('id', invoice.customer_id)
    .single();
  const arAccount = customer?.ar_account_id as string | undefined;
  if (!arAccount) throw new FinanceError('VALIDATION', 'customer has no AR account', 400);
  const journal = await createJournal({
    entryDate: input.paymentDate,
    source: 'invoice_receipt',
    sourceId: invoiceId,
    memo: `Receipt for invoice ${invoice.invoice_number}`,
    reference: invoice.invoice_number,
    lines: [
      { accountId: input.depositAccountId, debit: amount, description: `Receipt ${invoice.invoice_number}`, customerId: invoice.customer_id },
      { accountId: arAccount, credit: amount, description: `Receipt ${invoice.invoice_number}`, customerId: invoice.customer_id },
    ],
  });
  const receiptNo = await nextNumber('RCPT', 'acct_ar_receipts');
  const { data: receipt, error: rcptError } = await supabaseAdmin()
    .from('acct_ar_receipts')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      customer_id: invoice.customer_id,
      receipt_number: receiptNo,
      receipt_date: input.paymentDate,
      currency: invoice.currency ?? 'USD',
      amount,
      payment_method: input.paymentMethod,
      status: 'Paid',
      deposit_account_id: input.depositAccountId,
      reference: invoice.invoice_number,
      posted_journal_id: journal.id,
    })
    .select()
    .single();
  if (rcptError || !receipt) throw new FinanceError('INTERNAL', `receipt (journal ${journal.id} posted): ${rcptError?.message}`, 500);
  const { error: appError } = await supabaseAdmin()
    .from('acct_ar_receipt_applications')
    .insert({ receipt_id: receipt.id, invoice_id: invoiceId, applied_amount: amount });
  if (appError) throw new FinanceError('INTERNAL', `application (receipt ${receipt.id}): ${appError.message}`, 500);
  const newPaid = round2(invoice.amount_paid + amount);
  const { error: invError } = await supabaseAdmin()
    .from('acct_ar_invoices')
    .update({ amount_paid: newPaid, status: newPaid >= round2(invoice.total - invoice.amount_credited) ? 'Paid' : invoice.status })
    .eq('id', invoiceId);
  if (invError) throw new FinanceError('INTERNAL', `invoice update (receipt ${receipt.id}): ${invError.message}`, 500);
  if (input.saleId) {
    await supabaseAdmin()
      .from('commerce_payments')
      .update({ acct_receipt_id: receipt.id })
      .eq('tenant_id', TENANT)
      .eq('sale_id', input.saleId)
      .is('acct_receipt_id', null);
  }
  return { receipt, journalEntryId: journal.id, invoiceId, amountPaid: newPaid };
}

export async function convertEstimate(estimateId: string): Promise<any> {
  const { data: est, error } = await supabaseAdmin()
    .from('acct_estimates')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', estimateId)
    .single();
  if (error || !est) throw new FinanceError('NOT_FOUND', `estimate ${estimateId} not found`, 404);
  if (est.status !== 'Accepted') throw new FinanceError('VALIDATION', 'only an accepted estimate converts', 400);
  if (est.converted_invoice_id) throw new FinanceError('VALIDATION', 'estimate already converted', 400);
  const { data: lines } = await supabaseAdmin()
    .from('acct_estimate_lines')
    .select('*')
    .eq('estimate_id', estimateId)
    .order('line_number');
  const { data: customer } = await supabaseAdmin()
    .from('acct_customers')
    .select('default_revenue_account_id, payment_terms_days')
    .eq('tenant_id', TENANT)
    .eq('id', est.customer_id)
    .single();
  // Invoice lines require revenue_account_id (NOT NULL) — fail before any
  // write if the customer has no default revenue account.
  if ((lines ?? []).length > 0 && !customer?.default_revenue_account_id) {
    throw new FinanceError('VALIDATION', 'customer has no default revenue account', 400);
  }
  const today = new Date().toISOString().slice(0, 10);
  const terms = Number(customer?.payment_terms_days ?? 30);
  const due = new Date(Date.now() + terms * 86400000).toISOString().slice(0, 10);
  const invoiceNo = await nextNumber('INV', 'acct_ar_invoices');
  const { data: invoice, error: invError } = await supabaseAdmin()
    .from('acct_ar_invoices')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      customer_id: est.customer_id,
      invoice_number: invoiceNo,
      invoice_date: today,
      due_date: due,
      currency: est.currency ?? 'USD',
      subtotal: est.subtotal,
      tax_total: est.tax_total,
      discount_total: est.discount_total,
      total: est.total,
      amount_paid: 0,
      amount_credited: 0,
      status: 'Sent',
      terms: est.terms ?? null,
      notes: est.notes ?? null,
    })
    .select()
    .single();
  if (invError || !invoice) throw new FinanceError('INTERNAL', `invoice: ${invError?.message}`, 500);
  if ((lines ?? []).length > 0) {
    const { error: lineError } = await supabaseAdmin()
      .from('acct_ar_invoice_lines')
      .insert(
        (lines ?? []).map((l: any, i: number) => ({
          tenant_id: TENANT,
          invoice_id: invoice.id,
          line_no: i + 1,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_amount: l.discount_amount,
          line_subtotal: l.line_total,
          tax_amount: l.tax_amount,
          revenue_account_id: customer?.default_revenue_account_id ?? null,
        })),
      );
    if (lineError) throw new FinanceError('INTERNAL', `invoice lines (invoice ${invoice.id}): ${lineError.message}`, 500);
  }
  const { error: estError } = await supabaseAdmin()
    .from('acct_estimates')
    .update({ status: 'Converted', converted_invoice_id: invoice.id })
    .eq('id', estimateId);
  if (estError) throw new FinanceError('INTERNAL', `estimate update (invoice ${invoice.id}): ${estError.message}`, 500);
  return { invoice, convertedInvoiceNo: invoiceNo, estimateId };
}

export async function postCommercePayment(commercePaymentId: string, depositAccountId?: string): Promise<any> {
  const { data: pay, error } = await supabaseAdmin()
    .from('commerce_payments')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', commercePaymentId)
    .single();
  if (error || !pay) throw new FinanceError('NOT_FOUND', `commerce payment ${commercePaymentId} not found`, 404);
  if (pay.acct_receipt_id) {
    const { data: existing } = await supabaseAdmin()
      .from('acct_ar_receipts')
      .select('*')
      .eq('id', pay.acct_receipt_id)
      .single();
    return { receipt: existing ?? null, replayed: true };
  }
  const { data: method } = await supabaseAdmin()
    .from('commerce_payment_methods')
    .select('name, gl_account_id')
    .eq('id', pay.payment_method_id)
    .single();
  const deposit = depositAccountId ?? (method?.gl_account_id as string | undefined);
  if (!deposit) throw new FinanceError('VALIDATION', 'no deposit account (pass depositAccountId or set the method gl_account_id)', 400);
  const { data: customer } = await supabaseAdmin()
    .from('acct_customers')
    .select('ar_account_id')
    .eq('tenant_id', TENANT)
    .eq('id', pay.customer_id)
    .single();
  const arAccount = customer?.ar_account_id as string | undefined;
  if (!arAccount) throw new FinanceError('VALIDATION', 'customer has no AR account', 400);
  const receiptDate = String(pay.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const journal = await createJournal({
    entryDate: receiptDate,
    source: 'commerce_payment',
    sourceId: commercePaymentId,
    memo: `Commerce payment ${pay.payment_number}`,
    reference: pay.payment_number,
    lines: [
      { accountId: deposit, debit: round2(pay.amount), description: `Commerce payment ${pay.payment_number}`, customerId: pay.customer_id },
      { accountId: arAccount, credit: round2(pay.amount), description: `Commerce payment ${pay.payment_number}`, customerId: pay.customer_id },
    ],
  });
  const receiptNo = await nextNumber('RCPT', 'acct_ar_receipts');
  const { data: receipt, error: rcptError } = await supabaseAdmin()
    .from('acct_ar_receipts')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      customer_id: pay.customer_id,
      receipt_number: receiptNo,
      receipt_date: receiptDate,
      currency: pay.currency ?? 'USD',
      amount: round2(pay.amount),
      payment_method: method?.name ?? 'commerce',
      status: 'Paid',
      deposit_account_id: deposit,
      reference: pay.payment_number,
      processor_transaction_id: pay.processor_transaction_id ?? null,
      posted_journal_id: journal.id,
    })
    .select()
    .single();
  if (rcptError || !receipt) throw new FinanceError('INTERNAL', `receipt (journal ${journal.id} posted): ${rcptError?.message}`, 500);
  await supabaseAdmin()
    .from('commerce_payments')
    .update({ acct_receipt_id: receipt.id })
    .eq('id', commercePaymentId);
  return { receipt, journalEntryId: journal.id, replayed: false };
}

export async function postCommerceRefund(commerceRefundId: string, cashAccountId: string): Promise<any> {
  if (!cashAccountId) throw new FinanceError('VALIDATION', 'cashAccountId is required', 400);
  const { data: ref, error } = await supabaseAdmin()
    .from('commerce_refunds')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', commerceRefundId)
    .single();
  if (error || !ref) throw new FinanceError('NOT_FOUND', `commerce refund ${commerceRefundId} not found`, 404);
  if (ref.acct_credit_memo_id) {
    const { data: existing } = await supabaseAdmin()
      .from('acct_ar_credit_memos')
      .select('*')
      .eq('id', ref.acct_credit_memo_id)
      .single();
    return { creditMemo: existing ?? null, replayed: true };
  }
  const { data: pay } = await supabaseAdmin()
    .from('commerce_payments')
    .select('customer_id')
    .eq('id', ref.payment_id)
    .single();
  const customerId = pay?.customer_id as string | undefined;
  if (!customerId) throw new FinanceError('VALIDATION', 'refund has no customer (via its payment)', 400);
  const { data: customer } = await supabaseAdmin()
    .from('acct_customers')
    .select('default_revenue_account_id')
    .eq('tenant_id', TENANT)
    .eq('id', customerId)
    .single();
  const revenueAccount = customer?.default_revenue_account_id as string | undefined;
  if (!revenueAccount) throw new FinanceError('VALIDATION', 'customer has no default revenue account', 400);
  const refundDate = String(ref.processed_at ?? ref.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const amount = round2(ref.amount);
  const journal = await createJournal({
    entryDate: refundDate,
    source: 'commerce_refund',
    sourceId: commerceRefundId,
    memo: `Refund ${ref.refund_number}`,
    reference: ref.refund_number,
    lines: [
      { accountId: revenueAccount, debit: amount, description: `Refund ${ref.refund_number}`, customerId },
      { accountId: cashAccountId, credit: amount, description: `Refund ${ref.refund_number}`, customerId },
    ],
  });
  const memoNo = await nextNumber('CM', 'acct_ar_credit_memos');
  const { data: memo, error: memoError } = await supabaseAdmin()
    .from('acct_ar_credit_memos')
    .insert({
      tenant_id: TENANT,
      customer_id: customerId,
      memo_number: memoNo,
      memo_date: refundDate,
      currency: 'USD',
      subtotal: amount,
      tax_total: 0,
      total: amount,
      status: 'Posted',
      applied_amount: 0,
      reason: ref.reason ?? null,
      posted_journal_id: journal.id,
    })
    .select()
    .single();
  if (memoError || !memo) throw new FinanceError('INTERNAL', `credit memo (journal ${journal.id} posted): ${memoError?.message}`, 500);
  const refundNo = await nextNumber('REF', 'acct_refunds');
  const { error: refundError } = await supabaseAdmin()
    .from('acct_refunds')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      refund_number: refundNo,
      customer_id: customerId,
      refund_type: 'commerce',
      reason: ref.reason ?? null,
      amount,
      currency: 'USD',
      status: 'Posted',
      processor_refund_id: ref.processor_reference ?? null,
      posted_journal_id: journal.id,
    })
    .select()
    .single();
  if (refundError) throw new FinanceError('INTERNAL', `acct_refunds (memo ${memo.id}): ${refundError.message}`, 500);
  await supabaseAdmin()
    .from('commerce_refunds')
    .update({ acct_credit_memo_id: memo.id })
    .eq('id', commerceRefundId);
  return { creditMemo: memo, journalEntryId: journal.id, replayed: false };
}

export async function postCommerceSubscription(commerceSubscriptionId: string): Promise<any> {
  const { data: sub, error } = await supabaseAdmin()
    .from('commerce_subscriptions')
    .select('*')
    .eq('tenant_id', TENANT)
    .eq('id', commerceSubscriptionId)
    .single();
  if (error || !sub) throw new FinanceError('NOT_FOUND', `commerce subscription ${commerceSubscriptionId} not found`, 404);
  if (sub.acct_contract_id) {
    const { data: existing } = await supabaseAdmin()
      .from('acct_revenue_contracts')
      .select('*')
      .eq('id', sub.acct_contract_id)
      .single();
    return { contract: existing ?? null, replayed: true };
  }
  const { data: customer } = await supabaseAdmin()
    .from('acct_customers')
    .select('default_revenue_account_id')
    .eq('tenant_id', TENANT)
    .eq('id', sub.customer_id)
    .single();
  const revenueAccount = customer?.default_revenue_account_id as string | undefined;
  if (!revenueAccount) throw new FinanceError('VALIDATION', 'customer has no default revenue account', 400);
  // Deferred revenue account (COA 2300, SaaS Subscriptions) — the obligation's
  // deferred_revenue_account_id is NOT NULL.
  const { data: deferred } = await supabaseAdmin()
    .from('acct_chart_of_accounts')
    .select('id')
    .eq('tenant_id', TENANT)
    .eq('code', '2300')
    .limit(1)
    .maybeSingle();
  const deferredAccount = deferred?.id as string | undefined;
  if (!deferredAccount) throw new FinanceError('VALIDATION', 'no deferred revenue account (COA 2300)', 400);
  const startDate = String(sub.start_date ?? sub.current_period_start ?? '').slice(0, 10);
  const endDate = String(sub.end_date ?? sub.current_period_end ?? '').slice(0, 10);
  const contractNo = await nextNumber('CON', 'acct_revenue_contracts');
  const { data: contract, error: conError } = await supabaseAdmin()
    .from('acct_revenue_contracts')
    .insert({
      tenant_id: TENANT,
      entity_id: ENTITY_ID,
      customer_id: sub.customer_id,
      contract_number: contractNo,
      contract_date: startDate || new Date().toISOString().slice(0, 10),
      start_date: startDate || null,
      end_date: endDate || null,
      currency: sub.currency ?? 'USD',
      total_transaction_price: round2(sub.price),
      status: String(sub.status ?? 'active'),
    })
    .select()
    .single();
  if (conError || !contract) throw new FinanceError('INTERNAL', `revenue contract: ${conError?.message}`, 500);
  const { error: obError } = await supabaseAdmin()
    .from('acct_revenue_performance_obligations')
    .insert({
      contract_id: contract.id,
      obligation_code: 'SUB',
      description: `Subscription ${sub.subscription_number}`,
      standalone_price: round2(sub.price),
      allocated_price: round2(sub.price),
      recognition_method: 'ratable',
      recognition_start: startDate || null,
      recognition_end: endDate || null,
      deferred_revenue_account_id: deferredAccount,
      revenue_account_id: revenueAccount,
    });
  if (obError) throw new FinanceError('INTERNAL', `performance obligation (contract ${contract.id}): ${obError.message}`, 500);
  await supabaseAdmin()
    .from('commerce_subscriptions')
    .update({ acct_contract_id: contract.id })
    .eq('id', commerceSubscriptionId);
  return { contract, journalEntryId: null, replayed: false };
}
