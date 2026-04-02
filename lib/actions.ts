"use server";

import { revalidatePath } from "next/cache";
import { isDynamicServerError } from "next/dist/client/components/hooks-server-context";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getDiscoverRaceById } from "@/lib/known-race-match";
import { getServerAuthUser } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/demo-mode";
import { runfolioLog } from "@/lib/runfolio-log";

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

    const payload = {
      user_id: user.id,
      name: String(formData.get("name") ?? ""),
      location: String(formData.get("location") ?? ""),
      date: String(formData.get("date") ?? ""),
      distance_km: Number(formData.get("distance_km") ?? 0),
      elevation_m: Number(formData.get("elevation_m") ?? 0),
      time: String(formData.get("time") ?? ""),
      description: String(formData.get("description") ?? ""),
      is_completed: formData.get("is_completed") === "on"
    };

    const { error } = await supabase.from("races").insert(payload);
    if (error) return { error: error.message };

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

/**
 * After user confirms a suggested known-race match from Strava: update bucket list row or insert a completed race.
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
    const description = String(formData.get("description") ?? "").trim();

    if (!discoverRaceId || !stravaActivityId) {
      return { error: "Missing race or activity reference." };
    }

    const discover = getDiscoverRaceById(discoverRaceId);
    if (!discover) {
      return { error: "Unknown catalog race." };
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

    if (targetUserRaceId) {
      const { data: row, error: selErr } = await supabase
        .from("races")
        .select("id, user_id")
        .eq("id", targetUserRaceId)
        .single();
      if (selErr || !row || row.user_id !== user.id) {
        return { error: "Could not update that bucket list item." };
      }
      const { error: upErr } = await supabase.from("races").update(basePayload).eq("id", targetUserRaceId);
      if (upErr) return { error: upErr.message };
    } else {
      const insertPayload = {
        ...basePayload,
        user_id: user.id
      };
      const { error: insErr } = await supabase.from("races").insert(insertPayload);
      if (insErr) return { error: insErr.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/bucket-list");
    redirect("/dashboard");
  } catch (e) {
    if (isDynamicServerError(e)) throw e;
    if (isRedirectError(e)) throw e;
    runfolioLog.error("actions.confirmKnownRaceMatch", e);
    return { error: e instanceof Error ? e.message : "Could not confirm race match." };
  }
}
