import "server-only";

/*
   Active fire detections, from NASA FIRMS.

   VIIRS at 375 m is the product that matters for crop-residue burning: MODIS
   at 1 km misses a large share of individual field fires, and the whole
   attribution argument depends on counting them. FIRMS NRT runs roughly three
   hours behind acquisition, which is why the transport model has to forecast
   forward rather than merely report — by the time a fire is visible in the
   feed, its smoke has already been moving for hours.

   FIRMS issues free MAP_KEYs from firms.modaps.eosdis.nasa.gov/api/map_key/.
   Without one, the recorded 3 November 2024 detections stand in.
*/

const ENDPOINT = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const TIMEOUT_MS = 15_000;

export interface FireDetection {
  lat: number;
  lng: number;
  /** Fire Radiative Power, MW. Marker area scales with this. */
  frp: number;
  brightnessK: number;
  confidence: "low" | "nominal" | "high";
  satellite: string;
  /** True acquisition time, which is what the replay scrubs against. */
  acquiredAt: string;
  daynight: "D" | "N";
}

export interface FireSet {
  detections: FireDetection[];
  live: boolean;
  source: string;
  fetchedAt: string;
  /** west, south, east, north */
  bbox: [number, number, number, number];
  note?: string;
}

/* Punjab, Haryana and the NCR approach. */
export const PUNJAB_HARYANA_BBOX: [number, number, number, number] = [73.8, 27.6, 78.0, 32.6];

function normaliseConfidence(raw: string): FireDetection["confidence"] {
  const v = raw.trim().toLowerCase();
  if (v === "h" || v === "high") return "high";
  if (v === "l" || v === "low") return "low";
  if (v === "n" || v === "nominal") return "nominal";
  const numeric = Number(v);
  if (Number.isFinite(numeric)) {
    if (numeric >= 80) return "high";
    if (numeric >= 30) return "nominal";
    return "low";
  }
  return "nominal";
}

/* FIRMS returns acq_date as YYYY-MM-DD and acq_time as HHMM, both UTC. */
function toIso(date: string, time: string): string {
  const padded = time.padStart(4, "0");
  return `${date}T${padded.slice(0, 2)}:${padded.slice(2)}:00Z`;
}

export async function fetchFireDetections(
  bbox: [number, number, number, number] = PUNJAB_HARYANA_BBOX,
  dayRange = 2
): Promise<FireSet> {
  const mapKey = process.env.FIRMS_MAP_KEY?.trim();
  const fetchedAt = new Date().toISOString();

  if (!mapKey) {
    return {
      detections: RECORDED_DETECTIONS,
      live: false,
      source: "Recorded VIIRS S-NPP detections · 2024-11-02/03",
      fetchedAt,
      bbox,
      note: "No FIRMS_MAP_KEY configured; serving the recorded episode detections.",
    };
  }

  const url = `${ENDPOINT}/${mapKey}/VIIRS_SNPP_NRT/${bbox.join(",")}/${dayRange}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const csv = await res.text();

    /* FIRMS answers a bad key with a 200 and an HTML or prose body. */
    if (!csv.startsWith("country_id") && !csv.startsWith("latitude")) {
      throw new Error("FIRMS returned a non-CSV body, which usually means the MAP_KEY was rejected");
    }

    const [header, ...rows] = csv.trim().split("\n");
    const cols = header.split(",").map((c) => c.trim());
    const at = (parts: string[], name: string) => {
      const i = cols.indexOf(name);
      return i === -1 ? "" : (parts[i] ?? "").trim();
    };

    const detections: FireDetection[] = rows
      .map((row) => row.split(","))
      .filter((parts) => parts.length === cols.length)
      .map((parts) => ({
        lat: Number(at(parts, "latitude")),
        lng: Number(at(parts, "longitude")),
        frp: Number(at(parts, "frp")) || 0,
        brightnessK: Number(at(parts, "bright_ti4")) || 0,
        confidence: normaliseConfidence(at(parts, "confidence")),
        satellite: at(parts, "satellite") || "VIIRS S-NPP",
        acquiredAt: toIso(at(parts, "acq_date"), at(parts, "acq_time")),
        daynight: (at(parts, "daynight") as "D" | "N") || "D",
      }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));

    return {
      detections,
      live: true,
      source: `NASA FIRMS · VIIRS S-NPP NRT, 375 m, last ${dayRange}d`,
      fetchedAt,
      bbox,
    };
  } catch (error) {
    return {
      detections: RECORDED_DETECTIONS,
      live: false,
      source: "Recorded VIIRS S-NPP detections · 2024-11-02/03",
      fetchedAt,
      bbox,
      note:
        error instanceof Error
          ? `FIRMS unreachable (${error.message}); serving the recorded detections.`
          : "FIRMS unreachable; serving the recorded detections.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* A representative slice of the 2 November 2024 Punjab burning peak. */
const RECORDED_DETECTIONS: FireDetection[] = [
  { lat: 30.2458, lng: 75.8421, frp: 42.6, brightnessK: 338.2, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T07:42:00Z", daynight: "D" },
  { lat: 30.1912, lng: 75.7104, frp: 61.3, brightnessK: 351.7, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T07:42:00Z", daynight: "D" },
  { lat: 30.3387, lng: 76.4012, frp: 28.9, brightnessK: 329.4, confidence: "nominal", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T07:44:00Z", daynight: "D" },
  { lat: 30.6104, lng: 75.8877, frp: 55.1, brightnessK: 346.9, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T07:44:00Z", daynight: "D" },
  { lat: 30.4721, lng: 75.3318, frp: 37.4, brightnessK: 334.1, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T08:06:00Z", daynight: "D" },
  { lat: 30.0294, lng: 75.5209, frp: 71.8, brightnessK: 358.3, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T08:06:00Z", daynight: "D" },
  { lat: 30.8017, lng: 75.2143, frp: 19.7, brightnessK: 322.8, confidence: "nominal", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T08:08:00Z", daynight: "D" },
  { lat: 30.9142, lng: 74.9021, frp: 44.2, brightnessK: 340.6, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T08:08:00Z", daynight: "D" },
  { lat: 31.1038, lng: 75.0447, frp: 33.5, brightnessK: 331.9, confidence: "nominal", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T20:31:00Z", daynight: "N" },
  { lat: 30.5566, lng: 76.1188, frp: 48.9, brightnessK: 343.2, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-02T20:31:00Z", daynight: "N" },
  { lat: 29.9871, lng: 76.8134, frp: 22.4, brightnessK: 325.6, confidence: "nominal", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-03T07:38:00Z", daynight: "D" },
  { lat: 29.7204, lng: 76.6612, frp: 30.1, brightnessK: 330.7, confidence: "nominal", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-03T07:38:00Z", daynight: "D" },
  { lat: 30.2119, lng: 75.6883, frp: 66.7, brightnessK: 354.1, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-03T07:40:00Z", daynight: "D" },
  { lat: 30.3902, lng: 75.9946, frp: 51.2, brightnessK: 345.0, confidence: "high", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-03T07:40:00Z", daynight: "D" },
  { lat: 29.5583, lng: 76.4471, frp: 17.8, brightnessK: 320.4, confidence: "low", satellite: "VIIRS S-NPP", acquiredAt: "2024-11-03T08:02:00Z", daynight: "D" },
];
