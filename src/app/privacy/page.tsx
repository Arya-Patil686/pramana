import type { Metadata } from "next";
import Link from "next/link";
import { Shell, StatusChip } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Data policy",
  description:
    "What PRAMANA collects, what it never collects, what leaves a national node, and how a citizen contributor can withdraw their data.",
};

/*
   Data policy.

   On most projects this page is boilerplate. Here it is part of the argument:
   the platform's central claim is that sovereignty and citizen privacy can be
   preserved while still sharing a model, and this is where that claim is
   written down in terms someone could hold us to.
*/

const SECTIONS = [
  {
    id: "summary",
    heading: "Summary",
    body: [
      "PRAMĀNA processes environmental measurements, not people. The only personal data it can hold arrives when a citizen voluntarily submits a photograph of the sky, and that pathway is designed so the photograph can be deleted without invalidating any attribution already issued.",
      "This deployment is a demonstration build. It replays historical episodes from public archives, it does not operate a live citizen intake, and it does not set analytics or advertising cookies of any kind.",
    ],
  },
  {
    id: "collected",
    heading: "What is processed",
    list: [
      ["Satellite granules", "Sentinel-5P TROPOMI, MODIS and VIIRS products retrieved from public catalogues. No personal data."],
      ["Reference station readings", "Hourly pollutant concentrations published by CPCB, Thailand PCD and OpenAQ. No personal data."],
      ["Reanalysis meteorology", "ECMWF ERA5 wind and boundary-layer fields. No personal data."],
      ["Citizen photographs", "Only in deployments with intake enabled. Sky imagery, capture timestamp, and coarsened location. Processed for haze features and discarded on request."],
      ["Contributor trust score", "A derived reliability weight weighted against nearby reference stations. Held under a pseudonymous contributor identifier."],
    ],
  },
  {
    id: "never",
    heading: "What is never processed",
    list: [
      ["Precise home location", "Contributor coordinates are coarsened to the grid cell before storage. The original fix is discarded at intake."],
      ["Faces or identifiable subjects", "Submissions containing recognisable people are rejected at intake rather than redacted."],
      ["Contact details", "No email address, telephone number or device identifier is required to contribute."],
      ["Behavioural tracking", "No third-party analytics, no advertising identifiers, no cross-site tracking, no session replay."],
    ],
  },
  {
    id: "node-policy",
    heading: "Node emission policy",
    body: [
      "Each nation operates its own node and declares, in a machine-readable policy file, which artefact classes that node is permitted to emit across a border. The federation is opt-in per class, so a nation may participate in shared model training while emitting no aggregates at all.",
      "Exactly three artefact classes are eligible to cross a boundary: model weight deltas, attribution certificates, and coarse gridded aggregates at or above the node's declared resolution floor. Raw observations are not an eligible class, and there is no configuration that makes them one.",
      "The resolution floor is enforced at the point of emission rather than by agreement. Lowering it is a sovereign decision by the operating nation and is recorded in the node's own audit log.",
    ],
  },
  {
    id: "retention",
    heading: "Retention and withdrawal",
    body: [
      "Certificates are permanent by design. Their whole purpose is that a finding can be re-checked years later, so a certificate is never rewritten or deleted once its Merkle root is published.",
      "Citizen photographs are not permanent. A contributor may withdraw a submission at any time, which deletes the image and removes its contribution from future model rounds. Certificates already issued remain valid: they record the hash of the input that was used at the time, and that hash does not become false because the underlying image was later withdrawn.",
      "This distinction is deliberate. An audit trail that can be quietly edited is not an audit trail, but a person's photograph is theirs to withdraw. Separating the two is what lets both properties hold at once.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    body: [
      "This site sets no cookies. Interface state such as the selected corridor lives in memory for the duration of the page visit and is discarded when the tab closes.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="pb-24">
      <Shell className="pt-12">
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label-technical">Data policy</span>
            <StatusChip tone="neutral">Demonstration build</StatusChip>
          </div>
          <h1 className="mt-4 font-display text-xl font-medium text-text-primary sm:text-2xl">
            What we hold, what we refuse to hold.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            PRAMĀNA argues that pollution attribution can be shared across
            borders without centralising anyone&apos;s raw data. A policy page is
            where that argument stops being architecture and becomes a
            commitment.
          </p>
          <p className="readout mt-5 text-2xs text-text-quaternary">
            Version 1.0.0 · schema brics-airshed/1.0.0
          </p>
        </header>

        {/* Contents */}
        <nav aria-label="Contents" className="panel mt-10 px-4 py-4">
          <div className="label-technical">Contents</div>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-baseline gap-2.5 text-sm text-text-tertiary transition-colors hover:text-text-primary"
                >
                  <span className="readout text-2xs text-text-quaternary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-14">
          {SECTIONS.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-baseline gap-3">
                <span className="readout border border-border-default px-1.5 py-0.5 text-2xs text-accent-verify">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-lg font-medium text-text-primary">
                  {section.heading}
                </h2>
              </div>

              {section.body && (
                <div className="mt-4 max-w-3xl space-y-4">
                  {section.body.map((p, j) => (
                    <p key={j} className="text-md leading-relaxed text-text-secondary">
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {section.list && (
                <dl className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
                  {section.list.map(([term, def]) => (
                    <div key={term} className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[210px_minmax(0,1fr)]">
                      <dt className="text-sm font-medium text-text-primary">{term}</dt>
                      <dd className="text-sm leading-relaxed text-text-secondary">{def}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-border-subtle pt-8">
          <p className="text-sm text-text-secondary">
            Related:{" "}
            <Link href="/terms" className="text-accent-verify underline decoration-accent-verify-dim underline-offset-2">
              Terms of use
            </Link>
            {", "}
            <Link href="/federation" className="text-accent-verify underline decoration-accent-verify-dim underline-offset-2">
              federation topology
            </Link>
            {", and the "}
            <Link href="/validation#schema" className="text-accent-verify underline decoration-accent-verify-dim underline-offset-2">
              node policy schema
            </Link>
            .
          </p>
        </div>
      </Shell>
    </div>
  );
}
