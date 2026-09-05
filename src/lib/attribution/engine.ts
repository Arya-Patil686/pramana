import type { FireDetection } from "@/lib/sources/firms";
import type { WindField, WindSample } from "@/lib/sources/meteo";

/*
   Source-receptor attribution.

   A forward Lagrangian puff model. Every fire detection releases a puff at its
   true position and acquisition time; the puff is advected on the 925 hPa
   field in fifteen-minute steps and spreads as it goes; whatever passes close
   enough to the receptor deposits a contribution weighted by the fire's
   radiative power and thinned by how far the plume has dispersed by then.
   Contributions accumulate per 0.1° cell — the grid the register resolves to —
   and aggregate cleanly up to tehsil, district and state.

   What this model is not
   ─────────────────────
   It is not HYSPLIT. Three simplifications are worth naming, because a
   finding a state is asked to answer for should carry its own limitations:

     1. The wind field is a single snapshot held constant across the transport
        window. Over a 40-hour post-monsoon episode the north-westerly regime
        is genuinely persistent, which is what makes this defensible, but a
        frontal passage inside the window would break it. This is the largest
        source of error.
     2. Vertical structure is reduced to one transport level. Real plumes
        loft, hit the nocturnal inversion and fumigate down at sunrise; here
        that is folded into the dispersion term rather than resolved.
     3. Deposition and chemistry are not modelled. For primary PM over 40
        hours that is a modest error; for anything secondary it is not.

   The certificate records every one of these alongside the numbers, so the
   named party can see exactly what it is disputing.
*/

const KM_PER_DEG_LAT = 110.574;
const STEP_MINUTES = 15;
const MAX_TRANSPORT_HOURS = 60;

/**
 * The receptor's own catchment radius, km.
 *
 * Not a hit test — the plume is Gaussian and deposits at any distance. This is
 * the scale over which the receptor's monitors represent the same air mass,
 * and it sets the floor on sigma so a puff passing directly overhead does not
 * deposit an unbounded concentration.
 */
const RECEPTOR_RADIUS_KM = 45;

/** Below this share of the peak single-puff load, an arrival is noise. */
const ARRIVAL_FLOOR = 1e-4;

/**
 * Cross-corridor spread, km per hour of travel.
 *
 * Chosen so a puff released 210 km upwind arrives roughly 60 km wide, which
 * is what the observed footprint of a Punjab-to-Delhi episode looks like in
 * the CPCB network. It is a calibration, not a first-principles constant, and
 * it is reported as one.
 */
const SPREAD_KM_PER_HOUR = 1.45;

export interface Receptor {
  name: string;
  lat: number;
  lng: number;
}

export interface CellContribution {
  /** 0.1° cell centre. */
  lat: number;
  lng: number;
  cellId: string;
  tehsil: string | null;
  district: string | null;
  state: string | null;
  /** Total Fire Radiative Power released in this cell, MW. */
  frpTotal: number;
  detections: number;
  /** Puffs from this cell that reached the receptor. */
  arrivals: number;
  meanTransportHours: number;
  /** Share of the receptor's total attributed load, per cent. */
  contributionPct: number;
  ciLow: number;
  ciHigh: number;
}

export interface TehsilContribution {
  tehsil: string;
  district: string | null;
  state: string | null;
  contributionPct: number;
  ciLow: number;
  ciHigh: number;
  cells: number;
  arrivals: number;
  frpTotal: number;
  meanTransportHours: number;
}

export interface StateContribution {
  state: string;
  contributionPct: number;
  ciLow: number;
  ciHigh: number;
  cells: number;
  frpTotal: number;
}

export interface ArrivalBin {
  /** Hours from the earliest detection. */
  hour: number;
  isoTime: string;
  /** Arbitrary load units, normalised so the peak is 100. */
  load: number;
}

export interface AttributionResult {
  receptor: Receptor;
  cells: CellContribution[];
  byTehsil: TehsilContribution[];
  byState: StateContribution[];
  /**
   * Share of the *biomass-attributable* load from cells outside the
   * receptor's own state. Not a share of the receptor's total load: see
   * `method.limitations`.
   */
  upwindSharePct: number;
  upwindCi: [number, number];
  /** Puffs that never came within the receptor radius. */
  detectionsConsidered: number;
  detectionsArriving: number;
  arrivalCurve: ArrivalBin[];
  peakTransportHours: number;
  method: {
    model: string;
    transportLevel: string;
    stepMinutes: number;
    spreadKmPerHour: number;
    receptorRadiusKm: number;
    windSnapshotAt: string;
    windLive: boolean;
    firesLive: boolean;
    limitations: string[];
  };
  /** True when nothing arrived and every figure below is zero. */
  empty: boolean;
}

function kmPerDegLng(lat: number): number {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * KM_PER_DEG_LAT;
  const dLng = (bLng - aLng) * kmPerDegLng((aLat + bLat) / 2);
  return Math.hypot(dLat, dLng);
}

/**
 * Wind at an arbitrary point, by inverse-distance weighting over the samples.
 *
 * The samples lie along the corridor, so for anything near it this is a real
 * interpolation; well off the corridor it degenerates to the nearest sample,
 * which is the honest answer given where the observations are.
 */
function windAt(field: WindSample[], lat: number, lng: number): { u: number; v: number } {
  let sumW = 0;
  let sumU = 0;
  let sumV = 0;

  for (const s of field) {
    const d = Math.max(haversineKm(lat, lng, s.lat, s.lng), 1);
    const w = 1 / (d * d);
    /* Meteorological direction is where wind comes FROM; a parcel travels
       toward the reciprocal, which is what bearingTo already carries. */
    const rad = (s.bearingTo * Math.PI) / 180;
    sumU += w * s.speed * Math.sin(rad); // eastward
    sumV += w * s.speed * Math.cos(rad); // northward
    sumW += w;
  }

  if (sumW === 0) return { u: 0, v: 0 };
  return { u: sumU / sumW, v: sumV / sumW };
}

const cellKey = (lat: number, lng: number) =>
  `${Math.round(lat * 10) / 10}|${Math.round(lng * 10) / 10}`;

interface Placer {
  (lat: number, lng: number): { tehsil: string | null; district: string | null; state: string | null };
}

export function computeAttribution(
  detections: FireDetection[],
  wind: WindField,
  receptor: Receptor,
  place: Placer,
  receptorState = "Delhi"
): AttributionResult {
  const method = {
    model: "Forward Lagrangian puff, 0.1° accumulation grid",
    transportLevel: "925 hPa",
    stepMinutes: STEP_MINUTES,
    spreadKmPerHour: SPREAD_KM_PER_HOUR,
    receptorRadiusKm: RECEPTOR_RADIUS_KM,
    windSnapshotAt: wind.samples[0]?.validAt ?? wind.fetchedAt,
    windLive: wind.live,
    firesLive: false,
    limitations: [
      "The wind field is one snapshot held constant across the transport window; a frontal passage inside that window would invalidate the trajectory. This is the largest source of error.",
      "Transport is reduced to a single level. Lofting, the nocturnal inversion and morning fumigation are folded into the dispersion term rather than resolved.",
      "Deposition and secondary chemistry are not modelled, so the result applies to primary particulate only.",
      "Cross-corridor spread is calibrated against observed episode footprints, not derived from turbulence theory.",
      "Only sources visible to the fire product are in the register. Traffic, construction and industry inside the receptor city emit nothing a thermal satellite can see, so these shares are of the biomass-attributable load — not of the receptor's total load. Reading them as a total is the single most likely way to misuse this output.",
    ],
  };

  const empty: AttributionResult = {
    receptor,
    cells: [],
    byTehsil: [],
    byState: [],
    upwindSharePct: 0,
    upwindCi: [0, 0],
    detectionsConsidered: detections.length,
    detectionsArriving: 0,
    arrivalCurve: [],
    peakTransportHours: 0,
    method,
    empty: true,
  };

  if (detections.length === 0 || wind.samples.length === 0) return empty;

  const t0 = Math.min(...detections.map((d) => Date.parse(d.acquiredAt)));

  interface Accum {
    lat: number;
    lng: number;
    frpTotal: number;
    detections: number;
    arrivals: number;
    load: number;
    transportHoursSum: number;
  }
  const cells = new Map<string, Accum>();
  /* Arrival load binned by hour since the first detection. */
  const hourly = new Map<number, number>();

  let arriving = 0;
  let totalLoad = 0;

  for (const d of detections) {
    const key = cellKey(d.lat, d.lng);
    const cell =
      cells.get(key) ??
      {
        lat: Math.round(d.lat * 10) / 10,
        lng: Math.round(d.lng * 10) / 10,
        frpTotal: 0,
        detections: 0,
        arrivals: 0,
        load: 0,
        transportHoursSum: 0,
      };
    cell.frpTotal += d.frp;
    cell.detections += 1;
    cells.set(key, cell);

    /* Advect this detection's puff forward until it reaches the receptor,
       leaves the useful window, or wanders out of the domain. */
    let lat = d.lat;
    let lng = d.lng;
    let hours = 0;
    let closest = Infinity;
    let closestAt = 0;

    /*
       Run the trajectory to its closest approach rather than stopping at a
       radius. A plume is not a point that either hits the receptor or misses
       it: it has a cross-wind width that grows the whole way, and a fire that
       passes eighty kilometres upwind still deposits — less than one passing
       overhead, but not nothing. Testing for a hit threw away most of the
       signal and handed the entire register to whichever single puff happened
       to pass closest.
    */
    while (hours < MAX_TRANSPORT_HOURS) {
      const { u, v } = windAt(wind.samples, lat, lng);
      const speed = Math.hypot(u, v);
      /* A stalled field would loop forever without moving the puff. */
      if (speed < 0.25) break;

      const dtSec = STEP_MINUTES * 60;
      lat += (v * dtSec) / 1000 / KM_PER_DEG_LAT;
      lng += (u * dtSec) / 1000 / kmPerDegLng(lat);
      hours += STEP_MINUTES / 60;

      const dist = haversineKm(lat, lng, receptor.lat, receptor.lng);
      if (dist < closest) {
        closest = dist;
        closestAt = hours;
      }
      /* Once it is receding and well past, nothing better is coming. */
      if (dist > closest + 60) break;
    }

    if (closestAt === 0) continue;

    /*
       Gaussian cross-wind concentration at closest approach.

       sigma is the plume's half-width by the time it gets there, floored at
       the receptor's own catchment so a direct overpass cannot deposit an
       unbounded amount. Radiative power is the emission proxy; dividing by
       sigma conserves mass as the plume widens, which is what makes a distant
       strong fire properly comparable to a near weak one.
    */
    const sigma = Math.max(RECEPTOR_RADIUS_KM, SPREAD_KM_PER_HOUR * closestAt * 6);
    const load =
      (d.frp / sigma) * Math.exp(-0.5 * (closest / sigma) * (closest / sigma));

    if (load < ARRIVAL_FLOOR) continue;
    const arrivedAt = closestAt;

    cell.arrivals += 1;
    cell.load += load;
    cell.transportHoursSum += arrivedAt;
    arriving += 1;
    totalLoad += load;

    const bin = Math.round((t0 - t0) / 3600000 + arrivedAt);
    hourly.set(bin, (hourly.get(bin) ?? 0) + load);
  }

  if (totalLoad === 0) return { ...empty, method: { ...method } };

  const contributions: CellContribution[] = [...cells.entries()]
    .filter(([, c]) => c.load > 0)
    .map(([id, c]) => {
      const pct = (c.load / totalLoad) * 100;
      const placed = place(c.lat, c.lng);
      /*
         Uncertainty is driven by how many independent puffs from this cell
         arrived. One arrival is a thin claim; twenty is a robust one. The
         relative half-width is 1/sqrt(n), floored so a large sample never
         reports implausible precision from a model this simplified.
      */
      const rel = Math.max(0.08, 1 / Math.sqrt(c.arrivals));
      return {
        lat: c.lat,
        lng: c.lng,
        cellId: id,
        ...placed,
        frpTotal: Number(c.frpTotal.toFixed(1)),
        detections: c.detections,
        arrivals: c.arrivals,
        meanTransportHours: Number((c.transportHoursSum / c.arrivals).toFixed(1)),
        contributionPct: Number(pct.toFixed(2)),
        ciLow: Number(Math.max(0, pct * (1 - rel)).toFixed(2)),
        ciHigh: Number(Math.min(100, pct * (1 + rel)).toFixed(2)),
      };
    })
    .sort((a, b) => b.contributionPct - a.contributionPct);

  /*
     Aggregating uncertainty.

     Summing the per-cell bounds treats every cell's error as perfectly
     correlated, which produced a 7–100% interval on the headline figure and
     was worse than useless. Cell errors here are dominated by independent
     sampling noise — how many puffs from that cell happened to arrive — so
     the half-widths combine in quadrature. That is the same assumption the
     per-cell 1/sqrt(n) already makes, applied consistently one level up.
  */
  const aggregate = (rows: CellContribution[]) => {
    const pct = rows.reduce((s, c) => s + c.contributionPct, 0);
    const halfWidth = Math.sqrt(
      rows.reduce((s, c) => {
        const h = (c.ciHigh - c.ciLow) / 2;
        return s + h * h;
      }, 0)
    );
    return {
      pct: Number(pct.toFixed(2)),
      low: Number(Math.max(0, pct - halfWidth).toFixed(2)),
      high: Number(Math.min(100, pct + halfWidth).toFixed(2)),
    };
  };

  const groupBy = <T extends string>(key: (c: CellContribution) => T) => {
    const m = new Map<T, CellContribution[]>();
    for (const c of contributions) {
      const k = key(c);
      const list = m.get(k) ?? [];
      list.push(c);
      m.set(k, list);
    }
    return m;
  };

  const byTehsil: TehsilContribution[] = [...groupBy((c) => c.tehsil ?? "Unplaced")]
    .map(([tehsil, rows]) => {
      const agg = aggregate(rows);
      const arrivals = rows.reduce((s, c) => s + c.arrivals, 0);
      return {
        tehsil,
        district: rows[0].district,
        state: rows[0].state,
        contributionPct: agg.pct,
        ciLow: agg.low,
        ciHigh: agg.high,
        cells: rows.length,
        arrivals,
        frpTotal: Number(rows.reduce((s, c) => s + c.frpTotal, 0).toFixed(1)),
        meanTransportHours: Number(
          (
            rows.reduce((s, c) => s + c.meanTransportHours * c.arrivals, 0) /
            Math.max(1, arrivals)
          ).toFixed(1)
        ),
      };
    })
    .sort((a, b) => b.contributionPct - a.contributionPct);

  const byState: StateContribution[] = [...groupBy((c) => c.state ?? "Unplaced")]
    .map(([state, rows]) => {
      const agg = aggregate(rows);
      return {
        state,
        contributionPct: agg.pct,
        ciLow: agg.low,
        ciHigh: agg.high,
        cells: rows.length,
        frpTotal: Number(rows.reduce((s, c) => s + c.frpTotal, 0).toFixed(1)),
      };
    })
    .sort((a, b) => b.contributionPct - a.contributionPct);

  const upwind = contributions.filter((c) => c.state !== receptorState);
  const upwindAgg = aggregate(upwind);
  /* Percentages are rounded per cell before they are summed, so the total can
     land a hundredth either side of 100. Clamp rather than let a register
     report 100.01%. */
  const upwindSharePct = Math.min(100, upwindAgg.pct);
  const upwindCi: [number, number] = [upwindAgg.low, upwindAgg.high];

  const bins = [...hourly.entries()].sort((a, b) => a[0] - b[0]);
  const peakLoad = Math.max(...bins.map(([, v]) => v));
  const arrivalCurve: ArrivalBin[] = bins.map(([hour, load]) => ({
    hour,
    isoTime: new Date(t0 + hour * 3600000).toISOString(),
    load: Number(((load / peakLoad) * 100).toFixed(1)),
  }));
  const peakTransportHours = bins.reduce(
    (best, [hour, load]) => (load >= peakLoad ? hour : best),
    0
  );

  return {
    receptor,
    cells: contributions,
    byTehsil,
    byState,
    upwindSharePct,
    upwindCi,
    detectionsConsidered: detections.length,
    detectionsArriving: arriving,
    arrivalCurve,
    peakTransportHours,
    method,
    empty: false,
  };
}
