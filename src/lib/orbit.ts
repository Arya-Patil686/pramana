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


/* ── Scripted camera paths ────────────────────────────── */

export interface OrbitKey {
  /** Scroll progress, 0–1, at which this orbit is reached. */
  at: number;
  orbit: Orbit;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The orbit for a given scroll position, interpolated between keys.
 *
 * Lets a scroll-driven sequence and a user-dragged model share one camera
 * implementation: both produce an Orbit, and the same easing carries the
 * camera to it. Before this, a separate keyframe camera existed purely
 * because the scripted scene could not express itself in orbit terms — which
 * meant two cameras, two sets of framing bugs, and only one of them ever
 * getting fixed.
 */
export function orbitAt(progress: number, keys: OrbitKey[]): Orbit {
  if (keys.length === 0) throw new Error("orbitAt needs at least one key");
  const p = clamp(progress, 0, 1);

  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  if (a === b || b.at <= a.at) return a.orbit;

  const k = smooth(clamp((p - a.at) / (b.at - a.at), 0, 1));
  return {
    /* Shortest path, so a sequence never spins the long way round. */
    azimuth: a.orbit.azimuth + shortestAngle(a.orbit.azimuth, b.orbit.azimuth) * k,
    polar: a.orbit.polar + (b.orbit.polar - a.orbit.polar) * k,
    radius: a.orbit.radius + (b.orbit.radius - a.orbit.radius) * k,
    target: [
      a.orbit.target[0] + (b.orbit.target[0] - a.orbit.target[0]) * k,
      a.orbit.target[1] + (b.orbit.target[1] - a.orbit.target[1]) * k,
      a.orbit.target[2] + (b.orbit.target[2] - a.orbit.target[2]) * k,
    ],
  };
}

/**
 * Distance needed to fit `extent` world units across the frame.
 *
 * The overview was a hand-picked radius, which is how it ended up framing the
 * corridor badly: the number was chosen once, against one vertical
 * exaggeration, and never revisited when that changed. Deriving it from the
 * data's own extent means the shot cannot drift out of agreement with what it
 * is supposed to contain.
 */
export function fitRadius(extent: number, fovDeg: number, aspect: number, margin = 1.25): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  /* Fit against the narrower axis, or the scene overflows the other one. */
  const fov = Math.min(vFov, hFov);
  return ((extent / 2) / Math.tan(fov / 2)) * margin;
}
