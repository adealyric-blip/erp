import { getIntegrationKey } from './supplierKeys';

/**
 * Printful catalog API client — fetches the product detail data our DB
 * mirror doesn't carry: techniques (DTG/Embroidery/DTF), full description
 * with features, colors with real hex codes (not name→hex guesses),
 * per-placement print geometry + thread colors, and product options
 * (embroidery unlimited_color, lifelike, etc.).
 *
 * The DB row for a Printful product carries `external_id` (the Printful
 * catalog product id, e.g. "438" for Gildan 5000) and
 * `external_id_type = "printful_catalog_product"` — that's the join key.
 *
 * Key resolves at runtime from integration_keys (PRINTFUL_API_KEY).
 * A missing key throws — the caller reports it, never fakes the call.
 */

const BASE = 'https://api.printful.com';

async function printfulFetch<T>(path: string): Promise<T> {
  const apiKey = await getIntegrationKey('PRINTFUL_API_KEY');
  if (!apiKey) throw new Error('Printful: no API key on file (PRINTFUL_API_KEY).');
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Printful ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** 5-minute in-memory cache — catalog product detail rarely changes and
 *  the product page fires this on every visit. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export interface PrintfulTechnique {
  key: string;
  display_name: string;
  is_default: boolean;
}

export interface PrintfulColor {
  name: string;
  value: string; // hex, e.g. "#f3f3f3"
}

export interface PrintfulPlacementLayer {
  type: string;
  layer_options?: {
    name: string;
    techniques: string[];
    type: string;
    values?: Record<string, string>;
  }[];
}

export interface PrintfulPlacement {
  placement: string;
  technique: string;
  layers: PrintfulPlacementLayer[];
  placement_options?: {
    name: string;
    techniques: string[];
    type: string;
    values: unknown[];
  }[];
  conflicting_placements?: string[];
}

export interface PrintfulProductOption {
  name: string;
  techniques: string[];
  type: string;
  values: unknown;
}

export interface PrintfulCatalogProduct {
  id: number;
  type: string;
  main_category_id: number;
  name: string;
  brand: string | null;
  model: string;
  image: string;
  variant_count: number;
  is_discontinued: boolean;
  description: string;
  sizes: string[];
  colors: PrintfulColor[];
  techniques: PrintfulTechnique[];
  placements: PrintfulPlacement[];
  product_options: PrintfulProductOption[];
}

interface PrintfulCatalogProductResponse {
  data: PrintfulCatalogProduct;
}

/**
 * GET /v2/catalog-products/{id} — one Printful catalog product, fully.
 * The response carries the data our DB mirror doesn't: techniques,
 * description, colors with hex, placements (per-technique print geometry
 * + thread colors), and product options.
 */
export async function printfulCatalogProduct(
  externalId: string | number,
): Promise<PrintfulCatalogProduct> {
  return cached(`printful:product:${externalId}`, async () => {
    const json = await printfulFetch<PrintfulCatalogProductResponse>(
      `/v2/catalog-products/${externalId}`,
    );
    return json.data;
  });
}

/** Whether a product row's external_id maps to a Printful catalog product. */
export function isPrintfulCatalogProduct(externalIdType: string | null | undefined): boolean {
  return (externalIdType ?? '').toLowerCase() === 'printful_catalog_product';
}
