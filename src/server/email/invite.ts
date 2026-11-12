// Supplier invite email (T16).
// Sends the portal invite link via Resend (HTTPS API, no SDK). The token
// is passed in memory only: it is NEVER logged, NEVER stored by us, and
// never appears in any error message. The grep test in e2e/suppliers.spec.ts
// asserts no log line contains a token.
//
// The invite acceptance page itself is T18 (/supplier/invite/{token});
// this module only delivers the link.
//
// If RESEND_API_KEY is not configured the send is reported as
// `not_configured` — an explicit open state, never a silent stub: the
// caller (server action) surfaces it so the operator can resend once
// email is wired. Mailpit receipt is an open item until the local stack
// exists (see docs/phase3-proof/lane-1/).
'use server';

export interface InviteEmailInput {
  to: string;
  vendorName: string;
  inviterName?: string | null;
  token: string;
}

export type InviteEmailResult =
  | { sent: true; provider: 'resend'; id?: string }
  | { sent: false; reason: 'not_configured' | 'send_failed'; message: string };

function inviteUrl(token: string): string {
  const base = (process.env.SUPPLIER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/supplier/invite/${token}`;
}

function inviteBody(vendorName: string, url: string, inviterName?: string | null): { text: string; html: string } {
  const text = [
    `Hello ${vendorName},`,
    '',
    'You have been invited to the Atelier supplier portal.',
    '',
    `Accept your invite here: ${url}`,
    '',
    'The link expires in 7 days. If you did not expect this invite, ignore this email.',
    inviterName ? `\nInvited by ${inviterName}.` : '',
  ].join('\n');
  const html = `<p>Hello ${vendorName},</p><p>You have been invited to the Atelier supplier portal.</p><p><a href="${url}">Accept your invite</a></p><p>The link expires in 7 days. If you did not expect this invite, ignore this email.</p>${inviterName ? `<p>Invited by ${inviterName}.</p>` : ''}`;
  return { text, html };
}

export async function sendSupplierInviteEmail(input: InviteEmailInput): Promise<InviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'Atelier <no-reply@atelier.example>';
  if (!apiKey) {
    // Explicit, not silent: the caller reports this to the operator.
    return { sent: false, reason: 'not_configured', message: 'RESEND_API_KEY is not configured — invite email was not sent' };
  }
  const { text, html } = inviteBody(input.vendorName, inviteUrl(input.token), input.inviterName);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: input.to, subject: 'You are invited to the Atelier supplier portal', text, html }),
    });
    if (!res.ok) {
      return { sent: false, reason: 'send_failed', message: `Invite email failed with status ${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, provider: 'resend', id: body.id };
  } catch (e) {
    return { sent: false, reason: 'send_failed', message: e instanceof Error ? e.message : 'Invite email failed' };
  }
}
