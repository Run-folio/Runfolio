"use server";

import { revalidatePath } from "next/cache";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { getDiscoverRaceDetail, isDiscoverCatalogRaceId } from "@/lib/discover-race-details";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { getRaceByStravaActivityId } from "@/lib/get-race-by-strava-activity";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";
import { fetchStravaActivity } from "@/lib/strava-api";
import { getValidStravaAccessToken } from "@/lib/strava-access-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Race } from "@/types";
import { revalidatePortfolioSurfaces } from "@/lib/revalidate-portfolio-paths";

export async function signUpAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  try {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) return { error: error.message };

    if (data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        email: data.user.email,
        name
      });
    }
    redirect("/dashboard");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signUp", e);
    return { error: e instanceof Error ? e.message : "Sign up failed unexpectedly." };
  }
}

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  try {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    redirect("/dashboard");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signIn", e);
    return { error: e instanceof Error ? e.message : "Sign in failed unexpectedly." };
  }
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) redirect("/");
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signOut", e);
    redirect("/auth/login");
  }
}

export async function createRaceAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) redirect("/auth/login");
    const supabase = await createClient();

    const isCompleted = formData.get("is_completed") === "on";
    const payload = {
      user_id: user.id,
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      date: String(formData.get("date") ?? ""),
      distance_km: Number(formData.get("distance_km") ?? 0),
      elevation_m: Number(formData.get("elevation_m") ?? 0),
      time: String(formData.get("time") ?? ""),
      description: String(formData.get("description") ?? ""),
      is_completed: isCompleted,
      /** Future goals and normal adds count toward bucket list UI; Strava-only rows use confirm flow. */
      is_bucket_list_item: true
    };

    const { error } = await supabase.from("races").insert(payload);
    if (error) return { error: error.message };

    await revalidatePortfolioSurfaces(supabase, user.id, {});
    revalidatePath("/dashboard");
    revalidatePath("/bucket-list");
    redirect("/dashboard");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.createRace", e);
    return { error: e instanceof Error ? e.message : "Could not save race." };
  }
}

function mergeRacePortfolioFromOrphan(
  base: Record<string, unknown>,
  orphan: Race | null
): Record<string, unknown> {
  if (!orphan) return base;
  const out = { ...base };
  const strFields = [
    "description",
    "race_subtitle",
    "reflection_toughest",
    "reflection_learned",
    "reflection_mattered",
    "finish_notes"
  ] as const;
  for (const k of strFields) {
    const cur = out[k];
    const o = orphan[k];
    if (typeof cur === "string" && cur.trim()) continue;
    if (o != null && String(o).trim()) out[k] = o;
  }
  const bManual = Array.isArray(base.manual_photo_urls)
    ? (base.manual_photo_urls as string[])
    : [];
  const oManual = Array.isArray(orphan.manual_photo_urls) ? orphan.manual_photo_urls : [];
  const mergedPhotos = [...new Set([...bManual, ...oManual].filter(Boolean))];
  if (mergedPhotos.length > 0) out.manual_photo_urls = mergedPhotos;
  return out;
}

async function revalidateRaceMatchSurfaces(
  supabase: SupabaseClient,
  userId: string,
  discoverRaceId: string,
  stravaActivityId: string,
  returnTo: string
) {
  await revalidatePortfolioSurfaces(supabase, userId, {
    discoverRaceId,
    stravaActivityId,
    alsoPaths: [returnTo]
  });
}

/**
 * Confirmed Strava ↔ catalog match: single durable row per (user, strava_activity_id).
 * Bucket completion only updates an existing bucket row; never silently adds bucket completion for races not on the list.
 */
export async function confirmKnownRaceMatchAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/dashboard");
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) redirect("/auth/login");
    const supabase = await createClient();

    const discoverRaceId = String(formData.get("discover_race_id") ?? "").trim();
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    const targetUserRaceId = String(formData.get("target_user_race_id") ?? "").trim() || null;

    const date = String(formData.get("date") ?? "").trim();
    const distanceKm = Number(formData.get("distance_km") ?? 0);
    const elevationM = Number(formData.get("elevation_m") ?? 0);
    const time = String(formData.get("time") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    let description = String(formData.get("description") ?? "").trim();

    if (!discoverRaceId || !stravaActivityId) {
      return { error: "Missing race or activity reference." };
    }

    const discover = getDiscoverRaceById(discoverRaceId);
    if (!discover) {
      return { error: "Unknown catalog race." };
    }

    if (!description) {
      const access = await getValidStravaAccessToken();
      if (access) {
        try {
          const detail = await fetchStravaActivity(stravaActivityId, access);
          const d = detail.description?.trim();
          if (d) description = d;
        } catch {
          /* Strava detail optional */
        }
      }
    }

    const basePayload = {
      name: discover.name,
      location: location || discover.location,
      date: date || null,
      distance_km: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : discover.distance_km,
      elevation_m: Number.isFinite(elevationM) && elevationM > 0 ? elevationM : null,
      time: time || null,
      description: description || null,
      is_completed: true,
      strava_activity_id: stravaActivityId,
      discover_race_id: discoverRaceId
    };

    const { data: existingStravaRow } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();

    const returnToRaw = String(formData.get("return_to") ?? "").trim();
    const returnTo =
      returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") && !returnToRaw.includes("://")
        ? returnToRaw
        : "/dashboard";

    const wantsBucketComplete = Boolean(targetUserRaceId);

    if (wantsBucketComplete && targetUserRaceId) {
      const { data: bucketRow, error: selErr } = await supabase
        .from("races")
        .select("id, user_id")
        .eq("id", targetUserRaceId)
        .single();
      if (selErr || !bucketRow || bucketRow.user_id !== user.id) {
        return { error: "Could not update that bucket list item." };
      }

      let updatePayload: Record<string, unknown> = {
        ...basePayload,
        is_bucket_list_item: true
      };

      if (existingStravaRow && existingStravaRow.id !== targetUserRaceId) {
        updatePayload = mergeRacePortfolioFromOrphan(updatePayload, existingStravaRow as Race);
        const { error: delErr } = await supabase.from("races").delete().eq("id", existingStravaRow.id);
        if (delErr) return { error: delErr.message };
      }

      const { error: upErr } = await supabase.from("races").update(updatePayload).eq("id", targetUserRaceId);
      if (upErr) return { error: upErr.message };
    } else if (existingStravaRow) {
      const { error: upErr } = await supabase
        .from("races")
        .update({
          ...basePayload,
          is_bucket_list_item: false
        })
        .eq("id", existingStravaRow.id);
      if (upErr) return { error: upErr.message };
    } else {
      const { error: insErr } = await supabase.from("races").insert({
        ...basePayload,
        user_id: user.id,
        is_bucket_list_item: false
      });
      if (insErr) return { error: insErr.message };
    }

    await revalidateRaceMatchSurfaces(supabase, user.id, discoverRaceId, stravaActivityId, returnTo);
    redirect(returnTo);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.confirmKnownRaceMatch", e);
    return { error: e instanceof Error ? e.message : "Could not confirm race match." };
  }
}

function parseManualPhotoUrlsBlock(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [...new Set(lines.filter((s) => /^https?:\/\//i.test(s)))];
}

function numFromForm(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create or update the portfolio row for a Strava activity (story, reflections, tags, manual photos).
 * Does not redirect — client should `router.refresh()`.
 */
export async function upsertActivityPortfolioAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to save your portfolio." };
  }
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) redirect("/auth/login");
    const supabase = await createClient();

    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing Strava activity id." };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Title is required." };

    const existing = await getRaceByStravaActivityId(stravaActivityId, user.id);

    const discoverRaceId = String(formData.get("discover_race_id") ?? "").trim() || null;

    const payload = {
      name,
      race_subtitle: String(formData.get("race_subtitle") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      reflection_toughest: String(formData.get("reflection_toughest") ?? "").trim() || null,
      reflection_learned: String(formData.get("reflection_learned") ?? "").trim() || null,
      reflection_mattered: String(formData.get("reflection_mattered") ?? "").trim() || null,
      finish_notes: String(formData.get("finish_notes") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      date: String(formData.get("date") ?? "").trim() || null,
      distance_km: numFromForm(formData, "distance_km"),
      elevation_m: numFromForm(formData, "elevation_m"),
      time: String(formData.get("time") ?? "").trim() || null,
      discover_race_id: discoverRaceId,
      tag_pb: formData.get("tag_pb") === "on",
      tag_career_highlight: formData.get("tag_career_highlight") === "on",
      tag_hardest: formData.get("tag_hardest") === "on",
      tag_bucket_list_done: formData.get("tag_bucket_list_done") === "on",
      manual_photo_urls: parseManualPhotoUrlsBlock(String(formData.get("manual_photo_urls") ?? ""))
    };

    if (existing) {
      const { error: upErr } = await supabase.from("races").update(payload).eq("id", existing.id);
      if (upErr) return { error: upErr.message };
    } else {
      const insertRow = {
        ...payload,
        user_id: user.id,
        strava_activity_id: stravaActivityId,
        is_completed: true,
        is_bucket_list_item: false
      };
      const { error: insErr } = await supabase.from("races").insert(insertRow);
      if (insErr) return { error: insErr.message };
    }

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId,
      stravaActivityId
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.upsertActivityPortfolio", e);
    return { error: e instanceof Error ? e.message : "Could not save portfolio." };
  }
}

async function requireOwnedRace(
  supabase: SupabaseClient,
  userId: string,
  raceId: string
): Promise<Race | null> {
  const { data, error } = await supabase
    .from("races")
    .select("*")
    .eq("id", raceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Race;
}

/** Deletes a portfolio row entirely (wrong match, duplicate, or mistaken goal). */
export async function deleteUserRacePortfolioAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Connect Supabase to manage races." };
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) return { error: "Sign in required." };
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const supabase = await createClient();
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };

    const { error: delErr } = await supabase.from("races").delete().eq("id", raceId).eq("user_id", user.id);
    if (delErr) return { error: delErr.message };

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.deleteUserRacePortfolio", e);
    return { error: e instanceof Error ? e.message : "Could not delete race." };
  }
}

/**
 * Clears completed state while keeping the catalog link (future bucket goal / re-match).
 * Does not delete the row.
 */
export async function markRaceNotCompletedPortfolioAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Connect Supabase to manage races." };
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) return { error: "Sign in required." };
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const supabase = await createClient();
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };

    const { error: upErr } = await supabase
      .from("races")
      .update({
        is_completed: false,
        strava_activity_id: null,
        is_bucket_list_item: true
      })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (upErr) return { error: upErr.message };

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.markRaceNotCompletedPortfolio", e);
    return { error: e instanceof Error ? e.message : "Could not update race." };
  }
}

/** Completed row: stop treating as bucket-list item (finish still counts in portfolio). */
export async function clearBucketListAffiliationAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Connect Supabase to manage races." };
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) return { error: "Sign in required." };
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const supabase = await createClient();
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (!row.is_completed) return { error: "Only completed races use this action." };

    const { error: upErr } = await supabase
      .from("races")
      .update({ is_bucket_list_item: false })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (upErr) return { error: upErr.message };

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.clearBucketListAffiliation", e);
    return { error: e instanceof Error ? e.message : "Could not update race." };
  }
}

/** Removes an incomplete future bucket goal row (catalog-linked). */
export async function deleteFutureBucketGoalAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Connect Supabase to manage races." };
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) return { error: "Sign in required." };
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const supabase = await createClient();
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (row.is_completed) return { error: "Use other actions for completed races." };

    const { error: delErr } = await supabase.from("races").delete().eq("id", raceId).eq("user_id", user.id);
    if (delErr) return { error: delErr.message };

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.deleteFutureBucketGoal", e);
    return { error: e instanceof Error ? e.message : "Could not remove goal." };
  }
}

/** Creates an incomplete catalog-linked row as a future bucket goal (no silent completion). */
export async function addCatalogRaceToBucketListAction(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Connect Supabase to save." };
  try {
    const { user, authError } = await getServerAuthUser();
    if (authError || !user) return { error: "Sign in required." };
    const discoverId = String(formData.get("discover_race_id") ?? "").trim();
    if (!discoverId || !isDiscoverCatalogRaceId(discoverId)) return { error: "Invalid race." };
    const detail = getDiscoverRaceDetail(discoverId);
    if (!detail) return { error: "Unknown race." };
    const supabase = await createClient();

    const { data: openRows } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", user.id)
      .eq("discover_race_id", discoverId)
      .eq("is_completed", false);
    const incomplete = (openRows as Race[] | null) ?? [];
    if (incomplete.some((r) => raceIsBucketListFutureGoal(r))) {
      return { ok: true as const, already: true as const };
    }

    const { error: insErr } = await supabase.from("races").insert({
      user_id: user.id,
      name: detail.displayTitle,
      location: detail.location,
      date: null,
      distance_km: detail.distanceKm,
      elevation_m: null,
      time: null,
      description: null,
      is_completed: false,
      is_bucket_list_item: true,
      discover_race_id: discoverId
    });
    if (insErr) return { error: insErr.message };

    await revalidatePortfolioSurfaces(supabase, user.id, { discoverRaceId: discoverId });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.addCatalogRaceToBucketList", e);
    return { error: e instanceof Error ? e.message : "Could not add goal." };
  }
}
