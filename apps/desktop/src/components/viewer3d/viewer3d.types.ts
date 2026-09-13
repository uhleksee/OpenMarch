export type UniformStyle = "classic" | "modern" | "summer";

export type UniformColorMode = "editor" | "override";
export type LightingMode = "day" | "sunset" | "night";
export type VenuePreference = "auto" | "outdoor" | "indoor";
export type ResolvedVenue = "outdoor" | "indoor";

export interface Viewer3DPreferences {
    uniformStyle: UniformStyle;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
    lightingMode: LightingMode;
    venue: VenuePreference;
}

export const DEFAULT_VIEWER_3D_PREFERENCES: Viewer3DPreferences = {
    uniformStyle: "classic",
    uniformColorMode: "editor",
    uniformColor: "#dc2626",
    showLabels: false,
    lightingMode: "day",
    venue: "auto",
};
