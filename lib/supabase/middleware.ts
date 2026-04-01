import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { authCallTimeoutMs, withTimeout } from "@/lib/with-timeout";

/**
 * Next.js middleware = Supabase "Proxy": refresh session via getClaims() and apply
 * Set-Cookie + cache headers (required by @supabase/ssr 0.10+).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return response;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[], responseHeaders: Record<string, string>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
          Object.entries(responseHeaders).forEach(([h, v]) => {
            response.headers.set(h, v);
          });
        }
      }
    });

    const authResult = await withTimeout(supabase.auth.getClaims(), authCallTimeoutMs());
    if (authResult.timedOut) {
      runfolioLog.warn("middleware.supabase.getClaims", "timed out — continuing without session refresh", {
        path: request.nextUrl.pathname,
        timeoutMs: authCallTimeoutMs()
      });
    }
  } catch (err) {
    let host = "unknown";
    try {
      host = new URL(url).host;
    } catch {
      /* invalid URL */
    }
    runfolioLog.error("middleware.supabase.getClaims", err, {
      supabaseHost: host,
      path: request.nextUrl.pathname
    });
    runfolioLog.warn(
      "middleware.supabase",
      "Session refresh failed — request continues. Check URL, publishable/anon key, and Supabase project status."
    );
  }

  return response;
}
