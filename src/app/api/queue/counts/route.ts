import { NextResponse } from 'next/server';
import { supabaseAdmin, DEFAULT_TENANT_ID } from '@/lib/supabaseAdmin';

/**
 * GET /api/queue/counts — LIVE badge counts for the sidebar queues.
 *
 * Everything is derived from real rows (no mock numbers):
 *   attention      = conversations awaiting a reply (last message inbound)
 *                  + overdue open tasks + due lead follow-ups
 *                  + unresolved crm_needs_attention flags
 *   customer-queue = open customer conversations (web_form / email / chat)
 *   seller-queue   = pending seller appeals + open seller violations
 */
export async function GET() {
  const sb = supabaseAdmin();
  const tenant = DEFAULT_TENANT_ID;

  const [convs, msgs, tasks, leads, flags, appeals, violations] = await Promise.all([
    sb.from('crm_conversations').select('id, status, channel, customer_id').eq('tenant_id', tenant),
    sb.from('crm_messages').select('id, conversation_id, direction, created_at').eq('tenant_id', tenant).order('created_at', { ascending: true }),
    sb.from('crm_tasks').select('id, status, due_at').eq('tenant_id', tenant),
    sb.from('crm_leads').select('id, status, next_follow_up_at').eq('tenant_id', tenant),
    sb.from('crm_needs_attention').select('id, status').eq('tenant_id', tenant),
    sb.from('seller_appeals').select('id, status').eq('tenant_id', tenant),
    sb.from('seller_violations').select('id, status').eq('tenant_id', tenant),
  ]);

  const now = new Date().toISOString();

  // Last message per conversation (messages are ordered ascending — the
  // final entry per conversation_id wins).
  const lastByConv = new Map<string, string>();
  for (const m of msgs.data || []) {
    lastByConv.set(m.conversation_id, m.direction);
  }

  const openConvs = (convs.data || []).filter(c => c.status === 'open');
  const awaitingReply = openConvs.filter(c => {
    const last = lastByConv.get(c.id);
    // No message yet, or the last one is inbound → needs a human reply
    return !last || last === 'inbound';
  }).length;

  const overdueTasks = (tasks.data || []).filter(
    t => t.status !== 'done' && t.due_at && t.due_at < now,
  ).length;

  const dueFollowUps = (leads.data || []).filter(
    l => l.next_follow_up_at && l.next_follow_up_at < now && !['converted', 'lost'].includes(l.status),
  ).length;

  const openFlags = (flags.data || []).filter(f => f.status !== 'resolved').length;

  const pendingAppeals = (appeals.data || []).filter(a => a.status === 'pending').length;
  const openViolations = (violations.data || []).filter(v => v.status === 'open').length;

  const counts = {
    attention: awaitingReply + overdueTasks + dueFollowUps + openFlags,
    'customer-queue': openConvs.length,
    'seller-queue': pendingAppeals + openViolations,
  };

  return NextResponse.json({ data: counts, meta: { awaitingReply, overdueTasks, dueFollowUps, openFlags, openConvs: openConvs.length, pendingAppeals, openViolations } });
}
