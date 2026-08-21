"use client";

import { useMemo } from "react";
import Link from "next/link";
import { EPISODES } from "@/data/mock-episodes";
import { useAppStore, type Corridor } from "@/store/app-store";
import { CorridorReplay } from "@/components/figures/corridor-replay";
import { ForecastChart } from "@/components/figures/forecast-chart";
import { ContributionRegister } from "@/components/figures/contribution-register";
import { Shell, Readout, StatusChip } from "@/components/ui/primitives";
import { IconArrowRight, IconSatellite, IconStation, IconWind } from "@/components/icons";
import { getGRAPStage, cn } from "@/lib/utils";

/*
   Operator console.

   The corridor switch is the point of this page. Both corridors run the same
   components against the same schema with no branching on which one is
   selected, which is the portability claim made checkable rather than
   asserted on a slide.
*/

const CORRIDORS: { id: Corridor; label: string; nation: string }[] = [
  { id: "punjab-delhi", label: "Punjab → Delhi NCR", nation: "India" },
  { id: "chiangmai-bangkok", label: "N. Thailand → Bangkok", nation: "Thailand" },
];

export default function ConsolePage() {
  const activeCorridor = useAppStore((s) => s.activeCorridor);
  const setActiveCorridor = useAppStore((s) => s.setActiveCorridor);

  const episode = useMemo(
    () => EPISODES.find((e) => e.corridor === activeCorridor) ?? EPISODES[0],
    [activeCorridor]
  );

  const grap = getGRAPStage(episode.peakAQI);
  const upwind = episode.attribution
    .filter((a) => a.tehsil !== "Local")
    .reduce((s, a) => s + a.contribution, 0);
  const meanWind =
    episode.windVectors.reduce((s, w) => s + w.speed, 0) / episode.windVectors.length;

  return (
    <div className="pb-24">
      {/* Command strip */}
      <div className="sticky top-11 z-30 border-b border-border-subtle bg-bg-void/92 backdrop-blur-[2px]">
        <Shell wide className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
          <div className="flex items-stretch border border-border-default">
            {CORRIDORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCorridor(c.id)}
                aria-pressed={activeCorridor === c.id}
                className={cn(
                  "px-3 py-1.5 text-sm transition-colors",
                  activeCorridor === c.id
                    ? "bg-accent-verify/15 text-accent-verify"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="readout text-2xs text-text-quaternary">
              {episode.id}
            </span>
            <StatusChip tone="hazard" pulse>
              GRAP {episode.grapStage}
            </StatusChip>
          </div>

          <span className="ml-auto readout text-2xs text-text-quaternary">
            Same pipeline, same schema, zero code change between corridors
          </span>
        </Shell>
      </div>

      <Shell wide className="pt-10">
        <header className="max-w-3xl">
          <div className="label-technical">Operator console</div>
          <h1 className="mt-3 font-display text-xl font-medium text-text-primary sm:text-2xl">
            {episode.name}
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            {episode.sourceRegion} to {episode.receptorCity}. Detection,
            forecast and attribution for a single episode, replayed from the
            information state that was actually available at each issue time.
          </p>
        </header>

        {/* Vitals */}
        <div className="mt-9 grid grid-cols-2 gap-px bg-border-subtle lg:grid-cols-6">
          <Readout label="Peak AQI" value={episode.peakAQI} tone="hazard" hint={grap.label} />
          <Readout
            label="Lead time"
            value={episode.leadTimeHours}
            unit="h"
            tone="clear"
            hint="Before crossing"
          />
          <Readout
            label="Upwind share"
            value={`${upwind.toFixed(1)}%`}
            tone="verify"
            hint="Outside jurisdiction"
          />
          <Readout
            label="Hotspots"
            value={episode.fireHotspots.length}
            hint="FIRMS detections"
          />
          <Readout
            label="Mean wind"
            value={meanWind.toFixed(1)}
            unit="m/s"
            tone="signal"
            hint="925 hPa"
          />
          <Readout
            label="Stations"
            value={episode.stationReadings.length}
            hint="Reference monitors"
          />
        </div>

        {/* Forecast */}
        <div className="mt-10">
          <ForecastChart episode={episode} stage={episode.grapStage} />
        </div>

        {/* Map and attribution */}
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <CorridorReplay episode={episode} />
          </div>
          <div className="lg:col-span-5">
            <ContributionRegister episode={episode} />
          </div>
        </div>

        {/* Ingest status */}
        <div className="mt-10 panel bezel">
          <div className="border-b border-border-subtle px-3.5 py-2.5">
            <span className="label-technical">Ingest status</span>
          </div>
          <div className="grid gap-px bg-border-subtle sm:grid-cols-3">
            {[
              {
                icon: IconSatellite,
                name: "Sentinel-5P TROPOMI",
                detail: "NO₂, SO₂, aerosol index",
                latency: "OFFL · 26 h",
                tone: "clear" as const,
              },
              {
                icon: IconStation,
                name: "NASA FIRMS",
                detail: "VIIRS + MODIS active fire",
                latency: "NRT · 3 h",
                tone: "clear" as const,
              },
              {
                icon: IconWind,
                name: "ECMWF ERA5",
                detail: "u/v winds, PBL height",
                latency: "Cached slice",
                tone: "verify" as const,
              },
            ].map((f) => (
              <div key={f.name} className="bg-bg-surface px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <f.icon size={14} className="text-text-tertiary" />
                  <span className="text-sm text-text-primary">{f.name}</span>
                </div>
                <div className="mt-1.5 text-2xs text-text-quaternary">
                  {f.detail}
                </div>
                <div className="mt-3">
                  <StatusChip tone={f.tone}>{f.latency}</StatusChip>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border-subtle px-3.5 py-3">
            <p className="text-2xs leading-relaxed text-text-quaternary">
              Every granule is hashed on the way in. Those digests are the
              leaves of the certificate issued for this episode, which is what
              makes the attribution reproducible rather than merely published.
            </p>
          </div>
        </div>

        {/* Handoff */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/certificate"
            className="group inline-flex items-center gap-2.5 border border-accent-verify bg-accent-verify/10 px-5 py-2.5 text-sm text-accent-verify transition-colors hover:bg-accent-verify/20"
          >
            Seal this episode
            <IconArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/counterfactual"
            className="inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
          >
            Run a suppression scenario
          </Link>
        </div>
      </Shell>
    </div>
  );
}
