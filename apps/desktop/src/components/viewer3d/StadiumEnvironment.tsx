import { useMemo } from "react";
import * as THREE from "three";
import { getFieldSceneTheme } from "./sceneTheme";
import type { FieldScene } from "./viewer3d.types";

interface StadiumEnvironmentProps {
    fieldWidth: number;
    fieldDepth: number;
    scene: FieldScene;
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
    scene,
}: {
    radius: number;
    scene: FieldScene;
}) {
    const theme = getFieldSceneTheme(scene);
    const uniforms = useMemo(
        () => ({
            topColor: { value: new THREE.Color(theme.skyTop) },
            horizonColor: {
                value: new THREE.Color(theme.skyHorizon),
            },
        }),
        [theme.skyHorizon, theme.skyTop],
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
    scene,
}: {
    position: [number, number, number];
    scale?: number;
    scene: FieldScene;
}) {
    const theme = getFieldSceneTheme(scene);
    return (
        <group position={position} scale={scale}>
            {[
                [-2.2, 0, 0, 1.5],
                [-0.7, 0.45, 0, 1.9],
                [1.1, 0.2, 0, 1.65],
                [2.45, -0.08, 0, 1.25],
            ].map(([x, y, z, size], index) => (
                <mesh key={index} position={[x, y, z]} scale={size}>
                    <icosahedronGeometry args={[1, 2]} />
                    <meshToonMaterial
                        color={index % 2 ? theme.cloudLight : theme.cloudShade}
                    />
                </mesh>
            ))}
        </group>
    );
}

function Tree({
    position,
    scale,
    shade,
    scene,
}: {
    position: [number, number, number];
    scale: number;
    shade: "light" | "dark";
    scene: FieldScene;
}) {
    const theme = getFieldSceneTheme(scene);
    const crownColor = shade === "light" ? theme.treeLight : theme.treeDark;
    return (
        <group position={position} scale={scale}>
            <mesh position={[0, 1.35, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.28, 2.7, 6]} />
                <meshToonMaterial color={theme.treeTrunk} />
            </mesh>
            <mesh position={[0, 3.3, 0]} castShadow>
                <icosahedronGeometry args={[1.55, 1]} />
                <meshToonMaterial color={crownColor} />
            </mesh>
            <mesh position={[-0.9, 2.85, 0.25]} castShadow>
                <icosahedronGeometry args={[0.9, 1]} />
                <meshToonMaterial color={crownColor} />
            </mesh>
            <mesh position={[0.95, 2.9, -0.15]} castShadow>
                <icosahedronGeometry args={[0.95, 1]} />
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
    scene,
}: {
    position: [number, number, number];
    width: number;
    facing: 1 | -1;
    withPressBox?: boolean;
    scene: FieldScene;
}) {
    const theme = getFieldSceneTheme(scene);
    return (
        <group position={position}>
            {[0, 1, 2, 3, 4].map((level) => (
                <mesh
                    key={level}
                    position={[0, 0.3 + level * 0.48, facing * level * 0.7]}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[width, 0.28 + level * 0.07, 1.35]} />
                    <meshToonMaterial
                        color={level % 2 ? theme.bleacher : theme.bleacherDark}
                    />
                </mesh>
            ))}
            {withPressBox && (
                <group position={[0, 5.3, facing * 2.6]}>
                    <mesh castShadow>
                        <boxGeometry args={[width * 0.38, 2.8, 2.8]} />
                        <meshToonMaterial color={theme.pressBox} />
                    </mesh>
                    <mesh position={[0, 0.28, -facing * 1.42]}>
                        <boxGeometry args={[width * 0.3, 1.05, 0.06]} />
                        {scene === "night" ? (
                            <meshBasicMaterial color={theme.window} />
                        ) : (
                            <meshToonMaterial color={theme.window} />
                        )}
                    </mesh>
                    <mesh position={[0, 1.6, 0]} castShadow>
                        <boxGeometry args={[width * 0.44, 0.18, 3.2]} />
                        <meshToonMaterial color={theme.bleacherDark} />
                    </mesh>
                </group>
            )}
        </group>
    );
}

function LightPole({
    position,
    height,
    face,
    scene,
}: {
    position: [number, number, number];
    height: number;
    face: 1 | -1;
    scene: FieldScene;
}) {
    const theme = getFieldSceneTheme(scene);
    return (
        <group position={position}>
            <mesh position={[0, height / 2, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.2, height, 8]} />
                <meshToonMaterial color={theme.pole} />
            </mesh>
            <mesh
                position={[0, height, face * 0.42]}
                rotation={[0.2 * face, 0, 0]}
            >
                <boxGeometry
                    args={
                        scene === "night" ? [3.2, 0.9, 0.26] : [1.8, 0.45, 0.22]
                    }
                />
                {scene === "night" ? (
                    <meshBasicMaterial color="#fff4cf" />
                ) : (
                    <meshToonMaterial color={theme.uniformLight} />
                )}
            </mesh>
        </group>
    );
}

export default function StadiumEnvironment({
    fieldWidth,
    fieldDepth,
    scene,
}: StadiumEnvironmentProps) {
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const theme = getFieldSceneTheme(scene);
    const treePositions = [
        [-fieldWidth * 0.58, -fieldDepth * 0.68, 1.3],
        [-fieldWidth * 0.48, -fieldDepth * 0.9, 1.8],
        [fieldWidth * 0.52, -fieldDepth * 0.78, 1.45],
        [fieldWidth * 0.62, fieldDepth * 0.66, 1.65],
        [-fieldWidth * 0.62, fieldDepth * 0.72, 1.5],
    ] as const;

    return (
        <group>
            <StorybookSky radius={largestDimension * 5} scene={scene} />

            <mesh
                position={[0, -0.24, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[fieldWidth * 3.8, fieldDepth * 5.2]} />
                <meshToonMaterial color={theme.grassOutside} />
            </mesh>

            <mesh position={[0, -0.14, -fieldDepth / 2 - 2.8]} receiveShadow>
                <boxGeometry args={[fieldWidth + 11, 0.12, 5.2]} />
                <meshToonMaterial color={theme.track} />
            </mesh>
            <mesh position={[0, -0.14, fieldDepth / 2 + 2.8]} receiveShadow>
                <boxGeometry args={[fieldWidth + 11, 0.12, 5.2]} />
                <meshToonMaterial color={theme.track} />
            </mesh>
            <mesh position={[-fieldWidth / 2 - 2.8, -0.14, 0]} receiveShadow>
                <boxGeometry args={[5.2, 0.12, fieldDepth]} />
                <meshToonMaterial color={theme.trackEdge} />
            </mesh>
            <mesh position={[fieldWidth / 2 + 2.8, -0.14, 0]} receiveShadow>
                <boxGeometry args={[5.2, 0.12, fieldDepth]} />
                <meshToonMaterial color={theme.trackEdge} />
            </mesh>

            {scene !== "practice" && (
                <>
                    <Bleachers
                        position={[0, 0, -fieldDepth / 2 - 9]}
                        width={fieldWidth * 0.62}
                        facing={-1}
                        scene={scene}
                    />
                    <Bleachers
                        position={[0, 0, fieldDepth / 2 + 9]}
                        width={fieldWidth * 0.72}
                        facing={1}
                        withPressBox
                        scene={scene}
                    />
                </>
            )}

            {[-0.43, 0.43].flatMap((xFactor) =>
                ([-1, 1] as const).map((zFactor) => (
                    <LightPole
                        key={`${xFactor}-${zFactor}`}
                        position={[
                            fieldWidth * xFactor,
                            0,
                            zFactor * (fieldDepth / 2 + 7),
                        ]}
                        height={
                            largestDimension * (scene === "night" ? 0.16 : 0.09)
                        }
                        face={zFactor === 1 ? -1 : 1}
                        scene={scene}
                    />
                )),
            )}

            {scene !== "night" &&
                treePositions.map(([x, z, scale], index) => (
                    <Tree
                        key={index}
                        position={[x, 0, z]}
                        scale={scale}
                        shade={index % 2 ? "light" : "dark"}
                        scene={scene}
                    />
                ))}

            {scene !== "practice" && (
                <group position={[0, 5, -fieldDepth * 2.2]}>
                    <mesh scale={[fieldWidth * 0.9, 18, 24]}>
                        <icosahedronGeometry args={[1, 2]} />
                        <meshToonMaterial color={theme.hillDark} />
                    </mesh>
                    <mesh
                        position={[-fieldWidth * 0.55, -2, 4]}
                        scale={[fieldWidth * 0.48, 13, 18]}
                    >
                        <icosahedronGeometry args={[1, 2]} />
                        <meshToonMaterial color={theme.hillLight} />
                    </mesh>
                </group>
            )}

            {scene === "storybook" && (
                <>
                    <Cloud
                        position={[
                            -fieldWidth * 0.34,
                            largestDimension * 0.3,
                            -fieldDepth * 1.8,
                        ]}
                        scale={largestDimension * 0.025}
                        scene={scene}
                    />
                    <Cloud
                        position={[
                            fieldWidth * 0.3,
                            largestDimension * 0.36,
                            -fieldDepth * 2.1,
                        ]}
                        scale={largestDimension * 0.018}
                        scene={scene}
                    />
                    <Cloud
                        position={[
                            fieldWidth * 0.7,
                            largestDimension * 0.27,
                            fieldDepth * 0.5,
                        ]}
                        scale={largestDimension * 0.014}
                        scene={scene}
                    />
                </>
            )}

            {scene === "practice" && (
                <group position={[fieldWidth * 0.32, 1.35, -fieldDepth * 0.72]}>
                    <mesh>
                        <boxGeometry args={[fieldWidth * 0.18, 2.7, 3.8]} />
                        <meshToonMaterial color={theme.pressBox} />
                    </mesh>
                    <mesh position={[0, 1.5, 0]}>
                        <boxGeometry args={[fieldWidth * 0.21, 0.22, 4.3]} />
                        <meshToonMaterial color={theme.bleacherDark} />
                    </mesh>
                </group>
            )}
        </group>
    );
}
