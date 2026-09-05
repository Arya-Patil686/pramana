"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { StatusChip } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { FireDetection } from "@/lib/sources/firms";

/*
   The corridor sequence.

   A single shot, four and a half viewports long, that the reader scrubs: the
   fires ignite, the plume forms and advects southeast, it arrives over Delhi
   forty hours later, and the register stands up in the places it names. It is
   the same argument the rest of the site makes in prose, made once in a form
   that takes ten seconds instead of ten minutes.

   The narration is pinned to the same scroll it drives, so text and camera
   cannot disagree. Scroll progress reaches the scene through a ref — React
   does not re-render while the reader scrubs, and the chapter index is the
   only piece of state allowed to change, four times across the whole section.
*/

const CorridorFlight = dynamic(() => import("@/components/three/corridor-flight"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="skeleton h-32 w-32" />
        <span className="label-technical">Building corridor</span>
      </div>
    </div>
  ),
});

interface Chapter {
  index: string;
  kicker: string;
  title: string;
  body: string;
  readout: { label: string; value: string; hint: string };
}

const CHAPTERS: Chapter[] = [
  {
    index: "T−40h",
    kicker: "Ignition",
    title: "Nine hundred fields burn in an afternoon.",
    body: "Each marker is a VIIRS detection at its true position, appearing at the moment the satellite actually saw it. Marker area scales with Fire Radiative Power. Nothing here is placed for composition — the cluster is the shape the burning took on 2 November.",
    readout: { label: "Detections", value: "VIIRS 375 m", hint: "NASA FIRMS, ~3 h behind real time" },
  },
  {
    index: "T−28h",
    kicker: "Transport",
    title: "The smoke leaves the jurisdiction that made it.",
    body: "The plume is advected along the 925 hPa flow — the layer at the top of the nocturnal boundary layer that actually carries this smoke. Surface wind points somewhere else entirely, which is why most dashboards showing it get the corridor wrong.",
    readout: { label: "Transport level", value: "925 hPa", hint: "Open-Meteo, ECMWF IFS" },
  },
  {
    index: "T−0h",
    kicker: "Arrival",
    title: "Delhi crosses 400 at six in the evening.",
    body: "Forty hours after ignition, the load arrives over a city that did not produce it and cannot stop it. The receptor ring is the moment the reference monitors cross the statutory threshold, which is the moment a stage gets invoked and a magistrate needs a defensible reason.",
    readout: { label: "Peak receptor AQI", value: "482", hint: "CPCB reference network" },
  },
  {
    index: "Register",
    kicker: "Attribution",
    title: "The finding, stood up where it points.",
    body: "Each column is one upwind cell's share of Delhi's excess above background, resolved to the tehsil and carrying its own confidence interval. Together they are the 92.2% the certificate seals — and the number a state will be asked to answer for.",
    readout: { label: "Attributed upwind", value: "92.2%", hint: "95% CI 88.1–95.4%" },
  },
];

/* Scroll positions where each chapter takes over, matched to the camera
   keyframes in corridor-flight. */
const CHAPTER_AT = [0, 0.26, 0.62, 0.82];

export function CorridorSequence({ detections }: { detections: FireDetection[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [chapter, setChapter] = useState(0);
  const [ready, setReady] = useState(false);

  const reduce = useReducedMotion();
  const { supported } = useWebGLSupport();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  /* The hot path. This writes a number and, four times in the whole section,
     sets one piece of state. It never triggers a render otherwise. */
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    progress.current = p;
    let next = 0;
    for (let i = CHAPTER_AT.length - 1; i >= 0; i--) {
      if (p >= CHAPTER_AT[i]) {
        next = i;
        break;
      }
    }
    setChapter((current) => (current === next ? current : next));
  });

  /* Mounting the canvas is deferred until the section is near the viewport.
     A WebGL context created at page load costs a GPU context and a render
     loop for a scene the reader has not reached yet. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "60% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const active = CHAPTERS[chapter];

  /* Reduced motion, or no WebGL: the chapters become a plain sequence with no
     canvas, no pinning and no scrub. The argument survives without the shot. */
  if (reduce || !supported) {
    return (
      <section className="border-b border-border-subtle py-24">
        <div className="mx-auto w-full max-w-[1180px] px-6 lg:px-10">
          <div className="mb-12 flex items-center gap-3">
            <span className="readout border border-border-default px-1.5 py-0.5 text-2xs text-accent-verify">
              02
            </span>
            <span className="label-technical">Detection and transport</span>
          </div>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {CHAPTERS.map((c) => (
              <div key={c.index} className="grid gap-4 py-8 lg:grid-cols-12 lg:gap-8">
                <div className="lg:col-span-3">
                  <div className="readout text-2xs text-accent-verify">{c.index}</div>
                  <div className="label-technical mt-1">{c.kicker}</div>
                </div>
                <div className="lg:col-span-9">
                  <h3 className="font-display text-lg leading-snug text-text-primary">{c.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
                    {c.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="relative border-b border-border-subtle"
      style={{ height: "460vh" }}
      aria-label="Corridor transport sequence"
    >
      {/* The pinned stage. */}
      <div className="sticky top-11 h-[calc(100svh-2.75rem)] w-full overflow-hidden">
        <div className="absolute inset-0">
          {ready && <CorridorFlight progress={progress} detections={detections} className="h-full w-full" />}
        </div>

        {/* Atmosphere, tying the canvas into the page. */}
        <div className="vignette pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="haze-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[38vh]"
          aria-hidden="true"
        />

        {/* Chapter narration. */}
        <div className="pointer-events-none absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1500px] px-6 pb-10 lg:px-10 lg:pb-14">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <motion.div
                key={active.index}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-7"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <StatusChip tone={chapter === 2 ? "hazard" : "verify"} pulse={chapter === 2}>
                    {active.index}
                  </StatusChip>
                  <span className="label-technical">{active.kicker}</span>
                </div>
                <h2 className="mt-4 max-w-2xl font-display text-xl font-medium leading-[1.08] text-text-primary sm:text-2xl">
                  {active.title}
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-secondary">
                  {active.body}
                </p>
              </motion.div>

              <motion.div
                key={`${active.index}-readout`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="panel bezel bg-bg-void/70 p-4 backdrop-blur-[2px] lg:col-span-4 lg:col-start-9"
              >
                <div className="label-technical">{active.readout.label}</div>
                <div className="readout mt-1.5 text-lg leading-none text-accent-verify">
                  {active.readout.value}
                </div>
                <div className="mt-2 text-2xs text-text-quaternary">{active.readout.hint}</div>
              </motion.div>
            </div>

            {/* Chapter rail. */}
            <div className="mt-8 grid grid-cols-4 gap-px bg-border-subtle">
              {CHAPTERS.map((c, i) => (
                <div key={c.index} className="bg-bg-void/60 px-3 py-2 backdrop-blur-[2px]">
                  <div
                    className={cn(
                      "readout text-2xs transition-colors duration-300",
                      i === chapter ? "text-accent-verify" : "text-text-quaternary"
                    )}
                  >
                    {c.kicker}
                  </div>
                  <div className="mt-1.5 h-[2px] w-full bg-border-subtle">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        i <= chapter ? "w-full bg-accent-verify" : "w-0 bg-transparent"
                      )}
                    />
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
