import type { Metadata } from "next";
import Link from "next/link";
import { Shell, StatusChip } from "@/components/ui/primitives";
import { IconDivergent, IconSealed } from "@/components/icons";

export const metadata: Metadata = {
  title: "Federation topology",
  description:
    "Each nation runs its own PRAMANA node. Model weight deltas, attribution certificates and coarse aggregates cross the border. Raw monitoring data never does.",
};

/*
   Federation.

   The page exists to answer the one question a ministry actually asks, which
   is "why would we hand you our raw monitoring data". The answer has to be
   architectural, not reassuring, so the diagram enumerates exactly three
   artefact classes that cross and names what stays put.
*/

const CROSSES = [
  {
    artefact: "Model weight deltas",
    detail:
      "Gradient updates for the shared spike forecaster, combined by federated averaging. Carries no observation, only the change the observations induced.",
    class: "FED-W",
  },
  {
    artefact: "Attribution certificates",
    detail:
      "The contribution vector plus its provenance block. Hashes of inputs, never the inputs themselves.",
    class: "CERT",
  },
  {
    artefact: "Coarse gridded aggregates",
    detail:
      "Cell aggregates at a resolution floor each nation sets for itself in its own node policy file.",
    class: "AGG",
  },
];

const STAYS = [
  "Raw CPCB or PCD station time series",
  "Ungridded satellite granules held in-country",
  "Citizen photographs and their EXIF",
  "Contributor identities and trust scores",
  "Any cell aggregate below the national resolution floor",
];

const ROUNDS = [
  { round: 47, node: "IN-01", samples: 18_432, delta: "0.0143", status: "merged" },
  { round: 47, node: "TH-01", samples: 9_104, delta: "0.0219", status: "merged" },
  { round: 46, node: "IN-01", samples: 17_890, delta: "0.0168", status: "merged" },
  { round: 46, node: "TH-01", samples: 8_766, delta: "0.0247", status: "merged" },
  { round: 45, node: "TH-01", samples: 8_201, delta: "0.0612", status: "rejected" },
];

function TopologyDiagram() {
  return (
    <figure className="panel bezel">
      <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
        <span className="label-technical">Node topology</span>
        <span className="readout text-2xs text-text-quaternary">2 nodes · 1 boundary</span>
      </div>

      <div className="bg-bg-inset">
        <svg viewBox="0 0 1000 420" className="block w-full" role="img"
          aria-label="Two sovereign nodes exchanging three artefact classes across a border">
          <defs>
            <marker id="fed-arrow" viewBox="0 0 8 8" refX="7" refY="4"
              markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 1 L7 4 L0 7 z" fill="#2fbfb0" />
            </marker>
          </defs>

          {/* Border */}
          <line x1="500" y1="24" x2="500" y2="396" stroke="#3a4857" strokeWidth="1.5" strokeDasharray="7 6" />
          <text x="500" y="18" textAnchor="middle" fill="#5b6775" fontSize="12"
            fontFamily="var(--font-mono)" letterSpacing="2">
            SOVEREIGN BOUNDARY
          </text>

          {/* Nodes */}
          {[
            { x: 90, label: "NODE IN-01", sub: "India", corridor: "Punjab → Delhi NCR" },
            { x: 610, label: "NODE TH-01", sub: "Thailand", corridor: "N. Thailand → Bangkok" },
          ].map((n) => (
            <g key={n.label}>
              <rect x={n.x} y="60" width="300" height="300" fill="#10171f" stroke="#26313e" />
              <rect x={n.x} y="60" width="300" height="30" fill="#17202a" />
              <text x={n.x + 12} y="80" fill="#e3a84e" fontSize="13" fontFamily="var(--font-mono)" letterSpacing="1">
                {n.label}
              </text>
              <text x={n.x + 288} y="80" textAnchor="end" fill="#5b6775" fontSize="12" fontFamily="var(--font-mono)">
                {n.sub}
              </text>

              {/* Layers held inside the node */}
              {[
                { y: 108, t: "L1 Ingest · raw granules", locked: true },
                { y: 148, t: "L2 Harmonise · 0.1° grid", locked: true },
                { y: 188, t: "L3 Sense · citizen intake", locked: true },
                { y: 228, t: "L4 Forecast · spike model", locked: false },
                { y: 268, t: "L5 Attribute · SRAE", locked: false },
                { y: 308, t: "L6 Prove · certificates", locked: false },
              ].map((l) => (
                <g key={l.t}>
                  <rect x={n.x + 14} y={l.y} width="272" height="28"
                    fill={l.locked ? "#080c11" : "#141c26"}
                    stroke={l.locked ? "#1a222c" : "#26313e"} />
                  <rect x={n.x + 14} y={l.y} width="3" height="28"
                    fill={l.locked ? "#dd5e3c" : "#2fbfb0"} />
                  <text x={n.x + 26} y={l.y + 18} fill={l.locked ? "#5b6775" : "#96a2b0"}
                    fontSize="12" fontFamily="var(--font-mono)">
                    {l.t}
                  </text>
                </g>
              ))}

              <text x={n.x + 14} y="352" fill="#3d4854" fontSize="11" fontFamily="var(--font-mono)">
                {n.corridor}
              </text>
            </g>
          ))}

          {/* Crossing artefacts */}
          {[
            { y: 242, label: "FED-W  weight deltas" },
            { y: 282, label: "CERT   certificates" },
            { y: 322, label: "AGG    coarse aggregates" },
          ].map((c) => (
            <g key={c.label}>
              <line x1="392" y1={c.y} x2="606" y2={c.y} stroke="#2fbfb0" strokeWidth="1.3"
                markerEnd="url(#fed-arrow)" opacity="0.85" />
              <line x1="606" y1={c.y + 12} x2="392" y2={c.y + 12} stroke="#2fbfb0" strokeWidth="1.3"
                markerEnd="url(#fed-arrow)" opacity="0.4" />
              <rect x="418" y={c.y - 26} width="168" height="20" fill="#0b1015" />
              <text x="502" y={c.y - 11} textAnchor="middle" fill="#2fbfb0"
                fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.5">
                {c.label}
              </text>
            </g>
          ))}

          {/* Blocked */}
          <g>
            <line x1="392" y1="140" x2="606" y2="140" stroke="#dd5e3c" strokeWidth="1.2"
              strokeDasharray="4 4" opacity="0.55" />
            <g transform="translate(486, 126)">
              <rect width="30" height="28" fill="#0b1015" />
              <path d="M6 8 L24 26 M24 8 L6 26" stroke="#dd5e3c" strokeWidth="1.8" />
            </g>
            <rect x="404" y="98" width="196" height="20" fill="#0b1015" />
            <text x="502" y="113" textAnchor="middle" fill="#dd5e3c"
              fontSize="11" fontFamily="var(--font-mono)" letterSpacing="0.5">
              RAW OBSERVATIONS BLOCKED
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="border-t border-border-subtle px-3.5 py-3">
        <p className="text-sm leading-relaxed text-text-secondary">
          Layers L1 to L3 never leave the node that owns them. Only the three
          artefact classes above traverse the boundary, and each nation&apos;s
          node policy file declares which of the three it is willing to emit.
          Federation is opt-in per artefact class, not all-or-nothing.
        </p>
      </figcaption>
    </figure>
  );
}

export default function FederationPage() {
  return (
    <div className="pb-24">
      <Shell wide className="pt-12">
        <header className="max-w-3xl">
          <div className="label-technical">Federation topology</div>
          <h1 className="mt-3 font-display text-xl font-medium text-text-primary sm:text-2xl">
            Sharing a model without surrendering the data.
          </h1>
          <p className="mt-4 text-md leading-relaxed text-text-secondary">
            Any design that requires centralised raw monitoring data is dead on
            arrival at a ministry. Each nation operates its own node, and the
            architecture is arranged so that the question of trust never
            requires anyone to hand over their observations.
          </p>
        </header>

        <div className="mt-10">
          <TopologyDiagram />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {/* Crosses */}
          <section>
            <div className="flex items-center gap-3">
              <IconSealed size={15} className="text-accent-clear" />
              <h2 className="font-display text-lg font-medium text-text-primary">
                What crosses
              </h2>
            </div>
            <div className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
              {CROSSES.map((c) => (
                <div key={c.artefact} className="py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-medium text-text-primary">
                      {c.artefact}
                    </h3>
                    <StatusChip tone="clear">{c.class}</StatusChip>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {c.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Stays */}
          <section>
            <div className="flex items-center gap-3">
              <IconDivergent size={15} className="text-accent-hazard" />
              <h2 className="font-display text-lg font-medium text-text-primary">
                What never crosses
              </h2>
            </div>
            <ul className="mt-5 divide-y divide-border-subtle border-y border-border-subtle">
              {STAYS.map((s) => (
                <li key={s} className="flex items-baseline gap-3 py-3.5">
                  <span className="mt-1.5 block h-px w-4 shrink-0 bg-accent-hazard" />
                  <span className="text-sm text-text-secondary">{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-2xs leading-relaxed text-text-quaternary">
              The resolution floor is set per nation in its node policy file and
              is enforced at emission, not by convention. A node that lowers its
              floor is making a sovereign decision, logged as such.
            </p>
          </section>
        </div>

        {/* Round log */}
        <section className="mt-12">
          <h2 className="font-display text-lg font-medium text-text-primary">
            Federated averaging log
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            One real round beats ten architecture slides. Each entry records the
            sample count backing a node&apos;s update and the L2 norm of its
            weight delta. Updates whose norm exceeds the round threshold are
            rejected rather than averaged in, which is the defence against a
            single node dragging the shared model.
          </p>

          <div className="panel bezel mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border-subtle">
                  {["Round", "Node", "Samples", "‖Δw‖₂", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-3.5 py-2.5 text-left">
                      <span className="label-technical">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUNDS.map((r, i) => (
                  <tr key={`${r.round}-${r.node}-${i}`} className="border-b border-border-subtle last:border-0">
                    <td className="readout px-3.5 py-3 text-2xs text-text-tertiary">
                      #{r.round}
                    </td>
                    <td className="readout px-3.5 py-3 text-2xs text-text-primary">
                      {r.node}
                    </td>
                    <td className="readout px-3.5 py-3 text-2xs text-text-secondary">
                      {r.samples.toLocaleString("en-IN")}
                    </td>
                    <td className="readout px-3.5 py-3 text-2xs text-text-secondary">
                      {r.delta}
                    </td>
                    <td className="px-3.5 py-3">
                      <StatusChip tone={r.status === "merged" ? "clear" : "hazard"}>
                        {r.status}
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/privacy#node-policy"
            className="inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent-verify hover:text-accent-verify"
          >
            Read the node emission policy
          </Link>
          <Link
            href="/validation#schema"
            className="inline-flex items-center gap-2.5 border border-border-default px-5 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
          >
            Interop schema
          </Link>
        </div>
      </Shell>
    </div>
  );
}
