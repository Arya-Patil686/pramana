"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconIntegration } from "@/components/icons";

/*
   Live Google AI status, pinned in the navigation bar.

   This sits in the chrome rather than on a page because the claim it carries
   is one a visitor should never have to go looking for. It reports how many
   Google capabilities are keyed on this deployment, and it tells the truth
   when the answer is none — a demo running entirely on recorded output says
   so in the navigation bar, on every page.
*/

interface Summary {
  live: number;
  total: number;
}

export function IntegrationChip() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integration")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.summary) setSummary(d.summary);
      })
      .catch(() => {
        /* The chip is diagnostic; a failure to load it must not surface. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = summary?.live ?? 0;
  const total = summary?.total ?? 6;
  const anyLive = live > 0;

  return (
    <Link
      href="/integration"
      title={
        anyLive
          ? `${live} of ${total} Google capabilities are live on this deployment`
          : "No Google API key is configured; every capability is serving recorded output"
      }
      className="group flex items-center gap-1.5 border border-border-subtle px-2 py-1 transition-colors hover:border-accent-verify/60"
    >
      <IconIntegration
        size={12}
        strokeWidth={1.3}
        className={anyLive ? "text-accent-clear" : "text-text-quaternary"}
      />
      <span className="readout text-2xs text-text-tertiary transition-colors group-hover:text-text-secondary">
        GOOGLE AI
      </span>
      <span
        className={`readout text-2xs ${anyLive ? "text-accent-clear" : "text-accent-verify"}`}
      >
        {summary ? `${live}/${total}` : "—"}
      </span>
    </Link>
  );
}
