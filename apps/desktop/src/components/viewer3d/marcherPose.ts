export type InstrumentPose =
    | "natural"
    | "highBrass"
    | "trombone"
    | "lowBrass"
    | "tuba"
    | "flute"
    | "reed"
    | "battery"
    | "cymbals"
    | "conducting";

const POSE_BY_SECTION: Record<string, InstrumentPose> = {
    Trumpet: "highBrass",
    Mellophone: "highBrass",
    Trombone: "trombone",
    "Bass Trombone": "trombone",
    Baritone: "lowBrass",
    Euphonium: "lowBrass",
    Tuba: "tuba",
    Piccolo: "flute",
    Flute: "flute",
    Clarinet: "reed",
    "Bass Clarinet": "reed",
    "Soprano Sax": "reed",
    "Alto Sax": "reed",
    "Tenor Sax": "reed",
    "Bari Sax": "reed",
    Snare: "battery",
    Tenors: "battery",
    "Bass Drum": "battery",
    "Flub Drum": "battery",
    Cymbals: "cymbals",
    "Drum Major": "conducting",
};

export const getInstrumentPose = (section: string): InstrumentPose =>
    POSE_BY_SECTION[section] ?? "natural";
