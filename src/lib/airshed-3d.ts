/*
   The airshed as a volume.

   Shared constants and helpers for the 3D scene, kept out of the component so
   the geometry can be reasoned about — and unit-tested — without a renderer.

   Coordinates match the 2D map exactly: x and z come from the same
   `project()`, one world unit is ten kilometres. Only Y is new.
*/

export const UNITS_PER_KM = 0.1;

/**
 * Vertical exaggeration.
 *
 * The corridor is 210 km long and the layer that matters is under 2 km deep,
 * so at true scale the whole atmosphere is a film one hundredth the width of
 * the scene — invisible, and useless for showing the thing the scene exists to
 * show. Exaggerating by 25 makes the boundary layer legible against the
 * corridor. Standard practice in atmospheric visualisation, and dishonest only
 * if it is not declared: the scene labels it on screen.
 */
export const VERTICAL_EXAGGERATION = 45;

/** Metres above ground to world units. */
export function altitude(metres: number): number {
  return (metres / 1000) * UNITS_PER_KM * VERTICAL_EXAGGERATION;
}

/**
 * Geopotential height of the 925 hPa surface, in metres.
 *
 * Roughly 750 m over the Indo-Gangetic plain in the post-monsoon season. Used
 * as the transport level the plume rides, and drawn as a labelled reference
 * plane so the vertical position of the smoke is readable rather than
 * decorative.
 */
export const TRANSPORT_LEVEL_M = 750;

/** Where the reference planes sit, in world units. */
export const Y_TRANSPORT = altitude(TRANSPORT_LEVEL_M);

/** Bearing (degrees from north) to a unit vector in world x/z. */
export function bearingToVector(bearingDeg: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  /* +x is east, +z is south, so a northward bearing is -z. */
  return [Math.sin(rad), -Math.cos(rad)];
}

/** Smoothstep between two scroll positions, clamped. */
export function ramp(p: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic noise.
 *
 * The particle field is seeded from a fixed sequence rather than Math.random,
 * so a re-render cannot reshuffle the plume and two runs of the scene are
 * comparable frame for frame.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
