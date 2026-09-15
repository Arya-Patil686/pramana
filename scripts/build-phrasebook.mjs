/*
   Generates the public-health phrasebook for every corridor language and
   writes it into src/lib/google/phrasebook-generated.ts.

   Why this is a build step and not a request-time call
   ────────────────────────────────────────────────────
   The Gemini free tier allows twenty generate requests per day per model.
   Translating a fixed set of eleven health strings on every language switch
   spends that in a handful of clicks and then serves English for the rest of
   the day — which is exactly what happened the first time the advisory page
   was tested with real credentials.

   Nothing about these strings is dynamic. They are the same eleven sentences
   for the same twelve languages every time, so they are generated once, read
   at build time, and committed. Runtime translation calls drop to zero, the
   demo becomes deterministic, and the daily quota is left for the one thing
   that genuinely needs it: reading a photograph nobody has seen before.

     node scripts/build-phrasebook.mjs

   Re-run only when the English source in languages.ts changes. The output is
   marked machine-generated per language; the four corridor languages keep
   their human-reviewed copy and are never overwritten.
*/

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "src", "lib", "google", "phrasebook-generated.ts");

const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Load .env.local into the environment first.");
  process.exit(1);
}

/* Languages that already carry human-reviewed copy. Never regenerated. */
const REVIEWED = new Set(["en", "hi", "pa", "ur"]);

const TARGETS = [
  ["bn", "Bengali"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["or", "Odia"],
];

/* The English source, kept identical to PHRASEBOOK.en in languages.ts. */
const SOURCE = {
  emergency: {
    headline: "Air quality is at a severe level in your area tonight.",
    instructions: [
      "Stay indoors. Keep windows and doors shut until tomorrow morning.",
      "Do not exercise, walk or work outdoors.",
      "Children, older people, pregnant women and anyone with asthma or heart disease must not go outside.",
      "If you must go out, wear an N95 mask. A cloth mask does not stop this.",
      "Go to a hospital if you have chest tightness, or breathlessness that does not settle with rest.",
    ],
  },
  warning: {
    headline: "Air quality is poor in your area and is expected to worsen.",
    instructions: [
      "Limit time outdoors, especially between 10pm and 8am.",
      "Move exercise indoors.",
      "Children and people with asthma or heart disease should stay in.",
      "Wear an N95 mask if you are outdoors for long.",
    ],
  },
  advisory: {
    headline: "Air quality is moderate in your area.",
    instructions: [
      "Anyone unusually sensitive should reduce prolonged outdoor exertion.",
      "Everyone else can continue normal activity.",
    ],
  },
};

const SYSTEM = `You translate public health instructions for Indian government air quality communication.

Rules:
1. Translate meaning, not words. It must read as though written by a public health officer who speaks the language natively.
2. Keep the register: direct, calm, imperative. These are instructions people act on.
3. Do not soften, hedge, expand, or add caveats. Do not drop any instruction.
4. Leave these exactly as written: N95, AQI, PM2.5, GRAP, all numerals and times.
5. Use the script the language is normally written in.
6. Return exactly the same number of strings, in the same order.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: { texts: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ["texts"],
};

/* Models are tried in order: the daily quota is per model, so a run that
   exhausts one can finish on the next rather than leaving a half-built file. */
const MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"];

/* A per-request timeout. Without one, a call the API never answers waits on
   undici's five-minute header timeout — which stalled one run and killed
   another. Sixty seconds is ample for eleven short strings; a call that has
   not answered by then is treated as transient and retried or skipped. */
const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 60_000 } });

async function translate(texts, code, name) {
  let lastError;
  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `Translate into ${name} (${code}).\n\n${JSON.stringify(texts, null, 2)}` }],
          },
        ],
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.1,
        },
      });
      const raw = (res.text ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.texts) || parsed.texts.length !== texts.length) {
        throw new Error(`returned ${parsed.texts?.length} strings for ${texts.length} inputs`);
      }
      return { texts: parsed.texts, model };
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
      /* Network failures are transient too. A HeadersTimeoutError killed the
         first full run on its sixth language, and because it was not
         recognised it was rethrown and took the whole run down with it. */
      const busy = /503|UNAVAILABLE|high demand|overloaded|fetch failed|timeout|ECONNRESET|ETIMEDOUT|socket hang up/i.test(
        msg + " " + String(e?.cause?.code ?? e?.cause?.name ?? "")
      );
      /* Quota is permanent for the day, so move to the next model. A 503 is
         temporary, so wait and try the same model again before moving on —
         skipping straight past it would burn the fallback list on a blip. */
      if (!quota && !busy) throw e;
      if (busy) {
        console.warn(`    ${model} busy, waiting 8s`);
        await new Promise((r) => setTimeout(r, 8000));
        try {
          const res = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: `Translate into ${name} (${code}).\n\n${JSON.stringify(texts, null, 2)}` }] }],
            config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.1 },
          });
          const raw = (res.text ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.texts) && parsed.texts.length === texts.length) {
            return { texts: parsed.texts, model };
          }
        } catch {
          /* Fall through to the next model. */
        }
      }
      console.warn(`    ${model} unavailable, trying next`);
    }
  }
  throw lastError;
}

/*
   Resumable. The first full run died on its sixth language and, because the
   file was only written at the end, threw away five languages of finished
   work and the quota that paid for it. Now the existing file is read first,
   complete languages are skipped, and the file is rewritten after each
   language finishes.
*/
function readExisting() {
  try {
    const src = readFileSync(OUT, "utf8");
    const at = src.indexOf("> = ");
    if (at === -1) return {};
    return JSON.parse(src.slice(at + 4).trim().replace(/;$/, ""));
  } catch {
    return {};
  }
}

const BANDS = Object.keys(SOURCE);
const out = readExisting();

for (const [code, name] of TARGETS) {
  if (REVIEWED.has(code)) continue;
  const have = out[code] ?? {};
  if (BANDS.every((b) => have[b])) {
    console.log(`  ${name} (${code}) — already generated, skipping`);
    continue;
  }
  console.log(`  ${name} (${code})`);
  out[code] = have;
  for (const [band, msg] of Object.entries(SOURCE)) {
    if (have[band]) continue;
    const source = [msg.headline, ...msg.instructions];
    const { texts, model } = await translate(source, code, name);
    out[code][band] = { headline: texts[0], instructions: texts.slice(1), model };
    console.log(`    ${band}: ${texts[0].slice(0, 46)}`);
  }
  writeFileSync(OUT, render(out));
}

function render(data) {
  return `/*
   GENERATED FILE — do not edit by hand.
   Produced by scripts/build-phrasebook.mjs on ${new Date().toISOString().slice(0, 10)}.

   Machine translations of the reviewed English public-health phrasebook, one
   entry per language and severity band. These are committed rather than
   produced at request time: the Gemini free tier allows twenty generate
   requests per day per model, and translating eleven fixed strings on every
   language switch exhausted that in a handful of clicks.

   These are NOT reviewed copy. The four corridor languages — English, Hindi,
   Punjabi and Urdu — carry human-reviewed text in languages.ts and are not
   generated here. Everything below is labelled machine-translated wherever it
   is shown, and a state adopting this would have its own health department
   sign off these languages before any of it went out.
*/

import type { PublicMessage, SeverityBand } from "./languages";

export interface GeneratedEntry extends PublicMessage {
  /** The model that produced this translation. */
  model: string;
}

export const GENERATED_PHRASEBOOK: Record<
  string,
  Partial<Record<SeverityBand, GeneratedEntry>>
> = ${JSON.stringify(data, null, 2)};
`;
}

writeFileSync(OUT, render(out));
console.log(`\nwrote ${OUT}`);
console.log(`languages: ${Object.keys(out).length}`);
