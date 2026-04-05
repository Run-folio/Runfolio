import { OVERVIEW_PATH } from "@/lib/app-paths";
import type { PersistenceReadiness, PersistenceReadinessStatus } from "@/lib/persistence-readiness";
import { getEnvPersistenceFailure } from "@/lib/persistence-readiness";
import { isOfflineDemoMode } from "@/lib/demo-mode";

export type OnboardingStage =
  | "env"
  | "sign_in"
  | "backend_or_session"
  | "profile_record"
  | "connect_strava"
  | "sync_activities"
  | "match_handoff";

export type OnboardingStepVisual = {
  id: string;
  label: string;
  /** Step is satisfied for the current user/session */
  done: boolean;
  /** Primary focus in the stepper */
  active: boolean;
  /** Server does not offer this path (e.g. Strava OAuth off) — show as skipped, not blocking */
  skipped?: boolean;
};

export type OnboardingProgress = {
  stage: OnboardingStage;
  persistenceStatus: PersistenceReadinessStatus;
  /** Issue hint for copy (not shown to user as raw enum) */
  persistenceIssue: "none" | "env" | "demo" | "session" | "db_read" | "profile_row";
  stravaOAuthConfigured: boolean;
  stravaConnected: boolean;
  syncedActivityCount: number;
  steps: OnboardingStepVisual[];
  /** One primary action for the current stage */
  primaryCta: { href: string; label: string } | null;
  /** Secondary escape hatch (e.g. manual add race) */
  secondaryCta: { href: string; label: string } | null;
};

type BuildInput = {
  persistence: PersistenceReadiness;
  stravaOAuthConfigured: boolean;
  stravaConnected: boolean;
  syncedActivityCount: number;
  /** Return path after login / when continuing */
  safeNext: string;
};

function envIssue(): "env" | "demo" | "none" {
  if (isOfflineDemoMode()) return "demo";
  const env = getEnvPersistenceFailure();
  if (!env) return "none";
  return "env";
}

function persistenceIssue(p: PersistenceReadiness): OnboardingProgress["persistenceIssue"] {
  const e = envIssue();
  if (e === "env") return "env";
  if (e === "demo") return "demo";
  if (p.status === "backend_unavailable") return p.userId ? "db_read" : "session";
  if (p.status === "misconfigured") return p.userId ? "profile_row" : "env";
  return "none";
}

export function buildOnboardingProgress(input: BuildInput): OnboardingProgress {
  const { persistence: p, stravaOAuthConfigured, stravaConnected, syncedActivityCount, safeNext } = input;
  const issue = persistenceIssue(p);

  const loginNext = `/setup?next=${encodeURIComponent(safeNext)}`;

  let stage: OnboardingStage = "match_handoff";
  if (issue === "env" || issue === "demo") stage = "env";
  else if (p.status === "auth_required") stage = "sign_in";
  else if (p.status === "backend_unavailable") stage = "backend_or_session";
  else if (p.status === "misconfigured") stage = "profile_record";
  else if (p.status === "ready") {
    if (stravaOAuthConfigured && !stravaConnected) stage = "connect_strava";
    else if (stravaOAuthConfigured && stravaConnected && syncedActivityCount === 0) stage = "sync_activities";
    else stage = "match_handoff";
  }

  const stepBase: Omit<OnboardingStepVisual, "done" | "active">[] = [
    { id: "env", label: "App ready" },
    { id: "account", label: "Account" },
    { id: "save", label: "Cloud save" },
    { id: "strava", label: "Strava" },
    { id: "sync", label: "Import" },
    { id: "match", label: "Match" }
  ];

  let activeIdx = 0;
  if (stage === "env") activeIdx = 0;
  else if (stage === "sign_in") activeIdx = 1;
  else if (stage === "backend_or_session" || stage === "profile_record") activeIdx = 2;
  else if (stage === "connect_strava") activeIdx = 3;
  else if (stage === "sync_activities") activeIdx = 4;
  else activeIdx = 5;

  const skipStrava = p.status === "ready" && !stravaOAuthConfigured;

  const steps: OnboardingStepVisual[] = stepBase.map((s, i) => {
    const skipped = skipStrava && (i === 3 || i === 4);
    const done = skipped || i < activeIdx;
    return {
      ...s,
      done,
      skipped,
      active: i === activeIdx && !skipped
    };
  });

  let primaryCta: OnboardingProgress["primaryCta"] = null;
  let secondaryCta: OnboardingProgress["secondaryCta"] = { href: "/races/new", label: "Add a race manually" };

  switch (stage) {
    case "env":
      primaryCta = { href: OVERVIEW_PATH, label: "Overview" };
      secondaryCta = { href: "https://supabase.com/dashboard", label: "Open Supabase" };
      break;
    case "sign_in":
      primaryCta = { href: `/auth/login?next=${encodeURIComponent(loginNext)}`, label: "Sign in" };
      secondaryCta = { href: "/races/new", label: "Add a race manually" };
      break;
    case "backend_or_session":
      primaryCta = { href: `/auth/login?next=${encodeURIComponent(loginNext)}`, label: "Sign in again" };
      secondaryCta = { href: safeNext, label: "Try again later" };
      break;
    case "profile_record":
      primaryCta = { href: `/auth/login?next=${encodeURIComponent(loginNext)}`, label: "Sign in again" };
      secondaryCta = { href: OVERVIEW_PATH, label: "Overview" };
      break;
    case "connect_strava":
      primaryCta = {
        href: `/api/strava/oauth/start?next=${encodeURIComponent(loginNext)}`,
        label: "Connect Strava"
      };
      secondaryCta = { href: "/races/new", label: "Skip — add manually" };
      break;
    case "sync_activities":
      primaryCta = null; // client Sync button
      secondaryCta = { href: "/my-races", label: "Open My Races" };
      break;
    case "match_handoff":
      primaryCta = { href: "/my-races", label: "Open My Races" };
      secondaryCta =
        safeNext && safeNext !== "/setup" && safeNext !== OVERVIEW_PATH
          ? { href: safeNext, label: "Back where I was" }
          : { href: OVERVIEW_PATH, label: "Overview" };
      break;
    default:
      break;
  }

  return {
    stage,
    persistenceStatus: p.status,
    persistenceIssue: issue,
    stravaOAuthConfigured,
    stravaConnected,
    syncedActivityCount,
    steps,
    primaryCta,
    secondaryCta
  };
}
