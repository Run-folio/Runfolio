import { NextResponse } from "next/server";
import { STRAVA_OAUTH_NEXT_COOKIE, STRAVA_OAUTH_STATE_COOKIE } from "@/lib/strava-cookies";
import { getStravaClientCredentials, resolveStravaRedirectUri } from "@/lib/strava-env";
import { stravaAuthorizeUrl } from "@/lib/strava-oauth";
import { stravaOauthTrace } from "@/lib/strava-oauth-trace";
import { parseSafeRedirectPath } from "@/lib/safe-redirect-path";
import { createClient } from "@/lib/supabase/server";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 600
};

/**
 * Strava OAuth is **data connection only**: user must already be signed in (email/password).
 * After authorize, callback links tokens to the current Supabase user.
 */
export async function GET(request: Request) {
  const cred = getStravaClientCredentials();
  if (!cred) {
    return NextResponse.json(
      { error: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local (see README)." },
      { status: 500 }
    );
  }

  const uriRes = resolveStravaRedirectUri(request);
  if (!uriRes.ok) {
    return NextResponse.json({ error: uriRes.message }, { status: 500 });
  }

  const reqUrl = new URL(request.url);
  const nextParam = reqUrl.searchParams.get("next") ?? "/dashboard";
  const nextPath = parseSafeRedirectPath(nextParam) ?? "/dashboard";

  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    const login = new URL("/auth/login", reqUrl.origin);
    login.searchParams.set("next", nextPath);
    login.searchParams.set("notice", "strava_requires_signin");
    stravaOauthTrace("oauth_aborted", { reason: "connect_requires_session", nextPath });
    return NextResponse.redirect(login);
  }

  const state = crypto.randomUUID();
  const authorize = stravaAuthorizeUrl({
    clientId: cred.clientId,
    redirectUri: uriRes.redirectUri,
    state
  });

  stravaOauthTrace("oauth_authorize_url_built", {
    redirect_uri: uriRes.redirectUri,
    redirect_source: uriRes.source,
    request_origin: uriRes.requestOrigin,
    flow: "strava_connect",
    nextPath,
    user_id: session.user.id
  });

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STRAVA_OAUTH_STATE_COOKIE, state, cookieBase);
  res.cookies.set(STRAVA_OAUTH_NEXT_COOKIE, nextPath, cookieBase);
  return res;
}
