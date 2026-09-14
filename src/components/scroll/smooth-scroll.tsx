"use client";

import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

/*
   Weighted scrolling.

   This is the single change that does most of the work in making the page
   read as a filmed sequence rather than a document being dragged. Native
   scroll is instantaneous and slightly jittery at the wheel-event level, and
   every scroll-linked visual inherits that jitter — a camera driven by it
   looks nudged rather than flown.

   Three things this gets right that a hand-rolled version does not:

     · The stylesheet is imported. It sets `html.lenis, html.lenis body
       { height: auto }` and stops iframes swallowing wheel events. Without it
       overflow handling on the root element is wrong and scrolling can lock
       up outright. An earlier hand-rolled version of this component omitted
       it entirely.

     · One loop owns the clock. ReactLenis in `root` mode runs its own rAF and
       drives the real scroll position, so every `useScroll` in this codebase,
       every anchor, the browser's own scrollbar and scroll restoration all
       keep working unchanged — and no second loop can drift out of phase
       with it.

     · Reduced motion turns it off completely rather than shortening it.
       Inertial scrolling is exactly what people disable that setting to
       avoid, so the honest response is native scroll, not fast smoothing.
*/

export function SmoothScroll({ children }: { children?: React.ReactNode }) {
  /*
     Rendered as plain children until the preference is known. Assuming
     smoothing and then tearing it away is worse than a frame of native
     scroll, and the query cannot be read during server rendering.
  */
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    /* The listener callback is not the effect body, so this does not trigger
       the cascading render a synchronous setState here would. */
    const timer = window.setTimeout(apply, 0);
    mq.addEventListener("change", apply);
    return () => {
      window.clearTimeout(timer);
      mq.removeEventListener("change", apply);
    };
  }, []);

  if (reduced !== false) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        /* Long enough to feel weighted, short enough that a deliberate scroll
           still arrives when the reader expects it. */
        duration: 1.1,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
        /* Touch devices already have inertial scrolling from the OS; layering
           ours on top fights it and reads as lag. */
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}
