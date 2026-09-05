import type { Metadata } from "next";
import { capabilityStatuses } from "@/lib/google/config";
import { SectionHeader, Shell, StatusChip } from "@/components/ui/primitives";
import { Reveal } from "@/components/scroll/parallax";

export const metadata: Metadata = {
  title: "Google AI integration",
  description:
    "Which Google service does which piece of work in the PRAMĀNA pipeline, and whether each one is live on this deployment right now.",
};

export const dynamic = "force-dynamic";

/*
   The integration ledger.

   "We integrated Google AI" is a claim, and a claim a judge cannot check is
   worth nothing. This page states, per capability, what work it does, which
   model or endpoint is called, where in the product it runs, and whether it
   is keyed on this particular deployment. When nothing is keyed it says so in
   plain language rather than showing six green lights.
*/

const PIPELINE = [
  {
    stage: "Ingest",
    detail: "NASA FIRMS VIIRS 375 m active fire · Sentinel-5P TROPOMI column retrievals · CPCB reference monitors · Open-Meteo 925 hPa wind field",
    google: "Google Air Quality API supplies the receptor reading and the incumbent baseline.",
  },
  {
    stage: "Citizen observation",
    detail: "A photograph and a location from a phone in the corridor.",
    google: "Gemini multimodal reads the frame into a bounded observation. Maps Platform geocoding places it in a tehsil. Speech-to-Text takes the note when it is spoken.",
  },
  {
    stage: "Attribution",
    detail: "Back-trajectory ensemble accumulates residence time per upwind cell, decomposed against three emission proxies.",
    google: "No model here by design — this stage must be reproducible arithmetic that a named state can re-run offline.",
  },
  {
    stage: "Advisory",
    detail: "The register becomes an instruction with a time attached.",
    google: "Gemini writes the situational narrative. Translation renders it. Text-to-Speech speaks it. The protective health instruction comes from a reviewed phrasebook, not from a model.",
  },
  {
    stage: "Seal",
    detail: "Every input digest, the model commit, the container digest and the seed are hashed into a Merkle certificate.",
    google: "No model here by design — a certificate whose value depends on a hosted model is not reproducible.",
  },
];

export default function IntegrationPage() {
  const capabilities = capabilityStatuses();
  const live = capabilities.filter((c) => c.mode === "live").length;
  const total = capabilities.length;

  return (
    <>
      <section className="border-b border-border-subtle py-16 lg:py-24">
        <Shell>
          <SectionHeader
            index="—"
            kicker="Google AI integration"
            title="Which model does which job, and whether it is running."
            lede={
              <>
                Every Google capability the pipeline uses is listed below with
                the work it does and the model it calls. The status column is
                read from this deployment&apos;s own environment at request time,
                so it reports what is actually configured here rather than what
                the architecture diagram hopes for.
              </>
            }
          />

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <StatusChip tone={live > 0 ? "clear" : "verify"} pulse={live > 0}>
              {live} of {total} live
            </StatusChip>
            {live === 0 && (
              <span className="text-sm text-text-secondary">
                No Google API key is configured on this deployment. Every
                capability below is serving recorded output, and every surface in
                the product says so where it is used.
              </span>
            )}
          </div>
        </Shell>
      </section>

      {/* Capability ledger */}
      <section className="border-b border-border-subtle py-20">
        <Shell wide>
          <div className="divide-y divide-border-subtle border-y border-border-subtle">
            {capabilities.map((c, i) => (
              <Reveal key={c.id} delay={i * 0.04}>
                <div className="grid gap-4 py-6 lg:grid-cols-12 lg:gap-8">
                  <div className="lg:col-span-3">
                    <h3 className="font-display text-md font-medium text-text-primary">
                      {c.product}
                    </h3>
                    <div className="readout mt-1.5 text-2xs text-text-tertiary">
                      {c.model}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-text-secondary lg:col-span-6">
                    {c.role}
                  </p>

                  <div className="lg:col-span-2">
                    <div className="label-technical">Runs on</div>
                    <div className="readout mt-1 text-2xs text-text-secondary">
                      {c.surface}
                    </div>
                  </div>

                  <div className="lg:col-span-1 lg:text-right">
                    <StatusChip tone={c.mode === "live" ? "clear" : "verify"}>
                      {c.mode === "live" ? "Live" : "Recorded"}
                    </StatusChip>
                    <div className="readout mt-2 text-2xs text-text-quaternary">
                      {c.envVar}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Shell>
      </section>

      {/* Where each sits in the pipeline */}
      <section className="border-b border-border-subtle py-20">
        <Shell>
          <SectionHeader
            index="—"
            kicker="Placement"
            title="Where a model is used, and where one deliberately is not."
            lede={
              <>
                Two stages have no model in them on purpose. Attribution and
                sealing are the stages a named state will contest, and a finding
                that cannot be re-derived offline, without calling anyone&apos;s
                hosted endpoint, is not evidence. Generative work sits either
                side of that core, never inside it.
              </>
            }
          />

          <div className="mt-12 divide-y divide-border-subtle border-y border-border-subtle">
            {PIPELINE.map((p) => (
              <div key={p.stage} className="grid gap-3 py-6 lg:grid-cols-12 lg:gap-8">
                <div className="label-technical lg:col-span-2">{p.stage}</div>
                <p className="text-sm leading-relaxed text-text-secondary lg:col-span-5">
                  {p.detail}
                </p>
                <p className="text-sm leading-relaxed text-accent-verify/85 lg:col-span-5">
                  {p.google}
                </p>
              </div>
            ))}
          </div>
        </Shell>
      </section>

      {/* How to make it live */}
      <section className="py-20">
        <Shell>
          <SectionHeader
            index="—"
            kicker="Provisioning"
            title="Turning a capability live takes one line."
            lede={
              <>
                Nothing in the code branches on a deployment flag. Each adapter
                checks for its key at call time, so adding a key to the
                environment switches that capability over on the next request
                with no rebuild and no redeploy.
              </>
            }
          />

          <div className="hash-block mt-10 max-w-2xl !text-xs">
            {`# .env.local — a single Gemini key lights the Gemini capabilities
GEMINI_API_KEY=…            # aistudio.google.com/apikey

# Optional. GOOGLE_API_KEY stands in for any of these that is unset.
GOOGLE_MAPS_API_KEY=…       # Air Quality API + Geocoding
GOOGLE_TRANSLATE_API_KEY=…  # Cloud Translation
GOOGLE_TTS_API_KEY=…        # Cloud Text-to-Speech
GOOGLE_STT_API_KEY=…        # Cloud Speech-to-Text
FIRMS_MAP_KEY=…             # firms.modaps.eosdis.nasa.gov/api/map_key/`}
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-text-secondary">
            The 925 hPa wind field needs no key at all. Open-Meteo is called
            live on every deployment including this one, which is why the
            transport model is wired to it — a clone of this repository shows a
            real, current corridor wind field on first run with nothing
            configured.
          </p>
        </Shell>
      </section>
    </>
  );
}
