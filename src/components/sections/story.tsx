"use client";

import Link from "next/link";
import { Scene, SceneLayer, SceneCopy, SceneStage, Answer } from "@/components/illustration/scene";
import {
  Cloud,
  Disc,
  Speckles,
  Frond,
  Shrub,
  Stubble,
  Flame,
  Smoke,
  WindArrow,
  Farmer,
  ChildMasked,
  Official,
  Skyline,
  Station,
  Certificate,
} from "@/components/illustration/parts";

/*
   The story.

   Six drawn frames that make the whole argument before the reader has met a
   single chart: a farmer burns a field, nine hundred thousand others do the
   same, the wind carries it across a state line, a child forty hours away
   breathes it, two governments blame each other, and nobody can prove
   anything. Then the product.

   The sky walks down the CPCB index frame by frame — clean blue over Punjab
   at dawn, AQI 482 over Delhi by the fourth scene. The reader is not told the
   air is getting worse. The page gets worse.
*/

export interface LiveConditions {
  /** 925 hPa wind speed over the corridor, m/s. */
  windSpeed: number;
  /** Bearing the air actually travels toward, degrees from north. */
  bearing: number;
  windLive: boolean;
  fireCount: number;
  firesLive: boolean;
  /** Hours from first ignition to peak arrival, from the episode replay. */
  transportHours: number;
  /** Leading source tehsil in the computed register, and its share. */
  topSource: string | null;
  topSharePct: number;
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg: number) => COMPASS[Math.round(((deg % 360) / 22.5)) % 16];

export function Story({ live }: { live: LiveConditions }) {
  return (
    <>
      {/* ── 01 · The field ──────────────────────────────── */}
      <Scene sky="var(--color-sky-good)" ground="var(--color-land-field)" horizon={0.68} id="field">
        <SceneLayer depth={0.12}>
          <Speckles className="h-full w-full text-[var(--color-flat-cream)]" seed={3} count={40} />
          <Disc className="absolute left-[8%] top-[12%] w-[clamp(70px,9vw,130px)] text-[var(--color-flat-cream)]" />
        </SceneLayer>

        <SceneLayer depth={0.3}>
          <Cloud className="absolute left-[62%] top-[14%] w-[clamp(150px,22vw,330px)] text-[var(--color-flat-cream)]" />
          <Cloud className="absolute left-[24%] top-[26%] w-[clamp(90px,13vw,190px)] text-[var(--color-flat-cream)] opacity-80" />
        </SceneLayer>

        <SceneLayer depth={0.62}>
          <Stubble className="absolute inset-x-0 bottom-[9%] h-[5%] w-full text-[var(--color-land-stubble)] opacity-45" rows={64} />
        </SceneLayer>

        <SceneStage bottom="7%">
          <Frond className="h-[clamp(84px,15vh,170px)] w-auto shrink-0 self-end text-[var(--color-flat-leaf)]" />
          <Farmer className="h-[clamp(150px,25vh,270px)] w-auto shrink-0" />
          <Shrub className="h-[clamp(52px,9vh,100px)] w-auto shrink-0 self-end text-[var(--color-flat-leaf)]" />
        </SceneStage>

        <div className="absolute inset-x-0 z-20 flex items-center justify-center" style={{ top: "11%", bottom: "40%" }}>
          <SceneCopy
            kicker="Every November"
            headline={<>A farmer in Punjab burns what the harvest left behind.</>}
            body={
              <>
                He has about twelve days between cutting rice and sowing wheat.
                Burning the stubble takes an afternoon and costs nothing.
                Everything else costs money he does not have.
              </>
            }
          />
        </div>
      </Scene>

      {/* ── 02 · Ignition ───────────────────────────────── */}
      <Scene sky="var(--color-sky-moderate)" ground="var(--color-land-stubble)" horizon={0.64} id="ignition">
        <SceneLayer depth={0.14}>
          <Speckles className="h-full w-full text-[var(--color-flat-cream)]" seed={11} count={30} />
        </SceneLayer>

        {/* The burn line, receding to the horizon. */}
        <SceneLayer depth={0.4}>
          <div className="absolute inset-x-0 bottom-[34%] flex items-end justify-between px-[4%]">
            {[0.55, 0.8, 0.42, 1, 0.62, 0.88, 0.5, 0.74, 0.46].map((s, i) => (
              <div key={i} className="relative" style={{ width: `${s * 5}%` }}>
                <Smoke
                  className="absolute bottom-[70%] left-0 w-[240%] text-[var(--color-flat-clay)] opacity-70"
                  lean={30 + i * 4}
                  puffs={6}
                />
                <Flame
                  className="flicker w-full text-[var(--color-flat-coral)]"
                  style={{ animationDelay: `${i * 130}ms` }}
                />
              </div>
            ))}
          </div>
        </SceneLayer>

        <SceneLayer depth={0.75}>
          <Stubble className="absolute inset-x-0 bottom-[10%] h-[9%] w-full text-[var(--color-land-burnt)]" rows={52} />
        </SceneLayer>

        <div className="absolute inset-x-0 z-20 flex items-center justify-center" style={{ top: "12%", bottom: "40%" }}>
          <SceneCopy
            kicker="2 November · 14:40 IST"
            headline={<>So do tens of thousands of others.</>}
            body={
              <>
                Punjab alone records tens of thousands of burning events in a
                single post-monsoon season. This frame is holding{" "}
                <strong className="font-semibold">
                  {live.fireCount.toLocaleString("en-IN")}
                </strong>{" "}
                detections
                {live.firesLive
                  ? ", read live from NASA FIRMS a moment ago."
                  : " from the recorded 2 November set."}{" "}
                One field is a farmer&apos;s problem. A season of them is an
                airshed.
              </>
            }
            ink="var(--color-ink)"
          />
        </div>
      </Scene>

      {/* ── 03 · The wind ───────────────────────────────── */}
      <Scene sky="var(--color-sky-poor)" ground="var(--color-land-burnt)" horizon={0.78} id="wind">
        <SceneLayer depth={0.2}>
          <Speckles className="h-full w-full text-[var(--color-flat-cream)]" seed={7} count={26} />
        </SceneLayer>

        {/* Smoke streaming downwind, thinning as it goes. */}
        <SceneLayer depth={0.45}>
          {[18, 34, 52, 68].map((top, i) => (
            <Smoke
              key={top}
              className="absolute w-[clamp(180px,30vw,460px)] text-[var(--color-flat-clay)]"
              style={{ left: `${-6 + i * 7}%`, top: `${top - 30}%`, opacity: 0.55 - i * 0.07 }}
              lean={70}
              puffs={11}
            />
          ))}
        </SceneLayer>

        <SceneLayer depth={0.66}>
          {[26, 44, 62].map((top, i) => (
            <WindArrow
              key={top}
              className="absolute w-[clamp(90px,14vw,210px)] text-[var(--color-ink)] opacity-30"
              style={{ left: `${12 + i * 22}%`, top: `${top}%`, transform: "rotate(6deg)" }}
            />
          ))}
        </SceneLayer>

        <div className="absolute inset-x-0 z-20 flex items-center justify-center" style={{ top: "12%", bottom: "18%" }}>
          <SceneCopy
            kicker="925 hectopascals"
            headline={<>The wind does not stop at the border.</>}
            body={
              <>
                Above the night-time boundary layer the air over this corridor
                is moving{" "}
                <strong className="font-semibold">
                  {live.windSpeed.toFixed(1)} m/s toward the {compass(live.bearing)}
                </strong>
                . Smoke that leaves a field in Sangrur is over another state
                before the fire is out.
              </>
            }
          >
            <div className="mt-8 inline-flex items-center gap-2.5 border-2 border-[var(--color-ink)] bg-[var(--color-flat-cream)] px-4 py-2">
              <span
                className={`block h-2 w-2 rounded-full ${live.windLive ? "bg-[var(--color-flat-teal)]" : "bg-[var(--color-flat-clay)]"}`}
              />
              <span className="font-technical text-2xs uppercase tracking-[0.14em] text-[var(--color-ink)]">
                {live.windLive
                  ? "Live · Open-Meteo, ECMWF IFS"
                  : "Recorded field · 3 Nov 2024"}
              </span>
            </div>
          </SceneCopy>
        </div>
      </Scene>

      {/* ── 04 · The city ───────────────────────────────── */}
      <Scene sky="var(--color-sky-severe)" ground="var(--color-land-city)" horizon={0.72} id="city">
        <SceneLayer depth={0.1}>
          <Speckles className="h-full w-full text-[var(--color-flat-clay)]" seed={19} count={44} />
          <Disc className="absolute right-[12%] top-[10%] w-[clamp(60px,8vw,110px)] text-[var(--color-flat-coral)] opacity-70" />
        </SceneLayer>

        <SceneLayer depth={0.3}>
          <Smoke className="absolute left-[-10%] top-[4%] w-[70vw] text-[var(--color-flat-clay)] opacity-45" lean={90} puffs={13} />
        </SceneLayer>

        <SceneLayer depth={0.5}>
          <Skyline className="absolute inset-x-0 bottom-[28%] h-[26%] w-full text-[#2b3549] opacity-90" />
        </SceneLayer>

        <SceneStage bottom="6%">
          <Frond className="h-[clamp(76px,13vh,150px)] w-auto shrink-0 self-end text-[#26303f]" />
          <ChildMasked className="h-[clamp(140px,23vh,250px)] w-auto shrink-0" />
          <Station className="h-[clamp(90px,15vh,170px)] w-auto shrink-0 self-end text-[#26303f]" />
        </SceneStage>

        <div className="absolute inset-x-0 z-20 flex items-center justify-center" style={{ top: "11%", bottom: "40%" }}>
          <SceneCopy
            kicker={`${live.transportHours} hours later · 3 November, 18:00`}
            headline={<>A child in Delhi breathes it.</>}
            body={
              <>
                {/* Built as one string: splitting a sentence across JSX
                    expressions leaves stray spaces before its punctuation. */}
                {`Running the episode through the transport model puts the peak arrival ${live.transportHours} hours after the first ignition${
                  live.topSource
                    ? `, with ${live.topSource} the largest single contributor at ${live.topSharePct.toFixed(1)}%`
                    : ""
                }. Nothing that happened in this city caused it, and nothing that happens in this city can stop it.`}
              </>
            }
            ink="var(--color-flat-cream)"
          />
        </div>
      </Scene>

      {/* ── 05 · The argument ───────────────────────────── */}
      <Scene sky="var(--color-sky-verypoor)" ground="var(--color-paper-deep)" horizon={0.6} id="argument">
        <SceneLayer depth={0.16}>
          <Speckles className="h-full w-full text-[var(--color-flat-cream)]" seed={23} count={28} />
        </SceneLayer>

        {/* The border: a dotted line the smoke has already crossed. */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2" aria-hidden="true">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--color-ink) 0 12px, transparent 12px 26px)",
              opacity: 0.35,
            }}
          />
        </div>

        <div className="absolute inset-x-0 z-20 flex items-center justify-center" style={{ top: "10%", bottom: "42%" }}>
          <SceneCopy
            kicker="Every year, the same argument"
            headline={<>So whose smoke is it?</>}
            body={
              <>
                Delhi points upwind. Punjab points at Delhi&apos;s own traffic and
                construction. Both sides cite real studies. Neither can produce a
                number the other will accept, so the argument runs until the wind
                changes and everyone goes home.
              </>
            }
          />
        </div>

        <SceneStage bottom="5%">
          <div className="flex flex-1 flex-col items-center gap-3">
            <Official className="h-[clamp(140px,24vh,260px)] w-auto" facing="right" clothes="var(--color-flat-teal)" />
            <Answer>&ldquo;Theirs&rdquo;</Answer>
          </div>
          <div className="flex flex-1 flex-col items-center gap-3">
            <Official className="h-[clamp(140px,24vh,260px)] w-auto" facing="left" clothes="var(--color-flat-coral)" skin="var(--color-skin-1)" />
            <Answer>&ldquo;Theirs&rdquo;</Answer>
          </div>
        </SceneStage>
      </Scene>

      {/* ── 06 · The proof ──────────────────────────────── */}
      <Scene sky="var(--color-paper)" horizon={1} id="proof" height="auto" className="py-[16vh]">
        <SceneLayer depth={0.14}>
          <Speckles className="h-full w-full text-[var(--color-flat-mustard)]" seed={31} count={22} />
        </SceneLayer>

        <div className="relative z-20">
          <SceneCopy
            kicker="प्रमाण · pramāṇa · &ldquo;proof&rdquo;"
            headline={<>So we built the proof.</>}
            body={
              <>
                PRAMĀNA names the upwind cells responsible for a receptor
                city&apos;s exceedance, attaches a confidence interval to every
                figure, and seals the result in a certificate the named state can
                re-run and reproduce bit-for-bit. Not a dashboard that displays
                pollution. An instrument that settles who owns it.
              </>
            }
          />

          <div className="relative z-20 mx-auto mt-14 flex max-w-md justify-center">
            <Certificate className="bob h-[clamp(180px,28vh,280px)] w-auto" />
          </div>

          <div className="relative z-20 mt-14 flex flex-wrap items-center justify-center gap-4 px-6">
            <Link
              href="/report"
              className="btn-flat bg-[var(--color-flat-mustard)] px-7 py-3.5 text-sm text-[var(--color-ink)]"
            >
              Report the sky where you are
            </Link>
            <Link
              href="/console"
              className="btn-flat bg-[var(--color-flat-cream)] px-7 py-3.5 text-sm text-[var(--color-ink)]"
            >
              Open the operator console
            </Link>
          </div>
        </div>
      </Scene>
    </>
  );
}
