import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSceneLightPosition, LIGHTING_THEMES } from "./sceneTheme";
import type { LightingMode } from "./viewer3d.types";

interface LightingRigProps {
    fieldWidth: number;
    fieldDepth: number;
    mode: LightingMode;
}

export default function LightingRig({
    fieldWidth,
    fieldDepth,
    mode,
}: LightingRigProps) {
    const { gl, scene } = useThree();
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const lighting = LIGHTING_THEMES[mode];
    const lightPosition = getSceneLightPosition(mode, fieldWidth, fieldDepth);
    const rimPosition: [number, number, number] = [
        -lightPosition[0],
        largestDimension * 0.34,
        -lightPosition[2],
    ];
    const shadowWarmupFrames = useRef(0);

    useEffect(() => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = lighting.exposure;
        // Give the complete scene two renders before freezing the stationary
        // environment map. This avoids partially populated overhead shadows.
        gl.shadowMap.autoUpdate = true;
        gl.shadowMap.needsUpdate = true;
        shadowWarmupFrames.current = 3;
        scene.background = new THREE.Color(lighting.skyHorizon);
        return () => {
            gl.shadowMap.autoUpdate = true;
        };
    }, [gl, lighting.exposure, lighting.skyHorizon, mode, scene]);

    useFrame(() => {
        if (shadowWarmupFrames.current <= 0) return;
        shadowWarmupFrames.current -= 1;
        if (shadowWarmupFrames.current === 0) {
            gl.shadowMap.autoUpdate = false;
        }
    });

    return (
        <>
            <ambientLight
                color={lighting.ambient}
                intensity={lighting.ambientIntensity}
            />
            <hemisphereLight
                args={[
                    lighting.skyTop,
                    lighting.ground,
                    lighting.hemisphereIntensity,
                ]}
            />
            <directionalLight
                color={lighting.key}
                position={lightPosition}
                intensity={lighting.keyIntensity}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={1}
                shadow-camera-far={largestDimension * 2.5}
                shadow-camera-left={-fieldWidth * 0.62}
                shadow-camera-right={fieldWidth * 0.62}
                shadow-camera-top={fieldDepth * 1.15}
                shadow-camera-bottom={-fieldDepth * 1.15}
                shadow-normalBias={0.025}
                shadow-bias={-0.00025}
            />
            <directionalLight
                color={lighting.rim}
                position={rimPosition}
                intensity={lighting.rimIntensity}
            />
        </>
    );
}
