import { NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import { apiError } from '@/lib/podServer';

/**
 * GET /api/v1/products — the tenant's published products (the global
 * Catalog rows created by POST /api/v1/designs/:id/publish).
 *
 * My Products (the studio's My Products table) is server-backed from
 * here — the store's in-memory `published` list alone loses every
 * product on reload. This endpoint is the source of truth on load.
 *
 * Query params:
 *   status=<published|draft|...> — filter by product status.
 *   limit — max products (default 100, cap 500).
 *
 * Price lives on product_variants (not on products), so each item
 * carries the variant price (lowest variant price — publish stores the
 * user's price on every variant) + variant count + the supplier slug.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 1), 500);

    let query = supabaseAdmin()
      .from('products')
      .select('id,name,slug,status,brand,supplier_id,source_product_id,published_at,created_at')
      .eq('tenant_id', DEFAULT_TENANT_ID)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(`products: ${error.message}`);

    type ProductRow = {
      id: string;
      name: string;
      slug: string | null;
      status: string;
      brand: string | null;
      supplier_id: string | null;
      source_product_id: string | null;
      published_at: string | null;
      created_at: string;
    };
    const rows = (data ?? []) as unknown as ProductRow[];

    // Variant price + count + colors/sizes (price lives on product_variants).
    const ids = rows.map((r) => r.id);
    const variantMap = new Map<
      string,
      { count: number; price: number | null; colors: string[]; sizes: string[] }
    >();
    if (ids.length > 0) {
      const { data: variants, error: vErr } = await supabaseAdmin()
        .from('product_variants')
        .select('product_id,price,color,size')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .in('product_id', ids);
      if (vErr) throw new Error(`product_variants: ${vErr.message}`);
      for (const v of (variants ?? []) as { product_id: string; price: number | string | null; color: string | null; size: string | null }[]) {
        const cur = variantMap.get(v.product_id) ?? { count: 0, price: null, colors: [], sizes: [] };
        cur.count += 1;
        const p = typeof v.price === 'number' ? v.price : Number(v.price);
        if (!Number.isNaN(p) && (cur.price === null || p < cur.price)) cur.price = p;
        if (v.color && !cur.colors.includes(v.color)) cur.colors.push(v.color);
        if (v.size && !cur.sizes.includes(v.size)) cur.sizes.push(v.size);
        variantMap.set(v.product_id, cur);
      }
    }

    // Supplier slug + name.
    const supplierIds = [...new Set(rows.map((r) => r.supplier_id).filter((x): x is string => Boolean(x)))];
    const supplierMap = new Map<string, { slug: string; name: string }>();
    if (supplierIds.length > 0) {
      const { data: sups, error: sErr } = await supabaseAdmin()
        .from('suppliers')
        .select('id,name,slug')
        .in('id', supplierIds);
      if (sErr) throw new Error(`suppliers: ${sErr.message}`);
      for (const s of (sups ?? []) as { id: string; name: string; slug: string }[]) {
        supplierMap.set(s.id, { slug: s.slug, name: s.name });
      }
    }

    const items = rows.map((r) => {
      const v = variantMap.get(r.id);
      const sup = r.supplier_id ? supplierMap.get(r.supplier_id) : undefined;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        brand: r.brand,
        supplier: sup?.slug ?? null,
        supplierName: sup?.name ?? null,
        price: v?.price ?? null,
        variantCount: v?.count ?? 0,
        colors: v?.colors ?? [],
        sizes: v?.sizes ?? [],
        sourceProductId: r.source_product_id,
        publishedAt: r.published_at,
        createdAt: r.created_at,
      };
    });
    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to list products.');
  }
}
