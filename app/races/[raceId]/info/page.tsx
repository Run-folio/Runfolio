import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppNavbar } from "@/components/app-navbar";
import { getRaceById } from "@/lib/get-race-by-id";
import { formatRaceMonth } from "@/lib/format-race-date";
import { getRaceLogoPath } from "@/lib/race-logos";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";

type Props = {
  params: Promise<{ raceId: string }>;
};

function formatRaceDateLong(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export default async function RaceInfoPage({ params }: Props) {
  const { raceId } = await params;
  const race = await getRaceById(raceId);
  if (!race) notFound();
  if (race.is_completed) {
    redirect(`/races/${raceId}/activity`);
  }

  const scene = getRaceSceneImagePath(race.name);
  const logo = getRaceLogoPath(race.name);
  const monthShort = formatRaceMonth(race.date);

  return (
    <>
      <AppNavbar />
      <section className="hero-full min-h-[280px]">
        <div className="hero-bg">
          <Image src={scene} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[280px] flex-col justify-end pb-10">
          <Link
            href="/dashboard"
            className="mb-6 w-fit text-[13px] font-medium text-white/70 transition hover:text-white"
          >
            ← Back
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="type-tagline mb-2 text-[#c85a4a]">Race information</p>
              <h1 className="type-display max-w-4xl">{race.name}</h1>
              {monthShort ? (
                <p className="type-tagline mt-3 text-white/80">{formatRaceDateLong(race.date)}</p>
              ) : null}
            </div>
            <div className="relative h-16 w-40 shrink-0 bg-black/30 p-2 md:h-20 md:w-48">
              <Image src={logo} alt="" fill className="object-contain p-1" sizes="192px" />
            </div>
          </div>
        </div>
      </section>

      <main className="app-shell space-y-8 pb-16">
        <dl className="grid gap-4 border border-white/10 bg-[#0a0a0a] p-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { k: "Distance", v: race.distance_km != null ? `${race.distance_km} km` : "—" },
            { k: "Elevation", v: race.elevation_m != null ? `${race.elevation_m} m` : "—" },
            { k: "Location", v: race.location ?? "—" },
            { k: "Target date", v: monthShort || "—" }
          ].map(({ k, v }) => (
            <div key={k}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{k}</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{v}</dd>
            </div>
          ))}
        </dl>

        {race.description ? (
          <div className="border border-white/10 bg-[#0d0d0d] p-6">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Notes</h2>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-[15px] leading-relaxed text-white/90">
              {race.description}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 border border-white/10 bg-[#0d0d0d] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Sign up</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {race.signup_url
                ? "Open the official registration page for this event."
                : "Add a registration URL to this race in your database to link signups here."}
            </p>
          </div>
          {race.signup_url ? (
            <a
              href={race.signup_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-[12px] border border-[#d4af37]/60 bg-[#d4af37]/10 px-6 py-3 text-[14px] font-semibold text-[#d4af37] transition hover:bg-[#d4af37]/20"
            >
              Sign up · opens in new tab
            </a>
          ) : null}
        </div>
      </main>
    </>
  );
}
