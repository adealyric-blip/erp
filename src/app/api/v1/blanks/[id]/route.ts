import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  apiError,
  cheapestCosts,
  familyForTopCategory,
  hexForColorName,
  KEEPER_SUPPLIER_SLUGS,
  keeperSupplierIds,
  loadCategories,
  minVariantSnapshots,
  normalizeName,
  printerDelivery,
  templateGeometry,
  templatesForCategory,
  topNameOf,
} from '@/lib/podServer';
import {
  isPrintfulCatalogProduct,
  printfulCatalogProduct,
  type PrintfulCatalogProduct,
} from '@/lib/printful';

/**
 * GET /api/v1/blanks/:id — one blank, fully.
 * Product row + real variant colors/sizes from supplier_catalog_variants +
 * real print-area px from the variants' print_specs placeholders + the
 * archetype skeleton views from product_canvas_templates + the cheapest
 * in-stock cost. Color hex comes from a name map; unknown names return null.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data: product, error } = await supabaseAdmin()
      .from('supplier_catalog_products')
      .select(
        'id,name,brand_name,supplier_id,category_id,canonical_product_id,variant_count,image_url,external_id,external_id_type',
      )
      .eq('id', id)
      .single();
    if (error || !product) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `No blank ${id}.`, requestId: crypto.randomUUID() } },
        { status: 404 },
      );
    }

    const nodes = await loadCategories();
    const topName = topNameOf(nodes, product.category_id as string);
    const family = familyForTopCategory(topName);
    const canonical = product.canonical_product_id as string | null;

    const supplier = await supabaseAdmin()
      .from('suppliers')
      .select('name,slug')
      .eq('id', product.supplier_id as string)
      .single();
    // Drops are excluded from the designer (keeper rule) — not offered here.
    if (!supplier.data || !KEEPER_SUPPLIER_SLUGS.includes(supplier.data.slug as string)) {
      return NextResponse.json(
        { error: { code: 'SUPPLIER_EXCLUDED', message: 'This product’s supplier is not enabled for the designer.', requestId: crypto.randomUUID() } },
        { status: 404 },
      );
    }

    const [{ data: variants }, costs, snapshots, templates] = await Promise.all([
      supabaseAdmin()
        .from('supplier_catalog_variants')
        .select('size,color,print_specs,price_snapshot')
        .eq('supplier_catalog_product_id', id)
        .limit(1000),
      canonical ? cheapestCosts([canonical]) : Promise.resolve(new Map()),
      canonical ? minVariantSnapshots([canonical]) : Promise.resolve(new Map()),
      templatesForCategory(topName),
    ]);

    const colors = new Map<string, { name: string; hex: string | null }>();
    const sizes = new Set<string>();
    const areaByPlacement = new Map<string, { placement: string; widthPx: number; heightPx: number; dpi: number }>();
    // Per-placement decoration method (DTG/DTF/embroidery/dye-sublimation) —
    // Printify stores this in print_specs.placeholders[].decoration_method.
    // Printful doesn't carry it in our DB mirror (print_specs is empty),
    // so the Printful enrichment below fills it from the catalog API.
    const techniquesFromSpecs = new Map<string, string>();
    // The print provider's own title (e.g. "Fulfill Engine") when present.
    let providerTitle: string | null = null;
    for (const v of variants ?? []) {
      if (v.color) {
        const name = String(v.color);
        if (!colors.has(name)) colors.set(name, { name, hex: hexForColorName(name) });
      }
      if (v.size) sizes.add(String(v.size));
      const specs = (v.print_specs as any) ?? {};
      if (specs.provider_title && !providerTitle) providerTitle = String(specs.provider_title);
      const placeholders = specs.placeholders;
      if (Array.isArray(placeholders)) {
        for (const p of placeholders) {
          const placement = String(p.position ?? 'front');
          if (!areaByPlacement.has(placement)) {
            areaByPlacement.set(placement, {
              placement,
              widthPx: Number(p.width ?? 0),
              heightPx: Number(p.height ?? 0),
              dpi: 300,
            });
          }
          const dm = p.decoration_method ? String(p.decoration_method) : null;
          if (dm && !techniquesFromSpecs.has(dm)) {
            techniquesFromSpecs.set(dm, dm.toUpperCase());
          }
        }
      }
    }

    const views = templates.map((t) => {
      const geo = templateGeometry(t);
      return {
        view: String(t.view_angle),
        label: String(t.view_angle),
        baseUrl: t.mockup_image_url as string,
        shadingUrl: null,
        maskUrl: (t.displacement_map_url as string | null) ?? null,
        boxPx: geo.boxPx,
        boxIn: geo.boxIn,
        // Archetype template — real geometry, not verified per product.
        pxPerInch: geo.pxPerInch,
        // The canvas the boxPx live on — clients scale to the loaded image.
        canvasPx: geo.canvasPx,
        verified: false,
      };
    });

    const costRow = canonical ? costs.get(canonical) : undefined;
    const snapshot = canonical ? snapshots.get(canonical) : undefined;

    // ── Printful catalog enrichment ──
    // Our DB mirror of Printful's catalog carries empty print_specs (no
    // blueprint data was synced). The Printful catalog API fills the gaps:
    // techniques (DTG/Embroidery/DTF — the "Technique" toggle on Printful's
    // product page), the full description with features, colors with real
    // hex codes (not name→hex guesses), and per-placement print geometry.
    // A failed fetch is non-fatal — the page renders with DB-only data.
    let techniques: { key: string; label: string; isDefault: boolean }[] = [];
    let description = '';
    let printfulEnriched = false;
    if (
      isPrintfulCatalogProduct(product.external_id_type as string | null) &&
      product.external_id
    ) {
      try {
        const pf: PrintfulCatalogProduct = await printfulCatalogProduct(
          product.external_id as string,
        );
        techniques = (pf.techniques ?? []).map((t) => ({
          key: t.key,
          label: t.display_name,
          isDefault: Boolean(t.is_default),
        }));
        description = String(pf.description ?? '');
        // Replace guessed hex with Printful's real hex codes (name → value).
        const pfHexByName = new Map(
          (pf.colors ?? []).map((c) => [c.name.toLowerCase(), c.value]),
        );
        for (const [name, entry] of colors) {
          const realHex = pfHexByName.get(name.toLowerCase());
          if (realHex) entry.hex = realHex;
        }
        // Printful sizes arrive as e.g. ["S","M","L",…] — merge any we lack.
        for (const s of pf.sizes ?? []) sizes.add(String(s));
        printfulEnriched = true;
      } catch {
        // Catalog API unreachable or key missing — fall through to DB-only.
        printfulEnriched = false;
      }
    }
    // Printify products carry decoration_method per placeholder in print_specs
    // — surface those as techniques when no Printful enrichment applied.
    if (techniques.length === 0 && techniquesFromSpecs.size > 0) {
      techniques = [...techniquesFromSpecs.entries()].map(([key, label], i) => ({
        key,
        label,
        isDefault: i === 0,
      }));
    }

    // Every keeper printer carrying this same/similar product type:
    // same normalized name inside the same top category, one row per
    // supplier, each with its own base cost + live production time.
    let printers: {
      name: string;
      slug: string;
      baseCost: number | null;
      estimatedDelivery: { average: number; unit: string } | null;
    }[] = [];
    let deliveryEstimate = '';
    try {
      const keeperIds = await keeperSupplierIds();
      // Same/similar product type across keepers. The product TYPE is what
      // the navigation categories architect, so the signals are: exact
      // product name (3) > same category name (2). A Printful "Full Zip
      // Hoodie" is the same type as a Printify zip hoodie even though the
      // style names never match word-for-word.
      const selfCatName = normalizeName(
        nodes.find((n) => n.id === (product.category_id as string))?.name ?? '',
      );
      // PostgREST caps at 1000 rows/request — page through the same-type
      // set instead of one big fetch (the old fetch silently saw only the
      // first 1000 keeper rows, which is why printers came back empty).
      type SiblingRow = {
        id: string;
        name: string;
        supplier_id: string;
        canonical_product_id: string | null;
        category_id: string;
      };
      const fetchPages = async (
        build: (from: number, to: number) => PromiseLike<{ data: SiblingRow[] | null; error: unknown }>,
      ): Promise<SiblingRow[]> => {
        const out: SiblingRow[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await build(from, from + 999);
          if (error) throw new Error('siblings query failed.');
          out.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return out;
      };
      const sameCatIds = nodes
        .filter(
          (n) =>
            normalizeName(n.name) === selfCatName &&
            selfCatName !== '' &&
            topNameOf(nodes, n.id) === topName,
        )
        .map((n) => n.id);
      const [exactRows, sameCatRows] = await Promise.all([
        supabaseAdmin()
          .from('supplier_catalog_products')
          .select('id,name,supplier_id,canonical_product_id,category_id')
          .eq('name', product.name as string)
          .in('supplier_id', keeperIds)
          .then((r) => (r.data ?? []) as unknown as SiblingRow[]),
        sameCatIds.length > 0
          ? fetchPages((from, to) =>
              supabaseAdmin()
                .from('supplier_catalog_products')
                .select('id,name,supplier_id,canonical_product_id,category_id')
                .in('category_id', sameCatIds)
                .in('supplier_id', keeperIds)
                .range(from, to)
                .then((r) => ({
                  data: (r.data ?? []) as unknown as SiblingRow[],
                  error: r.error,
                })),
            )
          : Promise.resolve([] as SiblingRow[]),
      ]);
      const selfNorm = normalizeName(product.name as string);
      const scored: { row: SiblingRow; score: number }[] = [];
      for (const s of exactRows) {
        if (s.id !== id) scored.push({ row: s, score: 3 });
      }
      for (const s of sameCatRows) {
        if (s.id === id) continue;
        if (normalizeName(s.name) === selfNorm) continue; // already scored
        scored.push({ row: s, score: 2 });
      }
      scored.sort((a, b) => b.score - a.score);
      const bySupplier = new Map<string, SiblingRow>();
      for (const { row } of scored) {
        if (!bySupplier.has(row.supplier_id)) bySupplier.set(row.supplier_id, row);
      }
      const matches = [...bySupplier.values()].slice(0, 5);
      const matchCanonicals = matches
        .map((m) => m.canonical_product_id)
        .filter((c): c is string => Boolean(c));
      const [matchCosts, matchSnaps] = await Promise.all([
        cheapestCosts(matchCanonicals),
        minVariantSnapshots(matchCanonicals),
      ]);
      const { data: supData } = await supabaseAdmin()
        .from('suppliers')
        .select('id,name,slug')
        .in('id', matches.map((m) => m.supplier_id));
      const supRows = new Map<string, { id: string; name: string; slug: string }>(
        ((supData ?? []) as { id: string; name: string; slug: string }[]).map((s) => [s.id, s]),
      );
      printers = await Promise.all(
        matches.map(async (m) => {
          const sup = supRows.get(m.supplier_id);
          const c = m.canonical_product_id;
          const { estimatedDelivery } = await printerDelivery(m.id);
          // This blank's own printer shows THIS product's base cost, not
          // the matched sibling's — the price on the card is for this blank.
          const isSelf = (sup?.slug ?? '') === (supplier.data?.slug ?? '');
          return {
            name: sup?.name ?? 'Unknown supplier',
            slug: sup?.slug ?? 'unknown',
            baseCost: isSelf
              ? (costRow?.cost ?? snapshot ?? null)
              : c
                ? (matchCosts.get(c)?.cost ?? matchSnaps.get(c) ?? null)
                : null,
            estimatedDelivery,
          };
        }),
      );
      // The blank's own printer is always on the card, even when no
      // same-type sibling exists for it.
      if (!printers.some((p) => p.slug === (supplier.data?.slug ?? ''))) {
        const { estimatedDelivery } = await printerDelivery(id);
        printers.unshift({
          name: supplier.data?.name ?? 'Unknown supplier',
          slug: supplier.data?.slug ?? 'unknown',
          baseCost: costRow?.cost ?? snapshot ?? null,
          estimatedDelivery,
        });
      }
      const { estimatedDelivery: selfDelivery } = await printerDelivery(id);
      if (selfDelivery) {
        deliveryEstimate = `≈${selfDelivery.average} ${selfDelivery.unit.replace(/_/g, ' ')}`;
      }
    } catch {
      // Printers list is additive — a failed lookup never blocks the detail.
      printers = [];
    }

    // Render state of the canonical blank — drives blockers and the
    // publish gate. Missing rows read as missing_assets (the column default).
    let renderState = 'missing_assets';
    if (canonical) {
      const { data: canon } = await supabaseAdmin()
        .from('canonical_products')
        .select('render_state')
        .eq('id', canonical)
        .maybeSingle();
      if (canon?.render_state) renderState = canon.render_state as string;
    }

    return NextResponse.json({
      id: product.id,
      canonicalProductId: canonical,
      name: product.name,
      brand: product.brand_name ?? 'Generic brand',
      supplier: supplier.data?.name ?? 'Unknown supplier',
      supplierSlug: supplier.data?.slug ?? 'unknown',
      baseCost: costRow?.cost ?? snapshot ?? null,
      currency: 'USD',
      family,
      mockupThumbUrl: product.image_url,
      printAreas: [...areaByPlacement.values()],
      status: templates.length > 0 ? 'unverified' : 'skeleton_pending',
      fulfillment: 'POD',
      renderState,
      views,
      variants: {
        colors: [...colors.values()],
        sizes: [...sizes].sort(),
        printAreas: [...areaByPlacement.keys()],
      },
      // Supplier catalog enrichment — the data the DB mirror doesn't carry
      // but the supplier's own product page shows. Printful fills these via
      // GET /v2/catalog-products/{id}; Printify surfaces them from
      // print_specs.placeholders[].decoration_method.
      techniques,
      description,
      providerTitle,
      shippingCost: costRow?.shipping ?? null,
      printfulEnriched,
      guidelines: '',
      shippingFrom: costRow?.supplier ?? '',
      deliveryEstimate,
      printers,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load blank.');
  }
}
