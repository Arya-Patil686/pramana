/*
   Orbit state for the interactive scene.

   Written rather than pulled from drei, for one reason: the scene needs to
   fly between named viewpoints on a button press, and a controller that owns
   the camera fights any attempt to animate it from outside. Here the camera
   is derived from three numbers — azimuth, polar, radius — so dragging and
   flying to a preset are the same operation on the same state, and cannot
   disagree about where the camera is.

   Pure functions and a plain object, so the arithmetic is testable without a
   renderer.
*/

export interface Orbit {
  /** Radians, around the vertical axis. */
  azimuth: number;
  /** Radians from vertical. Clamped away from the poles. */
  polar: number;
  /** Distance from the target. */
  radius: number;
  /** What the camera looks at, in world units. */
  target: [number, number, number];
}

/* Never let the camera reach the poles: at the top the azimuth becomes
   meaningless and the view rolls unpredictably as the user keeps dragging. */
export const POLAR_MIN = 0.12;
export const POLAR_MAX = Math.PI / 2 - 0.04;
export const RADIUS_MIN = 6;
export const RADIUS_MAX = 70;

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Spherical orbit to a world-space camera position. */
export function orbitToPosition(o: Orbit): [number, number, number] {
  const sinP = Math.sin(o.polar);
  return [
    o.target[0] + o.radius * sinP * Math.sin(o.azimuth),
    o.target[1] + o.radius * Math.cos(o.polar),
    o.target[2] + o.radius * sinP * Math.cos(o.azimuth),
  ];
}

export function applyDrag(o: Orbit, dx: number, dy: number, speed = 0.0055): Orbit {
  return {
    ...o,
    azimuth: o.azimuth - dx * speed,
    polar: clamp(o.polar - dy * speed, POLAR_MIN, POLAR_MAX),
  };
}

export function applyZoom(o: Orbit, deltaY: number): Orbit {
  /* Multiplicative, so a notch of wheel covers the same proportion of the
     remaining distance whether the camera is close in or far out. */
  const factor = Math.exp(deltaY * 0.0012);
  return { ...o, radius: clamp(o.radius * factor, RADIUS_MIN, RADIUS_MAX) };
}

/** Shortest signed angular difference, so a fly-to never takes the long way. */
export function shortestAngle(from: number, to: number): number {
  return ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

/** Frame-rate independent easing toward a target orbit. */
export function easeOrbit(current: Orbit, goal: Orbit, delta: number, rate = 0.0025): Orbit {
  const k = 1 - Math.pow(rate, delta);
  return {
    azimuth: current.azimuth + shortestAngle(current.azimuth, goal.azimuth) * k,
    polar: current.polar + (goal.polar - current.polar) * k,
    radius: current.radius + (goal.radius - current.radius) * k,
    target: [
      current.target[0] + (goal.target[0] - current.target[0]) * k,
      current.target[1] + (goal.target[1] - current.target[1]) * k,
      current.target[2] + (goal.target[2] - current.target[2]) * k,
    ],
  };
}
