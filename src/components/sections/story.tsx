"use client";

import { Scene, SceneCopy, MapNote, Stat } from "@/components/illustration/scene";
import { CorridorMap } from "@/components/figures/corridor-map";
import type { Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";

/*
   The story.

   Five printed pages that make the argument before the reader meets a table:
   the burning, the flow that carries it, the arrival, the dispute that
   follows, and the instrument that settles it.

   Every page carries the same map, revealed one layer at a time — graticule,
   then detections, then the wind field, then the trajectories. It is the same
   map the console renders and the same numbers the register is computed from,
   so the narrative cannot drift away from the model. The paper stains down
   the CPCB index as the smoke arrives.
*/

export interface StoryData {
  detections: FireDetection[];
  wind: WindSample[];
  traces: Trace[];
  windSpeed: number;
  bearing: number;
  windLive: boolean;
  firesLive: boolean;
  fireCount: number;
  transportHours: number;
  topSource: string | null;
  topSharePct: number;
  upwindSharePct: number;
  upwindCi: [number, number];
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg: number) => COMPASS[Math.round((deg % 360) / 22.5) % 16];

export function Story({ data }: { data: StoryData }) {
  const {
    detections, wind, traces, windSpeed, bearing, windLive, firesLive,
    fireCount, transportHours, topSource, topSharePct, upwindSharePct, upwindCi,
  } = data;

  return (
    <>
      {/*
         The opening title card lived here until the interactive model took
         the top of the page. Repeating the headline underneath it would have
         read as a stutter, so the narrative now starts at the burning.
      */}

      {/* ── 02 · The burning ────────────────────────────── */}
      <Scene paper="var(--color-stain-1)" id="burning">
        <div className="mx-auto grid h-full w-full max-w-[1400px] items-center gap-10 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <SceneCopy
              kicker="2 November · VIIRS, 375 m"
              headline={<>A fortnight to clear the field, and one afternoon that costs nothing.</>}
              body={
                <>
                  Between cutting rice and sowing wheat a farmer in Punjab has
                  roughly twelve days. Burning the residue is the only method
                  that fits in the window and costs nothing, so it is what
                  happens — tens of thousands of times a season, across an area
                  larger than Belgium.
                </>
              }
            >
              <MapNote
                className="mt-9"
                title="Marks"
                source={`${fireCount} active fire detections, area scaled to Fire Radiative Power. ${
                  firesLive ? "NASA FIRMS, live." : "NASA FIRMS, recorded 2 November set."
                }`}
              />
            </SceneCopy>
          </div>

          <div className="lg:col-span-7">
            <div className="aspect-[4/3] w-full">
              <CorridorMap
                detections={detections}
                wind={wind}
                show={{ fires: true, wind: false, traces: false }}
              />
            </div>
          </div>
        </div>
      </Scene>

      {/* ── 03 · The flow ───────────────────────────────── */}
      <Scene paper="var(--color-stain-2)" id="flow">
        <div className="mx-auto grid h-full w-full max-w-[1400px] items-center gap-10 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="order-2 lg:order-1 lg:col-span-7">
            <div className="aspect-[4/3] w-full">
              <CorridorMap
                detections={detections}
                wind={wind}
                show={{ fires: true, wind: true, traces: false }}
              />
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5">
            <SceneCopy
              kicker="925 hectopascals"
              headline={<>The wind does not stop at the border.</>}
              body={
                <>
                  Transport happens near the top of the nocturnal boundary
                  layer, not at the surface. That distinction decides the whole
                  question: surface wind over this corridor frequently points
                  somewhere else entirely, which is why dashboards that display
                  it get the direction wrong. Right now the 925 hPa flow is{" "}
                  <strong className="font-semibold">
                    {windSpeed.toFixed(1)} m/s toward the {compass(bearing)}
                  </strong>
                  .
                </>
              }
            >
              <MapNote
                className="mt-9"
                title="Barbs"
                source={`Nine corridor samples at 925 hPa, pointing the way air travels. ${
                  windLive ? "Open-Meteo · ECMWF IFS, live." : "Recorded episode field, 3 November."
                }`}
              />
            </SceneCopy>
          </div>
        </div>
      </Scene>

      {/* ── 04 · The arrival ────────────────────────────── */}
      <Scene paper="var(--color-stain-3)" id="arrival">
        <div className="mx-auto grid h-full w-full max-w-[1400px] items-center gap-10 px-6 py-24 lg:grid-cols-12 lg:px-10">
          <div className="lg:col-span-5">
            <SceneCopy
              kicker={`${transportHours} hours later`}
              headline={<>It arrives over a city that did not produce it.</>}
              body={
                <>
                  Each curve is one detection&apos;s puff, advected forward on
                  that field until its closest approach to the receptor. These
                  are not an illustration of transport — they are the
                  trajectories the register is computed from, so the picture and
                  the number cannot disagree.
                  {topSource
                    ? ` ${topSource} is the largest single contributor, at ${topSharePct.toFixed(1)}%.`
                    : ""}
                </>
              }
            >
              <div className="mt-9 grid max-w-sm grid-cols-2 gap-6">
                <Stat
                  value={`${upwindSharePct.toFixed(1)}%`}
                  label="Of the biomass load, from outside Delhi"
                />
                <Stat
                  value={`${upwindCi[0].toFixed(0)}–${upwindCi[1].toFixed(0)}`}
                  label="95% interval"
                />
              </div>
              <p className="mt-4 max-w-md text-2xs leading-relaxed text-[var(--color-ink)]/55">
                A thermal satellite cannot see traffic, construction or
                industry, so this is the share of the biomass-attributable load
                — not of everything Delhi is breathing.
              </p>
              <MapNote
                className="mt-8"
                title="Curves"
                source="Forward Lagrangian puff trajectories, 15-minute steps, stroke weighted by deposited load."
              />
            </SceneCopy>
          </div>

          <div className="lg:col-span-7">
            <div className="aspect-[4/3] w-full">
              <CorridorMap
                detections={detections}
                wind={wind}
                traces={traces}
                show={{ fires: true, wind: false, traces: true }}
              />
            </div>
          </div>
        </div>
      </Scene>

      {/* ── 05 · The dispute ────────────────────────────── */}
      <Scene paper="var(--color-stain-4)" id="dispute" className="flex items-center">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-24 lg:px-10">
          <SceneCopy
            kicker="Every year, the same argument"
            headline={<>Whose smoke is it?</>}
            body={
              <>
                Delhi points upwind. Punjab points at Delhi&apos;s own traffic
                and construction. Both cite real studies. Neither can produce a
                figure the other will accept, so the dispute runs until the wind
                changes and everyone goes home. The blocker was never
                measurement. It is that attribution across a political boundary
                is contested, unverifiable, and arrives months later in a
                journal.
              </>
            }
          />

          <div className="mt-14 grid gap-px border-t border-[var(--color-ink)]/25 sm:grid-cols-3">
            {[
              { claim: "“It is the stubble.”", who: "Receptor state", why: "Cites satellite fire counts, which show the burning but not what reached the city." },
              { claim: "“It is your own traffic.”", who: "Upwind state", why: "Cites the receptor's own emission inventory, which is real but does not settle the share." },
              { claim: "Neither is checkable.", who: "The gap", why: "No figure either side produces can be independently re-run by the other, so no figure is binding." },
            ].map((c) => (
              <div key={c.who} className="pt-6 pr-6">
                <div className="poster text-[1.05rem] text-[var(--color-ink)]">{c.claim}</div>
                <div className="smallcaps mt-3 text-[var(--color-ink)]/55">{c.who}</div>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--color-ink)]/70">{c.why}</p>
              </div>
            ))}
          </div>
        </div>
      </Scene>
    </>
  );
}
