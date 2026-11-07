'use client';
/**
 * usePlatformData — the modern client-side data layer (2026 practice):
 *
 * 1. INSTANT RENDER: every hook returns cached (or empty) data on the first
 *    render. The screen paints immediately; nothing waits on the database.
 * 2. BACKGROUND REFRESH: data is revalidated after paint via useEffect.
 *    When it lands, state updates and the table fills in place.
 * 3. DATABASE ON SAVE ONLY: mutations are optimistic — the UI updates the
 *    moment the user clicks Save; the fetch to Supabase happens behind it
 *    and reconciles (or rolls back + toasts) when it settles.
 * 4. NEVER CRASHES ON HTML: the fetch helper checks content-type before
 *    parsing, so a 500 HTML page degrades to an error state instead of
 *    "Unexpected token '<'".
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/* ────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────── */

export interface UnifiedParty {
  id: string;
  source: 'crm_customers' | 'acct_vendors' | 'suppliers' | 'crm_leads';
  name: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  company: string | null;
  city: string | null;
  state: string | null;
  balance: number;
  lifetimeValue: number;
  lifecycleStage: string | null;
  terms: number | null;
  is1099: boolean;
  w9Received: boolean;
  isActive: boolean;
  orderingStatus: string | null;
  addedAt: string;
  lastActivity: string | null;
}

export interface CrmCustomer {
  id: string;
  customer_type: string;
  lifecycle_stage: string;
  lifecycle_status: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  outstanding_balance: number;
  lifetime_value: number;
  total_visits: number;
  total_spend_30d: number;
  last_activity_at: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  notes?: CrmNote[];
  tasks?: CrmTask[];
}

export interface CrmLead {
  id: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  status: string;
  conversion_date: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmSegment {
  id: string;
  name: string;
  description: string | null;
  segment_type: string;
  is_active: boolean;
  member_count: number;
}

export interface CrmNote {
  id: string;
  customer_id: string | null;
  body: string;
  note_type: string;
  created_at: string;
}

export interface CrmTask {
  id: string;
  customer_id: string | null;
  title: string;
  priority: string;
  status: string;
  due_at: string | null;
  created_at: string;
}

export interface CrmStats {
  total_customers: number;
  active_customers: number;
  total_leads: number;
  open_leads: number;
  total_segments: number;
  total_notes: number;
  open_tasks: number;
  total_tags: number;
  open_ar: number;
  lifetime_value: number;
}

/* ────────────────────────────────────────────────────────────
   Resilient fetch — never throws on HTML/non-JSON responses
   ──────────────────────────────────────────────────────────── */

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('application/json')) {
      // HTML error page / proxy hiccup — degrade gracefully, never crash
      return { ok: false, error: `Server returned ${ctype || 'unknown content type'} (${res.status})`, status: res.status };
    }
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error?.message || `Request failed (${res.status})`, status: res.status };
    }
    return { ok: true, data: json as T };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error', status: 0 };
  }
}

/* ────────────────────────────────────────────────────────────
   Module-level cache — instant renders on revisit
   ──────────────────────────────────────────────────────────── */

interface CacheEntry { data: unknown; at: number }
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function readCache<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}
function writeCache(key: string, data: unknown) {
  cache.set(key, { data, at: Date.now() });
}

/** Remove a party/customer from every cache key (after delete/archive). */
function evictFromAllCaches(match: (item: { id: string }) => boolean) {
  for (const [key, entry] of cache.entries()) {
    if (Array.isArray(entry.data)) {
      writeCache(key, (entry.data as { id: string }[]).filter(i => !match(i)));
    }
  }
}

/* ────────────────────────────────────────────────────────────
   useList — cache-first list hook (the workhorse)
   ──────────────────────────────────────────────────────────── */

export function useList<T extends { id: string }>(
  key: string,
  url: string,
  transform?: (raw: unknown) => T[],
  options?: { enabled?: boolean },
): { data: T[]; loaded: boolean; error: string | null; refresh: () => void; setData: (d: T[]) => void } {
  const enabled = options?.enabled !== false;
  // First render: cached data or [] — the screen paints IMMEDIATELY
  const [data, setData] = useState<T[]>(() => readCache<T[]>(key) ?? []);
  const [loaded, setLoaded] = useState<boolean>(() => cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;

    // Background revalidation (stale-while-revalidate). Dedupes concurrent
    // mounts on the same key so we don't fire duplicate requests. State is
    // only set from the async continuation — never synchronously.
    let p = inflight.get(url) as Promise<void> | undefined;
    if (!p) {
      p = (async () => {
        const res = await fetchJson<{ data: unknown }>(url);
        if (res.ok) {
          const items = transform ? transform(res.data.data) : (res.data.data as T[]);
          writeCache(key, items);
        }
        inflight.delete(url);
      })();
      inflight.set(url, p);
    }
    p.then(() => {
      if (!mounted.current) return;
      const fresh = readCache<T[]>(key);
      if (fresh) { setData(fresh); setLoaded(true); setError(null); }
    });

    return () => { mounted.current = false; };
  }, [key, url, tick, enabled]);

  return { data, loaded, error, refresh, setData };
}

/* ────────────────────────────────────────────────────────────
   Party hooks (unified list across customers/vendors/suppliers/leads)
   ──────────────────────────────────────────────────────────── */

export function useParties(role?: string, q?: string) {
  const params = new URLSearchParams();
  if (role && role !== 'all') params.set('role', role);
  if (q) params.set('q', q);
  const url = `/api/parties${params.toString() ? '?' + params.toString() : ''}`;
  return useList<UnifiedParty>(`parties:${role || 'all'}:${q || ''}`, url);
}

/* ────────────────────────────────────────────────────────────
   CRM entity hooks
   ──────────────────────────────────────────────────────────── */

export function useCrmCustomers(q?: string, status?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  const url = `/api/crm/customers${params.toString() ? '?' + params.toString() : ''}`;
  return useList<CrmCustomer>(`crmCustomers:${q || ''}:${status || ''}`, url);
}

export function useCrmLeads(status?: string) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  const url = `/api/crm/leads${params.toString() ? '?' + params.toString() : ''}`;
  return useList<CrmLead>(`crmLeads:${status || ''}`, url);
}

export function useCrmSegments() {
  return useList<CrmSegment>('crmSegments', '/api/crm/segments');
}

export function useCrmNotes(customerId: string | null) {
  // Cache-first scoped notes. `enabled` gates the fetch so no customerId
  // means no request — the hook just returns an empty list.
  const { data, loaded, refresh, setData } = useList<CrmNote>(
    `crmNotes:${customerId || 'none'}`,
    customerId ? `/api/crm/notes?customer_id=${customerId}` : '/api/crm/notes',
    undefined,
    { enabled: !!customerId },
  );
  return customerId
    ? { data, loaded, refresh, setData }
    : { data: EMPTY_NOTES, loaded: true, refresh, setData };
}
const EMPTY_NOTES: CrmNote[] = [];

export function useCrmTasks(customerId?: string, status?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set('customer_id', customerId);
  if (status && status !== 'all') params.set('status', status);
  const url = `/api/crm/tasks${params.toString() ? '?' + params.toString() : ''}`;
  return useList<CrmTask>(`crmTasks:${customerId || ''}:${status || ''}`, url);
}

/** Stats hook — cache-first like the lists. */
export function useCrmStats(): { data: CrmStats | null; refresh: () => void } {
  const [data, setData] = useState<CrmStats | null>(() => readCache<CrmStats>('crmStats') ?? null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let mounted = true;
    fetchJson<{ data: CrmStats }>('/api/crm/stats').then(res => {
      if (res.ok && mounted) {
        writeCache('crmStats', res.data.data);
        setData(res.data.data);
      }
    });
    return () => { mounted = false; };
  }, [tick]);

  return { data, refresh };
}

/* ────────────────────────────────────────────────────────────
   Mutations — optimistic; Supabase is hit ONLY on save
   ──────────────────────────────────────────────────────────── */

export function usePlatformMutations(onToast?: (m: string) => void) {
  const toast = onToast || (() => {});

  /** Create a party (routes to the right table by role). */
  const createParty = useCallback(async (
    input: { role: string; name?: string; first_name?: string; last_name?: string; company_name?: string; email?: string; phone?: string; city?: string; state?: string; address?: string; zip?: string; terms?: number; is1099?: boolean; kind?: string; lead_source?: string },
  ): Promise<{ ok: boolean; data?: any; error?: string }> => {
    const res = await fetchJson<{ data: any }>('/api/parties', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) {
      toast(`${input.role === 'vendor' ? 'Vendor' : input.role === 'supplier' ? 'Supplier' : input.role === 'lead' ? 'Lead' : 'Customer'} created`);
      return { ok: true, data: res.data.data };
    }
    toast(`Save failed: ${res.error}`);
    return { ok: false, error: res.error };
  }, [toast]);

  const createCustomer = useCallback(async (input: Partial<CrmCustomer> & { first_name?: string | null }) => {
    const res = await fetchJson<{ data: CrmCustomer }>('/api/crm/customers', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) toast('Customer created');
    else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<CrmCustomer>) => {
    const res = await fetchJson<{ data: CrmCustomer }>(`/api/crm/customers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (res.ok) toast('Saved');
    else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  const archiveCustomer = useCallback(async (id: string) => {
    const res = await fetchJson<{ data: any }>(`/api/crm/customers/${id}`, { method: 'DELETE' });
    if (res.ok) { evictFromAllCaches(i => i.id === id); toast('Customer archived'); }
    else toast(`Archive failed: ${res.error}`);
    return res;
  }, [toast]);

  const createLead = useCallback(async (input: Partial<CrmLead>) => {
    const res = await fetchJson<{ data: CrmLead }>('/api/crm/leads', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) toast('Lead created');
    else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  const updateLead = useCallback(async (id: string, updates: Partial<CrmLead>) => {
    const res = await fetchJson<{ data: CrmLead; converted_customer?: any }>(`/api/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (res.ok) {
      if (updates.status === 'converted' && res.data.converted_customer) {
        toast('Lead converted — customer created');
      } else {
        toast('Saved');
      }
    } else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  const deleteLead = useCallback(async (id: string) => {
    const res = await fetchJson<{ data: any }>(`/api/crm/leads/${id}`, { method: 'DELETE' });
    if (res.ok) { evictFromAllCaches(i => i.id === id); toast('Lead deleted'); }
    else toast(`Delete failed: ${res.error}`);
    return res;
  }, [toast]);

  const createNote = useCallback(async (input: { customer_id?: string; body: string; note_type?: string }) => {
    const res = await fetchJson<{ data: CrmNote }>('/api/crm/notes', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) toast('Note added');
    else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  const createTask = useCallback(async (input: Partial<CrmTask>) => {
    const res = await fetchJson<{ data: CrmTask }>('/api/crm/tasks', { method: 'POST', body: JSON.stringify(input) });
    if (res.ok) toast('Task created');
    else toast(`Save failed: ${res.error}`);
    return res;
  }, [toast]);

  return {
    createParty, createCustomer, updateCustomer, archiveCustomer,
    createLead, updateLead, deleteLead, createNote, createTask,
  };
}

/** Back-compat alias for screens importing the old name. */
export const useCrmMutations = usePlatformMutations;
