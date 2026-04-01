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

export const STRAVA_OAUTH_STATE_COOKIE = "strava_oauth_state";
