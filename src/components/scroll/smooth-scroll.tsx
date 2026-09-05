"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/*
   Weighted scrolling.

   This is the one change that does most of the work in making the page read
   as a filmed sequence rather than a document being dragged. Native scroll is
   instantaneous and slightly jittery at the wheel-event level; every
   scroll-linked visual inherits that jitter, and a camera driven by it looks
   like it is being nudged rather than flown.

   Lenis is wired to drive the real scroll position rather than transforming a
   wrapper, which matters here: every existing `useScroll` in this codebase
   keeps working unchanged, and so do anchors, the browser's own scrollbar and
   restoration on back-navigation.

   Two rules this component enforces:

     · One animation loop. Lenis is stepped from a single rAF, and framer's
       scroll listeners read the position it writes. Running Lenis's ticker
       alongside another one drifts them out of phase, which shows up as
       scroll-linked animation that stutters in a way that is hard to trace.

     · Reduced motion turns it off entirely. Smoothing is exactly the kind of
       inertial movement people disable it for.
*/
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const lenis = new Lenis({
      /* Long enough to feel weighted, short enough that a deliberate scroll
         still arrives when the reader expects it. */
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      /* Touch devices already have inertial scrolling from the OS; layering
         ours on top fights it and feels laggy. */
      smoothWheel: true,
      syncTouch: false,
    });

    let frame = 0;
    const step = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
