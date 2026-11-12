import { NextRequest } from 'next/server';
import { toErrorResponse, convertEstimate, withIdempotency } from '@/lib/financeServer';

/** POST /api/v1/finance/estimates/:id/convert — accepted estimate → invoice. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const key = req.headers.get('Idempotency-Key');
    const { result } = await withIdempotency(key, { id }, () => convertEstimate(id));
    return Response.json(result, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
