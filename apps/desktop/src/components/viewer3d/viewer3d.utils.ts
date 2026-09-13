import { FieldProperties } from "@openmarch/core";
import type { ResolvedVenue, VenuePreference } from "./viewer3d.types";

export type CameraPreset = "overhead" | "pressBox" | "fieldLevel";

export interface CameraPresetConfiguration {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
}

/** One viewer unit is one traditional 8-to-5 (22.5 inch) step. */
export const WORLD_UNIT_INCHES = 22.5;
export const PIXELS_PER_WORLD_UNIT =
    FieldProperties.PIXELS_PER_INCH * WORLD_UNIT_INCHES;
export const MIN_FIELD_WORLD_DIMENSION = 1;
export const MAX_FIELD_WORLD_DIMENSION = 100_000;

/** The fixed usable floor of the largest built-in indoor preset: 90 × 50 ft. */
export const INDOOR_ARENA_CAPACITY = {
    width: (90 * 12) / WORLD_UNIT_INCHES,
    depth: (50 * 12) / WORLD_UNIT_INCHES,
} as const;

export const INDOOR_ARENA_LIGHT_POSITIONS = [-13, 13].flatMap((x) =>
    ([-7, 7] as const).map((z) => ({ x, y: 19.6, z })),
);

export const getIndoorKeyLightPosition = (
    fieldWidth: number,
    fieldDepth: number,
): [number, number, number] => {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    return [
        largestDimension * 0.18,
        largestDimension * 0.82,
        fieldDepth * 0.08,
    ];
};

const safeWorldDimension = (pixels: number): number => {
    const worldUnits = pixels / PIXELS_PER_WORLD_UNIT;
    if (!Number.isFinite(worldUnits) || worldUnits <= 0)
        return MIN_FIELD_WORLD_DIMENSION;
    return Math.min(
        Math.max(worldUnits, MIN_FIELD_WORLD_DIMENSION),
        MAX_FIELD_WORLD_DIMENSION,
    );
};

export const getFieldWorldDimensions = (fieldProperties: FieldProperties) => ({
    width: safeWorldDimension(fieldProperties.width),
    depth: safeWorldDimension(fieldProperties.height),
});

export const getFieldStepWorldSize = (
    fieldProperties: FieldProperties,
): number => {
    const size = fieldProperties.stepSizeInches / WORLD_UNIT_INCHES;
    return Number.isFinite(size) && size > 0 ? size : 1;
};

export const getField3DValidationError = (
    fieldProperties: FieldProperties,
): string | null => {
    if (
        !Number.isFinite(fieldProperties.stepSizeInches) ||
        fieldProperties.stepSizeInches <= 0
    ) {
        return "The field needs a positive step size before it can be viewed in 3D.";
    }
    if (
        !Number.isFinite(fieldProperties.width) ||
        !Number.isFinite(fieldProperties.height) ||
        fieldProperties.width <= 0 ||
        fieldProperties.height <= 0
    ) {
        return "The field needs two distinct checkpoints on each axis before it can be viewed in 3D.";
    }
    const rawWidth = fieldProperties.width / PIXELS_PER_WORLD_UNIT;
    const rawDepth = fieldProperties.height / PIXELS_PER_WORLD_UNIT;
    if (
        rawWidth < MIN_FIELD_WORLD_DIMENSION ||
        rawDepth < MIN_FIELD_WORLD_DIMENSION
    ) {
        return "This field is too small to render safely in 3D.";
    }
    if (
        rawWidth > MAX_FIELD_WORLD_DIMENSION ||
        rawDepth > MAX_FIELD_WORLD_DIMENSION
    ) {
        return "This custom field is too large to render safely in 3D.";
    }
    return null;
};

/** Convert the editor's top-left canvas coordinates into a field-centered 3D position. */
export const canvasCoordinatesToWorld = (
    coordinate: { x: number; y: number },
    fieldProperties: FieldProperties,
): [number, number, number] => [
    Number.isFinite(coordinate.x)
        ? (coordinate.x - fieldProperties.width / 2) / PIXELS_PER_WORLD_UNIT
        : 0,
    0,
    Number.isFinite(coordinate.y)
        ? (coordinate.y - fieldProperties.height / 2) / PIXELS_PER_WORLD_UNIT
        : 0,
];

export const canUseIndoorArena = (fieldProperties: FieldProperties): boolean =>
    Number.isFinite(fieldProperties.totalWidthInches) &&
    Number.isFinite(fieldProperties.totalHeightInches) &&
    fieldProperties.totalWidthInches > 0 &&
    fieldProperties.totalHeightInches > 0 &&
    fieldProperties.totalWidthInches <= 90 * 12 + 0.01 &&
    fieldProperties.totalHeightInches <= 50 * 12 + 0.01;

export const resolveVenue = (
    preference: VenuePreference,
    fieldProperties: FieldProperties,
): ResolvedVenue => {
    const fitsIndoors = canUseIndoorArena(fieldProperties);
    if (preference === "indoor") return fitsIndoors ? "indoor" : "outdoor";
    if (preference === "outdoor") return "outdoor";
    return fitsIndoors && /^indoor\b/i.test(fieldProperties.name)
        ? "indoor"
        : "outdoor";
};

export interface FieldImageLayout {
    width: number;
    depth: number;
    repeatX: number;
    repeatY: number;
    offsetX: number;
    offsetY: number;
}

/** Match the 2D editor's centered `fit` (contain) and `fill` (cover) behavior. */
export const getFieldImageLayout = (
    fieldWidth: number,
    fieldDepth: number,
    imageWidth: number,
    imageHeight: number,
    mode: "fill" | "fit",
): FieldImageLayout | null => {
    if (
        ![fieldWidth, fieldDepth, imageWidth, imageHeight].every(
            (value) => Number.isFinite(value) && value > 0,
        )
    )
        return null;

    const fieldAspect = fieldWidth / fieldDepth;
    const imageAspect = imageWidth / imageHeight;
    if (mode === "fill") {
        const cropX = imageAspect > fieldAspect ? fieldAspect / imageAspect : 1;
        const cropY = imageAspect < fieldAspect ? imageAspect / fieldAspect : 1;
        return {
            width: fieldWidth,
            depth: fieldDepth,
            repeatX: cropX,
            repeatY: cropY,
            offsetX: (1 - cropX) / 2,
            offsetY: (1 - cropY) / 2,
        };
    }

    const width =
        imageAspect > fieldAspect ? fieldWidth : fieldDepth * imageAspect;
    const depth =
        imageAspect > fieldAspect ? fieldWidth / imageAspect : fieldDepth;
    return {
        width,
        depth,
        repeatX: 1,
        repeatY: 1,
        offsetX: 0,
        offsetY: 0,
    };
};

export const getCameraPresetConfiguration = (
    preset: CameraPreset,
    fieldWidth: number,
    fieldDepth: number,
): CameraPresetConfiguration => {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const cameraScale = Math.max(largestDimension, 8);

    switch (preset) {
        case "pressBox":
            return {
                position: [
                    0,
                    cameraScale * 0.36,
                    Math.max(fieldDepth * 1.05, 4),
                ],
                target: [0, 0, -fieldDepth * 0.08],
                fov: 43,
            };
        case "fieldLevel":
            return {
                position: [0, 3.5, fieldDepth * 0.52],
                target: [0, 1.5, -fieldDepth * 0.28],
                fov: 52,
            };
        case "overhead":
        default:
            return {
                position: [0, cameraScale * 1.25, 0.01],
                target: [0, 0, 0],
                fov: 45,
            };
    }
};

export const rgbaStringToThreeColor = (color: string): string => {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) return "rgb(220, 38, 38)";
    return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
};

export const hasWorldPositionChanged = (
    current: { x: number; z: number },
    next: { x: number; z: number },
    epsilon = 0.0001,
): boolean => {
    const deltaX = next.x - current.x;
    const deltaZ = next.z - current.z;
    return deltaX * deltaX + deltaZ * deltaZ > epsilon * epsilon;
};

const normalizeRadians = (angle: number): number =>
    Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * Point the lower body along forward and lateral travel while leaving the
 * upper body on the drill's authored facing. Backward travel stays front-facing.
 */
export const getLegFacingOffset = (
    deltaX: number,
    deltaZ: number,
    upperBodyYaw: number,
): number => {
    if (deltaX * deltaX + deltaZ * deltaZ < 0.00000001) return 0;

    const travelYaw = Math.atan2(deltaX, deltaZ);
    const relativeYaw = normalizeRadians(travelYaw - upperBodyYaw);
    return Math.abs(relativeYaw) <= Math.PI / 2 ? relativeYaw : 0;
};
