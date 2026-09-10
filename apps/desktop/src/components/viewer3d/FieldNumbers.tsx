import type { FieldProperties } from "@openmarch/core";
import { getFieldWorldDimensions } from "./viewer3d.utils";
import { STORYBOOK_THEME } from "./sceneTheme";

type SegmentName = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const DIGIT_SEGMENTS: Record<string, SegmentName[]> = {
    "0": ["a", "b", "c", "d", "e", "f"],
    "1": ["b", "c"],
    "2": ["a", "b", "g", "e", "d"],
    "3": ["a", "b", "g", "c", "d"],
    "4": ["f", "g", "b", "c"],
    "5": ["a", "f", "g", "c", "d"],
    "6": ["a", "f", "g", "e", "c", "d"],
    "7": ["a", "b", "c"],
    "8": ["a", "b", "c", "d", "e", "f", "g"],
    "9": ["a", "b", "c", "d", "f", "g"],
};

const SEGMENT_LAYOUT: Record<
    SegmentName,
    { position: [number, number, number]; size: [number, number, number] }
> = {
    a: { position: [0, 0, -0.88], size: [0.78, 0.035, 0.15] },
    b: { position: [0.4, 0, -0.44], size: [0.15, 0.035, 0.72] },
    c: { position: [0.4, 0, 0.44], size: [0.15, 0.035, 0.72] },
    d: { position: [0, 0, 0.88], size: [0.78, 0.035, 0.15] },
    e: { position: [-0.4, 0, 0.44], size: [0.15, 0.035, 0.72] },
    f: { position: [-0.4, 0, -0.44], size: [0.15, 0.035, 0.72] },
    g: { position: [0, 0, 0], size: [0.78, 0.035, 0.15] },
};

export interface FieldNumberMarker {
    key: string;
    label: string;
    x: number;
    z: number;
    rotation: number;
    scale: number;
}

export const getFieldNumberMarkers = (
    fieldProperties: FieldProperties,
): FieldNumberMarker[] => {
    const { depth } = getFieldWorldDimensions(fieldProperties);
    const coordinates = fieldProperties.yardNumberCoordinates;
    const homeOutside = coordinates.homeStepsFromFrontToOutside;
    const homeInside = coordinates.homeStepsFromFrontToInside;
    const awayInside = coordinates.awayStepsFromFrontToInside;
    const awayOutside = coordinates.awayStepsFromFrontToOutside;
    const markers: FieldNumberMarker[] = [];

    for (const checkpoint of fieldProperties.xCheckpoints) {
        const label = checkpoint.fieldLabel;
        if (!checkpoint.visible || !label || !/^\d{1,2}$/.test(label)) continue;

        if (homeOutside !== undefined && homeInside !== undefined) {
            markers.push({
                key: `home-${checkpoint.id}`,
                label,
                x: checkpoint.stepsFromCenterFront,
                z: depth / 2 - (homeOutside + homeInside) / 2,
                rotation: 0,
                scale: Math.max(1.1, (homeInside - homeOutside) / 2.1),
            });
        }
        if (awayInside !== undefined && awayOutside !== undefined) {
            markers.push({
                key: `away-${checkpoint.id}`,
                label,
                x: checkpoint.stepsFromCenterFront,
                z: depth / 2 - (awayInside + awayOutside) / 2,
                rotation: Math.PI,
                scale: Math.max(1.1, (awayOutside - awayInside) / 2.1),
            });
        }
    }

    return markers;
};

function Digit({
    value,
    offset,
    color,
}: {
    value: string;
    offset: number;
    color: string;
}) {
    return (
        <group position={[offset, 0, 0]}>
            {(DIGIT_SEGMENTS[value] ?? []).map((segmentName) => {
                const segment = SEGMENT_LAYOUT[segmentName];
                return (
                    <mesh key={segmentName} position={segment.position}>
                        <boxGeometry args={segment.size} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                );
            })}
        </group>
    );
}

function FieldNumber({
    marker,
    color,
}: {
    marker: FieldNumberMarker;
    color: string;
}) {
    const digits = marker.label.padStart(2, "0").split("");
    return (
        <group
            position={[marker.x, 0.045, marker.z]}
            rotation={[0, marker.rotation, 0]}
            scale={marker.scale}
        >
            <Digit value={digits[0]} offset={-0.55} color={color} />
            <Digit value={digits[1]} offset={0.55} color={color} />
        </group>
    );
}

export default function FieldNumbers({
    fieldProperties,
    color = STORYBOOK_THEME.line,
}: {
    fieldProperties: FieldProperties;
    color?: string;
}) {
    return (
        <group>
            {getFieldNumberMarkers(fieldProperties).map((marker) => (
                <FieldNumber key={marker.key} marker={marker} color={color} />
            ))}
        </group>
    );
}
