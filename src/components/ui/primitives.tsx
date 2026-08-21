import { cn } from "@/lib/utils";

/*
   Shared structural primitives. Every figure on the site is wrapped in
   <Figure>, which forces a caption and a source line. That constraint is
   the reason the visuals read as instrument output rather than decoration.
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
            "mb-4 flex items-center gap-3",
            align === "center" && "justify-center"
          )}
        >
          {index && (
            <span className="readout border border-border-default px-1.5 py-0.5 text-2xs text-accent-verify">
              {index}
            </span>
          )}
          {kicker && <span className="label-technical">{kicker}</span>}
        </div>
      )}
      <h2 className="font-display text-xl font-medium text-text-primary sm:text-2xl">
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            "mt-5 max-w-2xl text-md leading-relaxed text-text-secondary",
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
    <figure className={cn("panel bezel", className)}>
      {label && (
        <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2">
          <span className="label-technical">{label}</span>
          <span className="flex items-center gap-1.5">
            <span className="block h-1 w-1 bg-accent-clear" />
            <span className="readout text-2xs text-text-quaternary">RENDERED</span>
          </span>
        </div>
      )}
      <div className={cn("relative", bodyClassName)}>{children}</div>
      <figcaption className="border-t border-border-subtle px-3.5 py-3">
        <p className="text-sm leading-relaxed text-text-secondary">{caption}</p>
        {source && (
          <p className="readout mt-1.5 text-2xs text-text-quaternary">{source}</p>
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
    <div className={cn("panel-inset px-3.5 py-3", className)}>
      <div className="label-technical">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn("readout text-lg font-medium leading-none", toneClass)}>
          {value}
        </span>
        {unit && (
          <span className="readout text-2xs text-text-tertiary">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="mt-1.5 text-2xs leading-snug text-text-quaternary">
          {hint}
        </div>
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
        "inline-flex items-center gap-1.5 border px-2 py-0.5",
        map
      )}
    >
      <span className={cn("block h-1 w-1", dot, pulse && "hazard-pulse")} />
      <span className="readout text-2xs uppercase tracking-[0.1em]">
        {children}
      </span>
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
