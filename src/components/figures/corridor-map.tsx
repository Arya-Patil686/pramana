import { project, CORRIDOR_NODES } from "@/lib/corridor-geo";
import type { Trace } from "@/lib/attribution/engine";
import type { FireDetection } from "@/lib/sources/firms";
import type { WindSample } from "@/lib/sources/meteo";
import { cn } from "@/lib/utils";

/*
   The corridor map.

   Editorial cartography, and every mark on it is data. The detections are at
   their true FIRMS coordinates with area scaled to Fire Radiative Power. The
   barbs are the real 925 hPa samples pointing the way the air actually
   travels. The curves are the same trajectories the register is computed
   from, not a drawing of them — if the model changes, the map changes,
   because they are the same numbers.

   There is no basemap and no invented coastline. What a reader sees is what
   was measured, plus a graticule to locate it and the place names needed to
   read it. Anything else on this map would be decoration standing where
   evidence should be.

   Rendered as plain SVG on the server: no map library, no tiles, no client
   JavaScript, and it prints.
*/

/* Padding inside the viewBox, in world units (1 unit = 10 km). */
const PAD = 2.6;

/*
   Every computed coordinate is quantised before it reaches the DOM.

   Server and client agree on these values but not always on the last decimal
   digit once serialised, which React reports as a hydration mismatch. Three
   decimals in a viewBox this size is ~10 m on the ground — far past anything
   the drawing can resolve — so nothing is lost by rounding, and the markup
   gets smaller.
*/
const q = (n: number) => Math.round(n * 1000) / 1000;

export interface CorridorMapProps {
  detections: FireDetection[];
  wind: WindSample[];
  traces?: Trace[];
  /** Which layers to draw. Scenes reveal the map one layer at a time. */
  show?: {
    graticule?: boolean;
    places?: boolean;
    fires?: boolean;
    wind?: boolean;
    traces?: boolean;
    receptor?: boolean;
  };
  /** 0–1. Fires appear in true acquisition order up to this fraction. */
  progress?: number;
  className?: string;
  ink?: string;
}

export function CorridorMap({
  detections,
  wind,
  traces = [],
  show = {},
  progress = 1,
  className,
  ink = "var(--color-ink)",
}: CorridorMapProps) {
  const layers = {
    graticule: true,
    places: true,
    fires: true,
    wind: false,
    traces: false,
    receptor: true,
    ...show,
  };

  /* Bounds come from the data plus the corridor nodes, so the frame always
     holds everything being drawn without a hand-tuned viewBox. */
  const pts: [number, number][] = [
    ...detections.map((d) => project(d.lat, d.lng)),
    ...CORRIDOR_NODES.map((n) => project(n.lat, n.lng)),
    ...wind.map((w) => project(w.lat, w.lng)),
  ];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const minX = q(Math.min(...xs) - PAD);
  const maxX = q(Math.max(...xs) + PAD);
  const minZ = q(Math.min(...zs) - PAD);
  const maxZ = q(Math.max(...zs) + PAD);
  const w = maxX - minX;
  const h = maxZ - minZ;

  const receptor = CORRIDOR_NODES.find((n) => n.kind === "receptor");

  /* Detections are ordered by acquisition so `progress` reveals them in the
     order the satellite actually saw them. */
  const ordered = [...detections].sort(
    (a, b) => Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt)
  );
  const shown = ordered.slice(0, Math.ceil(ordered.length * Math.min(1, Math.max(0, progress))));
  const maxFrp = Math.max(1, ...detections.map((d) => d.frp));

  return (
    <svg
      viewBox={`${minX.toFixed(2)} ${minZ.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`}
      className={cn("h-full w-full", className)}
      role="img"
      aria-label="Punjab to Delhi corridor: fire detections, the 925 hPa wind field and computed transport trajectories"
    >
      {/* ── Graticule, 0.1° — the accumulation grid, not decoration ── */}
      {layers.graticule && (
        <g stroke={ink} strokeWidth={0.012} opacity={0.16}>
          {Array.from({ length: 34 }, (_, i) => {
            const lat = 28.2 + i * 0.1;
            const [, z] = project(lat, 74.6);
            return <line key={`la${i}`} x1={q(minX)} y1={q(z)} x2={q(maxX)} y2={q(z)} />;
          })}
          {Array.from({ length: 34 }, (_, i) => {
            const lng = 74.6 + i * 0.1;
            const [x] = project(28.2, lng);
            return <line key={`ln${i}`} x1={q(x)} y1={q(minZ)} x2={q(x)} y2={q(maxZ)} />;
          })}
        </g>
      )}

      {/* Whole degrees drawn heavier, so the grid can be read as coordinates. */}
      {layers.graticule && (
        <g stroke={ink} strokeWidth={0.03} opacity={0.34}>
          {[29, 30, 31].map((lat) => {
            const [, z] = project(lat, 74.6);
            return <line key={`d${lat}`} x1={q(minX)} y1={q(z)} x2={q(maxX)} y2={q(z)} />;
          })}
          {[75, 76, 77].map((lng) => {
            const [x] = project(28.2, lng);
            return <line key={`m${lng}`} x1={q(x)} y1={q(minZ)} x2={q(x)} y2={q(maxZ)} />;
          })}
        </g>
      )}

      {/* ── Trajectories ─────────────────────────────────── */}
      {layers.traces && traces.length > 0 && (
        <g fill="none" strokeLinecap="round">
          {traces.map((t, i) => {
            const d = t.points
              .map(([la, ln], j) => {
                const [x, z] = project(la, ln);
                return `${j === 0 ? "M" : "L"}${x.toFixed(3)} ${z.toFixed(3)}`;
              })
              .join(" ");
            return (
              <path
                key={i}
                d={d}
                stroke="var(--color-mark-flow)"
                strokeWidth={0.03 + t.weight * 0.11}
                opacity={0.13 + t.weight * 0.5}
              />
            );
          })}
        </g>
      )}

      {/* ── Wind barbs ───────────────────────────────────── */}
      {layers.wind && (
        <g>
          {wind.map((s, i) => {
            const [x, z] = project(s.lat, s.lng);
            /* Screen y grows southward, and bearing is clockwise from north,
               so the shaft is (sin, -cos) of the travel bearing. */
            const rad = (s.bearingTo * Math.PI) / 180;
            const len = 0.5 + s.speed * 0.13;
            const hx = q(x + Math.sin(rad) * len);
            const hz = q(z - Math.cos(rad) * len);
            /* Arrow head, two short strokes back along the shaft. */
            const back = 0.26;
            const spread = 0.42;
            const h1x = q(hx - Math.sin(rad - spread) * back);
            const h1z = q(hz + Math.cos(rad - spread) * back);
            const h2x = q(hx - Math.sin(rad + spread) * back);
            const h2z = q(hz + Math.cos(rad + spread) * back);
            return (
              <g key={i} stroke="var(--color-mark-flow)" strokeWidth={0.05} fill="none" opacity={0.75} strokeLinecap="round">
                <line x1={q(x)} y1={q(z)} x2={hx} y2={hz} />
                <line x1={hx} y1={hz} x2={h1x} y2={h1z} />
                <line x1={hx} y1={hz} x2={h2x} y2={h2z} />
              </g>
            );
          })}
        </g>
      )}

      {/* ── Fire detections ──────────────────────────────── */}
      {layers.fires && (
        <g>
          {shown.map((d, i) => {
            const [x, z] = project(d.lat, d.lng);
            /* Area scales with radiative power, so radius goes as sqrt. */
            const r = q(0.1 + Math.sqrt(d.frp / maxFrp) * 0.42);
            return (
              <g key={`${d.lat}-${d.lng}-${i}`}>
                <circle cx={q(x)} cy={q(z)} r={q(r * 2.1)} fill="var(--color-mark-ember)" opacity={0.1} />
                <circle cx={q(x)} cy={q(z)} r={r} fill="var(--color-mark-ember)" opacity={0.82} />
              </g>
            );
          })}
        </g>
      )}

      {/* ── Receptor ─────────────────────────────────────── */}
      {layers.receptor && receptor && (
        <g>
          {(() => {
            const [x, z] = project(receptor.lat, receptor.lng);
            return (
              <>
                <circle cx={q(x)} cy={q(z)} r={1.05} fill="none" stroke="var(--color-mark-receptor)" strokeWidth={0.05} opacity={0.3} />
                <circle cx={q(x)} cy={q(z)} r={0.5} fill="none" stroke="var(--color-mark-receptor)" strokeWidth={0.07} />
                <circle cx={q(x)} cy={q(z)} r={0.16} fill="var(--color-mark-receptor)" />
              </>
            );
          })()}
        </g>
      )}

      {/* ── Place names ──────────────────────────────────── */}
      {layers.places && (
        <g>
          {CORRIDOR_NODES.filter((n) => n.kind !== "waypoint" || n.contribution).map((n) => {
            const [x, z] = project(n.lat, n.lng);
            const isReceptor = n.kind === "receptor";
            return (
              <g key={n.label}>
                {!isReceptor && <circle cx={q(x)} cy={q(z)} r={0.08} fill={ink} opacity={0.55} />}
                <text
                  x={q(x + 0.3)}
                  y={q(z - 0.24)}
                  fontSize={isReceptor ? 0.62 : 0.46}
                  fontWeight={isReceptor ? 600 : 500}
                  fill={ink}
                  opacity={isReceptor ? 0.92 : 0.62}
                  fontFamily="var(--font-poster)"
                  letterSpacing="0.02"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* ── Scale bar and north ──────────────────────────── */}
      <g transform={`translate(${(minX + 0.9).toFixed(2)}, ${(maxZ - 1.1).toFixed(2)})`}>
        {/* One unit is 10 km; a 5-unit bar is 50 km. */}
        <line x1={0} y1={0} x2={5} y2={0} stroke={ink} strokeWidth={0.07} opacity={0.7} />
        <line x1={0} y1={-0.18} x2={0} y2={0.18} stroke={ink} strokeWidth={0.07} opacity={0.7} />
        <line x1={5} y1={-0.18} x2={5} y2={0.18} stroke={ink} strokeWidth={0.07} opacity={0.7} />
        <text x={0} y={0.72} fontSize={0.4} fill={ink} opacity={0.6} fontFamily="var(--font-mono)">
          50 km
        </text>
      </g>

      <g transform={`translate(${(maxX - 1.4).toFixed(2)}, ${(minZ + 1.5).toFixed(2)})`}>
        <line x1={0} y1={0.55} x2={0} y2={-0.55} stroke={ink} strokeWidth={0.07} opacity={0.7} />
        <path d="M-0.22 -0.24 L0 -0.62 L0.22 -0.24 Z" fill={ink} opacity={0.7} />
        <text x={0} y={1.12} fontSize={0.4} textAnchor="middle" fill={ink} opacity={0.6} fontFamily="var(--font-mono)">
          N
        </text>
      </g>
    </svg>
  );
}
