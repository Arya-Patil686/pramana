import { NextResponse } from "next/server";
import { draftAuthorityAlert } from "@/lib/google/gemini";
import { runEpisode } from "@/lib/pipeline/episode";

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
  let mode: string | undefined;
  try {
    ({ mode } = (await request.json()) as { mode?: string });
  } catch {
    /* Default to the episode replay. */
  }

  /* Same pipeline run as the advisory and the certificate, so the notice
     names the figures the certificate actually seals. */
  const run = await runEpisode(mode === "live" ? "live" : "episode");
  const input = run.advisoryInput;

  const drafted = await draftAuthorityAlert(input);

  return NextResponse.json({
    episodeId: run.certificate.episodeId,
    certificateId: run.certificate.id,
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
