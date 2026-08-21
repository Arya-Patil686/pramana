/*
   Merkle provenance.

   These are real SHA-256 digests over declared pre-images, not decorative
   hex. The rules below are the whole verification contract, and they are
   deliberately simple enough to reimplement in any language:

     leaf(i)   = SHA256( "pramana.v1.leaf|" + certId + "|" + i + "|" + label
                         + "|" + dataSource )
     parent    = SHA256( "pramana.v1.node|" + leftHex + rightHex )
     odd node  = promoted by pairing with itself
     root      = the single hash remaining at the top level

   Digests are computed with Web Crypto, which exists both in the browser and
   in Node, so the page verifies with exactly the same primitive the pipeline
   would use. A third party re-running these steps on the same inputs gets the
   same root or learns precisely which leaf diverged.
*/

const LEAF_DOMAIN = "pramana.v1.leaf|";
const NODE_DOMAIN = "pramana.v1.node|";

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/** The exact string that is hashed to produce a leaf. Published so it can be reproduced. */
export function leafPreimage(
  certId: string,
  index: number,
  label: string,
  dataSource: string
): string {
  return `${LEAF_DOMAIN}${certId}|${index}|${label}|${dataSource}`;
}

export function nodePreimage(left: string, right: string): string {
  return `${NODE_DOMAIN}${left}${right}`;
}

export interface MerkleTree {
  /** levels[0] is the leaf row; the last level holds exactly one hash. */
  levels: string[][];
  root: string;
}

export async function buildMerkleTree(leafHashes: string[]): Promise<MerkleTree> {
  if (leafHashes.length === 0) {
    throw new Error("Cannot build a Merkle tree with no leaves");
  }

  const levels: string[][] = [leafHashes.slice()];

  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      // An odd node is paired with itself rather than dropped, so the tree
      // shape stays a function of the leaf count alone.
      const right = current[i + 1] ?? current[i];
      next.push(await sha256Hex(nodePreimage(left, right)));
    }
    levels.push(next);
  }

  return { levels, root: levels[levels.length - 1][0] };
}

export interface LeafInput {
  index: number;
  label: string;
  dataSource: string;
}

/** Recompute a certificate's tree from its declared inputs. */
export async function computeCertificateTree(
  certId: string,
  leaves: LeafInput[]
): Promise<MerkleTree> {
  const leafHashes = await Promise.all(
    leaves.map((l) => sha256Hex(leafPreimage(certId, l.index, l.label, l.dataSource)))
  );
  return buildMerkleTree(leafHashes);
}

export interface VerificationDivergence {
  index: number;
  label: string;
  expected: string;
  actual: string;
}

export interface VerificationResult {
  ok: boolean;
  computedRoot: string;
  expectedRoot: string;
  divergences: VerificationDivergence[];
}

/**
 * Re-derive the tree and compare against what the certificate claims.
 * A failure returns the diverging leaves rather than a bare "invalid", which
 * is the difference between an audit and an assertion.
 */
export async function verifyCertificate(
  certId: string,
  leaves: (LeafInput & { hash: string })[],
  claimedRoot: string
): Promise<VerificationResult> {
  const divergences: VerificationDivergence[] = [];
  const leafHashes: string[] = [];

  for (const leaf of leaves) {
    const computed = await sha256Hex(
      leafPreimage(certId, leaf.index, leaf.label, leaf.dataSource)
    );
    leafHashes.push(computed);
    const claimed = leaf.hash.replace(/^sha256:/, "");
    if (claimed !== computed) {
      divergences.push({
        index: leaf.index,
        label: leaf.label,
        expected: claimed,
        actual: computed,
      });
    }
  }

  const tree = await buildMerkleTree(leafHashes);
  const expectedRoot = claimedRoot.replace(/^sha256:/, "");

  return {
    ok: divergences.length === 0 && tree.root === expectedRoot,
    computedRoot: tree.root,
    expectedRoot,
    divergences,
  };
}

/** Display form: first 10 and last 6 characters of the digest. */
export function abbreviate(hash: string): string {
  const clean = hash.replace(/^sha256:/, "");
  if (clean.length <= 20) return clean;
  return `${clean.slice(0, 10)}…${clean.slice(-6)}`;
}
