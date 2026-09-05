/*
   Flat illustration primitives.

   The rules that keep these looking like one hand drew them:

     · Fills only. A stroke appears where it is a drawn line — a wire, a
       horizon crack, a plant stem — never as an outline around a shape.
     · No gradients. Depth comes from stacking flats and from the scene's own
       horizon, not from shading a single object.
     · Limbs and clouds are built from rounded rectangles and circles at
       consistent radii, which is what makes unrelated objects read as a set.
     · Faces are two dots and, at most, one arc. Detail beyond that pulls the
       eye into a figure that is meant to be read at a glance.

   Everything takes `className` so colour comes from the scene, using the
   palette tokens rather than baked hex. One component, many climates.
*/

export interface PartProps {
  className?: string;
  style?: React.CSSProperties;
}

/* ── Sky furniture ────────────────────────────────────── */

/** A cream cloud: overlapping circles on a flat base, never a blur. */
export function Cloud({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 220 96" className={className} style={style} aria-hidden="true">
      <path
        d="M34 96C15 96 0 82 0 65s15-31 34-31c4 0 8 .6 11 1.8C51 15 70 0 93 0c20 0 37 11 45 28 5-3 11-5 17-5 19 0 34 15 34 34 0 .8 0 1.6-.1 2.4C199 62 210 74 210 88c0 3-.5 5.5-1.4 8H34z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The sun, or the moon: one disc, optional ring. */
export function Disc({ className, style, ring = false }: PartProps & { ring?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden="true">
      {ring && (
        <ellipse
          cx="60" cy="60" rx="58" ry="19"
          fill="none" stroke="currentColor" strokeWidth="3"
          transform="rotate(-22 60 60)" opacity="0.55"
        />
      )}
      <circle cx="60" cy="60" r="38" fill="currentColor" />
    </svg>
  );
}

/** Scattered dots and dashes. The texture that fills the reference skies. */
export function Speckles({ className, seed = 1, count = 34 }: PartProps & { seed?: number; count?: number }) {
  /*
     Deterministic, and pure: the sequence is derived from the index rather
     than advanced through a closure variable, so nothing is reassigned after
     render and the same seed always draws the same field.
  */
  const at = (i: number) => {
    const n = Math.sin((seed * 127.1 + i * 311.7) * 43758.5453);
    return n - Math.floor(n);
  };
  /*
     Rounded before it reaches the DOM. Server and client agreed on the value
     but not on its last decimal digit when serialised, which React reports as
     a hydration mismatch; two decimal places is well past what a 100-unit
     viewBox can resolve anyway.
  */
  const q = (n: number) => Math.round(n * 100) / 100;

  const marks = Array.from({ length: count }, (_, i) => {
    const x = q(at(i * 3) * 100);
    const y = q(at(i * 3 + 1) * 100);
    const r = at(i * 3 + 2);
    const dash = r > 0.62;
    return dash ? (
      <line
        key={i}
        x1={x} y1={y} x2={q(x + 0.9)} y2={q(y + 2.4)}
        stroke="currentColor" strokeWidth="0.32" strokeLinecap="round"
      />
    ) : (
      <circle key={i} cx={x} cy={y} r={q(r * 0.34 + 0.16)} fill="currentColor" />
    );
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden="true">
      {marks}
    </svg>
  );
}

/* ── Flora ────────────────────────────────────────────── */

/** A frond for the scene corners, drawn as leaflets off a stem. */
export function Frond({ className, style, flip = false }: PartProps & { flip?: boolean }) {
  const leaflets = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const q2 = (n: number) => Math.round(n * 100) / 100;
    const y = q2(96 - t * 84);
    const len = q2(26 * (1 - Math.abs(t - 0.35) * 0.85));
    return (
      <g key={i}>
        <ellipse cx={q2(30 - len / 2)} cy={y} rx={q2(len / 2)} ry="5.4" fill="currentColor" transform={`rotate(-22 ${q2(30 - len / 2)} ${y})`} />
        <ellipse cx={q2(30 + len / 2)} cy={y} rx={q2(len / 2)} ry="5.4" fill="currentColor" transform={`rotate(22 ${q2(30 + len / 2)} ${y})`} />
      </g>
    );
  });

  return (
    <svg
      viewBox="0 0 60 100"
      className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}
      aria-hidden="true"
    >
      <path d="M28.6 100V14" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {leaflets}
    </svg>
  );
}

/** A rounded shrub. Three overlapping lobes on a short stem. */
export function Shrub({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 100 80" className={className} style={style} aria-hidden="true">
      <path d="M50 80V44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="30" cy="50" rx="22" ry="17" fill="currentColor" transform="rotate(-18 30 50)" />
      <ellipse cx="70" cy="50" rx="22" ry="17" fill="currentColor" transform="rotate(18 70 50)" />
      <ellipse cx="50" cy="32" rx="24" ry="19" fill="currentColor" />
    </svg>
  );
}

/** Cut stubble rows: what is left standing after the combine. */
export function Stubble({ className, style, rows = 26 }: PartProps & { rows?: number }) {
  const marks = Array.from({ length: rows }, (_, i) => {
    const x = (i / (rows - 1)) * 96 + 2;
    const h = 5 + ((i * 37) % 5);
    return (
      <path
        key={i}
        d={`M${x} 30v-${h}`}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    );
  });
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      {marks}
    </svg>
  );
}

/* ── Fire and smoke ───────────────────────────────────── */

/** One flame. Stack a few at different scales to make a burn line. */
export function Flame({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 40 60" className={className} style={style} aria-hidden="true">
      <path
        d="M20 0c6 12 16 17 16 30 0 12-7 20-16 20S4 42 4 30C4 19 12 14 20 0z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A smoke column. Overlapping discs of decreasing opacity, leaning downwind.
 * `lean` is how far the top drifts, in viewBox units.
 */
export function Smoke({ className, style, lean = 42, puffs = 9 }: PartProps & { lean?: number; puffs?: number }) {
  const discs = Array.from({ length: puffs }, (_, i) => {
    const t = i / (puffs - 1);
    return (
      <circle
        key={i}
        cx={Math.round((20 + t * lean) * 100) / 100}
        cy={Math.round((96 - t * 88) * 100) / 100}
        r={Math.round((7 + t * 15) * 100) / 100}
        fill="currentColor"
        opacity={Math.round((0.92 - t * 0.6) * 100) / 100}
      />
    );
  });
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      {discs}
    </svg>
  );
}

/** A wind arrow: a long shaft with a small open head. */
export function WindArrow({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 120 24" className={className} style={style} aria-hidden="true">
      <path
        d="M0 12h104M92 3l12 9-12 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Figures ──────────────────────────────────────────── */

/*
   The figure system.

   Every person is the same six blocks — two legs, a torso, two arms, a head —
   so a farmer and a minister are visibly the same species of drawing. Only
   the pose, the palette and one prop change between them.
*/

interface FigureProps extends PartProps {
  skin?: string;
  clothes?: string;
  accent?: string;
}

/** A farmer, standing, one hand resting on a rake. */
export function Farmer({ className, style, skin = "var(--color-skin-2)", clothes = "var(--color-flat-teal)", accent = "var(--color-flat-mustard)" }: FigureProps) {
  return (
    <svg viewBox="0 0 120 220" className={className} style={style} aria-hidden="true">
      {/* rake */}
      <path d="M96 214V96" stroke="var(--color-land-burnt)" strokeWidth="4" strokeLinecap="round" />
      <path d="M84 98h24M88 98v-11M96 98v-11M104 98v-11" stroke="var(--color-land-burnt)" strokeWidth="3.4" strokeLinecap="round" fill="none" />

      {/* legs */}
      <rect x="42" y="140" width="14" height="76" rx="7" fill="var(--color-flat-indigo)" />
      <rect x="62" y="140" width="14" height="76" rx="7" fill="var(--color-flat-indigo)" />
      {/* feet */}
      <rect x="36" y="208" width="24" height="10" rx="5" fill="var(--color-hair)" />
      <rect x="60" y="208" width="24" height="10" rx="5" fill="var(--color-hair)" />

      {/* torso */}
      <path d="M40 78c0-9 7-16 16-16h8c9 0 16 7 16 16v56c0 6-5 11-11 11H51c-6 0-11-5-11-11V78z" fill={clothes} />
      {/* arms */}
      <rect x="28" y="80" width="13" height="56" rx="6.5" fill={clothes} />
      <rect x="79" y="80" width="13" height="56" rx="6.5" fill={clothes} transform="rotate(-12 85 108)" />
      {/* hands */}
      <circle cx="34" cy="139" r="7" fill={skin} />
      <circle cx="93" cy="98" r="7" fill={skin} />

      {/* head */}
      <circle cx="60" cy="42" r="21" fill={skin} />
      {/* turban */}
      <path d="M39 40c0-13 9-23 21-23s21 10 21 23c0 3-2 5-5 5H44c-3 0-5-2-5-5z" fill={accent} />
      <path d="M39 40h42" stroke="var(--color-ink)" strokeWidth="1.6" opacity="0.25" />
      {/* face */}
      <circle cx="53" cy="45" r="2.1" fill="var(--color-hair)" />
      <circle cx="67" cy="45" r="2.1" fill="var(--color-hair)" />
      <path d="M53 56q7 5 14 0" stroke="var(--color-hair)" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/** A child, wearing a mask, holding a school bag. */
export function ChildMasked({ className, style, skin = "var(--color-skin-1)", clothes = "var(--color-flat-coral)" }: FigureProps) {
  return (
    <svg viewBox="0 0 110 190" className={className} style={style} aria-hidden="true">
      {/* legs */}
      <rect x="38" y="126" width="12" height="58" rx="6" fill="var(--color-flat-indigo)" />
      <rect x="58" y="126" width="12" height="58" rx="6" fill="var(--color-flat-indigo)" />
      <rect x="32" y="176" width="22" height="10" rx="5" fill="var(--color-hair)" />
      <rect x="56" y="176" width="22" height="10" rx="5" fill="var(--color-hair)" />

      {/* bag strap and bag */}
      <path d="M40 82l30 22" stroke="var(--color-land-burnt)" strokeWidth="4" strokeLinecap="round" />
      <rect x="70" y="96" width="26" height="30" rx="7" fill="var(--color-flat-mustard)" />

      {/* torso */}
      <path d="M36 78c0-8 7-15 15-15h6c8 0 15 7 15 15v46c0 5-4 9-9 9H45c-5 0-9-4-9-9V78z" fill={clothes} />
      {/* arms */}
      <rect x="26" y="80" width="11" height="46" rx="5.5" fill={clothes} />
      <rect x="70" y="80" width="11" height="46" rx="5.5" fill={clothes} />
      <circle cx="31.5" cy="128" r="6" fill={skin} />
      <circle cx="75.5" cy="128" r="6" fill={skin} />

      {/* head */}
      <circle cx="54" cy="44" r="20" fill={skin} />
      {/* hair block */}
      <path d="M34 42c0-13 9-23 20-23s20 10 20 23c0 0-6-7-20-7s-20 7-20 7z" fill="var(--color-hair)" />
      {/* eyes, worried */}
      <circle cx="47" cy="42" r="2.2" fill="var(--color-hair)" />
      <circle cx="61" cy="42" r="2.2" fill="var(--color-hair)" />
      {/* N95 mask */}
      <path d="M38 50c0-2 6-4 16-4s16 2 16 4v6c0 8-7 14-16 14s-16-6-16-14v-6z" fill="var(--color-flat-cream)" />
      <path d="M38 54h32" stroke="var(--color-ink-faint)" strokeWidth="1.4" opacity="0.7" />
      <path d="M38 52l-8-4M70 52l8-4" stroke="var(--color-ink-faint)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * An official, arm extended, pointing. Two of these facing each other across
 * a border is the entire diagnosis the product exists to settle.
 */
export function Official({
  className,
  style,
  skin = "var(--color-skin-2)",
  clothes = "var(--color-flat-indigo)",
  facing = "right",
}: FigureProps & { facing?: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 130 210"
      className={className}
      style={{ ...style, transform: facing === "left" ? "scaleX(-1)" : undefined }}
      aria-hidden="true"
    >
      {/* legs */}
      <rect x="44" y="132" width="14" height="72" rx="7" fill="var(--color-hair)" />
      <rect x="64" y="132" width="14" height="72" rx="7" fill="var(--color-hair)" />
      <rect x="38" y="196" width="24" height="10" rx="5" fill="var(--color-hair)" />
      <rect x="62" y="196" width="24" height="10" rx="5" fill="var(--color-hair)" />

      {/* torso, jacket */}
      <path d="M42 74c0-9 7-16 16-16h6c9 0 16 7 16 16v58c0 5-4 9-9 9H51c-5 0-9-4-9-9V74z" fill={clothes} />
      {/* collar */}
      <path d="M53 58l8 12 8-12" fill="var(--color-flat-cream)" />
      {/* pointing arm */}
      <rect x="76" y="76" width="12" height="52" rx="6" fill={clothes} transform="rotate(-72 82 102)" />
      <circle cx="118" cy="80" r="7" fill={skin} />
      {/* index finger */}
      <path d="M122 78h9" stroke={skin} strokeWidth="5" strokeLinecap="round" />
      {/* other arm */}
      <rect x="30" y="78" width="12" height="50" rx="6" fill={clothes} />
      <circle cx="36" cy="130" r="6.5" fill={skin} />

      {/* head */}
      <circle cx="61" cy="38" r="20" fill={skin} />
      <path d="M41 36c0-12 9-22 20-22s20 10 20 22c0 0-5-8-20-8s-20 8-20 8z" fill="var(--color-hair)" />
      <circle cx="54" cy="38" r="2.1" fill="var(--color-hair)" />
      <circle cx="68" cy="38" r="2.1" fill="var(--color-hair)" />
      {/* set mouth */}
      <path d="M55 50h12" stroke="var(--color-hair)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

/* ── Places ───────────────────────────────────────────── */

/**
 * A Delhi skyline, flat blocks with lit windows. Deliberately generic
 * silhouettes rather than traced landmarks — the argument is about a city of
 * thirty million people, not about a monument.
 */
export function Skyline({ className, style }: PartProps) {
  const towers = [
    { x: 0, w: 42, h: 96 },
    { x: 46, w: 30, h: 140 },
    { x: 80, w: 38, h: 74 },
    { x: 122, w: 26, h: 118 },
    { x: 152, w: 46, h: 92 },
    { x: 202, w: 30, h: 158 },
    { x: 236, w: 40, h: 68 },
    { x: 280, w: 28, h: 126 },
    { x: 312, w: 44, h: 88 },
    { x: 360, w: 32, h: 148 },
    { x: 396, w: 38, h: 78 },
  ];

  return (
    <svg viewBox="0 0 434 170" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      {towers.map((t) => (
        <g key={t.x}>
          <rect x={t.x} y={170 - t.h} width={t.w} height={t.h} fill="currentColor" />
          {Array.from({ length: Math.floor(t.h / 22) }, (_, r) =>
            Array.from({ length: Math.max(1, Math.floor(t.w / 14)) }, (_, c) => {
              /* Deterministic lit/unlit, so windows do not flicker on render. */
              const lit = ((t.x + r * 7 + c * 13) % 5) < 2;
              return lit ? (
                <rect
                  key={`${r}-${c}`}
                  x={t.x + 5 + c * 14}
                  y={170 - t.h + 10 + r * 22}
                  width="6"
                  height="9"
                  fill="var(--color-flat-mustard)"
                  opacity="0.85"
                />
              ) : null;
            })
          )}
        </g>
      ))}
    </svg>
  );
}

/** A monitoring station: a mast, a sensor box and a small dish. */
export function Station({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 80 160" className={className} style={style} aria-hidden="true">
      <path d="M40 158V44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 158l18-30 18 30" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="24" y="52" width="32" height="26" rx="5" fill="currentColor" />
      <path d="M40 44V26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="20" r="7" fill="currentColor" />
      <path d="M56 62h14M56 70h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** The certificate: a sheet, a seal and a ribbon. */
export function Certificate({ className, style }: PartProps) {
  return (
    <svg viewBox="0 0 160 190" className={className} style={style} aria-hidden="true">
      <rect x="8" y="6" width="132" height="164" rx="4" fill="var(--color-flat-cream)" stroke="var(--color-ink)" strokeWidth="3" />
      <path
        d="M28 40h92M28 58h92M28 76h74M28 94h92M28 112h58"
        stroke="var(--color-ink-faint)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* seal */}
      <circle cx="116" cy="146" r="26" fill="var(--color-flat-mustard)" stroke="var(--color-ink)" strokeWidth="3" />
      <path d="M116 132l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3-9.3-4.9-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="var(--color-ink)" />
      {/* ribbon */}
      <path d="M104 168l-8 20 14-6 8 6 6-20z" fill="var(--color-flat-coral)" stroke="var(--color-ink)" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}
