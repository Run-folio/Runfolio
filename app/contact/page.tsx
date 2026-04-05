import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmailCopy } from "@/components/contact-email-copy";

const CONTACT_EMAIL = "hello@runfolio.app";

export const metadata: Metadata = {
  title: "Contact · Runfolio",
  description: "Reach Runfolio — questions, feedback, or partnerships."
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#05070c] text-white">
      <div className="mx-auto max-w-lg px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <Link
          href="/"
          className="inline-flex text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50 transition hover:text-teal-hover"
        >
          ← Home
        </Link>

        <header className="mt-14 text-center md:mt-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">Contact</p>
          <h1 className="font-display mt-5 text-[clamp(2.25rem,6vw,3.25rem)] font-normal leading-tight tracking-tight text-white md:mt-6">
            Get in touch
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/50 md:text-lg">
            Questions, feedback, or partnership ideas — we&apos;d love to hear from you.
          </p>
        </header>

        <section className="mt-14 md:mt-16" aria-labelledby="contact-primary-heading">
          <h2 id="contact-primary-heading" className="sr-only">
            Email us
          </h2>
          <div className="rounded-2xl border border-white/[0.09] bg-[#0b0f18] p-8 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.75)] md:p-10">
            <div className="flex flex-col items-stretch gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="break-all text-xl font-medium tracking-tight text-teal underline-offset-4 transition hover:text-teal-hover hover:underline md:text-2xl"
                >
                  {CONTACT_EMAIL}
                </a>
                <p className="mt-4 text-[13px] leading-relaxed text-white/45">We usually reply within 24–48 hours.</p>
              </div>
              <ContactEmailCopy email={CONTACT_EMAIL} className="w-full shrink-0 sm:w-auto" />
            </div>
          </div>
        </section>

        <section className="mt-12 md:mt-14" aria-label="Other ways to reach us">
          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-7 md:px-7 md:py-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Feedback</p>
              <p className="mt-3 text-[15px] font-medium leading-snug text-white">Bugs and ideas</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">Same email — we read everything.</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-6 py-7 md:px-7 md:py-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Partnerships</p>
              <p className="mt-3 text-[15px] font-medium leading-snug text-white">Race organizers</p>
              <p className="mt-2 text-sm leading-relaxed text-white/45">Listings, collabs, or press.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
