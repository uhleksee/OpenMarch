import { describe, expect, it } from "vitest";
import FieldPropertiesTemplates from "@/global/classes/FieldProperties.templates";
import {
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getFieldWorldDimensions,
    rgbaStringToThreeColor,
} from "../viewer3d.utils";

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

    it("preserves field dimensions in step units", () => {
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

    it("converts schema RGBA colors for Three.js materials", () => {
        expect(rgbaStringToThreeColor("rgba(12,34,56,0.5)")).toBe(
            "rgb(12, 34, 56)",
        );
    });
});
