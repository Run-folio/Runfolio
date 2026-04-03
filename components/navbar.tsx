"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition, type MouseEvent } from "react";
import { signOutAction } from "@/lib/sign-out-action";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/matches", label: "Match & import" },
  { href: "/races/new", label: "Add race" },
  { href: "/races/find", label: "Find a race" },
  { href: "/compare", label: "Compare" },
  { href: "/collections", label: "Collections" },
  { href: "/bucket-list", label: "Bucket List" }
] as const;

function isNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/collections") return pathname.startsWith("/collections");
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/matches") return pathname === "/matches" || pathname.startsWith("/matches/");
  if (href === "/compare") return pathname === "/compare";
  return pathname.startsWith(`${href}/`);
}

type NavbarProps = {
  /** Public profile URL, e.g. /Alex%20Thompson */
  profileHref: string;
  profileInitial: string;
};

function ProfileNavAvatar({ profileHref, profileInitial }: { profileHref: string; profileInitial: string }) {
  const router = useRouter();
  const [navPending, startNavTransition] = useTransition();

  const onClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      startNavTransition(() => {
        router.push(profileHref);
      });
    },
    [router, profileHref]
  );

  return (
    <a
      href={profileHref}
      className={cn(
        "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-accent/50 bg-panelAlt font-display text-sm font-semibold text-white ring-1 ring-white/10 transition hover:border-accent",
        navPending && "pointer-events-none opacity-60"
      )}
      title="Your public profile"
      aria-label="View your public profile"
      aria-busy={navPending}
      onClick={onClick}
    >
      {profileInitial}
    </a>
  );
}

export function Navbar({ profileHref, profileInitial }: NavbarProps) {
  const pathname = usePathname();
  const { canPersist, reason, status, message, ctaHref, ctaLabel } = usePersistence();
  const hidePersistenceBanner =
    pathname === "/" || (pathname?.startsWith("/auth") ?? false);
  const showPersistenceBanner = !hidePersistenceBanner && !canPersist && Boolean(reason ?? message);
  const bannerTone =
    status === "auth_required"
      ? "border-sky-500/35 bg-sky-950/45 text-sky-50/95"
      : "border-amber-500/35 bg-amber-950/50 text-amber-50/95";
  const kickerClass =
    status === "auth_required"
      ? "font-semibold uppercase tracking-wider text-sky-200/90"
      : "font-semibold uppercase tracking-wider text-amber-200/90";
  const linkClass =
    status === "auth_required"
      ? "font-semibold text-sky-100 underline-offset-2 hover:underline"
      : "font-semibold text-amber-100 underline-offset-2 hover:underline";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-[#1e2029]/95 backdrop-blur">
      {showPersistenceBanner ? (
        <div className={cn("w-full border-b px-4 py-2.5 text-center text-[11px] leading-snug", bannerTone)} role="status">
          <span className={kickerClass}>
            {status === "auth_required" ? "Sign in to save · " : "Saves unavailable · "}
          </span>
          {reason ?? message}{" "}
          {ctaHref ? (
            <Link href={ctaHref} className={linkClass}>
              {ctaLabel ?? "Next step"}
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/dashboard" className="flex shrink-0 flex-col gap-1">
          <Image
            src="/branding/runfolio-logo.png"
            alt="Runfolio"
            width={220}
            height={48}
            className="h-10 w-auto max-w-[min(220px,50vw)] object-contain object-left"
            priority
          />
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Built on effort. Remembered forever.</p>
        </Link>
        <nav className="order-3 flex w-full flex-1 basis-full items-center justify-center gap-6 md:order-none md:w-auto md:basis-auto md:gap-10">
          {links.map(({ href, label }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors md:text-[11px]",
                  active ? "border-b-2 border-accent pb-1 text-white" : "text-muted hover:text-white"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          {!canPersist && pathname !== "/setup" ? (
            <Link
              href={buildSetupUrl(pathname && pathname !== "/" ? pathname : "/dashboard")}
              className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-accent hover:text-white sm:inline"
            >
              Setup
            </Link>
          ) : null}
          <ProfileNavAvatar profileHref={profileHref} profileInitial={profileInitial} />
          <form action={signOutAction}>
            <Button variant="secondary" className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em]" type="submit">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
