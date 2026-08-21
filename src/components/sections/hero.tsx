"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { EPISODES } from "@/data/mock-episodes";
import { useWebGLSupport } from "@/hooks/use-webgl-support";
import { StatusChip } from "@/components/ui/primitives";
import { IconArrowDown, IconArrowRight } from "@/components/icons";

/*
   Hero.

   Four layers move at four rates as the visitor scrolls: the far haze wash,
   the globe, the headline, and the readout strip. That difference in rate is
   the entire depth effect. Nothing is blurred and nothing floats on a shadow.

   Every layer's travel is bounded so it stays inside the section's clip box.
   The section hides its overflow so the globe can bleed past the right edge
   without producing a horizontal scrollbar, which means a layer that drifts
   past an edge is silently cut rather than merely offset.
*/

const AirshedGlobe = dynamic(() => import("@/components/three/airshed-globe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="skeleton h-40 w-40 rounded-full" />
        <span className="label-technical">Initialising airshed</span>
      </div>
    </div>
  ),
});

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { supported, tier } = useWebGLSupport();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const hazeY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const globeY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const globeScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 260]);
  const copyFade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  /*
     The readout strip is anchored to the bottom edge of a section that clips
     its overflow, so it must never drift downward: at large viewports the
     strip collapses to a single ~100px row, and a 90px downward translate put
     almost the whole value row outside the clip boundary. Drifting upward is
     structurally safe, since the travel moves it further inside the box.
  */
  const stripY = useTransform(scrollYProgress, [0, 1], [0, -24]);

  const episode = EPISODES[0];
  const upwindShare = episode.attribution
    .filter((a) => a.state !== "Delhi")
    .reduce((sum, a) => sum + a.contribution, 0);

  const still = reduce ? undefined : true;

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] overflow-hidden border-b border-border-subtle"
    >
      {/* Layer 1: far atmospheric wash */}
      <motion.div
        style={still ? { y: hazeY } : undefined}
        className="haze-top pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        aria-hidden="true"
      />

      {/* Layer 2: the globe, held off-centre so the headline has room */}
      <motion.div
        style={still ? { y: globeY, scale: globeScale } : undefined}
        className="absolute right-[-20%] top-[6%] h-[54vh] w-[104%] sm:right-[-10%] sm:h-[62vh] sm:w-[78%] lg:right-[1%] lg:top-[7%] lg:h-[76vh] lg:w-[48%]"
      >
        {supported ? (
          <AirshedGlobe
            corridor="punjab-delhi"
            interactive={tier === "high"}
            className="h-full w-full"
          />
        ) : null}
      </motion.div>

      {/* Layer 3: vignette and floor haze, tying the globe into the page */}
      <div className="vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="haze-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[42vh]"
        aria-hidden="true"
      />

      {/* Layer 4: copy */}
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[1500px] flex-col justify-center px-6 pb-40 pt-28 lg:px-10">
        <motion.div
          style={still ? { y: copyY, opacity: copyFade } : undefined}
          className="max-w-xl lg:max-w-2xl"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusChip tone="hazard" pulse>
              Episode replay
            </StatusChip>
            <span className="readout text-2xs text-text-tertiary">
              {episode.id} · {episode.date}
            </span>
          </div>

          <h1 className="mt-7 font-display text-xl font-medium leading-[1.05] text-text-primary sm:text-2xl lg:text-3xl">
            Every nation already knows
            <br />
            how bad its air is.
            <br />
            <span className="text-accent-verify">
              None can prove whose it is.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-md leading-relaxed text-text-secondary">
            PRAMĀNA is an operational source-receptor attribution service for
            transboundary pollution episodes. It names the upwind cells
            responsible for a receptor city&apos;s exceedance, attaches a
            confidence interval to every figure, and seals the result in a
            certificate that the named party can re-run and reproduce
            bit-for-bit.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/console"
              className="group inline-flex items-center gap-2.5 border border-accent-verify bg-accent-verify/10 px-5 py-2.5 text-sm text-accent-verify transition-colors hover:bg-accent-verify/20"
            >
              Open operator console
              <IconArrowRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/certificate"
              className="inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
            >
              Inspect a certificate
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Readout strip, pinned to the base of the fold */}
      <motion.div
        style={still ? { y: stripY } : undefined}
        className="absolute inset-x-0 bottom-0 border-t border-border-subtle bg-bg-void/80 backdrop-blur-[2px]"
      >
        <div className="mx-auto grid w-full max-w-[1500px] grid-cols-2 gap-px bg-border-subtle px-6 lg:grid-cols-4 lg:px-10">
          {[
            {
              label: "Peak receptor AQI",
              value: episode.peakAQI,
              sub: `GRAP Stage ${episode.grapStage} invoked`,
              tone: "text-accent-hazard",
            },
            {
              label: "Warning lead time",
              value: `${episode.leadTimeHours} h`,
              sub: "Ahead of stage crossing",
              tone: "text-accent-clear",
            },
            {
              label: "Attributed upwind",
              value: `${upwindShare.toFixed(1)}%`,
              sub: "Outside the receptor jurisdiction",
              tone: "text-accent-verify",
            },
            {
              label: "Certificate",
              value: "SEALED",
              sub: episode.certificateId,
              tone: "text-accent-verify",
            },
          ].map((item) => (
            <div key={item.label} className="bg-bg-void px-4 py-4 lg:px-5">
              <div className="label-technical">{item.label}</div>
              <div
                className={`readout mt-1.5 text-lg font-medium leading-none ${item.tone}`}
              >
                {item.value}
              </div>
              <div className="mt-1.5 truncate text-2xs text-text-quaternary">
                {item.sub}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scroll cue */}
      <div className="pointer-events-none absolute bottom-[8.5rem] left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex">
        <span className="label-technical">Scroll</span>
        <IconArrowDown size={14} className="animate-bounce text-text-quaternary" />
      </div>
    </section>
  );
}
