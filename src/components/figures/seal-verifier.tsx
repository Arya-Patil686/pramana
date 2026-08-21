"use client";

import { useCallback, useMemo, useState } from "react";
import type { Certificate } from "@/data/mock-certificates";
import {
  abbreviate,
  buildMerkleTree,
  leafPreimage,
  sha256Hex,
} from "@/lib/merkle";
import { cn, delay } from "@/lib/utils";
import { IconSealed, IconDivergent, IconHash } from "@/components/icons";
import { StatusChip } from "@/components/ui/primitives";

/*
   The verifier.

   This is not a simulation of verification. Pressing the button recomputes
   every leaf digest with Web Crypto from the published pre-image, folds the
   tree, and compares the result against the root the certificate claims. If a
   leaf were altered in the data file, this panel would report exactly which
   one diverged, which is the behaviour the whole platform is arguing for.
*/

type LeafState = "idle" | "hashing" | "match" | "divergent";

interface LeafRow {
  index: number;
  label: string;
  dataSource: string;
  claimed: string;
  computed?: string;
  state: LeafState;
}

export function SealVerifier({ certificate }: { certificate: Certificate }) {
  const initialRows = useMemo<LeafRow[]>(
    () =>
      certificate.inputHashes.map((leaf) => ({
        index: leaf.index,
        label: leaf.label,
        dataSource: leaf.dataSource,
        claimed: leaf.hash.replace(/^sha256:/, ""),
        state: "idle" as LeafState,
      })),
    [certificate]
  );

  const [rows, setRows] = useState<LeafRow[]>(initialRows);
  const [running, setRunning] = useState(false);
  const [levels, setLevels] = useState<string[][]>([]);
  const [computedRoot, setComputedRoot] = useState<string | null>(null);
  const [foldedTo, setFoldedTo] = useState(0);

  const claimedRoot = certificate.merkleRoot.replace(/^sha256:/, "");
  const settled = computedRoot !== null;
  const rootMatches = settled && computedRoot === claimedRoot;
  const anyDivergent = rows.some((r) => r.state === "divergent");

  const run = useCallback(async () => {
    setRunning(true);
    setComputedRoot(null);
    setLevels([]);
    setFoldedTo(0);
    setRows(initialRows);

    const computedLeaves: string[] = [];

    // Leaf pass. Each digest is recomputed from the published pre-image.
    for (let i = 0; i < initialRows.length; i++) {
      const row = initialRows[i];
      setRows((prev) =>
        prev.map((r, j) => (j === i ? { ...r, state: "hashing" } : r))
      );
      await delay(90);

      const computed = await sha256Hex(
        leafPreimage(certificate.id, row.index, row.label, row.dataSource)
      );
      computedLeaves.push(computed);

      setRows((prev) =>
        prev.map((r, j) =>
          j === i
            ? {
                ...r,
                computed,
                state: computed === r.claimed ? "match" : "divergent",
              }
            : r
        )
      );
    }

    // Fold the tree one level at a time so the reduction is legible.
    const tree = await buildMerkleTree(computedLeaves);
    setLevels(tree.levels);
    for (let l = 1; l < tree.levels.length; l++) {
      await delay(220);
      setFoldedTo(l);
    }

    await delay(160);
    setComputedRoot(tree.root);
    setRunning(false);
  }, [certificate.id, initialRows]);

  const reset = useCallback(() => {
    setRows(initialRows);
    setLevels([]);
    setFoldedTo(0);
    setComputedRoot(null);
  }, [initialRows]);

  return (
    <div
      className={cn(
        "panel bezel transition-colors duration-500",
        settled && rootMatches && "sealed"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <IconHash size={13} className="text-text-tertiary" />
          <span className="label-technical">Independent verification</span>
        </div>
        {settled ? (
          <StatusChip tone={rootMatches ? "verify" : "hazard"}>
            {rootMatches ? "Root reproduced" : "Divergence"}
          </StatusChip>
        ) : (
          <StatusChip tone="neutral" pulse={running}>
            {running ? "Recomputing" : "Not verified"}
          </StatusChip>
        )}
      </div>

      {/* Method statement */}
      <div className="border-b border-border-subtle bg-bg-inset px-3.5 py-3">
        <div className="label-technical">Pre-image rule</div>
        <code className="readout mt-1.5 block break-all text-2xs leading-relaxed text-text-secondary">
          leaf(i) = SHA256(&quot;pramana.v1.leaf|&quot; + certId + &quot;|&quot;
          + i + &quot;|&quot; + label + &quot;|&quot; + dataSource)
          <br />
          parent = SHA256(&quot;pramana.v1.node|&quot; + leftHex + rightHex)
        </code>
        <p className="mt-2 text-2xs leading-relaxed text-text-quaternary">
          Recomputed in your browser with Web Crypto. No result is sent
          anywhere and nothing is fetched.
        </p>
      </div>

      {/* Leaves */}
      <ul className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <li
            key={row.index}
            className={cn(
              "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden px-3.5 py-2.5 transition-colors",
              row.state === "hashing" && "bg-bg-surface-2",
              row.state === "divergent" && "bg-accent-hazard-dim/25"
            )}
          >
            {row.state === "hashing" && (
              <span className="scan-line pointer-events-none absolute inset-x-0 top-0 h-px bg-accent-verify" />
            )}
            <span className="readout w-5 text-2xs text-text-quaternary">
              {String(row.index).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-text-primary">
                {row.label}
              </span>
              <span className="readout block truncate text-2xs text-text-quaternary">
                {row.dataSource}
              </span>
            </span>
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  "readout text-2xs",
                  row.state === "match" && "text-accent-clear",
                  row.state === "divergent" && "text-accent-hazard",
                  (row.state === "idle" || row.state === "hashing") &&
                    "text-text-quaternary"
                )}
              >
                {abbreviate(row.computed ?? row.claimed)}
              </span>
              {row.state === "match" && (
                <IconSealed size={13} className="text-accent-clear" />
              )}
              {row.state === "divergent" && (
                <IconDivergent size={13} className="text-accent-hazard" />
              )}
              {row.state === "hashing" && (
                <span className="block h-1.5 w-1.5 animate-pulse bg-accent-verify" />
              )}
              {row.state === "idle" && (
                <span className="block h-1.5 w-1.5 bg-text-quaternary/40" />
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Tree reduction */}
      {levels.length > 1 && (
        <div className="border-t border-border-subtle px-3.5 py-4">
          <div className="label-technical">Tree reduction</div>
          <div className="mt-3 space-y-2">
            {levels.slice(1).map((level, i) => {
              const shown = i + 1 <= foldedTo;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="readout w-12 shrink-0 text-2xs text-text-quaternary">
                    L{i + 1}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {level.map((hash, j) => (
                      <span
                        key={j}
                        className={cn(
                          "readout border px-1.5 py-0.5 text-2xs transition-all duration-300",
                          shown
                            ? "border-accent-verify-dim bg-accent-verify/8 text-accent-verify opacity-100"
                            : "border-border-subtle text-text-quaternary opacity-25"
                        )}
                      >
                        {shown ? abbreviate(hash) : "————————"}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Root comparison */}
      <div className="border-t border-border-subtle px-3.5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="label-technical">Root on certificate</div>
            <div className="hash-block mt-1.5">{claimedRoot}</div>
          </div>
          <div>
            <div className="label-technical">Root recomputed here</div>
            <div
              className={cn(
                "hash-block mt-1.5",
                settled &&
                  (rootMatches
                    ? "border-l-accent-clear text-accent-clear"
                    : "border-l-accent-hazard text-accent-hazard")
              )}
            >
              {computedRoot ?? "awaiting verification"}
            </div>
          </div>
        </div>

        {settled && (
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed",
              rootMatches ? "text-text-secondary" : "text-accent-hazard"
            )}
          >
            {rootMatches ? (
              <>
                All {rows.length} inputs and every internal node reproduced.
                The party named in this certificate can run these same steps
                and reach this same root.
              </>
            ) : (
              <>
                Verification failed on {rows.filter((r) => r.state === "divergent").length}{" "}
                input(s). A structured diff of the diverging leaves is shown
                above, which is what a challenge to this attribution would
                need to cite.
              </>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running}
            className={cn(
              "inline-flex items-center gap-2.5 border px-4 py-2 text-sm transition-colors",
              running
                ? "cursor-wait border-border-default text-text-tertiary"
                : "border-accent-verify bg-accent-verify/10 text-accent-verify hover:bg-accent-verify/20"
            )}
          >
            <IconSealed size={14} />
            {running ? "Recomputing digests" : "Run verification"}
          </button>
          {settled && !running && (
            <button
              type="button"
              onClick={reset}
              className="border border-border-default px-4 py-2 text-sm text-text-secondary transition-colors hover:border-border-lit hover:text-text-primary"
            >
              Reset
            </button>
          )}
          <span className="readout text-2xs text-text-quaternary">
            {certificate.computeEnvironment} ·{" "}
            {(certificate.executionDurationMs / 1000).toFixed(1)} s pipeline run
          </span>
        </div>

        {anyDivergent && (
          <p className="mt-3 text-2xs text-text-quaternary">
            Divergence here means the stored certificate no longer matches its
            declared inputs. Regenerate with{" "}
            <code className="readout text-text-tertiary">
              node scripts/build-certificate-hashes.mjs
            </code>
            .
          </p>
        )}
      </div>
    </div>
  );
}
