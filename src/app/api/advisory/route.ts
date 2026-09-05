import { NextResponse } from "next/server";
import { draftAdvisory, type AdvisoryInput } from "@/lib/google/gemini";
import { translateTexts, synthesizeSpeech } from "@/lib/google/speech";
import { languageFor, publicMessage, type SeverityBand } from "@/lib/google/languages";
import { EPISODES } from "@/data/mock-episodes";

/*
   POST /api/advisory — the attribution register becomes something a person acts on.

   Two audiences are served in one pass, and they are treated differently on
   purpose.

   The operator advisory is generated: it is situational, it changes every
   episode, and it is read by a professional who can weigh it.

   The public message is not generated. It is drawn from the reviewed
   phrasebook and only the situational sentence around it is translated,
   because a model improvising protective health instruction in a language no
   reviewer on this team reads is not a risk worth taking to save a fixture.
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdvisoryBody {
  episodeId?: string;
  language?: string;
  speak?: boolean;
}

export async function POST(request: Request) {
  let body: AdvisoryBody = {};
  try {
    body = (await request.json()) as AdvisoryBody;
  } catch {
    /* An empty body is valid: default to the headline episode. */
  }

  const episode =
    EPISODES.find((e) => e.id === body.episodeId) ?? EPISODES[0];
  const language = typeof body.language === "string" ? body.language : "en";
  const lang = languageFor(language);

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
      .map((a) => ({
        name: a.tehsil,
        state: a.state,
        contributionPct: a.contribution,
      })),
    leadTimeHours: episode.leadTimeHours,
    transportHours: 40,
    certificateId: episode.certificateId,
  };

  const drafted = await draftAdvisory(input);
  const advisory = drafted.data;

  /* The generated narrative is translated; the health instruction is not. */
  const translated = await translateTexts(
    [advisory.headline, advisory.body],
    language
  );

  const severity = advisory.severity as SeverityBand;
  const { message, reviewed } = publicMessage(severity, language);

  /* What actually gets spoken: the reviewed instruction, never the model's. */
  const spokenText = [message.headline, ...message.instructions].join(" ");
  const spoken = body.speak
    ? await synthesizeSpeech(spokenText, lang.ttsLocale)
    : null;

  return NextResponse.json({
    episodeId: episode.id,
    language,
    advisory: {
      ...advisory,
      headlineLocalised: translated.data.texts[0] ?? advisory.headline,
      bodyLocalised: translated.data.texts[1] ?? advisory.body,
    },
    publicMessage: {
      ...message,
      reviewed,
      /* False means the phrasebook has no reviewed copy in this language and
         English was served. The UI must say so rather than imply coverage. */
    },
    speech: spoken
      ? {
          audioBase64: spoken.data.audioBase64,
          languageCode: spoken.data.languageCode,
          /* Null audio is the signal to use the browser's own synthesiser. */
          useBrowserFallback: spoken.data.audioBase64 === null,
          mode: spoken.mode,
        }
      : null,
    spokenText,
    provenance: {
      advisory: {
        mode: drafted.mode,
        model: drafted.model,
        latencyMs: drafted.latencyMs,
        fellBackBecause: drafted.fellBackBecause ?? null,
      },
      translation: {
        mode: translated.mode,
        model: translated.model,
        translated: translated.data.translated,
        fellBackBecause: translated.fellBackBecause ?? null,
      },
      speech: spoken
        ? { mode: spoken.mode, model: spoken.model, fellBackBecause: spoken.fellBackBecause ?? null }
        : null,
    },
  });
}
