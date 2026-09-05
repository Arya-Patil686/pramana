import type { Metadata } from "next";
import { AdvisoryPanel } from "@/components/advisory/advisory-panel";
import { AlertDraft } from "@/components/alert/alert-draft";
import { SectionHeader, Shell } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Advisory and alert",
  description:
    "The attribution register becomes an instruction with a time attached — spoken in the languages of the corridor, and drafted as a notice the named state can verify.",
};

/*
   Attribution is only worth anything if something happens because of it. This
   page is the "so what": the register becomes a public health instruction in
   the languages actually spoken along the corridor, and a formal notice to the
   state being named — one that leads with the fact that it can be checked
   rather than asking to be believed.
*/
export default function AdvisoryPage() {
  return (
    <>
      <section className="border-b border-border-subtle py-16 lg:py-20">
        <Shell>
          <SectionHeader
            index="03"
            kicker="Advisory"
            title="A warning nobody can read is not a warning."
            lede={
              <>
                Delhi issues its air quality advisories in English on a web
                portal. The people worst exposed along this corridor are outdoor
                workers who read Punjabi, Hindi or Urdu, and often do not read at
                all. The instruction below is spoken, not merely translated, and
                the health text comes from a reviewed phrasebook rather than
                from a model improvising medicine in a language no reviewer here
                can check.
              </>
            }
          />
        </Shell>
      </section>

      <section className="border-b border-border-subtle py-14">
        <Shell wide>
          <AdvisoryPanel />
        </Shell>
      </section>

      <section className="py-16 lg:py-20">
        <Shell wide>
          <SectionHeader
            index="04"
            kicker="Cross-border notice"
            title="The document that crosses a state line."
            lede={
              <>
                An attribution finding that names Punjab has to survive Punjab
                reading it. The notice leads with the certificate id and the
                reproducibility clause, because the only version of this that
                works is the one where the named party can check the claim
                instead of being asked to accept it.
              </>
            }
            className="mb-12"
          />
          <AlertDraft />
        </Shell>
      </section>
    </>
  );
}
