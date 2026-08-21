import type { Metadata } from "next";
import Link from "next/link";
import { Shell, StatusChip } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Terms governing use of PRAMANA outputs, including the attribution language rules that constrain how a contribution register may be cited.",
};

/*
   Terms.

   The attribution language section is the one that matters. A system that
   names one jurisdiction as the source of another's pollution can be picked
   up and used as an indictment, and the plan's own risk register flags that
   as a high-severity failure. Writing the constraint down is cheap; being
   quoted as having accused someone is not.
*/

const SECTIONS = [
  {
    id: "status",
    heading: "Status of this deployment",
    body: [
      "This is a demonstration build prepared for evaluation. It replays historical pollution episodes from public archives. It is not a live regulatory feed, it is not connected to any statutory enforcement mechanism, and no figure shown here should be relied upon for an operational decision.",
      "Where a figure is derived under stated assumptions, those assumptions are printed alongside it. Where a figure is a modelled estimate, it is shown with its interval. A number without an interval on this site is a count, not an estimate.",
    ],
  },
  {
    id: "language",
    heading: "Attribution language rules",
    body: [
      "PRAMĀNA emits a contribution register. It does not emit a finding of fault, a determination of liability, or an allegation against any jurisdiction, community, industry or individual.",
      "These rules bind us, and we ask that anyone citing an output observes them too:",
    ],
    rules: [
      [
        "Contribution, not blame",
        "An output states the modelled share of a receptor's excess associated with an upwind cell. It does not state that anyone acted unlawfully. Use \"contribution\", \"share\", \"associated with\". Do not use \"caused by\", \"responsible for\", \"guilty of\".",
      ],
      [
        "Always with the interval",
        "No contribution figure may be cited without its confidence interval. \"23.4%\" is a misquotation of \"23.4% ± 4.3\". The interval is not a caveat attached to the number; it is part of the number.",
      ],
      [
        "Aggregate, do not single out",
        "Outputs resolve to the tehsil because the atmosphere does, not so that individual farmers can be identified. Outputs must not be used to target, penalise or publicly identify a named individual or household.",
      ],
      [
        "Evidence for joint action",
        "The intended use is to support coordinated intervention between jurisdictions. Citing an output to support unilateral punitive action against a neighbouring jurisdiction is a misuse of it.",
      ],
      [
        "Report the failures too",
        "Any citation of PRAMĀNA's performance must include the metrics on which the baselines beat it. Those are published and are not to be omitted from a favourable summary.",
      ],
    ],
  },
  {
    id: "reuse",
    heading: "Reuse and licensing",
    body: [
      "The interop schema, the OpenAPI description and the conformance suite are published under a permissive licence so that any nation can implement a conforming node without adopting this implementation.",
      "Upstream data carries the licence of its originator. NASA FIRMS products are open data; Copernicus Sentinel-5P products are governed by the Copernicus licence; CPCB data is published under the Government Open Data Licence for India; OpenAQ aggregates are CC BY 4.0. Anyone redistributing derived outputs remains bound by those upstream terms, which are listed in the footer of every page.",
    ],
  },
  {
    id: "certificates",
    heading: "Certificates and verification",
    body: [
      "A certificate asserts one thing: that the stated inputs, processed by the stated code in the stated container, produce the stated contribution vector. It does not assert that the inputs are themselves correct, nor that the model is the right model.",
      "Verification reproduces the computation. It does not validate the science. A certificate that verifies cleanly against a flawed model faithfully reproduces a flawed result, and the value of publishing the model pin is precisely that the flaw becomes locatable.",
    ],
  },
  {
    id: "warranty",
    heading: "No warranty",
    body: [
      "The platform and its outputs are provided as-is, without warranty of any kind, express or implied. No liability is accepted for any decision taken on the basis of an output, and no output constitutes legal, medical or regulatory advice.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="pb-24">
      <Shell className="pt-12">
        <header className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label-technical">Terms of use</span>
            <StatusChip tone="neutral">Demonstration build</StatusChip>
          </div>
          <h1 className="mt-4 font-display text-xl font-medium text-text-primary sm:text-2xl">
            A register of contributions, not an accusation.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            A system that names one jurisdiction as the upwind source of
            another&apos;s pollution can very easily be picked up and used as an
            indictment. These terms set out how PRAMĀNA outputs may be cited,
            and the language discipline we hold ourselves to.
          </p>
          <p className="readout mt-5 text-2xs text-text-quaternary">
            Version 1.0.0
          </p>
        </header>

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

              <div className="mt-4 max-w-3xl space-y-4">
                {section.body.map((p, j) => (
                  <p key={j} className="text-md leading-relaxed text-text-secondary">
                    {p}
                  </p>
                ))}
              </div>

              {section.rules && (
                <ol className="mt-6 divide-y divide-border-subtle border-y border-border-subtle">
                  {section.rules.map(([title, detail], j) => (
                    <li key={title} className="grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[210px_minmax(0,1fr)]">
                      <div className="flex items-baseline gap-2.5">
                        <span className="readout text-2xs text-accent-verify">
                          R{j + 1}
                        </span>
                        <h3 className="text-sm font-medium text-text-primary">
                          {title}
                        </h3>
                      </div>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {detail}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>

        <div className="mt-14 border-t border-border-subtle pt-8">
          <p className="text-sm text-text-secondary">
            Related:{" "}
            <Link href="/privacy" className="text-accent-verify underline decoration-accent-verify-dim underline-offset-2">
              Data policy
            </Link>
            {", "}
            <Link href="/validation#failures" className="text-accent-verify underline decoration-accent-verify-dim underline-offset-2">
              known failure modes
            </Link>
            .
          </p>
        </div>
      </Shell>
    </div>
  );
}
