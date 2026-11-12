'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createBrowserSupabaseClient } from '@/server/supabase/browser';

/**
 * MFA enrollment / verification (TOTP). Reached from the proxy and
 * requireStaff when a signed-in staff user is still at aal1.
 * Two modes, both in one page:
 * - enroll: no verified TOTP factor yet — enroll, scan the QR (or type the
 *   secret), enter a code to confirm. After a successful verify the
 *   session reaches aal2 and the user is sent to /studio.
 * - verify: a verified factor already exists (new browser) — challenge it.
 */
export default function MfaPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'enroll' | 'verify' | 'done'>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') {
        router.push('/studio');
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp.find((f) => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setPhase('verify');
      } else {
        setPhase('enroll');
      }
    }
    void init();
  }, [router]);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Unsaid TOTP',
    });
    if (err || !data) {
      setError(err?.message ?? 'Could not start enrollment.');
      setBusy(false);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setBusy(false);
  }

  async function verifyEnrolled(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (cErr || !challenge) {
      setError(cErr?.message ?? 'Could not start a challenge.');
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (vErr) {
      setError(vErr.message);
      setBusy(false);
      return;
    }
    setPhase('done');
    router.push('/studio');
    router.refresh();
  }

  async function startVerifyChallenge() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { data: challenge, error: err } = await supabase.auth.mfa.challenge({ factorId });
    if (err || !challenge) {
      setError(err?.message ?? 'Could not start a challenge.');
      setBusy(false);
      return;
    }
    setChallengeId(challenge.id);
    setBusy(false);
  }

  async function verifyExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.trim(),
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    router.push('/studio');
    router.refresh();
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p>Checking your sign-in…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-bold">Two-factor authentication</h1>
        <p className="mt-2 text-neutral-600">
          The studio requires a second factor. Use an authenticator app (TOTP).
        </p>
      </div>

      {phase === 'enroll' && !qrCode ? (
        <section className="flex flex-col gap-3 rounded-lg border p-5">
          <p className="text-sm">
            You have not set up MFA yet. Enroll your authenticator app now.
          </p>
          <Button onClick={startEnroll} disabled={busy}>
            Set up authenticator app
          </Button>
        </section>
      ) : null}

      {phase === 'enroll' && qrCode ? (
        <section className="flex flex-col gap-3 rounded-lg border p-5">
          <p className="text-sm">Scan this QR code in your authenticator app:</p>
          <img src={qrCode} alt="TOTP QR code" className="mx-auto h-48 w-48" />
          <p className="text-sm">
            Or enter this secret manually:{' '}
            <code data-testid="totp-secret" className="break-all rounded bg-neutral-100 px-1">
              {secret}
            </code>
          </p>
          <form onSubmit={verifyEnrolled} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              6-digit code from your app
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
              Verify and continue to the studio
            </Button>
          </form>
        </section>
      ) : null}

      {phase === 'verify' && !challengeId ? (
        <section className="flex flex-col gap-3 rounded-lg border p-5">
          <p className="text-sm">
            Your authenticator app is enrolled. Start a verification to continue.
          </p>
          <Button onClick={startVerifyChallenge} disabled={busy}>
            Verify with authenticator app
          </Button>
        </section>
      ) : null}

      {phase === 'verify' && challengeId ? (
        <section className="flex flex-col gap-3 rounded-lg border p-5">
          <form onSubmit={verifyExisting} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              6-digit code from your app
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
              Verify and continue to the studio
            </Button>
          </form>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
