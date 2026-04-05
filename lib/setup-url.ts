import { OVERVIEW_PATH } from "@/lib/app-paths";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

/** Safe internal URL for the setup flow with optional return path after completion. */
export function buildSetupUrl(returnTo?: string | null): string {
  const next = parseSafeRedirectPath(returnTo ?? "") ?? OVERVIEW_PATH;
  return `/setup?next=${encodeURIComponent(next)}`;
}
