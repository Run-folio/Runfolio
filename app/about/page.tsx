import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · Runfolio",
  description: "Runfolio — a curated running portfolio."
};

export default function AboutPage() {
  return (
    <main className="app-shell min-h-screen py-16">
      <Link href="/" className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-3xl font-normal text-white">About Runfolio</h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
        Runfolio helps you curate your race history, connect Strava, and share a public profile built on the races that
        matter to you.
      </p>
    </main>
  );
}
