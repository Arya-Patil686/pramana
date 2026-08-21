import { GAP_COMPARISONS, type GapComparison } from "@/data/mock-benchmarks";
import { cn } from "@/lib/utils";

/*
   Capability matrix.

   Support is drawn as a filled, half or empty square rather than a tick, and
   the fill level is the reading: a partial capability is visibly partial
   rather than a qualified yes. The PRAMANA row is marked, but it does not get
   a full row of fills, because it does not have one.
*/

const AXES: { key: keyof GapComparison; label: string; note: string }[] = [
  { key: "realTimeData", label: "Real-time data", note: "Hourly or better, operational" },
  { key: "forecast", label: "Forecast", note: "Forward-looking, not nowcast only" },
  { key: "attribution", label: "Attribution", note: "Names the upwind source" },
  { key: "verifiable", label: "Independently verifiable", note: "A third party can reproduce it" },
  { key: "crossBorder", label: "Cross-border", note: "Works across a political boundary" },
];

function SupportMark({
  level,
  highlight,
}: {
  level: "yes" | "no" | "partial";
  highlight: boolean;
}) {
  const tone = highlight ? "var(--color-accent-verify)" : "var(--color-text-secondary)";

  return (
    <span
      className="inline-flex items-center gap-2"
      title={level === "yes" ? "Supported" : level === "partial" ? "Partial" : "Not supported"}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <rect
          x="0.6"
          y="0.6"
          width="10.8"
          height="10.8"
          fill="none"
          stroke={level === "no" ? "var(--color-border-strong)" : tone}
          strokeWidth="1"
        />
        {level === "yes" && <rect x="2.4" y="2.4" width="7.2" height="7.2" fill={tone} />}
        {level === "partial" && <rect x="2.4" y="2.4" width="3.6" height="7.2" fill={tone} />}
      </svg>
      <span className="sr-only">
        {level === "yes" ? "Supported" : level === "partial" ? "Partial" : "Not supported"}
      </span>
    </span>
  );
}

export function CapabilityMatrix() {
  return (
    <figure className="panel bezel">
      <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
        <span className="label-technical">Capability matrix</span>
        <div className="flex items-center gap-4">
          {(["yes", "partial", "no"] as const).map((lvl) => (
            <span key={lvl} className="flex items-center gap-1.5">
              <SupportMark level={lvl} highlight={false} />
              <span className="readout text-2xs text-text-quaternary">
                {lvl === "yes" ? "Full" : lvl === "partial" ? "Partial" : "None"}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              <th scope="col" className="px-3.5 py-3 text-left align-bottom">
                <span className="label-technical">System</span>
              </th>
              {AXES.map((axis) => (
                <th key={axis.key} scope="col" className="px-3.5 py-3 text-left align-bottom">
                  <span className="block text-sm font-medium text-text-secondary">
                    {axis.label}
                  </span>
                  <span className="mt-0.5 block text-2xs leading-snug text-text-quaternary">
                    {axis.note}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GAP_COMPARISONS.map((row) => (
              <tr
                key={row.system}
                className={cn(
                  "border-b border-border-subtle last:border-0",
                  row.isPramana && "bg-accent-verify/6"
                )}
              >
                <th scope="row" className="px-3.5 py-3.5 text-left">
                  <span
                    className={cn(
                      "text-sm",
                      row.isPramana
                        ? "font-medium text-accent-verify"
                        : "text-text-primary"
                    )}
                  >
                    {row.system}
                  </span>
                </th>
                {AXES.map((axis) => (
                  <td key={axis.key} className="px-3.5 py-3.5">
                    <SupportMark
                      level={row[axis.key] as "yes" | "no" | "partial"}
                      highlight={row.isPramana}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t border-border-subtle px-3.5 py-3">
        <p className="text-sm leading-relaxed text-text-secondary">
          Every system in this table is competent at its own job. The column
          that stays empty across all four incumbents is independent
          verifiability, and that is the column that decides whether a
          neighbouring jurisdiction acts on the finding or disputes it.
        </p>
      </figcaption>
    </figure>
  );
}
