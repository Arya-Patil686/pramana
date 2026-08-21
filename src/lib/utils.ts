/* ═══════════════════════════════════════════════════════════
   PRAMĀNA — Utility Functions
   ═══════════════════════════════════════════════════════════ */

/**
 * Merge class names, filtering falsy values.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a SHA-256 hash for display: first 8 + "…" + last 6 chars.
 */
export function formatHash(hash: string, prefix = true): string {
  const clean = prefix ? hash : hash.replace(/^sha256:/, "");
  if (clean.length <= 20) return clean;
  return `${clean.slice(0, 14)}…${clean.slice(-6)}`;
}

/**
 * Get full hash without truncation (for copy).
 */
export function fullHash(hash: string): string {
  return hash;
}

/**
 * Format AQI value with category label.
 */
export function formatAQI(aqi: number): { value: number; label: string; color: string } {
  if (aqi <= 50) return { value: aqi, label: "Good", color: "#2FBFB0" };
  if (aqi <= 100) return { value: aqi, label: "Satisfactory", color: "#2FBFB0" };
  if (aqi <= 200) return { value: aqi, label: "Moderate", color: "#E3A84E" };
  if (aqi <= 300) return { value: aqi, label: "Poor", color: "#E0603F" };
  if (aqi <= 400) return { value: aqi, label: "Very Poor", color: "#C94430" };
  return { value: aqi, label: "Severe", color: "#A82E1F" };
}

/**
 * Get GRAP stage from AQI value.
 */
export function getGRAPStage(aqi: number): { stage: string; label: string; color: string } {
  if (aqi >= 451) return { stage: "IV", label: "Severe+", color: "#7D1A10" };
  if (aqi >= 401) return { stage: "III", label: "Severe", color: "#A82E1F" };
  if (aqi >= 301) return { stage: "II", label: "Very Poor", color: "#C94430" };
  if (aqi >= 201) return { stage: "I", label: "Poor", color: "#E0603F" };
  return { stage: "—", label: "Below GRAP", color: "#2FBFB0" };
}

/**
 * Interpolate between two colors based on t (0–1).
 */
export function lerpColor(color1: string, color2: string, t: number): string {
  const hex = (c: string) => parseInt(c, 16);
  const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * AQI to color on the hazard scale.
 */
export function aqiToColor(aqi: number): string {
  if (aqi <= 100) return "#2FBFB0";
  if (aqi <= 200) return "#E3A84E";
  if (aqi <= 300) return "#E0603F";
  if (aqi <= 400) return "#C94430";
  return "#A82E1F";
}

/**
 * Format a number with commas.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

/**
 * Format coordinates for display.
 */
export function formatCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

/**
 * Delay utility for animations.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
