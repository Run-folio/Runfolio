import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { createClient } from "@/lib/supabase/server";
import { getServerAuthUser, getServerAuthUserForWrite } from "@/lib/auth-server";
import { isOfflineDemoMode, isSupabaseConfigured } from "@/lib/demo-mode";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { runfolioLog } from "@/lib/runfolio-log";

export type PersistenceReadinessStatus =
  | "ready"
  | "auth_required"
  | "backend_unavailable"
  | "misconfigured";

export type PersistenceReadiness = {
  status: PersistenceReadinessStatus;
  userId: string | null;
  /** Full explanation for banners and blocking messages */
  message: string;
  /** Shorter line for buttons / inline hints */
  shortMessage: string;
  ctaHref: string | null;
  ctaLabel: string | null;
};

/** Client provider value: derived once per request from `getServerPersistenceReadiness()`. */
export type PersistenceSnapshot = {
  status: PersistenceReadinessStatus;
  canPersist: boolean;
  /** Same as `canPersist` — kept for existing call sites */
  persistenceAvailable: boolean;
  userId: string | null;
  message: string;
  shortMessage: string;
  ctaHref: string | null;
  ctaLabel: string | null;
  offlineDemo: boolean;
  missingSupabaseEnv: boolean;
  /** When saves are blocked, human-readable explanation */
  reason: string | null;
};

const COPY = {
  misconfiguredEnv:
    "Supabase isn’t configured: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) to .env.local, apply migrations, and restart.",
  demoMode:
    "Offline demo mode (RUNFOLIO_OFFLINE_DEMO) is on — nothing is saved to a live database. Turn it off to use real persistence.",
  authRequired:
    "Sign in to save bucket goals, confirm race matches, sync Strava, and update your profile.",
  genericSaveOff: "Saving isn’t available in this state."
} as const;

/**
 * Env + demo only (synchronous). Use before auth for sign-in/up flows.
 * Returns null when live Supabase is expected to be usable.
 */
export function getEnvPersistenceFailure(): PersistenceReadiness | null {
  const hasUrl = Boolean(getSupabaseUrl());
  const hasKey = Boolean(getSupabaseAnonKey());
  if (!hasUrl || !hasKey) {
    return {
      status: "misconfigured",
      userId: null,
      message: COPY.misconfiguredEnv,
      shortMessage: "Database isn’t configured.",
      ctaHref: "/setup",
      ctaLabel: "Setup guide"
    };
  }
  if (isOfflineDemoMode()) {
    return {
      status: "backend_unavailable",
      userId: null,
      message: COPY.demoMode,
      shortMessage: "Demo mode — saves disabled.",
      ctaHref: "/setup",
      ctaLabel: "Learn more"
    };
  }
  return null;
}

function readinessFromEnv(): PersistenceReadiness | null {
  return getEnvPersistenceFailure();
}

export const getServerPersistenceReadiness = cache(async (): Promise<PersistenceReadiness> => {
  const envBlock = readinessFromEnv();
  if (envBlock) return envBlock;

  const { user, authError } = await getServerAuthUser();

  if (authError) {
    runfolioLog.warn("persistenceReadiness.session", authError);
    return {
      status: "backend_unavailable",
      userId: null,
      message: `We couldn’t verify your session (${authError}). Try signing in again.`,
      shortMessage: "Session check failed.",
      ctaHref: "/setup",
      ctaLabel: "Fix session"
    };
  }

  if (!user) {
    return {
      status: "auth_required",
      userId: null,
      message: COPY.authRequired,
      shortMessage: "Sign in to save.",
      ctaHref: "/setup",
      ctaLabel: "Get started"
    };
  }

  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
    if (error) {
      runfolioLog.warn("persistenceReadiness.usersRead", error.message, { code: error.code, userId: user.id });
      return {
        status: "backend_unavailable",
        userId: user.id,
        message: `Runfolio can’t read your profile from the database (${error.message}). Check Supabase status, RLS, and migrations.`,
        shortMessage: "Database unreachable.",
        ctaHref: "/setup",
        ctaLabel: "Retry setup"
      };
    }
    if (!row) {
      runfolioLog.warn("persistenceReadiness.missingUserRow", "no users row", { userId: user.id });
      return {
        status: "misconfigured",
        userId: user.id,
        message:
          "Your account has no `users` row yet. Sign out and sign in again after migrations, or complete signup from this app.",
        shortMessage: "Profile incomplete.",
        ctaHref: "/setup",
        ctaLabel: "Finish profile"
      };
    }
  } catch (err) {
    if (isDynamicServerError(err)) throw err;
    runfolioLog.error("persistenceReadiness.check", err);
    return {
      status: "backend_unavailable",
      userId: user.id,
      message: "Something went wrong while checking your account. Try again shortly.",
      shortMessage: "Setup check failed.",
      ctaHref: "/setup",
      ctaLabel: "Retry"
    };
  }

  return {
    status: "ready",
    userId: user.id,
    message: "",
    shortMessage: "",
    ctaHref: null,
    ctaLabel: null
  };
});

export type ActionPersistenceOk = { ok: true; user: User; supabase: SupabaseClient };
export type ActionPersistenceFail = { ok: false; error: string; code: PersistenceReadinessStatus };

/**
 * Server actions that write should call this first. Validates env, JWT (getUser), and `users` row.
 */
export async function requireActionPersistence(): Promise<ActionPersistenceOk | ActionPersistenceFail> {
  const envBlock = readinessFromEnv();
  if (envBlock) {
    runfolioLog.warn("actionPersistence.envBlock", envBlock.status, { short: envBlock.shortMessage });
    return { ok: false, error: envBlock.message, code: envBlock.status };
  }

  const { user, authError } = await getServerAuthUserForWrite();
  if (authError || !user) {
    runfolioLog.warn("actionPersistence.auth", authError ?? "anonymous", { okUser: Boolean(user) });
    return {
      ok: false,
      error: authError ? `Sign in required: ${authError}` : "Sign in required.",
      code: "auth_required"
    };
  }

  let supabase: SupabaseClient;
  try {
    supabase = await createClient();
  } catch (e) {
    runfolioLog.error("actionPersistence.createClient", e);
    return {
      ok: false,
      error: "Server couldn’t connect to Supabase. Check NEXT_PUBLIC_SUPABASE_* env vars.",
      code: "misconfigured"
    };
  }

  const { data: row, error } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (error) {
    runfolioLog.warn("actionPersistence.usersRead", error.message, { code: error.code, userId: user.id });
    return {
      ok: false,
      error: `Couldn’t verify your profile: ${error.message}`,
      code: "backend_unavailable"
    };
  }
  if (!row) {
    runfolioLog.warn("actionPersistence.missingUserRow", "no users row", { userId: user.id });
    return {
      ok: false,
      error:
        "Your Runfolio profile record is missing from the database. Sign out and sign in again, or apply migrations for the `users` table.",
      code: "misconfigured"
    };
  }

  return { ok: true, user, supabase };
}

/** For code paths that only need the boolean (e.g. guards). */
export function isPersistenceWritableSync(): boolean {
  return isSupabaseConfigured();
}

export function clientPersistenceFromReadiness(r: PersistenceReadiness): PersistenceSnapshot {
  const offlineDemo = isOfflineDemoMode();
  const missingSupabaseEnv = !getSupabaseUrl() || !getSupabaseAnonKey();
  const canPersist = r.status === "ready";
  return {
    status: r.status,
    canPersist,
    persistenceAvailable: canPersist,
    userId: r.userId,
    message: r.message,
    shortMessage: r.shortMessage,
    ctaHref: r.ctaHref,
    ctaLabel: r.ctaLabel,
    offlineDemo,
    missingSupabaseEnv,
    reason: canPersist ? null : (r.message || r.shortMessage || null)
  };
}
