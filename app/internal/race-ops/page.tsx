import Link from "next/link";
import { redirect } from "next/navigation";
import { raceOpsLoginAction } from "@/lib/races/internal/race-ops-actions";
import { readRaceOpsSessionValid } from "@/lib/races/internal/race-ops-auth";

type Props = { searchParams: Promise<{ e?: string }> };

export default async function RaceOpsLoginPage({ searchParams }: Props) {
  if (await readRaceOpsSessionValid()) {
    redirect("/internal/race-ops/dashboard");
  }
  const sp = await searchParams;
  const err =
    sp.e === "auth"
      ? "Invalid secret."
      : sp.e === "config"
        ? "RACE_OPS_SECRET is not set on the server."
        : null;

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-2xl font-normal text-white">Race ops login</h1>
      <p className="mt-2 text-sm text-white/65">
        Enter the server <code className="rounded bg-white/10 px-1">RACE_OPS_SECRET</code>. Session cookie is scoped to{" "}
        <code className="rounded bg-white/10 px-1">/internal/race-ops</code>.
      </p>
      {err ? (
        <p className="mt-6 rounded-lg border border-rose-400/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100">{err}</p>
      ) : null}
      <form action={raceOpsLoginAction} className="mt-8 space-y-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted">Secret</label>
        <input
          type="password"
          name="secret"
          required
          autoComplete="off"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/50"
        />
        <button
          type="submit"
          className="w-full rounded-lg bg-amber-600 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white hover:bg-amber-500"
        >
          Sign in
        </button>
      </form>
      <p className="mt-8 text-center text-[11px] text-muted">
        <Link href="/dashboard" className="text-accent underline-offset-4 hover:underline">
          ← Back to app
        </Link>
      </p>
    </main>
  );
}
