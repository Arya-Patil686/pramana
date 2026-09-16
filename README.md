# PRAMĀNA

**Source–receptor attribution for transboundary air pollution.** It names the
upwind cells responsible for a receptor city's exceedance, attaches a
confidence interval to every figure, and seals the result in a certificate the
named state can re-run and reproduce. Not a dashboard that displays pollution —
an instrument that settles who owns it.

> प्रमाण · *pramāṇa* · "proof, valid means of knowledge"

---

## Run it

Needs Node 20+. **No credentials are required** — the whole end-to-end flow
runs against recorded model output, and every surface says which parts are
live and which are recorded.

```bash
npm install && npm run dev
```

Open <http://localhost:3000>.

Even with zero configuration, one upstream is genuinely live: the 925 hPa wind
field comes from Open-Meteo, which needs no key. So a fresh clone shows a real,
current corridor wind field on first run.

### Turning capabilities live

```bash
cp .env.example .env.local
```

Fill in whichever keys you have and restart. Nothing branches on a build flag —
each adapter checks for its key at call time, so a key added to the environment
switches that capability over on the next request. `/integration` reports what
is actually keyed on the running deployment.

| Variable | Unlocks | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Photo analysis, advisory and alert drafting | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GOOGLE_CLOUD_PROJECT` | Routes the same Gemini calls through **Vertex AI** instead | Any GCP project with Vertex enabled |
| `GOOGLE_MAPS_API_KEY` | Air Quality API, reverse geocoding — **optional, not used on the demo deployment** | Maps Platform console (needs an active billing account) |
| `GOOGLE_TRANSLATE_API_KEY` | Cloud Translation | GCP console |
| `GOOGLE_TTS_API_KEY` | Cloud Text-to-Speech | GCP console |
| `GOOGLE_STT_API_KEY` | Cloud Speech-to-Text | GCP console |
| `DATA_GOV_IN_API_KEY` | **CPCB** reference stations | [data.gov.in](https://data.gov.in/user/register) — instant |
| `FIRMS_MAP_KEY` | Live VIIRS active fire detections | [FIRMS map key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) — instant |

`GOOGLE_API_KEY` stands in for any unset `GOOGLE_*` variable.

**Free-tier limits matter for a demo.** The Gemini free tier allows **20
generate requests per day, per model**. Two things keep the demo inside that:

- Nothing that can be precomputed calls a model at request time. The public
  health messages in all twelve languages are committed text
  (`src/lib/google/languages.ts` for the reviewed four,
  `src/lib/google/phrasebook-generated.ts` for the other eight), so switching
  language costs nothing.
- Live Gemini calls fall through a chain of models
  (`gemini-3.6-flash → 3.7 → 3.5 → 3.8`, overridable with
  `PRAMANA_GEMINI_FALLBACK_MODELS`) when one is out of quota or overloaded, and
  record which model actually answered.

Spend the daily budget on the photo analysis in `/report`. Do a dry run the day
before recording, not the morning of.

### Deploy — Vercel (the live demo link)

1. Push the repository to GitHub, then import it at
   [vercel.com/new](https://vercel.com/new). The framework is detected
   automatically; no build settings need changing.
2. In **Settings → Environment Variables**, add `GEMINI_API_KEY`,
   `DATA_GOV_IN_API_KEY` and `FIRMS_MAP_KEY` (the same values as your
   `.env.local`). Add them for Production and Preview.
3. Deploy. `/integration` on the deployed URL reports which capabilities are
   live there.

Vercel supplies `VERCEL_GIT_COMMIT_SHA`, which the certificate page records as
the model commit, so every sealed certificate names the exact code that produced
it.

### Deploy — Cloud Run (the ministry form)

```bash
gcloud run deploy pramana --source . --region asia-south1 --allow-unauthenticated --set-env-vars GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project)
```

The `Dockerfile` builds the standalone output. With `GOOGLE_CLOUD_PROJECT` set,
Gemini calls authenticate as the runtime service account through Vertex AI, so
no key material lives in the environment — the only form a government
deployment can take. This path needs a GCP project with active billing, which
is why the demo link is served from Vercel.

---

## What to demo

A 3–5 minute walkthrough, in this order. Figures below are described rather
than quoted, because with live fire detections they change from day to day —
which is itself worth saying on camera.

**1 · The model — `/`  (45s)**
Drag the interactive airshed. Click the tallest source column: the inspector
shows that tehsil's actual register row — share, 95% interval, arriving puffs,
transport time. Press **Profile** to show the surface wind and the 925 hPa wind
pointing in different directions. Scroll into the flown volume beneath it.

**2 · The register — `/console`  (75s)**
Start on `?mode=episode` (the recorded 3 November wind field): the leading
source, its interval, the arrival curve, and the model's limitations printed
beside its numbers. Then switch to **`?mode=live`**: same code, one input
changed, and it reports how little of today's burning actually reaches Delhi,
because the September 925 hPa flow does not run that way. **This contrast is
the strongest moment in the demo** — the system computes rather than replays,
and says so when there is nothing to report.

**3 · Citizen observation — `/report`  (60s)**
Upload a real photo of the sky, taken with a phone. Gemini returns a band
rather than a number, lists what could make the reading wrong, and one lone
report is capped at 0.35 of the model's confidence until neighbours in the same
tehsil corroborate it. Worth showing: upload a screenshot or a graphic and
Gemini refuses it as not a photograph.

**4 · Advisory — `/advisory`  (45s)**
The receptor figure is the worst live CPCB station in Delhi. Switch through
ਪੰਜਾਬੀ, हिन्दी, ગુજરાતી, தமிழ் — point out the label on each: *Reviewed copy* for
the corridor languages, *Machine translated* for the rest. Press *Read aloud*.
Scroll to the cross-border notice: same certificate id as the advisory, and
marked not dispatched, because sending it is an officer's decision.

**5 · The proof — `/certificate` and `/integration`  (30s)**
Press **Run verification**. The browser recomputes the Merkle root from the
leaves — each carrying the SHA-256 of the data the pipeline actually fetched —
and it matches the sealed root. Finish on `/integration`, which states which
Google service does which job and whether it is live on this deployment.

---

## Architecture

```
Ingest            NASA FIRMS (VIIRS 375 m) · Open-Meteo 925 hPa · CPCB via
                  data.gov.in · Google Air Quality API
     │
Citizen           photo + location ──► Gemini multimodal ──► bounded observation
                  Maps geocoding ──► tehsil · corroboration ──► weight
     │
Attribution       forward Lagrangian puff model, 0.1° grid  ── no model here,
                  by design: this stage must be reproducible offline
     │
Advisory          Gemini narrative + reviewed phrasebook
                  Cloud Translation · Text-to-Speech
     │
Seal              SHA-256 Merkle certificate  ── no model here, by design
```

Two stages deliberately contain no AI. Attribution and sealing are what a
named state will contest, and a finding that cannot be re-derived offline
without calling someone's hosted endpoint is not evidence.

### The attribution model

Every fire detection releases a puff at its true position and acquisition
time. Puffs are advected on the 925 hPa field in 15-minute steps and deposit a
Gaussian cross-section at closest approach to the receptor, weighted by Fire
Radiative Power. Contributions accumulate per 0.1° cell and aggregate to
tehsil, district and state. Uncertainty is `1/√n` per cell and combines in
quadrature.

It is **not** HYSPLIT, and it says so on the page. The wind field is one
snapshot held constant across the transport window; transport is a single
level; deposition and secondary chemistry are not modelled; and a thermal
satellite cannot see traffic or construction, so the shares are of the
*biomass-attributable* load, not the receptor's total load.

---

## Google integration — what is wired, and what is not

Against the hackathon's own "Tools & tech" list. Honest status, because a claim
a judge cannot check is worth nothing — `/integration` reports the same thing
live from the running deployment.

| Category | Listed | Status |
|---|---|---|
| **Generative AI** | Gemini API | ✅ **live** — photo analysis, advisory and notice drafting, `lib/google/gemini.ts` |
| | Google AI Studio | ✅ key source for the Gemini API path |
| | Vertex AI | ⚠️ wired — the same adapters route through Vertex when `GOOGLE_CLOUD_PROJECT` is set — not active on the demo deployment (needs billing) |
| **Predictive modelling** | Vertex AI (AutoML, custom training) | ❌ **not used** — see below |
| **Vision & multimodal** | Gemini multimodal | ✅ **live** — citizen sky-photo analysis, refuses non-photographs |
| | Vertex AI Vision | ❌ Gemini multimodal covers this use case |
| **Language & voice** | Cloud Text-to-Speech | ⚠️ wired, not keyed on the demo deployment; the browser's own speech synthesis reads the same text |
| | Cloud Speech-to-Text | ⚠️ wired, not keyed; the browser's speech recognition accepts spoken reports |
| | Translation API | ⚠️ wired, not keyed; public messages are committed in 12 languages instead |
| | Dialogflow | ❌ no conversational surface in scope |
| **Geospatial** | Google Maps Platform | ❌ **not used on the demo** — it needs active billing, and CPCB supersedes its receptor reading |
| | Google Earth Engine | ❌ **not used** — see below |
| **Data & backend** | Cloud Run | ⚠️ `Dockerfile` ready; the demo link is served from Vercel |
| | BigQuery | ❌ no national-scale archive yet |
| | Firebase | ❌ the citizen register is in-process; Firestore is the stated target |
| **Public data** | data.gov.in | ✅ **live** — CPCB CAAQMS reference network |
| | IMD / national met | ⚠️ Open-Meteo serves ECMWF IFS and GFS; IMD has no comparable public API |
| | ISRO / Bhuvan | ❌ NASA FIRMS VIIRS at 375 m is the better product for this task |
| | FAO / WHO | ❌ agriculture and health datasets, not this track |

**Why Maps is not used.** Its two jobs are covered: CPCB via data.gov.in is the
reference network a GRAP decision is statutorily taken on, which makes it a
better receptor figure than the Air Quality API; and placing a report in a
tehsil resolves correctly at the 0.1° grid scale from the corridor centroid
table. It stays wired for a deployment with billing.

**Why Vertex AI is not doing the prediction.** The forecast here is a physics
model, not a learned one, and that is a deliberate choice rather than a gap: a
state being named has to be able to re-run the finding and get the same answer,
and a hosted model endpoint cannot be re-run by the party disputing it. Vertex
is wired for the generative stages, where reproducibility is not the property
that matters.

**Why not Earth Engine.** Earth Engine would improve the emission proxies —
TROPOMI columns and night-lights are both referenced in the attribution
design — but the transport model is the part under test, and it is fed by FIRMS
and the wind field. Adding Earth Engine before the transport model is validated
would be adding inputs to something not yet known to be right.

---

## Repository

```
src/lib/google/       Gemini, Translation, TTS, STT adapters + capability registry
src/lib/sources/      FIRMS, Open-Meteo, CPCB, Air Quality, geocoding
src/lib/attribution/  the puff model
src/lib/pipeline/     one run: fetch → attribute → seal certificate → advisory input
src/app/api/          observe · attribution · advisory · alert · sources · integration
src/components/       illustration scenes, corridor map, register figures
```

Every adapter returns the mode that served it, and the UI always shows it. A
live call that fails degrades to the recording **and names the failure**, so a
silent downgrade cannot happen and a demo can never imply a model ran when it
did not.

## Licence and attribution

Built for Build with AI: Code for Communities. Extends the team's original
prototype, [ananyac9820/pramana](https://github.com/ananyac9820/pramana).

Data: NASA FIRMS (public domain), Open-Meteo (CC BY 4.0), CPCB via
data.gov.in (Government Open Data Licence — India).

Open-source components: Next.js, React (MIT), Tailwind CSS (MIT), three.js
and React Three Fiber (MIT), Framer Motion (MIT), Lenis (MIT), and the
Google Gen AI SDK (Apache-2.0).
