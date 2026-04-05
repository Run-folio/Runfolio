import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms · Runfolio",
  description: "Runfolio terms of use (summary)."
};

export default function TermsPage() {
  return (
    <main className="app-shell min-h-screen py-16">
      <Link href="/" className="text-[13px] font-semibold text-teal underline-offset-4 hover:text-teal-hover hover:underline">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-3xl font-normal text-white">Terms</h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
        A complete terms of service will be published here. By using Runfolio you agree to use the service responsibly.
        Strava is a trademark of Strava, Inc.; Runfolio is not endorsed by Strava.
      </p>
    </main>
  );
}
