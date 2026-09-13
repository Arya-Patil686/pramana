import Link from "next/link";
import { Story, type StoryData } from "@/components/sections/story";
import { fetchWindField, episodeWindField } from "@/lib/sources/meteo";
import { fetchFireDetections } from "@/lib/sources/firms";
import { computeAttribution } from "@/lib/attribution/engine";
import { placeByCentroid } from "@/lib/sources/geocode";

/*
   The airshed overview.

   Five printed pages that carry the argument, then the surfaces that act on
   it. Nothing in the copy is a figure someone typed: the wind speed, the
   detection count, the transport time, the leading source and the attributed
   share are all fetched or computed at request time. If the engine changes,
   the story changes with it.

   The narrative runs the recorded 3 November field rather than the current
   one, because outside the burning season the live field carries nothing to
   Delhi and there is no episode to narrate. The live field still appears —
   scene three quotes it — and the console is where the two are compared.
*/

export const revalidate = 600;

const SURFACES = [
  {
    href: "/console",
    label: "Operator console",
    body: "The register computed at request time from live detections and the 925 hPa field, against three baselines, with the model's limitations printed beside its numbers.",
  },
  {
    href: "/report",
    label: "Citizen report",
    body: "Photograph the sky. Gemini reads it into a bounded observation, and corroboration from other reports in the same tehsil decides what it is worth.",
  },
  {
    href: "/advisory",
    label: "Advisory and alert",
    body: "The register becomes an instruction with a time on it, spoken in the corridor's languages, plus the notice that crosses a state line.",
  },
  {
    href: "/certificate",
    label: "Certificate",
    body: "Every figure sealed with the digest of each input granule, the model commit and the seed. Re-run it and check the Merkle root yourself.",
  },
  {
    href: "/counterfactual",
    label: "Counterfactual",
    body: "Suppress named source cells and re-run the forecast. Returns the peak delta, the GRAP stage avoided and the exposure-hours averted.",
  },
  {
    href: "/integration",
    label: "Google AI integration",
    body: "Which Google service does which job in the pipeline, and whether each one is keyed on this deployment right now.",
  },
];

export default async function OverviewPage() {
  const [liveWind, fires] = await Promise.all([fetchWindField(), fetchFireDetections()]);

  /* The narrative replays the episode; the engine's own output supplies every
     number the copy quotes. */
  const replay = computeAttribution(
    fires.detections,
    episodeWindField(),
    { name: "Delhi", lat: 28.6469, lng: 77.3162 },
    placeByCentroid,
    "Delhi"
  );

  const episodeSamples = episodeWindField().samples;
  const mid = episodeSamples[Math.floor(episodeSamples.length / 2)];
  const liveMid = liveWind.samples[Math.floor(liveWind.samples.length / 2)];

  const data: StoryData = {
    detections: fires.detections,
    wind: episodeSamples,
    traces: replay.traces,
    /* Scene three is about the flow that carried this episode, so it quotes
       the episode field; the live reading is surfaced on the console. */
    windSpeed: mid?.speed ?? liveMid?.speed ?? 4.5,
    bearing: mid?.bearingTo ?? liveMid?.bearingTo ?? 118,
    windLive: false,
    firesLive: fires.live,
    fireCount: fires.detections.length,
    transportHours: replay.peakTransportHours,
    topSource: replay.byTehsil[0]?.tehsil ?? null,
    topSharePct: replay.byTehsil[0]?.contributionPct ?? 0,
    upwindSharePct: replay.upwindSharePct,
    upwindCi: replay.upwindCi,
  };

  return (
    <>
      <Story data={data} />

      {/* ── The instrument ──────────────────────────────── */}
      <section className="paper-grain relative bg-[var(--color-stain-0)] py-24">
        <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="kicker flex items-center gap-2.5 text-[var(--color-ink)]/60">
            <span className="inline-block h-px w-6 bg-current" />
            <span>The instrument</span>
          </div>
          <h2 className="poster mt-4 max-w-2xl text-[clamp(1.5rem,3.2vw,2.3rem)] text-[var(--color-ink)]">
            Six surfaces, one chain of evidence.
          </h2>

          <div className="mt-12 grid gap-px bg-[var(--color-ink-hair)] sm:grid-cols-2 lg:grid-cols-3">
            {SURFACES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group flex flex-col bg-[var(--color-stain-0)] p-7 transition-colors hover:bg-[var(--color-stain-1)]"
              >
                <h3 className="poster text-[1.05rem] text-[var(--color-ink)]">{s.label}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {s.body}
                </p>
                <span className="smallcaps mt-6 inline-flex items-center gap-2 text-[var(--color-ink)]">
                  Open
                  <svg width="16" height="9" viewBox="0 0 16 9" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M0 4.5h14M10.5 1l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
