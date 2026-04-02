import { NextResponse } from "next/server";
import { STRAVA_OAUTH_STATE_COOKIE } from "@/lib/strava-cookies";
import { getStravaClientCredentials, getStravaRedirectUri } from "@/lib/strava-env";
import { stravaAuthorizeUrl } from "@/lib/strava-oauth";

export async function GET(request: Request) {
  const cred = getStravaClientCredentials();
  if (!cred) {
    return NextResponse.json(
      { error: "Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env.local (see README)." },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = getStravaRedirectUri(request);
  const authorize = stravaAuthorizeUrl({ clientId: cred.clientId, redirectUri, state });
  const res = NextResponse.redirect(authorize);
  res.cookies.set(STRAVA_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600
  });
  return res;
}
