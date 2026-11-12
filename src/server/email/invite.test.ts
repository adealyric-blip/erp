// Invite email — token-never-logged test (T16).
// The invite token must appear in NO log line. This module never logs
// at all; the test spies on every console method while a send runs (both
// the not-configured path and a mocked Resend success) and asserts the
// token string never appears.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendSupplierInviteEmail } from './invite';

const TOKEN = 'tok-test-0123456789abcdef-TOKEN-MUST-NOT-LEAK';

describe('sendSupplierInviteEmail — token never logged (T16)', () => {
  const origFetch = globalThis.fetch;
  const origKey = process.env.RESEND_API_KEY;
  let logs: string[] = [];
  let spies: ReturnType<typeof vi.spyOn>[] = [];

  beforeEach(() => {
    logs = [];
    spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        logs.push(args.map((a) => String(a)).join(' '));
      }),
    );
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = origKey;
  });

  it('not-configured path reports explicitly and logs nothing', async () => {
    delete process.env.RESEND_API_KEY;
    const res = await sendSupplierInviteEmail({ to: 'ops@example.com', vendorName: 'Demo', token: TOKEN });
    expect(res).toEqual({
      sent: false,
      reason: 'not_configured',
      message: expect.stringContaining('RESEND_API_KEY'),
    });
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs).toEqual([]);
  });

  it('a mocked Resend send carries the token only in the invite URL, never in a log', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    let body = '';
    globalThis.fetch = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      body = String(init?.body ?? '');
      return { ok: true, json: async () => ({ id: 'msg-1' }) } as Response;
    }) as unknown as typeof fetch;
    const res = await sendSupplierInviteEmail({ to: 'ops@example.com', vendorName: 'Demo', token: TOKEN });
    expect(res.sent).toBe(true);
    // The token belongs ONLY in the /supplier/invite/{token} URL in the body.
    expect(body).toContain(`/supplier/invite/${TOKEN}`);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs).toEqual([]);
  });

  it('a failed send reports the status, not the token', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 401 }) as Response) as unknown as typeof fetch;
    const res = await sendSupplierInviteEmail({ to: 'ops@example.com', vendorName: 'Demo', token: TOKEN });
    expect(res).toEqual({ sent: false, reason: 'send_failed', message: expect.stringContaining('401') });
    if (!res.sent) expect(res.message).not.toContain(TOKEN);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });
});
