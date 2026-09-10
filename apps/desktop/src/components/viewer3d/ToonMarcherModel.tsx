import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { SKIN_TONES, STORYBOOK_THEME } from "./sceneTheme";
import type { MarcherModelProps } from "./Marcher3D";

const getVariation = (seed: number) => {
    const normalizedSeed = Math.abs(seed * 9301 + 49297) % 233280;
    const random = normalizedSeed / 233280;
    return {
        skin: SKIN_TONES[Math.floor(random * SKIN_TONES.length)],
        height: 0.94 + random * 0.1,
        plumeLean: (random - 0.5) * 0.14,
        phase: random * Math.PI * 2,
    };
};

export default function ToonMarcherModel({
    color,
    variantSeed,
}: MarcherModelProps) {
    const rootRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const animationPhaseRef = useRef(0);
    const { isPlaying } = useIsPlaying()!;
    const variation = getVariation(variantSeed);

    useFrame((_, delta) => {
        const root = rootRef.current;
        const leftArm = leftArmRef.current;
        const rightArm = rightArmRef.current;
        const leftLeg = leftLegRef.current;
        const rightLeg = rightLegRef.current;
        if (!root || !leftArm || !rightArm || !leftLeg || !rightLeg) return;

        if (isPlaying) {
            animationPhaseRef.current += delta * 5.4;
            const phase = animationPhaseRef.current + variation.phase;
            const stride = Math.sin(phase) * 0.34;
            leftArm.rotation.x = -stride * 0.72;
            rightArm.rotation.x = stride * 0.72;
            leftLeg.rotation.x = stride;
            rightLeg.rotation.x = -stride;
            root.position.y = Math.abs(Math.sin(phase)) * 0.045;
        } else {
            leftArm.rotation.x = THREE.MathUtils.lerp(
                leftArm.rotation.x,
                0,
                0.18,
            );
            rightArm.rotation.x = THREE.MathUtils.lerp(
                rightArm.rotation.x,
                0,
                0.18,
            );
            leftLeg.rotation.x = THREE.MathUtils.lerp(
                leftLeg.rotation.x,
                0,
                0.18,
            );
            rightLeg.rotation.x = THREE.MathUtils.lerp(
                rightLeg.rotation.x,
                0,
                0.18,
            );
            root.position.y = THREE.MathUtils.lerp(root.position.y, 0, 0.18);
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
                <circleGeometry args={[0.72, 20]} />
                <meshBasicMaterial
                    color={STORYBOOK_THEME.shadow}
                    transparent
                    opacity={0.2}
                    depthWrite={false}
                />
            </mesh>

            <group ref={rootRef} scale={[1, variation.height, 1]}>
                <group ref={leftLegRef} position={[-0.2, 0.88, 0]}>
                    <mesh position={[0, -0.38, 0]} castShadow>
                        <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                        <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                    </mesh>
                    <mesh position={[0, -0.78, 0.09]} castShadow>
                        <boxGeometry args={[0.28, 0.16, 0.48]} />
                        <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                    </mesh>
                </group>
                <group ref={rightLegRef} position={[0.2, 0.88, 0]}>
                    <mesh position={[0, -0.38, 0]} castShadow>
                        <cylinderGeometry args={[0.13, 0.15, 0.76, 6]} />
                        <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                    </mesh>
                    <mesh position={[0, -0.78, 0.09]} castShadow>
                        <boxGeometry args={[0.28, 0.16, 0.48]} />
                        <meshToonMaterial color={STORYBOOK_THEME.shoe} />
                    </mesh>
                </group>

                <mesh position={[0, 1.42, 0]} castShadow>
                    <cylinderGeometry args={[0.34, 0.48, 1.12, 7]} />
                    <meshToonMaterial color={color} />
                </mesh>
                <mesh
                    position={[0, 1.47, 0.36]}
                    rotation={[0, 0, -0.56]}
                    castShadow
                >
                    <boxGeometry args={[0.16, 0.92, 0.05]} />
                    <meshToonMaterial color={STORYBOOK_THEME.uniformLight} />
                </mesh>
                <mesh position={[0, 1.04, 0.34]} castShadow>
                    <boxGeometry args={[0.66, 0.14, 0.08]} />
                    <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                </mesh>

                <group
                    ref={leftArmRef}
                    position={[-0.44, 1.78, 0]}
                    rotation={[0, 0, -0.12]}
                >
                    <mesh position={[0, -0.4, 0]} castShadow>
                        <capsuleGeometry args={[0.115, 0.58, 3, 6]} />
                        <meshToonMaterial color={color} />
                    </mesh>
                    <mesh position={[0, -0.8, 0]} castShadow>
                        <sphereGeometry args={[0.14, 7, 5]} />
                        <meshToonMaterial color={variation.skin} />
                    </mesh>
                </group>
                <group
                    ref={rightArmRef}
                    position={[0.44, 1.78, 0]}
                    rotation={[0, 0, 0.12]}
                >
                    <mesh position={[0, -0.4, 0]} castShadow>
                        <capsuleGeometry args={[0.115, 0.58, 3, 6]} />
                        <meshToonMaterial color={color} />
                    </mesh>
                    <mesh position={[0, -0.8, 0]} castShadow>
                        <sphereGeometry args={[0.14, 7, 5]} />
                        <meshToonMaterial color={variation.skin} />
                    </mesh>
                </group>

                <mesh position={[0, 2.22, 0]} castShadow>
                    <sphereGeometry args={[0.4, 9, 7]} />
                    <meshToonMaterial color={variation.skin} />
                </mesh>
                <mesh position={[0, 2.48, -0.035]} castShadow>
                    <cylinderGeometry args={[0.34, 0.39, 0.5, 8]} />
                    <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                </mesh>
                <mesh position={[0, 2.28, 0.3]} castShadow>
                    <boxGeometry args={[0.82, 0.08, 0.28]} />
                    <meshToonMaterial color={STORYBOOK_THEME.uniformDark} />
                </mesh>
                <mesh
                    position={[variation.plumeLean, 2.93, 0]}
                    rotation={[0, 0, variation.plumeLean]}
                    castShadow
                >
                    <sphereGeometry args={[0.18, 7, 5]} />
                    <meshToonMaterial color={color} />
                </mesh>
                <mesh position={[0, 2.66, 0.33]} castShadow>
                    <boxGeometry args={[0.5, 0.1, 0.05]} />
                    <meshToonMaterial color={color} />
                </mesh>
            </group>
        </group>
    );
}
