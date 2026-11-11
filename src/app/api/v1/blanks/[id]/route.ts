import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  apiError,
  cheapestCosts,
  cheapestProductionTimes,
  familyForTopCategory,
  hexForColorName,
  KEEPER_SUPPLIER_SLUGS,
  keeperSupplierIds,
  loadCategories,
  minVariantSnapshots,
  normalizeName,
  printerProviders,
  templateGeometry,
  templatesForCategory,
  topNameOf,
} from '@/lib/podServer';
import {
  isPrintfulCatalogProduct,
  printfulCatalogProduct,
  printfulCatalogPrices,
  printfulCatalogImages,
  type PrintfulCatalogProduct,
} from '@/lib/printful';
import { storageFetchUrl } from '@/lib/ingestTrigger';
import { blankDetailCacheGet, blankDetailCacheSet } from '@/lib/blankDetailCache';

/**
 * GET /api/v1/blanks/:id — one blank, fully.
 * Product row + real variant colors/sizes from supplier_catalog_variants +
 * real print-area px from the variants' print_specs placeholders + the
 * archetype skeleton views from product_canvas_templates + the cheapest
 * in-stock cost. Color hex comes from a name map; unknown names return null.
 *
 * The aggregate is ~20 Supabase roundtrips + supplier enrichments, so the
 * response is cached (5 min TTL). Writers that change the render contract
 * (ingest, view QA) bust the entry via blankDetailCacheBust.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cached = blankDetailCacheGet(id);
    if (cached) return NextResponse.json(cached);
    const { data: product, error } = await supabaseAdmin()
      .from('supplier_catalog_products')
      .select(
        'id,name,brand_name,supplier_id,category_id,canonical_product_id,variant_count,image_url,external_id,external_id_type,description,features,care_instructions,size_guide',
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

    // ── DB product data — FIRST source for the product page. The
    // supplier_catalog_products mirror already carries the supplier's
    // own description / features / care / size guide for Printify rows
    // (3,011/3,019). The supplier-API enrichment below is only a
    // fallback for rows the mirror doesn't cover (e.g. Printful).
    // Never invent these — absent stays absent.
    const stripHtml = (html: string): string =>
      String(html ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        // Printify bullet marker ".:Item" → "• Item".
        .replace(/(^|\s)\.:\s*/g, '$1• ')
        .replace(/\s+/g, ' ')
        .trim();
    const dbDescription = stripHtml(
      typeof product.description === 'string' ? product.description : '',
    );
    const dbFeatures = (Array.isArray(product.features) ? product.features : [])
      .map((f: unknown) => {
        const o = (f ?? {}) as Record<string, unknown>;
        return {
          name: String(o.name ?? ''),
          image: typeof o.image === 'string' ? o.image : null,
          description: typeof o.description === 'string' ? o.description : null,
        };
      })
      .filter((f) => f.name !== '');
    const dbCareInstructions = (Array.isArray(product.care_instructions)
      ? product.care_instructions
      : []
    ).map((c: unknown) => String(c ?? '')).filter(Boolean);
    const dbSizeGuide =
      product.size_guide && typeof product.size_guide === 'object'
        ? (product.size_guide as {
            sizes?: string[];
            types?: { name: string; units: string; ranges: { from: string; to: string }[] }[];
          })
        : null;

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

    const [{ data: variants }, costs, snapshots, templates, ownTemplates, productionTimes] = await Promise.all([
      supabaseAdmin()
        .from('supplier_catalog_variants')
        .select('size,color,print_specs,price_snapshot')
        .eq('supplier_catalog_product_id', id)
        .limit(1000),
      canonical ? cheapestCosts([canonical]) : Promise.resolve(new Map()),
      canonical ? minVariantSnapshots([canonical]) : Promise.resolve(new Map()),
      templatesForCategory(topName),
      // The blank's OWN ingested render-contract rows (canonical_product_id
      // match). When at least one carries a stored base, these views win
      // over the category archetype — the canvas then edits on the same
      // color-accurate, stored-in-our-bucket base the render worker uses.
      canonical
        ? supabaseAdmin()
            .from('product_canvas_templates')
            .select('*')
            .eq('canonical_product_id', canonical)
            .eq('is_active', true)
            .order('view_angle')
        : Promise.resolve({ data: [] } as { data: never[] }),
      // Production time for THIS row — min across every provider that
      // carries it. Drives the Est. Shipping box on the card / product
      // page header. Source: catalog_provider_facts.production_time_avg.
      cheapestProductionTimes([id]),
    ]);

    // Format "3.2 days" / "2.5 business days" / null — symmetric with the
    // blanks list route's formatter so the card and the product page agree.
    // No facts row → the supplier's published estimate (Printful 2–5
    // business days for all products; Cloudprinter 1 business day SLA) —
    // the card's Est. Shipping box must not go blank for half the catalog.
    const prodTime = productionTimes.get(id) ?? null;
    const publishedEst: Record<string, string> = {
      printful: '2–5 business days',
      cloudprinter: '1 business day',
    };
    const formatEstShipping = (_rowId: string): string | null => {
      if (!prodTime) return publishedEst[supplier.data?.slug ?? ''] ?? null;
      const unit = prodTime.unit === 'business_days' ? 'days' : prodTime.unit;
      const days = prodTime.days;
      return `${days % 1 === 0 ? days : days.toFixed(1)} ${unit}`;
    };

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

    // Views: per-blank ingested rows first (stored bases OR geometry-only
    // rows with real provider inches), archetype rows only as the fallback
    // when nothing is ingested yet.
    const ownRows = (ownTemplates as { data: Record<string, unknown>[] }).data ?? [];
    const ownRenderable = ownRows.filter(
      (t) => Boolean(t.stored_base_path) || Number(t.physical_width_inches ?? 0) > 0,
    );
    let views: unknown[];
    if (ownRenderable.length > 0) {
      views = await Promise.all(
        ownRenderable.map(async (t) => {
          let baseUrl: string | null = null;
          if (t.stored_base_path) {
            try {
              baseUrl = await storageFetchUrl(String(t.stored_base_path));
            } catch {
              baseUrl = (t.mockup_image_url as string | null) ?? null;
            }
          } else {
            // Geometry-only row: no photo exists — the catalog image stands in.
            baseUrl = (t.mockup_image_url as string | null) ?? null;
          }
          const zoneX = Number(t.print_zone_x ?? 0);
          const zoneY = Number(t.print_zone_y ?? 0);
          const zoneW = Number(t.print_zone_width ?? 0);
          const zoneH = Number(t.print_zone_height ?? 0);
          const wIn = Number(t.physical_width_inches ?? 0);
          const hIn = Number(t.physical_height_inches ?? 0);
          const ppi = Number(t.px_per_inch ?? 0) || (zoneW > 0 && wIn > 0 ? zoneW / wIn : 300);
          const r2 = (n: number) => Math.round(n * 100) / 100;
          return {
            view: String(t.view_angle),
            label: String(t.view_angle),
            baseUrl,
            shadingUrl: (t.stored_shading_path as string | null) ?? null,
            maskUrl: (t.displacement_map_url as string | null) ?? null,
            boxPx: { left: zoneX, top: zoneY, width: zoneW, height: zoneH },
            boxIn: {
              xIn: r2(zoneX / ppi),
              yIn: r2(zoneY / ppi),
              wIn: wIn > 0 ? wIn : r2(zoneW / ppi),
              hIn: hIn > 0 ? hIn : r2(zoneH / ppi),
            },
            pxPerInch: ppi,
            // Stored-view coordinates are ALREADY in the stored image's own
            // pixel space (canvasPx null → 1:1). Geometry-only rows anchor
            // on the 450×600 flat mockup canvas and display over the
            // catalog image — clients scale the box from that space.
            canvasPx: t.stored_base_path ? null : { w: 450, h: 600 },
            source: 'stored',
            verified: Boolean(t.verified),
            // A view is only a real mockup image when a base photo was
            // actually ingested for it. Geometry-only rows share the
            // product's single front mockup_image_url for every angle —
            // showing that as BACK/LEFT/RIGHT is wrong, so clients hide
            // hasImage=false thumbs instead of rendering a broken or
            // misleading thumbnail.
            hasImage: Boolean(t.stored_base_path),
          };
        }),
      );
    } else {
      views = templates.map((t) => {
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
          source: 'archetype',
          verified: false,
          hasImage: Boolean(t.mockup_image_url),
        };
      });
    }

    const costRow = canonical ? costs.get(canonical) : undefined;
    const snapshot = canonical ? snapshots.get(canonical) : undefined;

    // ── Supplier catalog enrichment — SYMMETRIC contract ──
    // Our DB mirror carries only what the one-time sync captured. Each
    // keeper supplier fills the SAME response shape from its own catalog
    // API; what a supplier can't provide stays null/empty (never invented):
    //
    //   field            Printful (v2 catalog API)     Printify (print_specs / blueprints API)
    //   techniques       techniques[]                  placeholders[].decoration_method
    //   description      description (plain text)      blueprints/{id}.description (HTML → text)
    //   color hex        colors[] / images hex         name→hex map (no hex in Printify's API)
    //   techniquePrices  prices endpoint (per tech)    — (single base cost)
    //   gallery          images endpoint (per color)   — (archetype views only)
    //   providerTitle    — (Printful IS the printer)   print_specs.provider_title
    //   printAreas       — (v2 API exposes no px dims) placeholders[] (exact px)
    //
    // Every fetch is non-fatal — a failed call degrades that field only.
    let techniques: { key: string; label: string; isDefault: boolean }[] = [];
    // DB description first — the mirror already has it for Printify
    // rows. The supplier-API enrichment below only fills the gap when
    // the mirror has none (e.g. Printful).
    let description = dbDescription;
    let printfulEnriched = false;
    // Per-technique pricing (Printful): DTG $9.44 / Embroidery $11.71 / DTF
    // $10.92 — plus the discounted tier (Printful Growth). Empty for
    // suppliers without technique-level pricing.
    let techniquePrices: { key: string; label: string; price: number; discountedPrice: number | null }[] = [];
    // Supplier mockup gallery per color (Printful images endpoint): the
    // per-color swatches with real hex + the front/back/lifestyle images
    // Printful's own product page shows.
    let gallery: { color: string; hex: string; images: { placement: string; url: string }[] }[] = [];
    // Which supplier's API filled description
    // ('database' | 'printful' | 'printify' | '').
    let descriptionSource = dbDescription ? 'database' : '';

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
        // Only when the DB mirror has no description — the mirror wins
        // when present (it is the supplier's own text, captured at ingest).
        if (!description) {
          description = String(pf.description ?? '');
          descriptionSource = description ? 'printful' : '';
        }
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

        // Per-technique prices + gallery — additive, each guarded so one
        // failed endpoint never kills the other enrichments.
        try {
          const prices = await printfulCatalogPrices(product.external_id as string);
          const productLevel = Array.isArray(prices.product) ? prices.product : [];
          techniquePrices = productLevel.map((t) => ({
            key: t.technique_key,
            label: t.technique_display_name,
            price: Number(t.price),
            discountedPrice:
              t.discounted_price != null && Number(t.discounted_price) !== Number(t.price)
                ? Number(t.discounted_price)
                : null,
          }));
          if (techniquePrices.length === 0 && prices.variants?.[0]?.techniques) {
            // Product-level missing — derive from the first variant's set.
            techniquePrices = prices.variants[0].techniques.map((t) => ({
              key: t.technique_key,
              label: t.technique_display_name,
              price: Number(t.price),
              discountedPrice:
                t.discounted_price != null && Number(t.discounted_price) !== Number(t.price)
                  ? Number(t.discounted_price)
                  : null,
            }));
          }
        } catch {
          techniquePrices = [];
        }
        try {
          const imgSets = await printfulCatalogImages(product.external_id as string);
          // One gallery entry per color (first image set per color name),
          // ordered as Printful returns them. Printful returns EVERY mockup
          // style per color (hundreds) — cap each color at 12 images so the
          // payload stays sane; the gallery shows the first 8 anyway.
          const MAX_PER_COLOR = 12;
          const byColor = new Map<string, { color: string; hex: string; images: { placement: string; url: string }[] }>();
          for (const set of imgSets) {
            if (!byColor.has(set.color)) {
              byColor.set(set.color, {
                color: set.color,
                hex: set.primary_hex_color || pfHexByName.get(set.color.toLowerCase()) || '',
                images: (set.images ?? [])
                  .slice(0, MAX_PER_COLOR)
                  .map((i) => ({ placement: i.placement, url: i.image_url })),
              });
            }
          }
          gallery = [...byColor.values()];
        } catch {
          gallery = [];
        }
      } catch {
        // Catalog API unreachable or key missing — fall through to DB-only.
        printfulEnriched = false;
      }
    }

    // Printify: techniques + providerTitle come from print_specs (parsed
    // above). Description comes from the blueprint API via the blueprint_id
    // in print_specs — the mirror doesn't carry it.
    if (techniques.length === 0 && techniquesFromSpecs.size > 0) {
      techniques = [...techniquesFromSpecs.entries()].map(([key, label], i) => ({
        key,
        label,
        isDefault: i === 0,
      }));
    }
    if (!description) {
      const blueprintId = (() => {
        for (const v of variants ?? []) {
          const bid = (v.print_specs as any)?.blueprint_id;
          if (bid) return bid as number | string;
        }
        return null;
      })();
      if (blueprintId) {
        try {
          const { printifyBlueprint } = await import('@/lib/printify');
          const bp = await printifyBlueprint(blueprintId);
          // Blueprint description is HTML — strip tags for the text block.
          description = String(bp.description ?? '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          descriptionSource = description ? 'printify' : '';
        } catch {
          description = '';
        }
      }
    }

    // ── Printers / fulfillment centers — built AFTER the offers block
    // below (it needs the deduped per-supplier offers). One row per
    // fulfillment center for THIS product: every Printify blueprint
    // provider (name + location + its own production time), plus one
    // summary row per other keeper supplier on the same canonical.
    // The old code listed one row per supplier from same-type siblings
    // and only the single provider pinned in print_specs — so a Printify
    // product showed 1 center with a null lead time while 19 exist.
    let printers: {
      name: string;
      slug: string;
      baseCost: number | null;
      estimatedDelivery: { average: number; unit: string } | null;
      location: string | null;
      deliveryLabel: string | null;
      providerCount: number;
    }[] = [];
    let deliveryEstimate = '';

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

    // ── Offers: every keeper row carrying the SAME canonical product ──
    // The true cross-supplier comparison for this exact product (Printify's
    // row + Printful's row when both carry it), each with its own cost,
    // variant count, delivery estimate and image. What powers the product
    // page's "Supplier Cost Comparison" box and the "2 Suppliers" badge.
    let offers: {
      blankId: string;
      supplier: string;
      supplierSlug: string;
      name: string;
      brand: string;
      cost: number | null;
      shipping: number | null;
      variantCount: number;
      imageUrl: string | null;
      estimatedDeliveryDays: number | null;
      estimatedDeliveryLabel: string | null;
    }[] = [];
    if (canonical) {
      try {
        const keeperIdList = await keeperSupplierIds();
        const [siblingRes, costRes, snapRes] = await Promise.all([
          supabaseAdmin()
            .from('supplier_catalog_products')
            .select('id,name,brand_name,supplier_id,variant_count,image_url,external_id')
            .eq('canonical_product_id', canonical)
            .in('supplier_id', keeperIdList),
          // Per-SUPPLIER cost rows for this canonical (in-stock first).
          supabaseAdmin()
            .from('supplier_product_costs')
            .select('supplier_name,base_cost_usd,shipping_estimate_usd,is_in_stock')
            .eq('canonical_product_id', canonical),
          // Per-PRODUCT variant price fallback.
          supabaseAdmin()
            .from('supplier_catalog_variants')
            .select('supplier_catalog_product_id,price_snapshot')
            .eq('canonical_product_id', canonical)
            .not('price_snapshot', 'is', null)
            .limit(2000),
        ]);
        // Per-supplier cost keyed LOWERCASE: supplier_product_costs stores
        // 'printful' but suppliers.name is 'Printful' — the old lookup by
        // display name missed every row, so every offer fell back to the
        // variant snapshot and shipping was always null. Keep the CHEAPEST
        // in-stock row per supplier (the old code overwrote with whatever
        // row came last). A stored 0.00 shipping estimate means "not
        // captured" (all 2,121 cost rows carry 0.00) — never display it
        // as free shipping; it stays null until a live rate exists.
        const costBySupplier = new Map<string, { cost: number; shipping: number | null }>();
        for (const c of costRes.data ?? []) {
          const name = String(c.supplier_name).toLowerCase();
          const cost = Number(c.base_cost_usd);
          const shippingRaw =
            c.shipping_estimate_usd != null ? Number(c.shipping_estimate_usd) : null;
          const shipping = shippingRaw != null && shippingRaw > 0 ? shippingRaw : null;
          const prev = costBySupplier.get(name);
          if (!prev || cost < prev.cost) {
            costBySupplier.set(name, { cost, shipping });
          }
        }
        const snapByProduct = new Map<string, number>();
        for (const v of snapRes.data ?? []) {
          const pid = v.supplier_catalog_product_id as string;
          const price = Number(v.price_snapshot);
          if (!snapByProduct.has(pid) || price < (snapByProduct.get(pid) ?? Infinity)) {
            snapByProduct.set(pid, price);
          }
        }
        const sibIds = [...new Set((siblingRes.data ?? []).map((s) => s.supplier_id as string))];
        const { data: sibSups } = sibIds.length
          ? await supabaseAdmin().from('suppliers').select('id,name,slug').in('id', sibIds)
          : { data: [] as { id: string; name: string; slug: string }[] };
        const sibSupMap = new Map((sibSups ?? []).map((s) => [s.id, s]));
        // Lead time per sibling product: fastest provider in
        // catalog_provider_facts (Printify), else the supplier's published
        // estimate — Printful 2–5 business days for all products, Cloudprinter
        // 1 business day standard SLA (verified against each supplier's live
        // catalog API 2026-11-11; neither API exposes a per-product time).
        const sibProdIds = [...new Set((siblingRes.data ?? []).map((s) => s.id as string))];
        const sibProdTimes = await cheapestProductionTimes(sibProdIds);
        const publishedLead: Record<string, { days: number; label: string }> = {
          printful: { days: 2, label: '2–5 business days' },
          cloudprinter: { days: 1, label: '1 business day' },
        };
        const leadFor = (
          blankId: string,
          slug: string,
        ): { days: number | null; label: string | null } => {
          const t = sibProdTimes.get(blankId);
          if (t) return { days: t.days, label: `${t.days % 1 === 0 ? t.days : t.days.toFixed(1)} ${t.unit.replace(/_/g, ' ')}` };
          const pub = publishedLead[slug];
          if (pub) return { days: pub.days, label: pub.label };
          return { days: null, label: null };
        };
        // One offer per SUPPLIER — the same supplier can carry the canonical
        // twice (e.g. Cloudprinter men + women rows); the old code listed
        // both, so the comparison showed the supplier twice with null costs.
        // Keep the cheapest row per supplier.
        // Cloudprinter has NO prices in our DB (0 supplier_product_costs
        // rows, 0 variant snapshots) — its cost comes from the live
        // CloudCore prices/lookup endpoint, one call per reference.
        const { cloudprinterPriceLookup } = await import('@/lib/cloudprinter');
        const cpQuoteCache = new Map<string, Awaited<ReturnType<typeof cloudprinterPriceLookup>>>();
        const cpQuoteFor = async (ref: string | null) => {
          if (!ref) return null;
          if (!cpQuoteCache.has(ref)) {
            cpQuoteCache.set(ref, await cloudprinterPriceLookup(ref));
          }
          return cpQuoteCache.get(ref) ?? null;
        };
        const bySupplierOffer = new Map<string, {
          blankId: string;
          supplier: string;
          supplierSlug: string;
          name: string;
          brand: string;
          cost: number | null;
          shipping: number | null;
          variantCount: number;
          imageUrl: string | null;
          estimatedDeliveryDays: number | null;
          estimatedDeliveryLabel: string | null;
        }>();
        for (const s of siblingRes.data ?? []) {
          const sup = sibSupMap.get(s.supplier_id as string);
          const supplierName = sup?.name ?? 'Unknown supplier';
          const slug = sup?.slug ?? 'unknown';
          const perSupplier = costBySupplier.get(supplierName.toLowerCase());
          let cost = perSupplier?.cost ?? snapByProduct.get(s.id as string) ?? null;
          let shipping = perSupplier?.shipping ?? null;
          if (cost == null && slug === 'cloudprinter') {
            const q = await cpQuoteFor((s.external_id as string | null) ?? null);
            if (q) {
              cost = q.price;
              shipping = q.shippingMin;
            }
          }
          const lead = leadFor(s.id as string, slug);
          const row = {
            blankId: s.id as string,
            supplier: supplierName,
            supplierSlug: slug,
            name: s.name as string,
            brand: (s.brand_name as string) ?? 'Generic brand',
            cost,
            shipping,
            variantCount: (s.variant_count as number) ?? 0,
            imageUrl: (s.image_url as string) ?? null,
            estimatedDeliveryDays: lead.days,
            estimatedDeliveryLabel: lead.label,
          };
          const prev = bySupplierOffer.get(s.supplier_id as string);
          if (!prev || (row.cost ?? Infinity) < (prev.cost ?? Infinity)) {
            bySupplierOffer.set(s.supplier_id as string, row);
          }
        }
        offers = [...bySupplierOffer.values()];
        // Cheapest first — the card's "best price" is offers[0].
        offers.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity));
      } catch {
        offers = [];
      }
    }

    // Self-product live Cloudprinter price: the DB has no Cloudprinter
    // cost for this product (no cost rows, no snapshots) — fill baseCost
    // from the live prices/lookup endpoint so a Cloudprinter-primary page
    // shows its own price instead of '—'.
    let selfLiveCost: number | null = null;
    let selfLiveShipping: number | null = null;
    if (
      (supplier.data?.slug ?? '') === 'cloudprinter' &&
      (costRow?.cost ?? snapshot ?? null) == null &&
      product.external_id
    ) {
      try {
        const { cloudprinterPriceLookup } = await import('@/lib/cloudprinter');
        const q = await cloudprinterPriceLookup(product.external_id as string);
        if (q) {
          selfLiveCost = q.price;
          selfLiveShipping = q.shippingMin;
        }
      } catch {
        // Live lookup is additive — DB-only data stands.
      }
    }

    // ── Printers: ALL fulfillment centers for THIS product ──
    // Self product first (every Printify provider, fastest first; the
    // published network row for Printful/Cloudprinter), then one summary
    // row per other keeper supplier on the same canonical, carrying that
    // supplier's fastest center + its offer cost. Additive — a failure
    // here never blocks the detail.
    try {
      const selfCost = costRow?.cost ?? snapshot ?? selfLiveCost ?? null;
      const selfRows = await printerProviders(id);
      printers = selfRows.map((r) => ({
        name: r.name,
        slug: r.slug,
        baseCost: selfCost,
        estimatedDelivery: r.estimatedDelivery,
        location: r.location,
        deliveryLabel: r.deliveryLabel,
        providerCount: r.providerCount,
      }));
      for (const o of offers) {
        if (o.supplierSlug === (supplier.data?.slug ?? '')) continue;
        const sibRows = await printerProviders(o.blankId);
        if (sibRows.length === 0) {
          printers.push({
            name: o.supplier,
            slug: o.supplierSlug,
            baseCost: o.cost,
            estimatedDelivery:
              o.estimatedDeliveryDays != null
                ? { average: o.estimatedDeliveryDays, unit: 'business_days' }
                : null,
            location: null,
            deliveryLabel: o.estimatedDeliveryLabel ?? null,
            providerCount: 1,
          });
          continue;
        }
        // EVERY center of the sibling supplier, each with its own time
        // and location — not a one-line summary. A Printify sibling
        // contributes all its blueprint providers (18 for Gildan 18000),
        // named with their supplier so a provider called "Printful"
        // (Printify provider 410) can't be mistaken for the supplier.
        // The single-row published networks (Printful 7 centers,
        // Cloudprinter routing) keep the supplier's own name.
        for (const r of sibRows) {
          // One row per sibling center; a lone row stands for the whole
          // supplier (Printful's 7-center network, Cloudprinter routing)
          // and keeps the supplier's own name.
          printers.push({
            name: sibRows.length === 1 ? o.supplier : `${r.name} (${o.supplier})`,
            slug: o.supplierSlug,
            baseCost: o.cost,
            estimatedDelivery: r.estimatedDelivery,
            location: r.location,
            deliveryLabel: r.deliveryLabel,
            providerCount: r.providerCount,
          });
        }
      }
      if (printers.length === 0) {
        printers = [
          {
            name: supplier.data?.name ?? 'Unknown supplier',
            slug: supplier.data?.slug ?? 'unknown',
            baseCost: selfCost,
            estimatedDelivery: null,
            location: null,
            deliveryLabel: null,
            providerCount: 1,
          },
        ];
      }
      // Delivery estimate = the fastest center that can fulfill THIS
      // product — the same basis as estShipping (min production time),
      // so the header and the card agree. The old code used the single
      // provider pinned in print_specs (3.7d, the slowest) while the
      // card showed the fastest (0.5d).
      const selfFastest = printers.find((p) => p.slug === (supplier.data?.slug ?? ''));
      if (selfFastest?.deliveryLabel) {
        deliveryEstimate = `≈${selfFastest.deliveryLabel}`;
      } else if (selfFastest?.estimatedDelivery) {
        deliveryEstimate = `≈${selfFastest.estimatedDelivery.average} ${selfFastest.estimatedDelivery.unit.replace(/_/g, ' ')}`;
      }
    } catch {
      // Printers list is additive — a failed lookup never blocks the detail.
      printers = [];
    }

    const responseBody = {
      id: product.id,
      canonicalProductId: canonical,
      name: product.name,
      brand: product.brand_name ?? 'Generic brand',
      supplier: supplier.data?.name ?? 'Unknown supplier',
      supplierSlug: supplier.data?.slug ?? 'unknown',
      baseCost: costRow?.cost ?? snapshot ?? selfLiveCost ?? null,
      currency: 'USD',
      family,
      mockupThumbUrl: product.image_url,
      printAreas: [...areaByPlacement.values()],
      status: templates.length > 0 ? 'unverified' : 'skeleton_pending',
      fulfillment: 'POD',
      estShipping: formatEstShipping(product.id),
      renderState,
      views,
      variants: {
        colors: [...colors.values()],
        sizes: [...sizes].sort(),
        printAreas: [...areaByPlacement.keys()],
      },
      // Supplier catalog enrichment — the data the DB mirror doesn't carry
      // but the supplier's own product page shows. SYMMETRIC contract: each
      // keeper supplier fills the same shape from its own API (see the
      // table in the enrichment block above); what a supplier can't
      // provide stays null/empty — never invented.
      techniques,
      description,
      descriptionSource,
      // The supplier's own product data from the DB mirror — the
      // product's OWN features / care / size guide, not the design's
      // mock copy. Empty when the mirror has none (never invented).
      features: dbFeatures,
      careInstructions: dbCareInstructions,
      sizeGuide: dbSizeGuide,
      providerTitle,
      // A stored 0.00 shipping estimate means "not captured" (every cost
      // row carries 0.00) — never display it as free shipping. Live
      // Cloudprinter shipping fills the gap when the DB has none.
      shippingCost:
        costRow?.shipping != null && costRow.shipping > 0
          ? costRow.shipping
          : selfLiveShipping ?? null,
      techniquePrices,
      gallery,
      printfulEnriched,
      guidelines: '',
      // supplier_product_costs stores the supplier name lowercase
      // ('printful'); the page renders "Ships from …" — capitalize it.
      shippingFrom: costRow?.supplier
        ? costRow.supplier.charAt(0).toUpperCase() + costRow.supplier.slice(1)
        : '',
      deliveryEstimate,
      printers,
      offers,
      supplierCount: offers.length,
    };
    blankDetailCacheSet(id, responseBody);
    return NextResponse.json(responseBody);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load blank.');
  }
}
