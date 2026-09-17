"use client";

import { useMemo } from "react";
import Link from "next/link";
import { EPISODES } from "@/data/mock-episodes";
import { useAppStore } from "@/store/app-store";
import { Shell, Readout, StatusChip } from "@/components/ui/primitives";
import { IconArrowRight, IconExposure } from "@/components/icons";
import { aqiToColor, getGRAPStage, formatNumber, cn } from "@/lib/utils";

/*
   Counterfactual simulator.

   Every number on this page is derived, not authored. Suppressing a district
   removes its share of the modelled excess; the peak, the GRAP stage and the
   exposure-hours all fall out of that one arithmetic step applied to the
   episode's own contribution register. The baseline concentration is what
   remains when every upwind source in the register is fully suppressed, so
   the slider cannot drive the city to zero, which would be dishonest.
*/

const episode = EPISODES[0];

/* Stated assumptions, surfaced in the UI rather than buried. */
const BASELINE_AQI = 138;
const RECEPTOR_POPULATION = 32_900_000; // Delhi NCR agglomeration
const EXPOSURE_THRESHOLD = 301; // GRAP Stage II, "Very Poor"

const W = 1000;
const H = 220;
const PAD = { top: 14, right: 16, bottom: 26, left: 42 };

export default function CounterfactualPage() {
  const sources = useAppStore((s) => s.suppressedSources);
  const setLevel = useAppStore((s) => s.setSourceSuppressionLevel);
  const setSources = useAppStore((s) => s.setSuppressedSources);

  /* Join the store's source list onto the episode's contribution register. */
  const joined = useMemo(
    () =>
      sources.map((s) => {
        const entry = episode.attribution.find(
          (a) => a.district.toLowerCase() === s.name.toLowerCase()
        );
        return {
          ...s,
          contribution: entry?.contribution ?? 0,
          tehsil: entry?.tehsil ?? "—",
          state: entry?.state ?? "—",
        };
      }),
    [sources]
  );

  /* Fraction of the modelled excess removed by the current settings. */
  const removedPct = joined.reduce(
    (sum, s) => sum + s.contribution * (s.suppressionLevel / 100),
    0
  );

  const excess = episode.peakAQI - BASELINE_AQI;
  const retained = 1 - removedPct / 100;
  const newPeak = Math.round(BASELINE_AQI + excess * retained);

  const beforeStage = getGRAPStage(episode.peakAQI);
  const afterStage = getGRAPStage(newPeak);
  const stageChanged = beforeStage.stage !== afterStage.stage;

  /* Exposure-hours, computed by scaling the episode curve by the same factor. */
  const exposure = useMemo(() => {
    const hoursOver = (scale: number) =>
      episode.forecast.filter(
        (p) => BASELINE_AQI + (p.pramana - BASELINE_AQI) * scale >= EXPOSURE_THRESHOLD
      ).length;
    const before = hoursOver(1);
    const after = hoursOver(retained);
    return {
      before,
      after,
      avertedHours: before - after,
      avertedPersonHours: (before - after) * RECEPTOR_POPULATION,
    };
  }, [retained]);

  const anyActive = removedPct > 0.05;

  const x = (h: number) => PAD.left + ((h + 48) / 96) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - (v / 550) * (H - PAD.top - PAD.bottom);
  const curve = (scale: number) =>
    episode.forecast
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${x(p.hour).toFixed(1)} ${y(
            BASELINE_AQI + (p.pramana - BASELINE_AQI) * scale
          ).toFixed(1)}`
      )
      .join(" ");

  return (
    <div className="pb-24">
      <Shell wide className="pt-12">
        <header className="max-w-3xl">
          <div className="label-technical">Counterfactual simulator</div>
          <h1 className="mt-3 font-display text-xl font-medium text-text-primary sm:text-2xl">
            Suppress named sources. Re-run the forecast.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            Because the attribution engine is forward-composable, source cells
            can be zeroed and the episode re-solved. This turns a monitoring
            output into a decision: which specific districts would have to stop
            burning, for how long, to keep the receptor city out of a given
            GRAP stage.
          </p>
          <p className="mt-4 border border-[var(--color-ink-hair)] bg-bg-void px-3.5 py-2.5 text-sm leading-relaxed text-text-secondary">
            <span className="label-technical mr-2">Illustrative</span>
            Runs on a sample episode record, not on the live register the
            console computes. It shows the decision this output enables; wiring it
            to the live engine is on the roadmap.
          </p>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          {/* Controls */}
          <div className="lg:col-span-5">
            <div className="panel bezel">
              <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
                <span className="label-technical">Suppression scenario</span>
                <button
                  type="button"
                  onClick={() =>
                    setSources(
                      sources.map((s) => ({ ...s, suppressed: false, suppressionLevel: 0 }))
                    )
                  }
                  className="readout text-2xs text-text-tertiary transition-colors hover:text-text-primary"
                >
                  RESET
                </button>
              </div>

              <ul className="divide-y divide-border-subtle">
                {joined.map((s) => (
                  <li key={s.id} className="px-3.5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-sm text-text-primary">{s.name}</span>
                        <span className="readout ml-2 text-2xs text-text-quaternary">
                          {s.tehsil}
                        </span>
                      </div>
                      <span className="readout shrink-0 text-2xs text-accent-verify">
                        {s.contribution.toFixed(1)}%
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={s.suppressionLevel}
                        onChange={(e) => setLevel(s.id, Number(e.target.value))}
                        aria-label={`Suppression level for ${s.name}`}
                        className="w-full accent-[var(--color-accent-verify)]"
                      />
                      <span
                        className={cn(
                          "readout w-11 shrink-0 text-right text-2xs",
                          s.suppressionLevel > 0
                            ? "text-accent-verify"
                            : "text-text-quaternary"
                        )}
                      >
                        {s.suppressionLevel}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-border-subtle px-3.5 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="label-technical">Excess removed</span>
                  <span className="readout text-md text-accent-verify">
                    {removedPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="panel mt-6 p-4">
              <div className="label-technical">Stated assumptions</div>
              <dl className="mt-3 space-y-2.5">
                {[
                  ["Baseline AQI", `${BASELINE_AQI} (non-episode background)`],
                  ["Receptor population", `${formatNumber(RECEPTOR_POPULATION)} (NCR)`],
                  ["Exposure threshold", `${EXPOSURE_THRESHOLD} AQI (Stage II)`],
                  ["Suppression latency", "Assumed instantaneous"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="text-2xs text-text-tertiary">{k}</dt>
                    <dd className="readout text-2xs text-text-secondary">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
                Instantaneous suppression is optimistic. Real enforcement has a
                lag, so treat these figures as an upper bound on benefit rather
                than a forecast of it.
              </p>
            </div>
          </div>

          {/* Result */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 gap-px bg-border-subtle lg:grid-cols-4">
              <Readout
                label="Peak before"
                value={episode.peakAQI}
                tone="hazard"
                hint={`GRAP ${beforeStage.stage}`}
              />
              <Readout
                label="Peak after"
                value={newPeak}
                tone={stageChanged ? "clear" : "hazard"}
                hint={`GRAP ${afterStage.stage} · ${afterStage.label}`}
              />
              <Readout
                label="Peak delta"
                value={newPeak - episode.peakAQI}
                tone={anyActive ? "clear" : "default"}
                hint="AQI points"
              />
              <Readout
                label="Hours over 301"
                value={`${exposure.after}/${exposure.before}`}
                tone={anyActive ? "clear" : "default"}
                hint={`${exposure.avertedHours} h averted`}
              />
            </div>

            {/* Before / after curve */}
            <figure className="panel bezel mt-6">
              <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
                <span className="label-technical">Re-solved receptor curve</span>
                <span className="readout text-2xs text-text-quaternary">
                  {episode.receptorCity}
                </span>
              </div>
              <div className="bg-bg-inset">
                <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img"
                  aria-label="Original versus counterfactual receptor AQI curve">
                  {[201, 301, 401, 451].map((t) => (
                    <g key={t}>
                      <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                        stroke={aqiToColor(t)} strokeWidth="0.7" opacity="0.3" strokeDasharray="3 4" />
                      <text x={W - PAD.right - 3} y={y(t) - 4} textAnchor="end"
                        fill={aqiToColor(t)} fontSize="10" fontFamily="var(--font-mono)" opacity="0.75">
                        {t}
                      </text>
                    </g>
                  ))}
                  <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-border-default)" />
                  <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-border-default)" />
                  {[-48, -24, 0, 24, 48].map((h) => (
                    <text key={h} x={x(h)} y={H - PAD.bottom + 16} textAnchor="middle"
                      fill="var(--color-text-tertiary)" fontSize="10" fontFamily="var(--font-mono)">
                      {h > 0 ? `+${h}` : h}h
                    </text>
                  ))}
                  {/* Original */}
                  <path d={curve(1)} fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.2" strokeDasharray="4 4" />
                  {/* Counterfactual */}
                  <path d={curve(retained)} fill="none" stroke="var(--color-accent-verify)" strokeWidth="2" />
                </svg>
              </div>
              <figcaption className="border-t border-border-subtle px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="flex items-center gap-2">
                    <span className="block h-0.5 w-4 bg-text-tertiary" />
                    <span className="readout text-2xs text-text-tertiary">Observed episode</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="block h-0.5 w-4 bg-accent-verify" />
                    <span className="readout text-2xs text-text-tertiary">Counterfactual</span>
                  </span>
                </div>
              </figcaption>
            </figure>

            {/* Verdict */}
            <div
              className={cn(
                "panel bezel mt-6 p-5 transition-colors",
                stageChanged && "sealed"
              )}
            >
              <div className="flex items-start gap-3">
                <IconExposure size={18} className="mt-0.5 shrink-0 text-text-tertiary" />
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusChip tone={stageChanged ? "clear" : "neutral"}>
                      {stageChanged
                        ? `Stage ${beforeStage.stage} avoided`
                        : `Stage ${afterStage.stage} retained`}
                    </StatusChip>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {anyActive ? (
                      <>
                        Suppressing {removedPct.toFixed(1)}% of the modelled
                        excess across{" "}
                        {joined.filter((s) => s.suppressionLevel > 0).length}{" "}
                        district(s) lowers the projected peak from{" "}
                        {episode.peakAQI} to {newPeak} and removes{" "}
                        {exposure.avertedHours} hours above{" "}
                        {EXPOSURE_THRESHOLD} AQI. Against the stated population
                        that is roughly{" "}
                        {formatNumber(
                          Math.round(exposure.avertedPersonHours / 1_000_000)
                        )}{" "}
                        million person-hours of exposure averted.
                      </>
                    ) : (
                      <>
                        No suppression applied. Move a slider to remove that
                        district&apos;s share of the modelled excess and re-solve
                        the curve. The register on the console lists what each
                        district contributes.
                      </>
                    )}
                  </p>
                  <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
                    Targeted suppression of named upwind districts is the
                    alternative to blanket receptor-side restrictions, which
                    halt construction and transport across the whole NCR while
                    leaving the sources untouched.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/certificate"
                className="group inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent-verify hover:text-accent-verify"
              >
                Seal this scenario
                <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/console"
                className="inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
              >
                Back to console
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    </div>
  );
}
