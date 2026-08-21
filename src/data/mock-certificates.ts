/* ═══════════════════════════════════════════════════════════
   PRAMĀNA — Mock Certificate Data
   Cryptographic provenance for Attribution Certificates
   ═══════════════════════════════════════════════════════════ */

export interface MerkleLeaf {
  index: number;
  label: string;
  dataSource: string;
  hash: string;
  verified: boolean;
}

export interface MerkleNode {
  level: number;
  index: number;
  hash: string;
  children: [number, number]; // indices of child nodes
  verified: boolean;
}

export interface Certificate {
  id: string;
  episodeId: string;
  issuedAt: string;
  expiresAt: string;
  version: string;

  /* Model provenance */
  modelCommit: string;
  modelBranch: string;
  containerDigest: string;
  pipelineVersion: string;

  /* Input hashes (leaves of the Merkle tree) */
  inputHashes: MerkleLeaf[];

  /* Merkle tree structure */
  merkleRoot: string;
  merkleIntermediates: MerkleNode[];

  /* Reproducibility */
  reproducibilityStatement: string;
  executionDurationMs: number;
  computeEnvironment: string;
}

/* ── Certificate for Punjab→Delhi episode ─────────────── */
export const CERTIFICATES: Certificate[] = [
  {
    id: "CERT-PRM-2024-1103-001",
    episodeId: "EP-2024-NOV-03",
    issuedAt: "2024-11-03T12:00:00Z",
    expiresAt: "2025-11-03T12:00:00Z",
    version: "1.0.0",

    modelCommit: "a7c3e9f2d1b845e6903fa2c8d7e1b4a5f6c8d9e0",
    modelBranch: "main",
    containerDigest: "sha256:8d3b4c5a6f7e8901d2c3b4a5e6f7089012345678abcdef0123456789abcdef01",
    pipelineVersion: "pramana-pipeline@0.4.2",

    inputHashes: [
      {
        index: 0,
        label: "TROPOMI NO₂ L2",
        dataSource: "Sentinel-5P / TROPOMI",
        hash: "sha256:f4171afe68117466154461ec8170d98ecc4ff4665ca40ff5860a8971d9310620",
        verified: false,
      },
      {
        index: 1,
        label: "TROPOMI AOD",
        dataSource: "Sentinel-5P / TROPOMI",
        hash: "sha256:fb59b7b766588a328c34dcfa34649352298db59479eb93f300e66c2f215b57d8",
        verified: false,
      },
      {
        index: 2,
        label: "FIRMS Active Fire",
        dataSource: "NASA FIRMS / VIIRS+MODIS",
        hash: "sha256:79109f3d69c47f205c570cdd4d678593a16362d933fe8cb1a32c3bf00d133840",
        verified: false,
      },
      {
        index: 3,
        label: "ERA5 Wind Field",
        dataSource: "ECMWF ERA5 Reanalysis",
        hash: "sha256:b69bfe4cd27525e7c2b69f979a2e9302ff5eaf46d9d80a0680f329bb758ca5c7",
        verified: false,
      },
      {
        index: 4,
        label: "CPCB Station CSV",
        dataSource: "CPCB Real-time AQI",
        hash: "sha256:51ba5db29fd868446398432516f11224de2ed5079411a008455891d766b3f7ae",
        verified: false,
      },
      {
        index: 5,
        label: "HYSPLIT Trajectory",
        dataSource: "NOAA HYSPLIT Model",
        hash: "sha256:5613b5b8a33753431966af09dc04a5a46094328d5aadc50fb2f2b01d00f526fb",
        verified: false,
      },
      {
        index: 6,
        label: "Model Weights",
        dataSource: "Federated Average Round #47",
        hash: "sha256:3df0d1292122bcb9d4a525fd3fe5104a5f491c0e0f1e525c7d269407487854c5",
        verified: false,
      },
      {
        index: 7,
        label: "Config & Hyperparams",
        dataSource: "Pipeline Config v0.4.2",
        hash: "sha256:33f18ce64135fb6f8301ca690b08db04d725040b83f860f4d7166b4b68820be2",
        verified: false,
      },
    ],

    merkleRoot: "sha256:84f8c236eab8b2d61678872b5b4d02f196f0a4c228e9d30f1119ba6d38382710",

    merkleIntermediates: [
      { level: 1, index: 0, hash: "sha256:4cd3b4e294802de050ba24fd151329bb2ba17fc2d2affda873eeb0148922d247", children: [0, 1], verified: false },
      { level: 1, index: 1, hash: "sha256:15b18ee5e648c51f3739255e9121fb1fff36bf16008dd701b827500fbc26e1e8", children: [2, 3], verified: false },
      { level: 1, index: 2, hash: "sha256:a2df5d633f90452c72c819fec1c532b2cd2bf05bdc9a8a9d041302a9bfa076e1", children: [4, 5], verified: false },
      { level: 1, index: 3, hash: "sha256:bbe68a96addb166d335ab1e752f637a8eb497834db33f1ddd1410b37a0a145a4", children: [6, 7], verified: false },
      { level: 2, index: 0, hash: "sha256:3f3950c4136e770765c476e1de5c7405e2b2d03f2fdab8bec7c75ad795acd9a8", children: [0, 1], verified: false },
      { level: 2, index: 1, hash: "sha256:38002544534821499ecabde40e8f8582e0760d0b9eb5533f0d50b5b52d82b4b2", children: [2, 3], verified: false },
      { level: 3, index: 0, hash: "sha256:84f8c236eab8b2d61678872b5b4d02f196f0a4c228e9d30f1119ba6d38382710", children: [0, 1], verified: false },
    ],

    reproducibilityStatement:
      "This certificate can be reproduced bit-for-bit by executing the container image identified by the digest above, with the Merkle root hash as the sole input reference. All intermediate computations are deterministic given the pinned random seeds in the config hash.",
    executionDurationMs: 14832,
    computeEnvironment: "2× NVIDIA A100 40GB, Ubuntu 22.04, CUDA 12.1",
  },
  {
    id: "CERT-PRM-2024-0317-001",
    episodeId: "EP-2024-MAR-17",
    issuedAt: "2024-03-17T10:00:00Z",
    expiresAt: "2025-03-17T10:00:00Z",
    version: "1.0.0",

    modelCommit: "b8d4f0a3e2c956f7014ab3d9e8f2c5b6a7d0e1f2",
    modelBranch: "main",
    containerDigest: "sha256:9e4c5b6a7f8e9012d3c4b5a6e7f8090123456789bcdef0234567890abcdef012",
    pipelineVersion: "pramana-pipeline@0.4.2",

    inputHashes: [
      { index: 0, label: "TROPOMI NO₂ L2", dataSource: "Sentinel-5P / TROPOMI", hash: "sha256:ddad6aead8206f2cdbcafe444e2c7b3b8d9e4f7297a9b02a453a3fb404d2930d", verified: false },
      { index: 1, label: "TROPOMI AOD", dataSource: "Sentinel-5P / TROPOMI", hash: "sha256:c33d7ab35fb95ded4bddf9c4de7311fbd48704073366458505041ff9fec2eec8", verified: false },
      { index: 2, label: "FIRMS Active Fire", dataSource: "NASA FIRMS / VIIRS+MODIS", hash: "sha256:541eed0f8eec04faf780ce1f411a2eb9cc9d33a88ea07d0cf4cbe1dcafa0a640", verified: false },
      { index: 3, label: "ERA5 Wind Field", dataSource: "ECMWF ERA5 Reanalysis", hash: "sha256:dc11a09333a6af68992b85e72c1c780a9028ceffb2da24acd7a420a16e7feeba", verified: false },
      { index: 4, label: "PCD Station CSV", dataSource: "Thailand PCD Air Quality", hash: "sha256:07369c427b5fae03b9706b2509161aa6b4675e11d0859b9e311a280df9640388", verified: false },
      { index: 5, label: "HYSPLIT Trajectory", dataSource: "NOAA HYSPLIT Model", hash: "sha256:4358acf7ec7138c74dfa1ec1133c2d1d2bab6177a026981fdc177e288f1457a9", verified: false },
      { index: 6, label: "Model Weights", dataSource: "Federated Average Round #47", hash: "sha256:76a87a91d0cf5a90bbcb033a26e813ed708d4dcdb49971dae8e6fb124e3b09e4", verified: false },
      { index: 7, label: "Config & Hyperparams", dataSource: "Pipeline Config v0.4.2", hash: "sha256:5fffe553d194e01920d2105fa74ba0a770eec8fb44e8d2e780be185bda879aa2", verified: false },
    ],

    merkleRoot: "sha256:0170fd9f8c339ae9d9ba12ff4a1d2546ef7177972c83105ec3010f1f749312ba",

    merkleIntermediates: [
      { level: 1, index: 0, hash: "sha256:2ddaf4d096b0260d999083e35d7946e82d4091e385a63b6c81a823d7a4a497b6", children: [0, 1], verified: false },
      { level: 1, index: 1, hash: "sha256:f743e1bd19cc8764fb4999febf8aa8e35f12602ca16e34e36d7b8296a8da3cac", children: [2, 3], verified: false },
      { level: 1, index: 2, hash: "sha256:7ec536d5e296d71dd487d9c44ce0fb96256afa45a519f12a69cd2774cb315789", children: [4, 5], verified: false },
      { level: 1, index: 3, hash: "sha256:cabf708a1b5c9ea9f79a03510c8f983899e5c69a964510eb091b9295557938cb", children: [6, 7], verified: false },
      { level: 2, index: 0, hash: "sha256:f1cb4f12302613c427c35e1e1fe8189d6021e07864d8613b942ba2e6d58d029c", children: [0, 1], verified: false },
      { level: 2, index: 1, hash: "sha256:6d078b0e2d0111edf60cd6c88a180f9532014ea80e57693ccdce6c6072dfc692", children: [2, 3], verified: false },
      { level: 3, index: 0, hash: "sha256:0170fd9f8c339ae9d9ba12ff4a1d2546ef7177972c83105ec3010f1f749312ba", children: [0, 1], verified: false },
    ],

    reproducibilityStatement:
      "This certificate can be reproduced bit-for-bit by executing the container image identified by the digest above, with the Merkle root hash as the sole input reference. All intermediate computations are deterministic given the pinned random seeds in the config hash.",
    executionDurationMs: 12456,
    computeEnvironment: "2× NVIDIA A100 40GB, Ubuntu 22.04, CUDA 12.1",
  },
];

export function getCertificateById(id: string): Certificate | undefined {
  return CERTIFICATES.find((c) => c.id === id);
}

export function getCertificateByEpisode(episodeId: string): Certificate | undefined {
  return CERTIFICATES.find((c) => c.episodeId === episodeId);
}
