import { NextRequest } from 'next/server';
import { toErrorResponse, postCommercePayment, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/postings/payment — commerce payment → receipt + journal. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, body, () =>
      postCommercePayment(String(body.commercePaymentId ?? ''), body.depositAccountId ? String(body.depositAccountId) : undefined),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
