"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { VERTICAL_EXAGGERATION, TRANSPORT_LEVEL_M } from "@/lib/airshed-3d";
import { CorridorMap } from "@/components/figures/corridor-map";
import type { Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";
import { cn } from "@/lib/utils";

/*
   The pinned airshed stage.

   Four viewports of scroll drive one continuous flight through the volume:
   the fields ignite, the surface wind appears, the transport layer appears
   above it pointing somewhere else, the plume lofts into that layer and rides
   it to Delhi.

   The chapter text is pinned to the same scroll that drives the camera, so
   the two cannot disagree. Progress reaches the scene through a ref — React
   does not re-render while the reader scrubs, and the chapter index is the
   only state that changes, four times across the whole section.
*/

const AirshedVolume = dynamic(() => import("@/components/three/airshed-volume"), {
  ssr: false,
  loading: () => null,
});

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
    title: "Each column is a fire, and its height is the heat it released.",
    body: "Detections at their true coordinates, scaled to Fire Radiative Power. Nothing is placed for composition — this is the shape the burning took.",
  },
  {
    index: "02",
    kicker: "What a ground station sees",
    title: "At ten metres, the air is going somewhere else.",
    body: "These are the surface arrows. This is the wind a monitoring station measures, the wind a weather app reports, and the wind most air quality dashboards draw. It is not the wind carrying the smoke.",
  },
  {
    index: "03",
    kicker: "What is actually carrying it",
    title: "Seven hundred and fifty metres up, the corridor opens.",
    body: "The upper arrows are the 925 hPa flow. On the night of an episode a nocturnal inversion decouples the two layers, and they can differ by tens of degrees. Everything above that inversion travels without touching the ground it passes over.",
  },
  {
    index: "04",
    kicker: "Transport",
    title: "The smoke lofts into that layer and rides it to Delhi.",
    body: "Each particle follows one of the trajectories the register is computed from. They lift out of the surface layer in the first few kilometres and stay up until the receptor — which is why a city three hundred kilometres downwind gets a load it did not produce and cannot stop.",
  },
];

const CHAPTER_AT = [0, 0.26, 0.46, 0.62];

export interface AirshedStageProps {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  /** Mean shear between the surface and transport levels, degrees. */
  meanShearDeg: number;
  windLive: boolean;
}

export function AirshedStage({
  detections,
  wind,
  traces,
  meanShearDeg,
  windLive,
}: AirshedStageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useRef(0);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);

  const reduce = useReducedMotion();
  const { supported } = useWebGLSupport();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  /* The hot path: writes a number, and four times in the whole section sets
     one piece of state. It triggers no render otherwise. */
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

  /*
     The canvas mounts on approach rather than at page load, because a WebGL
     context costs a GPU context and a render loop the reader has not asked
     for yet.

     Two triggers, not one. IntersectionObserver is the normal path, but it
     does not fire in a background tab — and a reader who opens the page in
     one, then switches to it, would find the section permanently empty. The
     timeout measures the rect directly, which works whether or not the
     document is being painted, and covers the case where IO is throttled or
     unavailable. Whichever fires first wins; both are idempotent.
  */
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
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) mount();
      },
      { rootMargin: "50% 0px" }
    );
    io.observe(el);

    /* A timeout callback is not the effect body, so this does not create the
       cascading render the synchronous form would. */
    const timer = window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const margin = window.innerHeight * 0.5;
      if (r.top < window.innerHeight + margin && r.bottom > -margin) mount();
    }, 0);

    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  /*
     Reduced motion, or no WebGL: the same four chapters as prose beside the
     flat map. The argument survives without the flight — which is the test of
     whether the flight was carrying an argument or decorating one.
  */
  if (reduce || !supported) {
    return (
      <section className="relative bg-[var(--color-stain-1)] py-24 paper-grain">
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
                  <dd className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {c.body}
                  </dd>
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
      className="relative bg-[var(--color-stain-1)]"
      style={{ height: "420vh" }}
      aria-label="The airshed in three dimensions"
    >
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] w-full overflow-hidden paper-grain">
        <div className="absolute inset-0">
          {ready && (
            <AirshedVolume
              detections={detections}
              wind={wind}
              traces={traces}
              reveal={reveal}
              className="h-full w-full"
            />
          )}
        </div>

        {/* Scale declaration. A vertically exaggerated scene that does not say
            so is misleading, so this is always on screen. */}
        <div className="pointer-events-none absolute right-6 top-6 z-20 text-right lg:right-10">
          <div className="smallcaps text-[var(--color-ink)]/45">Vertical scale</div>
          <div className="font-technical mt-1 text-2xs text-[var(--color-ink)]/70">
            exaggerated ×{VERTICAL_EXAGGERATION}
          </div>
          <div className="font-technical mt-3 text-2xs text-[var(--color-ink)]/70">
            transport level {TRANSPORT_LEVEL_M} m
          </div>
        </div>

        {/* The number the whole scene exists to make visible. */}
        <div className="pointer-events-none absolute left-6 top-6 z-20 lg:left-10">
          <div className="smallcaps text-[var(--color-ink)]/45">Surface to 925 hPa</div>
          <div className="poster mt-1 text-[clamp(1.6rem,3vw,2.4rem)] leading-none text-[var(--color-ink)]">
            {meanShearDeg.toFixed(0)}° apart
          </div>
          <div className="font-technical mt-2 max-w-[13rem] text-2xs leading-relaxed text-[var(--color-ink)]/60">
            {windLive
              ? "Mean shear on the live field, Open-Meteo"
              : "Mean shear on the recorded episode field"}
          </div>
        </div>

        {/* Chapter narration. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-[1400px] px-6 pb-10 lg:px-10 lg:pb-14">
            <motion.div
              key={active.index}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-xl"
            >
              <div className="kicker flex items-center gap-2.5 text-[var(--color-ink)]/60">
                <span className="inline-block h-px w-6 bg-current" />
                <span>{active.kicker}</span>
              </div>
              <h2 className="poster mt-3 text-[clamp(1.3rem,2.8vw,2rem)] text-[var(--color-ink)]">
                {active.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                {active.body}
              </p>
            </motion.div>

            <div className="mt-8 grid max-w-2xl grid-cols-4 gap-3">
              {CHAPTERS.map((c, i) => (
                <div key={c.index}>
                  <div
                    className={cn(
                      "h-[2px] w-full transition-colors duration-500",
                      i <= chapter ? "bg-[var(--color-ink)]" : "bg-[var(--color-ink-hair)]"
                    )}
                  />
                  <div
                    className={cn(
                      "smallcaps mt-2 transition-colors duration-500",
                      i === chapter ? "text-[var(--color-ink)]" : "text-[var(--color-ink)]/35"
                    )}
                  >
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
