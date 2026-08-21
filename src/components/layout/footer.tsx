import Link from "next/link";
import { IconExternal } from "@/components/icons";

/*
   The footer doubles as the attribution and licence surface. The plan's
   Rule 03 compliance requirement means every upstream data provider has to
   be named somewhere durable, so it is named here rather than in a file
   nobody opens.
*/

const DATA_SOURCES = [
  {
    name: "NASA FIRMS",
    detail: "VIIRS / MODIS active fire, 375 m",
    href: "https://firms.modaps.eosdis.nasa.gov",
    licence: "NASA open data",
  },
  {
    name: "Copernicus Sentinel-5P",
    detail: "TROPOMI NO₂, SO₂, aerosol index",
    href: "https://sentinels.copernicus.eu",
    licence: "ESA / Copernicus",
  },
  {
    name: "CPCB CAAQMS",
    detail: "Hourly reference station readings",
    href: "https://data.gov.in",
    licence: "GODL India",
  },
  {
    name: "OpenAQ",
    detail: "Harmonised cross-border ground truth",
    href: "https://openaq.org",
    licence: "CC BY 4.0",
  },
  {
    name: "ECMWF ERA5",
    detail: "Wind fields, boundary-layer height",
    href: "https://www.ecmwf.int",
    licence: "Copernicus C3S",
  },
  {
    name: "Google Maps Platform",
    detail: "Air Quality baseline forecast",
    href: "https://developers.google.com/maps/documentation/air-quality",
    licence: "Commercial API",
  },
];

const SECTIONS = [
  {
    heading: "Platform",
    links: [
      { label: "Airshed overview", href: "/" },
      { label: "Operator console", href: "/console" },
      { label: "Attribution certificate", href: "/certificate" },
      { label: "Counterfactual simulator", href: "/counterfactual" },
    ],
  },
  {
    heading: "Evidence",
    links: [
      { label: "Validation protocol", href: "/validation" },
      { label: "Federation topology", href: "/federation" },
      { label: "Interop schema", href: "/validation#schema" },
      { label: "Known failure modes", href: "/validation#failures" },
    ],
  },
  {
    heading: "Governance",
    links: [
      { label: "Data policy", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Node emission policy", href: "/privacy#node-policy" },
      { label: "Attribution language rules", href: "/terms#language" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border-subtle bg-bg-void">
      <div className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10">
        {/* Masthead row */}
        <div className="flex flex-col gap-8 border-b border-border-subtle pb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-lg">
            <div className="flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 1.5l10.5 10.5L12 22.5 1.5 12z"
                  fill="none"
                  stroke="var(--color-accent-verify)"
                  strokeWidth="1.4"
                />
                <path
                  d="M12 7.2l4.8 4.8-4.8 4.8-4.8-4.8z"
                  fill="var(--color-accent-verify)"
                />
              </svg>
              <span className="font-display text-lg font-semibold text-text-primary">
                PRAMĀNA
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">
              Provenance-Ratified Attribution &amp; Mitigation for Airsheds across
              Nations. An operational source-receptor attribution service whose
              every output can be independently reproduced by the party it names.
            </p>
            <p className="mt-4 text-2xs leading-relaxed text-text-quaternary">
              PRAMĀNA publishes contribution registers, not accusations. Every
              figure ships with its confidence interval and its inputs. Read the{" "}
              <Link
                href="/terms#language"
                className="text-text-tertiary underline decoration-border-strong underline-offset-2 hover:text-text-secondary"
              >
                attribution language rules
              </Link>{" "}
              before citing any output.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
            {SECTIONS.map((section) => (
              <div key={section.heading}>
                <h3 className="label-technical">{section.heading}</h3>
                <ul className="mt-3 space-y-1.5">
                  {section.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-text-tertiary transition-colors hover:text-text-primary"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Upstream data attribution */}
        <div className="border-b border-border-subtle py-9">
          <h3 className="label-technical">Upstream data and attribution</h3>
          <div className="mt-4 grid gap-px bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
            {DATA_SOURCES.map((source) => (
              <a
                key={source.name}
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-3 bg-bg-void px-3.5 py-3 transition-colors hover:bg-bg-surface"
              >
                <span className="min-w-0">
                  <span className="block font-technical text-xs text-text-secondary group-hover:text-text-primary">
                    {source.name}
                  </span>
                  <span className="mt-0.5 block text-2xs leading-snug text-text-quaternary">
                    {source.detail}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="readout text-2xs text-text-quaternary">
                    {source.licence}
                  </span>
                  <IconExternal
                    size={11}
                    className="text-text-quaternary group-hover:text-text-tertiary"
                  />
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Build strip */}
        <div className="flex flex-col gap-3 pt-7 text-2xs text-text-quaternary sm:flex-row sm:items-center sm:justify-between">
          <p className="readout">
            pramana-pipeline@0.4.2 · schema brics-airshed/1.0.0 · Apache-2.0
          </p>
          <p className="readout">
            Demonstration deployment. Figures shown are replayed from historical
            episodes and are not a live regulatory feed.
          </p>
        </div>
      </div>
    </footer>
  );
}
