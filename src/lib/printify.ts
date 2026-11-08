import { getIntegrationKey } from './supplierKeys';

/**
 * Minimal Printify client for the POD publish path.
 * Key resolves at runtime from integration_keys (PRINTIFY_API_KEY).
 * A missing key throws — the caller reports it, never fakes the call.
 */

const BASE = 'https://api.printify.com';

async function printifyFetch(path: string, init?: RequestInit): Promise<any> {
  const apiKey = await getIntegrationKey('PRINTIFY_API_KEY');
  if (!apiKey) throw new Error('Printify: no API key on file (PRINTIFY_API_KEY).');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Printify ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export interface PrintifyProvider {
  id: number;
  title: string;
  decoration_methods?: string[];
  /** Estimated production time, e.g. { average: 3.3, unit: "business_days" }. */
  production_time?: { average: number; unit: string };
}

export async function printifyBlueprintProviders(
  blueprintId: number | string,
): Promise<PrintifyProvider[]> {
  const json = await printifyFetch(`/v1/catalog/blueprints/${blueprintId}/print_providers.json`);
  return Array.isArray(json) ? json : [];
}

export async function printifyBlueprintVariants(
  blueprintId: number | string,
  printProviderId: number | string,
): Promise<{ id: number; title: string; options?: { size?: string; color?: string } }[]> {
  const json = await printifyFetch(
    `/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
  );
  return Array.isArray(json?.variants) ? json.variants : [];
}

/**
 * The RAW variants.json payload — everything the design-canvas skeleton
 * needs: `placeholders` (every printable region with its exact px bounds at
 * production DPI) and `variants[].images` (the mockup image URL for every
 * color × view angle). This is the data the canvas mutes into skeleton
 * shells and the source of the front/back/sleeve pills.
 */
export interface PrintifyVariantsPayload {
  placeholders?: { position: string; height: number; width: number }[];
  variants?: {
    id: number;
    title: string;
    options?: { size?: string; color?: string };
    images?: { position: string; url: string; is_default?: boolean }[];
  }[];
}

export async function printifyBlueprintVariantsRaw(
  blueprintId: number | string,
  printProviderId: number | string,
): Promise<PrintifyVariantsPayload> {
  return printifyFetch(
    `/v1/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`,
  );
}

export async function printifyShops(): Promise<{ id: number; title: string }[]> {
  const json = await printifyFetch('/v1/shops.json');
  return Array.isArray(json) ? json : [];
}

export async function printifyDefaultShopId(): Promise<number> {
  const shops = await printifyShops();
  if (shops.length === 0) throw new Error('Printify: no shops on this account.');
  return shops[0].id;
}

/** Create the store product. Returns the created product incl. mockup images. */
export async function printifyCreateProduct(
  shopId: number,
  body: Record<string, unknown>,
): Promise<any> {
  return printifyFetch(`/v1/shops/${shopId}/products.json`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function printifyGetProduct(shopId: number, productId: string): Promise<any> {
  return printifyFetch(`/v1/shops/${shopId}/products/${productId}.json`);
}
