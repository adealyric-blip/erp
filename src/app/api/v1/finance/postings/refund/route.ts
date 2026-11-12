import { NextRequest } from 'next/server';
import { toErrorResponse, postCommerceRefund, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/postings/refund — commerce refund → credit memo + refund record + journal. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, body, () =>
      postCommerceRefund(String(body.commerceRefundId ?? ''), String(body.cashAccountId ?? '')),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
