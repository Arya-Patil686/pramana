/*
   Google AI capability registry.

   Every Google service PRAMĀNA uses is declared here once, with the model it
   calls and the environment variable that turns it live. Two things depend on
   this file and nothing else:

     1. The adapters in this directory, which decide per call whether to reach
        the live API or serve a recorded fixture.
     2. /integration, the page that shows a judge exactly which Google service
        is doing which piece of work, and whether it is live right now.

   The fixture path is not a stub. Each recorded response was produced by the
   live model against the same prompt and is checked in verbatim, so a machine
   with no credentials still runs the full end-to-end flow and returns the
   shape the live path returns. `mode` on every response says which one served
   it, and the UI always surfaces that — a demo must never be able to imply a
   model ran when it did not.
*/

export type CapabilityId =
  | "gemini-vision"
  | "gemini-reasoning"
  | "translation"
  | "text-to-speech"
  | "speech-to-text"
  | "maps-geocoding"
  | "cpcb-stations";

export type ServeMode = "live" | "fixture";

export interface CapabilitySpec {
  id: CapabilityId;
  /** Google product name, as judges would recognise it. */
  product: string;
  /** The model or endpoint actually called. */
  model: string;
  /** The work this capability does in the pipeline. One sentence. */
  role: string;
  /** Environment variable whose presence switches this capability live. */
  envVar: string;
  /** Where in the product this runs. */
  surface: string;
}

/*
   Vertex AI, or the Gemini API.

   Both are on the hackathon's supported list and the SDK speaks to either, so
   the backend is a deployment choice rather than a code change. Setting
   GOOGLE_CLOUD_PROJECT routes every Gemini call through Vertex in that
   project; leaving it unset uses the Gemini API with a plain key. Nothing at
   any call site branches on which.
*/
export interface GeminiBackend {
  kind: "vertex" | "gemini-api";
  project?: string;
  location?: string;
  apiKey?: string;
}

export function geminiBackend(): GeminiBackend | null {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (project) {
    return {
      kind: "vertex",
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION?.trim() || "asia-south1",
    };
  }
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return apiKey ? { kind: "gemini-api", apiKey } : null;
}

/*
   Model ids, pinned and overridable.

   Pinned rather than tracking `gemini-flash-latest`, because the attribution
   certificate records which model produced a figure. An alias that silently
   moves underneath us would make a sealed certificate unreproducible, which
   is the one property the whole design exists to protect.

   gemini-2.5-flash was the default until Google retired it for new projects —
   the API answered with "no longer available to new users, use
   models/gemini-3.6-flash". The adapter degraded to its recorded fixture and
   printed that message rather than pretending, which is how it was caught.
*/
const GEMINI_VISION_MODEL =
  process.env.PRAMANA_GEMINI_VISION_MODEL ?? "gemini-3.6-flash";
const GEMINI_REASONING_MODEL =
  process.env.PRAMANA_GEMINI_REASONING_MODEL ?? "gemini-3.6-flash";

export const CAPABILITIES: CapabilitySpec[] = [
  {
    id: "gemini-vision",
    product: "Gemini API — multimodal vision",
    model: GEMINI_VISION_MODEL,
    role: "Reads a citizen's photograph of the sky and returns a structured, bounded estimate of visible haze, plume direction and probable source class.",
    envVar: "GEMINI_API_KEY",
    surface: "/report",
  },
  {
    id: "gemini-reasoning",
    product: "Gemini API — structured reasoning",
    model: GEMINI_REASONING_MODEL,
    role: "Turns a numeric attribution register into an advisory a district magistrate can act on, and drafts the authority alert.",
    envVar: "GEMINI_API_KEY",
    surface: "/console, /alerts",
  },
  {
    id: "translation",
    product: "Cloud Translation API",
    model: "translate/v2",
    role: "Renders every citizen-facing advisory into the languages actually spoken along the corridor.",
    envVar: "GOOGLE_TRANSLATE_API_KEY",
    surface: "/report, /advisory",
  },
  {
    id: "text-to-speech",
    product: "Cloud Text-to-Speech",
    model: "texttospeech/v1",
    role: "Speaks the advisory aloud, so the warning reaches people who do not read the language it was written in.",
    envVar: "GOOGLE_TTS_API_KEY",
    surface: "/advisory",
  },
  {
    id: "speech-to-text",
    product: "Cloud Speech-to-Text",
    model: "speech/v1",
    role: "Accepts a spoken citizen report, so filing one needs no literacy and no typing.",
    envVar: "GOOGLE_STT_API_KEY",
    surface: "/report",
  },
  {
    id: "cpcb-stations",
    product: "data.gov.in — CPCB CAAQMS",
    model: "resource/3b01bcb8",
    role: "Ground truth from the reference network an Indian regulator is statutorily required to act on, and the observations the forecast is scored against.",
    envVar: "DATA_GOV_IN_API_KEY",
    surface: "/console, /validation",
  },
  {
    id: "maps-geocoding",
    product: "Google Maps Platform — Geocoding",
    model: "geocode/json",
    role: "Resolves a citizen's coordinates to the tehsil the attribution register aggregates on.",
    envVar: "GOOGLE_MAPS_API_KEY",
    surface: "/report",
  },
];

export function specFor(id: CapabilityId): CapabilitySpec {
  const spec = CAPABILITIES.find((c) => c.id === id);
  if (!spec) throw new Error(`Unknown capability: ${id}`);
  return spec;
}

/** Server-side only: the key for a capability, or null when unset. */
export function keyFor(id: CapabilityId): string | null {
  const spec = specFor(id);
  const direct = process.env[spec.envVar];
  if (direct && direct.trim()) return direct.trim();

  /*
     A single Gemini key is the common case for a hackathon team, so let it
     stand in for the other *Google* keys rather than making them configure
     six variables to see six capabilities light up. data.gov.in is not
     Google and issues its own key, so it is excluded.
  */
  if (spec.envVar !== "GEMINI_API_KEY" && spec.envVar !== "DATA_GOV_IN_API_KEY") {
    const shared = process.env.GOOGLE_API_KEY;
    if (shared && shared.trim()) return shared.trim();
  }
  return null;
}

export function modeFor(id: CapabilityId): ServeMode {
  /* A Vertex deployment authenticates with the runtime service account and
     has no API key at all, so key presence is the wrong test there. */
  if (id.startsWith("gemini") && geminiBackend()?.kind === "vertex") return "live";
  return keyFor(id) ? "live" : "fixture";
}

export interface CapabilityStatus extends CapabilitySpec {
  mode: ServeMode;
  /** For the Gemini capabilities: which backend would serve them. */
  backend?: "vertex" | "gemini-api";
}

/** Safe to send to the browser: says whether a key exists, never what it is. */
export function capabilityStatuses(): CapabilityStatus[] {
  const backend = geminiBackend();
  return CAPABILITIES.map((c) => ({
    ...c,
    mode: modeFor(c.id),
    backend: c.id.startsWith("gemini") ? backend?.kind : undefined,
  }));
}
