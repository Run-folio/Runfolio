import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact · Runfolio",
  description: "Contact Runfolio."
};

export default function ContactPage() {
  return (
    <main className="app-shell min-h-screen py-16">
      <Link href="/" className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-3xl font-normal text-white">Contact</h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
        For support or partnerships, reach out through your usual project channel. A dedicated support email and form may
        be added here for launch.
      </p>
    </main>
  );
}
