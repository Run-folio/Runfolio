import { NextResponse, type NextRequest } from "next/server";
import {
  STRAVA_OAUTH_MODE_COOKIE,
  STRAVA_OAUTH_NEXT_COOKIE,
  STRAVA_OAUTH_STATE_COOKIE,
  clearStravaTokenCookiesOnResponse
} from "@/lib/strava-cookies";
import { getStravaClientCredentials, getStravaRedirectUri } from "@/lib/strava-env";
import { exchangeStravaCode } from "@/lib/strava-oauth";
import { establishSupabaseSessionForUserId } from "@/lib/strava-oauth-session";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import {
  getStravaCredentialsForUser,
  stravaSyntheticEmail,
  upsertStravaUserCredentials
} from "@/lib/strava-credentials-db";
import { fetchStravaAthleteForAuth } from "@/lib/strava-user-profile";
import { runfolioLog } from "@/lib/runfolio-log";

function redirectWith(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const reqUrl = new URL(request.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const err = reqUrl.searchParams.get("error");
  const errDesc = reqUrl.searchParams.get("error_description");

  if (err) {
    runfolioLog.error("strava.oauth.callback.denied", errDesc ?? err);
    return redirectWith(request, "/auth/login?strava_error=strava_access_denied");
  }
  if (!code || !state) {
    return redirectWith(request, "/auth/login?strava_error=missing_code");
  }

  const stateCookie = request.cookies.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) {
    return redirectWith(request, "/auth/login?strava_error=invalid_state");
  }

  const cred = getStravaClientCredentials();
  if (!cred) {
    return redirectWith(request, "/auth/login?strava_error=no_client");
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    runfolioLog.error("strava.oauth.callback", "admin_client_unavailable");
    return redirectWith(request, "/auth/login?strava_error=server_unavailable");
  }

  const redirectUri = getStravaRedirectUri(request);
  const nextRaw = request.cookies.get(STRAVA_OAUTH_NEXT_COOKIE)?.value ?? "/dashboard";
  const nextPath = parseSafeRedirectPath(nextRaw) ?? "/dashboard";
  const mode = request.cookies.get(STRAVA_OAUTH_MODE_COOKIE)?.value ?? "login";

  let tokens;
  try {
    tokens = await exchangeStravaCode(code, cred.clientId, cred.clientSecret, redirectUri);
  } catch (e) {
    runfolioLog.error("strava.oauth.callback.token_exchange", e);
    return redirectWith(request, "/auth/login?strava_error=token_exchange_failed");
  }

  const athlete = await fetchStravaAthleteForAuth(tokens.access_token);
  if (!athlete) {
    return redirectWith(request, "/auth/login?strava_error=athlete_fetch_failed");
  }

  const email = stravaSyntheticEmail(athlete.id);

  try {
    if (mode === "reconnect") {
      const redirectRes = NextResponse.redirect(new URL(nextPath, request.url));
      redirectRes.cookies.delete(STRAVA_OAUTH_STATE_COOKIE);
      redirectRes.cookies.delete(STRAVA_OAUTH_NEXT_COOKIE);
      redirectRes.cookies.delete(STRAVA_OAUTH_MODE_COOKIE);

      const routeSb = createSupabaseRouteHandlerClient(request, redirectRes);
      const {
        data: { session }
      } = await routeSb.auth.getSession();
      if (!session?.user?.id) {
        return redirectWith(request, `/auth/login?next=${encodeURIComponent(nextPath)}&strava_error=reconnect_requires_login`);
      }
      const uid = session.user.id;

      const { data: prof } = await admin.from("users").select("strava_athlete_id").eq("id", uid).maybeSingle();
      const expected = (prof as { strava_athlete_id?: string | null } | null)?.strava_athlete_id?.trim();
      const credRow = await getStravaCredentialsForUser(admin, uid);
      const linkedAthlete = expected ?? credRow?.athlete_id;
      if (linkedAthlete && linkedAthlete !== athlete.id) {
        return redirectWith(request, "/auth/login?strava_error=wrong_strava_account");
      }

      await upsertStravaUserCredentials(admin, uid, athlete.id, tokens);
      await admin
        .from("users")
        .update({
          name: athlete.displayName,
          strava_profile_url: athlete.profileUrl,
          strava_athlete_id: athlete.id
        })
        .eq("id", uid);

      clearStravaTokenCookiesOnResponse(redirectRes);
      return redirectRes;
    }

    /** Login / sign-up: find or create auth user linked to this Strava athlete. */
    const { data: byAthlete } = await admin
      .from("users")
      .select("id")
      .eq("strava_athlete_id", athlete.id)
      .maybeSingle();
    let userId: string | null = (byAthlete as { id?: string } | null)?.id ?? null;

    if (!userId) {
      const crypto = await import("node:crypto");
      const tempPassword = crypto.randomBytes(24).toString("hex");
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { name: athlete.displayName }
      });

      if (!cErr && created.user) {
        userId = created.user.id;
      } else {
        const msg = cErr?.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered")) {
          const { data: byEmail } = await admin.from("users").select("id").eq("email", email).maybeSingle();
          userId = (byEmail as { id?: string } | null)?.id ?? null;
        }
        if (!userId) {
          runfolioLog.error("strava.oauth.callback.create_user", cErr ?? "create_user_failed", {});
          return redirectWith(request, "/auth/login?strava_error=account_setup_failed");
        }
      }
    }

    if (!userId) {
      return redirectWith(request, "/auth/login?strava_error=no_user");
    }

    await admin
      .from("users")
      .update({
        name: athlete.displayName,
        strava_profile_url: athlete.profileUrl,
        strava_athlete_id: athlete.id
      })
      .eq("id", userId);

    await upsertStravaUserCredentials(admin, userId, athlete.id, tokens);

    const redirectRes = NextResponse.redirect(new URL(nextPath, request.url));
    redirectRes.cookies.delete(STRAVA_OAUTH_STATE_COOKIE);
    redirectRes.cookies.delete(STRAVA_OAUTH_NEXT_COOKIE);
    redirectRes.cookies.delete(STRAVA_OAUTH_MODE_COOKIE);

    const routeSb = createSupabaseRouteHandlerClient(request, redirectRes);
    const signedIn = await establishSupabaseSessionForUserId(routeSb, userId, email);
    if (!signedIn.ok) {
      runfolioLog.error("strava.oauth.callback.session", signedIn.logDetail, { userId });
      return redirectWith(request, "/auth/login?strava_error=session_failed");
    }

    clearStravaTokenCookiesOnResponse(redirectRes);
    return redirectRes;
  } catch (e) {
    runfolioLog.error("strava.oauth.callback", e);
    return redirectWith(request, "/auth/login?strava_error=callback_failed");
  }
}
