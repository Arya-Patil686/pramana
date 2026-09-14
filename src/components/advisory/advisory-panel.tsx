"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES, CORRIDOR_LANGUAGES, languageFor } from "@/lib/google/languages";
import { StatusChip } from "@/components/ui/primitives";
import { IconVoice, IconArrowRight } from "@/components/icons";
import { cn } from "@/lib/utils";

/*
   The advisory surface.

   Two audiences, deliberately rendered differently, because they carry
   different risk. The operator advisory is generated per episode and is read
   by a professional who can weigh it. The public message is drawn from a
   reviewed phrasebook and is the only text that is ever spoken aloud — a
   model improvising protective health instruction in a language nobody on the
   team reads is not a risk worth taking to save a translation file.

   Speech has two paths. Cloud Text-to-Speech when a key is present, and the
   browser's own synthesiser when it is not. The second is a real voice on the
   listener's own device, not a simulation of one, so the voice-first claim
   holds on a laptop with nothing configured.
*/

interface AdvisoryPayload {
  advisory: {
    headline: string;
    body: string;
    actions: string[];
    notify: string[];
    severity: "advisory" | "warning" | "emergency";
    validForHours: number;
    headlineLocalised: string;
    bodyLocalised: string;
  };
  publicMessage: {
    headline: string;
    instructions: string[];
    via: "reviewed" | "generated" | "english-fallback";
    model: string | null;
  };
  speech: {
    audioBase64: string | null;
    languageCode: string;
    useBrowserFallback: boolean;
    mode: "live" | "fixture";
  } | null;
  spokenText: string;
  provenance: {
    advisory: { mode: string; model: string; latencyMs: number; fellBackBecause: string | null };
    translation: {
      mode: string;
      translated: boolean;
      narrativeVia: "cloud-translation" | "gemini" | "none";
      publicVia: string;
    };
    speech: { mode: string } | null;
  };
}

const SEVERITY_TONE = {
  advisory: "clear",
  warning: "verify",
  emergency: "hazard",
} as const;

export function AdvisoryPanel() {
  const [language, setLanguage] = useState("hi");
  const [data, setData] = useState<AdvisoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const corridorLangs = CORRIDOR_LANGUAGES["punjab-delhi"];

  /* `loading` is raised by whatever triggers a reload — the initial state, or
     the language button — never inside the effect. Setting it synchronously in
     an effect body is what causes the cascading render React 19 warns about. */
  const load = useCallback(async (lang: string) => {
    try {
      const res = await fetch("/api/advisory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, speak: true }),
      });
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(language);
  }, [language, load]);

  /* Stop any in-flight speech when the language changes or the page unmounts,
     or the previous language keeps talking over the new one. */
  const stopSpeech = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => stopSpeech, [language, stopSpeech]);

  const speak = useCallback(() => {
    if (!data) return;
    if (speaking) {
      stopSpeech();
      return;
    }

    setSpeechNote(null);
    const spec = languageFor(language);

    /* Cloud Text-to-Speech, when this deployment has a key. */
    if (data.speech?.audioBase64) {
      const el = new Audio(`data:audio/mp3;base64,${data.speech.audioBase64}`);
      el.onended = () => setSpeaking(false);
      el.onerror = () => {
        setSpeaking(false);
        setSpeechNote("The synthesised audio could not be played on this device.");
      };
      audio.current = el;
      setSpeaking(true);
      void el.play();
      return;
    }

    /* The browser's own voice. */
    if (!("speechSynthesis" in window)) {
      setSpeechNote("This browser cannot speak. Cloud Text-to-Speech needs a key to serve audio.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(data.spokenText);
    utterance.lang = spec.ttsLocale;
    utterance.rate = 0.92;

    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang === spec.ttsLocale) ??
      voices.find((v) => v.lang.startsWith(`${spec.code}-`));
    if (match) {
      utterance.voice = match;
    } else {
      setSpeechNote(
        `This device has no ${spec.english} voice installed, so the text will be read with the default voice. Cloud Text-to-Speech serves a correct ${spec.english} voice when a key is configured.`
      );
    }

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [data, language, speaking, stopSpeech]);

  const spec = languageFor(language);

  return (
    <div>
      {/* Language rail */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-technical mr-1">Language</span>
        {LANGUAGES.map((l) => {
          const onCorridor = corridorLangs.includes(l.code);
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                if (l.code === language) return;
                setLoading(true);
                setLanguage(l.code);
              }}
              className={cn(
                "border px-2.5 py-1 text-sm transition-colors",
                language === l.code
                  ? "border-accent-verify bg-accent-verify/10 text-accent-verify"
                  : onCorridor
                    ? "border-border-default text-text-secondary hover:border-border-lit hover:text-text-primary"
                    : "border-border-subtle text-text-quaternary hover:border-border-default hover:text-text-tertiary"
              )}
              title={
                onCorridor
                  ? `Spoken along the Punjab–Delhi corridor`
                  : `${l.english} — outside this corridor, shown to demonstrate national reach`
              }
            >
              {l.native}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
        Highlighted languages are the ones actually spoken along the Punjab–Delhi
        corridor. The rest are reachable but are not shipped to a district that
        does not need them — a state gets the languages its people speak, not
        all twelve.
      </p>

      {loading && (
        <div className="mt-10 space-y-3">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-5/6" />
        </div>
      )}

      {data && !loading && (
        <div className="mt-10 grid gap-px bg-border-subtle lg:grid-cols-2">
          {/* Public message — reviewed, spoken */}
          <div className="bg-bg-base p-6 lg:p-8" dir={spec.rtl ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between gap-4" dir="ltr">
              <span className="label-technical">Public message</span>
              <StatusChip
                tone={
                  data.publicMessage.via === "reviewed"
                    ? "clear"
                    : data.publicMessage.via === "generated"
                      ? "signal"
                      : "verify"
                }
              >
                {data.publicMessage.via === "reviewed"
                  ? "Reviewed copy"
                  : data.publicMessage.via === "generated"
                    ? "Machine translated"
                    : "English fallback"}
              </StatusChip>
            </div>

            <h3 className="mt-5 font-display text-lg leading-snug text-text-primary">
              {data.publicMessage.headline}
            </h3>

            <ul className="mt-6 space-y-3.5">
              {data.publicMessage.instructions.map((line) => (
                <li
                  key={line}
                  className={cn(
                    "border-accent-hazard pl-4 text-md leading-relaxed text-text-secondary",
                    spec.rtl ? "border-r-2 pr-4 pl-0" : "border-l-2"
                  )}
                >
                  {line}
                </li>
              ))}
            </ul>

            <div dir="ltr">
              <button
                type="button"
                onClick={speak}
                className={cn(
                  "mt-7 inline-flex items-center gap-2.5 border px-5 py-2.5 text-sm transition-colors",
                  speaking
                    ? "border-accent-hazard bg-accent-hazard/10 text-accent-hazard"
                    : "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-stain-0)] hover:bg-[var(--color-ink-soft)]"
                )}
              >
                <IconVoice size={14} className={speaking ? "hazard-pulse" : undefined} />
                {speaking ? "Stop" : `Read aloud in ${spec.english}`}
              </button>

              <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
                {data.speech?.audioBase64
                  ? "Spoken by Cloud Text-to-Speech."
                  : "Cloud Text-to-Speech has no key on this deployment, so your browser's own voice reads it. The text is identical."}
              </p>
              {speechNote && (
                <p className="mt-2 text-2xs leading-relaxed text-accent-verify">{speechNote}</p>
              )}

              {data.publicMessage.via === "generated" && (
                <p className="mt-4 border-l-2 border-accent-signal pl-3 text-2xs leading-relaxed text-text-tertiary">
                  No reviewed copy exists in {spec.english} yet, so this is a
                  machine translation of the reviewed English — produced once
                  by {data.publicMessage.model ?? "Gemini"} at build time, not
                  checked by a {spec.english} speaker. The four
                  corridor languages carry reviewed copy; a state adopting this
                  would have its own health department sign off the rest before
                  any of it went out.
                </p>
              )}
              {data.publicMessage.via === "english-fallback" && (
                <p className="mt-4 border-l-2 border-accent-verify pl-3 text-2xs leading-relaxed text-text-tertiary">
                  No reviewed copy in {spec.english} and no committed machine
                  translation yet, so the reviewed English is served unchanged
                  rather than silently leaving a gap. Running
                  scripts/build-phrasebook.mjs fills this in; it is a build
                  step so that a language switch never spends the daily model
                  quota that citizen photo analysis needs.
                </p>
              )}
            </div>
          </div>

          {/* Operator advisory — generated */}
          <div className="bg-bg-base p-6 lg:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="label-technical">Operator advisory</span>
              <StatusChip tone={SEVERITY_TONE[data.advisory.severity]} pulse>
                {data.advisory.severity}
              </StatusChip>
            </div>

            <h3 className="mt-5 font-display text-lg leading-snug text-text-primary">
              {data.advisory.headlineLocalised}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              {data.advisory.bodyLocalised}
            </p>

            <div className="mt-7">
              <div className="label-technical">Ordered by exposure averted</div>
              <ol className="mt-3 space-y-3">
                {data.advisory.actions.map((a, i) => (
                  <li key={a} className="flex gap-3">
                    <span className="readout shrink-0 text-2xs text-accent-verify">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-text-secondary">{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-7">
              <div className="label-technical">Notify, in escalation order</div>
              <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
                {data.advisory.notify.map((n) => (
                  <li key={n} className="py-2.5 text-sm text-text-secondary">
                    {n}
                  </li>
                ))}
              </ul>
            </div>

            <dl className="mt-7 divide-y divide-border-subtle border-y border-border-subtle">
              <Row term="Valid for" def={`${data.advisory.validForHours} h`} />
              <Row
                term="Narrative"
                def={
                  data.provenance.advisory.mode === "live"
                    ? `${data.provenance.advisory.model} · ${data.provenance.advisory.latencyMs} ms`
                    : `${data.provenance.advisory.model} · recorded`
                }
              />
              <Row
                term="Narrative"
                def={
                  language === "en"
                    ? "Not translated"
                    : data.provenance.translation.narrativeVia === "cloud-translation"
                      ? "Cloud Translation · live"
                      : data.provenance.translation.narrativeVia === "gemini"
                        ? "Gemini · machine translation"
                        : "Untranslated — no path configured"
                }
              />
              <Row
                term="Public text"
                def={
                  data.publicMessage.via === "reviewed"
                    ? "Reviewed phrasebook"
                    : data.publicMessage.via === "generated"
                      ? `${data.publicMessage.model ?? "Gemini"} · built`
                      : "English, not yet translated"
                }
              />
              <Row
                term="Speech"
                def={
                  data.speech?.audioBase64
                    ? "Cloud Text-to-Speech · live"
                    : "Browser speech synthesis"
                }
              />
            </dl>

            {data.provenance.advisory.fellBackBecause && (
              <p className="mt-4 border-l-2 border-accent-hazard pl-3 text-2xs leading-relaxed text-accent-hazard">
                A live call was attempted and failed: {data.provenance.advisory.fellBackBecause}
              </p>
            )}

            <a
              href="/console"
              className="group mt-7 inline-flex items-center gap-2.5 text-sm text-text-tertiary transition-colors hover:text-accent-verify"
            >
              Open the console this advisory was derived from
              <IconArrowRight
                size={13}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="label-technical shrink-0">{term}</dt>
      <dd className="readout text-right text-2xs text-text-secondary">{def}</dd>
    </div>
  );
}
