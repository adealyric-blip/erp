import { NextRequest } from 'next/server';
import { FinanceError, toErrorResponse, payBill, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/bills/:id/pay — pay a bill (payment + application + journal). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, { id, ...body }, () =>
      payBill(id, {
        amount: Number(body.amount),
        paymentMethod: String(body.paymentMethod ?? 'ach'),
        cashAccountId: String(body.cashAccountId ?? ''),
        paymentDate: String(body.paymentDate ?? new Date().toISOString().slice(0, 10)),
      }),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
