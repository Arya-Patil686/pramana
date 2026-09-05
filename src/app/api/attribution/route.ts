import { NextResponse } from "next/server";
import { fetchFireDetections, PUNJAB_HARYANA_BBOX } from "@/lib/sources/firms";
import { fetchWindField, episodeWindField } from "@/lib/sources/meteo";
import { fetchAirQuality } from "@/lib/sources/airquality";
import { placeByCentroid } from "@/lib/sources/geocode";
import { computeAttribution, type Receptor } from "@/lib/attribution/engine";
import { listReports } from "@/lib/reports-store";

/*
   GET /api/attribution — the register, computed rather than recalled.

   Fires and wind are fetched, every detection is advected forward on the real
   field, and each 0.1° cell's contribution falls out of what actually reaches
   the receptor. Nothing on this route reads a stored answer. Change the wind
   and the register changes.

   Weighted citizen reports come back alongside the numbers rather than folded
   into them. A photograph corroborates or contradicts a modelled finding; it
   is not an emission measurement, and quietly mixing the two would make the
   register harder to defend, not easier.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECEPTORS: Record<string, Receptor & { state: string }> = {
  delhi: { name: "Delhi", lat: 28.6469, lng: 77.3162, state: "Delhi" },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receptorKey = (searchParams.get("receptor") ?? "delhi").toLowerCase();
  const receptor = RECEPTORS[receptorKey] ?? RECEPTORS.delhi;
  const days = Math.min(4, Math.max(1, Number(searchParams.get("days") ?? 2)));

  /*
     Two modes, and the difference matters.

     `live` runs the model on the field blowing right now. Outside the burning
     season that correctly returns nothing: in September the 925 hPa flow over
     Punjab does not go to Delhi, so no Punjab smoke reaches Delhi, and a
     system that manufactured a number anyway would be lying.

     `episode` runs the identical model over the recorded 3 November field.
     Same code path, same arithmetic — only the input changes. That is what
     makes the null result above readable as a finding rather than a fault.
  */
  const mode = searchParams.get("mode") === "live" ? "live" : "episode";

  const [fires, liveWind, air] = await Promise.all([
    fetchFireDetections(PUNJAB_HARYANA_BBOX, days),
    fetchWindField("punjab-delhi"),
    fetchAirQuality(receptor.lat, receptor.lng),
  ]);
  const wind = mode === "live" ? liveWind : episodeWindField();

  const result = computeAttribution(
    fires.detections,
    wind,
    receptor,
    placeByCentroid,
    receptor.state
  );
  result.method.firesLive = fires.live;

  /* Reports from the tehsils the model just named, so an operator can see
     whether people on the ground describe what the model claims. */
  const named = new Set(
    result.cells.slice(0, 12).map((c) => c.tehsil).filter(Boolean)
  );
  const corroboration = listReports(200)
    .filter((r) => r.tehsil && named.has(r.tehsil) && r.observation.usable)
    .map((r) => ({
      id: r.id,
      tehsil: r.tehsil,
      receivedAt: r.receivedAt,
      hazeDensity: r.observation.hazeDensity,
      sourceClass: r.observation.probableSourceClass,
      weight: r.weight,
    }));

  return NextResponse.json({
    mode,
    computedAt: new Date().toISOString(),
    attribution: result,
    receptorReading: {
      cpcbAqi: air.cpcbAqi,
      category: air.category,
      dominantPollutant: air.dominantPollutant,
      live: air.live,
      source: air.source,
    },
    upstreams: {
      fires: { live: fires.live, source: fires.source, count: fires.detections.length },
      wind: {
        live: wind.live,
        source: wind.source,
        samples: wind.samples.length,
        /* Reported even in episode mode, so an operator can see what the
           current field is doing while looking at a replay. */
        currentFieldLive: liveWind.live,
      },
      air: { live: air.live, source: air.source },
    },
    corroboration,
  });
}
