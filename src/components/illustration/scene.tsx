"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
   The scene.

   One viewport of drawn world: a flat sky, a flat ground, and a hard horizon
   between them. That hard edge is most of what separates this look from a
   generic hero with a gradient — the reference posters never blend the two,
   and neither do we.

   Scenes are stacked down the page and each one owns its own palette, so the
   sky walks down the CPCB index as the reader scrolls: a clean Punjab dawn at
   the top, AQI 482 over Delhi by the time the smoke arrives. Nothing
   cross-fades. Each scene is a printed frame.

   Layers inside a scene drift at different rates as it crosses the viewport.
   `depth` is the only control: 0 is painted on the sky and barely moves, 1 is
   at the reader's feet and moves most.
*/

export interface SceneProps {
  children: React.ReactNode;
  /** Any CSS colour. Use the --color-sky-* tokens. */
  sky: string;
  /** Omit for a scene with no ground — sky only, edge to edge. */
  ground?: string;
  /** Horizon height as a fraction of the scene, from the top. */
  horizon?: number;
  className?: string;
  /** Scenes are one viewport by default; taller ones get more scroll to move in. */
  height?: string;
  id?: string;
}

export function Scene({
  children,
  sky,
  ground,
  horizon = 0.66,
  className,
  height = "100svh",
  id,
}: SceneProps) {
  return (
    <section
      id={id}
      className={cn("scene paper-grain", className)}
      style={{ background: sky, height, minHeight: height }}
    >
      {ground && (
        <div
          className="absolute inset-x-0 bottom-0 z-0"
          style={{ background: ground, height: `${(1 - horizon) * 100}%` }}
          aria-hidden="true"
        />
      )}
      {children}
    </section>
  );
}

/**
 * A parallax layer inside a scene.
 *
 * Travel is expressed in viewport-relative units so a layer moves the same
 * proportion of the frame on a phone as on a monitor — using pixels here
 * makes near layers fly off small screens and barely register on large ones.
 */
export function SceneLayer({
  children,
  depth = 0.5,
  className,
  style,
}: {
  children: React.ReactNode;
  depth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  /* Near layers travel further and in the opposite sense to far ones, which
     is what produces the sense of the camera moving through rather than the
     picture sliding past. */
  const travel = depth * 22;
  const y = useTransform(scrollYProgress, [0, 1], [`${travel}vh`, `${-travel}vh`]);

  return (
    <div ref={ref} className={cn("absolute inset-0", className)} style={style} aria-hidden="true">
      <motion.div className="h-full w-full" style={reduce ? undefined : { y }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The copy block: an italic kicker over a dotted rule, a poster headline, and
 * an optional line of prose. Centred, because every frame in the references
 * is centred and breaking that reads as a different site.
 */
export function SceneCopy({
  kicker,
  headline,
  body,
  ink = "var(--color-ink)",
  align = "center",
  className,
  children,
}: {
  kicker?: string;
  headline: React.ReactNode;
  body?: React.ReactNode;
  ink?: string;
  align?: "center" | "left";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-18% 0px -18% 0px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative z-20 mx-auto w-full max-w-3xl px-6",
        align === "center" ? "text-center" : "text-left",
        className
      )}
      style={{ color: ink }}
    >
      {kicker && (
        <div className={cn("kicker", align === "center" && "kicker-rule")}>
          <span>{kicker}</span>
        </div>
      )}
      <h2 className="poster mt-5 text-[clamp(1.9rem,5.2vw,3.6rem)]">{headline}</h2>
      {body && (
        <p
          className="mx-auto mt-6 max-w-xl text-[clamp(0.95rem,1.5vw,1.0625rem)] leading-relaxed"
          style={{ color: "color-mix(in srgb, currentColor 78%, transparent)" }}
        >
          {body}
        </p>
      )}
      {children}
    </motion.div>
  );
}

/**
 * The binary answer under a figure, hand-lettered.
 *
 * The references use this constantly — a figure on the left and one on the
 * right, each captioned with a word — and it is the single most recognisable
 * device in the whole style.
 */
export function Answer({
  children,
  ink = "var(--color-ink)",
  className,
}: {
  children: React.ReactNode;
  ink?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("outline-letters block text-center text-[clamp(2rem,5vw,3.4rem)] leading-none", className)}
      style={{ color: ink }}
    >
      {children}
    </span>
  );
}

/**
 * A centred stage for the figures in a scene, sitting on the horizon.
 *
 * Figures are placed as a proportion of the frame rather than absolutely, so
 * the composition holds from a phone to a wide monitor without a separate
 * layout for each.
 */
export function SceneStage({
  children,
  className,
  bottom = "12%",
}: {
  children: React.ReactNode;
  className?: string;
  bottom?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-x-0 z-10", className)}
      style={{ bottom }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-6 px-6">
        {children}
      </div>
    </div>
  );
}
