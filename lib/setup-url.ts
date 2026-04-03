import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

/** Safe internal URL for the setup flow with optional return path after completion. */
export function buildSetupUrl(returnTo?: string | null): string {
  const next = parseSafeRedirectPath(returnTo ?? "") ?? "/dashboard";
  return `/setup?next=${encodeURIComponent(next)}`;
}
