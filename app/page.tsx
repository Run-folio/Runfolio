import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="hero-full min-h-[min(100vh,720px)]">
        <div className="hero-bg" style={{ backgroundImage: "url('/reference/hero-2.png')" }} />
        <div className="hero-overlay" />
        <div className="hero-inner flex min-h-[min(100vh,720px)] flex-col items-center justify-center text-center">
          <p className="type-eyebrow">Runfolio</p>
          <h1 className="type-display mt-6 max-w-4xl">
            A portfolio of your races,
            <br />
            not just your miles.
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-slate-300">
            Curate your most meaningful races, import your history, and share a public profile that honors your effort.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/api/strava/oauth/start?next=%2Fdashboard">
              <Button>Continue with Strava</Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
