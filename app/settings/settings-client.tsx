"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useShellPreferences } from "@/components/shell/shell-preferences-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { disconnectStravaAction } from "@/lib/strava-disconnect-action";
import { signOutAction } from "@/lib/sign-out-action";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  displayName: string;
  stravaConnected: boolean;
  stravaOAuthConfigured: boolean;
};

export function SettingsClient({ email, displayName, stravaConnected, stravaOAuthConfigured }: Props) {
  const router = useRouter();
  const { t, locale, setLocale, textSize, setTextSize, reduceMotion, setReduceMotion } = useShellPreferences();
  const stravaOAuthHref = `/api/strava/oauth/start?next=${encodeURIComponent("/settings")}`;
  const [disconnectPending, startDisconnect] = useTransition();
  const [disconnectErr, setDisconnectErr] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 px-4 pb-20 pt-8 md:px-6 md:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-normal tracking-tight text-white md:text-3xl">{t("settings.title")}</h1>
        <p className="text-sm text-muted">{t("settings.saveNote")}</p>
      </header>

      <Card className="space-y-4 border border-white/10 bg-panel/35 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{t("settings.accountSection")}</h2>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t("settings.email")}</p>
          <p className="text-sm text-white">{email || "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t("settings.name")}</p>
          <p className="text-sm text-white">{displayName || "—"}</p>
        </div>
      </Card>

      <Card className="space-y-4 border border-white/10 bg-panel/35 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{t("settings.stravaSection")}</h2>
        <p className="text-sm text-white/85">
          {stravaConnected ? t("settings.stravaConnected") : t("settings.stravaNotConnected")}
        </p>
        {stravaOAuthConfigured ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={stravaOAuthHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-white/[0.1]"
            >
              {stravaConnected ? t("settings.reconnectStrava") : t("settings.stravaConnect")}
            </Link>
            <Link
              href="/my-races"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl px-4 text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-accent underline-offset-4 hover:underline"
            >
              {t("settings.openMyRaces")}
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">Strava OAuth is not configured on this server.</p>
        )}
        {stravaOAuthConfigured && stravaConnected ? (
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-muted">{t("settings.disconnectStravaHint")}</p>
            {disconnectErr ? (
              <p className="mt-2 text-sm text-red-300" role="alert">
                {disconnectErr}
              </p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={disconnectPending}
              className="mt-3 min-h-[48px] w-full border-white/15 text-[12px]"
              onClick={() => {
                if (!window.confirm(t("settings.disconnectStravaConfirm"))) return;
                setDisconnectErr(null);
                startDisconnect(async () => {
                  const r = await disconnectStravaAction();
                  if (r.ok) router.refresh();
                  else setDisconnectErr(r.error);
                });
              }}
            >
              {disconnectPending ? "…" : t("settings.disconnectStrava")}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="space-y-4 border border-white/10 bg-panel/35 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{t("settings.languageSection")}</h2>
        <label className="block text-[12px] text-muted">
          <span className="mb-2 block font-medium text-white/80">{t("footer.language")}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="min-h-[48px] w-full max-w-md rounded-xl border border-white/15 bg-[#151820] px-3 py-2 text-[14px] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t("settings.languageSection")}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {t(`language.${loc}`)}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="space-y-5 border border-white/10 bg-panel/35 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{t("settings.displaySection")}</h2>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-[12px] font-medium text-white/85">{t("settings.textSize")}</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["default", t("settings.textSizeDefault")],
                ["large", t("settings.textSizeLarge")]
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTextSize(value)}
                className={cn(
                  "min-h-[48px] min-w-[7rem] rounded-xl border px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  textSize === value
                    ? "border-accent bg-accent/15 text-white"
                    : "border-white/15 bg-white/[0.04] text-white/80 hover:border-white/25"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-white">{t("settings.reduceMotion")}</span>
            <span className="mt-1 block text-xs text-muted">{t("settings.reduceMotionHint")}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={reduceMotion}
            onClick={() => setReduceMotion(!reduceMotion)}
            className={cn(
              "relative mt-2 h-11 w-[3.25rem] shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:mt-0",
              reduceMotion ? "border-accent bg-accent/40" : "border-white/20 bg-white/10"
            )}
          >
            <span
              className={cn(
                "absolute top-1.5 h-8 w-8 rounded-full bg-white shadow transition",
                reduceMotion ? "left-7" : "left-1.5"
              )}
              aria-hidden
            />
          </button>
        </label>
      </Card>

      <form action={signOutAction} className="pt-2">
        <Button
          type="submit"
          variant="secondary"
          className="min-h-[48px] w-full border-red-400/25 text-red-100/95 hover:bg-red-950/40 hover:text-red-50"
        >
          {t("settings.signOut")}
        </Button>
      </form>

      <p className="text-center">
        <Link href="/dashboard" className="text-[13px] font-semibold text-accent underline-offset-4 hover:underline">
          {t("settings.backToApp")}
        </Link>
      </p>
    </div>
  );
}
