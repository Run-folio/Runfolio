"use client";

import Link from "next/link";
import { useShellPreferences } from "@/components/shell/shell-preferences-context";
import { resolveMessage, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
const linkClass =
  "inline-flex min-h-[44px] items-center rounded-lg px-2 text-[13px] font-medium text-white/75 underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

export function SiteFooter() {
  const { locale, setLocale, messages } = useShellPreferences();
  const t = (path: string) => resolveMessage(messages, path);

  return (
    <footer className="mt-auto border-t border-border bg-[#0c0e14]/95" role="contentinfo">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-8 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4 md:px-6 md:py-10">
        <nav aria-label={t("footer.language")} className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-2">
          <Link href="/about" className={linkClass}>
            {t("footer.about")}
          </Link>
          <Link href="/privacy" className={linkClass}>
            {t("footer.privacy")}
          </Link>
          <Link href="/terms" className={linkClass}>
            {t("footer.terms")}
          </Link>
          <Link href="/contact" className={linkClass}>
            {t("footer.contact")}
          </Link>
          <Link href="/settings" className={linkClass}>
            {t("footer.settings")}
          </Link>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <label className="flex min-h-[44px] flex-wrap items-center gap-2 text-[12px] text-muted">
            <span className="sr-only sm:not-sr-only sm:font-medium">{t("footer.language")}</span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              className="min-h-[44px] min-w-[10rem] rounded-xl border border-white/15 bg-[#151820] px-3 py-2 text-[13px] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              aria-label={t("footer.language")}
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {resolveMessage(messages, `language.${loc}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-4 text-center md:px-6">
        <p className="text-[11px] text-muted">{t("footer.tagline")}</p>
      </div>
    </footer>
  );
}
