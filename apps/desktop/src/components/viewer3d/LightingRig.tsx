import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSceneLightPosition, LIGHTING_THEMES } from "./sceneTheme";
import { getIndoorKeyLightPosition } from "./viewer3d.utils";
import type { LightingMode, ResolvedVenue } from "./viewer3d.types";

interface LightingRigProps {
    fieldWidth: number;
    fieldDepth: number;
    mode: LightingMode;
    venue: ResolvedVenue;
}

export default function LightingRig({
    fieldWidth,
    fieldDepth,
    mode,
    venue,
}: LightingRigProps) {
    const { gl, scene } = useThree();
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const lighting = LIGHTING_THEMES[mode];
    const isIndoor = venue === "indoor";
    const lightPosition: [number, number, number] = isIndoor
        ? getIndoorKeyLightPosition(fieldWidth, fieldDepth)
        : getSceneLightPosition(mode, fieldWidth, fieldDepth);
    const rimPosition: [number, number, number] = [
        -lightPosition[0],
        largestDimension * 0.34,
        -lightPosition[2],
    ];
    const isSunset = mode === "sunset";
    const shadowWidth = Math.max(2, fieldWidth * (isSunset ? 0.56 : 0.62));
    const shadowDepth = Math.max(2, fieldDepth * (isSunset ? 0.82 : 1.15));
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
        scene.background = new THREE.Color(
            isIndoor ? "#111a22" : lighting.skyHorizon,
        );
        return () => {
            gl.shadowMap.autoUpdate = true;
        };
    }, [
        fieldDepth,
        fieldWidth,
        gl,
        isIndoor,
        lighting.exposure,
        lighting.skyHorizon,
        mode,
        scene,
    ]);

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
                intensity={lighting.ambientIntensity * (isIndoor ? 0.72 : 1)}
            />
            <hemisphereLight
                args={[
                    lighting.skyTop,
                    lighting.ground,
                    lighting.hemisphereIntensity * (isIndoor ? 0.58 : 1),
                ]}
            />
            <directionalLight
                color={isIndoor ? "#fff0d2" : lighting.key}
                position={lightPosition}
                intensity={isIndoor ? 1.85 : lighting.keyIntensity}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-near={1}
                shadow-camera-far={Math.max(25, largestDimension * 2.5)}
                shadow-camera-left={-shadowWidth}
                shadow-camera-right={shadowWidth}
                shadow-camera-top={shadowDepth}
                shadow-camera-bottom={-shadowDepth}
                shadow-normalBias={isSunset ? 0.015 : 0.025}
                shadow-bias={-0.00025}
                shadow-radius={isSunset ? 1.6 : 1.4}
            />
            <directionalLight
                color={lighting.rim}
                position={rimPosition}
                intensity={lighting.rimIntensity}
            />
        </>
    );
}
