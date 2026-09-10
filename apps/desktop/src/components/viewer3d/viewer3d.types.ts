export type UniformStyle = "classic" | "modern" | "summer";

export type InstrumentFinish = "brass" | "silver";

export interface Viewer3DPreferences {
    uniformStyle: UniformStyle;
    instrumentFinish: InstrumentFinish;
    showCrowd: boolean;
}

export const DEFAULT_VIEWER_3D_PREFERENCES: Viewer3DPreferences = {
    uniformStyle: "classic",
    instrumentFinish: "brass",
    showCrowd: true,
};
