import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy · Runfolio",
  description: "Runfolio privacy overview."
};

export default function PrivacyPage() {
  return (
    <main className="app-shell min-h-screen py-16">
      <Link href="/" className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-3xl font-normal text-white">Privacy</h1>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
        We take your data seriously. This page will be expanded with a full privacy policy. For now, account and Strava
        data are used only to provide Runfolio features you enable. Contact us with questions via the Contact page.
      </p>
    </main>
  );
}
