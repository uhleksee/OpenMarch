import { useMemo } from "react";
import { FieldProperties } from "@openmarch/core";
import * as THREE from "three";
import {
    canvasCoordinatesToWorld,
    getFieldWorldDimensions,
} from "./viewer3d.utils";

interface Field3DProps {
    fieldProperties: FieldProperties;
    showGrid: boolean;
    showHalfLines: boolean;
}

const addLine = (
    points: THREE.Vector3[],
    x1: number,
    z1: number,
    x2: number,
    z2: number,
) => {
    points.push(
        new THREE.Vector3(x1, 0.025, z1),
        new THREE.Vector3(x2, 0.025, z2),
    );
};

const createLineGeometry = (points: THREE.Vector3[]) =>
    new THREE.BufferGeometry().setFromPoints(points);

export default function Field3D({
    fieldProperties,
    showGrid,
    showHalfLines,
}: Field3DProps) {
    const { width, depth } = getFieldWorldDimensions(fieldProperties);

    const minorGridGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        if (!showGrid) return createLineGeometry(points);

        for (let x = -width / 2; x <= width / 2; x += 1) {
            addLine(points, x, -depth / 2, x, depth / 2);
        }
        for (let z = -depth / 2; z <= depth / 2; z += 1) {
            addLine(points, -width / 2, z, width / 2, z);
        }
        return createLineGeometry(points);
    }, [depth, showGrid, width]);

    const halfLineGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        if (!showHalfLines) return createLineGeometry(points);

        const xInterval = fieldProperties.halfLineXInterval;
        const yInterval = fieldProperties.halfLineYInterval;
        if (xInterval) {
            for (let x = 0; x <= width / 2; x += xInterval) {
                addLine(points, x, -depth / 2, x, depth / 2);
                if (x !== 0) addLine(points, -x, -depth / 2, -x, depth / 2);
            }
        }
        if (yInterval) {
            for (let z = -depth / 2; z <= depth / 2; z += yInterval) {
                addLine(points, -width / 2, z, width / 2, z);
            }
        }
        return createLineGeometry(points);
    }, [depth, fieldProperties, showHalfLines, width]);

    const checkpointGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const pixelWidth = fieldProperties.width;
        const pixelHeight = fieldProperties.height;

        for (const checkpoint of fieldProperties.xCheckpoints) {
            if (!checkpoint.visible) continue;
            const [x] = canvasCoordinatesToWorld(
                {
                    x:
                        fieldProperties.centerFrontPoint.xPixels +
                        checkpoint.stepsFromCenterFront *
                            fieldProperties.pixelsPerStep,
                    y: 0,
                },
                fieldProperties,
            );
            addLine(points, x, -depth / 2, x, depth / 2);

            if (fieldProperties.useHashes) {
                for (const yCheckpoint of fieldProperties.yCheckpoints) {
                    if (!yCheckpoint.visible) continue;
                    const [, , z] = canvasCoordinatesToWorld(
                        {
                            x: 0,
                            y:
                                fieldProperties.centerFrontPoint.yPixels +
                                yCheckpoint.stepsFromCenterFront *
                                    fieldProperties.pixelsPerStep,
                        },
                        fieldProperties,
                    );
                    const halfHash = Math.min(
                        10 / fieldProperties.pixelsPerStep,
                        width / 2,
                    );
                    addLine(
                        points,
                        Math.max(-width / 2, x - halfHash),
                        z,
                        Math.min(width / 2, x + halfHash),
                        z,
                    );
                }
            }
        }

        if (!fieldProperties.useHashes) {
            for (const checkpoint of fieldProperties.yCheckpoints) {
                if (!checkpoint.visible) continue;
                const [, , z] = canvasCoordinatesToWorld(
                    {
                        x: 0,
                        y:
                            fieldProperties.centerFrontPoint.yPixels +
                            checkpoint.stepsFromCenterFront *
                                fieldProperties.pixelsPerStep,
                    },
                    fieldProperties,
                );
                addLine(points, -width / 2, z, width / 2, z);
            }
        }

        const [left, , back] = canvasCoordinatesToWorld(
            { x: 0, y: 0 },
            fieldProperties,
        );
        const [right, , front] = canvasCoordinatesToWorld(
            { x: pixelWidth, y: pixelHeight },
            fieldProperties,
        );
        addLine(points, left, back, right, back);
        addLine(points, right, back, right, front);
        addLine(points, right, front, left, front);
        addLine(points, left, front, left, back);

        return createLineGeometry(points);
    }, [depth, fieldProperties, width]);

    return (
        <group>
            <mesh position={[0, -0.13, 0]} receiveShadow>
                <boxGeometry args={[width, 0.24, depth]} />
                <meshStandardMaterial color="#24543a" roughness={0.94} />
            </mesh>
            <mesh
                position={[0, -0.16, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[width * 1.45, depth * 1.65]} />
                <meshStandardMaterial color="#14251c" roughness={1} />
            </mesh>
            {showGrid && (
                <lineSegments geometry={minorGridGeometry}>
                    <lineBasicMaterial
                        color="#63806c"
                        transparent
                        opacity={0.34}
                    />
                </lineSegments>
            )}
            {showHalfLines && (
                <lineSegments geometry={halfLineGeometry}>
                    <lineBasicMaterial
                        color="#a9c3af"
                        transparent
                        opacity={0.58}
                    />
                </lineSegments>
            )}
            <lineSegments geometry={checkpointGeometry}>
                <lineBasicMaterial color="#f3f7ed" />
            </lineSegments>
        </group>
    );
}
