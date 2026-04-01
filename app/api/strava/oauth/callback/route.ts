import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyStravaTokensToResponse, STRAVA_OAUTH_STATE_COOKIE } from "@/lib/strava-cookies";
import { getStravaClientCredentials, getStravaRedirectUri } from "@/lib/strava-env";
import { exchangeStravaCode } from "@/lib/strava-oauth";

export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const origin = reqUrl.origin;
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const err = reqUrl.searchParams.get("error");
  const errDesc = reqUrl.searchParams.get("error_description");

  const redirectWith = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (err) {
    const q = new URLSearchParams({
      strava_error: errDesc ?? err
    });
    return redirectWith(`/races/new?${q.toString()}`);
  }
  if (!code || !state) {
    return redirectWith("/races/new?strava_error=missing_code");
  }

  const jar = await cookies();
  const expected = jar.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  if (!expected || expected !== state) {
    return redirectWith("/races/new?strava_error=invalid_state");
  }

  const cred = getStravaClientCredentials();
  if (!cred) {
    return redirectWith("/races/new?strava_error=no_client");
  }

  const redirectUri = getStravaRedirectUri();

  try {
    const tokens = await exchangeStravaCode(code, cred.clientId, cred.clientSecret, redirectUri);
    const res = redirectWith("/races/new?strava=connected");
    res.cookies.delete(STRAVA_OAUTH_STATE_COOKIE);
    applyStravaTokensToResponse(res, tokens);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "token_exchange_failed";
    return redirectWith(`/races/new?strava_error=${encodeURIComponent(message)}`);
  }
}
