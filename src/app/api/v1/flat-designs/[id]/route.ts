import { NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import { apiError } from '@/lib/podServer';

/**
 * GET /api/v1/flat-designs/:id — one flat design's metadata
 * (product_designs row; the raw SVG lives at …/:id/svg).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from('product_designs')
      .select('id,name,category,source,license,dpi,placements,is_active')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('id', id)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `No flat design ${id}.`, requestId: crypto.randomUUID() } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      id: data.id as string,
      name: data.name as string,
      category: data.category as string | null,
      source: data.source as string | null,
      license: data.license as string | null,
      dpi: data.dpi as number | null,
      placements: (data.placements ?? []) as unknown,
      isActive: Boolean(data.is_active),
      svgUrl: `/api/v1/flat-designs/${data.id as string}/svg`,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load flat design.');
  }
}
