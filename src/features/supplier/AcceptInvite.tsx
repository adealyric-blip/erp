'use client';

import { useState } from 'react';
import { acceptInvite } from '@/server/actions/supplier-portal';

// Invite acceptance — T18. The token lands on the correct design because
// supplier_accept_invite resolves the token to its member row (vendor +
// email) server-side; the client never picks a vendor. The token is
// single-use (expire-on-success: the RPC nulls the stored hash).

export default function AcceptInvite({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    setState('busy');
    setMessage(null);
    const res = await acceptInvite(token);
    if (!res.ok) {
      setState('error');
      setMessage(res.error.message);
      return;
    }
    setState('done');
  }

  if (state === 'done') {
    return (
      <div data-testid="invite-accepted" className="rounded-md border border-green-300 bg-green-50 px-4 py-3">
        <p className="font-medium text-green-800">Invite accepted — you are now linked to your vendor account.</p>
        <p className="mt-2 text-sm">
          <a href="/supplier" className="text-blue-700 underline">
            Open your RFQs
          </a>
        </p>
      </div>
    );
  }

  return (
    <div data-testid="invite-accept">
      <p className="text-sm text-neutral-600">
        This invite links your signed-in account to a vendor. You must be signed in with the exact email the
        invite was sent to.
      </p>
      {state === 'error' && message && <p className="mt-3 text-sm text-red-700">{message}</p>}
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={() => void accept()}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {state === 'busy' ? 'Accepting…' : 'Accept invite'}
      </button>
    </div>
  );
}
