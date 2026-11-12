import { NextRequest } from 'next/server';
import { toErrorResponse, recordInvoicePayment, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/invoices/:id/record-payment — record a receipt (receipt + application + journal). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, { id, ...body }, () =>
      recordInvoicePayment(id, {
        amount: Number(body.amount),
        paymentMethod: String(body.paymentMethod ?? 'card'),
        depositAccountId: String(body.depositAccountId ?? ''),
        paymentDate: String(body.paymentDate ?? new Date().toISOString().slice(0, 10)),
        saleId: body.saleId ? String(body.saleId) : null,
      }),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
