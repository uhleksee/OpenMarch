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
