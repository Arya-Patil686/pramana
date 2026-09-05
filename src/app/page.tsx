import Link from "next/link";
import { Story, type LiveConditions } from "@/components/sections/story";
import { Frond, Shrub, Station, Cloud } from "@/components/illustration/parts";
import { fetchWindField, episodeWindField } from "@/lib/sources/meteo";
import { fetchFireDetections } from "@/lib/sources/firms";
import { computeAttribution } from "@/lib/attribution/engine";
import { placeByCentroid } from "@/lib/sources/geocode";

/*
   The airshed overview.

   Six drawn scenes carry the whole argument, then the surfaces that act on
   it. The numbers inside the story are fetched here rather than written into
   the copy: the wind speed in scene three is the real 925 hPa flow over the
   corridor at the moment the page is served, and the fire count in scene two
   is the real detection count when a FIRMS key is present. A story that
   quotes live instruments is a different kind of claim from one that quotes
   itself.
*/

export const revalidate = 600;

const SURFACES = [
  {
    href: "/report",
    label: "File a report",
    body: "Photograph the sky. Gemini reads it into a bounded observation, and corroboration from your neighbours decides what it is worth.",
    tint: "var(--color-flat-mustard)",
  },
  {
    href: "/console",
    label: "Operator console",
    body: "The surface an officer watches during an episode: forecast against three baselines, the corridor flow, and the attribution panel.",
    tint: "var(--color-flat-teal)",
  },
  {
    href: "/advisory",
    label: "Advisory and alert",
    body: "The register becomes an instruction with a time on it, spoken in the languages of the corridor, plus the notice that crosses a state line.",
    tint: "var(--color-flat-coral)",
  },
  {
    href: "/certificate",
    label: "Inspect a certificate",
    body: "Every figure is sealed with the digest of each input granule, the model commit and the seed. Re-run it and check the root yourself.",
    tint: "var(--color-flat-cream)",
  },
  {
    href: "/counterfactual",
    label: "Counterfactual",
    body: "Suppress named source cells and re-run the forecast. Returns the peak delta, the stage avoided and the exposure-hours averted.",
    tint: "var(--color-flat-cream)",
  },
  {
    href: "/validation",
    label: "Validation",
    body: "Detection skill, lead time and peak error against persistence, climatology and the Google Air Quality API — including where we lose.",
    tint: "var(--color-flat-cream)",
  },
];

export default async function OverviewPage() {
  const [wind, fires] = await Promise.all([fetchWindField(), fetchFireDetections()]);

  /*
     Scene four quotes a transport time and a leading source. Both are the
     model's own output over the recorded episode, not numbers typed into the
     copy — if the engine changes, the story changes with it.
  */
  const replay = computeAttribution(
    fires.detections,
    episodeWindField(),
    { name: "Delhi", lat: 28.6469, lng: 77.3162 },
    placeByCentroid,
    "Delhi"
  );

  /* The corridor's mid-point sample is the one the story quotes: it is the
     transport leg, rather than conditions sitting over either endpoint. */
  const mid = wind.samples[Math.floor(wind.samples.length / 2)];

  const live: LiveConditions = {
    windSpeed: mid?.speed ?? 4.9,
    bearing: mid?.bearingTo ?? 118,
    windLive: wind.live,
    fireCount: fires.detections.length,
    firesLive: fires.live,
    transportHours: replay.peakTransportHours,
    topSource: replay.byTehsil[0]?.tehsil ?? null,
    topSharePct: replay.byTehsil[0]?.contributionPct ?? 0,
  };

  return (
    <>
      <Story live={live} />

      {/* ── Where to go next ────────────────────────────── */}
      <section className="scene paper-grain bg-[var(--color-paper-deep)] py-24">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Cloud className="absolute left-[-4%] top-[6%] w-[clamp(120px,18vw,280px)] text-[var(--color-paper)]" />
          <Frond className="absolute bottom-0 left-[2%] w-[clamp(50px,7vw,110px)] text-[var(--color-flat-leaf)] opacity-30" />
          <Frond className="absolute bottom-0 right-[2%] w-[clamp(50px,7vw,110px)] text-[var(--color-flat-leaf)] opacity-30" flip />
          <Station className="absolute bottom-[8%] right-[9%] w-[clamp(46px,6vw,84px)] text-[var(--color-ink)] opacity-20" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
          <div className="kicker kicker-rule text-[var(--color-ink-soft)]">
            <span>The instrument</span>
          </div>
          <h2 className="poster mt-5 text-center text-[clamp(1.7rem,4vw,2.9rem)] text-[var(--color-ink)]">
            Six surfaces, one chain of evidence.
          </h2>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SURFACES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="card-flat group flex flex-col p-6 transition-transform duration-150 hover:-translate-y-1"
                style={{ background: s.tint }}
              >
                <h3 className="poster text-[1.05rem] text-[var(--color-ink)]">{s.label}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {s.body}
                </p>
                <span className="poster mt-5 inline-flex items-center gap-2 text-xs text-[var(--color-ink)]">
                  Open
                  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                    <path d="M0 5h14M10 1l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Shrub className="w-[clamp(60px,8vw,110px)] text-[var(--color-flat-leaf)] opacity-40" />
          </div>
        </div>
      </section>
    </>
  );
}
