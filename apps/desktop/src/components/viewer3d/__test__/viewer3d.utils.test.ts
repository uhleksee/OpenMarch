import { describe, expect, it } from "vitest";
import { FieldProperties } from "@openmarch/core";
import FieldPropertiesTemplates from "@/global/classes/FieldProperties.templates";
import {
    canUseIndoorArena,
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getField3DValidationError,
    getFieldImageLayout,
    getFieldWorldDimensions,
    hasWorldPositionChanged,
    getLegFacingOffset,
    rgbaStringToThreeColor,
    resolveVenue,
} from "../viewer3d.utils";
import {
    buildFieldNumberGeometry,
    getFieldNumberMarkers,
} from "../FieldNumbers";
import { getBoundedLinePositions, getYGridAnchorWorld } from "../Field3D";

describe("3D viewer coordinate utilities", () => {
    const field = FieldPropertiesTemplates.COLLEGE_FOOTBALL_FIELD_NO_END_ZONES;

    it("centers editor coordinates in the 3D world", () => {
        expect(
            canvasCoordinatesToWorld(
                { x: field.width / 2, y: field.height / 2 },
                field,
            ),
        ).toEqual([0, 0, 0]);
    });

    it("preserves field dimensions in physical world units", () => {
        const dimensions = getFieldWorldDimensions(field);
        const upperLeft = canvasCoordinatesToWorld({ x: 0, y: 0 }, field);
        const lowerRight = canvasCoordinatesToWorld(
            { x: field.width, y: field.height },
            field,
        );

        expect(lowerRight[0] - upperLeft[0]).toBeCloseTo(dimensions.width);
        expect(lowerRight[2] - upperLeft[2]).toBeCloseTo(dimensions.depth);
    });

    it("places the overhead preset directly above the field", () => {
        const camera = getCameraPresetConfiguration("overhead", 192, 84);
        expect(camera.position[0]).toBe(0);
        expect(camera.position[1]).toBeGreaterThan(192);
        expect(camera.target).toEqual([0, 0, 0]);
    });

    it("keeps the field-level preset clear of the home stands", () => {
        const camera = getCameraPresetConfiguration("fieldLevel", 192, 84);
        expect(camera.position[1]).toBeCloseTo(3.5);
        expect(camera.position[2]).toBeGreaterThan(84 / 2);
        expect(camera.position[2]).toBeLessThan(84 / 2 + 3);
    });

    it("converts schema RGBA colors for Three.js materials", () => {
        expect(rgbaStringToThreeColor("rgba(12,34,56,0.5)")).toBe(
            "rgb(12, 34, 56)",
        );
    });

    it("builds field numbers from the existing field template", () => {
        const markers = getFieldNumberMarkers(field);
        expect(markers).toHaveLength(18);
        expect(markers.some((marker) => marker.label === "50")).toBe(true);
        expect(markers.filter((marker) => marker.label === "50")).toHaveLength(
            2,
        );
    });

    it("supports every built-in field preset without number geometry crashes", () => {
        const templates = Object.entries(FieldPropertiesTemplates);
        expect(templates).toHaveLength(16);

        for (const [, template] of templates) {
            const dimensions = getFieldWorldDimensions(template);
            expect(dimensions.width).toBeGreaterThan(0);
            expect(dimensions.depth).toBeGreaterThan(0);
            expect(Number.isFinite(dimensions.width)).toBe(true);
            expect(Number.isFinite(dimensions.depth)).toBe(true);

            for (const preset of [
                "overhead",
                "pressBox",
                "fieldLevel",
            ] as const) {
                const camera = getCameraPresetConfiguration(
                    preset,
                    dimensions.width,
                    dimensions.depth,
                );
                expect(
                    [...camera.position, ...camera.target, camera.fov].every(
                        Number.isFinite,
                    ),
                ).toBe(true);
            }

            const geometry = buildFieldNumberGeometry(template);
            geometry?.dispose();
        }
    });

    it("renders physically identical indoor step systems at the same size", () => {
        const pairs = [
            ["INDOOR_40x60_8to5", "INDOOR_40x60_6to5"],
            ["INDOOR_50x70_8to5", "INDOOR_50x70_6to5"],
            ["INDOOR_50x80_8to5", "INDOOR_50x80_6to5"],
            ["INDOOR_50x90_8to5", "INDOOR_50x90_6to5"],
        ] as const;

        for (const [eightToFive, sixToFive] of pairs) {
            const first = getFieldWorldDimensions(
                FieldPropertiesTemplates[eightToFive],
            );
            const second = getFieldWorldDimensions(
                FieldPropertiesTemplates[sixToFive],
            );
            expect(first.width).toBeCloseTo(second.width);
            expect(first.depth).toBeCloseTo(second.depth);
        }

        expect(
            getFieldWorldDimensions(FieldPropertiesTemplates.INDOOR_50x90_8to5),
        ).toEqual({ width: 48, depth: 600 / 22.5 });
    });

    it("selects the fixed indoor arena only for fields that fit", () => {
        const indoor = FieldPropertiesTemplates.INDOOR_50x90_8to5;
        const soundSport = FieldPropertiesTemplates.SOUNDSPORT_8to5;
        expect(canUseIndoorArena(indoor)).toBe(true);
        expect(resolveVenue("auto", indoor)).toBe("indoor");
        expect(canUseIndoorArena(soundSport)).toBe(false);
        expect(resolveVenue("indoor", soundSport)).toBe("outdoor");
        expect(resolveVenue("auto", soundSport)).toBe("outdoor");
    });

    it("rejects invalid custom dimensions without producing NaN geometry", () => {
        const invalid = new FieldProperties({
            name: "Invalid custom field",
            xCheckpoints: [],
            yCheckpoints: [],
            stepSizeInches: 0,
        });
        expect(getField3DValidationError(invalid)).not.toBeNull();
        expect(getFieldWorldDimensions(invalid)).toEqual({
            width: 1,
            depth: 1,
        });
        expect(
            canvasCoordinatesToWorld({ x: NaN, y: Infinity }, invalid),
        ).toEqual([0, 0, 0]);

        const tooSmall = new FieldProperties({
            name: "Tiny custom field",
            xCheckpoints: [
                {
                    id: 1,
                    name: "left",
                    terseName: "L",
                    axis: "x",
                    stepsFromCenterFront: -0.05,
                    useAsReference: true,
                    visible: true,
                },
                {
                    id: 2,
                    name: "right",
                    terseName: "R",
                    axis: "x",
                    stepsFromCenterFront: 0.05,
                    useAsReference: true,
                    visible: true,
                },
            ],
            yCheckpoints: [
                {
                    id: 1,
                    name: "front",
                    terseName: "F",
                    axis: "y",
                    stepsFromCenterFront: 0,
                    useAsReference: true,
                    visible: true,
                },
                {
                    id: 2,
                    name: "back",
                    terseName: "B",
                    axis: "y",
                    stepsFromCenterFront: -0.1,
                    useAsReference: true,
                    visible: true,
                },
            ],
        });
        expect(getField3DValidationError(tooSmall)).toContain("too small");
    });

    it("anchors fractional custom grids exactly like the 2D editor", () => {
        const custom = new FieldProperties({
            name: "Fractional custom field",
            xCheckpoints: [
                {
                    id: 1,
                    name: "left",
                    terseName: "L",
                    axis: "x",
                    stepsFromCenterFront: -2,
                    useAsReference: true,
                    visible: true,
                },
                {
                    id: 2,
                    name: "right",
                    terseName: "R",
                    axis: "x",
                    stepsFromCenterFront: 2,
                    useAsReference: true,
                    visible: true,
                },
            ],
            yCheckpoints: [
                {
                    id: 1,
                    name: "front",
                    terseName: "F",
                    axis: "y",
                    stepsFromCenterFront: -0.5,
                    useAsReference: true,
                    visible: true,
                },
                {
                    id: 2,
                    name: "back",
                    terseName: "B",
                    axis: "y",
                    stepsFromCenterFront: -4.5,
                    useAsReference: true,
                    visible: true,
                },
            ],
        });

        expect(getYGridAnchorWorld(custom)).toBeCloseTo(1.75);
    });

    it("caps custom grid generation and ignores unsafe intervals", () => {
        expect(getBoundedLinePositions(100_000, 0.00001)).toHaveLength(512);
        expect(getBoundedLinePositions(100, -1)).toEqual([]);
        expect(getBoundedLinePositions(100, 0)).toEqual([]);
    });

    it("matches the editor's fit and fill tarp layouts", () => {
        expect(getFieldImageLayout(48, 24, 100, 100, "fit")).toMatchObject({
            width: 24,
            depth: 24,
            repeatX: 1,
            repeatY: 1,
        });
        expect(getFieldImageLayout(48, 24, 100, 100, "fill")).toMatchObject({
            width: 48,
            depth: 24,
            repeatX: 1,
            repeatY: 0.5,
            offsetY: 0.25,
        });
        expect(getFieldImageLayout(48, 24, 0, 100, "fit")).toBeNull();
    });

    it("only reports movement when a marcher actually changes coordinates", () => {
        expect(
            hasWorldPositionChanged({ x: 12, z: -8 }, { x: 12, z: -8 }),
        ).toBe(false);
        expect(
            hasWorldPositionChanged({ x: 12, z: -8 }, { x: 12.1, z: -8 }),
        ).toBe(true);
    });
});

describe("getLegFacingOffset", () => {
    it("faces the legs toward forward and lateral travel", () => {
        expect(getLegFacingOffset(0, 1, 0)).toBeCloseTo(0);
        expect(getLegFacingOffset(1, 0, 0)).toBeCloseTo(Math.PI / 2);
        expect(getLegFacingOffset(-1, 0, 0)).toBeCloseTo(-Math.PI / 2);
    });

    it("keeps the legs front-facing for backward travel and holds", () => {
        expect(getLegFacingOffset(0, -1, 0)).toBe(0);
        expect(getLegFacingOffset(0, 0, 0)).toBe(0);
    });

    it("uses the authored upper-body facing as its reference", () => {
        expect(getLegFacingOffset(1, 0, Math.PI / 2)).toBeCloseTo(0);
    });
});
