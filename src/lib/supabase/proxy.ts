import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  // Public auth pages do not need an existing session. Skipping the refresh here
  // also prevents a stale refresh-token cookie from delaying a new sign-in.
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup') {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const sessionOnly = request.cookies.get('dream-remember-login')?.value === '0';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const effectiveOptions = sessionOnly ? { ...options, expires: undefined, maxAge: undefined } : options;
            response.cookies.set(name, value, effectiveOptions);
          });
          Object.entries(headersToSet).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
