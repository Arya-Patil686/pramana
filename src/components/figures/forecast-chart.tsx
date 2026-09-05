"use client";

import { useMemo, useRef, useState } from "react";
import type { Episode, ForecastPoint } from "@/data/mock-episodes";
import { GRAP_THRESHOLDS } from "@/data/mock-episodes";
import { cn } from "@/lib/utils";

/*
   Forecast against its baselines.

   Hand-drawn rather than charted by a library, so the GRAP bands, the onset
   markers and the crosshair share one coordinate system with the rest of the
   instrument surfaces. The point of the figure is the horizontal distance
   between the moment each series crosses the stage threshold: that gap is the
   lead-time claim, and it should be readable without a caption.
*/

const W = 1000;
const H = 380;
const PAD = { top: 18, right: 20, bottom: 34, left: 46 };

const SERIES = [
  { key: "pramana", label: "PRAMĀNA", colour: "var(--color-accent-verify)", width: 2, dash: "" },
  { key: "googleAQ", label: "Google AQ API", colour: "var(--color-accent-signal)", width: 1.4, dash: "" },
  { key: "persistence", label: "Persistence", colour: "#8e9aab", width: 1.2, dash: "5 4" },
  { key: "climatology", label: "Climatology", colour: "var(--color-text-tertiary)", width: 1.2, dash: "2 4" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

export function ForecastChart({
  episode,
  stage = "III",
}: {
  episode: Episode;
  stage?: "I" | "II" | "III" | "IV";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverHour, setHoverHour] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());

  const data = episode.forecast;
  const maxAQI = useMemo(
    () =>
      Math.ceil(
        (Math.max(...data.flatMap((d) => [d.pramana, d.googleAQ, d.persistence, d.climatology])) *
          1.08) /
          50
      ) * 50,
    [data]
  );

  const x = (hour: number) =>
    PAD.left + ((hour + 48) / 96) * (W - PAD.left - PAD.right);
  const y = (aqi: number) =>
    H - PAD.bottom - (aqi / maxAQI) * (H - PAD.top - PAD.bottom);

  const threshold = GRAP_THRESHOLDS.find((t) => t.stage === stage)!;

  /* First hour each series crosses the stage threshold. */
  const crossings = useMemo(() => {
    const out: Partial<Record<SeriesKey, number>> = {};
    for (const s of SERIES) {
      const hit = data.find((d) => d[s.key] >= threshold.aqiMin);
      if (hit) out[s.key] = hit.hour;
    }
    return out;
  }, [data, threshold]);

  const truthCrossing = crossings.pramana;
  const leadOver = (k: SeriesKey) =>
    crossings[k] !== undefined && truthCrossing !== undefined
      ? crossings[k]! - truthCrossing
      : null;

  const path = (key: SeriesKey) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(d.hour).toFixed(1)} ${y(d[key]).toFixed(1)}`)
      .join(" ");

  const hovered: ForecastPoint | null =
    hoverHour === null
      ? null
      : (data.find((d) => d.hour === Math.round(hoverHour)) ?? null);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const hour = ((px - PAD.left) / (W - PAD.left - PAD.right)) * 96 - 48;
    setHoverHour(Math.max(-48, Math.min(48, hour)));
  };

  const toggle = (k: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <figure className="panel bezel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5">
        <span className="label-technical">
          Receptor forecast · {episode.receptorCity}
        </span>
        <span className="readout text-2xs text-text-quaternary">
          T0 {episode.forecastT0.replace("T", " ").slice(0, 16)}Z
        </span>
      </div>

      <div className="relative bg-bg-inset">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverHour(null)}
          role="img"
          aria-label={`Forecast AQI for ${episode.receptorCity} against three baselines`}
        >
          {/* GRAP bands */}
          {GRAP_THRESHOLDS.map((th, i) => {
            const next = GRAP_THRESHOLDS[i + 1];
            const top = y(next ? next.aqiMin : maxAQI);
            const bottom = y(th.aqiMin);
            return (
              <g key={th.stage}>
                <rect
                  x={PAD.left}
                  y={top}
                  width={W - PAD.left - PAD.right}
                  height={Math.max(0, bottom - top)}
                  fill={th.color}
                  opacity={0.055}
                />
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={bottom}
                  y2={bottom}
                  stroke={th.color}
                  strokeWidth="0.8"
                  opacity="0.35"
                  strokeDasharray="3 4"
                />
                <text
                  x={W - PAD.right - 4}
                  y={bottom - 5}
                  textAnchor="end"
                  fill={th.color}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  opacity="0.8"
                >
                  GRAP {th.stage}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-border-default)" />
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={H - PAD.bottom}
            y2={H - PAD.bottom}
            stroke="var(--color-border-default)"
          />

          {/* Y ticks */}
          {Array.from({ length: 6 }, (_, i) => Math.round((maxAQI / 5) * i)).map((v) => (
            <g key={v}>
              <line
                x1={PAD.left - 4}
                x2={PAD.left}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-text-quaternary)"
              />
              <text
                x={PAD.left - 8}
                y={y(v) + 4}
                textAnchor="end"
                fill="var(--color-text-tertiary)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {v}
              </text>
            </g>
          ))}

          {/* X ticks */}
          {[-48, -24, 0, 24, 48].map((h) => (
            <g key={h}>
              <line
                x1={x(h)}
                x2={x(h)}
                y1={H - PAD.bottom}
                y2={H - PAD.bottom + 4}
                stroke="var(--color-text-quaternary)"
              />
              <text
                x={x(h)}
                y={H - PAD.bottom + 18}
                textAnchor="middle"
                fill="var(--color-text-tertiary)"
                fontSize="11"
                fontFamily="var(--font-mono)"
              >
                {h > 0 ? `+${h}` : h}h
              </text>
            </g>
          ))}

          {/* Forecast issue marker */}
          <line
            x1={x(0)}
            x2={x(0)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#55677d"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x={x(0) + 5}
            y={PAD.top + 11}
            fill="var(--color-text-secondary)"
            fontSize="11"
            fontFamily="var(--font-mono)"
          >
            ISSUE
          </text>

          {/* Series */}
          {SERIES.map((s) =>
            hidden.has(s.key) ? null : (
              <path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={s.colour}
                strokeWidth={s.width}
                strokeDasharray={s.dash || undefined}
                strokeLinejoin="round"
              />
            )
          )}

          {/* Stage-crossing markers */}
          {SERIES.map((s) => {
            const h = crossings[s.key];
            if (h === undefined || hidden.has(s.key)) return null;
            return (
              <g key={`cx-${s.key}`}>
                <circle
                  cx={x(h)}
                  cy={y(threshold.aqiMin)}
                  r="3.5"
                  fill="var(--color-bg-inset)"
                  stroke={s.colour}
                  strokeWidth="1.6"
                />
              </g>
            );
          })}

          {/* Crosshair */}
          {hovered && (
            <g pointerEvents="none">
              <line
                x1={x(hovered.hour)}
                x2={x(hovered.hour)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--color-text-secondary)"
                strokeWidth="0.9"
              />
              {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                <circle
                  key={`hv-${s.key}`}
                  cx={x(hovered.hour)}
                  cy={y(hovered[s.key])}
                  r="3"
                  fill={s.colour}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Crosshair readout */}
        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 border border-border-default bg-bg-void/92 px-3 py-2">
            <div className="readout text-2xs text-text-tertiary">
              T{hovered.hour >= 0 ? "+" : ""}
              {hovered.hour} h
            </div>
            <div className="mt-1.5 space-y-1">
              {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span
                    className="block h-1.5 w-1.5"
                    style={{ background: s.colour }}
                  />
                  <span className="readout text-2xs text-text-secondary">
                    {s.label}
                  </span>
                  <span className="readout ml-auto pl-3 text-2xs text-text-primary">
                    {hovered[s.key]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend and lead time */}
      <div className="border-t border-border-subtle px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {SERIES.map((s) => {
            const lead = leadOver(s.key);
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={cn(
                  "flex items-center gap-2 transition-opacity",
                  off && "opacity-35"
                )}
              >
                <span
                  className="block h-0.5 w-4"
                  style={{ background: s.colour }}
                />
                <span className="readout text-2xs text-text-secondary">
                  {s.label}
                </span>
                {lead !== null && lead > 0 && (
                  <span className="readout text-2xs text-accent-clear">
                    +{lead} h later
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-2xs leading-relaxed text-text-quaternary">
          Rings mark the first hour each series crosses GRAP Stage {stage} (
          {threshold.aqiMin} AQI). The horizontal gap between the amber ring and
          the others is the lead time being claimed. Click a legend entry to
          isolate a series.
        </p>
      </div>
    </figure>
  );
}
