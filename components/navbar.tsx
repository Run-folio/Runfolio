"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition
} from "react";
import { signOutAction } from "@/lib/sign-out-action";
import { usePersistence } from "@/components/persistence-context";
import { OVERVIEW_PATH } from "@/lib/app-paths";
import { buildSetupUrl } from "@/lib/setup-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Primary destinations — same on mobile and desktop. `profileHref` is the signed-in user’s public profile path. */
function primaryNavLinks(profileHref: string) {
  return [
    { href: OVERVIEW_PATH, label: "Overview" },
    { href: profileHref, label: "Profile" },
    { href: "/my-races", label: "My Races" },
    { href: "/races/new", label: "Add Race" },
    { href: "/bucket-list", label: "Bucket List" }
  ] as const;
}

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
  if (href === OVERVIEW_PATH) return pathname === OVERVIEW_PATH;
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

const menuLinkClass =
  "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-white/90 transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e2029]";

const HOVER_MENU_LEAVE_MS = 160;

function useHoverMenuPlatform() {
  const [matches, setMatches] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return matches;
}

function AvatarFace({
  profileInitial,
  profileImageUrl
}: {
  profileInitial: string;
  profileImageUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(profileImageUrl?.trim()) && !imgFailed;

  return (
    <>
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
    </>
  );
}

function UserAvatarMenu({
  profileHref,
  profileInitial,
  profileImageUrl,
  menuId
}: {
  profileHref: string;
  profileInitial: string;
  profileImageUrl?: string | null;
  menuId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hoverPlatform = useHoverMenuPlatform();
  const [open, setOpen] = useState(false);
  const [navPending, startNavTransition] = useTransition();
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement | null>(null);
  const size = "h-10 w-10";

  const clearLeaveTimer = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!hoverPlatform) return;
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setOpen(false), HOVER_MENU_LEAVE_MS);
  }, [hoverPlatform, clearLeaveTimer]);

  const openMenu = useCallback(() => {
    clearLeaveTimer();
    setOpen(true);
  }, [clearLeaveTimer]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /** Outside tap/click closes menu (all platforms); capture so it runs consistently on touch. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (!containerRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** Touch / click-toggle: move focus into the menu for keyboard users. Skip hover-desktop so mouse hover does not steal focus. */
  useEffect(() => {
    if (!open || hoverPlatform) return;
    const id = window.requestAnimationFrame(() => {
      const first = containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      first?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, hoverPlatform]);

  const onAvatarClick = useCallback(() => {
    if (hoverPlatform) {
      startNavTransition(() => {
        router.push(profileHref);
      });
      return;
    }
    setOpen((o) => !o);
  }, [hoverPlatform, router, profileHref]);

  const avatarClass = cn(
    "relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-accent/50 bg-panelAlt font-display text-sm font-semibold text-white ring-1 ring-white/10 transition hover:border-accent",
    size,
    navPending && "pointer-events-none opacity-60",
    !hoverPlatform && open && "border-accent ring-accent/30"
  );

  const panel = (
    <div
      id={menuId}
      role="menu"
      aria-orientation="vertical"
      aria-hidden={!open}
      className={cn(
        "w-[min(calc(100vw-2rem),15.5rem)] origin-top-right rounded-xl border border-white/12 bg-[#161821] py-2 shadow-xl shadow-black/50 ring-1 ring-white/5 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"
      )}
      onMouseEnter={hoverPlatform ? openMenu : undefined}
      onMouseLeave={hoverPlatform ? scheduleClose : undefined}
    >
      <div className="px-1.5 pb-1 pt-0.5" role="none">
        <Link href={profileHref} role="menuitem" className={menuLinkClass}>
          Profile
        </Link>
        <Link href="/settings" role="menuitem" className={menuLinkClass}>
          Settings
        </Link>
        <Link href="/settings#settings-language" role="menuitem" className={menuLinkClass}>
          Language
        </Link>
      </div>

      <div className="mx-2 my-1.5 border-t border-white/10" role="separator" />

      <div className="px-1.5 py-1" role="none">
        <Link href="/about" role="menuitem" className={menuLinkClass}>
          About
        </Link>
        <Link href="/privacy" role="menuitem" className={menuLinkClass}>
          Privacy
        </Link>
        <Link href="/terms" role="menuitem" className={menuLinkClass}>
          Terms
        </Link>
        <Link href="/contact" role="menuitem" className={menuLinkClass}>
          Contact
        </Link>
      </div>

      <div className="mx-2 my-1.5 border-t border-white/10" role="separator" />

      <div className="px-1.5 pb-0.5 pt-1" role="none">
        <form action={signOutAction}>
          <button
            type="submit"
            role="menuitem"
            className={cn(
              menuLinkClass,
              "text-red-300/95 hover:bg-red-950/35 focus-visible:ring-red-400/30"
            )}
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onMouseEnter={hoverPlatform ? openMenu : undefined}
      onMouseLeave={hoverPlatform ? scheduleClose : undefined}
    >
      <button
        ref={avatarButtonRef}
        type="button"
        className={avatarClass}
        title={hoverPlatform ? "Profile" : "Account menu"}
        aria-label={hoverPlatform ? "Go to your public profile (tap for account menu on mobile)" : "Open account menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={navPending}
        onClick={onAvatarClick}
      >
        <AvatarFace profileInitial={profileInitial} profileImageUrl={profileImageUrl} />
      </button>
      <div
        className={cn(
          "absolute right-0 top-full z-[60] flex justify-end pt-1.5",
          !open && "pointer-events-none"
        )}
      >
        {panel}
      </div>
    </div>
  );
}

export function Navbar({ profileHref, profileInitial, profileImageUrl }: NavbarProps) {
  const pathname = usePathname();
  const menuId = useId();
  const accountMenuId = useId();
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

  const primary = primaryNavLinks(profileHref);

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
        <Link href={OVERVIEW_PATH} className="flex min-w-0 shrink items-center">
          <Image
            src="/branding/runfolio-logo.png"
            alt="Runfolio"
            width={220}
            height={48}
            className="h-9 w-auto max-w-[min(200px,48vw)] object-contain object-left md:h-10"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {primary.map(({ href, label }) => {
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
              href={buildSetupUrl(pathname && pathname !== "/" ? pathname : OVERVIEW_PATH)}
              className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-teal hover:text-teal-hover lg:inline"
            >
              Setup
            </Link>
          ) : null}
          <UserAvatarMenu
            profileHref={profileHref}
            profileInitial={profileInitial}
            profileImageUrl={profileImageUrl}
            menuId={accountMenuId}
          />

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
          className={cn(
            "absolute inset-0 bg-black/65 transition-opacity",
            menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-label="Close menu"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-[min(100vw,20rem)] flex-col border-l border-border bg-[#1a1c24] shadow-2xl transition-transform duration-200 ease-out",
            menuOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
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
            {primary.map(({ href, label }) => {
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
                href={buildSetupUrl(pathname && pathname !== "/" ? pathname : OVERVIEW_PATH)}
                className="mt-2 flex min-h-[48px] items-center rounded-xl border border-white/10 px-4 text-[13px] font-semibold text-teal hover:text-teal-hover"
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
