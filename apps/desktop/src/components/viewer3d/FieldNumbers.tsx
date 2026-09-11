import type { FieldProperties } from "@openmarch/core";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

const buildFieldNumberGeometry = (fieldProperties: FieldProperties) => {
    const segmentGeometries: THREE.BufferGeometry[] = [];
    const markerMatrix = new THREE.Matrix4();
    const localMatrix = new THREE.Matrix4();
    const worldMatrix = new THREE.Matrix4();
    const markerQuaternion = new THREE.Quaternion();
    const markerScale = new THREE.Vector3();

    for (const marker of getFieldNumberMarkers(fieldProperties)) {
        markerQuaternion.setFromEuler(new THREE.Euler(0, marker.rotation, 0));
        markerScale.setScalar(marker.scale);
        markerMatrix.compose(
            new THREE.Vector3(marker.x, 0.045, marker.z),
            markerQuaternion,
            markerScale,
        );

        const digits = marker.label.padStart(2, "0").split("");
        digits.forEach((digit, digitIndex) => {
            const digitOffset = digitIndex === 0 ? -0.55 : 0.55;
            for (const segmentName of DIGIT_SEGMENTS[digit] ?? []) {
                const segment = SEGMENT_LAYOUT[segmentName];
                const geometry = new THREE.BoxGeometry(...segment.size);
                localMatrix.makeTranslation(
                    digitOffset + segment.position[0],
                    segment.position[1],
                    segment.position[2],
                );
                worldMatrix.multiplyMatrices(markerMatrix, localMatrix);
                geometry.applyMatrix4(worldMatrix);
                segmentGeometries.push(geometry);
            }
        });
    }

    const merged = mergeGeometries(segmentGeometries, false);
    segmentGeometries.forEach((geometry) => geometry.dispose());
    return merged ?? new THREE.BufferGeometry();
};

export default function FieldNumbers({
    fieldProperties,
}: {
    fieldProperties: FieldProperties;
}) {
    const geometry = useMemo(
        () => buildFieldNumberGeometry(fieldProperties),
        [fieldProperties],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <mesh geometry={geometry}>
            <meshBasicMaterial color={STORYBOOK_THEME.line} />
        </mesh>
    );
}
