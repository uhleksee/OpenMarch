import { describe, expect, it } from "vitest";
import { getInstrumentPose } from "../marcherPose";

describe("getInstrumentPose", () => {
    it.each([
        ["Trumpet", "highBrass"],
        ["Mellophone", "highBrass"],
        ["Trombone", "trombone"],
        ["Baritone", "lowBrass"],
        ["Tuba", "tuba"],
        ["Flute", "flute"],
        ["Tenor Sax", "reed"],
        ["Snare", "battery"],
        ["Cymbals", "cymbals"],
        ["Drum Major", "conducting"],
    ] as const)("maps %s to the %s pose", (section, expectedPose) => {
        expect(getInstrumentPose(section)).toBe(expectedPose);
    });

    it("keeps guard and unknown sections in a neutral pose", () => {
        expect(getInstrumentPose("Color Guard")).toBe("natural");
        expect(getInstrumentPose("Custom Section")).toBe("natural");
    });
});
