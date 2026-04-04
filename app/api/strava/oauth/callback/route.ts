import { NextResponse, type NextRequest } from "next/server";
import {
  STRAVA_OAUTH_MODE_COOKIE,
  STRAVA_OAUTH_NEXT_COOKIE,
  STRAVA_OAUTH_STATE_COOKIE,
  clearStravaTokenCookiesOnResponse
} from "@/lib/strava-cookies";
import { getStravaClientCredentials, resolveStravaRedirectUri } from "@/lib/strava-env";
import { exchangeStravaCode } from "@/lib/strava-oauth";
import { stravaOauthTrace } from "@/lib/strava-oauth-trace";
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

  const uriRes = resolveStravaRedirectUri(request);
  stravaOauthTrace("oauth_callback_received", {
    has_error_param: Boolean(err),
    has_code: Boolean(code),
    has_state_param: Boolean(state),
    ...(uriRes.ok
      ? {
          redirect_uri: uriRes.redirectUri,
          redirect_source: uriRes.source,
          request_origin: uriRes.requestOrigin
        }
      : { redirect_uri_resolution_failed: true })
  });

  if (!uriRes.ok) {
    runfolioLog.error("strava.oauth.callback", uriRes.message);
    return redirectWith(request, "/auth/login?strava_error=oauth_config");
  }

  const redirectUri = uriRes.redirectUri;

  if (err) {
    runfolioLog.error("strava.oauth.callback.denied", errDesc ?? err);
    stravaOauthTrace("oauth_aborted", { reason: "strava_error_param", redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=strava_access_denied");
  }
  if (!code || !state) {
    stravaOauthTrace("oauth_aborted", { reason: "missing_code_or_state", redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=missing_code");
  }

  const stateCookie = request.cookies.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) {
    stravaOauthTrace("oauth_aborted", {
      reason: "invalid_state",
      has_state_cookie: Boolean(stateCookie),
      redirect_uri: redirectUri,
      redirect_source: uriRes.source
    });
    return redirectWith(request, "/auth/login?strava_error=invalid_state");
  }

  const mode = request.cookies.get(STRAVA_OAUTH_MODE_COOKIE)?.value ?? "login";
  stravaOauthTrace("oauth_state_ok", { mode, redirect_uri: redirectUri });

  const cred = getStravaClientCredentials();
  if (!cred) {
    stravaOauthTrace("oauth_aborted", { reason: "no_strava_client_env", redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=no_client");
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    runfolioLog.error("strava.oauth.callback", "admin_client_unavailable");
    stravaOauthTrace("session_create_failed", { reason: "service_role_missing", redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=server_unavailable");
  }

  const nextRaw = request.cookies.get(STRAVA_OAUTH_NEXT_COOKIE)?.value ?? "/dashboard";
  const nextPath = parseSafeRedirectPath(nextRaw) ?? "/dashboard";

  let tokens;
  try {
    tokens = await exchangeStravaCode(code, cred.clientId, cred.clientSecret, redirectUri);
  } catch (e) {
    runfolioLog.error("strava.oauth.callback.token_exchange", e);
    stravaOauthTrace("token_exchange_failed", {
      redirect_uri: redirectUri,
      message: e instanceof Error ? e.message.slice(0, 200) : "unknown"
    });
    return redirectWith(request, "/auth/login?strava_error=token_exchange_failed");
  }

  if (!tokens?.access_token?.trim()) {
    runfolioLog.error("strava.oauth.callback.token_exchange", "missing access_token in Strava response");
    stravaOauthTrace("token_exchange_failed", { reason: "no_access_token", redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=token_exchange_failed");
  }

  stravaOauthTrace("token_exchange_ok", {
    redirect_uri: redirectUri,
    has_refresh_token_in_response: Boolean(tokens.refresh_token?.trim()),
    expires_at: tokens.expires_at ?? null
  });

  const athlete = await fetchStravaAthleteForAuth(tokens.access_token);
  if (!athlete) {
    stravaOauthTrace("athlete_fetch_failed", { redirect_uri: redirectUri });
    return redirectWith(request, "/auth/login?strava_error=athlete_fetch_failed");
  }

  stravaOauthTrace("athlete_fetch_ok", { athlete_id: athlete.id, redirect_uri: redirectUri });

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
        stravaOauthTrace("reconnect_failed", { reason: "no_supabase_session", redirect_uri: redirectUri });
        return redirectWith(request, `/auth/login?next=${encodeURIComponent(nextPath)}&strava_error=reconnect_requires_login`);
      }
      const uid = session.user.id;

      const { data: prof } = await admin.from("users").select("strava_athlete_id").eq("id", uid).maybeSingle();
      const expected = (prof as { strava_athlete_id?: string | null } | null)?.strava_athlete_id?.trim();
      const credRow = await getStravaCredentialsForUser(admin, uid);
      const linkedAthlete = expected ?? credRow?.athlete_id;
      if (linkedAthlete && linkedAthlete !== athlete.id) {
        stravaOauthTrace("reconnect_failed", {
          reason: "wrong_strava_athlete",
          linked_athlete: linkedAthlete,
          strava_athlete: athlete.id,
          redirect_uri: redirectUri
        });
        return redirectWith(request, "/auth/login?strava_error=wrong_strava_account");
      }

      try {
        await upsertStravaUserCredentials(admin, uid, athlete.id, tokens);
      } catch (upsertErr) {
        runfolioLog.error("strava.oauth.callback.credentials_upsert", upsertErr, { userId: uid });
        stravaOauthTrace("credentials_upsert_failed", {
          flow: "reconnect",
          user_id: uid,
          message: upsertErr instanceof Error ? upsertErr.message.slice(0, 200) : "unknown"
        });
        stravaOauthTrace("reconnect_failed", { phase: "credentials_upsert", redirect_uri: redirectUri });
        return redirectWith(request, "/auth/login?strava_error=credentials_save_failed");
      }

      stravaOauthTrace("credentials_upsert_ok", { flow: "reconnect", user_id: uid, redirect_uri: redirectUri });

      await admin
        .from("users")
        .update({
          name: athlete.displayName,
          strava_profile_url: athlete.profileUrl,
          strava_athlete_id: athlete.id
        })
        .eq("id", uid);

      clearStravaTokenCookiesOnResponse(redirectRes);
      stravaOauthTrace("reconnect_ok", { user_id: uid, athlete_id: athlete.id, redirect_uri: redirectUri, next_path: nextPath });
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
          stravaOauthTrace("session_create_failed", { phase: "create_auth_user", redirect_uri: redirectUri });
          return redirectWith(request, "/auth/login?strava_error=account_setup_failed");
        }
      }
    }

    if (!userId) {
      stravaOauthTrace("session_create_failed", { phase: "no_user_id", redirect_uri: redirectUri });
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

    try {
      await upsertStravaUserCredentials(admin, userId, athlete.id, tokens);
    } catch (upsertErr) {
      runfolioLog.error("strava.oauth.callback.credentials_upsert", upsertErr, { userId });
      stravaOauthTrace("credentials_upsert_failed", {
        flow: "login",
        user_id: userId,
        message: upsertErr instanceof Error ? upsertErr.message.slice(0, 200) : "unknown"
      });
      stravaOauthTrace("session_create_failed", { phase: "credentials_upsert", redirect_uri: redirectUri });
      return redirectWith(request, "/auth/login?strava_error=credentials_save_failed");
    }

    stravaOauthTrace("credentials_upsert_ok", { flow: "login", user_id: userId, redirect_uri: redirectUri });

    const redirectRes = NextResponse.redirect(new URL(nextPath, request.url));
    redirectRes.cookies.delete(STRAVA_OAUTH_STATE_COOKIE);
    redirectRes.cookies.delete(STRAVA_OAUTH_NEXT_COOKIE);
    redirectRes.cookies.delete(STRAVA_OAUTH_MODE_COOKIE);

    const routeSb = createSupabaseRouteHandlerClient(request, redirectRes);
    const signedIn = await establishSupabaseSessionForUserId(routeSb, userId, email);
    if (!signedIn.ok) {
      runfolioLog.error("strava.oauth.callback.session", signedIn.logDetail, { userId });
      stravaOauthTrace("session_create_failed", { user_id: userId, redirect_uri: redirectUri });
      return redirectWith(request, "/auth/login?strava_error=session_failed");
    }

    stravaOauthTrace("session_create_ok", { user_id: userId, redirect_uri: redirectUri, next_path: nextPath });
    clearStravaTokenCookiesOnResponse(redirectRes);
    return redirectRes;
  } catch (e) {
    runfolioLog.error("strava.oauth.callback", e);
    stravaOauthTrace("oauth_aborted", {
      reason: "unhandled_callback_error",
      message: e instanceof Error ? e.message.slice(0, 160) : "unknown",
      redirect_uri: redirectUri
    });
    return redirectWith(request, "/auth/login?strava_error=callback_failed");
  }
}
