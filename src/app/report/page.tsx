import type { Metadata } from "next";
import Link from "next/link";
import { ReportComposer } from "@/components/report/report-composer";
import { SectionHeader, Shell } from "@/components/ui/primitives";
import { Reveal } from "@/components/scroll/parallax";
import { IconArrowRight } from "@/components/icons";
import { listReports } from "@/lib/reports-store";

export const metadata: Metadata = {
  title: "File a report",
  description:
    "Photograph the sky. Gemini reads it into a bounded observation, and the corroboration rule decides what it is worth to the register.",
};

export const dynamic = "force-dynamic";

/*
   The citizen surface.

   The challenge asks for citizen-sourced data fused with satellite and
   meteorological inputs. This is where the citizen half enters, and the design
   problem it solves is not capture — a phone can already take a photograph —
   it is weighting. Crowd-sourced environmental data is trivially gameable, and
   an attribution register that a state will be asked to answer for cannot rest
   on evidence that one motivated person can move. So the reading is bounded,
   the caveats are mandatory, and weight comes from independent agreement
   rather than from the model's own certainty.
*/
export default function ReportPage() {
  const recent = listReports(6);
  const usable = recent.filter((r) => r.observation.usable);

  return (
    <>
      <section className="border-b border-border-subtle py-16 lg:py-20">
        <Shell>
          <SectionHeader
            index="01"
            kicker="Citizen observation"
            title="A monitor costs ₹12 lakh. A photograph costs nothing."
            lede={
              <>
                India has roughly 1,400 continuous ambient monitors for 1.4
                billion people, and they cluster in the cities that could afford
                them. The gap is not going to be closed by procurement. It can be
                narrowed by the phones already in the corridor — provided a
                photograph is treated as what it is, which is one weak
                observation that earns its weight by agreeing with others.
              </>
            }
          />
        </Shell>
      </section>

      <section className="border-b border-border-subtle">
        <Shell wide className="py-0">
          <ReportComposer />
        </Shell>
      </section>

      {/* What happens to a report after it is filed. */}
      <section className="border-b border-border-subtle py-20">
        <Shell>
          <SectionHeader
            index="02"
            kicker="What happens next"
            title="From one photograph to a line in the register."
          />

          <ol className="mt-12 grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Gemini reads the frame",
                body: "Sky is segmented from ground, optical depth is estimated from visibility and colour cast, and any plume structure is measured for bearing. The output is a band and a confidence, never a number.",
              },
              {
                step: "02",
                title: "The report is placed",
                body: "Coordinates resolve to a tehsil, which is the unit the attribution register aggregates on. A report that falls outside the corridor is stored but not registered.",
              },
              {
                step: "03",
                title: "Corroboration sets the weight",
                body: "One report is capped at 0.35 of the model's confidence. Independent reports from the same tehsil, agreeing on severity within three hours, lift it toward — never above — that confidence.",
              },
              {
                step: "04",
                title: "It joins the evidence chain",
                body: "The weighted observation enters the receptor field alongside station readings and satellite retrievals, and its digest is sealed into the episode certificate like every other input.",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 0.05}>
                <li className="flex h-full flex-col bg-bg-base p-6">
                  <span className="readout border border-border-default px-1.5 py-0.5 text-2xs text-accent-verify self-start">
                    {s.step}
                  </span>
                  <h3 className="mt-4 font-display text-md font-medium text-text-primary">
                    {s.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-secondary">
                    {s.body}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>

          <p className="mt-10 max-w-2xl border-l-2 border-accent-verify pl-6 font-display text-lg leading-snug text-text-primary">
            The hard problem in citizen sensing was never collection. It is
            building a register that stays credible when someone has a reason to
            corrupt it.
          </p>
        </Shell>
      </section>

      {/* The live register. */}
      <section className="py-20">
        <Shell>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              index="03"
              kicker="Register"
              title="Reports filed on this node."
            />
            <span className="label-technical">
              {recent.length} held · {usable.length} weighted
            </span>
          </div>

          {recent.length === 0 ? (
            <p className="mt-10 max-w-xl text-sm leading-relaxed text-text-tertiary">
              Nothing has been filed on this node yet. File the first report
              above and it will appear here, with the weight the corroboration
              rule assigns it.
            </p>
          ) : (
            <div className="mt-10 divide-y divide-border-subtle border-y border-border-subtle">
              {recent.map((r) => (
                <div
                  key={r.id}
                  className="grid gap-3 py-4 sm:grid-cols-[9rem_1fr_5rem] sm:items-baseline sm:gap-6"
                >
                  <div>
                    <div className="readout text-2xs text-accent-verify">{r.id}</div>
                    <div className="mt-1 text-2xs text-text-quaternary">
                      {r.tehsil ?? "Outside corridor"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm capitalize text-text-primary">
                      {r.observation.usable
                        ? `${r.observation.hazeDensity} haze · ${r.observation.probableSourceClass}`
                        : "Not usable"}
                    </div>
                    <div className="mt-1 line-clamp-1 text-2xs text-text-tertiary">
                      {r.note ?? r.observation.reasoning}
                    </div>
                  </div>
                  <div className="readout text-md text-text-secondary sm:text-right">
                    {r.weight.toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-8 text-2xs leading-relaxed text-text-quaternary">
            This register is held in the running process, which is the correct
            scope for a prototype and is stated rather than disguised: restarting
            the node empties it. The production target is Firestore, and the
            document shape is already the shape written here.
          </p>

          <Link
            href="/console"
            className="group mt-10 inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent-verify hover:text-accent-verify"
          >
            See how weighted reports enter the operator console
            <IconArrowRight
              size={13}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </Link>
        </Shell>
      </section>
    </>
  );
}
