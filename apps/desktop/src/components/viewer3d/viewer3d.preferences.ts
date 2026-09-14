import {
    DEFAULT_VIEWER_3D_PREFERENCES,
    type LightingMode,
    type UniformColorMode,
    type UniformStyle,
    type VenuePreference,
    type Viewer3DPreferences,
} from "./viewer3d.types";

export const VIEWER_PREFERENCES_KEY = "openmarch-3d-viewer-preferences";

export const loadViewerPreferences = (): Viewer3DPreferences => {
    if (typeof window === "undefined") return DEFAULT_VIEWER_3D_PREFERENCES;
    try {
        const saved = window.localStorage.getItem(VIEWER_PREFERENCES_KEY);
        if (!saved) return DEFAULT_VIEWER_3D_PREFERENCES;
        const parsed = JSON.parse(saved) as Partial<Viewer3DPreferences>;
        return {
            uniformStyle: ["classic", "modern", "summer"].includes(
                parsed.uniformStyle ?? "",
            )
                ? (parsed.uniformStyle as UniformStyle)
                : DEFAULT_VIEWER_3D_PREFERENCES.uniformStyle,
            uniformColorMode: ["editor", "override"].includes(
                parsed.uniformColorMode ?? "",
            )
                ? (parsed.uniformColorMode as UniformColorMode)
                : DEFAULT_VIEWER_3D_PREFERENCES.uniformColorMode,
            uniformColor:
                typeof parsed.uniformColor === "string"
                    ? parsed.uniformColor
                    : DEFAULT_VIEWER_3D_PREFERENCES.uniformColor,
            showLabels:
                typeof parsed.showLabels === "boolean"
                    ? parsed.showLabels
                    : DEFAULT_VIEWER_3D_PREFERENCES.showLabels,
            lightingMode: ["day", "sunset", "night"].includes(
                parsed.lightingMode ?? "",
            )
                ? (parsed.lightingMode as LightingMode)
                : DEFAULT_VIEWER_3D_PREFERENCES.lightingMode,
            venue: ["auto", "outdoor", "indoor"].includes(parsed.venue ?? "")
                ? (parsed.venue as VenuePreference)
                : DEFAULT_VIEWER_3D_PREFERENCES.venue,
        };
    } catch {
        return DEFAULT_VIEWER_3D_PREFERENCES;
    }
};

export const saveViewerPreferences = (
    preferences: Viewer3DPreferences,
): void => {
    window.localStorage.setItem(
        VIEWER_PREFERENCES_KEY,
        JSON.stringify(preferences),
    );
};
