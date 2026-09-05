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
  | "maps-geocoding";

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

/* Model ids are overridable so a team with different quota can retarget
   without touching call sites. */
const GEMINI_VISION_MODEL =
  process.env.PRAMANA_GEMINI_VISION_MODEL ?? "gemini-2.5-flash";
const GEMINI_REASONING_MODEL =
  process.env.PRAMANA_GEMINI_REASONING_MODEL ?? "gemini-2.5-flash";

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

  /* A single Gemini key is the common case for a hackathon team, so let it
     stand in for the other Google keys rather than making them configure six
     variables to see six capabilities light up. */
  if (spec.envVar !== "GEMINI_API_KEY") {
    const shared = process.env.GOOGLE_API_KEY;
    if (shared && shared.trim()) return shared.trim();
  }
  return null;
}

export function modeFor(id: CapabilityId): ServeMode {
  return keyFor(id) ? "live" : "fixture";
}

export interface CapabilityStatus extends CapabilitySpec {
  mode: ServeMode;
}

/** Safe to send to the browser: says whether a key exists, never what it is. */
export function capabilityStatuses(): CapabilityStatus[] {
  return CAPABILITIES.map((c) => ({ ...c, mode: modeFor(c.id) }));
}
