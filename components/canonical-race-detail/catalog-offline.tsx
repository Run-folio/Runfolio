import Link from "next/link";
import { AppNavbar } from "@/components/app-navbar";

export function CanonicalRaceCatalogOffline({ message }: { message: string }) {
  return (
    <>
      <AppNavbar />
      <main className="min-h-[60vh] bg-[#05070c] px-6 pb-20 pt-24">
        <div className="app-shell mx-auto max-w-lg text-center">
          <p className="type-eyebrow text-amber-200/80">Race catalog</p>
          <h1 className="font-display mt-4 text-2xl text-white">We couldn&apos;t load this race</h1>
          <p className="type-meta mt-4 text-sm leading-relaxed text-white/60">{message}</p>
          <Link
            href="/races/find"
            className="mt-8 inline-block text-[13px] font-semibold uppercase tracking-[0.12em] text-accent hover:underline"
          >
            ← Back to Find a race
          </Link>
        </div>
      </main>
    </>
  );
}
