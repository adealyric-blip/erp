import { getIntegrationKey } from './supplierKeys';

/**
 * Cloudprinter CloudCore API client — live per-product pricing.
 *
 * Auth: the CloudCore API key goes IN THE JSON BODY as `apikey`
 * (verified live 2026-11-11 — X-API-Key header / query param / Bearer
 * all return 401; POST {"apikey": key} returns 200). Base is
 * /cloudcore/1.0/ (the /v1/ path 501s).
 *
 * POST /cloudcore/1.0/prices/lookup — product price + shipping quotes for
 * one unit shipped to a country/state. `options: []` is REQUIRED in the
 * item (omitting it 400s with "foreach() argument must be of type
 * array|object, null given"). Returns price (product sum excl. shipping
 * + VAT), currency, and shipments[].quotes[] (shipping options + prices).
 * The account's key matches the creds file and is live. No per-product
 * production time exists in this API — production is Cloudprinter's
 * published standard SLA (1 business day) and jobs route to the nearest
 * printer at order time, so there is no named center to list.
 *
 * Key resolves at runtime from integration_keys (CLOUDPRINTER_API_KEY).
 * A missing key throws — the caller reports it, never fakes the call.
 */

const BASE = 'https://api.cloudprinter.com/cloudcore/1.0';

export interface CloudprinterQuote {
  /** Product cost for one unit, excl. shipping + VAT. */
  price: number;
  currency: string;
  /** Cheapest shipping quote for one unit to the destination. */
  shippingMin: number | null;
  shippingOptions: { service: string; option: string; price: number }[];
}

const cache = new Map<string, { at: number; value: CloudprinterQuote | null }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
/** A failed lookup is cached only briefly (30s) — a transient failure
 *  must not hide the price for a full 5 minutes. */

/**
 * Live price + shipping for one Cloudprinter product reference
 * (supplier_catalog_products.external_id, e.g. "gildan_18000_men").
 * Destination defaults to US/CA (the store's home market); currency USD.
 * Returns null when the lookup fails or the product is unknown — the
 * caller falls back to DB-only data, never invents a price.
 */
export async function cloudprinterPriceLookup(
  reference: string,
  country = 'US',
  state = 'CA',
): Promise<CloudprinterQuote | null> {
  const key = `${reference}|${country}|${state}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? CACHE_TTL_MS : 30_000)) return hit.value;
  let value: CloudprinterQuote | null = null;
  try {
    const apiKey = await getIntegrationKey('CLOUDPRINTER_API_KEY');
    if (!apiKey) throw new Error('Cloudprinter: no API key on file (CLOUDPRINTER_API_KEY).');
    const res = await fetch(`${BASE}/prices/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        country,
        state,
        currency: 'USD',
        items: [{ reference: 'q1', product: reference, count: '1', options: [] }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudprinter ${res.status} on prices/lookup: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const price = Number(json?.price);
    if (!Number.isFinite(price) || price <= 0) {
      value = null;
    } else {
      const options: { service: string; option: string; price: number }[] = [];
      for (const sh of json?.shipments ?? []) {
        for (const q of sh?.quotes ?? []) {
          const p = Number(q?.price);
          if (Number.isFinite(p)) {
            options.push({
              service: String(q?.service ?? ''),
              option: String(q?.shipping_option ?? ''),
              price: p,
            });
          }
        }
      }
      options.sort((a, b) => a.price - b.price);
      value = {
        price,
        currency: String(json?.currency ?? 'USD'),
        shippingMin: options.length > 0 ? options[0].price : null,
        shippingOptions: options,
      };
    }
  } catch {
    value = null;
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}
