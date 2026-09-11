import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
    getSceneLightPosition,
    LIGHTING_THEMES,
    STORYBOOK_THEME,
} from "./sceneTheme";
import type { LightingMode } from "./viewer3d.types";

interface StadiumEnvironmentProps {
    fieldWidth: number;
    fieldDepth: number;
    lightingMode: LightingMode;
}

const SKY_VERTEX_SHADER = `
    varying vec3 worldPosition;
    void main() {
        vec4 positionWorld = modelMatrix * vec4(position, 1.0);
        worldPosition = positionWorld.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const SKY_FRAGMENT_SHADER = `
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    varying vec3 worldPosition;
    void main() {
        float heightMix = smoothstep(-0.15, 0.72, normalize(worldPosition).y);
        gl_FragColor = vec4(mix(horizonColor, topColor, heightMix), 1.0);
    }
`;

function StorybookSky({
    radius,
    lightingMode,
}: {
    radius: number;
    lightingMode: LightingMode;
}) {
    const lighting = LIGHTING_THEMES[lightingMode];
    const uniforms = useMemo(
        () => ({
            topColor: { value: new THREE.Color(lighting.skyTop) },
            horizonColor: {
                value: new THREE.Color(lighting.skyHorizon),
            },
        }),
        [lighting.skyHorizon, lighting.skyTop],
    );

    return (
        <mesh scale={radius} renderOrder={-1000}>
            <sphereGeometry args={[1, 32, 18]} />
            <shaderMaterial
                uniforms={uniforms}
                vertexShader={SKY_VERTEX_SHADER}
                fragmentShader={SKY_FRAGMENT_SHADER}
                side={THREE.BackSide}
                depthWrite={false}
            />
        </mesh>
    );
}

function Cloud({
    position,
    scale = 1,
}: {
    position: [number, number, number];
    scale?: number;
}) {
    return (
        <mesh position={position} scale={[scale * 3.6, scale, scale * 1.15]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshToonMaterial color={STORYBOOK_THEME.cloudLight} />
        </mesh>
    );
}

function CelestialBody({
    fieldWidth,
    fieldDepth,
    lightingMode,
}: StadiumEnvironmentProps) {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const isNight = lightingMode === "night";
    const isSunset = lightingMode === "sunset";
    const color = isNight ? "#dceaff" : isSunset ? "#ffad67" : "#fff0bf";
    const position = getSceneLightPosition(
        lightingMode,
        fieldWidth,
        fieldDepth,
    );
    const radius = largestDimension * (isSunset ? 0.055 : 0.043);

    return (
        <group position={position}>
            <mesh>
                <sphereGeometry args={[radius, 16, 10]} />
                <meshBasicMaterial
                    color={color}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>
            <mesh scale={isNight ? 1.8 : 2.35}>
                <sphereGeometry args={[radius, 12, 8]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={isNight ? 0.07 : 0.09}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    fog={false}
                    toneMapped={false}
                />
            </mesh>
        </group>
    );
}

function Tree({
    position,
    scale,
    shade,
}: {
    position: [number, number, number];
    scale: number;
    shade: "light" | "dark";
}) {
    const crownColor =
        shade === "light"
            ? STORYBOOK_THEME.treeLight
            : STORYBOOK_THEME.treeDark;
    return (
        <group position={position} scale={scale}>
            <mesh position={[0, 1.35, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.28, 2.7, 6]} />
                <meshToonMaterial color={STORYBOOK_THEME.treeTrunk} />
            </mesh>
            <mesh position={[0, 3.15, 0]} scale={[1.35, 1, 1.15]} castShadow>
                <icosahedronGeometry args={[1.55, 0]} />
                <meshToonMaterial color={crownColor} />
            </mesh>
        </group>
    );
}

function Bleachers({
    position,
    width,
    facing,
    withPressBox = false,
}: {
    position: [number, number, number];
    width: number;
    facing: 1 | -1;
    withPressBox?: boolean;
}) {
    const geometry = useMemo(() => {
        const levels = [0, 1, 2, 3, 4].map((level) => {
            const levelGeometry = new THREE.BoxGeometry(
                width,
                0.28 + level * 0.07,
                1.35,
            );
            levelGeometry.translate(
                0,
                0.3 + level * 0.48,
                facing * level * 0.7,
            );
            return levelGeometry;
        });
        const merged = mergeGeometries(levels, false);
        levels.forEach((level) => level.dispose());
        return merged ?? new THREE.BufferGeometry();
    }, [facing, width]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <group position={position}>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshToonMaterial color={STORYBOOK_THEME.bleacher} />
            </mesh>
            {withPressBox && (
                <group position={[0, 5.3, facing * 2.6]}>
                    <mesh castShadow>
                        <boxGeometry args={[width * 0.38, 2.8, 2.8]} />
                        <meshToonMaterial color={STORYBOOK_THEME.pressBox} />
                    </mesh>
                    <mesh position={[0, 0.28, -facing * 1.42]}>
                        <boxGeometry args={[width * 0.3, 1.05, 0.06]} />
                        <meshToonMaterial color={STORYBOOK_THEME.window} />
                    </mesh>
                    <mesh position={[0, 1.6, 0]} castShadow>
                        <boxGeometry args={[width * 0.44, 0.18, 3.2]} />
                        <meshToonMaterial
                            color={STORYBOOK_THEME.bleacherDark}
                        />
                    </mesh>
                </group>
            )}
        </group>
    );
}

function StadiumLightTower({
    position,
    height,
    face,
    lightingMode,
}: {
    position: [number, number, number];
    height: number;
    face: 1 | -1;
    lightingMode: LightingMode;
}) {
    const panelWidth = 7.8;
    const panelHeight = 3.2;
    const towerGeometry = useMemo(() => {
        const geometries: THREE.BufferGeometry[] = [];
        const addBeam = (
            size: [number, number, number],
            beamPosition: [number, number, number],
            rotationZ = 0,
        ) => {
            const geometry = new THREE.BoxGeometry(...size);
            geometry.rotateZ(rotationZ);
            geometry.translate(...beamPosition);
            geometries.push(geometry);
        };

        const towerWidth = 1.25;
        addBeam([0.18, height, 0.18], [-towerWidth / 2, height / 2, 0]);
        addBeam([0.18, height, 0.18], [towerWidth / 2, height / 2, 0]);
        for (let level = 1; level < 7; level += 1) {
            const bottom = ((level - 1) / 7) * height;
            const top = (level / 7) * height;
            const middle = (bottom + top) / 2;
            const segmentHeight = top - bottom;
            const diagonalLength = Math.hypot(towerWidth, segmentHeight);
            const diagonalAngle = Math.atan2(towerWidth, segmentHeight);
            addBeam([towerWidth + 0.22, 0.12, 0.14], [0, top, 0]);
            addBeam(
                [0.11, diagonalLength, 0.11],
                [0, middle, 0],
                level % 2 ? diagonalAngle : -diagonalAngle,
            );
        }
        addBeam([panelWidth + 0.8, 0.24, 0.3], [0, height, 0]);

        const merged = mergeGeometries(geometries, false);
        geometries.forEach((geometry) => geometry.dispose());
        return merged ?? new THREE.BufferGeometry();
    }, [height]);
    const floodlightGeometry = useMemo(() => {
        const geometries: THREE.BufferGeometry[] = [];
        for (let row = 0; row < 3; row += 1) {
            for (let column = 0; column < 5; column += 1) {
                const geometry = new THREE.BoxGeometry(1.12, 0.72, 0.12);
                geometry.translate(
                    (column - 2) * 1.42,
                    (row - 1) * 0.92,
                    face * 0.3,
                );
                geometries.push(geometry);
            }
        }
        const merged = mergeGeometries(geometries, false);
        geometries.forEach((geometry) => geometry.dispose());
        return merged ?? new THREE.BufferGeometry();
    }, [face]);

    useEffect(() => {
        return () => {
            towerGeometry.dispose();
            floodlightGeometry.dispose();
        };
    }, [floodlightGeometry, towerGeometry]);

    return (
        <group position={position}>
            <mesh geometry={towerGeometry} castShadow>
                <meshToonMaterial color={STORYBOOK_THEME.pole} />
            </mesh>
            <mesh
                position={[0, height + 0.15, 0]}
                rotation={[0.12 * face, 0, 0]}
                castShadow
            >
                <boxGeometry args={[panelWidth, panelHeight, 0.38]} />
                <meshToonMaterial color={STORYBOOK_THEME.pole} />
            </mesh>
            <mesh
                geometry={floodlightGeometry}
                position={[0, height + 0.15, 0]}
                rotation={[0.12 * face, 0, 0]}
            >
                <meshToonMaterial
                    color={STORYBOOK_THEME.uniformLight}
                    emissive={lightingMode === "night" ? "#dff2ff" : "#000000"}
                    emissiveIntensity={lightingMode === "night" ? 4.2 : 0}
                />
            </mesh>
            {lightingMode === "night" && (
                <>
                    <mesh
                        position={[0, height + 0.15, face * 0.42]}
                        rotation={[0.12 * face, 0, 0]}
                    >
                        <planeGeometry
                            args={[panelWidth * 1.22, panelHeight * 1.5]}
                        />
                        <meshBasicMaterial
                            color="#cfe8ff"
                            transparent
                            opacity={0.12}
                            depthWrite={false}
                            blending={THREE.AdditiveBlending}
                            side={THREE.DoubleSide}
                            toneMapped={false}
                        />
                    </mesh>
                    <spotLight
                        position={[0, height + 0.2, face * 0.8]}
                        color="#d9ecff"
                        intensity={420}
                        distance={height * 6}
                        decay={1.35}
                        angle={0.62}
                        penumbra={0.72}
                    />
                </>
            )}
        </group>
    );
}

export default function StadiumEnvironment({
    fieldWidth,
    fieldDepth,
    lightingMode,
}: StadiumEnvironmentProps) {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const treePositions = [
        [-fieldWidth * 0.58, -fieldDepth * 0.68, 1.3],
        [-fieldWidth * 0.48, -fieldDepth * 0.9, 1.8],
        [fieldWidth * 0.52, -fieldDepth * 0.78, 1.45],
        [fieldWidth * 0.62, fieldDepth * 0.66, 1.65],
        [-fieldWidth * 0.62, fieldDepth * 0.72, 1.5],
    ] as const;

    return (
        <group>
            <StorybookSky
                radius={largestDimension * 5}
                lightingMode={lightingMode}
            />
            <CelestialBody
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                lightingMode={lightingMode}
            />

            <mesh
                position={[0, -0.24, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[fieldWidth * 3.8, fieldDepth * 5.2]} />
                <meshToonMaterial color={STORYBOOK_THEME.grassOutside} />
            </mesh>

            <mesh position={[0, -0.14, -fieldDepth / 2 - 2.8]} receiveShadow>
                <boxGeometry args={[fieldWidth + 11, 0.12, 5.2]} />
                <meshToonMaterial color={STORYBOOK_THEME.track} />
            </mesh>
            <mesh position={[0, -0.14, fieldDepth / 2 + 2.8]} receiveShadow>
                <boxGeometry args={[fieldWidth + 11, 0.12, 5.2]} />
                <meshToonMaterial color={STORYBOOK_THEME.track} />
            </mesh>
            <mesh position={[-fieldWidth / 2 - 2.8, -0.14, 0]} receiveShadow>
                <boxGeometry args={[5.2, 0.12, fieldDepth]} />
                <meshToonMaterial color={STORYBOOK_THEME.trackEdge} />
            </mesh>
            <mesh position={[fieldWidth / 2 + 2.8, -0.14, 0]} receiveShadow>
                <boxGeometry args={[5.2, 0.12, fieldDepth]} />
                <meshToonMaterial color={STORYBOOK_THEME.trackEdge} />
            </mesh>

            <Bleachers
                position={[0, 0, -fieldDepth / 2 - 9]}
                width={fieldWidth * 0.62}
                facing={-1}
            />
            {[-0.43, 0.43].flatMap((xFactor) =>
                ([-1, 1] as const).map((zFactor) => (
                    <StadiumLightTower
                        key={`${xFactor}-${zFactor}`}
                        position={[
                            fieldWidth * xFactor,
                            0,
                            zFactor * (fieldDepth / 2 + 7),
                        ]}
                        height={largestDimension * 0.2}
                        face={zFactor === 1 ? -1 : 1}
                        lightingMode={lightingMode}
                    />
                )),
            )}

            {treePositions.map(([x, z, scale], index) => (
                <Tree
                    key={index}
                    position={[x, 0, z]}
                    scale={scale}
                    shade={index % 2 ? "light" : "dark"}
                />
            ))}

            <group position={[0, 5, -fieldDepth * 2.2]}>
                <mesh scale={[fieldWidth * 0.9, 18, 24]}>
                    <icosahedronGeometry args={[1, 2]} />
                    <meshToonMaterial color={STORYBOOK_THEME.hillDark} />
                </mesh>
                <mesh
                    position={[-fieldWidth * 0.55, -2, 4]}
                    scale={[fieldWidth * 0.48, 13, 18]}
                >
                    <icosahedronGeometry args={[1, 2]} />
                    <meshToonMaterial color={STORYBOOK_THEME.hillLight} />
                </mesh>
            </group>

            <Cloud
                position={[
                    -fieldWidth * 0.34,
                    largestDimension * 0.3,
                    -fieldDepth * 1.8,
                ]}
                scale={largestDimension * 0.025}
            />
            <Cloud
                position={[
                    fieldWidth * 0.3,
                    largestDimension * 0.36,
                    -fieldDepth * 2.1,
                ]}
                scale={largestDimension * 0.018}
            />
            <Cloud
                position={[
                    fieldWidth * 0.7,
                    largestDimension * 0.27,
                    fieldDepth * 0.5,
                ]}
                scale={largestDimension * 0.014}
            />
        </group>
    );
}
