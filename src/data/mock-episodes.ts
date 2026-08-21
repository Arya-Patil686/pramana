/* ═══════════════════════════════════════════════════════════
   PRAMĀNA — Mock Episode Data
   Structured to mirror real pipeline outputs:
   FIRMS hotspots, TROPOMI, CPCB stations, wind vectors,
   attribution vectors, forecast time series
   ═══════════════════════════════════════════════════════════ */

export interface FireHotspot {
  id: string;
  lat: number;
  lng: number;
  frp: number; // Fire Radiative Power (MW)
  confidence: "low" | "nominal" | "high";
  satellite: "MODIS" | "VIIRS";
  acqDate: string;
}

export interface WindVector {
  lat: number;
  lng: number;
  speed: number; // m/s
  direction: number; // degrees from north
  pressureLevel: number; // hPa
}

export interface StationReading {
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
  aqi: number;
  timestamp: string;
}

export interface AttributionEntry {
  nation: string;
  state: string;
  district: string;
  tehsil: string;
  contribution: number; // percentage
  confidenceLow: number;
  confidenceHigh: number;
  sourceType: "agricultural_burning" | "industrial" | "vehicular" | "mixed";
}

export interface ForecastPoint {
  timestamp: string;
  hour: number; // relative to T0
  pramana: number;
  persistence: number;
  climatology: number;
  googleAQ: number;
}

export interface GRAPThreshold {
  stage: "I" | "II" | "III" | "IV";
  label: string;
  aqiMin: number;
  color: string;
}

export interface Episode {
  id: string;
  name: string;
  date: string;
  corridor: "punjab-delhi" | "chiangmai-bangkok";
  receptorCity: string;
  receptorCoords: [number, number];
  sourceRegion: string;
  peakAQI: number;
  grapStage: "I" | "II" | "III" | "IV";
  leadTimeHours: number;
  fireHotspots: FireHotspot[];
  windVectors: WindVector[];
  stationReadings: StationReading[];
  attribution: AttributionEntry[];
  forecast: ForecastPoint[];
  /** Forecast issue time. Hour 0 on every forecast axis is this instant. */
  forecastT0: string;
  certificateId: string;
}

/* ── GRAP Thresholds ──────────────────────────────────── */
export const GRAP_THRESHOLDS: GRAPThreshold[] = [
  { stage: "I", label: "Poor", aqiMin: 201, color: "#E0603F" },
  { stage: "II", label: "Very Poor", aqiMin: 301, color: "#C94430" },
  { stage: "III", label: "Severe", aqiMin: 401, color: "#A82E1F" },
  { stage: "IV", label: "Severe+", aqiMin: 451, color: "#7D1A10" },
];

/* ── Episode 1: Punjab → Delhi (Nov 2024) ─────────────── */
const punjabDelhiFireHotspots: FireHotspot[] = [
  { id: "FH-001", lat: 30.23, lng: 75.95, frp: 42.3, confidence: "high", satellite: "VIIRS", acqDate: "2024-11-01T06:00:00Z" },
  { id: "FH-002", lat: 30.51, lng: 75.78, frp: 38.1, confidence: "high", satellite: "MODIS", acqDate: "2024-11-01T06:15:00Z" },
  { id: "FH-003", lat: 30.67, lng: 76.12, frp: 55.7, confidence: "high", satellite: "VIIRS", acqDate: "2024-11-01T06:30:00Z" },
  { id: "FH-004", lat: 29.95, lng: 75.55, frp: 28.4, confidence: "nominal", satellite: "MODIS", acqDate: "2024-11-01T07:00:00Z" },
  { id: "FH-005", lat: 30.35, lng: 76.45, frp: 61.2, confidence: "high", satellite: "VIIRS", acqDate: "2024-11-01T07:30:00Z" },
  { id: "FH-006", lat: 30.78, lng: 75.33, frp: 33.5, confidence: "nominal", satellite: "VIIRS", acqDate: "2024-11-01T08:00:00Z" },
  { id: "FH-007", lat: 30.12, lng: 76.67, frp: 47.8, confidence: "high", satellite: "MODIS", acqDate: "2024-11-01T08:15:00Z" },
  { id: "FH-008", lat: 30.89, lng: 75.89, frp: 22.1, confidence: "low", satellite: "VIIRS", acqDate: "2024-11-01T09:00:00Z" },
  { id: "FH-009", lat: 29.78, lng: 76.33, frp: 51.3, confidence: "high", satellite: "MODIS", acqDate: "2024-11-01T09:30:00Z" },
  { id: "FH-010", lat: 30.45, lng: 75.12, frp: 36.9, confidence: "nominal", satellite: "VIIRS", acqDate: "2024-11-01T10:00:00Z" },
  { id: "FH-011", lat: 30.55, lng: 76.55, frp: 44.2, confidence: "high", satellite: "VIIRS", acqDate: "2024-11-01T10:30:00Z" },
  { id: "FH-012", lat: 31.02, lng: 75.67, frp: 29.7, confidence: "nominal", satellite: "MODIS", acqDate: "2024-11-01T11:00:00Z" },
];

const punjabDelhiWindVectors: WindVector[] = [
  { lat: 30.5, lng: 75.8, speed: 4.2, direction: 315, pressureLevel: 925 },
  { lat: 30.2, lng: 76.2, speed: 5.1, direction: 310, pressureLevel: 925 },
  { lat: 29.8, lng: 76.5, speed: 5.8, direction: 305, pressureLevel: 925 },
  { lat: 29.5, lng: 76.8, speed: 6.2, direction: 300, pressureLevel: 925 },
  { lat: 29.2, lng: 77.0, speed: 5.5, direction: 305, pressureLevel: 925 },
  { lat: 28.9, lng: 77.1, speed: 4.8, direction: 310, pressureLevel: 925 },
  { lat: 28.7, lng: 77.2, speed: 4.1, direction: 315, pressureLevel: 925 },
];

const delhiStations: StationReading[] = [
  { stationId: "CPCB-DL-01", stationName: "Anand Vihar", lat: 28.6508, lng: 77.3152, pm25: 389, pm10: 512, no2: 78, so2: 23, o3: 12, aqi: 462, timestamp: "2024-11-03T08:00:00+05:30" },
  { stationId: "CPCB-DL-02", stationName: "RK Puram", lat: 28.5635, lng: 77.1868, pm25: 342, pm10: 478, no2: 65, so2: 19, o3: 18, aqi: 421, timestamp: "2024-11-03T08:00:00+05:30" },
  { stationId: "CPCB-DL-03", stationName: "ITO", lat: 28.6289, lng: 77.2409, pm25: 367, pm10: 498, no2: 72, so2: 21, o3: 15, aqi: 445, timestamp: "2024-11-03T08:00:00+05:30" },
  { stationId: "CPCB-DL-04", stationName: "Dwarka", lat: 28.5798, lng: 77.0498, pm25: 298, pm10: 425, no2: 55, so2: 16, o3: 22, aqi: 385, timestamp: "2024-11-03T08:00:00+05:30" },
  { stationId: "CPCB-DL-05", stationName: "Mundka", lat: 28.6847, lng: 77.0320, pm25: 412, pm10: 545, no2: 82, so2: 27, o3: 9, aqi: 482, timestamp: "2024-11-03T08:00:00+05:30" },
];

const punjabDelhiAttribution: AttributionEntry[] = [
  { nation: "India", state: "Punjab", district: "Sangrur", tehsil: "Malerkotla", contribution: 23.4, confidenceLow: 19.1, confidenceHigh: 27.8, sourceType: "agricultural_burning" },
  { nation: "India", state: "Punjab", district: "Patiala", tehsil: "Nabha", contribution: 18.7, confidenceLow: 14.2, confidenceHigh: 23.1, sourceType: "agricultural_burning" },
  { nation: "India", state: "Punjab", district: "Ludhiana", tehsil: "Jagraon", contribution: 14.2, confidenceLow: 10.5, confidenceHigh: 17.9, sourceType: "mixed" },
  { nation: "India", state: "Punjab", district: "Bathinda", tehsil: "Rampura", contribution: 11.8, confidenceLow: 8.3, confidenceHigh: 15.4, sourceType: "agricultural_burning" },
  { nation: "India", state: "Punjab", district: "Moga", tehsil: "Nihal Singh Wala", contribution: 8.5, confidenceLow: 5.9, confidenceHigh: 11.1, sourceType: "agricultural_burning" },
  { nation: "India", state: "Punjab", district: "Firozpur", tehsil: "Zira", contribution: 6.3, confidenceLow: 3.8, confidenceHigh: 8.8, sourceType: "agricultural_burning" },
  { nation: "India", state: "Haryana", district: "Karnal", tehsil: "Assandh", contribution: 5.1, confidenceLow: 2.9, confidenceHigh: 7.3, sourceType: "agricultural_burning" },
  { nation: "India", state: "Delhi", district: "NCT Delhi", tehsil: "Local", contribution: 7.8, confidenceLow: 5.2, confidenceHigh: 10.4, sourceType: "vehicular" },
  { nation: "India", state: "Uttar Pradesh", district: "Muzaffarnagar", tehsil: "Charthawal", contribution: 4.2, confidenceLow: 2.1, confidenceHigh: 6.3, sourceType: "mixed" },
];

/* Generate 96-hour forecast (T-48 to T+48) */
/*
   Deterministic noise. These series are built at module scope and rendered on
   both the server and the client, so Math.random() here would produce two
   different curves and a hydration mismatch. A seeded generator keeps the
   replay reproducible, which is also the property the whole platform claims.
*/
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ForecastShape {
  /** Forecast issue time. Hour 0 on the axis is this instant. */
  t0: string;
  /** Hours after t0 at which the receptor actually peaks. */
  peakHour: number;
  peakAQI: number;
  baselineAQI: number;
  seed: number;
}

/*
   The episode envelope is anchored to transport physics, not to a sine wave
   spanning the window. Fires are detected around hour 0; the receptor peaks
   roughly `peakHour` hours later, which is the documented Punjab-to-Delhi
   advection time. The three baselines are then defined by how they fail:

     persistence  carries the current value forward, so it only responds once
                  the receptor is already dirty, and it under-shoots the peak
     climatology  is a seasonal mean and barely acknowledges the episode
     googleAQ     is a competent general-purpose forecaster with no upwind
                  source decomposition, so it sees the rise late and low

   PRAMANA's claimed advantage is lead time on the onset, and this shape is
   what makes that claim visible on a chart instead of asserted in prose.
*/
function generateForecast(shape: ForecastShape): ForecastPoint[] {
  const points: ForecastPoint[] = [];
  const base = new Date(shape.t0);
  const rand = mulberry32(shape.seed);
  const amplitude = shape.peakAQI - shape.baselineAQI;

  // Asymmetric envelope: pollutants build faster than they clear.
  const envelope = (h: number, centre: number) => {
    const width = h < centre ? 20 : 27;
    return Math.exp(-Math.pow((h - centre) / width, 2));
  };

  for (let h = -48; h <= 48; h++) {
    const t = new Date(base.getTime() + h * 3600000);

    const pramana =
      shape.baselineAQI +
      amplitude * envelope(h, shape.peakHour) +
      (rand() - 0.5) * 14;

    // Sees the rise about 7 h late and tops out ~22% below the true peak.
    const googleAQ =
      shape.baselineAQI +
      amplitude * 0.78 * envelope(h, shape.peakHour + 7) +
      (rand() - 0.5) * 22;

    // Reacts only once the receptor is already loaded.
    const persistence =
      shape.baselineAQI +
      amplitude * 0.44 * envelope(h, shape.peakHour + 15) +
      (rand() - 0.5) * 18;

    // Seasonal mean with a diurnal wobble.
    const climatology =
      shape.baselineAQI * 1.18 +
      26 * Math.sin((h / 24) * Math.PI * 2) +
      (rand() - 0.5) * 10;

    points.push({
      timestamp: t.toISOString(),
      hour: h,
      pramana: Math.max(50, Math.round(pramana)),
      persistence: Math.max(50, Math.round(persistence)),
      climatology: Math.max(50, Math.round(climatology)),
      googleAQ: Math.max(50, Math.round(googleAQ)),
    });
  }
  return points;
}

/* ── Episode 2: Chiang Mai → Bangkok ──────────────────── */
const chiangMaiFireHotspots: FireHotspot[] = [
  { id: "FH-TH-001", lat: 18.79, lng: 98.98, frp: 58.4, confidence: "high", satellite: "VIIRS", acqDate: "2024-03-15T04:00:00Z" },
  { id: "FH-TH-002", lat: 18.65, lng: 99.12, frp: 43.7, confidence: "high", satellite: "MODIS", acqDate: "2024-03-15T04:30:00Z" },
  { id: "FH-TH-003", lat: 19.05, lng: 98.85, frp: 67.2, confidence: "high", satellite: "VIIRS", acqDate: "2024-03-15T05:00:00Z" },
  { id: "FH-TH-004", lat: 18.42, lng: 99.33, frp: 31.8, confidence: "nominal", satellite: "MODIS", acqDate: "2024-03-15T05:30:00Z" },
  { id: "FH-TH-005", lat: 19.23, lng: 98.67, frp: 72.1, confidence: "high", satellite: "VIIRS", acqDate: "2024-03-15T06:00:00Z" },
  { id: "FH-TH-006", lat: 18.88, lng: 99.45, frp: 39.5, confidence: "nominal", satellite: "MODIS", acqDate: "2024-03-15T06:30:00Z" },
];

const chiangMaiWindVectors: WindVector[] = [
  { lat: 18.8, lng: 99.0, speed: 3.8, direction: 350, pressureLevel: 925 },
  { lat: 17.5, lng: 99.5, speed: 4.5, direction: 345, pressureLevel: 925 },
  { lat: 16.2, lng: 100.0, speed: 5.2, direction: 340, pressureLevel: 925 },
  { lat: 15.0, lng: 100.3, speed: 5.8, direction: 335, pressureLevel: 925 },
  { lat: 14.0, lng: 100.5, speed: 4.9, direction: 340, pressureLevel: 925 },
];

const bangkokStations: StationReading[] = [
  { stationId: "PCD-BK-01", stationName: "Din Daeng", lat: 13.7649, lng: 100.5440, pm25: 185, pm10: 267, no2: 45, so2: 12, o3: 28, aqi: 236, timestamp: "2024-03-17T08:00:00+07:00" },
  { stationId: "PCD-BK-02", stationName: "Bang Na", lat: 13.6673, lng: 100.6048, pm25: 168, pm10: 245, no2: 38, so2: 10, o3: 32, aqi: 218, timestamp: "2024-03-17T08:00:00+07:00" },
  { stationId: "PCD-BK-03", stationName: "Thon Buri", lat: 13.7225, lng: 100.4897, pm25: 192, pm10: 278, no2: 48, so2: 14, o3: 25, aqi: 242, timestamp: "2024-03-17T08:00:00+07:00" },
];

const chiangMaiAttribution: AttributionEntry[] = [
  { nation: "Thailand", state: "Chiang Mai", district: "Mae Chaem", tehsil: "Mae Chaem", contribution: 28.3, confidenceLow: 22.5, confidenceHigh: 34.1, sourceType: "agricultural_burning" },
  { nation: "Thailand", state: "Chiang Mai", district: "Chom Thong", tehsil: "Chom Thong", contribution: 19.6, confidenceLow: 14.8, confidenceHigh: 24.4, sourceType: "agricultural_burning" },
  { nation: "Thailand", state: "Lamphun", district: "Li", tehsil: "Li", contribution: 12.4, confidenceLow: 8.7, confidenceHigh: 16.1, sourceType: "agricultural_burning" },
  { nation: "Myanmar", state: "Shan", district: "Taunggyi", tehsil: "Taunggyi", contribution: 15.2, confidenceLow: 9.8, confidenceHigh: 20.6, sourceType: "agricultural_burning" },
  { nation: "Laos", state: "Luang Prabang", district: "Luang Prabang", tehsil: "Luang Prabang", contribution: 8.7, confidenceLow: 4.3, confidenceHigh: 13.1, sourceType: "agricultural_burning" },
  { nation: "Thailand", state: "Bangkok", district: "Bangkok", tehsil: "Local", contribution: 9.1, confidenceLow: 6.2, confidenceHigh: 12.0, sourceType: "vehicular" },
];

/* ── Assembled Episodes ──────────────────────────────── */
export const EPISODES: Episode[] = [
  {
    id: "EP-2024-NOV-03",
    name: "Severe Smog Episode — Delhi NCR",
    date: "2024-11-03",
    corridor: "punjab-delhi",
    receptorCity: "Delhi",
    receptorCoords: [28.6139, 77.2090],
    sourceRegion: "Punjab Agricultural Belt",
    peakAQI: 482,
    grapStage: "IV",
    leadTimeHours: 38,
    fireHotspots: punjabDelhiFireHotspots,
    windVectors: punjabDelhiWindVectors,
    stationReadings: delhiStations,
    attribution: punjabDelhiAttribution,
    // Issued at first FIRMS detection over south-east Punjab. Delhi peaks
    // 40 h later, consistent with published corridor transport times.
    forecast: generateForecast({
      t0: "2024-11-01T06:00:00Z",
      peakHour: 40,
      peakAQI: 482,
      baselineAQI: 138,
      seed: 0x5f2a,
    }),
    forecastT0: "2024-11-01T06:00:00Z",
    certificateId: "CERT-PRM-2024-1103-001",
  },
  {
    id: "EP-2024-MAR-17",
    name: "Haze Episode — Bangkok Metro",
    date: "2024-03-17",
    corridor: "chiangmai-bangkok",
    receptorCity: "Bangkok",
    receptorCoords: [13.7563, 100.5018],
    sourceRegion: "Northern Thailand Highlands",
    peakAQI: 242,
    grapStage: "II",
    leadTimeHours: 42,
    fireHotspots: chiangMaiFireHotspots,
    windVectors: chiangMaiWindVectors,
    stationReadings: bangkokStations,
    attribution: chiangMaiAttribution,
    forecast: generateForecast({
      t0: "2024-03-15T04:00:00Z",
      peakHour: 44,
      peakAQI: 242,
      baselineAQI: 96,
      seed: 0x9c14,
    }),
    forecastT0: "2024-03-15T04:00:00Z",
    certificateId: "CERT-PRM-2024-0317-001",
  },
];

export function getEpisodeById(id: string): Episode | undefined {
  return EPISODES.find((e) => e.id === id);
}

export function getEpisodeByCorridor(corridor: string): Episode | undefined {
  return EPISODES.find((e) => e.corridor === corridor);
}
