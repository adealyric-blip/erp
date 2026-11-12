'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createBrowserSupabaseClient } from '@/server/supabase/browser';

/**
 * Login. Two doors, per plan/01 identity model:
 * - Staff: Google OAuth (redirects through /auth/callback).
 * - Suppliers: email OTP / magic link to the invited address only.
 * After the OTP is sent, the same form accepts the 6-digit code.
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/studio';
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (err) setError(err.message);
    else setSent(true);
    setBusy(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl font-bold">Sign in to Unsaid</h1>
        <p className="mt-2 text-neutral-600">
          Staff sign in with Google. Suppliers sign in with a code sent to their invited email.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="font-semibold">Staff</h2>
        <Button onClick={signInWithGoogle} disabled={busy}>
          Continue with Google
        </Button>
        <p className="text-xs text-neutral-500">
          After Google sign-in you will be asked to set up MFA (TOTP) before the studio opens.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="font-semibold">Suppliers</h2>
        {!sent ? (
          <form onSubmit={sendOtp} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Invited email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@factory.example"
                className="rounded-md border px-3 py-2"
              />
            </label>
            <Button type="submit" disabled={busy}>
              Email me a sign-in code
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="flex flex-col gap-3">
            <p className="text-sm text-neutral-600">
              A 6-digit code was sent to {email}. It expires in 1 hour.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Code
              <input
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="rounded-md border px-3 py-2 tracking-widest"
              />
            </label>
            <Button type="submit" disabled={busy}>
              Verify and sign in
            </Button>
            <button
              type="button"
              className="text-sm text-neutral-500 underline"
              onClick={() => {
                setSent(false);
                setCode('');
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </section>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
