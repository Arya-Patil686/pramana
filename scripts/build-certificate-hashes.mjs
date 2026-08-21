/*
   Regenerates the certificate hashes in src/data/mock-certificates.ts so that
   every digest is a genuine SHA-256 over a declared pre-image, and the Merkle
   intermediates and root are the real reduction of those leaves.

   The hashing rules here must stay identical to src/lib/merkle.ts, which is
   what the browser uses to re-verify. If you change one, change both.

     node scripts/build-certificate-hashes.mjs

   Run it after editing any leaf label or dataSource; otherwise the page will
   correctly report a divergence.
*/

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "src", "data", "mock-certificates.ts");

const LEAF_DOMAIN = "pramana.v1.leaf|";
const NODE_DOMAIN = "pramana.v1.node|";

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

function buildLevels(leafHashes) {
  const levels = [leafHashes.slice()];
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < cur.length; i += 2) {
      const left = cur[i];
      const right = cur[i + 1] ?? cur[i];
      next.push(sha256(`${NODE_DOMAIN}${left}${right}`));
    }
    levels.push(next);
  }
  return levels;
}

let source = readFileSync(target, "utf8");

// Locate each certificate block by its id, then slice to the next one.
const idRe = /id: "(CERT-[A-Z0-9-]+)"/g;
const starts = [];
let m;
while ((m = idRe.exec(source)) !== null) {
  starts.push({ id: m[1], at: m.index });
}

if (starts.length === 0) {
  throw new Error("No certificate blocks found. Has the file format changed?");
}

let rebuilt = "";
let cursor = 0;
let totalLeaves = 0;

for (let c = 0; c < starts.length; c++) {
  const start = starts[c].at;
  const end = c + 1 < starts.length ? starts[c + 1].at : source.length;
  const certId = starts[c].id;
  let block = source.slice(start, end);

  // Collect the declared leaves in order. The two certificate blocks are
  // formatted differently (one expanded, one single-line per leaf), so the
  // separator has to be whitespace-agnostic.
  const leafRe =
    /index: (\d+),\s*label: "([^"]*)",\s*dataSource: "([^"]*)",\s*hash: "([^"]*)"/g;
  const leaves = [];
  let lm;
  while ((lm = leafRe.exec(block)) !== null) {
    leaves.push({
      index: Number(lm[1]),
      label: lm[2],
      dataSource: lm[3],
      raw: lm[0],
    });
  }

  if (leaves.length === 0) {
    rebuilt += source.slice(cursor, end);
    cursor = end;
    continue;
  }

  const leafHashes = leaves.map((l) =>
    sha256(`${LEAF_DOMAIN}${certId}|${l.index}|${l.label}|${l.dataSource}`)
  );
  const levels = buildLevels(leafHashes);
  const root = levels[levels.length - 1][0];
  totalLeaves += leaves.length;

  // Rewrite each leaf hash in place.
  leaves.forEach((leaf, i) => {
    const replacement = leaf.raw.replace(
      /hash: "[^"]*"/,
      `hash: "sha256:${leafHashes[i]}"`
    );
    block = block.replace(leaf.raw, replacement);
  });

  // Rewrite the root.
  block = block.replace(
    /merkleRoot: "[^"]*"/,
    `merkleRoot: "sha256:${root}"`
  );

  // Rebuild the intermediate rows from the real tree.
  const rows = [];
  for (let level = 1; level < levels.length; level++) {
    levels[level].forEach((hash, index) => {
      rows.push(
        `      { level: ${level}, index: ${index}, hash: "sha256:${hash}", children: [${index * 2}, ${index * 2 + 1}], verified: false },`
      );
    });
  }
  block = block.replace(
    /merkleIntermediates: \[[\s\S]*?\n    \],/,
    `merkleIntermediates: [\n${rows.join("\n")}\n    ],`
  );

  rebuilt += source.slice(cursor, start) + block;
  cursor = end;

  console.log(
    `${certId}: ${leaves.length} leaves, ${levels.length - 1} internal levels, root ${root.slice(0, 12)}…`
  );
}

rebuilt += source.slice(cursor);
writeFileSync(target, rebuilt, "utf8");

console.log(
  `\nRewrote ${starts.length} certificate(s), ${totalLeaves} leaves total, into ${target}`
);
