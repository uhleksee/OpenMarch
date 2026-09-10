import type { FieldScene } from "./viewer3d.types";

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

export const FIELD_SCENE_THEMES = {
    storybook: STORYBOOK_THEME,
    night: {
        ...STORYBOOK_THEME,
        skyTop: "#07152d",
        skyHorizon: "#223a59",
        cloudLight: "#60728a",
        cloudShade: "#354760",
        sun: "#dcecff",
        grassLight: "#24543c",
        grassDark: "#173f30",
        grassOutside: "#112f28",
        line: "#e8f1e8",
        track: "#4b4557",
        trackEdge: "#676174",
        bleacher: "#52606f",
        bleacherDark: "#293746",
        pressBox: "#5b6571",
        window: "#f1d18a",
        pole: "#17212e",
        treeTrunk: "#3b3436",
        treeLight: "#214a3a",
        treeDark: "#14372e",
        hillLight: "#1b3c34",
        hillDark: "#102b27",
        shadow: "#050b14",
    },
    practice: {
        ...STORYBOOK_THEME,
        skyTop: "#8bc8e8",
        skyHorizon: "#e6efe8",
        sun: "#ffe0a6",
        grassLight: "#619866",
        grassDark: "#4f865a",
        grassOutside: "#7eaa75",
        track: "#a29b83",
        trackEdge: "#c8bf9f",
        bleacher: "#9aa4a0",
        bleacherDark: "#687875",
        pressBox: "#d7c6a5",
        window: "#73909a",
        hillLight: "#73a477",
        hillDark: "#57875f",
    },
} as const;

export const getFieldSceneTheme = (scene: FieldScene) =>
    FIELD_SCENE_THEMES[scene];

export const STORYBOOK_RENDERING = {
    exposure: 1.08,
    fogNearFactor: 1.25,
    fogFarFactor: 4.2,
} as const;

export const SKIN_TONES = [
    "#f2c7a0",
    "#dca77d",
    "#bd805c",
    "#89563f",
    "#5f3d31",
] as const;
