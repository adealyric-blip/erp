import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Next 16 route guard (was middleware.ts). Coarse routing only — the real
// checks happen in requireStaff / requireSupplier:
// - unauthenticated          -> /login (except /supplier/invite/*, which is
//   the token-acceptance page and must work before sign-in)
// - /studio/*, /craft/*      -> require aal2, else /mfa
// - /api/*                   -> 401 JSON when unauthenticated (never a
//   redirect to an HTML login page)
// - /supplier/*              -> any signed-in user may reach the page; the
//   page itself calls requireSupplier() and returns 404 for non-members.
export const config = {
  matcher: ['/studio/:path*', '/supplier/:path*', '/craft/:path*', '/api/:path*'],
};

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const p = req.nextUrl.pathname;

  // Fail closed when auth isn't configured — guarded routes are unusable.
  if (!url || !anon) {
    return p.startsWith('/api/')
      ? NextResponse.json({ error: 'auth not configured' }, { status: 500 })
      : redirectToLogin(req);
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (p.startsWith('/supplier/invite')) return res;
    if (p.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    return redirectToLogin(req);
  }

  if (p.startsWith('/studio') || p.startsWith('/craft')) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/mfa', req.url));
    }
  }

  return res;
}
