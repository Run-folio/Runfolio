"use server";

import { revalidatePath } from "next/cache";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { requireActionPersistence } from "@/lib/persistence-readiness";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runfolioLog } from "@/lib/runfolio-log";

export type DisconnectStravaResult = { ok: true } | { ok: false; error: string };

/**
 * Remove Strava tokens for the signed-in user and clear Strava fields on `public.users`.
 * Does not delete synced activities (user can reconnect and re-sync).
 */
export async function disconnectStravaAction(): Promise<DisconnectStravaResult> {
  try {
    const persist = await requireActionPersistence();
    if (!persist.ok) {
      return { ok: false, error: persist.error };
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return { ok: false, error: "Server configuration error." };
    }

    const uid = persist.user.id;

    const { error: delErr } = await admin.from("strava_user_credentials").delete().eq("user_id", uid);
    if (delErr) {
      runfolioLog.error("strava.disconnect", delErr);
      return { ok: false, error: delErr.message };
    }

    const { error: updErr } = await admin
      .from("users")
      .update({ strava_athlete_id: null, strava_profile_url: null })
      .eq("id", uid);
    if (updErr) {
      runfolioLog.warn("strava.disconnect.users", updErr.message);
    }

    revalidatePath("/settings");
    revalidatePath("/my-races");
    revalidatePath(OVERVIEW_PATH);
    return { ok: true };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("strava.disconnect.unhandled", e);
    return { ok: false, error: "Something went wrong." };
  }
}
