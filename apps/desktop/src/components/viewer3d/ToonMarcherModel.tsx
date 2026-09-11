import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { getInstrumentDefinition, type MarcherPose } from "./instrumentCatalog";
import MarcherEquipment from "./MarcherEquipment";
import { SKIN_TONES, STORYBOOK_THEME } from "./sceneTheme";
import type { MarcherModelProps } from "./Marcher3D";

const POSES: Record<
    MarcherPose,
    {
        leftArmX: number;
        rightArmX: number;
        leftForearmX: number;
        rightForearmX: number;
        leftArmZ: number;
        rightArmZ: number;
    }
> = {
    free: {
        leftArmX: 0,
        rightArmX: 0,
        leftForearmX: 0,
        rightForearmX: 0,
        leftArmZ: -0.12,
        rightArmZ: 0.12,
    },
    woodwind: {
        leftArmX: -0.25,
        rightArmX: -0.32,
        leftForearmX: -1.68,
        rightForearmX: -1.62,
        leftArmZ: -0.38,
        rightArmZ: 0.32,
    },
    horn: {
        leftArmX: -0.18,
        rightArmX: -0.18,
        leftForearmX: -2.02,
        rightForearmX: -2.02,
        leftArmZ: -0.3,
        rightArmZ: 0.3,
    },
    battery: {
        leftArmX: -0.32,
        rightArmX: -0.32,
        leftForearmX: -1.16,
        rightForearmX: -1.16,
        leftArmZ: -0.2,
        rightArmZ: 0.2,
    },
    guard: {
        leftArmX: -0.3,
        rightArmX: -0.15,
        leftForearmX: -1.42,
        rightForearmX: -1.05,
        leftArmZ: -0.16,
        rightArmZ: 0.2,
    },
    keyboard: {
        leftArmX: -0.3,
        rightArmX: -0.3,
        leftForearmX: -1.55,
        rightForearmX: -1.55,
        leftArmZ: -0.28,
        rightArmZ: 0.28,
    },
};

const getVariation = (seed: number) => {
    const normalizedSeed = Math.abs(seed * 9301 + 49297) % 233280;
    const random = normalizedSeed / 233280;
    return {
        skin: SKIN_TONES[Math.floor(random * SKIN_TONES.length)],
        height: 1.06 + random * 0.1,
        plumeLean: (random - 0.5) * 0.14,
        phase: random * Math.PI * 2,
    };
};

export default function ToonMarcherModel({
    color,
    variantSeed,
    section,
    uniformStyle,
    instrumentFinish,
    detailDistance,
    motionRef,
}: MarcherModelProps) {
    const rootRef = useRef<THREE.Group>(null);
    const detailedRef = useRef<THREE.Group>(null);
    const distantRef = useRef<THREE.Group>(null);
    const equipmentRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const animationPhaseRef = useRef(0);
    const motionBlendRef = useRef(0);
    const detailFrameRef = useRef(variantSeed % 12);
    const worldPositionRef = useRef(new THREE.Vector3());
    const { isPlaying } = useIsPlaying()!;
    const variation = getVariation(variantSeed);
    const instrument = getInstrumentDefinition(section);
    const pose = POSES[instrument.pose];
    const isClassic = uniformStyle === "classic";
    const isModern = uniformStyle === "modern";
    const isSummer = uniformStyle === "summer";
    const pantsColor = isSummer ? color : STORYBOOK_THEME.uniformDark;

    useFrame(({ camera }, delta) => {
        const root = rootRef.current;
        const leftArm = leftArmRef.current;
        const rightArm = rightArmRef.current;
        const leftLeg = leftLegRef.current;
        const rightLeg = rightLegRef.current;
        const equipment = equipmentRef.current;
        if (
            !root ||
            !leftArm ||
            !rightArm ||
            !leftLeg ||
            !rightLeg ||
            !equipment
        )
            return;

        const smoothing = 1 - Math.exp(-delta * 11);
        const movementTarget = isPlaying && motionRef.current ? 1 : 0;
        motionBlendRef.current = THREE.MathUtils.lerp(
            motionBlendRef.current,
            movementTarget,
            1 - Math.exp(-delta * 14),
        );
        let phase = animationPhaseRef.current + variation.phase;
        if (motionBlendRef.current > 0.001) {
            animationPhaseRef.current += delta * 5.4;
            phase = animationPhaseRef.current + variation.phase;
        }
        const stride =
            Math.sin(phase) *
            0.34 *
            instrument.strideScale *
            motionBlendRef.current;

        const armSwing = instrument.pose === "free" ? 0.72 : 0.1;
        leftArm.rotation.x = THREE.MathUtils.lerp(
            leftArm.rotation.x,
            pose.leftArmX - stride * armSwing,
            smoothing,
        );
        rightArm.rotation.x = THREE.MathUtils.lerp(
            rightArm.rotation.x,
            pose.rightArmX + stride * armSwing,
            smoothing,
        );
        leftLeg.rotation.x = THREE.MathUtils.lerp(
            leftLeg.rotation.x,
            stride,
            smoothing,
        );
        rightLeg.rotation.x = THREE.MathUtils.lerp(
            rightLeg.rotation.x,
            -stride,
            smoothing,
        );

        const bob = Math.abs(Math.sin(phase)) * 0.045 * motionBlendRef.current;
        const sway =
            Math.sin(phase * 0.5) *
            instrument.bodySway *
            motionBlendRef.current;
        root.position.y = THREE.MathUtils.lerp(root.position.y, bob, smoothing);
        root.rotation.z = THREE.MathUtils.lerp(
            root.rotation.z,
            sway,
            smoothing,
        );
        equipment.rotation.z = THREE.MathUtils.lerp(
            equipment.rotation.z,
            Math.sin(phase * 0.5) *
                instrument.equipmentSway *
                motionBlendRef.current,
            smoothing,
        );

        detailFrameRef.current += 1;
        if (detailFrameRef.current % 12 === 0) {
            root.getWorldPosition(worldPositionRef.current);
            const showDetail =
                camera.position.distanceTo(worldPositionRef.current) <
                detailDistance;
            if (detailedRef.current) detailedRef.current.visible = showDetail;
            if (distantRef.current) distantRef.current.visible = !showDetail;
        }
    });

    return (
        <group>
            <mesh
                position={[0, 0.018, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[1, 0.58, 1]}
                renderOrder={-1}
            >
                <circleGeometry args={[0.72, 16]} />
                <meshBasicMaterial
                    color={STORYBOOK_THEME.shadow}
                    transparent
                    opacity={0.2}
                    depthWrite={false}
                />
            </mesh>

            <group ref={rootRef} scale={[1, variation.height, 1]}>
                <group ref={distantRef} visible={false}>
                    <mesh position={[0, 1.23, 0]}>
                        <capsuleGeometry args={[0.34, 1.35, 3, 6]} />
                        <meshToonMaterial color={color} />
                    </mesh>
                    <mesh position={[0, 2.22, 0]}>
                        <sphereGeometry args={[0.4, 6, 4]} />
                        <meshToonMaterial color={variation.skin} />
                    </mesh>
                    {isClassic ? (
                        <>
                            <mesh position={[0, 2.58, 0]}>
                                <cylinderGeometry
                                    args={[0.33, 0.38, 0.58, 6]}
                                />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformDark}
                                />
                            </mesh>
                            <mesh
                                position={[variation.plumeLean, 3.08, 0]}
                                scale={[0.17, 0.5, 0.13]}
                            >
                                <icosahedronGeometry args={[1, 1]} />
                                <meshToonMaterial color={color} />
                            </mesh>
                        </>
                    ) : (
                        <mesh position={[0, 2.46, 0]}>
                            <sphereGeometry
                                args={[0.39, 6, 4, 0, Math.PI * 2, 0, 1.5]}
                            />
                            <meshToonMaterial
                                color={
                                    isSummer
                                        ? STORYBOOK_THEME.hair
                                        : STORYBOOK_THEME.uniformLight
                                }
                            />
                        </mesh>
                    )}
                </group>

                <group ref={detailedRef}>
                    <group ref={leftLegRef} position={[-0.2, 0.88, 0]}>
                        <mesh position={[0, -0.38, 0]} castShadow>
                            <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh position={[0, -0.78, 0.09]}>
                            <boxGeometry args={[0.28, 0.16, 0.48]} />
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>
                    <group ref={rightLegRef} position={[0.2, 0.88, 0]}>
                        <mesh position={[0, -0.38, 0]} castShadow>
                            <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh position={[0, -0.78, 0.09]}>
                            <boxGeometry args={[0.28, 0.16, 0.48]} />
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>

                    <mesh position={[0, 1.42, 0]} castShadow>
                        <cylinderGeometry args={[0.34, 0.48, 1.12, 7]} />
                        <meshToonMaterial color={color} />
                    </mesh>

                    {isClassic && (
                        <mesh
                            position={[0, 1.47, 0.36]}
                            rotation={[0, 0, -0.56]}
                        >
                            <boxGeometry args={[0.16, 0.92, 0.05]} />
                            <meshToonMaterial
                                color={STORYBOOK_THEME.uniformLight}
                            />
                        </mesh>
                    )}
                    {isModern && (
                        <>
                            <mesh
                                position={[-0.2, 1.7, 0.34]}
                                rotation={[0, 0, -0.42]}
                            >
                                <boxGeometry args={[0.18, 0.62, 0.06]} />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformLight}
                                />
                            </mesh>
                            <mesh
                                position={[0.2, 1.7, 0.34]}
                                rotation={[0, 0, 0.42]}
                            >
                                <boxGeometry args={[0.18, 0.62, 0.06]} />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformLight}
                                />
                            </mesh>
                        </>
                    )}
                    <mesh position={[0, 1.04, 0.34]}>
                        <boxGeometry args={[0.66, 0.14, 0.08]} />
                        <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                    </mesh>

                    <group
                        ref={leftArmRef}
                        position={[-0.44, 1.88, 0]}
                        rotation={[
                            pose.leftArmX,
                            0,
                            isSummer ? -0.18 : pose.leftArmZ,
                        ]}
                    >
                        <mesh position={[0, -0.25, 0]} castShadow>
                            <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                            <meshToonMaterial
                                color={isSummer ? variation.skin : color}
                            />
                        </mesh>
                        <group
                            position={[0, -0.5, 0]}
                            rotation={[pose.leftForearmX, 0, 0]}
                        >
                            <mesh position={[0, -0.25, 0]} castShadow>
                                <capsuleGeometry args={[0.105, 0.34, 3, 6]} />
                                <meshToonMaterial
                                    color={isSummer ? variation.skin : color}
                                />
                            </mesh>
                            <mesh position={[0, -0.53, 0]}>
                                <sphereGeometry args={[0.14, 7, 5]} />
                                <meshToonMaterial color={variation.skin} />
                            </mesh>
                        </group>
                    </group>
                    <group
                        ref={rightArmRef}
                        position={[0.44, 1.88, 0]}
                        rotation={[
                            pose.rightArmX,
                            0,
                            isSummer ? 0.18 : pose.rightArmZ,
                        ]}
                    >
                        <mesh position={[0, -0.25, 0]} castShadow>
                            <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                            <meshToonMaterial
                                color={isSummer ? variation.skin : color}
                            />
                        </mesh>
                        <group
                            position={[0, -0.5, 0]}
                            rotation={[pose.rightForearmX, 0, 0]}
                        >
                            <mesh position={[0, -0.25, 0]} castShadow>
                                <capsuleGeometry args={[0.105, 0.34, 3, 6]} />
                                <meshToonMaterial
                                    color={isSummer ? variation.skin : color}
                                />
                            </mesh>
                            <mesh position={[0, -0.53, 0]}>
                                <sphereGeometry args={[0.14, 7, 5]} />
                                <meshToonMaterial color={variation.skin} />
                            </mesh>
                        </group>
                    </group>

                    <mesh position={[0, 2.22, 0]} castShadow>
                        <sphereGeometry args={[0.4, 9, 7]} />
                        <meshToonMaterial color={variation.skin} />
                    </mesh>

                    {isClassic && (
                        <>
                            <mesh position={[0, 2.55, -0.035]} castShadow>
                                <cylinderGeometry
                                    args={[0.33, 0.39, 0.62, 8]}
                                />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformDark}
                                />
                            </mesh>
                            <mesh position={[0, 2.28, 0.3]}>
                                <boxGeometry args={[0.82, 0.08, 0.28]} />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformDark}
                                />
                            </mesh>
                            <mesh position={[0, 2.66, 0.33]}>
                                <boxGeometry args={[0.5, 0.1, 0.05]} />
                                <meshToonMaterial color={color} />
                            </mesh>
                            <group
                                position={[variation.plumeLean, 3.08, 0]}
                                rotation={[0, 0, variation.plumeLean]}
                            >
                                {[-0.2, 0.06, 0.32].map((y, index) => (
                                    <mesh
                                        key={y}
                                        position={[
                                            index * variation.plumeLean * 0.7,
                                            y,
                                            0,
                                        ]}
                                        scale={[1, 1.45, 0.72]}
                                        castShadow
                                    >
                                        <icosahedronGeometry
                                            args={[index === 1 ? 0.2 : 0.17, 1]}
                                        />
                                        <meshToonMaterial
                                            color={
                                                index === 1
                                                    ? STORYBOOK_THEME.uniformLight
                                                    : color
                                            }
                                        />
                                    </mesh>
                                ))}
                            </group>
                        </>
                    )}
                    {isModern && (
                        <>
                            <mesh position={[0, 2.5, 0]} castShadow>
                                <sphereGeometry
                                    args={[0.4, 8, 6, 0, Math.PI * 2, 0, 1.7]}
                                />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformLight}
                                />
                            </mesh>
                            <mesh position={[0, 2.38, 0.34]}>
                                <boxGeometry args={[0.7, 0.07, 0.3]} />
                                <meshToonMaterial color={color} />
                            </mesh>
                        </>
                    )}
                    {isSummer && (
                        <>
                            <mesh position={[0, 2.48, -0.05]}>
                                <sphereGeometry
                                    args={[0.39, 8, 5, 0, Math.PI * 2, 0, 1.45]}
                                />
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.hair}
                                />
                            </mesh>
                            <mesh position={[0, 2.42, 0.3]}>
                                <boxGeometry args={[0.62, 0.07, 0.28]} />
                                <meshToonMaterial color={color} />
                            </mesh>
                        </>
                    )}
                </group>
                <group ref={equipmentRef}>
                    <MarcherEquipment
                        kind={instrument.kind}
                        finish={instrumentFinish}
                        accentColor={color}
                    />
                </group>
            </group>
        </group>
    );
}
