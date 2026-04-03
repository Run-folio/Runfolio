"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/matches", label: "Match & import" },
  { href: "/races/new", label: "Add race" },
  { href: "/races/find", label: "Find a race" },
  { href: "/collections", label: "Collections" },
  { href: "/bucket-list", label: "Bucket List" }
] as const;

function isNavActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (href === "/collections") return pathname.startsWith("/collections");
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/matches") return pathname === "/matches" || pathname.startsWith("/matches/");
  return pathname.startsWith(`${href}/`);
}

type NavbarProps = {
  /** Public profile URL, e.g. /Alex%20Thompson */
  profileHref: string;
  profileInitial: string;
};

export function Navbar({ profileHref, profileInitial }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-[#1e2029]/95 backdrop-blur">
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
          <Link
            href={profileHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-panelAlt font-display text-sm font-semibold text-white ring-1 ring-white/10 transition hover:border-accent"
            title="Your public profile"
            aria-label="View your public profile"
          >
            {profileInitial}
          </Link>
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
