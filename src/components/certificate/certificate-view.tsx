"use client";

import { useMemo, useState } from "react";
import type { Certificate } from "@/data/mock-certificates";
import { SealVerifier } from "@/components/figures/seal-verifier";
import { Shell, StatusChip } from "@/components/ui/primitives";
import { IconCopy, IconHash } from "@/components/icons";
import { leafPreimage } from "@/lib/merkle";
import { cn } from "@/lib/utils";

/*
   Certificate viewer.

   The document, its inputs, and the pre-image of each leaf, all on one page.
   Publishing the pre-image matters: a hash nobody can regenerate is decoration,
   and the argument this project makes is that the accused party regenerates it.
*/

export function CertificateView({
  certificates,
  episodeLabels,
}: {
  certificates: Certificate[];
  episodeLabels: Record<string, string>;
}) {
  const [selected, setSelected] = useState(certificates[0].id);
  const [showPreimages, setShowPreimages] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const certificate = useMemo(
    () => certificates.find((c) => c.id === selected) ?? certificates[0],
    [certificates, selected]
  );
  const episodeName = episodeLabels[certificate.episodeId];

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="pb-24">
      <Shell wide className="pt-12">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="label-technical">Attribution certificate</div>
            <h1 className="mt-3 font-display text-xl font-medium text-text-primary sm:text-2xl">
              The document a rival state can re-run.
            </h1>
            <p className="mt-4 text-md leading-relaxed text-text-secondary">
              Every attribution is emitted as a signed, self-describing artefact
              carrying the digest of each input granule, the model commit, the
              container digest and the parameter set. Nothing here needs to be
              taken on trust.
            </p>
          </div>

          <div className="flex items-stretch border border-border-default">
            {certificates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                aria-pressed={selected === c.id}
                className={cn(
                  "readout px-3 py-2 text-2xs transition-colors",
                  selected === c.id
                    ? "bg-accent-verify/15 text-accent-verify"
                    : "text-text-tertiary hover:text-text-secondary"
                )}
              >
                {c.id.replace("CERT-PRM-", "")}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          {/* Document */}
          <div className="lg:col-span-5">
            <article className="panel bezel sealed">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                <span className="label-technical">Certificate</span>
                <StatusChip tone="verify">Sealed</StatusChip>
              </div>

              <div className="px-4 py-5">
                <div className="readout text-md text-accent-verify">
                  {certificate.id}
                </div>
                {episodeName && (
                  <div className="mt-1.5 text-sm text-text-secondary">
                    {episodeName}
                  </div>
                )}

                <dl className="mt-6 space-y-0">
                  {[
                    ["Episode", certificate.episodeId],
                    ["Schema version", certificate.version],
                    ["Issued", certificate.issuedAt.replace("T", " ").slice(0, 16) + "Z"],
                    ["Expires", certificate.expiresAt.replace("T", " ").slice(0, 16) + "Z"],
                    ["Pipeline", certificate.pipelineVersion],
                    ["Model branch", certificate.modelBranch],
                    ["Execution", `${(certificate.executionDurationMs / 1000).toFixed(2)} s`],
                    ["Compute", certificate.computeEnvironment],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between gap-4 border-b border-border-subtle py-2.5 last:border-0"
                    >
                      <dt className="label-technical shrink-0">{k}</dt>
                      <dd className="readout text-right text-2xs text-text-secondary">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {[
                  ["Model commit", certificate.modelCommit],
                  ["Container digest", certificate.containerDigest],
                  ["Merkle root", certificate.merkleRoot],
                ].map(([label, value]) => (
                  <div key={label} className="mt-5">
                    <div className="flex items-center justify-between">
                      <span className="label-technical">{label}</span>
                      <button
                        type="button"
                        onClick={() => copy(label, value)}
                        className="flex items-center gap-1.5 text-text-quaternary transition-colors hover:text-text-secondary"
                        aria-label={`Copy ${label}`}
                      >
                        <IconCopy size={11} />
                        <span className="readout text-2xs">
                          {copied === label ? "COPIED" : "COPY"}
                        </span>
                      </button>
                    </div>
                    <div className="hash-block mt-1.5">{value}</div>
                  </div>
                ))}

                <p className="mt-6 border-l-2 border-accent-verify-dim pl-4 text-sm leading-relaxed text-text-secondary">
                  {certificate.reproducibilityStatement}
                </p>
              </div>
            </article>
          </div>

          {/* Verifier */}
          <div className="lg:col-span-7">
            <SealVerifier certificate={certificate} />

            {/* Leaf pre-images */}
            <div className="panel bezel mt-8">
              <div className="flex items-center justify-between border-b border-border-subtle px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <IconHash size={13} className="text-text-tertiary" />
                  <span className="label-technical">Input granules</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreimages((v) => !v)}
                  aria-pressed={showPreimages}
                  className={cn(
                    "readout border px-2 py-0.5 text-2xs transition-colors",
                    showPreimages
                      ? "border-accent-verify-dim text-accent-verify"
                      : "border-border-default text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  {showPreimages ? "HIDE PRE-IMAGES" : "SHOW PRE-IMAGES"}
                </button>
              </div>

              <ul className="divide-y divide-border-subtle">
                {certificate.inputHashes.map((leaf) => (
                  <li key={leaf.index} className="px-3.5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex min-w-0 items-baseline gap-2.5">
                        <span className="readout shrink-0 text-2xs text-text-quaternary">
                          {String(leaf.index).padStart(2, "0")}
                        </span>
                        <span className="truncate text-sm text-text-primary">
                          {leaf.label}
                        </span>
                      </div>
                      <span className="readout shrink-0 text-2xs text-text-quaternary">
                        {leaf.dataSource}
                      </span>
                    </div>
                    <div className="hash-block mt-2">{leaf.hash}</div>
                    {showPreimages && (
                      <div className="mt-1.5">
                        <div className="label-technical">Pre-image</div>
                        <div className="hash-block mt-1 border-l-accent-signal-dim text-text-tertiary">
                          {leafPreimage(
                            certificate.id,
                            leaf.index,
                            leaf.label,
                            leaf.dataSource
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="border-t border-border-subtle px-3.5 py-3">
                <p className="text-2xs leading-relaxed text-text-quaternary">
                  Each descriptor ends with the SHA-256 of the data the pipeline actually consumed for that input — the fire detections, the wind-field samples, the CPCB station readings, the computed register and the model configuration. Re-fetch those inputs and re-run the engine, and the digests, leaves and root on this page are reproduced; change any input and the leaf that moved is the one that diverges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    </div>
  );
}
