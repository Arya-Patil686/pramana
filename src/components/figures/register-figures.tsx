import type { TehsilContribution, ArrivalBin } from "@/lib/attribution/engine";
import { cn } from "@/lib/utils";

/*
   Figures for the computed register.

   Drawn as flat bars and a filled area rather than pulled from a chart
   library, for the same reason the rest of the page is drawn: these are
   printed marks on paper, and a library's default styling fights that
   everywhere. Both are pure SVG, both render on the server, and neither costs
   the client a kilobyte of JavaScript.
*/

export function RegisterBars({
  rows,
  className,
}: {
  rows: TehsilContribution[];
  className?: string;
}) {
  if (rows.length === 0) return null;
  /* Scaled to the widest interval, not the widest bar, so an interval can
     never run off the end of the figure. */
  const max = Math.max(...rows.map((r) => r.ciHigh));

  return (
    <div className={cn("border border-[var(--color-ink-hair)]", className)}>
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <span className="label-technical">Tehsil · share of biomass load</span>
        <span className="label-technical">95% interval</span>
      </div>

      <ol className="divide-y divide-border-subtle">
        {rows.map((r) => (
          <li key={r.tehsil} className="px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium text-text-primary">
                {r.tehsil}
                <span className="ml-2 text-2xs text-text-quaternary">{r.state}</span>
              </span>
              <span className="readout shrink-0 text-sm text-accent-verify">
                {r.contributionPct.toFixed(1)}%
              </span>
            </div>

            <div className="relative mt-2.5 h-3.5">
              {/* Interval span, drawn behind the point estimate. */}
              <div
                className="absolute inset-y-0 bg-accent-verify/25"
                style={{
                  left: `${(r.ciLow / max) * 100}%`,
                  width: `${((r.ciHigh - r.ciLow) / max) * 100}%`,
                }}
              />
              {/* Point estimate. */}
              <div
                className="absolute inset-y-0 left-0 bg-accent-verify"
                style={{ width: `${(r.contributionPct / max) * 100}%` }}
              />
              {/* Tick at the estimate, so the eye can find it inside the span. */}
              <div
                className="absolute inset-y-0 w-[2px] bg-[var(--color-ink)]"
                style={{ left: `${(r.contributionPct / max) * 100}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-2xs text-text-quaternary">
              <span>{r.cells} cell{r.cells === 1 ? "" : "s"}</span>
              <span>{r.arrivals} arrival{r.arrivals === 1 ? "" : "s"}</span>
              <span>{r.meanTransportHours} h mean transport</span>
              <span>{r.frpTotal} MW total FRP</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ArrivalCurve({
  bins,
  className,
}: {
  bins: ArrivalBin[];
  className?: string;
}) {
  if (bins.length < 2) return null;

  const W = 420;
  const H = 180;
  const PAD = { l: 30, r: 8, t: 12, b: 26 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const hours = bins.map((b) => b.hour);
  const hMin = Math.min(...hours);
  const hMax = Math.max(...hours);
  const span = Math.max(1, hMax - hMin);

  const x = (h: number) => PAD.l + ((h - hMin) / span) * innerW;
  const y = (load: number) => PAD.t + (1 - load / 100) * innerH;

  const line = bins.map((b, i) => `${i === 0 ? "M" : "L"}${x(b.hour).toFixed(1)} ${y(b.load).toFixed(1)}`).join(" ");
  const area = `${line} L${x(hMax).toFixed(1)} ${PAD.t + innerH} L${x(hMin).toFixed(1)} ${PAD.t + innerH} Z`;
  const peak = bins.reduce((a, b) => (b.load > a.load ? b : a), bins[0]);

  return (
    <div className={cn("border border-[var(--color-ink-hair)]", className)}>
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
        <span className="label-technical">Deposited load at receptor</span>
        <span className="label-technical">Peak {peak.hour} h</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Deposited load peaks ${peak.hour} hours after the first detection`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)}
              stroke="var(--color-border-subtle)" strokeWidth="1"
            />
            <text
              x={PAD.l - 6} y={y(v) + 3.5} textAnchor="end"
              fontSize="9" fill="var(--color-text-quaternary)" fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-accent-verify)" opacity="0.22" />
        <path d={line} fill="none" stroke="var(--color-accent-verify)" strokeWidth="2" strokeLinejoin="round" />

        <line
          x1={x(peak.hour)} y1={PAD.t} x2={x(peak.hour)} y2={PAD.t + innerH}
          stroke="var(--color-accent-hazard)" strokeWidth="1.4" strokeDasharray="3 3"
        />
        <circle cx={x(peak.hour)} cy={y(peak.load)} r="3.5" fill="var(--color-accent-hazard)" />

        {[hMin, Math.round((hMin + hMax) / 2), hMax].map((h) => (
          <text
            key={h} x={x(h)} y={H - 8} textAnchor="middle"
            fontSize="9" fill="var(--color-text-quaternary)" fontFamily="var(--font-mono)"
          >
            {h}h
          </text>
        ))}
      </svg>
    </div>
  );
}
