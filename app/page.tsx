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
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            Sign in or create an account, then connect Strava to import races and keep activities in sync.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/auth/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button variant="secondary">Create account</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
