import { redirect } from "next/navigation";
import { getServerPersistenceReadiness } from "@/lib/persistence-readiness";
import { buildSetupUrl } from "@/lib/setup-url";

/** When persistence must be `ready` for a route (e.g. Match & Import). */
export async function requirePersistenceReadyOrRedirect(returnTo: string): Promise<void> {
  const r = await getServerPersistenceReadiness();
  if (r.status !== "ready") {
    redirect(buildSetupUrl(returnTo));
  }
}
