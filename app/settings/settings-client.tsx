"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/lib/delete-account-action";
import { useShellPreferences } from "@/components/shell/shell-preferences-context";
import { Button } from "@/components/ui/button";
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{children}</h2>
  );
}

export function SettingsClient({ email, displayName, stravaConnected, stravaOAuthConfigured }: Props) {
  const router = useRouter();
  const { t, locale, setLocale, distanceUnits, setDistanceUnits } = useShellPreferences();
  const stravaOAuthHref = `/api/strava/oauth/start?next=${encodeURIComponent("/settings")}`;
  const [disconnectPending, startDisconnect] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [disconnectErr, setDisconnectErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const onDeleteAccount = () => {
    if (!window.confirm(t("settings.deleteAccountConfirm"))) return;
    setDeleteErr(null);
    startDelete(async () => {
      try {
        const r = await deleteAccountAction();
        if (r && "error" in r && r.error) setDeleteErr(r.error);
      } catch (e: unknown) {
        if (isRedirectError(e)) throw e;
        setDeleteErr(t("settings.deleteAccountFailed"));
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-12 px-5 pb-24 pt-10 md:px-6 md:pt-12">
      <header>
        <h1 className="font-display text-2xl font-normal tracking-tight text-white md:text-3xl">{t("settings.title")}</h1>
      </header>

      <section className="space-y-4 border-b border-white/10 pb-12">
        <SectionTitle>{t("settings.profileSection")}</SectionTitle>
        <dl className="space-y-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{t("settings.name")}</dt>
            <dd className="mt-1 text-[15px] text-white">{displayName.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{t("settings.email")}</dt>
            <dd className="mt-1 text-[15px] text-white tabular-nums">{email || "—"}</dd>
          </div>
        </dl>
      </section>

      <section id="settings-language" className="scroll-mt-28 space-y-5 border-b border-white/10 pb-12">
        <SectionTitle>{t("settings.preferencesSection")}</SectionTitle>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{t("footer.language")}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="mt-2 min-h-[48px] w-full rounded-xl border border-white/12 bg-[#12151c] px-3 text-[14px] text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label={t("settings.languageSection")}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {t(`language.${loc}`)}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{t("settings.units")}</span>
          <div className="mt-2 flex gap-2">
            {(["km", "miles"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDistanceUnits(u)}
                className={cn(
                  "min-h-[48px] flex-1 rounded-xl border text-[13px] font-semibold transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent/50",
                  distanceUnits === u
                    ? "border-accent/60 bg-accent/15 text-white"
                    : "border-white/12 bg-white/[0.04] text-white/75 hover:border-white/20"
                )}
              >
                {u === "km" ? t("settings.unitsKm") : t("settings.unitsMiles")}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-white/35">{t("settings.saveNote")}</p>
      </section>

      <section className="space-y-4 border-b border-white/10 pb-12">
        <SectionTitle>{t("settings.connectedSection")}</SectionTitle>
        <p className="text-[14px] text-white/80">{stravaConnected ? t("settings.stravaConnected") : t("settings.stravaNotConnected")}</p>
        {stravaOAuthConfigured ? (
          <Link
            href={stravaOAuthHref}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-white/[0.1]"
          >
            {stravaConnected ? t("settings.reconnectStrava") : t("settings.stravaConnect")}
          </Link>
        ) : (
          <p className="text-[12px] text-white/45">Strava OAuth is not configured.</p>
        )}
        {stravaOAuthConfigured && stravaConnected ? (
          <div className="pt-2">
            {disconnectErr ? (
              <p className="mb-2 text-sm text-red-300" role="alert">
                {disconnectErr}
              </p>
            ) : null}
            <button
              type="button"
              disabled={disconnectPending}
              className="text-[12px] font-medium text-white/40 underline-offset-4 hover:text-white/65 hover:underline disabled:opacity-50"
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
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-red-500/25 bg-red-950/[0.12] p-5">
        <SectionTitle>
          <span className="text-red-200/70">{t("settings.dangerSection")}</span>
        </SectionTitle>
        <p className="text-[13px] leading-relaxed text-white/55">{t("settings.deleteAccountHint")}</p>
        {deleteErr ? (
          <p className="text-sm text-red-300" role="alert">
            {deleteErr}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={deletePending}
          className="min-h-[48px] w-full border-red-400/40 bg-red-950/25 text-[12px] font-semibold uppercase tracking-[0.08em] text-red-200 hover:bg-red-950/45"
          onClick={onDeleteAccount}
        >
          {deletePending ? "…" : t("settings.deleteAccount")}
        </Button>
      </section>

      <div className="flex flex-col items-center gap-4 pt-4">
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45 transition hover:text-white/75"
          >
            {t("settings.signOut")}
          </button>
        </form>
        <Link href="/dashboard" className="text-[12px] font-medium text-accent underline-offset-4 hover:underline">
          {t("settings.backToApp")}
        </Link>
      </div>
    </div>
  );
}
