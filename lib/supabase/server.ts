import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { cookies } from "next/headers";
import { runfolioLog } from "@/lib/runfolio-log";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    const err = new Error(
      "Supabase env missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)."
    );
    runfolioLog.error("supabase.createClient.config", err);
    throw err;
  }

  try {
    const cookieStore = await cookies();
    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], responseHeaders?: Record<string, string>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* Server Components often cannot mutate cookies; middleware (getClaims) already refreshed the session. */
          }
          void responseHeaders;
        }
      }
    });
  } catch (err) {
    if (isDynamicServerError(err)) throw err;
    runfolioLog.error("supabase.createClient", err, {
      hint: "cookies() or createServerClient init — common on misconfigured edge/runtime"
    });
    throw err;
  }
}
