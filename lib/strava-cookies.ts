import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { StravaTokenResponse } from "@/lib/strava-oauth";

const ACCESS = "strava_access_token";
const REFRESH = "strava_refresh_token";
const EXPIRES = "strava_token_expires_at";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production"
};

export async function getStravaTokensFromCookies(): Promise<{
  accessToken: string | undefined;
  refreshToken: string | undefined;
  expiresAtSec: number | undefined;
}> {
  const jar = await cookies();
  const access = jar.get(ACCESS)?.value;
  const refresh = jar.get(REFRESH)?.value;
  const expRaw = jar.get(EXPIRES)?.value;
  const expiresAtSec = expRaw ? Number(expRaw) : undefined;
  return {
    accessToken: access,
    refreshToken: refresh,
    expiresAtSec: Number.isFinite(expiresAtSec) ? expiresAtSec : undefined
  };
}

export function applyStravaTokensToResponse(res: NextResponse, tokens: StravaTokenResponse): void {
  const maxAge = Math.max(60, tokens.expires_in);
  res.cookies.set(ACCESS, tokens.access_token, { ...cookieBase, maxAge });
  res.cookies.set(REFRESH, tokens.refresh_token, { ...cookieBase, maxAge: 60 * 60 * 24 * 180 });
  res.cookies.set(EXPIRES, String(tokens.expires_at), { ...cookieBase, maxAge });
}

/** Persist rotated tokens during a Server Component / server action (no Response object). */
export async function persistStravaTokensToCookies(tokens: StravaTokenResponse): Promise<void> {
  const jar = await cookies();
  const maxAge = Math.max(60, tokens.expires_in);
  jar.set(ACCESS, tokens.access_token, { ...cookieBase, maxAge });
  jar.set(REFRESH, tokens.refresh_token, { ...cookieBase, maxAge: 60 * 60 * 24 * 180 });
  jar.set(EXPIRES, String(tokens.expires_at), { ...cookieBase, maxAge });
}

export const STRAVA_OAUTH_STATE_COOKIE = "strava_oauth_state";
/** Safe internal path after OAuth (see parseSafeRedirectPath). */
export const STRAVA_OAUTH_NEXT_COOKIE = "strava_oauth_next";
/** `login` | `reconnect` */
export const STRAVA_OAUTH_MODE_COOKIE = "strava_oauth_mode";

/** Remove legacy cookie-based Strava tokens (tokens now live in DB per user). */
export function clearStravaTokenCookiesOnResponse(res: NextResponse): void {
  res.cookies.delete(ACCESS);
  res.cookies.delete(REFRESH);
  res.cookies.delete(EXPIRES);
}
