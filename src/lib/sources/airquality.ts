import "server-only";
import { keyFor } from "@/lib/google/config";

/*
   Ground truth and baseline, from the Google Air Quality API.

   This upstream does two jobs at once, which is why it is worth a dedicated
   adapter. It supplies the receptor reading the console displays, and it is
   also the third baseline the validation page scores PRAMĀNA against. A
   forecast that cannot beat the incumbent is not worth deploying, and the
   honest way to show that is to call the incumbent live and publish the
   comparison, including the windows where we lose.

   `extraComputations` asks for LOCAL_AQI specifically so India's CPCB index
   comes back alongside the universal one. A Delhi operator works in CPCB
   numbers; showing them a US-EPA AQI is showing them the wrong scale.
*/

const ENDPOINT = "https://airquality.googleapis.com/v1/currentConditions:lookup";
const TIMEOUT_MS = 12_000;

export interface AirQualityReading {
  lat: number;
  lng: number;
  /** CPCB index where available, which is what Indian operators work in. */
  cpcbAqi: number | null;
  universalAqi: number | null;
  category: string | null;
  dominantPollutant: string | null;
  pollutants: { code: string; name: string; value: number; units: string }[];
  healthRecommendation: string | null;
  observedAt: string;
  live: boolean;
  source: string;
  note?: string;
}

interface AqIndex {
  code: string;
  aqi?: number;
  category?: string;
  dominantPollutant?: string;
}

export async function fetchAirQuality(
  lat: number,
  lng: number,
  languageCode = "en"
): Promise<AirQualityReading> {
  const apiKey = keyFor("maps-geocoding");
  const observedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      ...RECORDED_DELHI,
      lat,
      lng,
      observedAt,
      live: false,
      source: "Recorded CPCB reference reading · 2024-11-03 18:00 IST",
      note: "No Google Maps Platform key configured; serving the recorded episode reading.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        location: { latitude: lat, longitude: lng },
        extraComputations: [
          "LOCAL_AQI",
          "POLLUTANT_CONCENTRATION",
          "DOMINANT_POLLUTANT_CONCENTRATION",
          "HEALTH_RECOMMENDATIONS",
        ],
        languageCode,
      }),
    });
    if (!res.ok) throw new Error(`Air Quality API ${res.status}`);

    const json = await res.json();
    const indexes: AqIndex[] = json.indexes ?? [];
    const cpcb = indexes.find((i) => i.code === "ind_cpcb");
    const universal = indexes.find((i) => i.code === "uaqi");
    const primary = cpcb ?? universal;

    return {
      lat,
      lng,
      cpcbAqi: cpcb?.aqi ?? null,
      universalAqi: universal?.aqi ?? null,
      category: primary?.category ?? null,
      dominantPollutant: primary?.dominantPollutant ?? null,
      pollutants: (json.pollutants ?? []).map(
        (p: { code: string; displayName?: string; concentration?: { value: number; units: string } }) => ({
          code: p.code,
          name: p.displayName ?? p.code,
          value: p.concentration?.value ?? 0,
          units: p.concentration?.units ?? "",
        })
      ),
      healthRecommendation: json.healthRecommendations?.generalPopulation ?? null,
      observedAt: json.dateTime ?? observedAt,
      live: true,
      source: "Google Air Quality API · currentConditions, CPCB local index",
    };
  } catch (error) {
    return {
      ...RECORDED_DELHI,
      lat,
      lng,
      observedAt,
      live: false,
      source: "Recorded CPCB reference reading · 2024-11-03 18:00 IST",
      note:
        error instanceof Error
          ? `Air Quality API unreachable (${error.message}); serving the recorded reading.`
          : "Air Quality API unreachable; serving the recorded reading.",
    };
  } finally {
    clearTimeout(timer);
  }
}

const RECORDED_DELHI: Omit<AirQualityReading, "lat" | "lng" | "observedAt" | "live" | "source"> = {
  cpcbAqi: 447,
  universalAqi: 21,
  category: "Severe air quality",
  dominantPollutant: "pm25",
  pollutants: [
    { code: "pm25", name: "PM2.5", value: 312.4, units: "µg/m³" },
    { code: "pm10", name: "PM10", value: 486.1, units: "µg/m³" },
    { code: "no2", name: "NO₂", value: 78.3, units: "µg/m³" },
    { code: "so2", name: "SO₂", value: 19.7, units: "µg/m³" },
    { code: "co", name: "CO", value: 3210, units: "µg/m³" },
    { code: "o3", name: "O₃", value: 14.2, units: "µg/m³" },
  ],
  healthRecommendation:
    "Everyone should avoid outdoor exertion. Keep windows closed and use an N95 mask if going outside is unavoidable.",
};
