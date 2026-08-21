"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Episode } from "@/data/mock-episodes";
import { GRAP_THRESHOLDS } from "@/data/mock-episodes";
import { aqiToColor, getGRAPStage, cn } from "@/lib/utils";
import { StatusChip } from "@/components/ui/primitives";

/*
   Episode replay.

   Structural layers are SVG so they stay crisp and inspectable; the plume is
   a canvas particle field because a few hundred moving points per frame does
   not belong in the DOM. Both share one projection, so a particle and a fire
   marker at the same coordinate land on the same pixel.

   Fires appear at their real FIRMS acquisition time relative to the forecast
   issue time. Nothing on this figure is placed for composition.
*/

const DEG = Math.PI / 180;
const VIEW_W = 1000;
const PAD_DEG = 0.55;

interface Projection {
  width: number;
  height: number;
  x: (lng: number) => number;
  y: (lat: number) => number;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function buildProjection(pts: { lat: number; lng: number }[]): Projection {
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats) - PAD_DEG;
  const maxLat = Math.max(...lats) + PAD_DEG;
  const minLng = Math.min(...lngs) - PAD_DEG;
  const maxLng = Math.max(...lngs) + PAD_DEG;

  const meanLat = (minLat + maxLat) / 2;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  // Equirectangular with a cosine correction so shapes are not stretched.
  const effectiveLngSpan = lngSpan * Math.cos(meanLat * DEG);
  const height = Math.round((VIEW_W * latSpan) / effectiveLngSpan);

  return {
    width: VIEW_W,
    height,
    x: (lng) => ((lng - minLng) / lngSpan) * VIEW_W,
    y: (lat) => ((maxLat - lat) / latSpan) * height,
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
}

function niceTicks(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

export function CorridorReplay({ episode }: { episode: Episode }) {
  const [hour, setHour] = useState(-6);
  const [playing, setPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const t0Ms = useMemo(() => Date.parse(episode.forecastT0), [episode]);

  const proj = useMemo(() => {
    const pts = [
      ...episode.fireHotspots.map((f) => ({ lat: f.lat, lng: f.lng })),
      ...episode.stationReadings.map((s) => ({ lat: s.lat, lng: s.lng })),
      ...episode.windVectors.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: episode.receptorCoords[0], lng: episode.receptorCoords[1] },
    ];
    return buildProjection(pts);
  }, [episode]);

  /* Fires carry their true detection hour relative to forecast issue. */
  const fires = useMemo(
    () =>
      episode.fireHotspots.map((f) => ({
        ...f,
        detectHour: (Date.parse(f.acqDate) - t0Ms) / 3_600_000,
        px: proj.x(f.lng),
        py: proj.y(f.lat),
      })),
    [episode, proj, t0Ms]
  );

  const sourceCentroid = useMemo(() => {
    const n = fires.length;
    return {
      px: fires.reduce((s, f) => s + f.px, 0) / n,
      py: fires.reduce((s, f) => s + f.py, 0) / n,
    };
  }, [fires]);

  const receptorPx = useMemo(
    () => ({
      px: proj.x(episode.receptorCoords[1]),
      py: proj.y(episode.receptorCoords[0]),
    }),
    [episode, proj]
  );

  /* Control point bowed perpendicular to the corridor, so the plume curves. */
  const control = useMemo(() => {
    const mx = (sourceCentroid.px + receptorPx.px) / 2;
    const my = (sourceCentroid.py + receptorPx.py) / 2;
    const dx = receptorPx.px - sourceCentroid.px;
    const dy = receptorPx.py - sourceCentroid.py;
    return { px: mx - dy * 0.16, py: my + dx * 0.16 };
  }, [sourceCentroid, receptorPx]);

  const forecastAt = useCallback(
    (h: number) => {
      const idx = Math.round(h) + 48;
      return episode.forecast[Math.max(0, Math.min(episode.forecast.length - 1, idx))];
    },
    [episode]
  );

  const current = forecastAt(hour);
  const grap = getGRAPStage(current.pramana);
  const firesLit = fires.filter((f) => f.detectHour <= hour);

  /* Plume progress: leading edge advances over the transport time. */
  const transportHours = 40;
  const plumeFront = Math.max(
    0,
    Math.min(1, (hour - fires[0].detectHour) / transportHours)
  );

  /* ── Playback ─────────────────────────────────────── */
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setHour((h) => {
        const next = h + dt * 7; // 7 simulated hours per real second
        return next > 48 ? -12 : next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  /* ── Plume particle field ─────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let disposed = false;

    // Deterministic particle seeds.
    const COUNT = 420;
    const seeds = Array.from({ length: COUNT }, (_, i) => {
      const a = Math.sin(i * 12.9898) * 43758.5453;
      const b = Math.sin(i * 78.233) * 12345.6789;
      return {
        offset: i / COUNT,
        jitter: a - Math.floor(a) - 0.5,
        jitter2: b - Math.floor(b) - 0.5,
        speed: 0.55 + ((i * 31) % 50) / 100,
      };
    });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = (now: number) => {
      if (disposed) return;
      const rect = container.getBoundingClientRect();
      const scale = rect.width / proj.width;
      ctx.clearRect(0, 0, rect.width, rect.height);

      const t = now / 1000;
      ctx.globalCompositeOperation = "lighter";

      for (const s of seeds) {
        // Particles only exist along the length the plume has reached.
        const raw = (s.offset + t * s.speed * 0.08) % 1;
        const p = raw * plumeFront;
        if (plumeFront <= 0.001) continue;

        const u = 1 - p;
        const bx =
          u * u * sourceCentroid.px + 2 * u * p * control.px + p * p * receptorPx.px;
        const by =
          u * u * sourceCentroid.py + 2 * u * p * control.py + p * p * receptorPx.py;

        // Dispersion grows downwind.
        const spread = 14 + p * 96;
        const px = (bx + s.jitter * spread) * scale;
        const py = (by + s.jitter2 * spread) * scale;

        const fade =
          Math.min(1, raw / 0.12) * Math.min(1, (1 - raw) / 0.25);
        const radius = (1.6 + p * 5.2) * scale * 1.4;

        // Smoke cools from ember to grey as it advects.
        const warm = Math.max(0, 1 - p * 2.2);
        const r = Math.round(150 + warm * 74);
        const g = Math.round(154 + warm * 8);
        const b = Math.round(171 - warm * 60);

        const grd = ctx.createRadialGradient(px, py, 0, px, py, Math.max(radius, 0.5));
        grd.addColorStop(0, `rgba(${r},${g},${b},${0.22 * fade})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(radius, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [proj, sourceCentroid, control, receptorPx, plumeFront]);

  const latTicks = niceTicks(proj.minLat, proj.maxLat, 0.5);
  const lngTicks = niceTicks(proj.minLng, proj.maxLng, 0.5);

  const hoursLabel = `${hour >= 0 ? "+" : ""}${hour.toFixed(1)} h`;
  const wallClock = new Date(t0Ms + hour * 3_600_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);

  return (
    <div className="panel bezel">
      {/* Instrument header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <span className="label-technical">Episode replay</span>
          <span className="readout text-2xs text-text-quaternary">
            {episode.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip tone={hour >= 0 ? "hazard" : "signal"} pulse={playing}>
            T{hoursLabel}
          </StatusChip>
          <span className="readout text-2xs text-text-quaternary">
            {wallClock}Z
          </span>
        </div>
      </div>

      {/* Map stage */}
      <div
        ref={containerRef}
        className="relative w-full bg-bg-inset"
        style={{ aspectRatio: `${proj.width} / ${proj.height}` }}
      >
        <svg
          viewBox={`0 0 ${proj.width} ${proj.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Replay of ${episode.name} at hour ${hoursLabel}`}
        >
          <defs>
            <filter id="cwt-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="34" />
            </filter>
            <marker
              id="wind-head"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 1 L7 4 L0 7 z" fill="#5c8ae6" opacity="0.75" />
            </marker>
          </defs>

          {/* Graticule with real degree labels */}
          <g>
            {latTicks.map((lat) => (
              <g key={`lat-${lat}`}>
                <line
                  x1={0}
                  x2={proj.width}
                  y1={proj.y(lat)}
                  y2={proj.y(lat)}
                  stroke="#26313e"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
                <text
                  x={6}
                  y={proj.y(lat) - 5}
                  fill="#3d4854"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                >
                  {lat.toFixed(1)}°N
                </text>
              </g>
            ))}
            {lngTicks.map((lng) => (
              <g key={`lng-${lng}`}>
                <line
                  y1={0}
                  y2={proj.height}
                  x1={proj.x(lng)}
                  x2={proj.x(lng)}
                  stroke="#26313e"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
                <text
                  x={proj.x(lng) + 5}
                  y={proj.height - 8}
                  fill="#3d4854"
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                >
                  {lng.toFixed(1)}°E
                </text>
              </g>
            ))}
          </g>

          {/* Residence-time proxy field, weighted by FRP of lit fires */}
          <g filter="url(#cwt-blur)" opacity="0.5">
            {firesLit.map((f) => (
              <circle
                key={`field-${f.id}`}
                cx={f.px}
                cy={f.py}
                r={26 + Math.sqrt(f.frp) * 7}
                fill="#b8815b"
                opacity="0.32"
              />
            ))}
          </g>

          {/* Wind field at 925 hPa */}
          <g>
            {episode.windVectors.map((w, i) => {
              const flowDir = (w.direction + 180) * DEG;
              const len = 14 + w.speed * 3.6;
              const x1 = proj.x(w.lng);
              const y1 = proj.y(w.lat);
              const x2 = x1 + Math.sin(flowDir) * len;
              const y2 = y1 - Math.cos(flowDir) * len;
              return (
                <line
                  key={`wind-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#5c8ae6"
                  strokeWidth="1.4"
                  opacity="0.55"
                  markerEnd="url(#wind-head)"
                />
              );
            })}
          </g>

          {/* Corridor centreline */}
          <path
            d={`M ${sourceCentroid.px} ${sourceCentroid.py} Q ${control.px} ${control.py} ${receptorPx.px} ${receptorPx.py}`}
            fill="none"
            stroke="#5c8ae6"
            strokeWidth="1.2"
            strokeDasharray="5 5"
            opacity="0.45"
          />

          {/* FIRMS hotspots, revealed at their acquisition hour */}
          <g>
            {fires.map((f) => {
              const lit = f.detectHour <= hour;
              const age = hour - f.detectHour;
              const r = 3.4 + Math.sqrt(f.frp) * 0.95;
              return (
                <g key={f.id} opacity={lit ? 1 : 0.12}>
                  <circle
                    cx={f.px}
                    cy={f.py}
                    r={r * 2.4}
                    fill="#e8703a"
                    opacity={lit ? Math.max(0, 0.28 - age * 0.004) : 0}
                  />
                  <circle
                    cx={f.px}
                    cy={f.py}
                    r={r}
                    fill={lit ? "#ffb066" : "none"}
                    stroke={lit ? "#ffd9a8" : "#3d4854"}
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </g>

          {/* Reference stations, scaled to the fraction of peak reached */}
          <g>
            {episode.stationReadings.map((s) => {
              const frac = current.pramana / episode.peakAQI;
              const shown = Math.round(s.aqi * frac);
              const x = proj.x(s.lng);
              const y = proj.y(s.lat);
              return (
                <g key={s.stationId}>
                  <rect
                    x={x - 4.5}
                    y={y - 4.5}
                    width="9"
                    height="9"
                    fill={aqiToColor(shown)}
                    stroke="#0b1015"
                    strokeWidth="1.2"
                  />
                  <text
                    x={x + 9}
                    y={y + 3.5}
                    fill="#96a2b0"
                    fontSize="12"
                    fontFamily="var(--font-mono)"
                  >
                    {shown}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Receptor */}
          <g>
            <circle
              cx={receptorPx.px}
              cy={receptorPx.py}
              r="15"
              fill="none"
              stroke="#2fbfb0"
              strokeWidth="1.2"
              opacity="0.75"
            />
            <circle cx={receptorPx.px} cy={receptorPx.py} r="3" fill="#2fbfb0" />
            <text
              x={receptorPx.px + 21}
              y={receptorPx.py - 6}
              fill="#e9edf1"
              fontSize="15"
              fontFamily="var(--font-mono)"
              letterSpacing="1"
            >
              {episode.receptorCity.toUpperCase()}
            </text>
            <text
              x={receptorPx.px + 21}
              y={receptorPx.py + 10}
              fill="#5b6775"
              fontSize="12"
              fontFamily="var(--font-mono)"
            >
              RECEPTOR
            </text>
          </g>

          {/* Source region label */}
          <text
            x={sourceCentroid.px - 10}
            y={sourceCentroid.py - 44}
            fill="#b8815b"
            fontSize="13"
            fontFamily="var(--font-mono)"
            letterSpacing="1"
            textAnchor="middle"
          >
            {episode.sourceRegion.toUpperCase()}
          </text>
        </svg>

        {/* Plume particles */}
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        />

        {/* Corner readout */}
        <div className="pointer-events-none absolute right-3 top-3 border border-border-default bg-bg-void/85 px-3 py-2">
          <div className="label-technical">Receptor AQI</div>
          <div
            className="readout text-xl font-medium leading-none"
            style={{ color: aqiToColor(current.pramana) }}
          >
            {current.pramana}
          </div>
          <div className="readout mt-1.5 text-2xs text-text-tertiary">
            GRAP {grap.stage} · {grap.label}
          </div>
        </div>
      </div>

      {/* Transport controls */}
      <div className="border-t border-border-subtle px-3.5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border-default text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
            aria-label={playing ? "Pause replay" : "Play replay"}
          >
            {playing ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="1" y="0" width="3" height="10" fill="currentColor" />
                <rect x="6" y="0" width="3" height="10" fill="currentColor" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1 0 L10 5 L1 10 z" fill="currentColor" />
              </svg>
            )}
          </button>

          <div className="relative flex-1">
            <input
              type="range"
              min={-48}
              max={48}
              step={0.5}
              value={hour}
              onChange={(e) => {
                setPlaying(false);
                setHour(Number(e.target.value));
              }}
              aria-label="Scrub episode timeline in hours from forecast issue"
              className="w-full accent-[var(--color-accent-verify)]"
            />
            <div className="mt-1 flex justify-between">
              {[-48, -24, 0, 24, 48].map((mark) => (
                <span key={mark} className="readout text-2xs text-text-quaternary">
                  {mark > 0 ? `+${mark}` : mark}h
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* GRAP ladder */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="label-technical">GRAP ladder</span>
          {GRAP_THRESHOLDS.map((th) => {
            const active = current.pramana >= th.aqiMin;
            return (
              <span key={th.stage} className="flex items-center gap-1.5">
                <span
                  className={cn("block h-2 w-2", !active && "opacity-25")}
                  style={{ background: th.color }}
                />
                <span
                  className={cn(
                    "readout text-2xs",
                    active ? "text-text-secondary" : "text-text-quaternary"
                  )}
                >
                  {th.stage} · {th.aqiMin}+
                </span>
              </span>
            );
          })}
          <span className="readout ml-auto text-2xs text-text-quaternary">
            {firesLit.length}/{fires.length} hotspots detected · plume front{" "}
            {(plumeFront * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}
