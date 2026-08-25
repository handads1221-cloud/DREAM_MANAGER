import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const sessionOnly = cookieStore.get('dream-remember-login')?.value === '0';

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const effectiveOptions = sessionOnly ? { ...options, expires: undefined, maxAge: undefined } : options;
              cookieStore.set(name, value, effectiveOptions);
            });
            Object.entries(headersToSet).forEach(() => undefined);
          } catch {
            // Server Components cannot write cookies. proxy.ts refreshes sessions.
          }
        },
      },
    },
  );
}
