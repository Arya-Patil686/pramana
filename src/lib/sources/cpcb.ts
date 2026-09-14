import "server-only";

/*
   CPCB continuous ambient monitoring, via data.gov.in.

   This is the reference network an Indian regulator actually acts on, and the
   only one whose numbers carry statutory weight in a GRAP decision. Google's
   Air Quality API is the incumbent baseline the validation page scores
   against; this is ground truth.

   The Open Government Data platform serves it as resource
   3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69, one row per station per pollutant.
   Keys are free from data.gov.in/user/register and are issued immediately.

   Rows arrive per pollutant, so a station appears several times and has to be
   folded back together. The sub-index arithmetic below is CPCB's own National
   Air Quality Index method: compute a sub-index per pollutant against its
   breakpoint table, and the station AQI is the worst of them — not the mean,
   which is the most common way this gets reported wrongly.
*/

const ENDPOINT = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";
const TIMEOUT_MS = 15_000;

export interface StationReading {
  stationId: string;
  station: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  /** Pollutant concentrations, µg/m³ (CO in mg/m³). */
  pollutants: Record<string, number>;
  /** CPCB National AQI: the worst sub-index across scoreable pollutants. */
  aqi: number | null;
  dominant: string | null;
  /** Pollutants the station reported that the index could not score. */
  excluded: string[];
  updatedAt: string;
}

export interface StationSet {
  stations: StationReading[];
  live: boolean;
  source: string;
  fetchedAt: string;
  note?: string;
}

/*
   CPCB National AQI breakpoints, µg/m³ except CO (mg/m³).
   Each entry is [Clow, Chigh, Ilow, Ihigh]; sub-index interpolates linearly
   inside the band the concentration falls in.
*/
const BREAKPOINTS: Record<string, [number, number, number, number][]> = {
  pm25: [[0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500]],
  pm10: [[0, 50, 0, 50], [50, 100, 51, 100], [100, 250, 101, 200], [250, 350, 201, 300], [350, 430, 301, 400], [430, 600, 401, 500]],
  no2: [[0, 40, 0, 50], [40, 80, 51, 100], [80, 180, 101, 200], [180, 280, 201, 300], [280, 400, 301, 400], [400, 1000, 401, 500]],
  so2: [[0, 40, 0, 50], [40, 80, 51, 100], [80, 380, 101, 200], [380, 800, 201, 300], [800, 1600, 301, 400], [1600, 2400, 401, 500]],
  /*
     CO is deliberately absent.

     CPCB's method needs CO in mg/m³, and the data.gov.in feed reports values
     between roughly 11 and 73 for it. That is not mg/m³ — 73 mg/m³ of ambient
     CO would be acutely dangerous, not a Tuesday in Delhi — and it is not
     µg/m³ either, which would be implausibly low for any urban air. The unit
     is genuinely ambiguous in the feed.

     Read as mg/m³ it pegged every one of the 124 stations at the 500 cap with
     CO as the dominant pollutant, which is plainly wrong. Read as µg/m³ it
     contributes nothing. Rather than pick whichever wrong answer looks
     better, CO is excluded from the index and the exclusion is reported, so
     nobody mistakes a six-pollutant index for the full seven.
  */
  o3: [[0, 50, 0, 50], [50, 100, 51, 100], [100, 168, 101, 200], [168, 208, 201, 300], [208, 748, 301, 400], [748, 1000, 401, 500]],
  nh3: [[0, 200, 0, 50], [200, 400, 51, 100], [400, 800, 101, 200], [800, 1200, 201, 300], [1200, 1800, 301, 400], [1800, 2400, 401, 500]],
};

export function subIndex(pollutant: string, value: number): number | null {
  const table = BREAKPOINTS[pollutant];
  if (!table || !Number.isFinite(value) || value < 0) return null;
  for (const [cLow, cHigh, iLow, iHigh] of table) {
    if (value <= cHigh) {
      return Math.round(iLow + ((iHigh - iLow) / (cHigh - cLow)) * (value - cLow));
    }
  }
  /* Above the top breakpoint the index is capped at 500 by definition. */
  return 500;
}

/** CPCB National AQI: the maximum sub-index, and the pollutant that set it. */
export function nationalAqi(
  pollutants: Record<string, number>
): { aqi: number | null; dominant: string | null; excluded: string[] } {
  let aqi: number | null = null;
  let dominant: string | null = null;
  const excluded: string[] = [];

  for (const [p, v] of Object.entries(pollutants)) {
    if (!(p in BREAKPOINTS)) {
      /* Reported by the station but not scoreable — currently only CO, whose
         unit the feed does not pin down. Named rather than dropped silently. */
      excluded.push(p);
      continue;
    }
    const si = subIndex(p, v);
    if (si != null && (aqi == null || si > aqi)) {
      aqi = si;
      dominant = p;
    }
  }
  return { aqi, dominant, excluded };
}

const POLLUTANT_KEY: Record<string, string> = {
  "PM2.5": "pm25",
  PM10: "pm10",
  NO2: "no2",
  SO2: "so2",
  CO: "co",
  OZONE: "o3",
  NH3: "nh3",
};

interface Row {
  id?: string;
  country?: string;
  state?: string;
  city?: string;
  station?: string;
  last_update?: string;
  latitude?: string;
  longitude?: string;
  pollutant_id?: string;
  pollutant_avg?: string;
  avg_value?: string;
}

export async function fetchCpcbStations(
  states: string[] = ["Delhi", "Punjab", "Haryana", "Uttar_Pradesh"],
  limit = 1000
): Promise<StationSet> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
  const fetchedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      stations: RECORDED_STATIONS,
      live: false,
      source: "Recorded CPCB reference readings · 2024-11-03 18:00 IST",
      fetchedAt,
      note: "No DATA_GOV_IN_API_KEY configured; serving the recorded episode readings.",
    };
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`data.gov.in ${res.status}`);
    const json = await res.json();
    const rows: Row[] = json.records ?? [];
    if (rows.length === 0) throw new Error("data.gov.in returned no records");

    /* Fold the per-pollutant rows back into one record per station. */
    const wanted = new Set(states.map((s) => s.toLowerCase().replace(/[\s_]/g, "")));
    const byStation = new Map<string, StationReading>();

    for (const r of rows) {
      const state = (r.state ?? "").trim();
      if (wanted.size && !wanted.has(state.toLowerCase().replace(/[\s_]/g, ""))) continue;

      const key = `${state}|${r.city}|${r.station}`;
      const entry =
        byStation.get(key) ??
        {
          stationId: r.id ?? key,
          station: (r.station ?? "").trim(),
          city: (r.city ?? "").trim(),
          state,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          pollutants: {} as Record<string, number>,
          aqi: null,
          dominant: null,
          excluded: [] as string[],
          updatedAt: (r.last_update ?? fetchedAt).trim(),
        };

      const p = POLLUTANT_KEY[(r.pollutant_id ?? "").trim().toUpperCase()];
      const raw = r.pollutant_avg ?? r.avg_value;
      const value = Number(raw);
      /* The feed uses "NA" for a station that did not report. */
      if (p && Number.isFinite(value)) entry.pollutants[p] = value;

      byStation.set(key, entry);
    }

    const stations = [...byStation.values()]
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Object.keys(s.pollutants).length > 0)
      .map((s) => ({ ...s, ...nationalAqi(s.pollutants) }));

    return {
      stations,
      live: true,
      source: `CPCB CAAQMS via data.gov.in · ${stations.length} stations`,
      fetchedAt,
    };
  } catch (error) {
    return {
      stations: RECORDED_STATIONS,
      live: false,
      source: "Recorded CPCB reference readings · 2024-11-03 18:00 IST",
      fetchedAt,
      note:
        error instanceof Error
          ? `data.gov.in unreachable (${error.message}); serving the recorded readings.`
          : "data.gov.in unreachable; serving the recorded readings.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/*
   A slice of the 3 November 2024 NCR network at the episode peak.

   AQI is derived by the same nationalAqi() above rather than written in, so a
   recorded reading can never disagree with the index method the live path
   uses. An earlier draft hardcoded 447 for Anand Vihar where the breakpoints
   give 426, which is exactly the kind of drift this avoids.
*/
const RECORDED_STATIONS: StationReading[] = ([
  { stationId: "DL001", station: "Anand Vihar", city: "Delhi", state: "Delhi", lat: 28.6469, lng: 77.3162, pollutants: { pm25: 312.4, pm10: 486.1, no2: 78.3, so2: 19.7, co: 3.2, o3: 14.2 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "DL002", station: "Punjabi Bagh", city: "Delhi", state: "Delhi", lat: 28.6742, lng: 77.1310, pollutants: { pm25: 298.1, pm10: 452.7, no2: 71.2, so2: 17.4, co: 2.9, o3: 16.8 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "DL003", station: "R K Puram", city: "Delhi", state: "Delhi", lat: 28.5635, lng: 77.1866, pollutants: { pm25: 276.5, pm10: 421.3, no2: 64.8, so2: 15.1, co: 2.6, o3: 19.4 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "HR001", station: "Sector 51", city: "Gurugram", state: "Haryana", lat: 28.4211, lng: 77.0469, pollutants: { pm25: 241.9, pm10: 388.4, no2: 58.3, so2: 13.9, co: 2.3, o3: 21.7 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "HR002", station: "Sector 125", city: "Noida", state: "Uttar_Pradesh", lat: 28.5449, lng: 77.3260, pollutants: { pm25: 259.2, pm10: 402.6, no2: 61.7, so2: 14.6, co: 2.5, o3: 18.1 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "PB001", station: "Model Town", city: "Patiala", state: "Punjab", lat: 30.3398, lng: 76.3869, pollutants: { pm25: 168.4, pm10: 271.9, no2: 39.2, so2: 11.3, co: 1.7, o3: 24.6 }, updatedAt: "2024-11-03T18:00:00+05:30" },
  { stationId: "PB002", station: "Punjab Agricultural University", city: "Ludhiana", state: "Punjab", lat: 30.9010, lng: 75.8573, pollutants: { pm25: 186.7, pm10: 294.2, no2: 43.8, so2: 12.7, co: 1.9, o3: 22.3 }, updatedAt: "2024-11-03T18:00:00+05:30" },
] as Omit<StationReading, "aqi" | "dominant" | "excluded">[]).map((s) => ({
  ...s,
  ...nationalAqi(s.pollutants),
}));
