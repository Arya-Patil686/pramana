import type { Metadata } from "next";
import { BENCHMARKS, HONESTY_CALLOUTS } from "@/data/mock-benchmarks";
import { Shell, StatusChip } from "@/components/ui/primitives";
import { IconDivergent, IconSealed } from "@/components/icons";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Validation protocol",
  description:
    "Detection skill, warning lead time and peak error for PRAMANA against persistence, climatology and the Google Maps Platform Air Quality API, including the cases where the baselines win.",
};

/*
   Validation.

   The section that decides whether a technical reviewer believes the rest of
   the site. Two rules govern it: every number is shown against a control, and
   the cases where a baseline beats us get their own section rather than a
   footnote. A team that cannot name its failure modes has not measured them.
*/

const COMPETITORS = [
  { key: "pramana", label: "PRAMĀNA", colour: "var(--color-accent-verify)" },
  { key: "googleAQ", label: "Google AQ", colour: "var(--color-accent-signal)" },
  { key: "persistence", label: "Persistence", colour: "#8e9aab" },
  { key: "climatology", label: "Climatology", colour: "var(--color-text-tertiary)" },
] as const;

const SCHEMA_ARTEFACTS = [
  {
    name: "observation.schema.json",
    detail: "Harmonised station and satellite observation record on the common 0.1° grid",
    version: "1.0.0",
  },
  {
    name: "contribution-vector.schema.json",
    detail: "Per-receptor contribution register with bootstrap intervals and emission class",
    version: "1.0.0",
  },
  {
    name: "attribution-certificate.schema.json",
    detail: "Provenance block, Merkle leaves, model pin, container digest",
    version: "1.0.0",
  },
  {
    name: "node-policy.schema.json",
    detail: "Per-nation declaration of which artefact classes may cross the border",
    version: "0.9.0",
  },
  {
    name: "openapi.yaml",
    detail: "OpenAPI 3.1 description of the node API, including the verify endpoint",
    version: "3.1",
  },
];

export default function ValidationPage() {
  return (
    <div className="pb-24">
      <Shell className="pt-12">
        <header className="max-w-3xl">
          <div className="label-technical">Validation protocol</div>
          <h1 className="mt-3 font-display text-xl font-medium text-text-primary sm:text-2xl">
            Measured against a control, including where we lose.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            Complete post-monsoon episodes are replayed with the information
            state reconstructed at each forecast issue time, so no future data
            leaks backwards. Every metric is scored against three baselines:
            persistence, seasonal climatology, and the Google Maps Platform Air
            Quality API 96-hour forecast.
          </p>
          <p className="mt-4 border border-[var(--color-ink-hair)] bg-bg-void px-3.5 py-2.5 text-sm leading-relaxed text-text-secondary">
            <span className="label-technical mr-2">Illustrative</span>
            This page sets out the validation protocol. The scores shown are
            placeholder figures that show how results will be reported; the
            back-test has not been run yet. It is the first item on the roadmap.
          </p>
        </header>

        {/* Benchmarks */}
        <div className="mt-12 space-y-10">
          {BENCHMARKS.map((group) => (
            <section key={group.category}>
              <h2 className="font-display text-lg font-medium text-text-primary">
                {group.category}
              </h2>

              <div className="mt-5 space-y-px bg-border-subtle">
                {group.metrics.map((metric) => {
                  const values = COMPETITORS.map((c) => ({
                    ...c,
                    value: metric[c.key],
                  }));
                  const best =
                    metric.bestIs === "highest"
                      ? Math.max(...values.map((v) => v.value))
                      : Math.min(...values.map((v) => v.value));
                  const scale = Math.max(...values.map((v) => v.value));
                  const pramanaWins = metric.pramana === best;

                  return (
                    <div key={metric.name} className="bg-bg-surface px-4 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <h3 className="text-sm font-medium text-text-primary">
                          {metric.name}
                          <span className="readout ml-2 text-2xs text-text-quaternary">
                            {metric.unit}
                          </span>
                        </h3>
                        <StatusChip tone={pramanaWins ? "clear" : "hazard"}>
                          {pramanaWins ? "Best" : "Baseline wins"}
                        </StatusChip>
                      </div>

                      <p className="mt-2 max-w-2xl text-2xs leading-relaxed text-text-quaternary">
                        {metric.description}
                      </p>

                      <div className="mt-4 space-y-2">
                        {values.map((v) => {
                          const isBest = v.value === best;
                          return (
                            <div
                              key={v.key}
                              className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-3"
                            >
                              <span
                                className={cn(
                                  "readout text-2xs",
                                  isBest ? "text-text-primary" : "text-text-tertiary"
                                )}
                              >
                                {v.label}
                              </span>
                              <div className="h-2.5 bg-bg-inset">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${Math.max(2, (v.value / scale) * 100)}%`,
                                    background: v.colour,
                                    opacity: isBest ? 1 : 0.55,
                                  }}
                                />
                              </div>
                              <span
                                className={cn(
                                  "readout text-right text-2xs",
                                  isBest ? "text-text-primary" : "text-text-tertiary"
                                )}
                              >
                                {v.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="mt-3 text-2xs text-text-quaternary">
                        Lower is better.{" "}
                        {metric.bestIs === "highest" && "Higher is better."}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Where we lose */}
        <section id="failures" className="mt-16 scroll-mt-20">
          <div className="flex items-center gap-3">
            <IconDivergent size={16} className="text-accent-hazard" />
            <h2 className="font-display text-lg font-medium text-text-primary">
              Known failure modes
            </h2>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            These are the metrics on which a baseline beats PRAMĀNA. They are
            reported because a system whose limits are unknown cannot be
            deployed, and because a reviewer will find them anyway.
          </p>

          <div className="mt-6 space-y-px bg-border-subtle">
            {HONESTY_CALLOUTS.map((callout) => (
              <div key={callout.metric} className="bg-bg-surface px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-sm font-medium text-text-primary">
                    {callout.metric}
                  </h3>
                  <div className="flex items-center gap-4">
                    <span className="readout text-2xs text-accent-clear">
                      {callout.winner} {callout.winnerValue}
                    </span>
                    <span className="readout text-2xs text-accent-hazard">
                      PRAMĀNA {callout.pramanaValue}
                    </span>
                  </div>
                </div>
                <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-text-secondary">
                  {callout.explanation}
                </p>
              </div>
            ))}
          </div>

          <div className="panel mt-6 border-l-2 border-accent-hazard p-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              The design trade is deliberate. PRAMĀNA is tuned for episodic,
              transboundary, fire-driven events, where onset lead time carries
              the operational value. On ordinary winter stagnation, a
              general-purpose forecaster with a larger training corpus is the
              better tool, and we would recommend it.
            </p>
          </div>
        </section>

        {/* Reproducibility */}
        <section className="mt-16">
          <div className="flex items-center gap-3">
            <IconSealed size={16} className="text-accent-verify" />
            <h2 className="font-display text-lg font-medium text-text-primary">
              Reproducibility
            </h2>
          </div>
          <div className="mt-6 grid gap-px bg-border-subtle sm:grid-cols-3">
            {[
              { label: "Certificates re-verified", value: "N of N", hint: "Clean container, independent run" },
              { label: "Root divergence", value: "0", hint: "Across the replay corpus" },
              { label: "Corridors, zero code change", value: "2", hint: "India and Thailand nodes" },
            ].map((s) => (
              <div key={s.label} className="bg-bg-surface px-4 py-4">
                <div className="label-technical">{s.label}</div>
                <div className="readout mt-1.5 text-lg text-accent-verify">
                  {s.value}
                </div>
                <div className="mt-1.5 text-2xs text-text-quaternary">{s.hint}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Interop schema */}
        <section id="schema" className="mt-16 scroll-mt-20">
          <h2 className="font-display text-lg font-medium text-text-primary">
            Interoperability artefacts
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            The BRICS Airshed Interop Schema is published as versioned JSON
            Schema with an OpenAPI 3.1 description of the node API and a
            conformance suite, so another nation can validate an independent
            implementation rather than adopt this one.
          </p>

          <div className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
            {SCHEMA_ARTEFACTS.map((a) => (
              <div
                key={a.name}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
              >
                <span className="readout text-sm text-text-primary">{a.name}</span>
                <span className="readout order-last w-full text-2xs text-text-quaternary sm:order-none sm:w-auto sm:flex-1 sm:px-6">
                  {a.detail}
                </span>
                <StatusChip tone="neutral">v{a.version}</StatusChip>
              </div>
            ))}
          </div>

          <p className="mt-5 text-2xs leading-relaxed text-text-quaternary">
            Licensed permissively and mapped against the nine Digital Public
            Goods Standard indicators. The schema is the deliverable; this
            implementation is only one conforming node.
          </p>
        </section>
      </Shell>
    </div>
  );
}
