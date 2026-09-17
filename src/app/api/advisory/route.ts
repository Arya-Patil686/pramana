import { NextResponse } from "next/server";
import { draftAdvisory, translateWithGemini } from "@/lib/google/gemini";
import { translateTexts, synthesizeSpeech } from "@/lib/google/speech";
import { languageFor, publicMessage, type SeverityBand } from "@/lib/google/languages";
import { runEpisode } from "@/lib/pipeline/episode";
import { memo, contentKey } from "@/lib/google/cache";

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
  /** "episode" replays the recorded 3 November field; "live" uses today's. */
  mode?: string;
  language?: string;
  speak?: boolean;
}

export async function POST(request: Request) {
  let body: AdvisoryBody = {};
  try {
    body = (await request.json()) as AdvisoryBody;
  } catch {
    /* An empty body is valid: default to the episode replay. */
  }

  const language = typeof body.language === "string" ? body.language : "en";
  const lang = languageFor(language);

  /* Every figure below comes from one pipeline run — the same run that seals
     the certificate — rather than from a hand-written episode record. */
  const run = await runEpisode(body.mode === "live" ? "live" : "episode");
  const input = run.advisoryInput;

  /*
     Cached per episode, not per request. The draft does not depend on the
     language, so re-drafting it on every language switch spent quota on an
     identical answer — which is how the free tier was exhausted in six
     clicks. A fallback is never cached: one rate-limited minute must not
     freeze recorded output into the page for the next ten.
  */
  const draftKey = contentKey("advisory", run.certificate.id, input.upwindSharePct, input.peakAQI);
  const { value: drafted, hit: draftHit } = await memo(
    draftKey,
    () => draftAdvisory(input),
    (d) => d.mode === "live"
  );
  const advisory = drafted.data;

  const severity = advisory.severity as SeverityBand;
  const { message, source: publicVia, model: publicModel } = publicMessage(severity, language);

  /*
     Narrative translation only.

     The public-health text is never translated at request time — it comes
     from the reviewed phrasebook or its committed machine translation, and
     nothing else. That is a quota decision as much as a safety one: the
     Gemini free tier allows twenty generate requests per day per model, and
     re-translating eleven fixed strings on every language switch starves the
     one call that genuinely cannot be precomputed, which is reading a
     citizen's photograph.

     The operator narrative does change per episode, so it is translated —
     by Cloud Translation where a key exists, and otherwise left in English
     and labelled. Runtime Gemini translation is available behind
     PRAMANA_RUNTIME_TRANSLATION for a deployment with real quota, and is off
     by default precisely so a demo cannot spend its photo budget on text.
  */
  const cloud = await translateTexts([advisory.headline, advisory.body], language);
  let headlineLocalised = cloud.data.texts[0] ?? advisory.headline;
  let bodyLocalised = cloud.data.texts[1] ?? advisory.body;
  let narrativeVia: "cloud-translation" | "gemini" | "none" =
    language !== "en" && cloud.data.translated ? "cloud-translation" : "none";
  let translationError: string | null = null;

  const publicMsg = message;

  if (
    language !== "en" &&
    !cloud.data.translated &&
    process.env.PRAMANA_RUNTIME_TRANSLATION === "1"
  ) {
    const spec = languageFor(language);
    const { value: g } = await memo(
      contentKey("tr", language, advisory.headline, advisory.body),
      () => translateWithGemini([advisory.headline, advisory.body], language, spec.english),
      (r) => r.mode === "live"
    );
    if (g.mode === "live") {
      headlineLocalised = g.data[0] ?? headlineLocalised;
      bodyLocalised = g.data[1] ?? bodyLocalised;
      narrativeVia = "gemini";
    } else {
      translationError = g.fellBackBecause ?? "translation unavailable";
    }
  }

  /* What is spoken is the public message in whatever form it reached — the
     reviewed copy where it exists, otherwise its machine translation. */
  const spokenText = [publicMsg.headline, ...publicMsg.instructions].join(" ");
  const spoken = body.speak
    ? await synthesizeSpeech(spokenText, lang.ttsLocale)
    : null;

  return NextResponse.json({
    episodeId: run.certificate.episodeId,
    certificateId: run.certificate.id,
    receptor: run.receptor,
    language,
    advisory: {
      ...advisory,
      headlineLocalised,
      bodyLocalised,
    },
    publicMessage: {
      ...publicMsg,
      /*
         How this text reached the reader:
           reviewed          — from the checked phrasebook
           gemini            — machine translation of the reviewed English
           english-fallback  — neither was possible; English was served
         The UI prints this. Machine translation is never presented as review.
      */
      via: publicVia,
      model: publicModel ?? null,
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
        mode: cloud.mode,
        model: cloud.model,
        translated: cloud.data.translated,
        narrativeVia,
        publicVia,
        error: translationError,
        draftCached: draftHit,
        fellBackBecause: cloud.fellBackBecause ?? null,
      },
      speech: spoken
        ? { mode: spoken.mode, model: spoken.model, fellBackBecause: spoken.fellBackBecause ?? null }
        : null,
    },
  });
}
