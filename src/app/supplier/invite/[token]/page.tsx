import Link from 'next/link';
import { createUserClient } from '@/server/supabase/server';
import AcceptInvite from '@/features/supplier/AcceptInvite';

// Supplier invite acceptance — T18.
// The proxy lets this route through unauthenticated (the token is the
// proof of invitation, not a session). Sign-in happens first: the invite
// can only be accepted by the invited email address, and
// supplier_accept_invite enforces that server-side. The token is never
// stored or logged by us — it is passed straight to the RPC, which nulls
// the stored hash on success (expire-on-success, single-use).

export default async function SupplierInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main data-testid="supplier-invite" className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-3xl font-bold">Supplier invite</h1>
      {!user ? (
        <div className="mt-4 rounded-md border px-4 py-3">
          <p className="text-sm text-neutral-600">
            Sign in first with the email this invite was sent to. Your invite link will still work after
            sign-in.
          </p>
          <p className="mt-3 text-sm">
            <Link
              href={`/login?next=${encodeURIComponent(`/supplier/invite/${token}`)}`}
              className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white"
            >
              Sign in with email code
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-neutral-600">
            Signed in as {user.email}. Accepting links this account to the vendor on the invite.
          </p>
          <div className="mt-4">
            <AcceptInvite token={token} />
          </div>
        </div>
      )}
    </main>
  );
}
