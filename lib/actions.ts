"use server";

import { revalidatePath } from "next/cache";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { raceIsBucketListFutureGoal } from "@/lib/bucket-list-model";
import { getDiscoverRaceDetail, isDiscoverCatalogRaceId } from "@/lib/discover-race-details";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { getRaceByStravaActivityId } from "@/lib/get-race-by-strava-activity";
import { ensurePublicUserRow } from "@/lib/ensure-public-user-row";
import { clarifySupabaseError, logSupabaseSchemaIssue } from "@/lib/supabase-user-error";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { getEnvPersistenceFailure, requireActionPersistence } from "@/lib/persistence-readiness";
import { createClient } from "@/lib/supabase/server";
import { runfolioLog } from "@/lib/runfolio-log";
import { fetchStravaActivity, formatStravaMovingTime } from "@/lib/strava-api";
import { dismissCanonicalMatchSuggestion } from "@/lib/strava-sync/repository";
import { syncStravaActivitiesForUserId } from "@/lib/strava-sync/sync-service";
import { getValidStravaAccessToken } from "@/lib/strava-access-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfirmedPortfolioCompletion } from "@/lib/portfolio-race";
import type { Race } from "@/types";
import { resolveDefaultProfilePathForUser } from "@/lib/profile-path-server";
import { withRaceLinkedCelebration } from "@/lib/profile-race-linked-celebration";
import { revalidatePortfolioSurfaces } from "@/lib/revalidate-portfolio-paths";

function dbErr(e: { message: string; code?: string; details?: string; hint?: string }): string {
  logSupabaseSchemaIssue("actions.db", e);
  return clarifySupabaseError(e);
}

/** After a Strava↔race confirm, send runners to their profile by default (not a dead-end dashboard). */
async function resolveConfirmRedirectDestination(
  supabase: SupabaseClient,
  userId: string,
  returnToRaw: string,
  /** When `return_to` is omitted, use this (e.g. `/bucket-list` for bucket-only flows). */
  fallbackPath?: string
): Promise<string> {
  const trimmed = returnToRaw.trim();
  const parsed =
    trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("://") ? trimmed : null;
  if (!parsed) {
    const p =
      fallbackPath && fallbackPath !== "/dashboard"
        ? fallbackPath
        : await resolveDefaultProfilePathForUser(supabase, userId);
    runfolioLog.info("actions.confirmRedirect", "missing return_to", { to: p });
    return p;
  }
  if (parsed === "/dashboard") {
    const p = await resolveDefaultProfilePathForUser(supabase, userId);
    runfolioLog.info("actions.confirmRedirect", "dashboard mapped to profile", { to: p });
    return p;
  }
  return parsed;
}

function profilePublishPayload() {
  return {
    include_on_profile: true,
    profile_approved_at: new Date().toISOString(),
    profile_featured: false
  };
}

export async function signUpAction(formData: FormData) {
  const nextPath = parseSafeRedirectPath(String(formData.get("next") ?? "")) ?? "/dashboard";
  const envBlock = getEnvPersistenceFailure();
  if (envBlock) {
    runfolioLog.warn("actions.signUp", "env block", { status: envBlock.status });
    redirect(
      `/auth/signup?next=${encodeURIComponent(nextPath)}&setup=${encodeURIComponent(envBlock.status)}`
    );
  }
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
    if (error) return { error: dbErr(error) };

    if (data.user) {
      const metaUser = { ...data.user, user_metadata: { ...data.user.user_metadata, name } };
      const ensured = await ensurePublicUserRow(supabase, metaUser);
      if (!ensured.ok) {
        runfolioLog.error("actions.signUp.usersRow", ensured.error, {
          code: ensured.code ?? "",
          userId: data.user.id,
          hasSession: Boolean(data.session)
        });
        if (data.session) {
          return {
            error: `Account created but your profile row could not be saved: ${ensured.error}. Check Supabase RLS and the users table, or try signing in again.`
          };
        }
      }
    }
    redirect(nextPath);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signUp", e);
    return { error: e instanceof Error ? e.message : "Sign up failed unexpectedly." };
  }
}

export async function signInAction(formData: FormData) {
  const nextPath = parseSafeRedirectPath(String(formData.get("next") ?? "")) ?? "/dashboard";
  const envBlock = getEnvPersistenceFailure();
  if (envBlock) {
    runfolioLog.warn("actions.signIn", "env block", { status: envBlock.status });
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}&setup=${encodeURIComponent(envBlock.status)}`);
  }
  try {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = await createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: dbErr(error) };
    if (signInData.user) {
      const ensured = await ensurePublicUserRow(supabase, signInData.user);
      if (!ensured.ok) {
        runfolioLog.warn("actions.signIn.usersRow", ensured.error, {
          code: ensured.code ?? "",
          userId: signInData.user.id
        });
      }
    }
    runfolioLog.info("actions.signIn", "success", { nextPath });
    redirect(nextPath);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.signIn", e);
    return { error: e instanceof Error ? e.message : "Sign in failed unexpectedly." };
  }
}

export async function signOutAction() {
  const envBlock = getEnvPersistenceFailure();
  if (envBlock) {
    runfolioLog.warn("actions.signOut", "no supabase client", { status: envBlock.status });
    redirect("/");
  }
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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;

    const isCompleted = formData.get("is_completed") === "on";
    const nowIso = new Date().toISOString();
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
      is_bucket_list_item: true,
      include_on_profile: true,
      ...(isCompleted ? { profile_approved_at: nowIso, profile_featured: false } : {})
    };

    const { error } = await supabase.from("races").insert(payload);
    if (error) return { error: dbErr(error) };

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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    runfolioLog.info("actions.confirmKnownRaceMatch", "start", {
      userId: user.id,
      discoverRaceId: String(formData.get("discover_race_id") ?? "").slice(0, 8)
    });

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

    const coreMatchPayload = {
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
    const publish = profilePublishPayload();

    const { data: existingStravaRow } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();

    const returnTo = await resolveConfirmRedirectDestination(
      supabase,
      user.id,
      String(formData.get("return_to") ?? "")
    );

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
        ...coreMatchPayload,
        ...publish,
        is_bucket_list_item: true
      };

      if (existingStravaRow && existingStravaRow.id !== targetUserRaceId) {
        updatePayload = mergeRacePortfolioFromOrphan(updatePayload, existingStravaRow as Race);
        const { error: delErr } = await supabase.from("races").delete().eq("id", existingStravaRow.id);
        if (delErr) return { error: dbErr(delErr) };
      }

      const { error: upErr } = await supabase.from("races").update(updatePayload).eq("id", targetUserRaceId);
      if (upErr) return { error: dbErr(upErr) };
    } else if (existingStravaRow) {
      const { error: upErr } = await supabase
        .from("races")
        .update({
          ...coreMatchPayload,
          ...publish,
          is_bucket_list_item: false
        })
        .eq("id", existingStravaRow.id);
      if (upErr) return { error: dbErr(upErr) };
    } else {
      const { error: insErr } = await supabase.from("races").insert({
        ...coreMatchPayload,
        ...publish,
        user_id: user.id,
        is_bucket_list_item: false
      });
      if (insErr) return { error: dbErr(insErr) };
    }

    await revalidateRaceMatchSurfaces(supabase, user.id, discoverRaceId, stravaActivityId, returnTo);
    const redirectTo = withRaceLinkedCelebration(returnTo);
    runfolioLog.info("actions.confirmKnownRaceMatch.ok", "redirect", {
      userId: user.id,
      discoverRaceId,
      stravaActivityId,
      returnTo: redirectTo
    });
    redirect(redirectTo);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.confirmKnownRaceMatch", e);
    return { error: e instanceof Error ? e.message : "Could not confirm race match." };
  }
}

/**
 * Save a ≥50 km Strava effort as a completed portfolio row without a catalog race id (dynamic fallback).
 * User can rename; `discover_race_id` stays null until they link a catalog race later.
 */
export async function confirmCustomMajorEffortAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;

    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) {
      return { error: "Missing Strava activity." };
    }

    const customName =
      String(formData.get("custom_name") ?? "").trim() || "Major trail / ultra effort";
    const date = String(formData.get("date") ?? "").trim() || null;
    const distanceKm = Number(formData.get("distance_km") ?? 0);
    const elevationM = Number(formData.get("elevation_m") ?? 0);
    const time = String(formData.get("time") ?? "").trim() || null;
    const location = String(formData.get("location") ?? "").trim() || null;

    if (!Number.isFinite(distanceKm) || distanceKm < 50) {
      return { error: "Custom major efforts must be at least 50 km." };
    }

    const returnTo = await resolveConfirmRedirectDestination(
      supabase,
      user.id,
      String(formData.get("return_to") ?? "")
    );

    const existing = await getRaceByStravaActivityId(stravaActivityId, user.id);
    const publish = profilePublishPayload();

    const corePayload = {
      name: customName,
      location,
      date,
      distance_km: distanceKm,
      elevation_m: Number.isFinite(elevationM) && elevationM > 0 ? elevationM : null,
      time,
      description: null,
      is_completed: true,
      strava_activity_id: stravaActivityId,
      discover_race_id: null as string | null,
      is_bucket_list_item: false,
      ...publish
    };

    if (existing) {
      const { error: upErr } = await supabase
        .from("races")
        .update(corePayload)
        .eq("id", existing.id)
        .eq("user_id", user.id);
      if (upErr) return { error: dbErr(upErr) };
    } else {
      const { error: insErr } = await supabase.from("races").insert({
        ...corePayload,
        user_id: user.id
      });
      if (insErr) return { error: dbErr(insErr) };
    }

    await revalidatePortfolioSurfaces(supabase, user.id, {
      stravaActivityId,
      alsoPaths: [returnTo]
    });
    redirect(withRaceLinkedCelebration(returnTo));
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.confirmCustomMajorEffort", e);
    return { error: e instanceof Error ? e.message : "Could not save effort." };
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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;

    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing Strava activity id." };

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Title is required." };

    const existing = await getRaceByStravaActivityId(stravaActivityId, user.id);

    const discoverRaceId = String(formData.get("discover_race_id") ?? "").trim() || null;
    const profileApprovedAt =
      (existing as Race | null)?.profile_approved_at?.trim() || new Date().toISOString();

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
      manual_photo_urls: parseManualPhotoUrlsBlock(String(formData.get("manual_photo_urls") ?? "")),
      include_on_profile: true,
      profile_approved_at: profileApprovedAt
    };

    if (existing) {
      const { error: upErr } = await supabase.from("races").update(payload).eq("id", existing.id);
      if (upErr) return { error: dbErr(upErr) };
    } else {
      const insertRow = {
        ...payload,
        user_id: user.id,
        strava_activity_id: stravaActivityId,
        is_completed: true,
        is_bucket_list_item: false
      };
      const { error: insErr } = await supabase.from("races").insert(insertRow);
      if (insErr) return { error: dbErr(insErr) };
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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };

    const { error: delErr } = await supabase.from("races").delete().eq("id", raceId).eq("user_id", user.id);
    if (delErr) return { error: dbErr(delErr) };

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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
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
    if (upErr) return { error: dbErr(upErr) };

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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (!row.is_completed) return { error: "Only completed races use this action." };

    const { error: upErr } = await supabase
      .from("races")
      .update({ is_bucket_list_item: false })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (upErr) return { error: dbErr(upErr) };

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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (row.is_completed) return { error: "Use other actions for completed races." };

    const { error: delErr } = await supabase.from("races").delete().eq("id", raceId).eq("user_id", user.id);
    if (delErr) return { error: dbErr(delErr) };

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
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const discoverId = String(formData.get("discover_race_id") ?? "").trim();
    if (!discoverId || !isDiscoverCatalogRaceId(discoverId)) return { error: "Invalid race." };
    const detail = getDiscoverRaceDetail(discoverId);
    if (!detail) return { error: "Unknown race." };

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
      discover_race_id: discoverId,
      include_on_profile: true
    });
    if (insErr) return { error: dbErr(insErr) };

    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: discoverId,
      alsoPaths: ["/races/find", "/bucket-list"]
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.addCatalogRaceToBucketList", e);
    return { error: e instanceof Error ? e.message : "Could not add goal." };
  }
}

/**
 * Complete a **manual** future bucket goal (no `discover_race_id`) by linking a Strava activity.
 * Catalog/library goals must use `confirmKnownRaceMatchAction` so the race id stays canonical.
 */
export async function completeBucketGoalWithStravaAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    runfolioLog.info("actions.completeBucketGoalWithStrava", "start", { userId: user.id });

    const raceId = String(formData.get("user_race_id") ?? "").trim();
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!raceId || !stravaActivityId) {
      return { error: "Missing race or activity." };
    }

    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (row.is_completed) return { error: "This goal is already completed." };
    if (!raceIsBucketListFutureGoal(row)) return { error: "Not an active bucket list goal." };
    if (row.discover_race_id?.trim()) {
      return { error: "Use the catalog match flow for library races." };
    }

    const date = String(formData.get("date") ?? "").trim();
    const distanceKm = Number(formData.get("distance_km") ?? 0);
    const elevationM = Number(formData.get("elevation_m") ?? 0);
    const time = String(formData.get("time") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    let description = String(formData.get("description") ?? "").trim();

    if (!description) {
      const access = await getValidStravaAccessToken();
      if (access) {
        try {
          const detail = await fetchStravaActivity(stravaActivityId, access);
          const d = detail.description?.trim();
          if (d) description = d;
        } catch {
          /* optional */
        }
      }
    }

    const coreBucketCompletePayload = {
      name: row.name,
      location: location || row.location,
      date: date || null,
      distance_km: Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : row.distance_km,
      elevation_m: Number.isFinite(elevationM) && elevationM > 0 ? elevationM : null,
      time: time || null,
      description: description || null,
      is_completed: true,
      strava_activity_id: stravaActivityId,
      discover_race_id: null as string | null,
      is_bucket_list_item: true,
      ...profilePublishPayload()
    };

    const { data: existingStravaRow } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();

    const returnTo = await resolveConfirmRedirectDestination(
      supabase,
      user.id,
      String(formData.get("return_to") ?? ""),
      "/bucket-list"
    );

    if (existingStravaRow && existingStravaRow.id !== raceId) {
      const updatePayload = mergeRacePortfolioFromOrphan(coreBucketCompletePayload, existingStravaRow as Race);
      const { error: delErr } = await supabase.from("races").delete().eq("id", existingStravaRow.id);
      if (delErr) return { error: dbErr(delErr) };
      const { error: upErr } = await supabase.from("races").update(updatePayload).eq("id", raceId).eq("user_id", user.id);
      if (upErr) return { error: dbErr(upErr) };
    } else {
      const { error: upErr } = await supabase
        .from("races")
        .update(coreBucketCompletePayload)
        .eq("id", raceId)
        .eq("user_id", user.id);
      if (upErr) return { error: dbErr(upErr) };
    }

    await revalidatePortfolioSurfaces(supabase, user.id, {
      stravaActivityId,
      alsoPaths: [returnTo]
    });
    redirect(withRaceLinkedCelebration(returnTo));
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.completeBucketGoalWithStrava", e);
    return { error: e instanceof Error ? e.message : "Could not complete goal." };
  }
}

/** Hide an imported Strava race candidate from the profile pending queue (durable). */
export async function dismissStravaProfileCandidateAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaId) return { error: "Missing activity." };
    const returnToRaw = String(formData.get("return_to") ?? "").trim();
    const returnTo =
      returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") && !returnToRaw.includes("://")
        ? returnToRaw
        : "/dashboard";
    const { error } = await supabase.from("strava_profile_dismissals").upsert({
      user_id: user.id,
      strava_activity_id: stravaId
    });
    if (error) return { error: dbErr(error) };

    await revalidatePortfolioSurfaces(supabase, user.id, { alsoPaths: [returnTo] });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.dismissStravaProfileCandidate", e);
    return { error: e instanceof Error ? e.message : "Could not dismiss." };
  }
}

/** Add an **active** canonical race to Future Goals (stable internal race id). */
export async function addCanonicalRaceToBucketListAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const canonicalRaceId = String(formData.get("canonical_race_id") ?? "").trim();
    if (!canonicalRaceId) return { error: "Missing race." };

    runfolioLog.info("bucketList.addCanonical.request", "add goal", { userId: user.id, canonicalRaceId });
    const { data: race, error: raceErr } = await supabase
      .from("canonical_races")
      .select("id, status, slug")
      .eq("id", canonicalRaceId)
      .maybeSingle();
    if (raceErr) return { error: dbErr(raceErr) };
    if (!race || race.status !== "active") {
      return { error: "That race isn’t available to add right now." };
    }

    const { error: insErr } = await supabase.from("user_bucket_list_goals").insert({
      user_id: user.id,
      canonical_race_id: canonicalRaceId,
      status: "planned"
    });
    if (insErr) {
      if (insErr.code === "23505") {
        runfolioLog.info("bucketList.addCanonical.duplicate", "unique violation", {
          userId: user.id,
          canonicalRaceId
        });
        return { ok: true as const, already: true as const };
      }
      runfolioLog.warn("bucketList.addCanonical.insertFailed", insErr.message, { code: insErr.code });
      return { error: dbErr(insErr) };
    }

    const slug = (race as { slug?: string | null } | null)?.slug?.trim();
    const racePage = slug ? `/races/${slug}` : `/races/${canonicalRaceId}`;
    await revalidatePortfolioSurfaces(supabase, user.id, {
      alsoPaths: ["/races/find", "/bucket-list", racePage]
    });
    runfolioLog.info("bucketList.addCanonical.inserted", "planned goal saved", {
      userId: user.id,
      canonicalRaceId
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.addCanonicalRaceToBucketList", e);
    return { error: e instanceof Error ? e.message : "Could not add to bucket list." };
  }
}

export async function removeCanonicalBucketGoalAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const goalId = String(formData.get("goal_id") ?? "").trim();
    if (!goalId) return { error: "Missing goal." };
    const { error: delErr } = await supabase
      .from("user_bucket_list_goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", user.id);
    if (delErr) return { error: dbErr(delErr) };
    await revalidatePortfolioSurfaces(supabase, user.id, { alsoPaths: ["/races/find", "/bucket-list"] });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.removeCanonicalBucketGoal", e);
    return { error: e instanceof Error ? e.message : "Could not remove goal." };
  }
}

/** First completion step: goal done in the real world; Strava link optional later. */
export async function markCanonicalBucketGoalCompletedAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const goalId = String(formData.get("goal_id") ?? "").trim();
    if (!goalId) return { error: "Missing goal." };
    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await supabase
      .from("user_bucket_list_goals")
      .update({
        status: "completed_unlinked",
        completed_at: now
      })
      .eq("id", goalId)
      .eq("user_id", user.id)
      .in("status", ["saved", "planned"])
      .select("id, canonical_race_id");
    if (upErr) return { error: dbErr(upErr) };
    if (!updated?.length) {
      return { error: "That goal isn’t active or was already completed." };
    }
    let racePage: string | undefined;
    const crid = (updated[0] as { canonical_race_id?: string }).canonical_race_id;
    if (crid) {
      const { data: cr } = await supabase.from("canonical_races").select("slug").eq("id", crid).maybeSingle();
      const s = (cr as { slug?: string } | null)?.slug?.trim();
      if (s) racePage = `/races/${s}`;
    }
    await revalidatePortfolioSurfaces(supabase, user.id, {
      alsoPaths: ["/races/find", "/bucket-list", ...(racePage ? [racePage] : [])]
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.markCanonicalBucketGoalCompleted", e);
    return { error: e instanceof Error ? e.message : "Could not mark complete." };
  }
}

export async function undoCanonicalBucketCompletionAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const goalId = String(formData.get("goal_id") ?? "").trim();
    if (!goalId) return { error: "Missing goal." };
    const { data: undone, error: upErr } = await supabase
      .from("user_bucket_list_goals")
      .update({
        status: "planned",
        completed_at: null,
        linked_strava_activity_id: null,
        linked_user_race_id: null
      })
      .eq("id", goalId)
      .eq("user_id", user.id)
      .eq("status", "completed_unlinked")
      .select("id");
    if (upErr) return { error: dbErr(upErr) };
    if (!undone?.length) return { error: "Only finishes without a linked activity can move back this way." };
    await revalidatePortfolioSurfaces(supabase, user.id, { alsoPaths: ["/races/find", "/bucket-list"] });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.undoCanonicalBucketCompletion", e);
    return { error: e instanceof Error ? e.message : "Could not move goal back." };
  }
}

/** Pull Strava activities into `strava_synced_activities` (incremental by payload hash). */
export async function syncStravaActivitiesAction() {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const res = await syncStravaActivitiesForUserId(user.id);
    if (!res.ok) {
      return { error: res.error };
    }
    await revalidatePortfolioSurfaces(supabase, user.id, {
      alsoPaths: ["/dashboard", "/bucket-list", "/races/find"]
    });
    runfolioLog.info("actions.stravaSync", "ok", { upserted: res.upserted, skipped: res.skippedUnchanged });
    return {
      ok: true as const,
      upserted: res.upserted,
      skippedUnchanged: res.skippedUnchanged,
      errors: res.errors
    };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.syncStravaActivities", e);
    return { error: e instanceof Error ? e.message : "Sync failed." };
  }
}

/** User says a synced activity is training / not an event — persistent hub exclusion. */
export async function markStravaActivityNotRaceAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing activity." };
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("strava_synced_activities")
      .update({ match_hub_status: "not_race", updated_at: now })
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .is("linked_portfolio_race_id", null);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {});
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.markStravaActivityNotRace", e);
    return { error: e instanceof Error ? e.message : "Could not update activity." };
  }
}

/** Defer an activity out of the active review queue (still synced, not linked). */
export async function snoozeStravaActivityMatchHubAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing activity." };
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("strava_synced_activities")
      .update({ match_hub_status: "snoozed", updated_at: now })
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .is("linked_portfolio_race_id", null);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {});
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.snoozeStravaActivityMatchHub", e);
    return { error: e instanceof Error ? e.message : "Could not snooze activity." };
  }
}

/** Return deferred items to the active hub queue. */
export async function unsnoozeStravaActivityMatchHubAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing activity." };
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("strava_synced_activities")
      .update({ match_hub_status: null, updated_at: now })
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .eq("match_hub_status", "snoozed");
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {});
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.unsnoozeStravaActivityMatchHub", e);
    return { error: e instanceof Error ? e.message : "Could not restore activity." };
  }
}

export async function dismissCanonicalStravaMatchAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing activity." };
    const res = await dismissCanonicalMatchSuggestion(supabase, user.id, stravaActivityId);
    if (!res.ok) return { error: res.error };
    await revalidatePortfolioSurfaces(supabase, user.id, { alsoPaths: ["/dashboard", "/matches"] });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.dismissCanonicalStravaMatch", e);
    return { error: e instanceof Error ? e.message : "Could not dismiss." };
  }
}

/**
 * Confirm Strava activity ↔ **canonical** race: portfolio row + optional bucket goal → completed_linked.
 */
export async function confirmCanonicalStravaMatchAction(formData: FormData) {
  const responseMode = String(formData.get("response_mode") ?? "").trim();
  const isHub = responseMode === "hub";

  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) {
      runfolioLog.warn("actions.confirmCanonicalStravaMatch", "blocked", {
        isHub,
        code: gate.code
      });
      if (isHub) return { error: gate.error };
      if (gate.code === "auth_required") {
        const loginNext = parseSafeRedirectPath(String(formData.get("return_to") ?? "")) ?? "/dashboard";
        redirect(`/auth/login?next=${encodeURIComponent(loginNext)}`);
      }
      return { error: gate.error };
    }

    const { user, supabase } = gate;
    runfolioLog.info("actions.confirmCanonicalStravaMatch", "start", {
      userId: user.id,
      isHub,
      stravaActivityId: String(formData.get("strava_activity_id") ?? "").slice(0, 12)
    });

    const canonicalRaceId = String(formData.get("canonical_race_id") ?? "").trim();
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    const bucketGoalId = String(formData.get("bucket_goal_id") ?? "").trim() || null;

    if (!canonicalRaceId || !stravaActivityId) {
      return { error: "Missing race or activity." };
    }

    const { data: cRow, error: cErr } = await supabase
      .from("canonical_races")
      .select("id,name,slug,city,region,country,start_date,distance_km,elevation_gain_m,status")
      .eq("id", canonicalRaceId)
      .eq("status", "active")
      .maybeSingle();

    if (cErr || !cRow) {
      return { error: "That race isn’t available." };
    }

    const { data: syncRow } = await supabase
      .from("strava_synced_activities")
      .select("*")
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();

    let date = String(formData.get("date") ?? "").trim();
    let distanceKm = Number(formData.get("distance_km") ?? 0);
    let elevationM = Number(formData.get("elevation_m") ?? 0);
    let time = String(formData.get("time") ?? "").trim();
    let location = String(formData.get("location") ?? "").trim();
    let description = String(formData.get("description") ?? "").trim();

    if (!date && syncRow?.start_date) date = String(syncRow.start_date).slice(0, 10);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      distanceKm = Number(syncRow?.distance_km ?? cRow.distance_km ?? 0);
    }
    if (!Number.isFinite(elevationM) || elevationM < 0) {
      elevationM = Number(syncRow?.elevation_gain_m ?? cRow.elevation_gain_m ?? 0);
    }
    if (!time && syncRow?.moving_time_sec != null) {
      time = formatStravaMovingTime(Number(syncRow.moving_time_sec));
    }
    if (!location?.trim()) {
      location =
        [syncRow?.city, syncRow?.country].filter(Boolean).join(", ") ||
        [cRow.city, cRow.region, cRow.country].filter(Boolean).join(", ");
    }
    if (!description) {
      const access = await getValidStravaAccessToken();
      if (access) {
        try {
          const detail = await fetchStravaActivity(stravaActivityId, access);
          const d = detail.description?.trim();
          if (d) description = d;
        } catch {
          /* optional */
        }
      }
    }

    const publish = profilePublishPayload();
    const dataPayload: Record<string, unknown> = {
      name: cRow.name,
      location: location?.trim() || null,
      date: date || null,
      distance_km: distanceKm > 0 ? distanceKm : null,
      elevation_m: elevationM > 0 ? elevationM : null,
      time: time?.trim() || null,
      description: description?.trim() || null,
      is_completed: true,
      strava_activity_id: stravaActivityId,
      discover_race_id: null,
      canonical_race_id: canonicalRaceId,
      is_bucket_list_item: true,
      tag_bucket_list_done: true,
      ...publish
    };

    const { data: existingStravaRow } = await supabase
      .from("races")
      .select("*")
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId)
      .maybeSingle();

    const returnTo = await resolveConfirmRedirectDestination(
      supabase,
      user.id,
      String(formData.get("return_to") ?? "")
    );

    let finalRaceId: string;

    if (existingStravaRow) {
      const merged = mergeRacePortfolioFromOrphan(dataPayload, existingStravaRow as Race);
      const { error: upErr } = await supabase
        .from("races")
        .update(merged)
        .eq("id", (existingStravaRow as Race).id);
      if (upErr) return { error: dbErr(upErr) };
      finalRaceId = (existingStravaRow as Race).id;
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("races")
        .insert({
          ...dataPayload,
          user_id: user.id
        })
        .select("id")
        .single();
      if (insErr || !ins) return { error: insErr ? dbErr(insErr) : "Could not save finish." };
      finalRaceId = ins.id as string;
    }

    let resolvedGoalId = bucketGoalId;
    if (!resolvedGoalId) {
      const { data: g } = await supabase
        .from("user_bucket_list_goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("canonical_race_id", canonicalRaceId)
        .in("status", ["planned", "saved", "completed_unlinked"])
        .maybeSingle();
      resolvedGoalId = (g as { id: string } | null)?.id ?? null;
    }
    if (resolvedGoalId) {
      const { error: goalUpErr } = await supabase
        .from("user_bucket_list_goals")
        .update({
          status: "completed_linked",
          completed_at: new Date().toISOString(),
          linked_strava_activity_id: stravaActivityId,
          linked_user_race_id: finalRaceId
        })
        .eq("id", resolvedGoalId)
        .eq("user_id", user.id);
      if (goalUpErr) {
        runfolioLog.warn("actions.confirmCanonicalStravaMatch", "bucket goal update failed", {
          message: goalUpErr.message,
          code: goalUpErr.code,
          resolvedGoalId
        });
        return { error: dbErr(goalUpErr) };
      }
    }

    const { error: syncUpErr } = await supabase
      .from("strava_synced_activities")
      .update({
        linked_portfolio_race_id: finalRaceId,
        match_hub_status: null,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId);
    if (syncUpErr) {
      runfolioLog.warn("actions.confirmCanonicalStravaMatch", "strava_synced update failed", {
        message: syncUpErr.message,
        code: syncUpErr.code,
        stravaActivityId
      });
      return { error: dbErr(syncUpErr) };
    }

    const { error: dismissErr } = await supabase
      .from("strava_canonical_match_dismissals")
      .delete()
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId);
    if (dismissErr) {
      runfolioLog.warn("actions.confirmCanonicalStravaMatch", "dismissals delete failed", { message: dismissErr.message });
    }

    const canonRacePath = (cRow as { slug?: string | null }).slug?.trim()
      ? `/races/${(cRow as { slug: string }).slug.trim()}`
      : `/races/${canonicalRaceId}`;
    await revalidatePortfolioSurfaces(supabase, user.id, {
      stravaActivityId,
      alsoPaths: [returnTo, "/bucket-list", canonRacePath, "/matches"]
    });
    if (responseMode === "hub") {
      runfolioLog.info("actions.confirmCanonicalStravaMatch.ok", "hub response (no redirect)", {
        userId: user.id,
        finalRaceId,
        canonicalRaceId,
        stravaActivityId
      });
      return {
        ok: true as const,
        finalRaceId,
        canonicalRaceId,
        stravaActivityId
      };
    }
    const redirectTo = withRaceLinkedCelebration(returnTo);
    runfolioLog.info("actions.confirmCanonicalStravaMatch.ok", "redirect after link", {
      userId: user.id,
      finalRaceId,
      canonicalRaceId,
      stravaActivityId,
      returnTo: redirectTo
    });
    redirect(redirectTo);
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.confirmCanonicalStravaMatch", e);
    return { error: e instanceof Error ? e.message : "Could not confirm match." };
  }
}

export async function updateProfileIdentityAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const tagline = String(formData.get("profile_tagline") ?? "").trim() || null;
    const location = String(formData.get("profile_location") ?? "").trim() || null;
    const profile_public = String(formData.get("profile_public") ?? "true") !== "false";

    const { error } = await supabase
      .from("users")
      .update({
        profile_tagline: tagline,
        profile_location: location,
        profile_public
      })
      .eq("id", user.id);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {});
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.updateProfileIdentity", e);
    return { error: e instanceof Error ? e.message : "Could not save profile." };
  }
}

export async function publishRaceToProfileAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (!isConfirmedPortfolioCompletion(row)) {
      return { error: "Link this finish to Strava or the race library before publishing." };
    }
    const { error } = await supabase
      .from("races")
      .update({
        profile_approved_at: new Date().toISOString(),
        include_on_profile: true
      })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.publishRaceToProfile", e);
    return { error: e instanceof Error ? e.message : "Could not publish." };
  }
}

export async function hideRaceFromProfileAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    const { error } = await supabase
      .from("races")
      .update({
        include_on_profile: false,
        profile_featured: false
      })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.hideRaceFromProfile", e);
    return { error: e instanceof Error ? e.message : "Could not update." };
  }
}

export async function setRaceProfileFeaturedAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const raceId = String(formData.get("race_id") ?? "").trim();
    if (!raceId) return { error: "Missing race." };
    const featured = String(formData.get("profile_featured") ?? "") === "true";
    const row = await requireOwnedRace(supabase, user.id, raceId);
    if (!row) return { error: "Race not found." };
    if (!row.profile_approved_at?.trim()) {
      return { error: "Publish this finish before featuring it." };
    }
    const { error } = await supabase
      .from("races")
      .update({ profile_featured: featured })
      .eq("id", raceId)
      .eq("user_id", user.id);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, {
      discoverRaceId: row.discover_race_id,
      stravaActivityId: row.strava_activity_id
    });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.setRaceProfileFeatured", e);
    return { error: e instanceof Error ? e.message : "Could not update." };
  }
}

export async function setSyncedActivityProfileIncludeAction(formData: FormData) {
  try {
    const gate = await requireActionPersistence();
    if (!gate.ok) return { error: gate.error };
    const { user, supabase } = gate;
    const stravaActivityId = String(formData.get("strava_activity_id") ?? "").trim();
    if (!stravaActivityId) return { error: "Missing activity." };
    const include = String(formData.get("profile_include") ?? "") === "true";
    const { error } = await supabase
      .from("strava_synced_activities")
      .update({ profile_include: include, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("strava_activity_id", stravaActivityId);
    if (error) return { error: dbErr(error) };
    await revalidatePortfolioSurfaces(supabase, user.id, { stravaActivityId, alsoPaths: ["/dashboard"] });
    return { ok: true as const };
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.setSyncedActivityProfileInclude", e);
    return { error: e instanceof Error ? e.message : "Could not update." };
  }
}
