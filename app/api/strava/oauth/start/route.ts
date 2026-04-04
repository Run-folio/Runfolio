import { NextResponse } from "next/server";
import {
  STRAVA_OAUTH_MODE_COOKIE,
  STRAVA_OAUTH_NEXT_COOKIE,
  STRAVA_OAUTH_STATE_COOKIE
} from "@/lib/strava-cookies";
import { getStravaClientCredentials, getStravaOAuthPublicOrigin, getStravaRedirectUri } from "@/lib/strava-env";
import { stravaAuthorizeUrl } from "@/lib/strava-oauth";
import { stravaOauthTrace } from "@/lib/strava-oauth-trace";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 600
};

export async function GET(request: Request) {
  const cred = getStravaClientCredentials();
  if (!cred) {
    return NextResponse.json(
      { error: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local (see README)." },
      { status: 500 }
    );
  }

  const reqUrl = new URL(request.url);
  const nextParam = reqUrl.searchParams.get("next") ?? "/dashboard";
  const nextPath = parseSafeRedirectPath(nextParam) ?? "/dashboard";
  const mode = reqUrl.searchParams.get("mode") === "reconnect" ? "reconnect" : "login";

  const state = crypto.randomUUID();
  const redirectUri = getStravaRedirectUri(request);
  const authorize = stravaAuthorizeUrl({ clientId: cred.clientId, redirectUri, state });
  stravaOauthTrace("oauth_redirect_started", {
    mode,
    nextPath,
    requestOrigin: getStravaOAuthPublicOrigin(request),
    usingEnvRedirectUri: Boolean(
      process.env.STRAVA_REDIRECT_URI?.trim() || process.env.STRAVA_OAUTH_REDIRECT_URI?.trim()
    )
  });
  if (process.env.RUNFOLIO_STRAVA_OAUTH_DEBUG === "1") {
    stravaOauthTrace("oauth_redirect_uri_verbose", { redirectUri });
  }
  const res = NextResponse.redirect(authorize);
  res.cookies.set(STRAVA_OAUTH_STATE_COOKIE, state, cookieBase);
  res.cookies.set(STRAVA_OAUTH_NEXT_COOKIE, nextPath, cookieBase);
  res.cookies.set(STRAVA_OAUTH_MODE_COOKIE, mode, cookieBase);
  return res;
}
