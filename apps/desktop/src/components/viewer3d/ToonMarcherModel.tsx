import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { SKIN_TONES, STORYBOOK_THEME } from "./sceneTheme";
import type { MarcherModelProps } from "./Marcher3D";

const CONTACT_SHADOW_GEOMETRY = new THREE.CircleGeometry(0.82, 24);
const CONTACT_SHADOW_MATERIAL = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
        varying vec2 shadowUv;
        void main() {
            shadowUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 shadowUv;
        void main() {
            float distanceFromCenter = distance(shadowUv, vec2(0.5));
            float alpha = (1.0 - smoothstep(0.12, 0.5, distanceFromCenter)) * 0.34;
            gl_FragColor = vec4(0.035, 0.075, 0.055, alpha);
        }
    `,
});

const getVariation = (seed: number) => {
    const normalizedSeed = Math.abs(seed * 9301 + 49297) % 233280;
    const random = normalizedSeed / 233280;
    return {
        skin: SKIN_TONES[Math.floor(random * SKIN_TONES.length)],
        height: 1.06 + random * 0.1,
        plumeLean: (random - 0.5) * 0.14,
    };
};

export default function ToonMarcherModel({
    color,
    variantSeed,
    uniformStyle,
    motionRef,
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

        const armSwing = 0.72;
        leftArm.rotation.x = THREE.MathUtils.lerp(
            leftArm.rotation.x,
            -stride * armSwing,
            smoothing,
        );
        rightArm.rotation.x = THREE.MathUtils.lerp(
            rightArm.rotation.x,
            stride * armSwing,
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
            <mesh
                position={[0.24, 0.024, 0.3]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[1.28, 0.68, 1]}
                renderOrder={-1}
                geometry={CONTACT_SHADOW_GEOMETRY}
                material={CONTACT_SHADOW_MATERIAL}
                dispose={null}
            ></mesh>

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
                    rotation={[0, 0, isSummer ? -0.18 : -0.12]}
                >
                    <mesh position={[0, -0.25, 0]}>
                        <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group position={[0, -0.5, 0]}>
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
                    rotation={[0, 0, isSummer ? 0.18 : 0.12]}
                >
                    <mesh position={[0, -0.25, 0]}>
                        <capsuleGeometry args={[0.115, 0.34, 3, 6]} />
                        <meshToonMaterial
                            color={isSummer ? variation.skin : color}
                        />
                    </mesh>
                    <group position={[0, -0.5, 0]}>
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
