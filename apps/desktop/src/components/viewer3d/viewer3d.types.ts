export type UniformStyle = "classic" | "modern" | "summer";

export type InstrumentFinish = "brass" | "silver";

export type FieldScene = "storybook" | "night" | "practice";

export type UniformColorMode = "drill" | "override";

export interface Viewer3DPreferences {
    uniformStyle: UniformStyle;
    instrumentFinish: InstrumentFinish;
    fieldScene: FieldScene;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
}

export const DEFAULT_VIEWER_3D_PREFERENCES: Viewer3DPreferences = {
    uniformStyle: "classic",
    instrumentFinish: "brass",
    fieldScene: "storybook",
    uniformColorMode: "drill",
    uniformColor: "#b82d3b",
    showLabels: false,
};
