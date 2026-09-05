import { NextResponse } from "next/server";
import { fetchWindField } from "@/lib/sources/meteo";
import { fetchFireDetections } from "@/lib/sources/firms";
import { fetchAirQuality } from "@/lib/sources/airquality";

/*
   GET /api/sources — every upstream, fetched in parallel, each reporting
   whether it answered live.

   The console renders this verbatim, including the failures. An operations
   surface that hides a dead upstream is worse than no surface at all: the
   operator keeps trusting a number that stopped updating an hour ago.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Delhi receptor, Anand Vihar reference monitor. */
const RECEPTOR = { lat: 28.6469, lng: 77.3162 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const corridor = searchParams.get("corridor") ?? "punjab-delhi";
  const language = searchParams.get("language") ?? "en";

  const [wind, fires, air] = await Promise.all([
    fetchWindField(corridor),
    fetchFireDetections(),
    fetchAirQuality(RECEPTOR.lat, RECEPTOR.lng, language),
  ]);

  return NextResponse.json({
    corridor,
    fetchedAt: new Date().toISOString(),
    wind,
    fires,
    air,
    summary: {
      liveUpstreams: [wind.live, fires.live, air.live].filter(Boolean).length,
      totalUpstreams: 3,
    },
  });
}
