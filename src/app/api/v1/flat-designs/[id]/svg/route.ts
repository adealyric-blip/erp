import { NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import { apiError } from '@/lib/podServer';

/**
 * GET /api/v1/flat-designs/:id/svg — the raw vector_flat_svg for one flat
 * design, served as image/svg+xml so the canvas can load it directly.
 * A pattern-sheet SVG (Brian Tee, Dress Block) is the cutting layout, not
 * a flat technical — the canvas maps only per-piece pill flats as a design
 * surface; this endpoint serves the stored vector either way.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from('product_designs')
      .select('id,vector_flat_svg')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .eq('id', id)
      .single();
    const svg = (data as { vector_flat_svg?: unknown } | null)?.vector_flat_svg;
    if (error || typeof svg !== 'string' || svg.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `No flat SVG for ${id}.`, requestId: crypto.randomUUID() } },
        { status: 404 },
      );
    }
    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load flat SVG.');
  }
}
