export type UniformStyle = "classic" | "modern" | "summer";

export type UniformColorMode = "editor" | "override";
export type LightingMode = "day" | "sunset" | "night";

export interface Viewer3DPreferences {
    uniformStyle: UniformStyle;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
    lightingMode: LightingMode;
}

export const DEFAULT_VIEWER_3D_PREFERENCES: Viewer3DPreferences = {
    uniformStyle: "classic",
    uniformColorMode: "editor",
    uniformColor: "#dc2626",
    showLabels: false,
    lightingMode: "day",
};
