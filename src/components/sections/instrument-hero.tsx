"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { CorridorMap } from "@/components/figures/corridor-map";
import { presets, type PresetId, type Selection } from "@/components/three/airshed-instrument";
import type { Orbit } from "@/lib/orbit";
import { VERTICAL_EXAGGERATION } from "@/lib/airshed-3d";
import type { TehsilContribution, Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";
import { cn } from "@/lib/utils";

/*
   The landing hero: the model, and the controls around it.

   Orbit state lives here in refs rather than state, because a drag updates it
   every pointer move and re-rendering React sixty times a second to turn a
   camera would be absurd. Only the selection and the active preset are state,
   and both change on a click.
*/

const AirshedInstrument = dynamic(
  () => import("@/components/three/airshed-instrument"),
  { ssr: false, loading: () => null }
);

const PRESET_LABELS: { id: PresetId; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "The whole corridor" },
  { id: "source", label: "Source", hint: "Over the Punjab fields" },
  { id: "profile", label: "Profile", hint: "Side-on: the two wind layers" },
  { id: "receptor", label: "Receptor", hint: "Down onto Delhi" },
];

export interface InstrumentHeroProps {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  rows: TehsilContribution[];
  transportHours: number;
  meanShearDeg: number;
  topSource: string | null;
  topSharePct: number;
}

export function InstrumentHero({
  detections,
  wind,
  traces,
  rows,
  transportHours,
  meanShearDeg,
  topSource,
  topSharePct,
}: InstrumentHeroProps) {
  const all = presets();
  const goal = useRef<Orbit>(all.overview);
  /* Start further out and let the camera settle in, so the model arrives
     rather than appearing already parked. */
  const start: Orbit = { ...all.overview, radius: all.overview.radius * 1.6 };
  const engaged = useRef(false);

  const [preset, setPreset] = useState<PresetId>("overview");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hasEngaged, setHasEngaged] = useState(false);

  const reduce = useReducedMotion();
  const { supported } = useWebGLSupport();

  const onEngage = useCallback(() => {
    engaged.current = true;
    setHasEngaged((v) => (v ? v : true));
  }, []);

  const flyTo = useCallback(
    (id: PresetId) => {
      goal.current = presets()[id];
      setPreset(id);
      onEngage();
    },
    [onEngage]
  );

  /* No WebGL, or the visitor asked for less motion: the flat map, which is
     the same data and needs no GPU. */
  if (reduce || !supported) {
    return (
      <section className="relative bg-[var(--color-stain-0)] paper-grain">
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-10 px-6 py-20 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <HeroCopy
              transportHours={transportHours}
              topSource={topSource}
              topSharePct={topSharePct}
              meanShearDeg={meanShearDeg}
            />
          </div>
          <div className="lg:col-span-7">
            <div className="aspect-[4/3] w-full">
              <CorridorMap
                detections={detections}
                wind={wind}
                traces={traces}
                show={{ fires: true, wind: true, traces: true }}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative bg-[var(--color-stain-0)] paper-grain">
      <div className="relative mx-auto w-full max-w-[1500px] px-6 lg:px-10">
        <div className="relative h-[min(88svh,880px)] w-full">
          {/* The model fills the frame; copy and controls sit over it. */}
          <div className="absolute inset-0">
            <AirshedInstrument
              detections={detections}
              wind={wind}
              traces={traces}
              rows={rows}
              goal={goal}
              start={start}
              engaged={engaged}
              onEngage={onEngage}
              selected={selection?.tehsil ?? null}
              onSelect={setSelection}
              className="h-full w-full"
            />
          </div>

          {/* Copy. Pointer-events off so it never blocks a drag, except on the
              links, which need to stay clickable. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-14 lg:pt-20">
            <div className="max-w-lg">
              <HeroCopy
                transportHours={transportHours}
                topSource={topSource}
                topSharePct={topSharePct}
                meanShearDeg={meanShearDeg}
                compact
              />
              <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
                <Link
                  href="/console"
                  className="btn-flat bg-[var(--color-ink)] px-6 py-3 text-sm text-[var(--color-stain-0)] transition-colors hover:bg-[var(--color-ink-soft)]"
                >
                  Open the console
                </Link>
                <Link
                  href="/report"
                  className="btn-flat px-6 py-3 text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-stain-1)]"
                >
                  Report the sky
                </Link>
              </div>
            </div>
          </div>

          {/* Viewpoints. */}
          <div className="absolute bottom-5 left-0 z-10 flex flex-wrap gap-px bg-[var(--color-ink-hair)]">
            {PRESET_LABELS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => flyTo(p.id)}
                title={p.hint}
                aria-pressed={preset === p.id}
                className={cn(
                  "smallcaps px-3.5 py-2 transition-colors",
                  preset === p.id
                    ? "bg-[var(--color-ink)] text-[var(--color-stain-0)]"
                    : "bg-[var(--color-stain-0)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Scale note, always on: the vertical axis is exaggerated. */}
          <div className="pointer-events-none absolute bottom-5 right-0 z-10 text-right">
            <div className="font-technical text-2xs text-[var(--color-ink)]/55">
              vertical scale ×{VERTICAL_EXAGGERATION}
            </div>
          </div>

          {/* The affordance. Drag is not discoverable on a static frame, so it
              is stated once and removed the moment the visitor does it. */}
          {!hasEngaged && (
            <div className="pointer-events-none absolute bottom-20 left-0 z-10 flex items-center gap-2.5">
              <DragGlyph />
              <span className="smallcaps text-[var(--color-ink)]/60">
                Drag to turn · scroll to zoom · click a source
              </span>
            </div>
          )}

          {/* Inspector. */}
          {selection && (
            <div className="absolute right-0 top-14 z-20 w-[19rem] border border-[var(--color-ink)] bg-[var(--color-stain-0)] p-5 lg:top-20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="poster text-[1.15rem] leading-tight text-[var(--color-ink)]">
                    {selection.tehsil}
                  </div>
                  <div className="smallcaps mt-1 text-[var(--color-ink)]/55">
                    {[selection.district, selection.state].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  aria-label="Close"
                  className="text-[var(--color-ink)]/50 transition-colors hover:text-[var(--color-ink)]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
              </div>

              <div className="mt-5 border-t border-[var(--color-ink-hair)] pt-4">
                <div className="poster text-[2rem] leading-none text-[var(--color-ink)]">
                  {selection.contributionPct.toFixed(1)}%
                </div>
                <div className="smallcaps mt-2 text-[var(--color-ink)]/55">
                  of the biomass load over Delhi
                </div>
                <div className="font-technical mt-1.5 text-2xs text-[var(--color-ink)]/60">
                  95% interval {selection.ciLow.toFixed(1)}–{selection.ciHigh.toFixed(1)}
                </div>
              </div>

              <dl className="mt-5 divide-y divide-[var(--color-ink-hair)] border-t border-[var(--color-ink-hair)]">
                <Row term="Mean transport" def={`${selection.meanTransportHours} h`} />
                <Row term="Arriving puffs" def={String(selection.arrivals)} />
                <Row term="Grid cells" def={String(selection.cells)} />
                <Row term="Total FRP" def={`${selection.frpTotal} MW`} />
              </dl>

              <p className="mt-4 text-2xs leading-relaxed text-[var(--color-ink)]/55">
                Computed from this tehsil&apos;s own detections advected on the
                925 hPa field — not a figure written about it.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroCopy({
  transportHours,
  topSource,
  topSharePct,
  meanShearDeg,
  compact = false,
}: {
  transportHours: number;
  topSource: string | null;
  topSharePct: number;
  meanShearDeg: number;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="kicker flex items-center gap-2.5 text-[var(--color-ink)]/60">
        <span className="inline-block h-px w-6 bg-current" />
        <span>Source–receptor attribution</span>
      </div>
      <h1 className="poster mt-4 text-[clamp(1.7rem,3.8vw,2.9rem)] text-[var(--color-ink)]">
        Every state already knows how bad its air is.
        <br />
        None can prove whose it is.
      </h1>
      {!compact && (
        <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)]">
          PRAMĀNA names the upwind cells responsible for a receptor city&apos;s
          exceedance and seals the result in a certificate the named state can
          re-run.
        </p>
      )}
      <div className="mt-7 grid max-w-md grid-cols-3 gap-5">
        <Fig value={topSource ? `${topSharePct.toFixed(1)}%` : "—"} label={topSource ?? "No transport"} />
        <Fig value={`${transportHours} h`} label="To the receptor" />
        <Fig value={`${meanShearDeg.toFixed(0)}°`} label="Surface to 925 hPa" />
      </div>
    </div>
  );
}

function Fig({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-[var(--color-ink)]/30 pt-3">
      <div className="poster text-[clamp(1.1rem,2.2vw,1.6rem)] leading-none text-[var(--color-ink)]">
        {value}
      </div>
      <div className="smallcaps mt-1.5 text-[var(--color-ink)]/55">{label}</div>
    </div>
  );
}

function Row({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="smallcaps text-[var(--color-ink)]/55">{term}</dt>
      <dd className="font-technical text-2xs text-[var(--color-ink)]">{def}</dd>
    </div>
  );
}

function DragGlyph() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden="true" className="text-[var(--color-ink)]/50">
      <path d="M4 9h18M4 9l3.5-3.5M4 9l3.5 3.5M22 9l-3.5-3.5M22 9l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
