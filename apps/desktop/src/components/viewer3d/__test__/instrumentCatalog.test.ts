import { describe, expect, it } from "vitest";
import {
    getInstrumentDefinition,
    getMarcherDetailDistance,
} from "../instrumentCatalog";

describe("3D instrument catalog", () => {
    it.each([
        ["Trumpet", "trumpet", "horn"],
        ["Bass Clarinet", "clarinet", "woodwind"],
        ["Bass Drum", "bassDrum", "battery"],
        ["Color Guard", "flag", "guard"],
        ["Marimba", "keyboard", "keyboard"],
    ])("maps %s to its model and pose", (section, kind, pose) => {
        const definition = getInstrumentDefinition(section);
        expect(definition.kind).toBe(kind);
        expect(definition.pose).toBe(pose);
    });

    it("provides a safe fallback for custom sections", () => {
        expect(getInstrumentDefinition("Custom Section").kind).toBe("none");
        expect(getInstrumentDefinition("Concert Tuba").kind).toBe("tuba");
    });

    it("reduces detail distance for very large ensembles", () => {
        expect(getMarcherDetailDistance(80)).toBeGreaterThan(
            getMarcherDetailDistance(220),
        );
        expect(getMarcherDetailDistance(220)).toBeLessThanOrEqual(40);
    });
});
