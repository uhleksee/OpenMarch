import { create } from "zustand";

export type DiagnosticSceneMode =
    | "full"
    | "performers"
    | "environment"
    | "field";

export interface ThreeDiagnosticSnapshot {
    fps: number | null;
    averageFrameMs: number | null;
    worstFrameMs: number | null;
    drawCalls: number | null;
    triangles: number | null;
    geometries: number | null;
    textures: number | null;
}

/** Updated imperatively so diagnostics never cause scene React renders. */
export const threeDiagnosticSnapshot: ThreeDiagnosticSnapshot = {
    fps: null,
    averageFrameMs: null,
    worstFrameMs: null,
    drawCalls: null,
    triangles: null,
    geometries: null,
    textures: null,
};

interface PerformanceDiagnosticsStore {
    enabled: boolean;
    freezePageUpdates: boolean;
    freezeWaveform: boolean;
    sceneMode: DiagnosticSceneMode;
    setEnabled: (enabled: boolean) => void;
    setFreezePageUpdates: (freezePageUpdates: boolean) => void;
    setFreezeWaveform: (freezeWaveform: boolean) => void;
    setSceneMode: (sceneMode: DiagnosticSceneMode) => void;
}

export const usePerformanceDiagnosticsStore =
    create<PerformanceDiagnosticsStore>((set) => ({
        enabled: false,
        freezePageUpdates: false,
        freezeWaveform: false,
        sceneMode: "full",
        setEnabled: (enabled) => set({ enabled }),
        setFreezePageUpdates: (freezePageUpdates) => set({ freezePageUpdates }),
        setFreezeWaveform: (freezeWaveform) => set({ freezeWaveform }),
        setSceneMode: (sceneMode) => set({ sceneMode }),
    }));
