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
        height: 1.01 + random * 0.055,
        plumeLean: (random - 0.5) * 0.14,
    };
};

/**
 * Shared landmarks keep the procedural model proportioned like one coherent
 * mannequin. Uniform details can change without realigning the body, animation
 * pivots, and hats independently.
 */
const MARCHER_PROPORTIONS = {
    hipHeight: 1.22,
    torsoCenter: 1.74,
    shoulderHeight: 2.13,
    shoulderOffset: 0.48,
    headCenter: 2.58,
} as const;

const HEAD_AND_NECK_PROFILE = [
    new THREE.Vector2(0, -0.36),
    new THREE.Vector2(0.11, -0.36),
    new THREE.Vector2(0.115, -0.24),
    new THREE.Vector2(0.2, -0.21),
    new THREE.Vector2(0.27, -0.11),
    new THREE.Vector2(0.29, 0.05),
    new THREE.Vector2(0.25, 0.2),
    new THREE.Vector2(0.13, 0.29),
    new THREE.Vector2(0, 0.32),
];

// Geometry is immutable and shared by every marcher. This keeps model detail
// independent from formation size and leaves room for richer uniform palettes.
const MODEL_GEOMETRIES = {
    leg: new THREE.CylinderGeometry(0.135, 0.11, 1.08, 6),
    shoe: new THREE.BoxGeometry(0.26, 0.16, 0.44),
    torso: new THREE.CylinderGeometry(0.48, 0.35, 1.08, 8),
    classicSash: new THREE.BoxGeometry(0.15, 0.94, 0.05),
    modernPanel: new THREE.BoxGeometry(0.18, 0.62, 0.06),
    belt: new THREE.BoxGeometry(0.68, 0.13, 0.07),
    upperArm: new THREE.CapsuleGeometry(0.095, 0.34, 3, 6),
    forearm: new THREE.CapsuleGeometry(0.09, 0.34, 3, 6),
    hand: new THREE.SphereGeometry(0.105, 7, 5),
    headAndNeck: new THREE.LatheGeometry(HEAD_AND_NECK_PROFILE, 8),
    shako: new THREE.CylinderGeometry(0.305, 0.274, 0.56, 8),
    shakoBrim: new THREE.BoxGeometry(0.61, 0.06, 0.28),
    plume: new THREE.IcosahedronGeometry(0.14, 1),
    plumeCenter: new THREE.IcosahedronGeometry(0.17, 1),
    cap: new THREE.SphereGeometry(0.31, 8, 6, 0, Math.PI * 2, 0, 1.48),
    capBrim: new THREE.BoxGeometry(0.58, 0.06, 0.28),
} as const;

const PLUME_SEGMENTS = [
    { y: 0.08, scale: [0.85, 1.15, 0.68] },
    { y: 0.24, scale: [1, 1.18, 0.7] },
    { y: 0.41, scale: [0.78, 1.08, 0.62] },
] as const;

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
    gaitRef,
    instrumentPose,
}: MarcherModelProps) {
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

    useFrame((_, delta) => {
        const lowerBody = lowerBodyRef.current;
        const leftArm = leftArmRef.current;
        const rightArm = rightArmRef.current;
        const leftLeg = leftLegRef.current;
        const rightLeg = rightLegRef.current;
        if (!lowerBody || !leftArm || !rightArm || !leftLeg || !rightLeg)
            return;

        const smoothing = 1 - Math.exp(-delta * 11);
        const movementTarget = isPlaying && motionRef.current ? 1 : 0;
        motionBlendRef.current = THREE.MathUtils.lerp(
            motionBlendRef.current,
            movementTarget,
            1 - Math.exp(-delta * 14),
        );
        const phase = gaitRef.phase;
        // A cosine reaches alternating extrema on integer beats, making the
        // leading heel visually plant on every count instead of between them.
        const stride = Math.cos(phase) * 0.34 * motionBlendRef.current;

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
        leftLeg.rotation.x = stride;
        rightLeg.rotation.x = -stride;
        lowerBody.rotation.y = THREE.MathUtils.lerp(
            lowerBody.rotation.y,
            motionRef.legFacing,
            smoothing,
        );
    });

    return (
        <group dispose={null}>
            <group
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                scale={[1, variation.height, 1]}
            >
                <group ref={lowerBodyRef}>
                    <group
                        ref={leftLegRef}
                        position={[-0.18, MARCHER_PROPORTIONS.hipHeight, 0]}
                    >
                        <mesh
                            geometry={MODEL_GEOMETRIES.leg}
                            position={[0, -0.54, 0]}
                        >
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh
                            geometry={MODEL_GEOMETRIES.shoe}
                            position={[0, -1.14, 0.09]}
                        >
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>
                    <group
                        ref={rightLegRef}
                        position={[0.18, MARCHER_PROPORTIONS.hipHeight, 0]}
                    >
                        <mesh
                            geometry={MODEL_GEOMETRIES.leg}
                            position={[0, -0.54, 0]}
                        >
                            <meshToonMaterial color={pantsColor} />
                        </mesh>
                        <mesh
                            geometry={MODEL_GEOMETRIES.shoe}
                            position={[0, -1.14, 0.09]}
                        >
                            <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                        </mesh>
                    </group>
                </group>

                <mesh
                    geometry={MODEL_GEOMETRIES.torso}
                    position={[0, MARCHER_PROPORTIONS.torsoCenter, 0]}
                    scale={[1, 1, 0.72]}
                >
                    <meshToonMaterial color={color} />
                </mesh>

                {isClassic && (
                    <mesh
                        geometry={MODEL_GEOMETRIES.classicSash}
                        position={[0, 1.75, 0.32]}
                        rotation={[0, 0, -0.54]}
                    >
                        <meshToonMaterial
                            color={STORYBOOK_THEME.uniformLight}
                        />
                    </mesh>
                )}
                {isModern && (
                    <>
                        <mesh
                            geometry={MODEL_GEOMETRIES.modernPanel}
                            position={[-0.2, 1.92, 0.315]}
                            rotation={[0, 0, -0.42]}
                        >
                            <meshToonMaterial
                                color={STORYBOOK_THEME.uniformLight}
                            />
                        </mesh>
                        <mesh
                            geometry={MODEL_GEOMETRIES.modernPanel}
                            position={[0.2, 1.92, 0.315]}
                            rotation={[0, 0, 0.42]}
                        >
                            <meshToonMaterial
                                color={STORYBOOK_THEME.uniformLight}
                            />
                        </mesh>
                    </>
                )}
                <mesh
                    geometry={MODEL_GEOMETRIES.belt}
                    position={[0, 1.24, 0.265]}
                >
                    <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                </mesh>

                <group
                    ref={leftArmRef}
                    position={[
                        -MARCHER_PROPORTIONS.shoulderOffset,
                        MARCHER_PROPORTIONS.shoulderHeight,
                        0,
                    ]}
                    rotation={[
                        armPose.leftShoulder[0],
                        armPose.leftShoulder[1],
                        armPose.leftShoulder[2] + (isSummer ? -0.06 : 0),
                    ]}
                >
                    <mesh
                        geometry={MODEL_GEOMETRIES.upperArm}
                        position={[0, -0.25, 0]}
                    >
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group position={[0, -0.5, 0]} rotation={armPose.leftElbow}>
                        <mesh
                            geometry={MODEL_GEOMETRIES.forearm}
                            position={[0, -0.25, 0]}
                        >
                            <meshToonMaterial
                                color={isSummer ? variation.skin : color}
                            />
                        </mesh>
                        <mesh
                            geometry={MODEL_GEOMETRIES.hand}
                            position={[0, -0.53, 0]}
                        >
                            <meshToonMaterial color={variation.skin} />
                        </mesh>
                    </group>
                </group>
                <group
                    ref={rightArmRef}
                    position={[
                        MARCHER_PROPORTIONS.shoulderOffset,
                        MARCHER_PROPORTIONS.shoulderHeight,
                        0,
                    ]}
                    rotation={[
                        armPose.rightShoulder[0],
                        armPose.rightShoulder[1],
                        armPose.rightShoulder[2] + (isSummer ? 0.06 : 0),
                    ]}
                >
                    <mesh
                        geometry={MODEL_GEOMETRIES.upperArm}
                        position={[0, -0.25, 0]}
                    >
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group
                        position={[0, -0.5, 0]}
                        rotation={armPose.rightElbow}
                    >
                        <mesh
                            geometry={MODEL_GEOMETRIES.forearm}
                            position={[0, -0.25, 0]}
                        >
                            <meshToonMaterial
                                color={isSummer ? variation.skin : color}
                            />
                        </mesh>
                        <mesh
                            geometry={MODEL_GEOMETRIES.hand}
                            position={[0, -0.53, 0]}
                        >
                            <meshToonMaterial color={variation.skin} />
                        </mesh>
                    </group>
                </group>

                <group position={[0, MARCHER_PROPORTIONS.headCenter, 0]}>
                    <mesh
                        geometry={MODEL_GEOMETRIES.headAndNeck}
                        scale={[0.9, 1, 0.94]}
                    >
                        <meshToonMaterial color={variation.skin} />
                    </mesh>

                    {isClassic && (
                        <>
                            <mesh
                                geometry={MODEL_GEOMETRIES.shako}
                                position={[0, 0.32, -0.005]}
                            >
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformDark}
                                />
                            </mesh>
                            <mesh
                                geometry={MODEL_GEOMETRIES.shakoBrim}
                                position={[0, 0.04, 0.255]}
                            >
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformDark}
                                />
                            </mesh>
                            <group
                                position={[0, 0.59, -0.005]}
                                rotation={[0, 0, variation.plumeLean * 0.65]}
                            >
                                {PLUME_SEGMENTS.map(({ y, scale }, index) => (
                                    <mesh
                                        key={y}
                                        geometry={
                                            index === 1
                                                ? MODEL_GEOMETRIES.plumeCenter
                                                : MODEL_GEOMETRIES.plume
                                        }
                                        position={[0, y, 0]}
                                        scale={scale}
                                    >
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
                            <mesh
                                geometry={MODEL_GEOMETRIES.cap}
                                position={[0, 0.01, 0]}
                                scale={[0.9, 1, 0.95]}
                            >
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.uniformLight}
                                />
                            </mesh>
                            <mesh
                                geometry={MODEL_GEOMETRIES.capBrim}
                                position={[0, 0.06, 0.25]}
                            >
                                <meshToonMaterial color={color} />
                            </mesh>
                        </>
                    )}
                    {isSummer && (
                        <>
                            <mesh
                                geometry={MODEL_GEOMETRIES.cap}
                                position={[0, 0, -0.01]}
                                scale={[0.9, 1, 0.95]}
                            >
                                <meshToonMaterial
                                    color={STORYBOOK_THEME.hair}
                                />
                            </mesh>
                            <mesh
                                geometry={MODEL_GEOMETRIES.capBrim}
                                position={[0, 0.05, 0.25]}
                            >
                                <meshToonMaterial color={color} />
                            </mesh>
                        </>
                    )}
                </group>
            </group>
        </group>
    );
}
