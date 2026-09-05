/*
   The structured contracts Gemini is asked to fill.

   Every one of these is also the shape of the corresponding fixture, so the
   live path and the offline path are indistinguishable to the caller apart
   from the `mode` field, which is always carried through to the UI.
*/

import type { ServeMode } from "./config";

export type SourceClass =
  | "biomass"
  | "industrial"
  | "vehicular"
  | "dust"
  | "mixed"
  | "indeterminate";

export type HazeDensity = "clear" | "light" | "moderate" | "heavy" | "severe";

/**
 * What a single photograph can honestly support.
 *
 * A photograph cannot produce a point AQI, so the model is asked for a band
 * and a confidence, never a number. Everything downstream treats this as one
 * weak observation to be fused with the station network, not as a measurement.
 */
export interface SkyObservation {
  /** False when the image is not a usable photograph of outdoor sky. */
  usable: boolean;
  rejectionReason: string | null;

  hazeDensity: HazeDensity;
  /** Horizontal visibility in km, as read off the furthest resolvable object. */
  visibilityKm: number | null;
  /** Inclusive AQI band. Wide on purpose: this is a photograph, not a monitor. */
  aqiBand: { low: number; high: number } | null;

  plumeVisible: boolean;
  /** Compass bearing the plume travels toward, degrees from north. */
  plumeBearingDeg: number | null;

  probableSourceClass: SourceClass;
  /** 0–1. Below 0.4 the register records the report but gives it no weight. */
  sourceConfidence: number;

  /** Short, plain, and specific about what in the frame drove the call. */
  reasoning: string;
  /** Everything that could make this reading wrong. Never empty in practice. */
  caveats: string[];
}

export interface Advisory {
  /** One line a district magistrate can read aloud without editing. */
  headline: string;
  /** 2–4 sentences: what is happening, from where, and over what window. */
  body: string;
  /** Concrete, jurisdiction-appropriate, ordered by impact. */
  actions: string[];
  /** Who must be told, in escalation order. */
  notify: string[];
  severity: "advisory" | "warning" | "emergency";
  /** How long this advice stands before it must be reissued. */
  validForHours: number;
}

export interface AuthorityAlert {
  subject: string;
  body: string;
  /** The single sentence that would go out as an SMS. */
  smsText: string;
  recipients: { role: string; jurisdiction: string }[];
  escalationLevel: "routine" | "priority" | "immediate";
}

/** Every adapter return is wrapped so the caller always knows what served it. */
export interface Served<T> {
  data: T;
  mode: ServeMode;
  /** Model or endpoint that produced this, for the provenance record. */
  model: string;
  /** Milliseconds spent in the call. Shown in the console's latency readout. */
  latencyMs: number;
  /** Set when a live call was attempted and failed, and a fixture stood in. */
  fellBackBecause?: string;
}
