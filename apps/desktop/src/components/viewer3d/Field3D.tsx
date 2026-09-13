import { useEffect, useMemo } from "react";
import { FieldProperties } from "@openmarch/core";
import * as THREE from "three";
import {
    canvasCoordinatesToWorld,
    getFieldStepWorldSize,
    getFieldWorldDimensions,
    PIXELS_PER_WORLD_UNIT,
} from "./viewer3d.utils";
import { STORYBOOK_THEME } from "./sceneTheme";
import FieldNumbers from "./FieldNumbers";
import FieldSurfaceImage from "./FieldSurfaceImage";
import type { ResolvedVenue } from "./viewer3d.types";

interface Field3DProps {
    fieldProperties: FieldProperties;
    showGrid: boolean;
    showHalfLines: boolean;
    fieldImage: Uint8Array | null;
    venue: ResolvedVenue;
}

const MAX_GRID_LINES_PER_AXIS = 512;
const MAX_FIELD_STRIPES = 128;
const MAX_VISIBLE_CHECKPOINTS_PER_AXIS = 128;

const addLine = (
    points: THREE.Vector3[],
    x1: number,
    z1: number,
    x2: number,
    z2: number,
) => {
    points.push(
        new THREE.Vector3(x1, 0.06, z1),
        new THREE.Vector3(x2, 0.06, z2),
    );
};

const createLineGeometry = (points: THREE.Vector3[]) =>
    new THREE.BufferGeometry().setFromPoints(points);

export const getBoundedLinePositions = (
    length: number,
    requestedSpacing: number,
    maxLines = MAX_GRID_LINES_PER_AXIS,
): number[] => {
    if (
        !Number.isFinite(length) ||
        length <= 0 ||
        !Number.isFinite(requestedSpacing) ||
        requestedSpacing <= 0 ||
        maxLines < 2
    )
        return [];

    const estimatedLines = Math.floor(length / requestedSpacing) + 1;
    const stride = Math.max(1, Math.ceil(estimatedLines / maxLines));
    const spacing = requestedSpacing * stride;
    const positions: number[] = [];
    for (
        let position = -length / 2, index = 0;
        position <= length / 2 + 0.0001 && index < maxLines;
        position += spacing, index += 1
    ) {
        positions.push(position);
    }
    return positions;
};

const getBoundedCenteredLinePositions = (
    length: number,
    requestedSpacing: number,
): number[] => {
    if (
        !Number.isFinite(length) ||
        length <= 0 ||
        !Number.isFinite(requestedSpacing) ||
        requestedSpacing <= 0
    )
        return [];

    const estimatedLines = Math.floor(length / requestedSpacing) + 1;
    const stride = Math.max(
        1,
        Math.ceil(estimatedLines / MAX_GRID_LINES_PER_AXIS),
    );
    const spacing = requestedSpacing * stride;
    const positions = [0];
    for (
        let position = spacing;
        position <= length / 2 + 0.0001 &&
        positions.length + 2 <= MAX_GRID_LINES_PER_AXIS;
        position += spacing
    ) {
        positions.push(position, -position);
    }
    return positions;
};

const getBoundedDescendingLinePositions = (
    length: number,
    anchor: number,
    requestedSpacing: number,
    includeAnchor: boolean,
): number[] => {
    if (
        !Number.isFinite(length) ||
        length <= 0 ||
        !Number.isFinite(anchor) ||
        !Number.isFinite(requestedSpacing) ||
        requestedSpacing <= 0
    )
        return [];

    const minimum = -length / 2;
    const maximum = length / 2;
    const estimatedLines = Math.floor(length / requestedSpacing) + 1;
    const stride = Math.max(
        1,
        Math.ceil(estimatedLines / MAX_GRID_LINES_PER_AXIS),
    );
    const spacing = requestedSpacing * stride;
    let position = anchor - (includeAnchor ? 0 : spacing);
    if (position > maximum) {
        position -= Math.ceil((position - maximum) / spacing) * spacing;
    }

    const positions: number[] = [];
    while (position > minimum && positions.length < MAX_GRID_LINES_PER_AXIS) {
        if (position <= maximum) positions.push(position);
        position -= spacing;
    }
    return positions;
};

export const getYGridAnchorWorld = (
    fieldProperties: FieldProperties,
): number => {
    const sorted = [...fieldProperties.yCheckpoints].sort(
        (first, second) =>
            second.stepsFromCenterFront - first.stepsFromCenterFront,
    );
    if (sorted.length === 0) return 0;
    const firstVisible = sorted.reduce(
        (previous, current) =>
            current.visible &&
            current.stepsFromCenterFront > previous.stepsFromCenterFront
                ? current
                : previous,
        sorted[sorted.length - 1],
    );
    const firstCheckpoint = sorted[0];
    const anchorCheckpoint =
        firstVisible.stepsFromCenterFront !== 0 &&
        !Number.isInteger(firstVisible.stepsFromCenterFront)
            ? firstVisible
            : firstCheckpoint;
    const [, , z] = canvasCoordinatesToWorld(
        {
            x: fieldProperties.centerFrontPoint.xPixels,
            y:
                fieldProperties.centerFrontPoint.yPixels +
                anchorCheckpoint.stepsFromCenterFront *
                    fieldProperties.pixelsPerStep,
        },
        fieldProperties,
    );
    return z;
};

const evenlySample = <T,>(values: T[], maximum: number): T[] => {
    if (values.length <= maximum) return values;
    return Array.from(
        { length: maximum },
        (_, index) =>
            values[Math.round((index * (values.length - 1)) / (maximum - 1))],
    );
};

const createStripedFieldGeometry = (
    width: number,
    depth: number,
    stripeWidth: number,
) => {
    const positions: number[] = [];
    const colors: number[] = [];
    const stripeCount = Math.min(
        MAX_FIELD_STRIPES,
        Math.max(1, Math.ceil(width / stripeWidth)),
    );
    const boundedStripeWidth = width / stripeCount;

    for (let index = 0; index < stripeCount; index += 1) {
        const x1 = -width / 2 + index * boundedStripeWidth;
        const x2 = Math.min(width / 2, x1 + boundedStripeWidth);
        const z1 = -depth / 2;
        const z2 = depth / 2;
        positions.push(
            x1,
            0,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z1,
            x2,
            0,
            z1,
            x1,
            0,
            z2,
            x2,
            0,
            z2,
        );
        const color = new THREE.Color(
            index % 2 ? STORYBOOK_THEME.grassLight : STORYBOOK_THEME.grassDark,
        );
        for (let vertex = 0; vertex < 6; vertex += 1) {
            colors.push(color.r, color.g, color.b);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
};

export default function Field3D({
    fieldProperties,
    showGrid,
    showHalfLines,
    fieldImage,
    venue,
}: Field3DProps) {
    const { width, depth } = getFieldWorldDimensions(fieldProperties);
    const fieldStepWorldSize = getFieldStepWorldSize(fieldProperties);
    const yGridAnchor = getYGridAnchorWorld(fieldProperties);
    const stripeWidth = 8;
    const stripedFieldGeometry = useMemo(
        () => createStripedFieldGeometry(width, depth, stripeWidth),
        [depth, width],
    );

    const minorGridGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        if (!showGrid) return createLineGeometry(points);

        for (const x of getBoundedCenteredLinePositions(
            width,
            fieldStepWorldSize,
        )) {
            addLine(points, x, -depth / 2, x, depth / 2);
        }
        for (const z of getBoundedDescendingLinePositions(
            depth,
            yGridAnchor,
            fieldStepWorldSize,
            true,
        )) {
            addLine(points, -width / 2, z, width / 2, z);
        }
        return createLineGeometry(points);
    }, [depth, fieldStepWorldSize, showGrid, width, yGridAnchor]);

    const halfLineGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        if (!showHalfLines) return createLineGeometry(points);

        const xInterval =
            (fieldProperties.halfLineXInterval ?? 0) * fieldStepWorldSize;
        const yInterval =
            (fieldProperties.halfLineYInterval ?? 0) * fieldStepWorldSize;
        if (Number.isFinite(xInterval) && xInterval > 0) {
            for (const x of getBoundedCenteredLinePositions(width, xInterval)) {
                addLine(points, x, -depth / 2, x, depth / 2);
            }
        }
        if (Number.isFinite(yInterval) && yInterval > 0) {
            for (const z of getBoundedDescendingLinePositions(
                depth,
                yGridAnchor,
                yInterval,
                false,
            )) {
                addLine(points, -width / 2, z, width / 2, z);
            }
        }
        return createLineGeometry(points);
    }, [
        depth,
        fieldProperties,
        fieldStepWorldSize,
        showHalfLines,
        width,
        yGridAnchor,
    ]);

    const checkpointGeometry = useMemo(() => {
        const points: THREE.Vector3[] = [];
        const pixelWidth = fieldProperties.width;
        const pixelHeight = fieldProperties.height;

        const visibleXCheckpoints = evenlySample(
            fieldProperties.xCheckpoints.filter(
                (checkpoint) => checkpoint.visible,
            ),
            MAX_VISIBLE_CHECKPOINTS_PER_AXIS,
        );
        const visibleYCheckpoints = evenlySample(
            fieldProperties.yCheckpoints.filter(
                (checkpoint) => checkpoint.visible,
            ),
            MAX_VISIBLE_CHECKPOINTS_PER_AXIS,
        );

        for (const checkpoint of visibleXCheckpoints) {
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
                for (const yCheckpoint of visibleYCheckpoints) {
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
                        10 / PIXELS_PER_WORLD_UNIT,
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
            for (const checkpoint of visibleYCheckpoints) {
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

    useEffect(
        () => () => {
            stripedFieldGeometry.dispose();
            minorGridGeometry.dispose();
            halfLineGeometry.dispose();
            checkpointGeometry.dispose();
        },
        [
            checkpointGeometry,
            halfLineGeometry,
            minorGridGeometry,
            stripedFieldGeometry,
        ],
    );

    const indoorSurface = venue === "indoor";

    return (
        <group>
            <mesh position={[0, -0.16, 0]} receiveShadow>
                <boxGeometry args={[width, 0.24, depth]} />
                <meshToonMaterial
                    color={
                        indoorSurface ? "#17191d" : STORYBOOK_THEME.grassDark
                    }
                />
            </mesh>
            {indoorSurface ? (
                <mesh
                    position={[0, 0.02, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    receiveShadow
                >
                    <planeGeometry args={[width, depth]} />
                    <meshToonMaterial color="#26282d" />
                </mesh>
            ) : (
                <mesh
                    position={[0, 0.02, 0]}
                    geometry={stripedFieldGeometry}
                    receiveShadow
                >
                    <meshToonMaterial vertexColors />
                </mesh>
            )}
            {fieldProperties.showFieldImage &&
                fieldProperties.backgroundImageOpacity > 0 &&
                fieldImage && (
                    <FieldSurfaceImage
                        imageBytes={fieldImage}
                        fieldWidth={width}
                        fieldDepth={depth}
                        mode={fieldProperties.imageFillOrFit}
                        opacity={fieldProperties.backgroundImageOpacity}
                    />
                )}
            {showGrid && (
                <lineSegments geometry={minorGridGeometry}>
                    <lineBasicMaterial
                        color="#78947d"
                        transparent
                        opacity={0.34}
                    />
                </lineSegments>
            )}
            {showHalfLines && (
                <lineSegments geometry={halfLineGeometry}>
                    <lineBasicMaterial
                        color="#b5c8b6"
                        transparent
                        opacity={0.58}
                    />
                </lineSegments>
            )}
            <lineSegments geometry={checkpointGeometry}>
                <lineBasicMaterial color={STORYBOOK_THEME.line} />
            </lineSegments>
            <FieldNumbers fieldProperties={fieldProperties} />
        </group>
    );
}
