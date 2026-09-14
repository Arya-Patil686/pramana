import { cn } from "@/lib/utils";

/*
   Shared structural primitives.

   Every figure on the site is wrapped in <Figure>, which forces a caption and
   a source line. That constraint is the reason the visuals read as instrument
   output rather than decoration.

   These carry the editorial voice for the analytical pages the way
   illustration/scene.tsx carries it for the narrative ones. Changing the
   vocabulary here is what moved /report, /advisory and /integration onto the
   new language without touching those files — the same reason the palette was
   remapped under the existing token names rather than rewritten per page.
*/

export function SectionHeader({
  index,
  kicker,
  title,
  lede,
  align = "left",
  className,
}: {
  index?: string;
  kicker?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <header
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {(index || kicker) && (
        <div
          className={cn(
            "kicker mb-4 flex items-center gap-2.5 text-text-tertiary",
            align === "center" && "justify-center"
          )}
        >
          {/* A drawn rule rather than a numbered chip: the index is still
              carried, but as part of the line instead of a badge. */}
          <span className="inline-block h-px w-6 bg-current" aria-hidden="true" />
          {index && index !== "—" && <span className="text-accent-verify">{index}</span>}
          {kicker && <span>{kicker}</span>}
        </div>
      )}
      <h2 className="poster text-[clamp(1.4rem,3vw,2.15rem)] text-text-primary">
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-text-secondary",
            align === "center" && "mx-auto"
          )}
        >
          {lede}
        </p>
      )}
    </header>
  );
}

export function Figure({
  children,
  caption,
  source,
  label,
  className,
  bodyClassName,
}: {
  children: React.ReactNode;
  caption: React.ReactNode;
  source?: string;
  label?: string;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <figure className={cn("border border-[var(--color-ink-hair)] bg-bg-surface", className)}>
      {label && (
        <div className="border-b border-border-subtle px-4 py-2.5">
          <span className="smallcaps text-text-tertiary">{label}</span>
        </div>
      )}
      <div className={cn("relative", bodyClassName)}>{children}</div>
      <figcaption className="border-t border-border-subtle px-4 py-3.5">
        <p className="text-sm leading-relaxed text-text-secondary">{caption}</p>
        {source && (
          <p className="font-technical mt-1.5 text-2xs text-text-quaternary">{source}</p>
        )}
      </figcaption>
    </figure>
  );
}

export function Readout({
  label,
  value,
  unit,
  tone = "default",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: "default" | "verify" | "hazard" | "clear" | "signal";
  hint?: string;
  className?: string;
}) {
  const toneClass = {
    default: "text-text-primary",
    verify: "text-accent-verify",
    hazard: "text-accent-hazard",
    clear: "text-accent-clear",
    signal: "text-accent-signal",
  }[tone];

  return (
    <div className={cn("bg-bg-base px-4 py-3.5", className)}>
      <div className="smallcaps text-text-tertiary">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("poster text-[1.5rem] leading-none", toneClass)}>
          {value}
        </span>
        {unit && (
          <span className="font-technical text-2xs text-text-tertiary">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="mt-2 text-2xs leading-snug text-text-quaternary">{hint}</div>
      )}
    </div>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
  pulse = false,
}: {
  tone?: "neutral" | "verify" | "hazard" | "clear" | "signal";
  children: React.ReactNode;
  pulse?: boolean;
}) {
  const map = {
    neutral: "border-border-default text-text-tertiary",
    verify: "border-accent-verify-dim text-accent-verify",
    hazard: "border-accent-hazard-dim text-accent-hazard",
    clear: "border-accent-clear-dim text-accent-clear",
    signal: "border-accent-signal-dim text-accent-signal",
  }[tone];

  const dot = {
    neutral: "bg-text-quaternary",
    verify: "bg-accent-verify",
    hazard: "bg-accent-hazard",
    clear: "bg-accent-clear",
    signal: "bg-accent-signal",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1",
        map
      )}
    >
      <span
        className={cn("block h-1.5 w-1.5 rounded-full", dot, pulse && "hazard-pulse")}
        aria-hidden="true"
      />
      <span className="smallcaps">{children}</span>
    </span>
  );
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cn("hairline", className)} />;
}

/** Page-width wrapper. One measure for the whole site. */
export function Shell({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 lg:px-10",
        wide ? "max-w-[1500px]" : "max-w-[1180px]",
        className
      )}
    >
      {children}
    </div>
  );
}
