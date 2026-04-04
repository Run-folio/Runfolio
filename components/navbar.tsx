"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState, useTransition, type MouseEvent } from "react";
import { signOutAction } from "@/lib/sign-out-action";
import { usePersistence } from "@/components/persistence-context";
import { buildSetupUrl } from "@/lib/setup-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary destinations — same on mobile and desktop. */
const primaryLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/my-races", label: "My Races" },
  { href: "/races/new", label: "Add Race" },
  { href: "/bucket-list", label: "Bucket List" }
] as const;

/** Secondary — drawer only; keeps top bar minimal. */
const secondaryLinks = [
  { href: "/races/find", label: "Find a race" },
  { href: "/compare", label: "Compare" },
  { href: "/collections", label: "Collections" },
  { href: "/settings", label: "Settings" }
] as const;

function isNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/my-races") return pathname === "/my-races" || pathname.startsWith("/my-races/");
  if (href === "/bucket-list") return pathname === "/bucket-list" || pathname.startsWith("/bucket-list/");
  if (href === "/races/new") return pathname === "/races/new";
  if (href === "/collections") return pathname.startsWith("/collections");
  if (href === "/compare") return pathname === "/compare";
  if (href === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
  if (href === "/races/find") return pathname === "/races/find" || pathname.startsWith("/races/find/");
  return pathname.startsWith(`${href}/`);
}

type NavbarProps = {
  profileHref: string;
  profileInitial: string;
  profileImageUrl?: string | null;
};

function ProfileNavAvatar({
  profileHref,
  profileInitial,
  profileImageUrl,
  compact = false
}: {
  profileHref: string;
  profileInitial: string;
  profileImageUrl?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [navPending, startNavTransition] = useTransition();
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(profileImageUrl?.trim()) && !imgFailed;
  const size = compact ? "h-10 w-10" : "h-9 w-9";

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
        "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-accent/50 bg-panelAlt font-display text-sm font-semibold text-white ring-1 ring-white/10 transition hover:border-accent",
        size,
        navPending && "pointer-events-none opacity-60"
      )}
      title="Profile"
      aria-label="Open your public profile"
      aria-busy={navPending}
      onClick={onClick}
    >
      {showPhoto ? (
        <img
          src={profileImageUrl!}
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        profileInitial
      )}
    </a>
  );
}

export function Navbar({ profileHref, profileInitial, profileImageUrl }: NavbarProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navLinkClass = (active: boolean) =>
    cn(
      "flex min-h-[52px] items-center rounded-xl px-4 text-[13px] font-semibold tracking-wide transition-colors md:min-h-0 md:rounded-none md:px-0 md:py-1 md:text-[11px] md:uppercase md:tracking-[0.18em]",
      active ? "bg-accent/15 text-white md:border-b-2 md:border-accent md:bg-transparent" : "text-white/70 hover:bg-white/[0.06] hover:text-white md:hover:bg-transparent"
    );

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

      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
        <Link href="/dashboard" className="flex min-w-0 shrink flex-col gap-0.5">
          <Image
            src="/branding/runfolio-logo.png"
            alt="Runfolio"
            width={220}
            height={48}
            className="h-9 w-auto max-w-[min(200px,48vw)] object-contain object-left md:h-10"
            priority
          />
          <p className="hidden text-[10px] uppercase tracking-[0.18em] text-muted sm:block">
            Built on effort. Remembered forever.
          </p>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {primaryLinks.map(({ href, label }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link key={href} href={href} className={navLinkClass(active)}>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          {!canPersist && pathname !== "/setup" ? (
            <Link
              href={buildSetupUrl(pathname && pathname !== "/" ? pathname : "/dashboard")}
              className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-accent hover:text-white lg:inline"
            >
              Setup
            </Link>
          ) : null}
          <ProfileNavAvatar
            profileHref={profileHref}
            profileInitial={profileInitial}
            profileImageUrl={profileImageUrl}
            compact
          />
          <form action={signOutAction} className="hidden md:block">
            <Button variant="secondary" className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em]" type="submit">
              Log out
            </Button>
          </form>

          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="sr-only">{menuOpen ? "Close navigation" : "Open navigation"}</span>
            {menuOpen ? (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed inset-0 z-[100] md:hidden",
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          className={cn("absolute inset-0 bg-black/65 transition-opacity", menuOpen ? "opacity-100" : "opacity-0")}
          aria-label="Close menu"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-[min(100vw,20rem)] flex-col border-l border-border bg-[#1a1c24] shadow-2xl transition-transform duration-200 ease-out",
            menuOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Menu</span>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] rounded-lg text-white/80 hover:bg-white/10"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pb-8" aria-label="Mobile primary">
            {primaryLinks.map(({ href, label }) => {
              const active = isNavActive(pathname, href);
              return (
                <Link key={href} href={href} className={navLinkClass(active)} onClick={() => setMenuOpen(false)}>
                  {label}
                </Link>
              );
            })}

            <p className="mt-6 px-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">More</p>
            {secondaryLinks.map(({ href, label }) => {
              const active = isNavActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(navLinkClass(active), "min-h-[48px] text-[13px] font-medium text-white/65")}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              );
            })}

            {!canPersist && pathname !== "/setup" ? (
              <Link
                href={buildSetupUrl(pathname && pathname !== "/" ? pathname : "/dashboard")}
                className="mt-2 flex min-h-[48px] items-center rounded-xl border border-white/10 px-4 text-[13px] font-semibold text-accent"
                onClick={() => setMenuOpen(false)}
              >
                Setup
              </Link>
            ) : null}
          </nav>

          <div className="border-t border-border p-3">
            <form action={signOutAction}>
              <Button type="submit" variant="secondary" className="h-12 w-full text-[13px] font-semibold">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
