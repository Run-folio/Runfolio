import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getRaceSceneImagePath } from "@/lib/race-scene-images";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About · Runfolio",
  description: "Your races, your story — a running portfolio."
};

const valueBlocks = [
  {
    title: "Track your races",
    line: "Finishes in one place."
  },
  {
    title: "Reflect on your journey",
    line: "Notes, photos, meaning — not only splits."
  },
  {
    title: "Build your story",
    line: "A profile worth sharing."
  }
] as const;

const exampleRaces = [
  { label: "Spring marathon", meta: "42.2 km · April", sceneSeed: "Marathon finish" },
  { label: "Trail ultra", meta: "56 km · mountain", sceneSeed: "Alpine trail race" },
  { label: "Local 10K", meta: "10 km · hometown", sceneSeed: "Road race 10K" }
] as const;

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#05070c] text-white">
      <div className="mx-auto max-w-6xl px-5 pb-28 pt-10 md:px-8 md:pt-14">
        <Link
          href="/"
          className="inline-flex text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50 transition hover:text-teal-hover"
        >
          ← Home
        </Link>

        <header className="mx-auto mt-16 max-w-3xl text-center md:mt-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Runfolio</p>
          <h1 className="font-display mt-6 text-[clamp(2.75rem,8vw,4.75rem)] font-normal leading-[1.05] tracking-tight text-white">
            Your race portfolio.
          </h1>
          <p className="mx-auto mt-8 max-w-lg text-lg font-normal leading-snug text-white/55 md:text-xl">
            The races you ran — remembered the way you want.
          </p>
        </header>

        <section className="mx-auto mt-28 max-w-4xl md:mt-36">
          <ul className="grid gap-16 md:grid-cols-3 md:gap-10 lg:gap-14">
            {valueBlocks.map((b, i) => (
              <li key={b.title} className="text-center md:text-left">
                <span className="font-display text-4xl font-normal tabular-nums text-white/[0.08] md:text-5xl">{i + 1}</span>
                <h2 className="font-display mt-3 text-xl font-normal leading-tight tracking-tight text-white md:text-2xl">{b.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/45">{b.line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-28 max-w-5xl md:mt-32">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">A glimpse of the app</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-5">
            {exampleRaces.map((r, idx) => (
              <div
                key={r.label}
                className={cn(
                  "group overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0f18] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)] transition duration-300 hover:border-white/[0.14]",
                  idx === 1 && "sm:translate-y-4 sm:shadow-[0_32px_70px_-24px_rgba(212,175,55,0.12)]"
                )}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={getRaceSceneImagePath(r.sceneSeed)}
                    alt=""
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width:640px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#05070c] via-transparent to-transparent opacity-90" />
                </div>
                <div className="space-y-1 px-4 py-4">
                  <p className="font-medium tracking-tight text-white">{r.label}</p>
                  <p className="text-[12px] text-white/45">{r.meta}</p>
                  <span className="mt-2 inline-block rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-200/90">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto mt-28 flex flex-col items-center md:mt-36">
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-accent px-8 text-[13px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_16px_40px_-12px_rgba(212,175,55,0.55)] transition hover:bg-gold-hover"
          >
            Start building your race story
          </Link>
        </div>
      </div>
    </main>
  );
}
