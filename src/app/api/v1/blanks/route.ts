import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';
import {
  apiError,
  cheapestCosts,
  familyForTopCategory,
  keeperSupplierIds,
  loadCategories,
  minVariantSnapshots,
  resolveCategoryIds,
  templatePrintAreas,
  templatesForCategory,
  topNameOf,
} from '@/lib/podServer';

/**
 * GET /api/v1/blanks?category=&subcategory=&q=&limit=&cursor=
 * The product card list for one top-nav category. Real rows from
 * supplier_catalog_products (24,763), filtered by the category subtree,
 * with the cheapest in-stock cost attached and the skeleton status from
 * product_canvas_templates. `cursor` is an opaque offset.
 */
export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const category = params.get('category') ?? 'Men';
    const subcategory = params.get('subcategory') ?? undefined;
    const q = params.get('q')?.trim() || undefined;
    const sort = params.get('sort') ?? 'name';
    const limit = Math.min(Math.max(parseInt(params.get('limit') ?? '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(params.get('cursor') ?? '0', 10) || 0, 0);

    const nodes = await loadCategories();
    // category=All covers every department (the Best Selling wizard).
    const { ids, topName } =
      category === 'All'
        ? { ids: new Set(nodes.map((n) => n.id)), topName: null }
        : resolveCategoryIds(nodes, category, subcategory);
    if (ids.size === 0) {
      return NextResponse.json({
        items: [],
        nextCursor: null,
        meta: { category, subcategory: subcategory ?? null, total: 0 },
      });
    }
    const keeperIds = await keeperSupplierIds();

    // Best-selling: real order velocity — order_items quantity summed per
    // canonical product (via supplier_catalog_variant_id). Ties and the
    // zero-sales tail fall back to variant_count desc. Velocity is sparse
    // (few canonicals have any sales), so the map is tiny.
    let velocity = new Map<string, number>();
    if (sort === 'best_selling') {
      const { data: lines } = await supabaseAdmin()
        .from('order_items')
        .select('supplier_catalog_variant_id,quantity')
        .eq('tenant_id', DEFAULT_TENANT_ID)
        .not('supplier_catalog_variant_id', 'is', null)
        .limit(10000);
      const variantIds = [...new Set((lines ?? []).map((l) => l.supplier_catalog_variant_id as string))];
      if (variantIds.length > 0) {
        const { data: vars } = await supabaseAdmin()
          .from('supplier_catalog_variants')
          .select('id,canonical_product_id')
          .in('id', variantIds);
        const canonOf = new Map((vars ?? []).map((v) => [v.id as string, v.canonical_product_id as string]));
        for (const l of lines ?? []) {
          const c = canonOf.get(l.supplier_catalog_variant_id as string);
          if (c) velocity.set(c, (velocity.get(c) ?? 0) + (l.quantity as number ?? 0));
        }
      }
    }

    let query = supabaseAdmin()
      .from('supplier_catalog_products')
      .select(
        'id,name,brand_name,supplier_id,category_id,canonical_product_id,variant_count,image_url',
        { count: 'exact' },
      )
      .in('category_id', [...ids])
      .in('supplier_id', keeperIds);
    if (q) query = query.ilike('name', `%${q}%`);
    if (sort === 'best_selling') {
      // Order by variant_count desc in the DB (the tie-break), then apply
      // the velocity sort in memory over the fetched window.
      query = query.order('variant_count', { ascending: false }).range(0, 1999);
    } else {
      query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);
    }

    const { data: products, error, count } = await query;
    if (error) throw new Error(`supplier_catalog_products: ${error.message}`);

    let rows = products ?? [];
    if (sort === 'best_selling') {
      rows = [...rows].sort((a, b) => {
        const va = velocity.get(a.canonical_product_id as string) ?? 0;
        const vb = velocity.get(b.canonical_product_id as string) ?? 0;
        if (vb !== va) return vb - va;
        return (b.variant_count as number) - (a.variant_count as number);
      });
    }
    const page = sort === 'best_selling' ? rows.slice(offset, offset + limit) : rows;
    rows = page;
    const canonicalIds = [...new Set(rows.map((r) => r.canonical_product_id).filter(Boolean))];
    const [costs, snapshots, templates] = await Promise.all([
      cheapestCosts(canonicalIds),
      minVariantSnapshots(canonicalIds),
      templatesForCategory(topName),
    ]);

    const supplierIds = [...new Set(rows.map((r) => r.supplier_id).filter(Boolean))];
    const supplierMap = new Map<string, { name: string; slug: string }>();
    if (supplierIds.length > 0) {
      const { data: suppliers, error: supErr } = await supabaseAdmin()
        .from('suppliers')
        .select('id,name,slug')
        .in('id', supplierIds);
      if (supErr) throw new Error(`suppliers: ${supErr.message}`);
      for (const s of suppliers ?? []) supplierMap.set(s.id, { name: s.name, slug: s.slug });
    }

    const family = familyForTopCategory(topName);
    const printAreas = templatePrintAreas(templates);
    const status = templates.length > 0 ? 'unverified' : 'skeleton_pending';

    const items = rows.map((r) => {
      const canonical = r.canonical_product_id as string | null;
      const costRow = canonical ? costs.get(canonical) : undefined;
      const snapshot = canonical ? snapshots.get(canonical) : undefined;
      const supplier = supplierMap.get(r.supplier_id as string);
      return {
        id: r.id,
        canonicalProductId: canonical,
        name: r.name,
        brand: r.brand_name ?? 'Generic brand',
        supplier: supplier?.name ?? 'Unknown supplier',
        supplierSlug: supplier?.slug ?? 'unknown',
        baseCost: costRow?.cost ?? snapshot ?? null,
        currency: 'USD',
        family,
        mockupThumbUrl: r.image_url,
        printAreas,
        status,
        fulfillment: 'POD',
        ...(sort === 'best_selling'
          ? { unitsSold: velocity.get(canonical ?? '') ?? 0 }
          : {}),
      };
    });

    const total = count ?? 0;
    const nextCursor = offset + rows.length < total ? String(offset + rows.length) : null;
    return NextResponse.json({
      items,
      nextCursor,
      meta: {
        category,
        subcategory: subcategory ?? null,
        topCategory: topName,
        total,
        sort,
        velocityCanonicals: velocity.size,
        tenantId: DEFAULT_TENANT_ID,
      },
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load blanks.');
  }
}
