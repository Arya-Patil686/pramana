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
| `GOOGLE_MAPS_API_KEY` | Air Quality API readings, reverse geocoding to tehsil | Maps Platform console |
| `GOOGLE_TRANSLATE_API_KEY` | Cloud Translation | GCP console |
| `GOOGLE_TTS_API_KEY` | Cloud Text-to-Speech | GCP console |
| `GOOGLE_STT_API_KEY` | Cloud Speech-to-Text | GCP console |
| `DATA_GOV_IN_API_KEY` | **CPCB** reference stations | [data.gov.in](https://data.gov.in/user/register) — instant |
| `FIRMS_MAP_KEY` | Live VIIRS active fire detections | [FIRMS map key](https://firms.modaps.eosdis.nasa.gov/api/map_key/) — instant |

`GOOGLE_API_KEY` stands in for any unset `GOOGLE_*` variable.

### Deploy to Cloud Run

```bash
gcloud run deploy pramana --source . --region asia-south1 --allow-unauthenticated --set-env-vars GOOGLE_CLOUD_PROJECT=$(gcloud config get-value project)
```

Setting `GOOGLE_CLOUD_PROJECT` makes every Gemini call authenticate as the
runtime service account through Vertex AI, so **no key material lives in the
environment** — which is the only form a ministry deployment can take. Put the
remaining keys in Secret Manager and mount them with `--set-secrets`.

---

## What to demo

A 3–5 minute walkthrough that shows the system working, in this order.

**1 · The story — `/`  (45s)**
Scroll the five pages. The paper stains down the CPCB index as the smoke
arrives, and the same map is revealed one layer at a time: detections, then the
925 hPa wind field, then the transport trajectories. Say out loud that the
numbers in the copy are computed, not written.

**2 · The register — `/console`  (75s)**
This is the centrepiece. Land on `?mode=episode`: the model reports **Sangrur
as the largest single source of Delhi's biomass load, 38.8%**, with the
interval, the arrival curve, and the model's own limitations printed beside its
numbers.

Then switch to **`?mode=live`**. Same code path, one input changed, and it now
says *"the corridor is barely open — only 3 of 15 fires reach Delhi on this
field."* Because in September the 925 hPa flow over Punjab does not run toward
Delhi. **This contrast is the strongest thing in the demo**: it shows the system
is computing rather than replaying, and that it will say so when there is
nothing to report.

**3 · Citizen observation — `/report`  (60s)**
Upload a photo of the sky. Gemini multimodal returns a *band* rather than a
number, lists what could make the reading wrong, and the register gives one
lone report at most 0.35 of the model's own confidence. Explain the
corroboration rule: weight comes from independent agreement in the same tehsil,
which is what stops one motivated person moving a finding a state is answerable
for.

**4 · Advisory and voice — `/advisory`  (45s)**
Switch language to ਪੰਜਾਬੀ and press *Read aloud*. Point out the split: Gemini
writes the situational narrative, but the protective health instruction comes
from a reviewed phrasebook, because a model improvising medical advice in a
language nobody on the team reads is not a risk worth taking.

**5 · The proof — `/certificate` and `/integration`  (30s)**
Show the Merkle verification running in the browser over real SHA-256 digests.
Finish on `/integration`, which states which Google service does which job and
whether it is keyed — so the integration claim is checkable rather than
asserted.

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
| **Generative AI** | Gemini API | ✅ vision + structured reasoning, `lib/google/gemini.ts` |
| | Google AI Studio | ✅ key source for the Gemini API path |
| | Vertex AI | ✅ same adapters route through Vertex when `GOOGLE_CLOUD_PROJECT` is set |
| **Predictive modelling** | Vertex AI (AutoML, custom training) | ❌ **not used** — see below |
| **Vision & multimodal** | Gemini multimodal | ✅ citizen sky-photo analysis |
| | Vertex AI Vision | ❌ Gemini multimodal covers this use case |
| **Language & voice** | Cloud Speech-to-Text | ✅ spoken citizen reports |
| | Cloud Text-to-Speech | ✅ spoken advisories, 12 languages |
| | Translation API | ✅ advisory narrative |
| | Dialogflow | ❌ no conversational surface in scope |
| **Geospatial** | Google Maps Platform | ✅ Air Quality API + Geocoding |
| | Google Earth Engine | ❌ **not used** — see below |
| **Data & backend** | Cloud Run | ✅ `Dockerfile`, standalone output, Vertex via service account |
| | BigQuery | ❌ no national-scale archive yet |
| | Firebase | ❌ the citizen register is in-process; Firestore is the stated target |
| **Public data** | data.gov.in | ✅ CPCB CAAQMS reference network |
| | IMD / national met | ⚠️ Open-Meteo serves ECMWF IFS and GFS; IMD has no comparable public API |
| | ISRO / Bhuvan | ❌ NASA FIRMS VIIRS at 375 m is the better product for this task |
| | FAO / WHO | ❌ agriculture and health datasets, not this track |

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
src/app/api/          observe · attribution · advisory · alert · sources · integration
src/components/       illustration scenes, corridor map, register figures
```

Every adapter returns the mode that served it, and the UI always shows it. A
live call that fails degrades to the recording **and names the failure**, so a
silent downgrade cannot happen and a demo can never imply a model ran when it
did not.

## Licence and attribution

Built for Build with AI: Code for Communities. Data: NASA FIRMS (public
domain), Open-Meteo (CC BY 4.0), CPCB via data.gov.in (Government Open Data
Licence — India), Google Air Quality API (per Maps Platform terms).
