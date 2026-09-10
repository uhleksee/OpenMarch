import { useMemo } from "react";
import { FieldProperties } from "@openmarch/core";
import * as THREE from "three";
import {
    canvasCoordinatesToWorld,
    getFieldWorldDimensions,
} from "./viewer3d.utils";
import { getFieldSceneTheme } from "./sceneTheme";
import FieldNumbers from "./FieldNumbers";
import type { FieldScene } from "./viewer3d.types";

interface Field3DProps {
    fieldProperties: FieldProperties;
    showGrid: boolean;
    showHalfLines: boolean;
    scene: FieldScene;
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
    scene,
}: Field3DProps) {
    const theme = getFieldSceneTheme(scene);
    const { width, depth } = getFieldWorldDimensions(fieldProperties);
    const stripeWidth = 8;
    const stripeCount = Math.ceil(width / stripeWidth);

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
                <meshToonMaterial color={theme.grassDark} />
            </mesh>
            {Array.from({ length: stripeCount }, (_, index) => {
                const currentWidth = Math.min(
                    stripeWidth,
                    width - index * stripeWidth,
                );
                return (
                    <mesh
                        key={index}
                        position={[
                            -width / 2 + index * stripeWidth + currentWidth / 2,
                            0,
                            0,
                        ]}
                        receiveShadow
                    >
                        <boxGeometry args={[currentWidth, 0.02, depth]} />
                        <meshToonMaterial
                            color={
                                index % 2 ? theme.grassLight : theme.grassDark
                            }
                        />
                    </mesh>
                );
            })}
            {showGrid && (
                <lineSegments geometry={minorGridGeometry}>
                    <lineBasicMaterial
                        color={scene === "night" ? "#497064" : "#78947d"}
                        transparent
                        opacity={0.34}
                    />
                </lineSegments>
            )}
            {showHalfLines && (
                <lineSegments geometry={halfLineGeometry}>
                    <lineBasicMaterial
                        color={scene === "night" ? "#9bb6ad" : "#b5c8b6"}
                        transparent
                        opacity={0.58}
                    />
                </lineSegments>
            )}
            <lineSegments geometry={checkpointGeometry}>
                <lineBasicMaterial color={theme.line} />
            </lineSegments>
            <FieldNumbers
                fieldProperties={fieldProperties}
                color={theme.line}
            />
        </group>
    );
}
