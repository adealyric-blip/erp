import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  apiError,
  KEEPER_SUPPLIER_SLUGS,
  loadProductSupplierMap,
  loadProductTaxonomyLinks,
  loadTaxonomyNodes,
  STOREFRONT_DEPARTMENTS,
  TaxonomyNode,
} from '@/lib/podServer';

/** In-process cache: the taxonomy tree + product counts are expensive to
 *  rebuild (paged reads of taxonomy_nodes, product_taxonomy_links, and the
 *  supplier_catalog_products id→supplier_id map). 5-minute TTL matches the
 *  legacy categories cache. */
let cached: { at: number; payload: unknown } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/**
 * GET /api/v1/categories — the designer navigation, built from the REAL
 * taxonomy tree (taxonomy_nodes table). The six storefront departments —
 * Accessories, Home goods, Men, Women, Children, Collections — with their
 * descendants and live product counts. The legacy `categories` table (the
 * old Printify catalog dump with Apparel/Drinkware/Wall Art as roots) is
 * NOT read here; the user migrated the storefront tree to taxonomy_nodes
 * on 2026-11-10 and the sidebar must reflect that tree, not the old one.
 *
 * Response shape is the CategoryNavNode contract the frontend already
 * consumes — { id, name, slug, totalProducts, keeperProducts, suppliers,
 * children } — so no client changes are needed.
 */
export async function GET() {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return NextResponse.json(cached.payload);
    }

    const [nodes, links, supplierMap, keepers] = await Promise.all([
      loadTaxonomyNodes(),
      loadProductTaxonomyLinks(),
      loadProductSupplierMap(),
      keeperSupplierIds(),
    ]);
    const keeperSet = new Set(keepers);

    // The suppliers table (id → name, slug) for the per-node breakdown.
    const { data: suppliers, error: supErr } = await supabaseAdmin()
      .from('suppliers')
      .select('id,name,slug');
    if (supErr) throw new Error(`suppliers: ${supErr.message}`);
    const supplierById = new Map(
      (suppliers ?? []).map((s) => [s.id as string, s]),
    );

    // Index children by parent for the recursive build.
    const childrenOf = new Map<string | null, TaxonomyNode[]>();
    for (const n of nodes) {
      const key = n.parent_id ?? null;
      const list = childrenOf.get(key) ?? [];
      list.push(n);
      childrenOf.set(key, list);
    }

    // Roll up (node_id → product_id → supplier_id) so each node knows its
    // total product count, keeper count, and per-supplier breakdown.
    // Counts roll up to every ancestor (a product under Men/Shirts/T-Shirts
    // counts toward all three).
    const ancestors = (id: string): string[] => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const out: string[] = [];
      let cur = byId.get(id);
      let guard = 0;
      while (cur && guard < 20) {
        out.push(cur.id);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
        guard++;
      }
      return out;
    };
    // node_id → Map<supplier_id, count>
    const countsByNode = new Map<string, Map<string, number>>();
    for (const link of links) {
      const supId = supplierMap.get(link.product_id);
      if (!supId) continue;
      for (const ancestorId of ancestors(link.node_id)) {
        const m = countsByNode.get(ancestorId) ?? new Map<string, number>();
        m.set(supId, (m.get(supId) ?? 0) + 1);
        countsByNode.set(ancestorId, m);
      }
    }

    const buildNode = (n: TaxonomyNode): Record<string, unknown> => {
      const m = countsByNode.get(n.id) ?? new Map<string, number>();
      const supplierList = [...m.entries()]
        .map(([supId, productCount]) => {
          const s = supplierById.get(supId);
          return {
            id: supId,
            name: s?.name ?? 'Unknown',
            slug: s?.slug ?? 'unknown',
            productCount,
          };
        })
        .sort((a, b) => b.productCount - a.productCount);
      const total = supplierList.reduce((s, x) => s + x.productCount, 0);
      const keeperProducts = supplierList
        .filter((s) => KEEPER_SUPPLIER_SLUGS.includes(s.slug))
        .reduce((s, x) => s + x.productCount, 0);
      return {
        id: n.id,
        name: n.name,
        slug: n.slug,
        totalProducts: total,
        keeperProducts,
        suppliers: supplierList,
        children: (childrenOf.get(n.id) ?? []).map(buildNode),
      };
    };

    // Roots: the six storefront departments, in the user's spec order.
    // Everything else in taxonomy_nodes (Apparel, Home & Living, Wall Art,
    // Drinkware, …) is legacy Printify-catalog noise — excluded.
    const byName = new Map(nodes.filter((n) => n.depth === 1).map((n) => [n.name, n]));
    const top = STOREFRONT_DEPARTMENTS.map((name) => byName.get(name)).filter(
      (n): n is TaxonomyNode => Boolean(n),
    );
    const payload = { categories: top.map(buildNode) };
    cached = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Failed to load categories.');
  }
}

/** Keeper supplier ids — the three slugs that flow into the designer. */
async function keeperSupplierIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from('suppliers')
    .select('id')
    .in('slug', KEEPER_SUPPLIER_SLUGS);
  if (error) throw new Error(`suppliers: ${error.message}`);
  return (data ?? []).map((s) => s.id as string);
}
