import { NextResponse } from "next/server";
import { draftAuthorityAlert, type AdvisoryInput } from "@/lib/google/gemini";
import { EPISODES } from "@/data/mock-episodes";

/*
   POST /api/alert — draft the notice that crosses a state border.

   This route drafts and returns. It does not send, and it must not: a notice
   naming a state pollution control board is a document with consequences, and
   the decision to transmit belongs to the operator who signs it, not to the
   model that wrote it or the button that called this route. The UI reflects
   that — the alert surface shows a draft and an explicit dispatch step that a
   human performs.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let episodeId: string | undefined;
  try {
    ({ episodeId } = (await request.json()) as { episodeId?: string });
  } catch {
    /* Default to the headline episode. */
  }

  const episode = EPISODES.find((e) => e.id === episodeId) ?? EPISODES[0];
  const upwind = episode.attribution.filter((a) => a.state !== "Delhi");
  const upwindSharePct = upwind.reduce((sum, a) => sum + a.contribution, 0);

  const input: AdvisoryInput = {
    receptorCity: "Delhi",
    peakAQI: episode.peakAQI,
    peakWindow: "02:00–06:00 IST",
    grapStage: episode.grapStage,
    upwindSharePct,
    confidenceInterval: [
      upwind.reduce((sum, a) => sum + a.confidenceLow, 0),
      Math.min(100, upwind.reduce((sum, a) => sum + a.confidenceHigh, 0)),
    ],
    topSources: [...upwind]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map((a) => ({ name: a.tehsil, state: a.state, contributionPct: a.contribution })),
    leadTimeHours: episode.leadTimeHours,
    transportHours: 40,
    certificateId: episode.certificateId,
  };

  const drafted = await draftAuthorityAlert(input);

  return NextResponse.json({
    episodeId: episode.id,
    alert: drafted.data,
    /* Stated in the payload so no client can present this as sent. */
    dispatched: false,
    dispatchNote:
      "Drafted only. Transmission requires an operator with signing authority for the issuing board.",
    provenance: {
      mode: drafted.mode,
      model: drafted.model,
      latencyMs: drafted.latencyMs,
      fellBackBecause: drafted.fellBackBecause ?? null,
    },
  });
}
