import Link from "next/link";
import { Hero } from "@/components/sections/hero";
import { ContributionRegister } from "@/components/figures/contribution-register";
import { SealVerifier } from "@/components/figures/seal-verifier";
import { ParallaxLayer, Reveal, ScrollRail } from "@/components/scroll/parallax";
import { SectionHeader, Shell } from "@/components/ui/primitives";
import {
  IconArrowRight,
  IconConsole,
  IconCounterfactual,
  IconFederation,
  IconValidation,
} from "@/components/icons";
import { EPISODES } from "@/data/mock-episodes";
import { CERTIFICATES } from "@/data/mock-certificates";
import { CapabilityMatrix } from "@/components/figures/capability-matrix";
import { CorridorSequence } from "@/components/sections/corridor-sequence";
import { fetchFireDetections } from "@/lib/sources/firms";

const episode = EPISODES[0];
const certificate = CERTIFICATES[0];

const NEXT_SURFACES = [
  {
    href: "/console",
    icon: IconConsole,
    label: "Operator console",
    body: "The live surface: forecast against three baselines, the airshed flow map, and the attribution panel an operator actually watches during an episode.",
  },
  {
    href: "/counterfactual",
    icon: IconCounterfactual,
    label: "Counterfactual simulator",
    body: "Suppress named source cells and re-run the forecast. Returns the projected peak delta, the GRAP stage avoided, and exposure-hours averted.",
  },
  {
    href: "/validation",
    icon: IconValidation,
    label: "Validation protocol",
    body: "Detection skill, lead time and peak error against persistence, climatology and the Google Air Quality API, including the cases where we lose.",
  },
  {
    href: "/federation",
    icon: IconFederation,
    label: "Federation topology",
    body: "What crosses a border and what does not. Weight deltas and certificates move; raw monitoring data never leaves the node that collected it.",
  },
];

export default async function OverviewPage() {
  /* Real detections when a FIRMS key is present, the recorded 2 November
     episode otherwise. Either way the sequence is drawn from acquisition
     records rather than from placed markers. */
  const fires = await fetchFireDetections();

  return (
    <>
      <ScrollRail label="Airshed overview" />
      <Hero />

      {/* ── 01 · The gap ─────────────────────────────── */}
      <section className="border-b border-border-subtle py-24 lg:py-32">
        <Shell>
          <SectionHeader
            index="01"
            kicker="What already exists"
            title="Displaying pollution has never been the blocker."
            lede={
              <>
                Four mature capability clusters already operate over this
                airshed. Each is good at what it does. None of them answers the
                question a minister actually has to settle, which is whose
                emissions are in the receptor city tonight and by how much.
              </>
            }
          />

          <Reveal className="mt-14 block">
            <ParallaxLayer speed={-14}>
              <CapabilityMatrix />
            </ParallaxLayer>
          </Reveal>

          <Reveal>
            <p className="mt-12 max-w-2xl border-l-2 border-accent-verify pl-6 font-display text-lg leading-snug text-text-primary">
              Coordination does not fail because the data is missing. It fails
              because attribution across a political boundary is contested,
              unverifiable, and arrives months later in a journal.
            </p>
          </Reveal>
        </Shell>
      </section>

      {/* ── 02 · Detection and transport ─────────────── */}
      {/*
         The static figure that used to sit here is now the pinned corridor
         flight: one scroll-scrubbed shot from ignition to the register. The
         figure itself still lives on the console, where an operator needs to
         scrub a timeline rather than watch a sequence.
      */}
      <CorridorSequence detections={fires.detections} />

      {/* ── 03 · Attribution ─────────────────────────── */}
      <section className="border-b border-border-subtle py-24 lg:py-32">
        <Shell wide>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <ParallaxLayer speed={-18}>
                <ContributionRegister episode={episode} />
              </ParallaxLayer>
            </div>

            <div className="lg:col-span-5">
              <ParallaxLayer speed={30}>
                <SectionHeader
                  index="03"
                  kicker="Attribution"
                  title="A contribution register, resolved to the tehsil."
                  lede={
                    <>
                      An ensemble of back-trajectories accumulates residence
                      time per upwind cell, then decomposes that field against
                      three emission proxies. The output aggregates cleanly from
                      cell to tehsil to district to state.
                    </>
                  }
                />

                <dl className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
                  {[
                    {
                      term: "Biomass proxy",
                      def: "VIIRS and MODIS Fire Radiative Power aggregated per 0.1° cell from NASA FIRMS, roughly three hours behind real time.",
                    },
                    {
                      term: "Industrial proxy",
                      def: "Sentinel-5P TROPOMI SO₂ and NO₂ column anomaly against a rolling 30-day per-cell baseline.",
                    },
                    {
                      term: "Urban proxy",
                      def: "Night-lights and road-density weighted NO₂ residual, which is what remains once biomass and industry are removed.",
                    },
                  ].map((row) => (
                    <div key={row.term} className="py-4">
                      <dt className="label-technical">{row.term}</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-text-secondary">
                        {row.def}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-6 text-2xs leading-relaxed text-text-quaternary">
                  The literature runs this retrospectively, on one receptor, one
                  pollutant, one season. The contribution here is running it
                  live, on multiple receptors, decomposed by emission class, and
                  serving it as an API.
                </p>
              </ParallaxLayer>
            </div>
          </div>
        </Shell>
      </section>

      {/* ── 04 · The proof ───────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border-subtle py-24 lg:py-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(80% 55% at 50% 0%, rgba(227,168,78,0.09), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <Shell>
          <SectionHeader
            index="04"
            kicker="The proof"
            title="Trust is not a posture. It is an engineering deliverable."
            lede={
              <>
                Cross-border attribution is not fundamentally a data problem. It
                is a trust problem. Every figure PRAMĀNA emits is sealed into a
                certificate carrying the digest of each input granule, the model
                commit, the container digest and the random seed. The state
                being named can re-run it.
              </>
            }
            align="center"
            className="mx-auto"
          />

          <div className="mt-14 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SealVerifier certificate={certificate} />
            </div>

            <div className="lg:col-span-5">
              <ParallaxLayer speed={26}>
                <div className="panel bezel p-5">
                  <div className="label-technical">Certificate</div>
                  <div className="readout mt-2 text-md text-accent-verify">
                    {certificate.id}
                  </div>

                  <dl className="mt-5 space-y-3.5">
                    {[
                      ["Issued", certificate.issuedAt.replace("T", " ").slice(0, 16) + "Z"],
                      ["Expires", certificate.expiresAt.slice(0, 10)],
                      ["Pipeline", certificate.pipelineVersion],
                      ["Model commit", certificate.modelCommit.slice(0, 12) + "…"],
                      ["Branch", certificate.modelBranch],
                      ["Schema", `attribution-certificate/${certificate.version}`],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-baseline justify-between gap-4 border-b border-border-subtle pb-3.5 last:border-0 last:pb-0"
                      >
                        <dt className="label-technical">{k}</dt>
                        <dd className="readout truncate text-2xs text-text-secondary">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-5">
                    <div className="label-technical">Container digest</div>
                    <div className="hash-block mt-1.5">
                      {certificate.containerDigest}
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-relaxed text-text-secondary">
                    {certificate.reproducibilityStatement}
                  </p>

                  <Link
                    href="/certificate"
                    className="group mt-6 inline-flex items-center gap-2.5 border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:border-accent-verify hover:text-accent-verify"
                  >
                    Open the full certificate
                    <IconArrowRight
                      size={13}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </ParallaxLayer>
            </div>
          </div>
        </Shell>
      </section>

      {/* ── 05 · Continue ────────────────────────────── */}
      <section className="py-24 lg:py-32">
        <Shell>
          <SectionHeader
            index="05"
            kicker="Continue"
            title="From evidence to enforcement."
            lede="Attribution is only useful if something can be done with it. These are the surfaces that turn a contribution register into an action a regulator can defend."
          />

          <div className="mt-12 grid gap-px bg-border-subtle sm:grid-cols-2">
            {NEXT_SURFACES.map(({ href, icon: Icon, label, body }, i) => (
              <Reveal key={href} delay={i * 0.05}>
                <Link
                  href={href}
                  className="group flex h-full flex-col bg-bg-base p-7 transition-colors hover:bg-bg-surface"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={16}
                      className="text-text-tertiary transition-colors group-hover:text-accent-verify"
                    />
                    <h3 className="font-display text-md font-medium text-text-primary">
                      {label}
                    </h3>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">
                    {body}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm text-text-tertiary transition-colors group-hover:text-accent-verify">
                    Open
                    <IconArrowRight
                      size={13}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </Shell>
      </section>
    </>
  );
}
