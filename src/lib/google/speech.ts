import "server-only";
import { keyFor, specFor } from "./config";
import type { Served } from "./types";

/*
   Cloud Translation, Text-to-Speech and Speech-to-Text.

   All three are called over their REST endpoints with an API key rather than
   through a service-account client. That is a deliberate constraint for this
   deployment: it runs on Cloud Run with a key in Secret Manager, and it also
   runs on a laptop with a key in .env.local, with no difference in code path.

   The offline behaviour of each is different and each is honest about it:

     Translation   — returns the source text unchanged, marked untranslated.
                     It never pretends to have translated something.
     Text-to-Speech— returns no audio, and the client falls back to the
                     browser's own speech synthesiser, which is a real voice
                     on a real device rather than a simulation of one.
     Speech-to-Text— returns nothing, and the client falls back to the Web
                     Speech API, which every mobile Chrome already ships.
*/

const TRANSLATE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const STT_ENDPOINT = "https://speech.googleapis.com/v1/speech:recognize";

/* Requests are bounded so a hung Google endpoint cannot hold an operator
   console open indefinitely during an episode. */
const TIMEOUT_MS = 12_000;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Translation ──────────────────────────────────────────────────── */

export interface Translated {
  texts: string[];
  targetLanguage: string;
  /** False when the strings came back untouched because no key was present. */
  translated: boolean;
}

export async function translateTexts(
  texts: string[],
  targetLanguage: string
): Promise<Served<Translated>> {
  const spec = specFor("translation");
  const apiKey = keyFor("translation");
  const started = Date.now();
  const untouched: Translated = { texts, targetLanguage, translated: false };

  if (targetLanguage === "en") {
    return { data: { texts, targetLanguage, translated: true }, mode: "live", model: "identity", latencyMs: 0 };
  }
  if (!apiKey) {
    return { data: untouched, mode: "fixture", model: spec.model, latencyMs: Date.now() - started };
  }

  try {
    const json = await postJson<{
      data: { translations: { translatedText: string }[] };
    }>(`${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      q: texts,
      target: targetLanguage,
      format: "text",
    });

    return {
      data: {
        texts: json.data.translations.map((t) => t.translatedText),
        targetLanguage,
        translated: true,
      },
      mode: "live",
      model: spec.model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      data: untouched,
      mode: "fixture",
      model: spec.model,
      latencyMs: Date.now() - started,
      fellBackBecause: error instanceof Error ? error.message : "Translation failed",
    };
  }
}

/* ── Text-to-Speech ───────────────────────────────────────────────── */

export interface Spoken {
  /** Base64 MP3, or null when the client must use its own synthesiser. */
  audioBase64: string | null;
  languageCode: string;
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string
): Promise<Served<Spoken>> {
  const spec = specFor("text-to-speech");
  const apiKey = keyFor("text-to-speech");
  const started = Date.now();
  const silent: Spoken = { audioBase64: null, languageCode };

  if (!apiKey) {
    return { data: silent, mode: "fixture", model: spec.model, latencyMs: Date.now() - started };
  }

  try {
    const json = await postJson<{ audioContent: string }>(
      `${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
      {
        input: { text },
        voice: { languageCode, ssmlGender: "FEMALE" },
        audioConfig: {
          audioEncoding: "MP3",
          /* Slightly slowed. This is read aloud in an emergency, often over a
             phone speaker in a noisy room. */
          speakingRate: 0.92,
        },
      }
    );
    return {
      data: { audioBase64: json.audioContent, languageCode },
      mode: "live",
      model: spec.model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      data: silent,
      mode: "fixture",
      model: spec.model,
      latencyMs: Date.now() - started,
      fellBackBecause: error instanceof Error ? error.message : "Synthesis failed",
    };
  }
}

/* ── Speech-to-Text ───────────────────────────────────────────────── */

export interface Transcribed {
  transcript: string | null;
  languageCode: string;
  confidence: number | null;
}

export async function transcribeAudio(
  audioBase64: string,
  languageCode: string,
  encoding: "WEBM_OPUS" | "LINEAR16" = "WEBM_OPUS",
  sampleRateHertz = 48_000
): Promise<Served<Transcribed>> {
  const spec = specFor("speech-to-text");
  const apiKey = keyFor("speech-to-text");
  const started = Date.now();
  const empty: Transcribed = { transcript: null, languageCode, confidence: null };

  if (!apiKey) {
    return { data: empty, mode: "fixture", model: spec.model, latencyMs: Date.now() - started };
  }

  try {
    const json = await postJson<{
      results?: { alternatives: { transcript: string; confidence?: number }[] }[];
    }>(`${STT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      config: {
        encoding,
        sampleRateHertz,
        languageCode,
        enableAutomaticPunctuation: true,
        model: "latest_short",
      },
      audio: { content: audioBase64 },
    });

    const best = json.results?.[0]?.alternatives?.[0];
    return {
      data: {
        transcript: best?.transcript ?? null,
        languageCode,
        confidence: best?.confidence ?? null,
      },
      mode: "live",
      model: spec.model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      data: empty,
      mode: "fixture",
      model: spec.model,
      latencyMs: Date.now() - started,
      fellBackBecause: error instanceof Error ? error.message : "Transcription failed",
    };
  }
}
