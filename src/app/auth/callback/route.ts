import { NextResponse, type NextRequest } from 'next/server';
import { createUserClient } from '@/server/supabase/server';

/**
 * Auth callback: handles Google OAuth (`code`) and email OTP / magic-link
 * (`token_hash` + `type`). On success redirects to `?next=` (default
 * /studio — the proxy bounces aal1 staff to /mfa from there).
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next') ?? '/studio';
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  const supabase = await createUserClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email',
    });
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
  } else {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.redirect(new URL(next, req.url));
}
