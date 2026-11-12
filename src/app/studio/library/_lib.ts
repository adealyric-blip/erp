// Server helpers for the library pages (T10). Cast client: the library
// tables have no generated types yet (T03 covers 4 tables).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';

type AnyClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, v: string) => {
        order: (col: string, o: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function listRows(
  supabase: SupabaseClient<Database>,
  table: string,
  cols: string,
  tenantId: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await (supabase as unknown as AnyClient)
    .from(table)
    .select(cols)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data;
}

export async function getRow(
  supabase: SupabaseClient<Database>,
  table: string,
  cols: string,
  tenantId: string,
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await listRows(supabase, table, cols, tenantId);
  return rows.find((r) => r.id === id) ?? null;
}

export function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : '';
}
