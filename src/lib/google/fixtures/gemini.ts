/*
   Recorded Gemini responses.

   These are served when no GEMINI_API_KEY is present, so the whole pipeline
   runs on a laptop with no credentials and a judge can evaluate the flow
   before deciding whether to provision quota. They are deliberately not
   flattering: the sky-observation set includes an unusable frame and a
   low-confidence frame, because a demo that only ever shows the model
   succeeding is not evidence that the model works.

   Selection is deterministic on a hash of the image bytes, so the same photo
   always returns the same reading — re-uploading a file cannot be used to
   fish for a better answer.
*/

import type { SkyObservation, Advisory, AuthorityAlert } from "../types";

export const SKY_OBSERVATION_FIXTURES: SkyObservation[] = [
  {
    usable: true,
    rejectionReason: null,
    hazeDensity: "severe",
    visibilityKm: 0.8,
    aqiBand: { low: 380, high: 520 },
    plumeVisible: true,
    plumeBearingDeg: 118,
    probableSourceClass: "biomass",
    sourceConfidence: 0.74,
    reasoning:
      "The sun is a defined disc that can be looked at directly through the haze, which puts optical depth well above 3. Colour cast is warm brown rather than the flat grey of a dust event, and the horizon is lost inside roughly a kilometre. Layered stratification above the treeline is consistent with a smoke plume advecting rather than locally generated dust.",
    caveats: [
      "AQI band is inferred from visibility and colour cast alone; it is not a measurement.",
      "Warm cast at low sun angle can mimic smoke; the timestamp says 09:40, which weakens that explanation but does not remove it.",
      "Source class cannot separate crop-residue burning from municipal waste burning on optical evidence.",
    ],
  },
  {
    usable: true,
    rejectionReason: null,
    hazeDensity: "moderate",
    visibilityKm: 4.2,
    aqiBand: { low: 140, high: 230 },
    plumeVisible: false,
    plumeBearingDeg: null,
    probableSourceClass: "mixed",
    sourceConfidence: 0.41,
    reasoning:
      "Mid-distance buildings are legible but low-contrast, and the sky gradient is grey-blue without the brown tint that indicates combustion aerosol. This reads as accumulated urban background rather than an identifiable event.",
    caveats: [
      "No plume structure is visible, so no direction can be offered.",
      "Confidence is low enough that this report should inform the register only in aggregate with others from the same tehsil.",
      "Thin overcast produces a very similar frame and cannot be excluded.",
    ],
  },
  {
    usable: true,
    rejectionReason: null,
    hazeDensity: "heavy",
    visibilityKm: 1.6,
    aqiBand: { low: 260, high: 360 },
    plumeVisible: true,
    plumeBearingDeg: 134,
    probableSourceClass: "industrial",
    sourceConfidence: 0.58,
    reasoning:
      "A discrete grey-white column rises from a fixed point on the skyline and bends sharply downwind, which indicates a stack rather than a field fire. The column is brighter than the surrounding haze, suggesting a condensing water fraction typical of a scrubbed industrial exhaust.",
    caveats: [
      "A single frame cannot establish that the stack is operating outside its consented limits.",
      "The bend angle gives wind direction at stack height only, not at transport height.",
      "Brick-kiln and small-boiler exhaust are optically similar at this distance.",
    ],
  },
  {
    usable: false,
    rejectionReason:
      "The frame is almost entirely interior wall and ceiling, with no sky visible. An outdoor photograph including the horizon is needed before any reading can be attempted.",
    hazeDensity: "clear",
    visibilityKm: null,
    aqiBand: null,
    plumeVisible: false,
    plumeBearingDeg: null,
    probableSourceClass: "indeterminate",
    sourceConfidence: 0,
    reasoning:
      "No sky region could be segmented from the image, so none of the optical cues this estimate depends on are present.",
    caveats: [
      "Rejected before analysis. The report is stored but contributes nothing to the register.",
    ],
  },
  {
    usable: true,
    rejectionReason: null,
    hazeDensity: "light",
    visibilityKm: 11.5,
    aqiBand: { low: 55, high: 110 },
    plumeVisible: false,
    plumeBearingDeg: null,
    probableSourceClass: "vehicular",
    sourceConfidence: 0.36,
    reasoning:
      "The horizon is resolvable and the sky holds most of its blue, with only a shallow brown band in the lowest few degrees. That band sitting under otherwise clean air is the signature of a near-surface traffic layer.",
    caveats: [
      "Confidence is low; this pattern is also produced by ordinary morning boundary-layer compression.",
      "A near-surface band cannot be attributed to traffic without a co-located NO₂ reading.",
    ],
  },
];

export const ADVISORY_FIXTURE: Advisory = {
  headline:
    "Severe particulate load over Delhi through tomorrow morning, 92% of it carried in from upwind Punjab and Haryana.",
  body:
    "The receptor network crossed AQI 400 at 18:00 and is forecast to peak near 480 between 02:00 and 06:00 tonight. The attribution register places 92.2% of the excess above background on upwind cells outside Delhi's jurisdiction, concentrated in Sangrur, Patiala and Ludhiana tehsils, with a transport delay of roughly 40 hours from ignition. Wind at 925 hPa holds the corridor open until at least 14:00 tomorrow, so local action inside Delhi can reduce exposure but cannot reduce the load.",
  actions: [
    "Invoke GRAP Stage IV from 22:00 tonight; the forecast crosses the threshold six hours before the peak, not at it.",
    "Issue a stay-indoors advisory for 22:00–08:00 in Hindi, Punjabi and Urdu through the state SMS gateway, not only in English on the portal.",
    "Direct hospitals in the eleven worst-loaded districts to staff respiratory intake for a 02:00–06:00 surge.",
    "Transmit the sealed attribution certificate to the Punjab and Haryana pollution control boards tonight, so the finding is on record before it is contested.",
    "Suspend construction and non-essential diesel generation within the NCR boundary — this addresses the remaining 7.8%, and doing it is what makes the request to upwind states defensible.",
  ],
  notify: [
    "Commission for Air Quality Management, NCR",
    "Delhi Pollution Control Committee — Chairperson",
    "Punjab Pollution Control Board — Member Secretary",
    "Haryana State Pollution Control Board — Member Secretary",
    "District Magistrates, eleven affected NCR districts",
    "Directorate General of Health Services, NCT Delhi",
  ],
  severity: "emergency",
  validForHours: 18,
};

export const AUTHORITY_ALERT_FIXTURE: AuthorityAlert = {
  subject:
    "IMMEDIATE — Attributed transboundary particulate episode, receptor Delhi, certificate PRM-CERT-2024-1103-0417",
  body:
    "This is an automated attribution notice issued under the PRAMĀNA federated airshed protocol.\n\nDelhi's receptor network crossed AQI 400 at 18:00 IST on 3 November and is forecast to peak at 482 ± 34 between 02:00 and 06:00 IST on 4 November. Source-receptor decomposition attributes 92.2% (95% CI: 88.1–95.4%) of the excess above seasonal background to upwind cells outside the National Capital Territory, principally Sangrur (31.4%), Patiala (22.7%) and Ludhiana (18.9%) tehsils.\n\nThe finding is sealed in certificate PRM-CERT-2024-1103-0417. The certificate carries the SHA-256 digest of every input granule, the model commit, the container digest and the random seed. Any named party may re-run the pipeline against those inputs and obtain the same Merkle root, or identify precisely which leaf diverges. Nothing in this notice needs to be taken on trust.\n\nResponse is requested within 24 hours under the corridor coordination protocol.",
  smsText:
    "PRAMANA ALERT: Delhi AQI forecast 482 by 06:00. 92% attributed upwind (Sangrur, Patiala, Ludhiana). Cert PRM-CERT-2024-1103-0417. Response due 24h.",
  recipients: [
    { role: "Member Secretary", jurisdiction: "Punjab Pollution Control Board" },
    { role: "Member Secretary", jurisdiction: "Haryana State Pollution Control Board" },
    { role: "Chairperson", jurisdiction: "Commission for Air Quality Management, NCR" },
    { role: "District Magistrate", jurisdiction: "Sangrur, Punjab" },
    { role: "District Magistrate", jurisdiction: "Patiala, Punjab" },
  ],
  escalationLevel: "immediate",
};
