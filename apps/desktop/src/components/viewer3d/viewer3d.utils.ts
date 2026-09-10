import { FieldProperties } from "@openmarch/core";

export type CameraPreset = "overhead" | "pressBox" | "fieldLevel";

export interface CameraPresetConfiguration {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
}

export const getFieldWorldDimensions = (fieldProperties: FieldProperties) => ({
    width: fieldProperties.width / fieldProperties.pixelsPerStep,
    depth: fieldProperties.height / fieldProperties.pixelsPerStep,
});

/** Convert the editor's top-left canvas coordinates into a field-centered 3D position. */
export const canvasCoordinatesToWorld = (
    coordinate: { x: number; y: number },
    fieldProperties: FieldProperties,
): [number, number, number] => [
    (coordinate.x - fieldProperties.width / 2) / fieldProperties.pixelsPerStep,
    0,
    (coordinate.y - fieldProperties.height / 2) / fieldProperties.pixelsPerStep,
];

export const getCameraPresetConfiguration = (
    preset: CameraPreset,
    fieldWidth: number,
    fieldDepth: number,
): CameraPresetConfiguration => {
    const largestDimension = Math.max(fieldWidth, fieldDepth);

    switch (preset) {
        case "pressBox":
            return {
                position: [0, largestDimension * 0.36, fieldDepth * 1.05],
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
                position: [0, largestDimension * 1.25, 0.01],
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

const normalizeRadians = (angle: number): number => {
    if (angle > Math.PI) return angle - Math.PI * 2;
    if (angle < -Math.PI) return angle + Math.PI * 2;
    return angle;
};

/**
 * Turn the lower body toward lateral and forward travel while leaving backward
 * marching aligned with the upper body.
 */
export const getLowerBodyFacingAngle = (
    deltaX: number,
    deltaZ: number,
    upperBodyAngle: number,
): number => {
    if (deltaX * deltaX + deltaZ * deltaZ <= 0.000001) return 0;

    const movementAngle = Math.atan2(deltaX, deltaZ);
    const relativeAngle = normalizeRadians(movementAngle - upperBodyAngle);

    // Backward and deep backward-diagonal movement should not twist the legs
    // through the body. Marchers keep their feet aligned with their torso.
    if (Math.abs(relativeAngle) > (Math.PI * 2) / 3) return 0;

    return Math.max(-Math.PI / 2, Math.min(Math.PI / 2, relativeAngle));
};

/** Every moving marcher samples the same continuous step cycle. */
export const getSynchronizedStride = (
    elapsedTimeSeconds: number,
    movementBlend: number,
): number => Math.sin(elapsedTimeSeconds * 5.4) * 0.34 * movementBlend;
