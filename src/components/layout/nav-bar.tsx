"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { IntegrationChip } from "@/components/layout/integration-chip";
import {
  IconAirshed,
  IconConsole,
  IconCertificate,
  IconCounterfactual,
  IconValidation,
  IconFederation,
  IconReport,
  IconVoice,
  type IconProps,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  index: string;
  icon: (p: IconProps) => React.ReactElement;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Airshed", index: "00", icon: IconAirshed },
  { href: "/report", label: "Report", index: "01", icon: IconReport },
  { href: "/console", label: "Console", index: "02", icon: IconConsole },
  { href: "/advisory", label: "Advisory", index: "03", icon: IconVoice },
  { href: "/certificate", label: "Certificate", index: "04", icon: IconCertificate },
  { href: "/counterfactual", label: "Counterfactual", index: "05", icon: IconCounterfactual },
  { href: "/validation", label: "Validation", index: "06", icon: IconValidation },
  { href: "/federation", label: "Federation", index: "07", icon: IconFederation },
];

/* UTC clock. Rendered only after mount so server and client markup agree. */
function NodeClock() {
  const [stamp, setStamp] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setStamp(
        `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="readout text-2xs text-text-tertiary tabular-nums w-[62px] text-right">
      {stamp ?? "——:——"}
    </span>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 top-0 z-50 h-11 flex items-center px-4 transition-colors duration-300",
        lifted
          ? "bg-bg-void/92 backdrop-blur-[2px] border-b border-border-subtle"
          : "bg-transparent border-b border-transparent"
      )}
    >
      {/* Wordmark. The lozenge is the seal mark used throughout the system. */}
      <Link
        href="/"
        className="group mr-7 flex shrink-0 items-center gap-2.5"
        aria-label="PRAMANA home"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 1.5l10.5 10.5L12 22.5 1.5 12z"
            fill="none"
            stroke="var(--color-accent-verify)"
            strokeWidth="1.4"
          />
          <path d="M12 7.2l4.8 4.8-4.8 4.8-4.8-4.8z" fill="var(--color-accent-verify)" />
        </svg>
        <span className="font-display text-md font-semibold tracking-[0.01em] text-text-primary">
          PRAMĀNA
        </span>
      </Link>

      {/* Route rail */}
      <div className="flex min-w-0 items-stretch overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, index, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 border-r border-border-subtle/60 px-3 text-sm transition-colors duration-200 first:border-l",
                isActive
                  ? "text-accent-verify"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              <span
                className={cn(
                  "readout text-2xs transition-colors",
                  isActive ? "text-accent-verify/70" : "text-text-quaternary"
                )}
              >
                {index}
              </span>
              <Icon size={13} strokeWidth={1.3} />
              <span className="font-ui">{label}</span>
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-accent-verify" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Node status strip */}
      <div className="ml-auto flex shrink-0 items-center gap-4 pl-4">
        <IntegrationChip />
        <span className="label-technical hidden xl:inline">
          Node IN-01
        </span>
        <NodeClock />
        <span className="flex items-center gap-1.5">
          <span className="hazard-pulse block h-1.5 w-1.5 bg-accent-clear" />
          <span className="readout text-2xs text-text-tertiary">SYNC</span>
        </span>
      </div>
    </nav>
  );
}
