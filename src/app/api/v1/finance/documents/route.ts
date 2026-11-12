import { NextRequest } from 'next/server';
import {
  supabaseAdmin, TENANT, ENTITY_ID, FinanceError, toErrorResponse, pageParams, round2,
  listDocuments, getDocument, taxRateMap, createJournal, nextNumber, withIdempotency,
  billToDoc, invoiceToDoc, estimateToDoc, poToDoc, receiptToDoc, creditMemoToDoc,
  expenseToDoc, paymentToDoc, rmaToDoc,
} from '@/lib/financeServer';

/** GET /api/v1/finance/documents?type=&status=&partyId= — merged Document list. */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { limit, offset } = pageParams(url);
    const result = await listDocuments({
      type: url.searchParams.get('type') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      partyId: url.searchParams.get('partyId') ?? undefined,
      limit,
      offset,
    });
    return Response.json({ ...result, limit, offset });
  } catch (e) {
    return toErrorResponse(e);
  }
}

interface LineInput {
  description?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  unitCost?: number;
  unitPrice?: number;
  amount?: number;
  lineSubtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  taxCodeId?: string | null;
  account?: string | null;
  expenseAccountId?: string | null;
  revenueAccountId?: string | null;
  itemId?: string | null;
  itemRef?: string | null;
  serviceId?: string | null;
}

function lineTotals(lines: LineInput[]): { subtotal: number; tax: number; total: number } {
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const tax = round2(lines.reduce((s, l) => s + (l.taxAmount ?? 0), 0));
  return { subtotal, tax, total: round2(subtotal + tax) };
}

/** A line's amount: explicit subtotal, else qty × rate (same formula as lineTotals). */
function lineAmount(l: LineInput): number {
  return round2(l.lineSubtotal ?? l.amount ?? round2((l.qty ?? l.quantity ?? 0) * (l.rate ?? l.unitCost ?? l.unitPrice ?? 0)));
}

/**
 * POST /api/v1/finance/documents — create a document of any supported type.
 * VendorCredit and SalesOrder are 422 UNSUPPORTED (no table / checkout-owned).
 * Idempotent via Idempotency-Key.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, body, () => createDocument(body));
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}

async function createDocument(body: any): Promise<any> {
  const type = String(body.type ?? '');
  const lines: LineInput[] = Array.isArray(body.lines) ? body.lines : [];
  const totals = lines.length > 0
    ? lineTotals(lines)
    : { subtotal: round2(body.subtotal ?? 0), tax: round2(body.tax ?? 0), total: round2(body.total ?? 0) };
  const tax = await taxRateMap();
  const date = String(body.date ?? new Date().toISOString().slice(0, 10));
  const dueDate = String(body.dueDate ?? date);
  const partyId = String(body.partyId ?? '');

  switch (type) {
    case 'Bill': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (vendor) is required', 400);
      const billNo = await nextNumber('BILL', 'acct_ap_bills');
      const { data: bill, error } = await supabaseAdmin().from('acct_ap_bills').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, vendor_id: partyId, bill_number: billNo, bill_date: date, due_date: dueDate,
        currency: body.currency ?? 'USD', subtotal: totals.subtotal, tax_total: totals.tax,
        discount_total: round2(body.discountTotal ?? 0), total: totals.total,
        amount_paid: 0, amount_credited: 0, status: body.status ?? 'Draft',
      }).select().single();
      if (error || !bill) throw new FinanceError('INTERNAL', `acct_ap_bills: ${error?.message}`, 500);
      if (lines.length > 0) {
        lines.forEach((l, i) => {
          if (!(l.expenseAccountId ?? l.account)) throw new FinanceError('VALIDATION', `bill line ${i + 1} needs an expense account`, 400);
        });
        const { error: le } = await supabaseAdmin().from('acct_ap_bill_lines').insert(
          lines.map((l, i) => ({
            tenant_id: TENANT, bill_id: bill.id, line_no: i + 1,
            description: l.description ?? '', quantity: l.qty ?? l.quantity ?? 0,
            unit_cost: l.rate ?? l.unitCost ?? 0,
            line_subtotal: lineAmount(l),
            tax_code_id: l.taxCodeId ?? null, tax_amount: l.taxAmount ?? 0,
            expense_account_id: l.expenseAccountId ?? l.account ?? null,
            item_ref: l.itemRef ?? l.itemId ?? null,
            dimensions: {},
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `bill lines (bill ${bill.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('acct_ap_bill_lines').select('*').eq('bill_id', bill.id).order('line_no');
      return billToDoc(bill, savedLines ?? [], tax);
    }
    case 'Invoice': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (customer) is required', 400);
      const invNo = await nextNumber('INV', 'acct_ar_invoices');
      const { data: inv, error } = await supabaseAdmin().from('acct_ar_invoices').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, customer_id: partyId, invoice_number: invNo, invoice_date: date, due_date: dueDate,
        currency: body.currency ?? 'USD', subtotal: totals.subtotal, tax_total: totals.tax,
        discount_total: round2(body.discountTotal ?? 0), total: totals.total,
        amount_paid: 0, amount_credited: 0, status: body.status ?? 'Draft',
      }).select().single();
      if (error || !inv) throw new FinanceError('INTERNAL', `acct_ar_invoices: ${error?.message}`, 500);
      if (lines.length > 0) {
        lines.forEach((l, i) => {
          if (!(l.revenueAccountId ?? l.account)) throw new FinanceError('VALIDATION', `invoice line ${i + 1} needs a revenue account`, 400);
        });
        const { error: le } = await supabaseAdmin().from('acct_ar_invoice_lines').insert(
          lines.map((l, i) => ({
            tenant_id: TENANT, invoice_id: inv.id, line_no: i + 1,
            description: l.description ?? '', quantity: l.qty ?? l.quantity ?? 0,
            unit_price: l.rate ?? l.unitPrice ?? 0,
            discount_amount: 0,
            line_subtotal: lineAmount(l),
            tax_code_id: l.taxCodeId ?? null, tax_amount: l.taxAmount ?? 0,
            revenue_account_id: l.revenueAccountId ?? l.account ?? null,
            item_ref: l.itemRef ?? l.itemId ?? null,
            dimensions: {},
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `invoice lines (invoice ${inv.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('acct_ar_invoice_lines').select('*').eq('invoice_id', inv.id).order('line_no');
      return invoiceToDoc(inv, savedLines ?? [], tax);
    }
    case 'Estimate': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (customer) is required', 400);
      const estNo = await nextNumber('EST', 'acct_estimates');
      const { data: est, error } = await supabaseAdmin().from('acct_estimates').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, customer_id: partyId, estimate_number: estNo, estimate_date: date, expiry_date: dueDate,
        currency: body.currency ?? 'USD', subtotal: totals.subtotal, tax_total: totals.tax,
        discount_total: round2(body.discountTotal ?? 0), total: totals.total,
        status: body.status ?? 'Draft', terms: body.notes ?? null, notes: body.memo ?? null,
      }).select().single();
      if (error || !est) throw new FinanceError('INTERNAL', `acct_estimates: ${error?.message}`, 500);
      if (lines.length > 0) {
        const { error: le } = await supabaseAdmin().from('acct_estimate_lines').insert(
          lines.map((l, i) => ({
            estimate_id: est.id, line_number: i + 1, service_id: l.serviceId ?? l.itemId ?? null,
            description: l.description ?? '', quantity: l.qty ?? l.quantity ?? 0,
            unit_price: l.rate ?? l.unitPrice ?? 0, discount_amount: 0,
            tax_amount: l.taxAmount ?? 0,
            line_total: lineAmount(l),
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `estimate lines (estimate ${est.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('acct_estimate_lines').select('*').eq('estimate_id', est.id).order('line_number');
      return estimateToDoc(est, savedLines ?? [], tax);
    }
    case 'PurchaseOrder': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (vendor) is required', 400);
      const poNo = await nextNumber('PO', 'acct_ap_purchase_orders');
      const { data: po, error } = await supabaseAdmin().from('acct_ap_purchase_orders').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, vendor_id: partyId, po_number: poNo, order_date: date, expected_date: dueDate,
        currency: body.currency ?? 'USD', subtotal: totals.subtotal, tax_total: totals.tax, total: totals.total,
        status: body.status ?? 'Draft',
      }).select().single();
      if (error || !po) throw new FinanceError('INTERNAL', `acct_ap_purchase_orders: ${error?.message}`, 500);
      if (lines.length > 0) {
        const { error: le } = await supabaseAdmin().from('acct_ap_purchase_order_lines').insert(
          lines.map((l, i) => ({
            purchase_order_id: po.id, line_no: i + 1, description: l.description ?? '',
            quantity: l.qty ?? l.quantity ?? 0, unit_cost: l.rate ?? l.unitCost ?? 0,
            expense_account_id: l.expenseAccountId ?? l.account ?? null,
            received_quantity: 0, billed_quantity: 0,
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `PO lines (PO ${po.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('acct_ap_purchase_order_lines').select('*').eq('purchase_order_id', po.id).order('line_no');
      return poToDoc(po, savedLines ?? []);
    }
    case 'SalesReceipt': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (customer) is required', 400);
      if (!body.depositAccountId) throw new FinanceError('VALIDATION', 'depositAccountId is required', 400);
      const rcptNo = await nextNumber('RCPT', 'acct_ar_receipts');
      const { data: rcpt, error } = await supabaseAdmin().from('acct_ar_receipts').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, customer_id: partyId, receipt_number: rcptNo, receipt_date: date,
        currency: body.currency ?? 'USD', amount: totals.total, payment_method: body.paymentMethod ?? 'cash',
        status: body.status ?? 'Paid', deposit_account_id: body.depositAccountId,
        reference: body.memo ?? null,
      }).select().single();
      if (error || !rcpt) throw new FinanceError('INTERNAL', `acct_ar_receipts: ${error?.message}`, 500);
      return receiptToDoc(rcpt);
    }
    case 'CreditMemo': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (customer) is required', 400);
      const memoNo = await nextNumber('CM', 'acct_ar_credit_memos');
      const { data: memo, error } = await supabaseAdmin().from('acct_ar_credit_memos').insert({
        tenant_id: TENANT, customer_id: partyId, memo_number: memoNo, memo_date: date,
        currency: body.currency ?? 'USD', subtotal: totals.subtotal, tax_total: totals.tax, total: totals.total,
        status: body.status ?? 'Draft', applied_amount: 0, reason: body.memo ?? null,
      }).select().single();
      if (error || !memo) throw new FinanceError('INTERNAL', `acct_ar_credit_memos: ${error?.message}`, 500);
      return creditMemoToDoc(memo);
    }
    case 'Expense': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (employee) is required', 400);
      const expNo = await nextNumber('EXP', 'acct_expense_reports');
      const { data: rep, error } = await supabaseAdmin().from('acct_expense_reports').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, employee_id: partyId, report_number: expNo, report_date: date,
        currency: body.currency ?? 'USD', total_amount: totals.total, status: body.status ?? 'Draft',
      }).select().single();
      if (error || !rep) throw new FinanceError('INTERNAL', `acct_expense_reports: ${error?.message}`, 500);
      if (lines.length > 0) {
        lines.forEach((l, i) => {
          if (!(l.expenseAccountId ?? l.account)) throw new FinanceError('VALIDATION', `expense line ${i + 1} needs an expense account`, 400);
        });
        const { error: le } = await supabaseAdmin().from('acct_expense_lines').insert(
          lines.map((l) => ({
            expense_report_id: rep.id, expense_date: date, merchant: l.description ?? '',
            description: l.description ?? '', amount: l.lineSubtotal ?? l.amount ?? 0,
            tax_amount: l.taxAmount ?? 0, expense_account_id: l.expenseAccountId ?? l.account ?? null,
            dimensions: {},
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `expense lines (report ${rep.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('acct_expense_lines').select('*').eq('expense_report_id', rep.id);
      return expenseToDoc(rep, savedLines ?? []);
    }
    case 'JournalEntry': {
      const journal = await createJournal({
        entryDate: date,
        source: 'manual',
        sourceId: String(body.sourceId ?? 'manual'),
        memo: body.memo ?? '',
        reference: body.reference ?? null,
        lines: (body.journalLines ?? lines).map((l: any) => ({
          accountId: l.accountId ?? l.account,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          description: l.description ?? '',
          customerId: l.customerId ?? null,
          vendorId: l.vendorId ?? null,
          employeeId: l.employeeId ?? null,
          taxCodeId: l.taxCodeId ?? null,
        })),
      });
      const doc = await getDocument(journal.id, 'JournalEntry');
      return doc ?? { id: journal.id, entryNo: journal.entry_no };
    }
    case 'Check': {
      if (!partyId) throw new FinanceError('VALIDATION', 'partyId (vendor) is required', 400);
      if (!body.cashAccountId) throw new FinanceError('VALIDATION', 'cashAccountId is required', 400);
      const payNo = await nextNumber('PAY', 'acct_ap_payments');
      const { data: pay, error } = await supabaseAdmin().from('acct_ap_payments').insert({
        tenant_id: TENANT, entity_id: ENTITY_ID, vendor_id: partyId, payment_number: payNo, payment_date: date,
        currency: body.currency ?? 'USD', amount: totals.total, payment_method: 'check',
        status: body.status ?? 'Paid', cash_account_id: body.cashAccountId, reference: body.memo ?? null,
      }).select().single();
      if (error || !pay) throw new FinanceError('INTERNAL', `acct_ap_payments: ${error?.message}`, 500);
      return paymentToDoc(pay);
    }
    case 'RMA': {
      if (!body.orderId) throw new FinanceError('VALIDATION', 'orderId is required for an RMA', 400);
      const rmaNo = await nextNumber('RMA', 'erp_return_authorizations');
      const { data: rma, error } = await supabaseAdmin().from('erp_return_authorizations').insert({
        tenant_id: TENANT, rma_number: rmaNo, order_id: body.orderId,
        crm_customer_id: partyId || null, status: body.status ?? 'Requested',
        reason_code: body.reasonCode ?? null, notes: body.memo ?? null,
        requested_at: new Date().toISOString(),
      }).select().single();
      if (error || !rma) throw new FinanceError('INTERNAL', `erp_return_authorizations: ${error?.message}`, 500);
      if (lines.length > 0) {
        lines.forEach((l, i) => {
          if (!(l.itemId ?? l.itemRef)) throw new FinanceError('VALIDATION', `RMA line ${i + 1} needs an itemId (order line / sku)`, 400);
        });
        const { error: le } = await supabaseAdmin().from('erp_return_lines').insert(
          lines.map((l) => ({
            tenant_id: TENANT, rma_id: rma.id, order_line_id: l.itemId ?? l.itemRef ?? null,
            sku_id: l.itemId ?? l.itemRef ?? null, quantity_requested: l.qty ?? l.quantity ?? 0,
            quantity_received: 0, quantity_approved: 0,
            refund_amount: l.lineSubtotal ?? l.amount ?? 0, disposition: 'pending',
          })),
        );
        if (le) throw new FinanceError('INTERNAL', `RMA lines (RMA ${rma.id}): ${le.message}`, 500);
      }
      const { data: savedLines } = await supabaseAdmin().from('erp_return_lines').select('*').eq('rma_id', rma.id);
      return rmaToDoc(rma, savedLines ?? []);
    }
    case 'VendorCredit':
      throw new FinanceError('UNSUPPORTED', 'VendorCredit has no table (see contracts §5)', 422);
    case 'SalesOrder':
      throw new FinanceError('UNSUPPORTED', 'SalesOrder is checkout-owned; orders are not created here', 422);
    default:
      throw new FinanceError('VALIDATION', `unknown document type ${type}`, 400);
  }
}
