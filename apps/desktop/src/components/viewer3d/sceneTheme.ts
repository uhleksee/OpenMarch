export const STORYBOOK_THEME = {
    skyTop: "#68afe0",
    skyHorizon: "#c9e1e2",
    cloudLight: "#fff0cf",
    cloudShade: "#d7e0d9",
    sun: "#ffd49b",
    grassLight: "#4f8b60",
    grassDark: "#3f7553",
    grassOutside: "#6f9a6e",
    line: "#f4f0dc",
    track: "#c47862",
    trackEdge: "#e1aa81",
    bleacher: "#879495",
    bleacherDark: "#566769",
    pressBox: "#e6d1ae",
    window: "#567883",
    pole: "#3e4a45",
    treeTrunk: "#755844",
    treeLight: "#43815a",
    treeDark: "#28634d",
    hillLight: "#5e9369",
    hillDark: "#3f745b",
    uniformDark: "#182934",
    uniformLight: "#f5ead4",
    shoe: "#272c2d",
    hair: "#49392f",
    shadow: "#15291f",
} as const;

export const LIGHTING_THEMES = {
    day: {
        skyTop: STORYBOOK_THEME.skyTop,
        skyHorizon: STORYBOOK_THEME.skyHorizon,
        ambient: "#eaf3e9",
        ground: STORYBOOK_THEME.grassOutside,
        key: STORYBOOK_THEME.sun,
        ambientIntensity: 0.72,
        hemisphereIntensity: 1.18,
        keyIntensity: 2.7,
        rim: "#a9d8ff",
        rimIntensity: 0.34,
        exposure: 1.08,
        sunHeight: 0.62,
        sunX: -0.48,
        sunZ: -0.92,
        fogNearFactor: 1.35,
        fogFarFactor: 4.4,
    },
    sunset: {
        skyTop: "#53658f",
        skyHorizon: "#f0a06d",
        ambient: "#d8b2a4",
        ground: "#526f5b",
        key: "#ff9854",
        ambientIntensity: 0.55,
        hemisphereIntensity: 0.82,
        keyIntensity: 3.15,
        rim: "#718bc7",
        rimIntensity: 0.62,
        exposure: 0.98,
        sunHeight: 0.27,
        sunX: -0.62,
        sunZ: -0.95,
        fogNearFactor: 1.05,
        fogFarFactor: 3.75,
    },
    night: {
        skyTop: "#071426",
        skyHorizon: "#263b55",
        ambient: "#7891b5",
        ground: "#263c35",
        key: "#b9d7ff",
        ambientIntensity: 0.28,
        hemisphereIntensity: 0.48,
        keyIntensity: 1.15,
        rim: "#5f86c9",
        rimIntensity: 0.45,
        exposure: 0.78,
        sunHeight: 0.58,
        sunX: 0.58,
        sunZ: -0.92,
        fogNearFactor: 1.15,
        fogFarFactor: 3.7,
    },
} as const;

export type SceneLightingMode = keyof typeof LIGHTING_THEMES;

export const getSceneLightPosition = (
    mode: SceneLightingMode,
    fieldWidth: number,
    fieldDepth: number,
): [number, number, number] => {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const lighting = LIGHTING_THEMES[mode];
    const distance = 1.35;
    return [
        largestDimension * lighting.sunX * distance,
        largestDimension * lighting.sunHeight * distance,
        largestDimension * lighting.sunZ * distance,
    ];
};

export const CINEMATIC_OVERLAYS = {
    day: {
        background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(18, 35, 31, 0.2) 100%), linear-gradient(180deg, rgba(255, 225, 174, 0.045), transparent 42%)",
    },
    sunset: {
        background:
            "radial-gradient(ellipse at center, transparent 48%, rgba(28, 22, 39, 0.3) 100%), linear-gradient(115deg, rgba(255, 133, 74, 0.12), transparent 46%, rgba(62, 85, 145, 0.1))",
    },
    night: {
        background:
            "radial-gradient(ellipse at center, transparent 46%, rgba(1, 8, 20, 0.42) 100%), linear-gradient(180deg, rgba(78, 115, 174, 0.08), transparent 48%)",
    },
} as const;

export const SKIN_TONES = [
    "#f2c7a0",
    "#dca77d",
    "#bd805c",
    "#89563f",
    "#5f3d31",
] as const;
