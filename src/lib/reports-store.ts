import "server-only";
import type { SkyObservation } from "@/lib/google/types";

/*
   Citizen report register.

   In-process and bounded, which is the correct scope for a prototype and is
   stated plainly rather than dressed up: restarting the server empties it.
   The production target is Firestore, and the shape below is already the
   document shape, so the swap is a driver change and not a redesign.

   The weighting rule is the part that matters and is not a prototype
   shortcut. A single photograph is weak evidence. Reports earn weight only by
   agreeing with other reports from the same tehsil inside the same window,
   which is what stops one person with a camera from moving a register that a
   state will be asked to answer for.
*/

export interface CitizenReport {
  id: string;
  receivedAt: string;
  capturedAt: string | null;
  lat: number;
  lng: number;
  tehsil: string | null;
  district: string | null;
  state: string | null;
  language: string;
  /** What the reporter said, typed or spoken. */
  note: string | null;
  /** Present when the note arrived as audio. */
  transcript: string | null;
  observation: SkyObservation;
  /** Which path produced the observation. Never hidden from the UI. */
  analysisMode: "live" | "fixture";
  model: string;
  /** 0–1, assigned by corroborate(). */
  weight: number;
}

const MAX_REPORTS = 500;
const reports: CitizenReport[] = [];

/** Reports inside this window from the same tehsil corroborate each other. */
const CORROBORATION_WINDOW_MS = 3 * 60 * 60 * 1000;

export function addReport(report: CitizenReport): CitizenReport {
  reports.unshift(report);
  if (reports.length > MAX_REPORTS) reports.length = MAX_REPORTS;
  recomputeWeights();
  return reports.find((r) => r.id === report.id) ?? report;
}

export function listReports(limit = 50): CitizenReport[] {
  return reports.slice(0, limit);
}

export function reportCount(): number {
  return reports.length;
}

/*
   Weight = model confidence, scaled by how many independent reports agree.

   One report caps at 0.35 no matter how confident the model is, because a
   confident model looking at one photograph is still looking at one
   photograph. Agreement from three or more reporters in the same tehsil
   within three hours lifts it to the model's own confidence, and no further —
   corroboration can restore the model's confidence, never exceed it.
*/
function recomputeWeights(): void {
  for (const report of reports) {
    if (!report.observation.usable) {
      report.weight = 0;
      continue;
    }

    const t = Date.parse(report.receivedAt);
    const peers = reports.filter(
      (other) =>
        other.id !== report.id &&
        other.observation.usable &&
        other.tehsil != null &&
        other.tehsil === report.tehsil &&
        Math.abs(Date.parse(other.receivedAt) - t) <= CORROBORATION_WINDOW_MS
    );

    /* Peers only count when they agree on severity, not merely on existing. */
    const agreeing = peers.filter(
      (other) =>
        severityRank(other.observation.hazeDensity) ===
        severityRank(report.observation.hazeDensity)
    ).length;

    const corroboration = Math.min(1, 0.35 + 0.325 * Math.min(agreeing, 2));
    report.weight = Number(
      (report.observation.sourceConfidence * corroboration).toFixed(3)
    );
  }
}

function severityRank(d: SkyObservation["hazeDensity"]): number {
  return ["clear", "light", "moderate", "heavy", "severe"].indexOf(d);
}

/** Cleared between test runs. */
export function _resetForTests(): void {
  reports.length = 0;
}
