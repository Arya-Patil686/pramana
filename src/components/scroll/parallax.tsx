"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

/*
   Scroll primitives.

   Depth here is built from differential rates, not from blur or shadow.
   A layer's `speed` is how far it travels, in pixels, across the full time
   its container is on screen. Far layers move least; near layers move most,
   which is how real parallax reads. Every effect collapses to a static
   position when the visitor has asked for reduced motion.
*/

type Offset = Parameters<typeof useScroll>[0] extends { offset?: infer O }
  ? O
  : never;

const ENTER_EXIT = ["start end", "end start"] as unknown as Offset;

/** A layer that drifts vertically as its container crosses the viewport. */
export function ParallaxLayer({
  children,
  speed = 60,
  className,
  innerClassName,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  innerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ENTER_EXIT });
  const raw = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const y = useSpring(raw, { stiffness: 130, damping: 28, mass: 0.35 });

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }} className={innerClassName}>
        {children}
      </motion.div>
    </div>
  );
}

/** Depth-scales and fades a visual as it recedes, for stacked figure layers. */
export function DepthLayer({
  children,
  speed = 40,
  fromScale = 1.06,
  toScale = 1,
  className,
}: {
  children: React.ReactNode;
  speed?: number;
  fromScale?: number;
  toScale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ENTER_EXIT });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [fromScale, toScale, fromScale]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y, scale }}>{children}</motion.div>
    </div>
  );
}

/** Enter animation. Deliberately small: a rise of ten pixels, once. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "tr";
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  return (
    <Comp
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/**
 * A pinned stage. The visual holds still while the narration scrolls past it,
 * which is what makes consecutive sections read as one continuous document
 * rather than a stack of separate pages.
 */
export function StickyStage({
  visual,
  children,
  className,
  visualClassName,
}: {
  visual: (progress: MotionValue<number>) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
  visualClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"] as unknown as Offset,
  });

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div
        className={cn(
          "sticky top-11 h-[calc(100vh-2.75rem)] w-full",
          visualClassName
        )}
      >
        {visual(scrollYProgress)}
      </div>
      <div className="relative z-10 -mt-[calc(100vh-2.75rem)]">{children}</div>
    </div>
  );
}

/** Thin scroll-position readout, fixed to the left edge. */
export function ScrollRail({ label }: { label?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 32,
    mass: 0.3,
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-11 z-40 hidden h-[calc(100vh-2.75rem)] w-px bg-border-subtle lg:block"
    >
      <motion.div
        style={{ scaleY }}
        className="h-full w-full origin-top bg-accent-verify"
      />
      {label && (
        <span className="label-technical absolute left-3 top-4 whitespace-nowrap [writing-mode:vertical-rl]">
          {label}
        </span>
      )}
    </div>
  );
}
