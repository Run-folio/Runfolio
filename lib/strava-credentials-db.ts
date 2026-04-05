import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StravaTokenResponse } from "@/lib/strava-oauth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStravaClientCredentials } from "@/lib/strava-env";
import { refreshStravaAccessToken } from "@/lib/strava-oauth";
import { runfolioLog } from "@/lib/runfolio-log";

export type StravaCredentialRow = {
  user_id: string;
  athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export async function upsertStravaUserCredentials(
  admin: SupabaseClient,
  userId: string,
  athleteId: string,
  tokens: StravaTokenResponse
): Promise<void> {
  const rawSec = tokens.expires_at;
  const sec =
    rawSec != null && Number.isFinite(Number(rawSec))
      ? Number(rawSec)
      : tokens.expires_in != null
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : Math.floor(Date.now() / 1000) + 3600;
  const expiresAt = new Date(sec * 1000).toISOString();
  let refresh = tokens.refresh_token?.trim() ?? "";
  if (!refresh) {
    const existing = await getStravaCredentialsForUser(admin, userId);
    refresh = existing?.refresh_token?.trim() ?? "";
  }
  if (!refresh) {
    runfolioLog.error("strava.credentials.upsert", "missing refresh_token from Strava and no row to reuse");
    throw new Error("Strava OAuth response missing refresh_token");
  }
  const { error } = await admin.from("strava_user_credentials").upsert(
    {
      user_id: userId,
      athlete_id: athleteId,
      access_token: tokens.access_token,
      refresh_token: refresh,
      expires_at: expiresAt
    },
    { onConflict: "user_id" }
  );
  if (error) {
    runfolioLog.error("strava.credentials.upsert", error.message, { code: error.code, userId });
    throw error;
  }
}

export async function getStravaCredentialsForUser(
  admin: SupabaseClient,
  userId: string
): Promise<StravaCredentialRow | null> {
  const { data, error } = await admin
    .from("strava_user_credentials")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    runfolioLog.warn("strava.credentials.read", error.message, { code: error.code, userId });
    return null;
  }
  return (data as StravaCredentialRow | null) ?? null;
}

function expiresStale(expiresAtIso: string, skewSec: number): boolean {
  const t = new Date(expiresAtIso).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() > t - skewSec * 1000;
}

/**
 * Valid access token for Strava API for this user. Refreshes using stored refresh_token when near expiry.
 */
export async function getValidStravaAccessTokenForUser(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const row = await getStravaCredentialsForUser(admin, userId);
  if (!row?.access_token) return null;
  if (!expiresStale(row.expires_at, 120)) {
    return row.access_token;
  }
  const cred = getStravaClientCredentials();
  if (!cred || !row.refresh_token) {
    return row.access_token;
  }
  try {
    const t = await refreshStravaAccessToken(row.refresh_token, cred.clientId, cred.clientSecret);
    await upsertStravaUserCredentials(admin, userId, row.athlete_id, t);
    return t.access_token;
  } catch (e) {
    runfolioLog.warn("strava.credentials.refresh", e instanceof Error ? e.message : "unknown", { userId });
    return null;
  }
}

/**
 * Like {@link getValidStravaAccessTokenForUser} but does not proactively refresh (first list page / rate-limit path).
 */
export async function getStravaAccessTokenWithoutProactiveRefreshForUser(
  userId: string
): Promise<{ token: string | null; oauthRefreshCount: number }> {
  const admin = createServiceRoleClient();
  if (!admin) return { token: null, oauthRefreshCount: 0 };
  const row = await getStravaCredentialsForUser(admin, userId);
  if (!row?.access_token) return { token: null, oauthRefreshCount: 0 };
  return { token: row.access_token, oauthRefreshCount: 0 };
}

/** After 401 on Strava, refresh using DB refresh_token and persist. Returns new access token or null. */
export async function refreshStravaAccessTokenForUser(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const row = await getStravaCredentialsForUser(admin, userId);
  if (!row?.refresh_token) return null;
  const cred = getStravaClientCredentials();
  if (!cred) return null;
  try {
    const t = await refreshStravaAccessToken(row.refresh_token, cred.clientId, cred.clientSecret);
    await upsertStravaUserCredentials(admin, userId, row.athlete_id, t);
    return t.access_token;
  } catch (e) {
    runfolioLog.warn("strava.credentials.refresh401", e instanceof Error ? e.message : "unknown", { userId });
    return null;
  }
}

export async function userHasStravaCredentials(userId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) return false;
  const row = await getStravaCredentialsForUser(admin, userId);
  return Boolean(row?.access_token && row.refresh_token);
}
