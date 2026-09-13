import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { geminiBackend, specFor, type CapabilityId } from "./config";
import type {
  Advisory,
  AuthorityAlert,
  Served,
  SkyObservation,
} from "./types";
import {
  ADVISORY_FIXTURE,
  AUTHORITY_ALERT_FIXTURE,
  SKY_OBSERVATION_FIXTURES,
} from "./fixtures/gemini";

/*
   Gemini adapter.

   Three calls, each with a declared response schema so the model returns
   parseable JSON rather than prose we would have to scrape. Every call goes
   through `serve`, which owns the one policy that matters here: a live call
   that fails must degrade to the recorded fixture and say so, rather than
   taking down an operator console during an episode. `fellBackBecause` is
   carried to the UI, so a silent downgrade is not possible.
*/

/*
   One client, either backend. On Cloud Run with GOOGLE_CLOUD_PROJECT set this
   is Vertex AI authenticating as the runtime service account, which is how it
   should run in a ministry deployment — no key material in the environment.
   On a laptop it is the Gemini API with a key from AI Studio.
*/
function client(): GoogleGenAI | null {
  const backend = geminiBackend();
  if (!backend) return null;
  return backend.kind === "vertex"
    ? new GoogleGenAI({
        vertexai: true,
        project: backend.project,
        location: backend.location,
      })
    : new GoogleGenAI({ apiKey: backend.apiKey });
}

async function serve<T>(
  id: CapabilityId,
  fixture: T,
  live: (ai: GoogleGenAI, model: string) => Promise<T>
): Promise<Served<T>> {
  const spec = specFor(id);
  const ai = client();
  const started = Date.now();

  if (!ai) {
    return {
      data: fixture,
      mode: "fixture",
      model: spec.model,
      latencyMs: Date.now() - started,
    };
  }

  try {
    const data = await live(ai, spec.model);
    return {
      data,
      mode: "live",
      model: spec.model,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      data: fixture,
      mode: "fixture",
      model: spec.model,
      latencyMs: Date.now() - started,
      fellBackBecause:
        error instanceof Error ? error.message : "Unknown Gemini error",
    };
  }
}

/* Parses a schema-constrained response, tolerating the code fence some
   model versions still wrap JSON in. */
function parseJson<T>(raw: string | undefined, what: string): T {
  if (!raw) throw new Error(`Gemini returned an empty ${what} response`);
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini returned unparseable JSON for ${what}`);
  }
}

/* Deterministic fixture pick, so one image always yields one reading. */
function pickFixture<T>(pool: T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return pool[Math.abs(h) % pool.length];
}

/* ── 1 · Vision: read a citizen's photograph ─────────────────────── */

const SKY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    usable: { type: Type.BOOLEAN },
    rejectionReason: { type: Type.STRING, nullable: true },
    hazeDensity: {
      type: Type.STRING,
      enum: ["clear", "light", "moderate", "heavy", "severe"],
    },
    visibilityKm: { type: Type.NUMBER, nullable: true },
    aqiBand: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        low: { type: Type.INTEGER },
        high: { type: Type.INTEGER },
      },
      required: ["low", "high"],
    },
    plumeVisible: { type: Type.BOOLEAN },
    plumeBearingDeg: { type: Type.NUMBER, nullable: true },
    probableSourceClass: {
      type: Type.STRING,
      enum: ["biomass", "industrial", "vehicular", "dust", "mixed", "indeterminate"],
    },
    sourceConfidence: { type: Type.NUMBER },
    reasoning: { type: Type.STRING },
    caveats: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "usable",
    "hazeDensity",
    "plumeVisible",
    "probableSourceClass",
    "sourceConfidence",
    "reasoning",
    "caveats",
  ],
};

const SKY_SYSTEM = `You are the vision stage of an air-quality attribution pipeline used by Indian state pollution control boards. You read one photograph of outdoor sky and return a bounded optical estimate.

Hard rules, in order of importance:

1. A photograph is not a monitor. Never return a point AQI. Return a band wide enough to honestly contain the truth, and widen it when the frame is ambiguous.
2. If the image does not show outdoor sky with a usable horizon, set usable=false, give a rejectionReason a member of the public would understand, and stop.
3. sourceConfidence above 0.7 requires visible plume structure, not merely colour. Colour cast alone is worth at most 0.5.
4. caveats must list every alternative explanation you could not exclude — low sun angle, thin overcast, fog, camera white balance, lens flare. An empty caveats array is always wrong.
5. reasoning must name what in the frame drove the call. Do not restate the output fields.
6. Do not infer regulatory breach, blame a named party, or recommend enforcement. You estimate optical conditions; attribution happens downstream with wind fields and station data.

Be specific and be conservative. A wide honest band is useful. A narrow wrong number destroys the register's credibility.`;

export async function analyseSkyPhoto(
  imageBase64: string,
  mimeType: string,
  context: { capturedAt?: string; lat?: number; lng?: number; place?: string }
): Promise<Served<SkyObservation>> {
  const fixture = pickFixture(
    SKY_OBSERVATION_FIXTURES,
    imageBase64.slice(0, 512) + imageBase64.length
  );

  const situ = [
    context.place ? `Location: ${context.place}` : null,
    context.lat != null && context.lng != null
      ? `Coordinates: ${context.lat.toFixed(4)}, ${context.lng.toFixed(4)}`
      : null,
    context.capturedAt ? `Captured at: ${context.capturedAt}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return serve("gemini-vision", fixture, async (ai, model) => {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: situ
                ? `Assess this photograph.\n\n${situ}\n\nUse the capture time to weigh sun-angle explanations for any warm colour cast.`
                : "Assess this photograph. No location or capture time was supplied, so widen your band accordingly and say so in the caveats.",
            },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        systemInstruction: SKY_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: SKY_SCHEMA,
        temperature: 0.2,
      },
    });

    const parsed = parseJson<SkyObservation>(res.text, "sky observation");
    /* The schema cannot express "confidence is a probability", so clamp. */
    parsed.sourceConfidence = Math.min(1, Math.max(0, parsed.sourceConfidence));
    if (!parsed.usable) parsed.sourceConfidence = 0;
    return parsed;
  });
}

/* ── 2 · Reasoning: attribution register to operator advisory ────── */

const ADVISORY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    body: { type: Type.STRING },
    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
    notify: { type: Type.ARRAY, items: { type: Type.STRING } },
    severity: {
      type: Type.STRING,
      enum: ["advisory", "warning", "emergency"],
    },
    validForHours: { type: Type.INTEGER },
  },
  required: ["headline", "body", "actions", "notify", "severity", "validForHours"],
};

const ADVISORY_SYSTEM = `You draft air-quality advisories for Indian district and state authorities, from a numeric source-receptor attribution register.

Rules:
1. Use only the numbers given. Never invent a figure, a district, or a percentage.
2. Every action must be something the named jurisdiction can actually order today, with a time attached. "Raise awareness" is not an action. "Invoke GRAP Stage IV from 22:00" is.
3. If most of the load is attributed upwind, say so plainly, and still include what the receptor jurisdiction must do itself — an advisory that only blames a neighbour is not actionable and will be ignored.
4. Order actions by how much exposure they avert, not by how easy they are.
5. Name real institutional roles in notify, in escalation order.
6. Write for someone deciding at 2am. Short sentences. No hedging, no adjectives that carry no information.
7. severity: "emergency" only when a statutory threshold is already crossed or is forecast to be crossed within 12 hours.`;

export interface AdvisoryInput {
  receptorCity: string;
  peakAQI: number;
  peakWindow: string;
  grapStage: number | string;
  upwindSharePct: number;
  confidenceInterval?: [number, number];
  topSources: { name: string; state: string; contributionPct: number }[];
  leadTimeHours: number;
  transportHours: number;
  certificateId: string;
}

export async function draftAdvisory(
  input: AdvisoryInput
): Promise<Served<Advisory>> {
  return serve("gemini-reasoning", ADVISORY_FIXTURE, async (ai, model) => {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Draft the advisory for this episode.

Receptor city: ${input.receptorCity}
Forecast peak AQI: ${input.peakAQI}, in the window ${input.peakWindow}
GRAP stage currently invoked: ${input.grapStage}
Warning lead time before threshold crossing: ${input.leadTimeHours} h
Transport delay, source ignition to receptor: ${input.transportHours} h

Attributed to upwind cells outside the receptor jurisdiction: ${input.upwindSharePct.toFixed(1)}%${
                input.confidenceInterval
                  ? ` (95% CI ${input.confidenceInterval[0].toFixed(1)}–${input.confidenceInterval[1].toFixed(1)}%)`
                  : ""
              }

Leading source cells:
${input.topSources
  .map((s) => `  · ${s.name}, ${s.state} — ${s.contributionPct.toFixed(1)}%`)
  .join("\n")}

Sealed attribution certificate: ${input.certificateId}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: ADVISORY_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: ADVISORY_SCHEMA,
        temperature: 0.3,
      },
    });

    return parseJson<Advisory>(res.text, "advisory");
  });
}

/* ── 3 · Reasoning: the notice that crosses a border ─────────────── */

const ALERT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
    smsText: { type: Type.STRING },
    recipients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          jurisdiction: { type: Type.STRING },
        },
        required: ["role", "jurisdiction"],
      },
    },
    escalationLevel: {
      type: Type.STRING,
      enum: ["routine", "priority", "immediate"],
    },
  },
  required: ["subject", "body", "smsText", "recipients", "escalationLevel"],
};

const ALERT_SYSTEM = `You draft the formal notice one Indian state's pollution control board sends another when an attribution finding names it.

This document will be contested. Write accordingly:
1. State the finding, the confidence interval, and the certificate id that makes it reproducible. The reproducibility clause is the most important sentence in the notice — the recipient must understand they can check it rather than trust it.
2. Neutral administrative register. No blame, no adjectives, no urgency theatre. The numbers carry the weight.
3. Never assert intent, negligence, or breach. Report attribution, not fault.
4. smsText must be under 160 characters and survive being read on a feature phone.
5. Recipients are real institutional roles, ordered by who must act first.`;

export async function draftAuthorityAlert(
  input: AdvisoryInput
): Promise<Served<AuthorityAlert>> {
  return serve("gemini-reasoning", AUTHORITY_ALERT_FIXTURE, async (ai, model) => {
    const res = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Draft the cross-border notice.

Receptor: ${input.receptorCity}
Forecast peak AQI ${input.peakAQI} in ${input.peakWindow}
Attributed upwind: ${input.upwindSharePct.toFixed(1)}%${
                input.confidenceInterval
                  ? ` (95% CI ${input.confidenceInterval[0].toFixed(1)}–${input.confidenceInterval[1].toFixed(1)}%)`
                  : ""
              }
Named cells:
${input.topSources
  .map((s) => `  · ${s.name}, ${s.state} — ${s.contributionPct.toFixed(1)}%`)
  .join("\n")}
Certificate: ${input.certificateId}
Transport delay: ${input.transportHours} h`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: ALERT_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: ALERT_SCHEMA,
        temperature: 0.25,
      },
    });

    return parseJson<AuthorityAlert>(res.text, "authority alert");
  });
}
