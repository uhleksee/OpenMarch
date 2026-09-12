import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { SKIN_TONES, STORYBOOK_THEME } from "./sceneTheme";
import type { MarcherModelProps } from "./Marcher3D";
import type { InstrumentPose } from "./marcherPose";

const getVariation = (seed: number) => {
    const normalizedSeed = Math.abs(seed * 9301 + 49297) % 233280;
    const random = normalizedSeed / 233280;
    return {
        skin: SKIN_TONES[Math.floor(random * SKIN_TONES.length)],
        height: 1.06 + random * 0.1,
        plumeLean: (random - 0.5) * 0.14,
    };
};

interface ArmPoseDefinition {
    leftShoulder: [number, number, number];
    rightShoulder: [number, number, number];
    leftElbow: [number, number, number];
    rightElbow: [number, number, number];
    marchSwing: number;
}

const ARM_POSES: Record<InstrumentPose, ArmPoseDefinition> = {
    natural: {
        leftShoulder: [0, 0, -0.12],
        rightShoulder: [0, 0, 0.12],
        leftElbow: [0, 0, 0],
        rightElbow: [0, 0, 0],
        marchSwing: 0.72,
    },
    highBrass: {
        leftShoulder: [-1.08, -0.08, -0.3],
        rightShoulder: [-1.08, 0.08, 0.3],
        leftElbow: [-1.05, 0, 0.08],
        rightElbow: [-1.05, 0, -0.08],
        marchSwing: 0.025,
    },
    trombone: {
        leftShoulder: [-1.08, -0.05, -0.24],
        rightShoulder: [-1.42, 0.02, 0.18],
        leftElbow: [-1.04, 0, 0.08],
        rightElbow: [-0.08, 0, 0],
        marchSwing: 0.02,
    },
    lowBrass: {
        leftShoulder: [-0.92, -0.06, -0.24],
        rightShoulder: [-0.92, 0.06, 0.24],
        leftElbow: [-0.88, 0, 0.08],
        rightElbow: [-0.88, 0, -0.08],
        marchSwing: 0.025,
    },
    tuba: {
        leftShoulder: [-0.72, -0.18, -0.42],
        rightShoulder: [-0.62, 0.12, 0.28],
        leftElbow: [-1.15, 0, 0.18],
        rightElbow: [-0.92, 0, -0.1],
        marchSwing: 0.02,
    },
    flute: {
        leftShoulder: [-0.88, -0.58, -0.5],
        rightShoulder: [-0.84, -0.58, 0.42],
        leftElbow: [-0.72, 0, 0.12],
        rightElbow: [-0.72, 0, -0.12],
        marchSwing: 0.02,
    },
    reed: {
        leftShoulder: [-0.7, -0.08, -0.2],
        rightShoulder: [-0.7, 0.08, 0.2],
        leftElbow: [-0.62, 0, 0.06],
        rightElbow: [-0.62, 0, -0.06],
        marchSwing: 0.025,
    },
    battery: {
        leftShoulder: [-0.5, -0.05, -0.2],
        rightShoulder: [-0.5, 0.05, 0.2],
        leftElbow: [-0.48, 0, 0.06],
        rightElbow: [-0.48, 0, -0.06],
        marchSwing: 0.03,
    },
    cymbals: {
        leftShoulder: [-1.12, -0.08, -0.42],
        rightShoulder: [-1.12, 0.08, 0.42],
        leftElbow: [-0.16, 0, 0],
        rightElbow: [-0.16, 0, 0],
        marchSwing: 0.02,
    },
    conducting: {
        leftShoulder: [-0.78, -0.05, -0.5],
        rightShoulder: [-0.78, 0.05, 0.5],
        leftElbow: [-0.36, 0, 0.08],
        rightElbow: [-0.36, 0, -0.08],
        marchSwing: 0.04,
    },
};

export default function ToonMarcherModel({
    color,
    variantSeed,
    uniformStyle,
    motionRef,
    instrumentPose,
}: MarcherModelProps) {
    const rootRef = useRef<THREE.Group>(null);
    const lowerBodyRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const motionBlendRef = useRef(0);
    const { isPlaying } = useIsPlaying()!;
    const variation = getVariation(variantSeed);
    const isClassic = uniformStyle === "classic";
    const isModern = uniformStyle === "modern";
    const isSummer = uniformStyle === "summer";
    const pantsColor = isSummer ? color : STORYBOOK_THEME.uniformDark;
    const armPose = ARM_POSES[instrumentPose];

    useFrame(({ clock }, delta) => {
        const root = rootRef.current;
        const lowerBody = lowerBodyRef.current;
        const leftArm = leftArmRef.current;
        const rightArm = rightArmRef.current;
        const leftLeg = leftLegRef.current;
        const rightLeg = rightLegRef.current;
        if (
            !root ||
            !lowerBody ||
            !leftArm ||
            !rightArm ||
            !leftLeg ||
            !rightLeg
        )
            return;

        const smoothing = 1 - Math.exp(-delta * 11);
        const movementTarget = isPlaying && motionRef.current ? 1 : 0;
        motionBlendRef.current = THREE.MathUtils.lerp(
            motionBlendRef.current,
            movementTarget,
            1 - Math.exp(-delta * 14),
        );
        const phase = clock.elapsedTime * 5.4;
        const stride = Math.sin(phase) * 0.34 * motionBlendRef.current;

        const armSwing = armPose.marchSwing;
        leftArm.rotation.x = THREE.MathUtils.lerp(
            leftArm.rotation.x,
            armPose.leftShoulder[0] - stride * armSwing,
            smoothing,
        );
        rightArm.rotation.x = THREE.MathUtils.lerp(
            rightArm.rotation.x,
            armPose.rightShoulder[0] + stride * armSwing,
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
        lowerBody.rotation.y = THREE.MathUtils.lerp(
            lowerBody.rotation.y,
            motionRef.legFacing,
            smoothing,
        );

        const bob = Math.abs(Math.sin(phase)) * 0.045 * motionBlendRef.current;
        const sway = Math.sin(phase * 0.5) * 0.03 * motionBlendRef.current;
        root.position.y = THREE.MathUtils.lerp(root.position.y, bob, smoothing);
        root.rotation.z = THREE.MathUtils.lerp(
            root.rotation.z,
            sway,
            smoothing,
        );
    });

    return (
        <group>
            <group ref={rootRef} scale={[1, variation.height, 1]}>
                <group ref={lowerBodyRef}>
                    <group ref={leftLegRef} position={[-0.2, 0.88, 0]}>
                        <mesh position={[0, -0.38, 0]}>
                            <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh position={[0, -0.78, 0.09]}>
                            <boxGeometry args={[0.28, 0.16, 0.48]} />
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>
                    <group ref={rightLegRef} position={[0.2, 0.88, 0]}>
                        <mesh position={[0, -0.38, 0]}>
                            <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh position={[0, -0.78, 0.09]}>
                            <boxGeometry args={[0.28, 0.16, 0.48]} />
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>
                </group>

                <mesh position={[0, 1.42, 0]}>
                    <cylinderGeometry args={[0.34, 0.48, 1.12, 7]} />
                    <meshToonMaterial color={color} />
                </mesh>

                {isClassic && (
                    <mesh position={[0, 1.47, 0.36]} rotation={[0, 0, -0.56]}>
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
                        armPose.leftShoulder[0],
                        armPose.leftShoulder[1],
                        armPose.leftShoulder[2] + (isSummer ? -0.06 : 0),
                    ]}
                >
                    <mesh position={[0, -0.25, 0]}>
                        <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group position={[0, -0.5, 0]} rotation={armPose.leftElbow}>
                        <mesh position={[0, -0.25, 0]}>
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
                        armPose.rightShoulder[0],
                        armPose.rightShoulder[1],
                        armPose.rightShoulder[2] + (isSummer ? 0.06 : 0),
                    ]}
                >
                    <mesh position={[0, -0.25, 0]}>
                        <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group
                        position={[0, -0.5, 0]}
                        rotation={armPose.rightElbow}
                    >
                        <mesh position={[0, -0.25, 0]}>
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

                <mesh position={[0, 2.22, 0]}>
                    <sphereGeometry args={[0.4, 9, 7]} />
                    <meshToonMaterial color={variation.skin} />
                </mesh>

                {isClassic && (
                    <>
                        <mesh position={[0, 2.55, -0.035]}>
                            <cylinderGeometry args={[0.33, 0.39, 0.62, 8]} />
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
                        <mesh position={[0, 2.5, 0]}>
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
                            <meshToonMaterial color={STORYBOOK_THEME.hair} />
                        </mesh>
                        <mesh position={[0, 2.42, 0.3]}>
                            <boxGeometry args={[0.62, 0.07, 0.28]} />
                            <meshToonMaterial color={color} />
                        </mesh>
                    </>
                )}
            </group>
        </group>
    );
}
