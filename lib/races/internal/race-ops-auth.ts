import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import {
  RACE_OPS_SESSION_COOKIE,
  verifyRaceOpsSessionCookieValue
} from "@/lib/races/internal/race-ops-token";

export function raceOpsEnabled(): boolean {
  return Boolean(process.env.RACE_OPS_SECRET?.trim());
}

export function getRaceOpsSecret(): string | null {
  return process.env.RACE_OPS_SECRET?.trim() ?? null;
}

export async function readRaceOpsSessionValid(): Promise<boolean> {
  const secret = getRaceOpsSecret();
  if (!secret) return false;
  const jar = await cookies();
  return verifyRaceOpsSessionCookieValue(jar.get(RACE_OPS_SESSION_COOKIE)?.value, secret);
}

/** Use in internal layouts / server pages. */
export async function assertRaceOpsSession(): Promise<void> {
  if (!raceOpsEnabled()) notFound();
  const ok = await readRaceOpsSessionValid();
  if (!ok) redirect("/internal/race-ops");
}
