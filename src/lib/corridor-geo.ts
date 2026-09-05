/*
   Corridor geometry.

   The flight scene is drawn in a local tangent plane rather than on a globe,
   because at corridor scale — roughly 210 km from the Sangrur source centroid
   to the Delhi receptor — curvature is far below the width of a single
   attribution cell and pretending otherwise would cost accuracy, not buy it.

   One world unit is 10 km. Delhi sits at the origin, +x runs east and +z runs
   south, so the corridor runs from the upper-left of the scene toward the
   viewer's origin, which is the direction the smoke actually travels.
*/

/** Receptor origin: Anand Vihar, Delhi. */
export const ORIGIN = { lat: 28.6469, lng: 77.3162 };

const KM_PER_DEG_LAT = 110.574;
const UNITS_PER_KM = 0.1;

export function project(lat: number, lng: number): [number, number] {
  const kmPerDegLng = 111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180);
  const x = (lng - ORIGIN.lng) * kmPerDegLng * UNITS_PER_KM;
  const z = -(lat - ORIGIN.lat) * KM_PER_DEG_LAT * UNITS_PER_KM;
  return [x, z];
}

export interface CorridorNode {
  label: string;
  state: string;
  lat: number;
  lng: number;
  /** Share of the receptor's excess attributed to this cell, per cent. */
  contribution?: number;
  kind: "source" | "waypoint" | "receptor";
}

/*
   The corridor, source to receptor. Contributions are the episode's own
   attribution register, not a plausible-looking spread — they sum with the
   remaining cells to the 92.2% the certificate reports.
*/
export const CORRIDOR_NODES: CorridorNode[] = [
  { label: "Sangrur", state: "Punjab", lat: 30.245, lng: 75.844, contribution: 31.4, kind: "source" },
  { label: "Patiala", state: "Punjab", lat: 30.340, lng: 76.386, contribution: 22.7, kind: "source" },
  { label: "Ludhiana", state: "Punjab", lat: 30.901, lng: 75.857, contribution: 18.9, kind: "source" },
  { label: "Bathinda", state: "Punjab", lat: 30.211, lng: 74.945, contribution: 7.6, kind: "source" },
  { label: "Moga", state: "Punjab", lat: 30.821, lng: 75.171, contribution: 6.1, kind: "source" },
  { label: "Kurukshetra", state: "Haryana", lat: 29.969, lng: 76.878, contribution: 3.2, kind: "waypoint" },
  { label: "Karnal", state: "Haryana", lat: 29.686, lng: 76.990, contribution: 1.6, kind: "waypoint" },
  { label: "Panipat", state: "Haryana", lat: 29.391, lng: 76.977, contribution: 0.7, kind: "waypoint" },
  { label: "Sonipat", state: "Haryana", lat: 28.995, lng: 77.022, kind: "waypoint" },
  { label: "Delhi", state: "Delhi", lat: 28.647, lng: 77.316, kind: "receptor" },
];

/*
   The transport path, ordered source to receptor.

   These are the points the plume is advected along and the camera is flown
   over. They follow the 925 hPa flow that carried the 3 November episode, not
   a straight line between endpoints — the corridor bends east over Haryana
   before turning down into the NCR, and a straight line would put the plume
   over districts it never crossed.
*/
export const TRANSPORT_PATH: [number, number][] = [
  [30.55, 75.35],
  [30.31, 75.72],
  [30.18, 76.10],
  [30.02, 76.48],
  [29.84, 76.79],
  [29.63, 76.96],
  [29.38, 77.03],
  [29.10, 77.08],
  [28.86, 77.20],
  [28.647, 77.316],
];

/** Projected transport path, as flat [x, z] pairs. */
export const TRANSPORT_XZ: [number, number][] = TRANSPORT_PATH.map(([lat, lng]) =>
  project(lat, lng)
);

/**
 * The 0.1° attribution grid, as line segments in world space.
 *
 * 0.1° is the cell size the register resolves to, so the graticule here is
 * the actual analysis grid rather than decorative floor lines.
 */
export function attributionGrid(
  latMin = 28.2,
  latMax = 31.2,
  lngMin = 74.6,
  lngMax = 77.8,
  step = 0.1
): Float32Array {
  const segments: number[] = [];

  for (let lat = latMin; lat <= latMax + 1e-9; lat += step) {
    const [x1, z1] = project(lat, lngMin);
    const [x2, z2] = project(lat, lngMax);
    segments.push(x1, 0, z1, x2, 0, z2);
  }
  for (let lng = lngMin; lng <= lngMax + 1e-9; lng += step) {
    const [x1, z1] = project(latMin, lng);
    const [x2, z2] = project(latMax, lng);
    segments.push(x1, 0, z1, x2, 0, z2);
  }

  return new Float32Array(segments);
}
