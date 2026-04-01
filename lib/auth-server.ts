import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";
import { authCallTimeoutMs, withTimeout } from "@/lib/with-timeout";

export type ServerAuthUser = {
  user: User | null;
  /** Supabase Auth error message, if the round-trip failed */
  authError: string | null;
};

/**
 * One Supabase session read per request (via getSession). Shared by page + AppNavbar.
 * Uses getSession instead of getUser so we do not block on Auth /user on every navigation.
 */
export const getServerAuthUser = cache(async (): Promise<ServerAuthUser> => {
  if (!isSupabaseConfigured()) {
    return { user: null, authError: null };
  }
  try {
    const supabase = await createClient();
    const raced = await withTimeout(supabase.auth.getSession(), authCallTimeoutMs());
    if (raced.timedOut) {
      runfolioLog.warn("getServerAuthUser", "Supabase getSession() timed out — treating as signed out for this request", {
        timeoutMs: authCallTimeoutMs()
      });
      return { user: null, authError: null };
    }
    const {
      data: { session },
      error
    } = raced.value;
    if (error) {
      return { user: null, authError: error.message };
    }
    const user = session?.user ?? null;
    return { user, authError: null };
  } catch (err) {
    if (isDynamicServerError(err)) throw err;
    runfolioLog.error("getServerAuthUser", err);
    return {
      user: null,
      authError: err instanceof Error ? err.message : "unknown"
    };
  }
});
