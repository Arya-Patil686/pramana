"use client";

import { useMemo, useState } from "react";
import type { AttributionEntry, Episode } from "@/data/mock-episodes";
import { cn } from "@/lib/utils";

/*
   The contribution register.

   Language discipline from the plan is enforced here: this is a register of
   contributions, not an accusation, and no figure is ever shown without its
   interval. Aggregation is computed from the same rows at every level, so the
   tehsil, district and state views cannot silently disagree with each other.
*/

type Level = "tehsil" | "district" | "state";

const SOURCE_META: Record<
  AttributionEntry["sourceType"],
  { label: string; colour: string }
> = {
  agricultural_burning: { label: "Biomass", colour: "#c8763f" },
  industrial: { label: "Industrial", colour: "var(--color-accent-signal)" },
  vehicular: { label: "Vehicular", colour: "var(--color-accent-clear)" },
  mixed: { label: "Mixed", colour: "#8e9aab" },
};

interface Row {
  key: string;
  primary: string;
  secondary: string;
  contribution: number;
  low: number;
  high: number;
  sourceType: AttributionEntry["sourceType"];
  isLocal: boolean;
}

function aggregate(
  entries: AttributionEntry[],
  level: Level,
  receptorState: string
): Row[] {
  const buckets = new Map<string, Row>();

  for (const e of entries) {
    const key =
      level === "tehsil"
        ? `${e.state}/${e.district}/${e.tehsil}`
        : level === "district"
          ? `${e.state}/${e.district}`
          : e.state;

    const primary =
      level === "tehsil" ? e.tehsil : level === "district" ? e.district : e.state;
    const secondary =
      level === "tehsil"
        ? `${e.district}, ${e.state}`
        : level === "district"
          ? e.state
          : e.nation;

    const existing = buckets.get(key);
    if (existing) {
      existing.contribution += e.contribution;
      // Intervals combine in quadrature: independent cell errors do not
      // simply add, and summing them linearly would overstate uncertainty.
      const prevSpread = existing.high - existing.contribution;
      const addSpread = e.confidenceHigh - e.contribution;
      const combined = Math.sqrt(prevSpread ** 2 + addSpread ** 2);
      existing.low = existing.contribution - combined;
      existing.high = existing.contribution + combined;
      if (existing.sourceType !== e.sourceType) existing.sourceType = "mixed";
    } else {
      buckets.set(key, {
        key,
        primary,
        secondary,
        contribution: e.contribution,
        low: e.confidenceLow,
        high: e.confidenceHigh,
        sourceType: e.sourceType,
        isLocal: e.state === receptorState,
      });
    }
  }

  return [...buckets.values()].sort((a, b) => b.contribution - a.contribution);
}

export function ContributionRegister({ episode }: { episode: Episode }) {
  const [level, setLevel] = useState<Level>("tehsil");
  const [hovered, setHovered] = useState<string | null>(null);

  // The receptor's own jurisdiction, so local sources can be separated out.
  const receptorState = useMemo(() => {
    const local = episode.attribution.find(
      (a) => a.district.includes(episode.receptorCity) || a.tehsil === "Local"
    );
    return local?.state ?? episode.receptorCity;
  }, [episode]);

  const rows = useMemo(
    () => aggregate(episode.attribution, level, receptorState),
    [episode, level, receptorState]
  );

  const max = Math.max(...rows.map((r) => r.high));
  const upwind = rows.filter((r) => !r.isLocal).reduce((s, r) => s + r.contribution, 0);
  const local = rows.filter((r) => r.isLocal).reduce((s, r) => s + r.contribution, 0);
  const total = upwind + local;

  // Interval on the headline number, combined in quadrature across cells.
  const upwindSpread = Math.sqrt(
    episode.attribution
      .filter((a) => a.state !== receptorState)
      .reduce((s, a) => s + (a.confidenceHigh - a.contribution) ** 2, 0)
  );

  const usedSources = [...new Set(rows.map((r) => r.sourceType))];

  return (
    <div className="panel bezel">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5">
        <span className="label-technical">Contribution register</span>
        <div className="flex items-stretch border border-border-default">
          {(["tehsil", "district", "state"] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              aria-pressed={level === l}
              className={cn(
                "readout px-2.5 py-1 text-2xs uppercase tracking-[0.1em] transition-colors",
                level === l
                  ? "bg-accent-verify/15 text-accent-verify"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Headline split */}
      <div className="border-b border-border-subtle px-3.5 py-4">
        <div className="flex items-baseline gap-2">
          <span className="readout text-2xl font-medium leading-none text-accent-verify">
            {upwind.toFixed(1)}
          </span>
          <span className="readout text-md text-text-tertiary">
            ± {upwindSpread.toFixed(1)}%
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
          of the projected PM<sub>2.5</sub> excess at {episode.receptorCity}{" "}
          originates outside the receptor jurisdiction, across{" "}
          {rows.filter((r) => !r.isLocal).length} {level}s. The remaining{" "}
          {local.toFixed(1)}% is local.
        </p>

        {/* Split bar */}
        <div className="mt-4 flex h-2.5 w-full overflow-hidden border border-border-default">
          <div
            className="bg-accent-verify"
            style={{ width: `${(upwind / total) * 100}%` }}
            title={`Upwind ${upwind.toFixed(1)}%`}
          />
          <div
            className="bg-accent-signal"
            style={{ width: `${(local / total) * 100}%` }}
            title={`Local ${local.toFixed(1)}%`}
          />
        </div>
        <div className="mt-2 flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="block h-1.5 w-1.5 bg-accent-verify" />
            <span className="readout text-2xs text-text-tertiary">
              Upwind {upwind.toFixed(1)}%
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="block h-1.5 w-1.5 bg-accent-signal" />
            <span className="readout text-2xs text-text-tertiary">
              Local {local.toFixed(1)}%
            </span>
          </span>
        </div>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-border-subtle">
        {rows.map((row) => {
          const active = hovered === row.key;
          const meta = SOURCE_META[row.sourceType];
          return (
            <li
              key={row.key}
              onMouseEnter={() => setHovered(row.key)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] items-center gap-3 px-3.5 py-2.5 transition-colors",
                active && "bg-bg-surface-2"
              )}
            >
              {/* Label */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="block h-2 w-2 shrink-0"
                    style={{ background: meta.colour }}
                  />
                  <span className="truncate text-sm text-text-primary">
                    {row.primary}
                  </span>
                  {row.isLocal && (
                    <span className="readout shrink-0 border border-accent-signal-dim px-1 text-2xs text-accent-signal">
                      LOCAL
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate pl-4 text-2xs text-text-quaternary">
                  {row.secondary}
                </div>
              </div>

              {/* Bar with confidence whisker */}
              <div className="relative h-6">
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <div
                    className="h-2.5 transition-[width] duration-300"
                    style={{
                      width: `${(row.contribution / max) * 100}%`,
                      background: meta.colour,
                      opacity: active ? 1 : 0.78,
                    }}
                  />
                </div>
                {/* Interval */}
                <div
                  className="absolute top-1/2 h-px -translate-y-1/2 bg-text-tertiary"
                  style={{
                    left: `${(row.low / max) * 100}%`,
                    width: `${((row.high - row.low) / max) * 100}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-text-tertiary"
                  style={{ left: `${(row.low / max) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-text-tertiary"
                  style={{ left: `${(row.high / max) * 100}%` }}
                />
              </div>

              {/* Value */}
              <div className="text-right">
                <div className="readout text-sm text-text-primary">
                  {row.contribution.toFixed(1)}%
                </div>
                <div className="readout text-2xs text-text-quaternary">
                  {row.low.toFixed(1)}–{row.high.toFixed(1)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Legend and method note */}
      <div className="border-t border-border-subtle px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="label-technical">Emission class</span>
          {usedSources.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="block h-1.5 w-1.5"
                style={{ background: SOURCE_META[s].colour }}
              />
              <span className="readout text-2xs text-text-tertiary">
                {SOURCE_META[s].label}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
          Intervals are bootstrap 90% bounds on the trajectory ensemble.
          Aggregated intervals combine in quadrature, not linearly. This is a
          register of modelled contributions and carries no finding of fault.
        </p>
      </div>
    </div>
  );
}
