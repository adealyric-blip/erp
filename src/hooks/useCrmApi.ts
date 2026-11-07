'use client';
/**
 * useCrmApi — client hook for the CRM module.
 * Fetches from /api/crm/* which proxy to Supabase with the service role key.
 * All mutations return the updated record so the UI can update reactively.
 */
import { useState, useEffect, useCallback } from 'react';

export interface CrmCustomer {
  id: string;
  tenant_id: string;
  customer_type: string;
  lifecycle_stage: string;
  lifecycle_status: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  outstanding_balance: number;
  lifetime_value: number;
  total_visits: number;
  total_spend_30d: number;
  total_spend_365d: number;
  last_activity_at: string | null;
  last_visit_at: string | null;
  next_appointment_at: string | null;
  lead_source: string | null;
  lead_status: string | null;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  notes?: CrmNote[];
  tasks?: CrmTask[];
  activity?: CrmActivity[];
  segments?: string[];
}

export interface CrmLead {
  id: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  lead_type: string | null;
  status: string;
  notes: string | null;
  first_contact_at: string | null;
  last_activity_at: string | null;
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
  entity_type: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export interface CrmNote {
  id: string;
  customer_id: string | null;
  body: string;
  note_type: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTask {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  customer_id: string | null;
  activity_type: string;
  description: string | null;
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
  at_risk: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `API error ${res.status}`);
  return json as T;
}

/** Hook: list customers with search + status filter */
export function useCrmCustomers(q?: string, status?: string) {
  const [data, setData] = useState<CrmCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status && status !== 'all') params.set('status', status);
      const res = await api<{ data: CrmCustomer[]; meta: any }>(`/api/crm/customers?${params}`);
      setData(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, error, refetch, setData };
}

/** Hook: single customer with notes/tasks/activity */
export function useCrmCustomer(id: string | null) {
  const [data, setData] = useState<CrmCustomer | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    try {
      const res = await api<{ data: CrmCustomer }>(`/api/crm/customers/${id}`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmCustomer error:', e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch, setData };
}

/** Mutations */
export function useCrmMutations() {
  const createCustomer = useCallback(async (input: Partial<CrmCustomer>) => {
    return api<{ data: CrmCustomer }>('/api/crm/customers', { method: 'POST', body: JSON.stringify(input) });
  }, []);

  const updateCustomer = useCallback(async (id: string, updates: Partial<CrmCustomer>) => {
    return api<{ data: CrmCustomer }>(`/api/crm/customers/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  }, []);

  const archiveCustomer = useCallback(async (id: string) => {
    return api<{ data: any }>(`/api/crm/customers/${id}`, { method: 'DELETE' });
  }, []);

  const createLead = useCallback(async (input: Partial<CrmLead>) => {
    return api<{ data: CrmLead }>('/api/crm/leads', { method: 'POST', body: JSON.stringify(input) });
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<CrmLead>) => {
    return api<{ data: CrmLead }>(`/api/crm/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    return api<{ data: any }>(`/api/crm/leads/${id}`, { method: 'DELETE' });
  }, []);

  const createNote = useCallback(async (input: { customer_id?: string; body: string; note_type?: string }) => {
    return api<{ data: CrmNote }>('/api/crm/notes', { method: 'POST', body: JSON.stringify(input) });
  }, []);

  const createTask = useCallback(async (input: Partial<CrmTask>) => {
    return api<{ data: CrmTask }>('/api/crm/tasks', { method: 'POST', body: JSON.stringify(input) });
  }, []);

  return { createCustomer, updateCustomer, archiveCustomer, createLead, updateLead, deleteLead, createNote, createTask };
}

/** Hook: leads list */
export function useCrmLeads(status?: string) {
  const [data, setData] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      const res = await api<{ data: CrmLead[] }>(`/api/crm/leads?${params}`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmLeads error:', e);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch, setData };
}

/** Hook: segments list */
export function useCrmSegments() {
  const [data, setData] = useState<CrmSegment[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CrmSegment[] }>(`/api/crm/segments`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmSegments error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch, setData };
}

/** Hook: CRM stats (KPI strip) */
export function useCrmStats() {
  const [data, setData] = useState<CrmStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: CrmStats }>(`/api/crm/stats`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmStats error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch };
}

/** Hook: notes for a customer */
export function useCrmNotes(customerId: string | null) {
  const [data, setData] = useState<CrmNote[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!customerId) { setData([]); return; }
    setLoading(true);
    try {
      const res = await api<{ data: CrmNote[] }>(`/api/crm/notes?customer_id=${customerId}`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmNotes error:', e);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch, setData };
}

/** Hook: tasks (optionally filtered by customer) */
export function useCrmTasks(customerId?: string, status?: string) {
  const [data, setData] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customerId) params.set('customer_id', customerId);
      if (status && status !== 'all') params.set('status', status);
      const res = await api<{ data: CrmTask[] }>(`/api/crm/tasks?${params}`);
      setData(res.data);
    } catch (e) {
      console.error('useCrmTasks error:', e);
    } finally {
      setLoading(false);
    }
  }, [customerId, status]);

  useEffect(() => { refetch(); }, [refetch]);

  return { data, loading, refetch, setData };
}
