import "server-only";
import { createHash } from "node:crypto";
import { fetchFireDetections, PUNJAB_HARYANA_BBOX } from "@/lib/sources/firms";
import { fetchWindField, episodeWindField } from "@/lib/sources/meteo";
import { fetchCpcbStations } from "@/lib/sources/cpcb";
import { placeByCentroid } from "@/lib/sources/geocode";
import { computeAttribution, type AttributionResult } from "@/lib/attribution/engine";
import { computeCertificateTree } from "@/lib/merkle";
import type { Certificate, MerkleLeaf, MerkleNode } from "@/data/mock-certificates";
import type { AdvisoryInput } from "@/lib/google/gemini";

/*
   One run of the pipeline, end to end.

   Advisory, alert and certificate used to take their figures from a
   hand-written episode record — a peak AQI of 482, a 40-hour transport time,
   a certificate id nobody computed. They now all read from this function, so
   the advisory a magistrate reads, the notice sent to Punjab and the
   certificate that seals the finding are three views of the same computation
   rather than three documents that happen to agree.

   Two modes, same code path:
     episode — the recorded 3 November 925 hPa field, with live fires and
               live CPCB readings where keys exist
     live    — the field blowing right now, which outside the burning season
               correctly reports that almost nothing reaches Delhi
*/

export type RunMode = "episode" | "live";

const RECEPTOR = { name: "Delhi", lat: 28.6469, lng: 77.3162 };

export interface ReceptorReading {
  aqi: number | null;
  station: string | null;
  dominant: string | null;
  stationsReporting: number;
  live: boolean;
  source: string;
}

export interface EpisodeRun {
  mode: RunMode;
  attribution: AttributionResult;
  receptor: ReceptorReading;
  advisoryInput: AdvisoryInput;
  certificate: Certificate;
  upstreams: {
    fires: { live: boolean; source: string; count: number };
    wind: { live: boolean; source: string };
    cpcb: { live: boolean; source: string; stations: number };
  };
}

/* CPCB GRAP stages by AQI. */
function grapStage(aqi: number | null): string {
  if (aqi == null) return "Not determinable";
  if (aqi >= 450) return "IV";
  if (aqi >= 401) return "III";
  if (aqi >= 301) return "II";
  if (aqi >= 201) return "I";
  return "Not invoked";
}

/*
   Content digest of a payload. Only data is hashed — never fetch timestamps —
   so identical inputs produce an identical digest, which is what lets a
   second party re-run the pipeline and land on the same leaf.
*/
function digest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function istWindow(iso: string | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  return `${fmt(t - 2 * 3600_000)}–${fmt(t + 2 * 3600_000)} IST`;
}

export async function runEpisode(mode: RunMode = "episode"): Promise<EpisodeRun> {
  const started = Date.now();

  const [fires, liveWind, cpcb] = await Promise.all([
    fetchFireDetections(PUNJAB_HARYANA_BBOX, 2),
    mode === "live" ? fetchWindField("punjab-delhi") : Promise.resolve(null),
    fetchCpcbStations(),
  ]);
  const wind = mode === "live" && liveWind ? liveWind : episodeWindField();

  const attribution = computeAttribution(
    fires.detections,
    wind,
    RECEPTOR,
    placeByCentroid,
    "Delhi"
  );
  attribution.method.firesLive = fires.live;

  /* The receptor figure is the worst CPCB station in Delhi, which is the
     reading a GRAP decision is actually taken on. */
  const delhi = cpcb.stations.filter((s) => s.state === "Delhi" && s.aqi != null);
  const worst = delhi.reduce<(typeof delhi)[number] | null>(
    (w, s) => (w == null || (s.aqi ?? 0) > (w.aqi ?? 0) ? s : w),
    null
  );
  const receptor: ReceptorReading = {
    aqi: worst?.aqi ?? null,
    station: worst?.station ?? null,
    dominant: worst?.dominant ?? null,
    stationsReporting: delhi.length,
    live: cpcb.live,
    source: cpcb.source,
  };

  const peak = attribution.arrivalCurve.reduce<(typeof attribution.arrivalCurve)[number] | null>(
    (p, b) => (p == null || b.load > p.load ? b : p),
    null
  );

  /* ── Seal ─────────────────────────────────────────────────────────── */

  const payloads = [
    {
      label: "FIRMS active fire detections",
      source: `${fires.source} · ${fires.detections.length} detections`,
      data: fires.detections,
    },
    {
      label: "925 hPa wind field",
      source: wind.source,
      data: wind.samples,
    },
    {
      label: "CPCB receptor network",
      source: `${cpcb.source}`,
      data: cpcb.stations,
    },
    {
      label: "Attribution register",
      source: `Forward Lagrangian puff engine · ${attribution.byTehsil.length} tehsils`,
      data: attribution.byTehsil,
    },
    {
      label: "Model configuration",
      source: `${attribution.method.model} · ${attribution.method.transportLevel}`,
      data: attribution.method,
    },
  ].map((p) => ({ ...p, digest: digest(p.data) }));

  const inputDigest = digest(payloads.map((p) => p.digest));
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const certId = `PRM-CERT-${day}-${mode === "live" ? "L" : "E"}-${inputDigest.slice(0, 10).toUpperCase()}`;

  /* Each leaf commits to its payload's digest by carrying it in the declared
     data source, so the existing verifier re-derives the tree unchanged. */
  const leafInputs = payloads.map((p, index) => ({
    index,
    label: p.label,
    dataSource: `${p.source} · sha256:${p.digest}`,
  }));
  const tree = await computeCertificateTree(certId, leafInputs);

  const inputHashes: MerkleLeaf[] = leafInputs.map((l, i) => ({
    ...l,
    hash: `sha256:${tree.levels[0][i]}`,
    verified: true,
  }));

  const merkleIntermediates: MerkleNode[] = tree.levels.slice(1).flatMap((level, li) =>
    level.map((hash, index) => {
      const below = tree.levels[li];
      return {
        level: li + 1,
        index,
        hash: `sha256:${hash}`,
        children: [2 * index, Math.min(2 * index + 1, below.length - 1)] as [number, number],
        verified: true,
      };
    })
  );

  const issued = new Date();
  const certificate: Certificate = {
    id: certId,
    episodeId: mode === "live" ? `LIVE-${day}` : "EP-2024-NOV-03-REPLAY",
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + 365 * 86400_000).toISOString(),
    version: "1.1.0",
    modelCommit:
      process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.PRAMANA_COMMIT ?? "local-uncommitted",
    modelBranch: process.env.VERCEL_GIT_COMMIT_REF ?? "master",
    containerDigest: "not containerised on this deployment",
    pipelineVersion: `pramana-engine@${process.env.npm_package_version ?? "0.1.0"}`,
    inputHashes,
    merkleRoot: `sha256:${tree.root}`,
    merkleIntermediates,
    reproducibilityStatement:
      "Each leaf carries the SHA-256 digest of the exact data the pipeline consumed — fire detections, wind field, CPCB readings, the computed register and the model configuration. Re-fetch the same inputs, re-run the engine, and the digests, leaves and root will match; any input that differs is identified by the leaf that diverges.",
    executionDurationMs: Date.now() - started,
    computeEnvironment: `Node ${process.version} · ${process.env.VERCEL ? "Vercel" : "local"}`,
  };

  const top = attribution.byTehsil.slice(0, 3);
  const advisoryInput: AdvisoryInput = {
    receptorCity: RECEPTOR.name,
    peakAQI: receptor.aqi ?? 0,
    peakWindow: istWindow(peak?.isoTime),
    grapStage: grapStage(receptor.aqi),
    upwindSharePct: attribution.upwindSharePct,
    confidenceInterval: attribution.upwindCi,
    topSources: top.map((t) => ({
      name: t.tehsil,
      state: t.state ?? "Unplaced",
      contributionPct: t.contributionPct,
    })),
    leadTimeHours: attribution.peakTransportHours,
    transportHours: attribution.peakTransportHours,
    certificateId: certId,
  };

  return {
    mode,
    attribution,
    receptor,
    advisoryInput,
    certificate,
    upstreams: {
      fires: { live: fires.live, source: fires.source, count: fires.detections.length },
      wind: { live: wind.live, source: wind.source },
      cpcb: { live: cpcb.live, source: cpcb.source, stations: cpcb.stations.length },
    },
  };
}
