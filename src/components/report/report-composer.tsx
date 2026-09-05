"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/google/languages";
import { IconReport, IconVoice, IconArrowRight } from "@/components/icons";
import { StatusChip } from "@/components/ui/primitives";
import type { SkyObservation } from "@/lib/google/types";
import { cn } from "@/lib/utils";

/*
   The citizen report composer.

   Everything here is shaped by one assumption: the person filing this is
   standing outside on a phone, on a slow connection, and may not read the
   language the interface defaults to. So the photograph is the only required
   input, the location is taken automatically with a manual fallback, the note
   can be spoken instead of typed, and nothing blocks on a field the reporter
   cannot supply.

   The result panel is deliberately unflattering. It leads with the band and
   the caveats, not the source class, because the honest reading of one
   photograph is "probably this, and here is everything that could make it
   wrong" — and a register built on overconfident single frames is one a state
   can dismiss in a single hearing.
*/

interface Provenance {
  mode: "live" | "fixture";
  model: string;
  latencyMs: number;
  fellBackBecause: string | null;
  geocodeMode: string;
}

interface ReportResult {
  report: {
    id: string;
    tehsil: string | null;
    district: string | null;
    state: string | null;
    weight: number;
    observation: SkyObservation;
    transcript: string | null;
  };
  provenance: Provenance;
}

type Stage = "idle" | "locating" | "reading" | "done" | "error";

const HAZE_TONE: Record<string, string> = {
  clear: "text-accent-clear",
  light: "text-accent-clear",
  moderate: "text-accent-verify",
  heavy: "text-accent-hazard",
  severe: "text-accent-hazard",
};

/* Minimal typing for the vendor-prefixed Web Speech API. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export function ReportComposer() {
  /* File and its object URL move together. Creating the URL in the change
     handler rather than deriving it in an effect keeps the only setState out
     of an effect body, and makes the revoke unambiguous: the previous URL is
     released at the exact moment it stops being displayed. */
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const file = picked?.file ?? null;
  const preview = picked?.url ?? null;
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordError, setCoordError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [language, setLanguage] = useState("en");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [listening, setListening] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  const choose = useCallback((next: File | null) => {
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return next ? { file: next, url: URL.createObjectURL(next) } : null;
    });
  }, []);

  /* Release the last URL when the composer unmounts. */
  const pickedUrl = picked?.url;
  useEffect(() => {
    if (!pickedUrl) return;
    return () => URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  /* Nothing in here touches state synchronously — every setState happens in a
     geolocation callback — so it is safe to run from an effect on mount
     without triggering a cascading render. */
  const requestPosition = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCoordError(null);
        setStage("idle");
      },
      (err) => {
        setCoordError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. Enter coordinates below to file anyway."
            : "Could not read a location. Enter coordinates below to file anyway."
        );
        setStage("idle");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  /* The button adds the states the effect must not set: the "locating"
     indication, and the message shown when the browser has no geolocation
     at all. */
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setCoordError("This browser cannot report a location. Enter coordinates below.");
      return;
    }
    setStage("locating");
    requestPosition();
  }, [requestPosition]);

  useEffect(() => {
    requestPosition();
  }, [requestPosition]);

  /* Voice note. Cloud Speech-to-Text is the server path; this is the
     browser's own recogniser, which needs no key and ships on every recent
     mobile Chrome. Either way the reporter never has to type. */
  const toggleDictation = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("This browser cannot record speech. Please type the note instead.");
      return;
    }

    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = LANGUAGES.find((l) => l.code === language)?.ttsLocale ?? "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript;
      if (said) setNote((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognition.current = rec;
    rec.start();
    setListening(true);
  }, [language, listening]);

  const submit = useCallback(async () => {
    if (!file || !coords) return;
    setStage("reading");
    setError(null);
    setResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = String(reader.result);
          resolve(raw.slice(raw.indexOf(",") + 1));
        };
        reader.onerror = () => reject(new Error("Could not read the image file."));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/observe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          lat: coords.lat,
          lng: coords.lng,
          capturedAt: new Date(file.lastModified).toISOString(),
          note: note.trim() || undefined,
          language,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The report could not be filed.");
      setResult(json as ReportResult);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The report could not be filed.");
      setStage("error");
    }
  }, [file, coords, note, language]);

  const ready = Boolean(file && coords) && stage !== "reading";

  return (
    <div className="grid gap-px bg-border-subtle lg:grid-cols-2">
      {/* ── Compose ─────────────────────────────────────────── */}
      <div className="bg-bg-base p-6 lg:p-8">
        <div className="label-technical">Compose</div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className={cn(
              "panel bezel flex aspect-[4/3] w-full items-center justify-center overflow-hidden transition-colors",
              preview ? "p-0" : "hover:border-accent-verify/50"
            )}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="The sky photograph you are about to file"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-3 text-text-tertiary">
                <IconReport size={30} strokeWidth={1} />
                <span className="label-technical">Photograph the sky</span>
                <span className="max-w-[16rem] text-center text-2xs leading-relaxed text-text-quaternary">
                  Include the horizon. The furthest thing you can still make out
                  is what the estimate is read from.
                </span>
              </span>
            )}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files?.[0] ?? null);
              setResult(null);
              setStage("idle");
            }}
          />
          {preview && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-2 text-2xs text-text-tertiary underline-offset-2 hover:text-accent-verify hover:underline"
            >
              Retake or choose another photograph
            </button>
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <span className="label-technical">Location</span>
            <button
              type="button"
              onClick={locate}
              className="text-2xs text-text-tertiary hover:text-accent-verify"
            >
              {stage === "locating" ? "Locating…" : "Use my location"}
            </button>
          </div>
          {coords ? (
            <div className="readout mt-2 text-sm text-text-secondary">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.0001"
                placeholder="Latitude"
                aria-label="Latitude"
                className="panel-inset readout px-2.5 py-2 text-sm text-text-primary placeholder:text-text-quaternary"
                onChange={(e) =>
                  setCoords((c) => ({ lat: Number(e.target.value), lng: c?.lng ?? 0 }))
                }
              />
              <input
                type="number"
                step="0.0001"
                placeholder="Longitude"
                aria-label="Longitude"
                className="panel-inset readout px-2.5 py-2 text-sm text-text-primary placeholder:text-text-quaternary"
                onChange={(e) =>
                  setCoords((c) => ({ lat: c?.lat ?? 0, lng: Number(e.target.value) }))
                }
              />
            </div>
          )}
          {coordError && (
            <p className="mt-2 text-2xs leading-relaxed text-accent-verify">{coordError}</p>
          )}
        </div>

        <div className="mt-6">
          <label htmlFor="report-language" className="label-technical">
            Language
          </label>
          <select
            id="report-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="panel-inset mt-2 w-full px-2.5 py-2 text-sm text-text-primary"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} · {l.english}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label htmlFor="report-note" className="label-technical">
              What do you see? (optional)
            </label>
            <button
              type="button"
              onClick={toggleDictation}
              className={cn(
                "flex items-center gap-1.5 text-2xs transition-colors",
                listening ? "text-accent-hazard" : "text-text-tertiary hover:text-accent-verify"
              )}
            >
              <IconVoice size={12} className={listening ? "hazard-pulse" : undefined} />
              {listening ? "Listening — tap to stop" : "Speak instead"}
            </button>
          </div>
          <textarea
            id="report-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Smoke since morning, smells like burning straw…"
            className="panel-inset mt-2 w-full resize-none px-2.5 py-2 text-sm text-text-primary placeholder:text-text-quaternary"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className={cn(
            "group mt-7 inline-flex w-full items-center justify-center gap-2.5 border px-5 py-3 text-sm transition-colors",
            ready
              ? "border-accent-verify bg-accent-verify/10 text-accent-verify hover:bg-accent-verify/20"
              : "cursor-not-allowed border-border-subtle text-text-quaternary"
          )}
        >
          {stage === "reading" ? "Reading the photograph…" : "File this report"}
          {stage !== "reading" && (
            <IconArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          )}
        </button>

        {!file && (
          <p className="mt-3 text-2xs text-text-quaternary">
            A photograph is required. Everything else is optional.
          </p>
        )}
        {error && (
          <p className="mt-3 border-l-2 border-accent-hazard pl-3 text-sm text-accent-hazard">
            {error}
          </p>
        )}
      </div>

      {/* ── Reading ─────────────────────────────────────────── */}
      <div className="bg-bg-base p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <span className="label-technical">Reading</span>
          {result && (
            <StatusChip tone={result.provenance.mode === "live" ? "clear" : "verify"}>
              {result.provenance.mode === "live" ? "Gemini · live" : "Gemini · recorded"}
            </StatusChip>
          )}
        </div>

        {stage === "reading" && (
          <div className="mt-6 space-y-3">
            <div className="skeleton h-3 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
            <p className="label-technical pt-2">Gemini multimodal · segmenting sky</p>
          </div>
        )}

        {!result && stage !== "reading" && (
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-text-tertiary">
            The reading appears here. It will give a band rather than a number,
            and it will list what could make it wrong — a photograph is one weak
            observation, and the register treats it as one.
          </p>
        )}

        {result && <ReadingPanel result={result} />}
      </div>
    </div>
  );
}

function ReadingPanel({ result }: { result: ReportResult }) {
  const o = result.report.observation;

  if (!o.usable) {
    return (
      <div className="mt-6">
        <StatusChip tone="hazard">Not usable</StatusChip>
        <p className="mt-4 text-md leading-relaxed text-text-primary">{o.rejectionReason}</p>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          The report is stored as {result.report.id} but carries no weight in the
          register. Photograph the open sky with the horizon in frame and file again.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-px bg-border-subtle">
        <Cell label="Haze density">
          <span className={cn("capitalize", HAZE_TONE[o.hazeDensity])}>{o.hazeDensity}</span>
        </Cell>
        <Cell label="AQI band">
          {o.aqiBand ? `${o.aqiBand.low}–${o.aqiBand.high}` : "—"}
        </Cell>
        <Cell label="Visibility">
          {o.visibilityKm != null ? `${o.visibilityKm} km` : "—"}
        </Cell>
        <Cell label="Plume bearing">
          {o.plumeBearingDeg != null ? `${Math.round(o.plumeBearingDeg)}°` : "None visible"}
        </Cell>
        <Cell label="Probable source">
          <span className="capitalize">{o.probableSourceClass}</span>
        </Cell>
        <Cell label="Model confidence">{(o.sourceConfidence * 100).toFixed(0)}%</Cell>
      </div>

      <div className="mt-5">
        <div className="label-technical">Why</div>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{o.reasoning}</p>
      </div>

      <div className="mt-5">
        <div className="label-technical">What could make this wrong</div>
        <ul className="mt-2 space-y-2">
          {o.caveats.map((c) => (
            <li
              key={c}
              className="border-l-2 border-border-default pl-3 text-sm leading-relaxed text-text-tertiary"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="panel bezel mt-6 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-technical">Weight in register</span>
          <span className="readout text-lg text-accent-verify">
            {result.report.weight.toFixed(3)}
          </span>
        </div>
        <div className="mt-3 h-1.5 bg-bg-inset">
          <div
            className="h-full bg-accent-verify transition-[width] duration-500"
            style={{ width: `${Math.min(100, result.report.weight * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
          A lone report is capped at 0.35 of the model&apos;s own confidence, however
          certain the model is. Weight rises only when other people in{" "}
          {result.report.tehsil ?? "the same tehsil"} file reports that agree,
          within three hours. That is what stops one camera moving a register a
          state will be asked to answer for.
        </p>
      </div>

      <dl className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
        <Row term="Report" def={result.report.id} />
        <Row
          term="Placed in"
          def={
            result.report.tehsil
              ? `${result.report.tehsil}, ${result.report.district}, ${result.report.state}`
              : "Outside the corridor register"
          }
        />
        <Row
          term="Placement"
          def={
            result.provenance.geocodeMode === "geocoded"
              ? "Maps Platform reverse geocoding"
              : "Nearest corridor centroid"
          }
        />
        <Row term="Model" def={result.provenance.model} />
        <Row
          term="Served"
          def={
            result.provenance.mode === "live"
              ? `Live · ${result.provenance.latencyMs} ms`
              : "Recorded output — no Gemini key on this deployment"
          }
        />
      </dl>

      {result.provenance.fellBackBecause && (
        <p className="mt-4 border-l-2 border-accent-hazard pl-3 text-2xs leading-relaxed text-accent-hazard">
          A live call was attempted and failed: {result.provenance.fellBackBecause}
        </p>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-base px-3.5 py-3">
      <div className="label-technical">{label}</div>
      <div className="readout mt-1.5 text-md text-text-primary">{children}</div>
    </div>
  );
}

function Row({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="label-technical shrink-0">{term}</dt>
      <dd className="readout truncate text-2xs text-text-secondary">{def}</dd>
    </div>
  );
}
