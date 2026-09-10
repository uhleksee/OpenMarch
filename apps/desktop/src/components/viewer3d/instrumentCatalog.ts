export type InstrumentKind =
    | "none"
    | "flute"
    | "clarinet"
    | "saxophone"
    | "trumpet"
    | "mellophone"
    | "trombone"
    | "baritone"
    | "tuba"
    | "snare"
    | "tenors"
    | "bassDrum"
    | "cymbals"
    | "flubDrum"
    | "flag"
    | "rifle"
    | "baton"
    | "keyboard"
    | "synthesizer"
    | "auxPercussion";

export type MarcherPose =
    | "free"
    | "woodwind"
    | "horn"
    | "battery"
    | "guard"
    | "keyboard";

export interface InstrumentDefinition {
    kind: InstrumentKind;
    pose: MarcherPose;
    bodySway: number;
    equipmentSway: number;
}

const SECTION_INSTRUMENTS: Record<string, InstrumentKind> = {
    Piccolo: "flute",
    Flute: "flute",
    Clarinet: "clarinet",
    "Bass Clarinet": "clarinet",
    "Soprano Sax": "saxophone",
    "Alto Sax": "saxophone",
    "Tenor Sax": "saxophone",
    "Bari Sax": "saxophone",
    Trumpet: "trumpet",
    Mellophone: "mellophone",
    Trombone: "trombone",
    "Bass Trombone": "trombone",
    Baritone: "baritone",
    Euphonium: "baritone",
    Tuba: "tuba",
    Snare: "snare",
    Tenors: "tenors",
    "Bass Drum": "bassDrum",
    Cymbals: "cymbals",
    "Flub Drum": "flubDrum",
    "Color Guard": "flag",
    Flag: "flag",
    Rifle: "rifle",
    Twirler: "baton",
    "Drum Major": "baton",
    Marimba: "keyboard",
    Vibraphone: "keyboard",
    Xylophone: "keyboard",
    Synthesizer: "synthesizer",
    "Aux Percussion": "auxPercussion",
};

const WOODWINDS = new Set<InstrumentKind>(["flute", "clarinet", "saxophone"]);
const HORNS = new Set<InstrumentKind>([
    "trumpet",
    "mellophone",
    "trombone",
    "baritone",
    "tuba",
]);
const BATTERY = new Set<InstrumentKind>([
    "snare",
    "tenors",
    "bassDrum",
    "cymbals",
    "flubDrum",
]);
const GUARD = new Set<InstrumentKind>(["flag", "rifle", "baton"]);
const KEYBOARDS = new Set<InstrumentKind>([
    "keyboard",
    "synthesizer",
    "auxPercussion",
]);

const inferInstrumentKind = (section: string): InstrumentKind => {
    const normalized = section.toLowerCase();
    if (normalized.includes("trumpet")) return "trumpet";
    if (normalized.includes("mello") || normalized.includes("horn"))
        return "mellophone";
    if (normalized.includes("trombone")) return "trombone";
    if (normalized.includes("baritone") || normalized.includes("euphonium"))
        return "baritone";
    if (normalized.includes("tuba") || normalized.includes("sousaphone"))
        return "tuba";
    if (normalized.includes("flute") || normalized.includes("piccolo"))
        return "flute";
    if (normalized.includes("clarinet")) return "clarinet";
    if (normalized.includes("sax")) return "saxophone";
    if (normalized.includes("snare")) return "snare";
    if (normalized.includes("tenor") || normalized.includes("quad"))
        return "tenors";
    if (normalized.includes("bass drum")) return "bassDrum";
    if (normalized.includes("cymbal")) return "cymbals";
    if (normalized.includes("flag") || normalized.includes("guard"))
        return "flag";
    if (normalized.includes("rifle")) return "rifle";
    if (normalized.includes("twirl") || normalized.includes("major"))
        return "baton";
    return "none";
};

export const getInstrumentDefinition = (
    section: string,
): InstrumentDefinition => {
    const kind = SECTION_INSTRUMENTS[section] ?? inferInstrumentKind(section);

    if (WOODWINDS.has(kind)) {
        return {
            kind,
            pose: "woodwind",
            bodySway: 0.018,
            equipmentSway: 0.012,
        };
    }
    if (HORNS.has(kind)) {
        return {
            kind,
            pose: "horn",
            bodySway: 0.014,
            equipmentSway: 0.008,
        };
    }
    if (BATTERY.has(kind)) {
        return {
            kind,
            pose: "battery",
            bodySway: 0.01,
            equipmentSway: 0.005,
        };
    }
    if (GUARD.has(kind)) {
        return {
            kind,
            pose: "guard",
            bodySway: 0.045,
            equipmentSway: 0.07,
        };
    }
    if (KEYBOARDS.has(kind)) {
        return {
            kind,
            pose: "keyboard",
            bodySway: 0.005,
            equipmentSway: 0,
        };
    }

    return {
        kind,
        pose: "free",
        bodySway: 0.03,
        equipmentSway: 0,
    };
};

export const getMarcherDetailDistance = (marcherCount: number): number => {
    if (marcherCount >= 200) return 118;
    if (marcherCount >= 120) return 140;
    return 165;
};
