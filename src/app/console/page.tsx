import type { Metadata } from "next";
import Link from "next/link";
import { fetchFireDetections, PUNJAB_HARYANA_BBOX } from "@/lib/sources/firms";
import { fetchWindField, episodeWindField } from "@/lib/sources/meteo";
import { fetchAirQuality } from "@/lib/sources/airquality";
import { placeByCentroid } from "@/lib/sources/geocode";
import { computeAttribution } from "@/lib/attribution/engine";
import { listReports } from "@/lib/reports-store";
import { ArrivalCurve, RegisterBars } from "@/components/figures/register-figures";
import { Shrub, WindArrow } from "@/components/illustration/parts";

export const metadata: Metadata = {
  title: "Operator console",
  description:
    "The register, computed from live fire detections and the 925 hPa wind field rather than recalled from a table.",
};

export const dynamic = "force-dynamic";

/*
   Operator console.

   Everything on this page is computed at request time from the upstreams
   named in the provenance strip. There is no stored register: the fires are
   fetched, the wind is fetched, every detection is advected, and the numbers
   below are what came out. The mode switch changes one input — which wind
   field the model runs on — and nothing else, which is what makes the live
   null result and the episode replay directly comparable.
*/

const RECEPTOR = { name: "Delhi", lat: 28.6469, lng: 77.3162 };

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode: rawMode } = await searchParams;
  const mode = rawMode === "live" ? "live" : "episode";

  const [fires, liveWind, air] = await Promise.all([
    fetchFireDetections(PUNJAB_HARYANA_BBOX, 2),
    fetchWindField("punjab-delhi"),
    fetchAirQuality(RECEPTOR.lat, RECEPTOR.lng),
  ]);
  const wind = mode === "live" ? liveWind : episodeWindField();

  const result = computeAttribution(
    fires.detections,
    wind,
    RECEPTOR,
    placeByCentroid,
    "Delhi"
  );
  const reports = listReports(200).filter((r) => r.observation.usable);

  const meanSpeed =
    wind.samples.reduce((s, w) => s + w.speed, 0) / Math.max(1, wind.samples.length);

  /*
     The share attributed outside Delhi is close to 100% in every run, and
     saying so is not a finding — a thermal satellite only sees biomass, and
     the biomass is all upwind by construction. The discriminating numbers are
     which cell leads the register, and how much of the burning actually
     reaches the receptor on this particular field. Transport strength is the
     fraction of detections that deposit above the noise floor: it separates a
     corridor that is open from one that is merely burning.
  */
  const top = result.byTehsil[0];
  const transportStrength = result.detectionsConsidered
    ? result.detectionsArriving / result.detectionsConsidered
    : 0;
  const weakTransport = transportStrength < 0.35;

  return (
    <div className="pb-24">
      {/* ── Provenance strip ────────────────────────────── */}
      <div className="border-b-2 border-[var(--color-ink)] bg-bg-void">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3 lg:px-10">
          <div className="flex items-stretch border-2 border-[var(--color-ink)]">
            {(["episode", "live"] as const).map((m) => (
              <Link
                key={m}
                href={`/console?mode=${m}`}
                aria-current={mode === m ? "true" : undefined}
                className={`poster px-3.5 py-1.5 text-2xs ${
                  mode === m
                    ? "bg-[var(--color-flat-mustard)] text-[var(--color-ink)]"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {m === "episode" ? "3 Nov episode" : "Live now"}
              </Link>
            ))}
          </div>

          <Upstream label="Fires" live={fires.live} detail={`${fires.detections.length} detections`} />
          <Upstream label="Wind" live={wind.live} detail={`${meanSpeed.toFixed(1)} m/s · 925 hPa`} />
          <Upstream label="Receptor" live={air.live} detail={air.cpcbAqi ? `AQI ${air.cpcbAqi}` : "—"} />

          <span className="ml-auto label-technical">
            Computed {new Date().toISOString().slice(11, 19)}Z
          </span>
        </div>
      </div>

      {/* ── Headline ────────────────────────────────────── */}
      <section className="border-b border-border-subtle py-14">
        <div className="mx-auto w-full max-w-[1500px] px-6 lg:px-10">
          <div className="kicker text-text-tertiary">
            <span>
              {mode === "episode"
                ? "Replay · 3 November 2024, 925 hPa recorded field"
                : "Live · current 925 hPa field"}
            </span>
          </div>

          {result.empty ? (
            <>
              <h1 className="poster mt-5 max-w-4xl text-[clamp(1.6rem,4vw,2.8rem)] text-text-primary">
                Nothing from these fires reaches Delhi on the current wind.
              </h1>
              <p className="mt-6 max-w-2xl text-md leading-relaxed text-text-secondary">
                The model advected all {result.detectionsConsidered} detections
                forward on the field blowing right now, and none of them came
                within reach of the receptor. That is the correct answer, not a
                failure: outside the burning season the flow over Punjab does
                not run toward Delhi, and a system that produced a number anyway
                would be inventing one.
              </p>
              <Link
                href="/console?mode=episode"
                className="btn-flat mt-8 inline-block bg-[var(--color-flat-mustard)] px-6 py-3 text-sm text-[var(--color-ink)]"
              >
                Replay the 3 November episode
              </Link>
            </>
          ) : (
            <>
              <h1 className="poster mt-5 max-w-4xl text-[clamp(1.6rem,4vw,2.8rem)] text-text-primary">
                {weakTransport ? (
                  <>
                    The corridor is barely open. Only{" "}
                    {result.detectionsArriving} of {result.detectionsConsidered}{" "}
                    fires reach Delhi on this field.
                  </>
                ) : (
                  <>
                    {top.tehsil} is the largest single source of Delhi&apos;s
                    biomass load — {top.contributionPct.toFixed(1)}% of it.
                  </>
                )}
              </h1>
              <p className="mt-6 max-w-2xl text-md leading-relaxed text-text-secondary">
                {weakTransport ? (
                  <>
                    The {result.method.transportLevel} flow is not running toward
                    the receptor, so most of what is burning upwind deposits
                    somewhere else. {top.tehsil} still leads what does arrive, at{" "}
                    {top.contributionPct.toFixed(1)}%. A register is only worth
                    acting on when the corridor is actually open, and this one is
                    not.
                  </>
                ) : (
                  <>
                    95% interval {top.ciLow.toFixed(1)}–{top.ciHigh.toFixed(1)}%,
                    from {top.arrivals} arriving{" "}
                    {top.arrivals === 1 ? "puff" : "puffs"} across {top.cells}{" "}
                    cell{top.cells === 1 ? "" : "s"}. In total{" "}
                    {result.detectionsArriving} of {result.detectionsConsidered}{" "}
                    detections deposited at the receptor, peaking{" "}
                    {result.peakTransportHours} hours after the first ignition.
                  </>
                )}
              </p>

              <div className="mt-10 grid gap-px border-2 border-[var(--color-ink)] bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Transport strength"
                  value={`${result.detectionsArriving}/${result.detectionsConsidered}`}
                  hint={`${(transportStrength * 100).toFixed(0)}% of detections deposit at the receptor`}
                />
                <Stat label="Peak transport" value={`${result.peakTransportHours} h`} hint="First ignition to peak arrival" />
                <Stat label="Receptor AQI" value={air.cpcbAqi ? String(air.cpcbAqi) : "—"} hint={air.live ? "Google Air Quality, live" : "Recorded reading"} />
                <Stat label="Citizen reports" value={String(reports.length)} hint="Weighted, this node" />
              </div>
            </>
          )}
        </div>
      </section>

      {!result.empty && (
        <>
          {/* ── The register ────────────────────────────── */}
          <section className="border-b border-border-subtle py-14">
            <div className="mx-auto grid w-full max-w-[1500px] gap-12 px-6 lg:grid-cols-12 lg:px-10">
              <div className="lg:col-span-7">
                <h2 className="poster text-[1.35rem] text-text-primary">
                  Contribution register
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
                  Aggregated from the 0.1° accumulation grid to tehsil. Bars are
                  the point estimate; the lighter span is the 95% interval,
                  which widens where fewer independent puffs arrived.
                </p>
                <RegisterBars rows={result.byTehsil.slice(0, 10)} className="mt-8" />
              </div>

              <div className="lg:col-span-5">
                <h2 className="poster text-[1.35rem] text-text-primary">
                  Arrival at the receptor
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
                  When the deposited load actually turns up, in hours from the
                  first detection. This is the lead time an operator has.
                </p>
                <ArrivalCurve bins={result.arrivalCurve} className="mt-8" />

                <div className="mt-10">
                  <h3 className="poster text-[1.05rem] text-text-primary">By state</h3>
                  <dl className="mt-4 divide-y divide-border-subtle border-y border-border-subtle">
                    {result.byState.map((s) => (
                      <div key={s.state} className="flex items-baseline justify-between gap-4 py-3">
                        <dt className="text-sm text-text-primary">{s.state}</dt>
                        <dd className="readout text-sm text-accent-verify">
                          {s.contributionPct.toFixed(1)}%
                          <span className="ml-2 text-2xs text-text-quaternary">
                            {s.ciLow.toFixed(1)}–{s.ciHigh.toFixed(1)}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </section>

          {/* ── What the model cannot do ────────────────── */}
          <section className="relative overflow-hidden border-b border-border-subtle bg-bg-surface py-14">
            <WindArrow className="pointer-events-none absolute right-[4%] top-[18%] w-40 text-text-quaternary opacity-20" />
            <div className="mx-auto w-full max-w-[1500px] px-6 lg:px-10">
              <h2 className="poster text-[1.35rem] text-text-primary">
                What this model cannot do
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
                {result.method.model}, stepped every {result.method.stepMinutes} minutes
                on the {result.method.transportLevel} field. A finding a state is asked
                to answer for should carry its own limitations, so they are printed
                next to it rather than kept in a paper.
              </p>
              <ol className="mt-8 grid gap-6 lg:grid-cols-2">
                {result.method.limitations.map((l, i) => (
                  <li key={l} className="flex gap-4">
                    <span className="readout shrink-0 text-2xs text-accent-hazard">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-text-secondary">{l}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </>
      )}

      {/* ── Continue ────────────────────────────────────── */}
      <section className="py-14">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-4 px-6 lg:px-10">
          <Link href="/advisory" className="btn-flat bg-[var(--color-flat-coral)] px-6 py-3 text-sm text-[var(--color-flat-cream)]">
            Turn this into an advisory
          </Link>
          <Link href="/certificate" className="btn-flat bg-[var(--color-flat-cream)] px-6 py-3 text-sm text-[var(--color-ink)]">
            Seal it into a certificate
          </Link>
          <Shrub className="ml-auto hidden h-14 w-auto text-[var(--color-flat-leaf)] opacity-40 lg:block" />
        </div>
      </section>
    </div>
  );
}

function Upstream({ label, live, detail }: { label: string; live: boolean; detail: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`block h-2 w-2 ${live ? "bg-accent-clear" : "bg-accent-verify"}`}
        aria-hidden="true"
      />
      <span className="label-technical">{label}</span>
      <span className="readout text-2xs text-text-secondary">{detail}</span>
      <span className="readout text-2xs text-text-quaternary">
        {live ? "live" : "recorded"}
      </span>
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-bg-base px-5 py-4">
      <div className="label-technical">{label}</div>
      <div className="readout mt-2 text-[1.6rem] leading-none text-accent-verify">{value}</div>
      <div className="mt-2 text-2xs leading-relaxed text-text-quaternary">{hint}</div>
    </div>
  );
}
