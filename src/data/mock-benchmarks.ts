/* ═══════════════════════════════════════════════════════════
   PRAMĀNA — Mock Benchmark Data
   Honest comparison including where PRAMĀNA loses
   ═══════════════════════════════════════════════════════════ */

export interface BenchmarkMetric {
  name: string;
  unit: string;
  pramana: number;
  persistence: number;
  climatology: number;
  googleAQ: number;
  bestIs: "highest" | "lowest";
  description: string;
}

export interface BenchmarkResult {
  category: string;
  metrics: BenchmarkMetric[];
}

export const BENCHMARKS: BenchmarkResult[] = [
  {
    category: "Detection Skill",
    metrics: [
      {
        name: "Probability of Detection (POD)",
        unit: "%",
        pramana: 87.3,
        persistence: 52.1,
        climatology: 41.8,
        googleAQ: 74.6,
        bestIs: "highest",
        description: "Fraction of observed severe episodes correctly forecast",
      },
      {
        name: "False Alarm Ratio (FAR)",
        unit: "%",
        pramana: 18.2,
        persistence: 34.7,
        climatology: 28.5,
        googleAQ: 15.9, // Google wins here
        bestIs: "lowest",
        description: "Fraction of forecast alerts that did not materialize",
      },
      {
        name: "Critical Success Index (CSI)",
        unit: "",
        pramana: 0.73,
        persistence: 0.38,
        climatology: 0.34,
        googleAQ: 0.65,
        bestIs: "highest",
        description: "Combined measure of detection accuracy (0–1 scale)",
      },
    ],
  },
  {
    category: "Forecast Performance",
    metrics: [
      {
        name: "Usable Lead Time",
        unit: "hours",
        pramana: 38,
        persistence: 0,
        climatology: 0,
        googleAQ: 24,
        bestIs: "highest",
        description: "Hours before threshold crossing that forecast is actionable",
      },
      {
        name: "Peak AQI RMSE",
        unit: "AQI points",
        pramana: 42,
        persistence: 128,
        climatology: 156,
        googleAQ: 67,
        bestIs: "lowest",
        description: "Root mean square error on peak AQI predictions",
      },
      {
        name: "24h Avg RMSE",
        unit: "AQI points",
        pramana: 31,
        persistence: 85,
        climatology: 72, // Climatology beats persistence here
        googleAQ: 28, // Google wins on 24h average
        bestIs: "lowest",
        description: "RMSE on 24-hour rolling average predictions",
      },
    ],
  },
  {
    category: "Attribution Quality",
    metrics: [
      {
        name: "Source District Accuracy",
        unit: "%",
        pramana: 82.4,
        persistence: 0,
        climatology: 0,
        googleAQ: 0,
        bestIs: "highest",
        description: "Correct identification of top-3 contributing districts",
      },
      {
        name: "Contribution Estimate MAE",
        unit: "pp",
        pramana: 4.7,
        persistence: 0,
        climatology: 0,
        googleAQ: 0,
        bestIs: "lowest",
        description: "Mean absolute error on contribution percentage estimates",
      },
      {
        name: "Confidence Interval Coverage",
        unit: "%",
        pramana: 91.2,
        persistence: 0,
        climatology: 0,
        googleAQ: 0,
        bestIs: "highest",
        description: "Fraction of true values falling within reported confidence intervals",
      },
    ],
  },
];

/* ── "Where PRAMĀNA loses" callouts ──────────────────── */
export interface HonestyCallout {
  metric: string;
  winner: string;
  winnerValue: string;
  pramanaValue: string;
  explanation: string;
}

export const HONESTY_CALLOUTS: HonestyCallout[] = [
  {
    metric: "False Alarm Ratio",
    winner: "Google AQ API",
    winnerValue: "15.9%",
    pramanaValue: "18.2%",
    explanation:
      "Google's larger training corpus and conservative thresholds produce fewer false alarms. PRAMĀNA trades a slightly higher FAR for significantly better detection of true severe events (POD 87.3% vs 74.6%).",
  },
  {
    metric: "24h Average RMSE",
    winner: "Google AQ API",
    winnerValue: "28 AQI pts",
    pramanaValue: "31 AQI pts",
    explanation:
      "On smooth 24-hour averages, Google's global model slightly outperforms. PRAMĀNA's advantage is specifically in peak prediction and lead time — the metrics that matter for emergency response.",
  },
];

/* ── Gap Comparison Table (Landing page) ──────────────── */
export interface GapComparison {
  system: string;
  realTimeData: "yes" | "no" | "partial";
  forecast: "yes" | "no" | "partial";
  attribution: "yes" | "no" | "partial";
  verifiable: "yes" | "no" | "partial";
  crossBorder: "yes" | "no" | "partial";
  isPramana: boolean;
}

export const GAP_COMPARISONS: GapComparison[] = [
  {
    system: "CPCB AQI Portal",
    realTimeData: "yes",
    forecast: "no",
    attribution: "no",
    verifiable: "no",
    crossBorder: "no",
    isPramana: false,
  },
  {
    system: "Google AQ API",
    realTimeData: "yes",
    forecast: "partial",
    attribution: "no",
    verifiable: "no",
    crossBorder: "partial",
    isPramana: false,
  },
  {
    system: "Academic Studies",
    realTimeData: "no",
    forecast: "partial",
    attribution: "partial",
    verifiable: "no",
    crossBorder: "partial",
    isPramana: false,
  },
  {
    system: "GRAP Protocol",
    realTimeData: "yes",
    forecast: "no",
    attribution: "no",
    verifiable: "no",
    crossBorder: "no",
    isPramana: false,
  },
  {
    system: "PRAMĀNA",
    realTimeData: "yes",
    forecast: "yes",
    attribution: "yes",
    verifiable: "yes",
    crossBorder: "yes",
    isPramana: true,
  },
];
