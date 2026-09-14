"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { VERTICAL_EXAGGERATION, TRANSPORT_LEVEL_M } from "@/lib/airshed-3d";
import { PLACE_ANCHORS } from "@/lib/corridor-geo";
import { scrollPath, presets } from "@/components/three/airshed-instrument";
import { CorridorMap } from "@/components/figures/corridor-map";
import type { Orbit } from "@/lib/orbit";
import type { TehsilContribution, Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";
import { cn } from "@/lib/utils";

/*
   The pinned airshed stage.

   Four viewports of scroll fly one continuous shot through the volume: the
   fields ignite, the surface wind appears, the transport layer appears above
   it pointing somewhere else, and the plume lofts into that layer and rides
   it to Delhi.

   It renders the same scene component the interactive hero does. Two separate
   scenes existed here until the duplication caught up with us: raising the
   vertical exaggeration for the hero silently broke this one's framing,
   because it had its own camera, its own ground and its own receptor, all
   calibrated against the old value. One scene, two camera drivers.
*/

const AirshedInstrument = dynamic(
  () => import("@/components/three/airshed-instrument"),
  { ssr: false, loading: () => null }
);

interface Chapter {
  index: string;
  kicker: string;
  title: string;
  body: string;
}

const CHAPTERS: Chapter[] = [
  {
    index: "01",
    kicker: "The sources",
    title: "Each bar is a tehsil, and its height is what the register attributes to it.",
    body: "Detections at their true coordinates, aggregated to the unit the register resolves to. Nothing is placed for composition.",
  },
  {
    index: "02",
    kicker: "What a ground station sees",
    title: "At ten metres, the air is going somewhere else.",
    body: "The lower arrows are the 10 m wind — what a monitoring station measures, what a weather app reports, and what most air quality dashboards draw. It is not the wind carrying the smoke.",
  },
  {
    index: "03",
    kicker: "What is actually carrying it",
    title: "Seven hundred and fifty metres up, the corridor opens.",
    body: "The upper arrows are the 925 hPa flow. On the night of an episode a nocturnal inversion decouples the two layers and they can differ by tens of degrees. Everything above that inversion travels without touching the ground it passes over.",
  },
  {
    index: "04",
    kicker: "Transport",
    title: "The smoke lofts into that layer and rides it to Delhi.",
    body: "Each particle follows one of the trajectories the register is computed from. They lift out of the surface layer in the first few kilometres and stay up until the receptor.",
  },
];

const CHAPTER_AT = [0, 0.3, 0.62, 0.82];

export interface AirshedStageProps {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  rows: TehsilContribution[];
  meanShearDeg: number;
  windLive: boolean;
}

export function AirshedStage({
  detections,
  wind,
  traces,
  rows,
  meanShearDeg,
  windLive,
}: AirshedStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useRef(0);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);

  const reduce = useReducedMotion();
  const { supported } = useWebGLSupport();

  const path = useMemo(() => scrollPath(), []);
  const goal = useRef<Orbit>(presets().source);
  const engaged = useRef(false);
  const noop = useCallback(() => {}, []);

  const labelNodes = useRef<Map<string, HTMLElement>>(new Map());
  const setLabel = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) labelNodes.current.set(id, el);
      else labelNodes.current.delete(id);
    },
    []
  );

  const maxPct = useMemo(
    () => Math.max(1, ...rows.map((r) => r.contributionPct)),
    [rows]
  );

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    reveal.current = p;
    let next = 0;
    for (let i = CHAPTER_AT.length - 1; i >= 0; i--) {
      if (p >= CHAPTER_AT[i]) {
        next = i;
        break;
      }
    }
    setChapter((c) => (c === next ? c : next));
  });

  /* Mounts on approach, and on a timeout as well — IntersectionObserver does
     not fire in a background tab, and a reader who opened the page in one
     would find the section permanently empty. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const mount = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && mount(),
      { rootMargin: "50% 0px" }
    );
    io.observe(el);
    const timer = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const m = window.innerHeight * 0.5;
      if (r.top < window.innerHeight + m && r.bottom > -m) mount();
    }, 0);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  if (reduce || !supported) {
    return (
      <section className="relative border-y border-[var(--color-ink-hair)] bg-[var(--color-stain-1)] py-20 paper-grain">
        <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-6 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <div className="kicker flex items-center gap-2.5 text-[var(--color-ink)]/60">
              <span className="inline-block h-px w-6 bg-current" />
              <span>The vertical structure</span>
            </div>
            <h2 className="poster mt-4 text-[clamp(1.5rem,3.2vw,2.3rem)] text-[var(--color-ink)]">
              The smoke travels in a layer the ground never sees.
            </h2>
            <dl className="mt-8 divide-y divide-[var(--color-ink-hair)] border-y border-[var(--color-ink-hair)]">
              {CHAPTERS.map((c) => (
                <div key={c.index} className="py-4">
                  <dt className="smallcaps text-[var(--color-ink)]/60">{c.kicker}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">{c.body}</dd>
                </div>
              ))}
            </dl>
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

  const active = CHAPTERS[chapter];

  return (
    <section
      ref={ref}
      className="relative border-y border-[var(--color-ink-hair)] bg-[var(--color-stain-1)]"
      style={{ height: "420vh" }}
      aria-label="The airshed in three dimensions"
    >
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] w-full overflow-hidden paper-grain">
        <div className="absolute inset-0">
          {ready && (
            <AirshedInstrument
              detections={detections}
              wind={wind}
              traces={traces}
              rows={rows}
              goal={goal}
              start={path[0].orbit}
              engaged={engaged}
              onEngage={noop}
              selected={null}
              onSelect={noop}
              labelNodes={labelNodes}
              scroll={reveal}
              path={path}
              className="h-full w-full"
            />
          )}
        </div>

        {/* Projected labels, same overlay contract as the hero. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {PLACE_ANCHORS.map((p) => (
            <span key={p.label} ref={setLabel(`place:${p.label}`)} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-200">
              <span className={cn("smallcaps block", p.kind === "receptor" ? "text-[var(--color-mark-ember)]" : "text-[var(--color-ink)]/45")}>
                {p.label}
              </span>
            </span>
          ))}
          {rows.map((r) => (
            <span key={r.tehsil} ref={setLabel(`src:${r.tehsil}`)} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-200">
              <span className="font-technical block text-center text-[10px] leading-tight text-[var(--color-ink)]/70">
                {r.contributionPct / maxPct > 0.28 ? r.tehsil : ""}
                <span className="block font-semibold text-[var(--color-ink)]">
                  {r.contributionPct.toFixed(1)}%
                </span>
              </span>
            </span>
          ))}
          <span ref={setLabel("layer:surface")} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-200">
            <span className="font-technical rounded-sm bg-[var(--color-stain-1)]/85 px-1.5 py-0.5 text-[10px] text-[var(--color-ink)]/75">
              10 m wind
            </span>
          </span>
          <span ref={setLabel("layer:transport")} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-200">
            <span className="font-technical rounded-sm bg-[var(--color-stain-1)]/85 px-1.5 py-0.5 text-[10px] text-[var(--color-mark-flow)]">
              925 hPa wind · carries the smoke
            </span>
          </span>
        </div>

        {/* Scale, always declared. */}
        <div className="pointer-events-none absolute right-6 top-5 z-20 text-right lg:right-10">
          <div className="smallcaps text-[var(--color-ink)]/45">Vertical scale</div>
          <div className="font-technical mt-1 text-[10px] text-[var(--color-ink)]/70">
            exaggerated ×{VERTICAL_EXAGGERATION}
          </div>
          <div className="font-technical mt-2 text-[10px] text-[var(--color-ink)]/70">
            transport level {TRANSPORT_LEVEL_M} m
          </div>
        </div>

        {/* Narration, on a panel so it never fights the scene behind it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-8 lg:px-10 lg:pb-10">
            <motion.div
              key={active.index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl border-l-2 border-[var(--color-ink)] bg-[var(--color-stain-1)]/92 py-4 pl-5 pr-6 backdrop-blur-[2px]"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-technical text-[10px] text-[var(--color-mark-ember)]">
                  {active.index}
                </span>
                <span className="smallcaps text-[var(--color-ink)]/60">{active.kicker}</span>
                <span className="font-technical ml-auto text-[10px] text-[var(--color-ink)]/50">
                  shear {meanShearDeg.toFixed(0)}° {windLive ? "· live" : "· episode"}
                </span>
              </div>
              <h2 className="poster mt-2.5 text-[clamp(1.15rem,2.3vw,1.7rem)] text-[var(--color-ink)]">
                {active.title}
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                {active.body}
              </p>
            </motion.div>

            <div className="mt-5 grid max-w-2xl grid-cols-4 gap-3">
              {CHAPTERS.map((c, i) => (
                <div key={c.index}>
                  <div className={cn("h-[2px] w-full transition-colors duration-500", i <= chapter ? "bg-[var(--color-ink)]" : "bg-[var(--color-ink-hair)]")} />
                  <div className={cn("smallcaps mt-2 transition-colors duration-500", i === chapter ? "text-[var(--color-ink)]" : "text-[var(--color-ink)]/35")}>
                    {c.kicker}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
