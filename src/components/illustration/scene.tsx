"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
   The scene.

   One viewport of a printed report. Scenes are stacked down the page and each
   owns its own paper stock, so the page stains as the smoke arrives: clean
   stock over Punjab at dawn, the colour of the air by the time the plume is
   over Delhi. Nothing cross-fades — each scene is a separate printed page,
   and the step between them is the point.

   An earlier pass filled these with saturated colour and cartoon figures. The
   colour progression survived that; the illustration did not. What sits in a
   scene now is the map, and the map is data.
*/

export interface SceneProps {
  children: React.ReactNode;
  /** Paper stock. Use the --color-stain-* tokens. */
  paper: string;
  className?: string;
  height?: string;
  id?: string;
}

export function Scene({ children, paper, className, height = "100svh", id }: SceneProps) {
  return (
    <section
      id={id}
      className={cn("relative overflow-hidden paper-grain", className)}
      style={{ background: paper, minHeight: height }}
    >
      {children}
    </section>
  );
}

/**
 * A parallax layer inside a scene.
 *
 * Travel is in viewport-relative units so a layer moves the same proportion of
 * the frame on a phone as on a monitor. Depth 0 barely moves; depth 1 moves
 * most. Kept subtle here — an editorial page that slides around reads as a
 * template, not a document.
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

  const travel = depth * 9;
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
 * The copy block: a tracked kicker, an editorial headline, a line of prose.
 *
 * Left-aligned and held to a measure. Centring every frame was part of what
 * made the earlier pass read as a poster series rather than a report.
 */
export function SceneCopy({
  kicker,
  headline,
  body,
  ink = "var(--color-ink)",
  className,
  children,
}: {
  kicker?: string;
  headline: React.ReactNode;
  body?: React.ReactNode;
  ink?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15% 0px -15% 0px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn("relative z-20 max-w-xl", className)}
      style={{ color: ink }}
    >
      {kicker && (
        <div className="kicker flex items-center gap-2.5" style={{ opacity: 0.7 }}>
          <span className="inline-block h-px w-6" style={{ background: "currentColor" }} />
          <span>{kicker}</span>
        </div>
      )}
      <h2 className="poster mt-4 text-[clamp(1.6rem,3.6vw,2.6rem)]">{headline}</h2>
      {body && (
        <p
          className="mt-5 max-w-lg text-[clamp(0.9rem,1.2vw,1rem)] leading-relaxed"
          style={{ color: "color-mix(in srgb, currentColor 76%, transparent)" }}
        >
          {body}
        </p>
      )}
      {children}
    </motion.div>
  );
}

/**
 * A figure caption in the map margin.
 *
 * Every visual on the narrative pages carries one, naming what the marks are
 * and where they came from. A map without a source line is an illustration.
 */
export function MapNote({
  title,
  source,
  className,
  ink = "var(--color-ink)",
}: {
  title: string;
  source: string;
  className?: string;
  ink?: string;
}) {
  return (
    <div
      className={cn("max-w-[15rem] border-l pl-3", className)}
      style={{ color: ink, borderColor: "color-mix(in srgb, currentColor 28%, transparent)" }}
    >
      <div className="smallcaps" style={{ opacity: 0.85 }}>
        {title}
      </div>
      <div className="font-technical mt-1.5 text-2xs leading-relaxed" style={{ opacity: 0.62 }}>
        {source}
      </div>
    </div>
  );
}

/** A single figure in a stat row: value, label, and a hairline above. */
export function Stat({
  value,
  label,
  ink = "var(--color-ink)",
}: {
  value: React.ReactNode;
  label: string;
  ink?: string;
}) {
  return (
    <div
      className="border-t pt-3"
      style={{ color: ink, borderColor: "color-mix(in srgb, currentColor 30%, transparent)" }}
    >
      <div className="poster text-[clamp(1.3rem,2.6vw,2rem)] leading-none">{value}</div>
      <div className="smallcaps mt-2" style={{ opacity: 0.6 }}>
        {label}
      </div>
    </div>
  );
}
