import { NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import { apiError } from '@/lib/podServer';

/**
 * GET /api/v1/flat-designs — the flat tech-pack designs on file
 * (product_designs: FreeSewing / OpenTechPack vector flats).
 *
 * The canvas resolves its per-piece flat from public/flats/ (same-origin
 * SVGs); this endpoint is the reachable record of the DB flats — their
 * metadata and the raw vector_flat_svg behind each one. A model photo is
 * never a design surface; the flat is.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from('product_designs')
      .select('id,name,category,source,license,dpi,placements,is_active')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .order('name');
    if (error) throw new Error(`product_designs read: ${error.message}`);
    const designs = (data ?? []).map((d) => ({
      id: d.id as string,
      name: d.name as string,
      category: d.category as string | null,
      source: d.source as string | null,
      license: d.license as string | null,
      dpi: d.dpi as number | null,
      placements: (d.placements ?? []) as unknown,
      isActive: Boolean(d.is_active),
      svgUrl: `/api/v1/flat-designs/${d.id as string}/svg`,
    }));
    return NextResponse.json({ designs });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list flat designs.');
  }
}
