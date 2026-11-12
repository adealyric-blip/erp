import { NextRequest } from 'next/server';
import { toErrorResponse, postCommerceSubscription, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/postings/subscription — commerce subscription → revenue contract + obligation. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, body, () =>
      postCommerceSubscription(String(body.commerceSubscriptionId ?? '')),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
