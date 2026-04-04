import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "rf_race_ops_sess";

export const RACE_OPS_SESSION_COOKIE = COOKIE_NAME;

/** 7-day internal session; cookie does not contain the raw secret. */
const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(`v1|${payload}`).digest("base64url");
}

export function buildRaceOpsSessionCookieValue(secret: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const sig = sign(secret, String(exp));
  const value = `${exp}.${sig}`;
  return { value, maxAge: MAX_AGE_SEC };
}

export function verifyRaceOpsSessionCookieValue(raw: string | undefined, secret: string): boolean {
  if (!raw?.trim() || !secret) return false;
  const [expStr, sig] = raw.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(secret, String(exp));
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
