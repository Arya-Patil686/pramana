/*
   PRAMANA icon set.

   Drawn rather than imported. Every glyph is built on a 24-unit grid with
   butt caps and mitre joins, which is what separates a drafting mark from
   the rounded-cap look of an off-the-shelf icon library. Strokes stay
   un-scaled (vector-effect) so a 14px icon renders a true hairline.
*/

export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Glyph({
  size = 16,
  className,
  strokeWidth = 1.25,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/* Airshed: a globe reduced to its graticule. */
export function IconAirshed(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M3.5 12h17" />
      <ellipse cx="12" cy="12" rx="4" ry="8.5" />
    </Glyph>
  );
}

/* Console: a signal trace crossing a threshold. */
export function IconConsole(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 20V4" />
      <path d="M3 20h18" />
      <path d="M3 11h18" strokeDasharray="2 2" opacity="0.55" />
      <path d="M4 17l3.5-2 3 3.5L14 7l3 8 3-4" />
    </Glyph>
  );
}

/* Certificate: a document carrying a seal. */
export function IconCertificate(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 2.5h9l5 5v14H5z" />
      <path d="M14 2.5v5h5" />
      <circle cx="12" cy="14" r="3" />
      <path d="M10.5 16.6L9.5 20l2.5-1.4 2.5 1.4-1-3.4" />
    </Glyph>
  );
}

/* Counterfactual: two parameter tracks at different settings. */
export function IconCounterfactual(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 8h18" />
      <path d="M3 16h18" />
      <rect x="7" y="5.5" width="3" height="5" fill="currentColor" stroke="none" />
      <rect x="15" y="13.5" width="3" height="5" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/* Validation: a measurement bracketed by its error bar. */
export function IconValidation(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 21V3" />
      <path d="M3 21h18" />
      <path d="M8 21V11" />
      <path d="M8 7v4" />
      <path d="M6 7h4" />
      <path d="M14 21V8" />
      <path d="M14 4v4" />
      <path d="M12 4h4" />
      <path d="M20 21v-6" />
    </Glyph>
  );
}

/* Federation: sovereign nodes exchanging along a boundary. */
export function IconFederation(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 2v20" strokeDasharray="2 2" opacity="0.55" />
      <rect x="2.5" y="8" width="6" height="6" />
      <rect x="15.5" y="8" width="6" height="6" />
      <path d="M8.5 11h7" />
      <path d="M13.5 9.4L15.5 11l-2 1.6" />
    </Glyph>
  );
}

/* Advisory: a notice being broadcast. */
export function IconAdvisory(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 9v6h4l6 4V5L8 9H4z" />
      <path d="M17.5 8.5a5 5 0 010 7" />
      <path d="M20 6a8.5 8.5 0 010 12" opacity="0.5" />
    </Glyph>
  );
}

/* Fire: an emission source, drawn as a plume not a cartoon flame. */
export function IconFire(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21c3.6 0 6-2.3 6-5.4 0-3.8-3.4-5.6-3.4-9.6-2 1-2.9 2.7-2.9 4.6 0 1.3-.8 2-1.6 2-.9 0-1.5-.7-1.5-1.9C7 12 6 13.4 6 15.6 6 18.7 8.4 21 12 21z" />
    </Glyph>
  );
}

/* Transport: an advection vector. */
export function IconWind(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2 8h11a3 3 0 10-3-3" />
      <path d="M2 14h15a3 3 0 11-3 3" />
      <path d="M2 11h7" opacity="0.5" />
    </Glyph>
  );
}

/* Station: a fixed reference monitor. */
export function IconStation(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21V11" />
      <path d="M7 21h10" />
      <circle cx="12" cy="8" r="2.5" />
      <path d="M7.4 3.4a6.5 6.5 0 000 9.2" />
      <path d="M16.6 3.4a6.5 6.5 0 010 9.2" />
    </Glyph>
  );
}

/* Hash: provenance. */
export function IconHash(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 3L7 21" />
      <path d="M17 3l-2 18" />
      <path d="M3.5 8.5h17" />
      <path d="M2.5 15.5h17" />
    </Glyph>
  );
}

/* Verified: a struck seal, deliberately not a tick in a rounded box. */
export function IconSealed(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 2.5l2.6 1.9 3.2-.2.7 3.1 2.4 2.1-1.5 2.9 1.5 2.9-2.4 2.1-.7 3.1-3.2-.2L12 21.5l-2.6-1.9-3.2.2-.7-3.1L3.1 14.6l1.5-2.9-1.5-2.9 2.4-2.1.7-3.1 3.2.2z" />
      <path d="M8.6 12.2l2.4 2.4 4.4-4.9" />
    </Glyph>
  );
}

/* Divergence: verification failed, inputs differ. */
export function IconDivergent(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 2.5l9.5 19h-19z" />
      <path d="M12 9v5.5" />
      <path d="M12 17.5v1.5" />
    </Glyph>
  );
}

/* Copy to clipboard. */
export function IconCopy(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" />
      <path d="M15.5 8.5v-5h-12v12h5" />
    </Glyph>
  );
}

/* Directional marks. Straight shafts, no curved flourish. */
export function IconArrowRight(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 12h17" />
      <path d="M14.5 6.5L20 12l-5.5 5.5" />
    </Glyph>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v17" />
      <path d="M6.5 14.5L12 20l5.5-5.5" />
    </Glyph>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13 4h7v7" />
      <path d="M20 4L10 14" />
      <path d="M18 14.5V20H4V6h5.5" />
    </Glyph>
  );
}

/* Satellite pass. */
export function IconSatellite(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="9.5" y="9.5" width="5" height="5" transform="rotate(45 12 12)" />
      <path d="M6.5 6.5L3 3" />
      <path d="M17.5 17.5L21 21" />
      <path d="M2.5 12.5l4-4 3 3-4 4z" />
      <path d="M14.5 8.5l4-4 3 3-4 4z" />
    </Glyph>
  );
}

/* Population exposure. */
export function IconExposure(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="8" cy="7" r="3" />
      <path d="M2.5 20v-2a5.5 5.5 0 0111 0v2" />
      <circle cx="17.5" cy="9" r="2.2" opacity="0.6" />
      <path d="M14 20v-1.5a3.8 3.8 0 017.5 0V20" opacity="0.6" />
    </Glyph>
  );
}

export const NAV_ICONS = {
  airshed: IconAirshed,
  console: IconConsole,
  certificate: IconCertificate,
  counterfactual: IconCounterfactual,
  validation: IconValidation,
  federation: IconFederation,
  advisory: IconAdvisory,
} as const;
