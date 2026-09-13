"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationChip } from "@/components/layout/integration-chip";

/*
   The masthead.

   A printed bar rather than a floating glass one: solid paper, a hard rule
   underneath, and a drawn seal beside the wordmark. It stays opaque at every
   scroll position because it sits over six scenes of saturated flat colour,
   and a translucent bar over those reads as a smear.

   The route list is long for a bar this plain, so it is split: the four
   surfaces a visitor actually moves between are always visible, and the
   analysis surfaces collapse behind a disclosure that is a link list, not a
   menu that needs managing.
*/

interface NavItem {
  href: string;
  label: string;
}

const PRIMARY: NavItem[] = [
  { href: "/report", label: "Report" },
  { href: "/console", label: "Console" },
  { href: "/advisory", label: "Advisory" },
  { href: "/certificate", label: "Certificate" },
];

const SECONDARY: NavItem[] = [
  { href: "/counterfactual", label: "Counterfactual" },
  { href: "/validation", label: "Validation" },
  { href: "/federation", label: "Federation" },
  { href: "/integration", label: "Google AI integration" },
];

function Seal({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 1.5l10.5 10.5L12 22.5 1.5 12z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.2l4.8 4.8-4.8 4.8-4.8-4.8z" fill="currentColor" />
    </svg>
  );
}

export function NavBar() {
  const pathname = usePathname();
  /*
     The disclosure records which route it was opened on, rather than a plain
     boolean reset by an effect. Navigating changes `pathname`, the comparison
     stops matching, and the panel closes on the same render as the new page —
     no effect, and no frame where a stale panel sits over fresh content.
  */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const toggle = () => setOpenFor(open ? null : pathname);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-ink-hair)] bg-[var(--color-stain-0)]/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-4 px-4 lg:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 text-[var(--color-ink)]"
          aria-label="PRAMANA home"
        >
          <Seal className="text-[var(--color-mark-bronze)] transition-transform duration-500 group-hover:rotate-90" />
          <span className="poster text-[1.02rem] tracking-[0.005em]">PRAMĀNA</span>
        </Link>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {PRIMARY.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "poster relative px-3 py-1.5 text-xs transition-colors",
                isActive(href)
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              )}
            >
              {label}
              {isActive(href) && (
                <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[var(--color-ink)]" />
              )}
            </Link>
          ))}

          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="poster flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
          >
            More
            <svg
              width="10" height="7" viewBox="0 0 10 7" fill="none" aria-hidden="true"
              className={cn("transition-transform duration-200", open && "rotate-180")}
            >
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <IntegrationChip />
          <Link
            href="/report"
            className="btn-flat hidden bg-[var(--color-ink)] px-4 py-2 text-xs text-[var(--color-stain-0)] transition-colors hover:bg-[var(--color-ink-soft)] sm:inline-block"
          >
            Report the sky
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label="Open navigation"
            className="md:hidden"
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
              <path d="M0 1h22M0 8h22M0 15h22" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--color-ink-hair)] bg-[var(--color-stain-1)]">
          <div className="mx-auto grid w-full max-w-[1500px] gap-px px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            {[...PRIMARY.map((p) => ({ ...p, mobileOnly: true })), ...SECONDARY].map(
              ({ href, label, ...rest }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "poster px-3 py-3 text-xs text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]",
                    "mobileOnly" in rest && "md:hidden"
                  )}
                >
                  {label}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
