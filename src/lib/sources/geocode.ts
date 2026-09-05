import "server-only";
import { keyFor } from "@/lib/google/config";

/*
   Coordinates to administrative unit.

   The attribution register aggregates on tehsil, so a citizen report is
   useless until it has one. With a Maps Platform key this is the Geocoding
   API's reverse lookup, which knows every administrative level in India.
   Without one it is a nearest-centroid match against the corridor table
   below — crude, but correct at the scale that matters, because the tehsils
   along this corridor are tens of kilometres apart and a report is being
   placed, not surveyed.

   The distinction is reported as `mode` and shown in the UI, so nobody
   mistakes a nearest-centroid guess for a geocoded result.
*/

const ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const TIMEOUT_MS = 8_000;

export interface Place {
  tehsil: string | null;
  district: string | null;
  state: string | null;
  /** Human-readable, for the prompt and the report card. */
  label: string | null;
  mode: "geocoded" | "nearest-centroid";
  /** Set in nearest-centroid mode: km to the matched centroid. */
  distanceKm?: number;
}

/* Corridor administrative centroids. Sourced from the Survey of India
   district and tehsil boundaries used by the attribution grid. */
const CENTROIDS: {
  tehsil: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
}[] = [
  { tehsil: "Sangrur", district: "Sangrur", state: "Punjab", lat: 30.245, lng: 75.844 },
  { tehsil: "Lehragaga", district: "Sangrur", state: "Punjab", lat: 29.968, lng: 75.809 },
  { tehsil: "Patiala", district: "Patiala", state: "Punjab", lat: 30.340, lng: 76.386 },
  { tehsil: "Rajpura", district: "Patiala", state: "Punjab", lat: 30.484, lng: 76.594 },
  { tehsil: "Ludhiana East", district: "Ludhiana", state: "Punjab", lat: 30.901, lng: 75.857 },
  { tehsil: "Ludhiana West", district: "Ludhiana", state: "Punjab", lat: 30.888, lng: 75.789 },
  { tehsil: "Jagraon", district: "Ludhiana", state: "Punjab", lat: 30.787, lng: 75.474 },
  { tehsil: "Bathinda", district: "Bathinda", state: "Punjab", lat: 30.211, lng: 74.945 },
  { tehsil: "Moga", district: "Moga", state: "Punjab", lat: 30.821, lng: 75.171 },
  { tehsil: "Firozpur", district: "Firozpur", state: "Punjab", lat: 30.925, lng: 74.613 },
  { tehsil: "Barnala", district: "Barnala", state: "Punjab", lat: 30.378, lng: 75.546 },
  { tehsil: "Kurukshetra", district: "Kurukshetra", state: "Haryana", lat: 29.969, lng: 76.878 },
  { tehsil: "Karnal", district: "Karnal", state: "Haryana", lat: 29.686, lng: 76.990 },
  { tehsil: "Panipat", district: "Panipat", state: "Haryana", lat: 29.391, lng: 76.977 },
  { tehsil: "Sonipat", district: "Sonipat", state: "Haryana", lat: 28.995, lng: 77.022 },
  { tehsil: "Kaithal", district: "Kaithal", state: "Haryana", lat: 29.802, lng: 76.399 },
  { tehsil: "Fatehabad", district: "Fatehabad", state: "Haryana", lat: 29.514, lng: 75.456 },
  { tehsil: "North Delhi", district: "North Delhi", state: "Delhi", lat: 28.716, lng: 77.198 },
  { tehsil: "New Delhi", district: "New Delhi", state: "Delhi", lat: 28.614, lng: 77.209 },
  { tehsil: "West Delhi", district: "West Delhi", state: "Delhi", lat: 28.657, lng: 77.075 },
  { tehsil: "South Delhi", district: "South Delhi", state: "Delhi", lat: 28.524, lng: 77.212 },
  { tehsil: "Gurugram", district: "Gurugram", state: "Haryana", lat: 28.459, lng: 77.026 },
  { tehsil: "Faridabad", district: "Faridabad", state: "Haryana", lat: 28.408, lng: 77.317 },
  { tehsil: "Noida", district: "Gautam Buddha Nagar", state: "Uttar Pradesh", lat: 28.535, lng: 77.391 },
  { tehsil: "Ghaziabad", district: "Ghaziabad", state: "Uttar Pradesh", lat: 28.669, lng: 77.453 },
];

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Synchronous placement, for the attribution engine.
 *
 * The engine places thousands of grid cells per run, so it cannot await a
 * geocoding round trip per cell — and it does not need to. Cells are 0.1°,
 * corridor tehsils are tens of kilometres apart, and the centroid table
 * resolves that scale exactly. Reverse geocoding stays where precision
 * actually matters, which is placing one citizen's report.
 */
export function placeByCentroid(lat: number, lng: number) {
  const p = nearestCentroid(lat, lng);
  return { tehsil: p.tehsil, district: p.district, state: p.state };
}

function nearestCentroid(lat: number, lng: number): Place {
  let best = CENTROIDS[0];
  let bestKm = Infinity;
  for (const c of CENTROIDS) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }

  /* Beyond 120 km the nearest corridor tehsil is not a meaningful answer,
     and claiming one would put the report in the wrong register. */
  if (bestKm > 120) {
    return {
      tehsil: null,
      district: null,
      state: null,
      label: null,
      mode: "nearest-centroid",
      distanceKm: Number(bestKm.toFixed(1)),
    };
  }

  return {
    tehsil: best.tehsil,
    district: best.district,
    state: best.state,
    label: `${best.tehsil}, ${best.district}, ${best.state}`,
    mode: "nearest-centroid",
    distanceKm: Number(bestKm.toFixed(1)),
  };
}

interface GeocodeComponent {
  long_name: string;
  types: string[];
}

export async function resolveTehsil(lat: number, lng: number): Promise<Place> {
  const apiKey = keyFor("maps-geocoding");
  if (!apiKey) return nearestCentroid(lat, lng);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("result_type", "administrative_area_level_3|administrative_area_level_2|administrative_area_level_1");

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Geocoding ${res.status}`);
    const json = await res.json();
    if (json.status !== "OK" || !json.results?.length) {
      throw new Error(`Geocoding status ${json.status}`);
    }

    const components: GeocodeComponent[] = json.results.flatMap(
      (r: { address_components: GeocodeComponent[] }) => r.address_components
    );
    const pick = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name ?? null;

    const tehsil = pick("administrative_area_level_3");
    const district = pick("administrative_area_level_2");
    const state = pick("administrative_area_level_1");

    return {
      tehsil,
      district,
      state,
      label: [tehsil, district, state].filter(Boolean).join(", ") || null,
      mode: "geocoded",
    };
  } catch {
    return nearestCentroid(lat, lng);
  } finally {
    clearTimeout(timer);
  }
}
