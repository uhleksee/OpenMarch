import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
    INDOOR_ARENA_CAPACITY,
    INDOOR_ARENA_LIGHT_POSITIONS,
} from "./viewer3d.utils";
import type { LightingMode } from "./viewer3d.types";

interface IndoorArenaEnvironmentProps {
    lightingMode: LightingMode;
}

const ARENA_WIDTH = INDOOR_ARENA_CAPACITY.width + 12;
const ARENA_DEPTH = INDOOR_ARENA_CAPACITY.depth + 14;
const WALL_HEIGHT = 22;

const mergeBoxes = (
    boxes: Array<{
        size: [number, number, number];
        position: [number, number, number];
        rotationY?: number;
    }>,
) => {
    const geometries = boxes.map(({ size, position, rotationY = 0 }) => {
        const geometry = new THREE.BoxGeometry(...size);
        geometry.rotateY(rotationY);
        geometry.translate(...position);
        return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    return merged ?? new THREE.BufferGeometry();
};

export default function IndoorArenaEnvironment({
    lightingMode,
}: IndoorArenaEnvironmentProps) {
    const shellGeometry = useMemo(
        () =>
            mergeBoxes([
                {
                    size: [ARENA_WIDTH, WALL_HEIGHT, 0.5],
                    position: [0, WALL_HEIGHT / 2, -ARENA_DEPTH / 2],
                },
                {
                    size: [0.5, WALL_HEIGHT, ARENA_DEPTH],
                    position: [-ARENA_WIDTH / 2, WALL_HEIGHT / 2, 0],
                },
                {
                    size: [0.5, WALL_HEIGHT, ARENA_DEPTH],
                    position: [ARENA_WIDTH / 2, WALL_HEIGHT / 2, 0],
                },
            ]),
        [],
    );
    const bleacherGeometry = useMemo(() => {
        const tiers = Array.from({ length: 7 }, (_, tier) => ({
            size: [INDOOR_ARENA_CAPACITY.width * 0.72, 0.42, 1.15] as [
                number,
                number,
                number,
            ],
            position: [
                0,
                0.34 + tier * 0.55,
                -INDOOR_ARENA_CAPACITY.depth / 2 - 1.2 - tier * 0.72,
            ] as [number, number, number],
        }));
        return mergeBoxes(tiers);
    }, []);
    const roofFrameGeometry = useMemo(() => {
        const boxes: Parameters<typeof mergeBoxes>[0] = [];
        for (const x of [-ARENA_WIDTH / 2 + 1.2, ARENA_WIDTH / 2 - 1.2]) {
            boxes.push({
                size: [0.36, WALL_HEIGHT, 0.36],
                position: [x, WALL_HEIGHT / 2, -ARENA_DEPTH / 2 + 0.8],
            });
        }
        for (const z of [-16, -8, 0, 8, 16]) {
            boxes.push({
                size: [ARENA_WIDTH, 0.3, 0.3],
                position: [0, WALL_HEIGHT - 1.2, z],
            });
        }
        return mergeBoxes(boxes);
    }, []);
    const lightPanelGeometry = useMemo(
        () =>
            mergeBoxes(
                [-12, 0, 12].flatMap((x) =>
                    [-7.5, 0, 7.5].map((z) => ({
                        size: [7.2, 0.16, 1.25] as [number, number, number],
                        position: [x, WALL_HEIGHT - 1.55, z] as [
                            number,
                            number,
                            number,
                        ],
                    })),
                ),
            ),
        [],
    );

    useEffect(
        () => () => {
            shellGeometry.dispose();
            bleacherGeometry.dispose();
            roofFrameGeometry.dispose();
            lightPanelGeometry.dispose();
        },
        [
            bleacherGeometry,
            lightPanelGeometry,
            roofFrameGeometry,
            shellGeometry,
        ],
    );

    const isNight = lightingMode === "night";
    const fixtureColor = isNight ? "#d9edff" : "#fff2cf";
    const fixtureIntensity = isNight ? 3.8 : 2.2;

    return (
        <group>
            <mesh position={[0, -0.3, 0]} receiveShadow>
                <boxGeometry args={[ARENA_WIDTH, 0.34, ARENA_DEPTH]} />
                <meshToonMaterial color="#a77d55" />
            </mesh>

            <mesh geometry={shellGeometry} castShadow receiveShadow>
                <meshToonMaterial color="#35414a" />
            </mesh>
            <mesh geometry={roofFrameGeometry} castShadow>
                <meshToonMaterial color="#1c252c" />
            </mesh>
            <mesh geometry={bleacherGeometry} castShadow receiveShadow>
                <meshToonMaterial color="#596773" />
            </mesh>

            <mesh position={[0, 3.2, -ARENA_DEPTH / 2 + 0.32]} receiveShadow>
                <boxGeometry args={[ARENA_WIDTH * 0.82, 2.8, 0.18]} />
                <meshToonMaterial color="#202c35" />
            </mesh>

            <group position={[0, 12.2, -ARENA_DEPTH / 2 + 0.35]}>
                <mesh castShadow>
                    <boxGeometry args={[9.4, 5.2, 0.5]} />
                    <meshToonMaterial color="#11191f" />
                </mesh>
                <mesh position={[0, 0.3, 0.28]}>
                    <boxGeometry args={[7.8, 2.4, 0.08]} />
                    <meshBasicMaterial color="#293f4f" />
                </mesh>
                <mesh position={[0, -1.72, 0.3]}>
                    <boxGeometry args={[5.2, 0.24, 0.08]} />
                    <meshBasicMaterial color="#f4c96b" toneMapped={false} />
                </mesh>
            </group>

            <mesh geometry={lightPanelGeometry}>
                <meshToonMaterial
                    color={fixtureColor}
                    emissive={fixtureColor}
                    emissiveIntensity={fixtureIntensity}
                    toneMapped={false}
                />
            </mesh>

            {INDOOR_ARENA_LIGHT_POSITIONS.map(({ x, y, z }) => (
                <pointLight
                    key={`${x}-${z}`}
                    position={[x, y, z]}
                    color={fixtureColor}
                    intensity={isNight ? 115 : 75}
                    distance={44}
                    decay={2}
                />
            ))}
        </group>
    );
}
