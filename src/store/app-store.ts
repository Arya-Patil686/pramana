import { create } from "zustand";

export type Corridor = "punjab-delhi" | "chiangmai-bangkok";
export type VerificationState = "idle" | "verifying" | "verified" | "failed";
export type Screen = "landing" | "console" | "certificate" | "counterfactual" | "validation" | "federation" | "advisory";

interface SuppressedSource {
  id: string;
  name: string;
  suppressed: boolean;
  suppressionLevel: number; // 0-100
}

interface AppState {
  /* Navigation */
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;

  /* Episode selection */
  selectedEpisodeId: string;
  setSelectedEpisodeId: (id: string) => void;

  /* Corridor */
  activeCorridor: Corridor;
  setActiveCorridor: (corridor: Corridor) => void;

  /* Certificate viewer */
  certificateViewerOpen: boolean;
  setCertificateViewerOpen: (open: boolean) => void;
  selectedCertificateId: string | null;
  setSelectedCertificateId: (id: string | null) => void;

  /* Verification */
  verificationState: VerificationState;
  setVerificationState: (state: VerificationState) => void;
  verifiedLayers: number;
  setVerifiedLayers: (count: number) => void;

  /* Counterfactual simulator */
  suppressedSources: SuppressedSource[];
  setSuppressedSources: (sources: SuppressedSource[]) => void;
  toggleSourceSuppression: (id: string) => void;
  setSourceSuppressionLevel: (id: string, level: number) => void;
  counterfactualAQI: number;
  setCounterfactualAQI: (aqi: number) => void;

  /* Globe */
  globeInteractive: boolean;
  setGlobeInteractive: (interactive: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  /* Navigation */
  activeScreen: "landing",
  setActiveScreen: (screen) => set({ activeScreen: screen }),

  /* Episode */
  selectedEpisodeId: "EP-2024-NOV-03",
  setSelectedEpisodeId: (id) => set({ selectedEpisodeId: id }),

  /* Corridor */
  activeCorridor: "punjab-delhi",
  setActiveCorridor: (corridor) => set({ activeCorridor: corridor }),

  /* Certificate viewer */
  certificateViewerOpen: false,
  setCertificateViewerOpen: (open) => set({ certificateViewerOpen: open }),
  selectedCertificateId: null,
  setSelectedCertificateId: (id) => set({ selectedCertificateId: id }),

  /* Verification */
  verificationState: "idle",
  setVerificationState: (state) => set({ verificationState: state }),
  verifiedLayers: 0,
  setVerifiedLayers: (count) => set({ verifiedLayers: count }),

  /* Counterfactual */
  suppressedSources: [
    { id: "sangrur", name: "Sangrur", suppressed: false, suppressionLevel: 0 },
    { id: "patiala", name: "Patiala", suppressed: false, suppressionLevel: 0 },
    { id: "ludhiana", name: "Ludhiana", suppressed: false, suppressionLevel: 0 },
    { id: "bathinda", name: "Bathinda", suppressed: false, suppressionLevel: 0 },
    { id: "moga", name: "Moga", suppressed: false, suppressionLevel: 0 },
    { id: "firozpur", name: "Firozpur", suppressed: false, suppressionLevel: 0 },
  ],
  setSuppressedSources: (sources) => set({ suppressedSources: sources }),
  toggleSourceSuppression: (id) =>
    set((state) => ({
      suppressedSources: state.suppressedSources.map((s) =>
        s.id === id ? { ...s, suppressed: !s.suppressed, suppressionLevel: s.suppressed ? 0 : 100 } : s
      ),
    })),
  setSourceSuppressionLevel: (id, level) =>
    set((state) => ({
      suppressedSources: state.suppressedSources.map((s) =>
        s.id === id ? { ...s, suppressionLevel: level, suppressed: level > 0 } : s
      ),
    })),
  counterfactualAQI: 482,
  setCounterfactualAQI: (aqi) => set({ counterfactualAQI: aqi }),

  /* Globe */
  globeInteractive: false,
  setGlobeInteractive: (interactive) => set({ globeInteractive: interactive }),
}));
