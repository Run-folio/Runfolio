"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";

function StravaOAuthResultBannerInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = searchParams.get("strava_error")?.trim();

  const clear = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("strava_error");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [pathname, router, searchParams]);

  if (!code) return null;

  const messages: Record<string, string> = {
    strava_access_denied: "Strava didn’t approve the connection. You can try Connect Strava again from Settings or My Races.",
    wrong_strava_account:
      "This Strava athlete doesn’t match your saved connection. Disconnect Strava in Settings if you need to switch accounts.",
    token_exchange_failed: "Couldn’t complete Strava authorization. Check STRAVA_REDIRECT_URI and try again.",
    athlete_fetch_failed: "Strava connected but we couldn’t load your athlete profile. Try again in a moment.",
    no_client: "Strava isn’t configured on this server.",
    server_unavailable: "Server couldn’t save your connection. Try again later.",
    missing_code: "The Strava flow was interrupted. Try Connect Strava again.",
    credentials_save_failed: "Couldn’t save Strava tokens. Check logs and database access."
  };

  const text = messages[code] ?? "Something went wrong connecting Strava.";

  return (
    <div
      className="mb-6 rounded-xl border border-amber-400/35 bg-amber-950/35 px-4 py-3 text-sm text-amber-50/95"
      role="status"
    >
      <p>{text}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="text-[12px] font-semibold text-teal underline-offset-2 hover:text-teal-hover hover:underline" onClick={clear}>
          Dismiss
        </button>
        <Link href="/settings" className="text-[12px] font-semibold text-white/80 underline-offset-2 hover:underline">
          Settings
        </Link>
      </div>
    </div>
  );
}

/** Shows a dismissible banner when `?strava_error=` is present (after OAuth callback). */
export function StravaOAuthResultBanner() {
  return (
    <Suspense fallback={null}>
      <StravaOAuthResultBannerInner />
    </Suspense>
  );
}
