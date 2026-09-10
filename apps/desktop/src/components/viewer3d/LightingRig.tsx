import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getFieldSceneTheme, STORYBOOK_RENDERING } from "./sceneTheme";
import type { FieldScene } from "./viewer3d.types";

interface LightingRigProps {
    fieldWidth: number;
    fieldDepth: number;
    scene: FieldScene;
}

export default function LightingRig({
    fieldWidth,
    fieldDepth,
    scene: fieldScene,
}: LightingRigProps) {
    const { gl, scene } = useThree();
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    const theme = getFieldSceneTheme(fieldScene);
    const isNight = fieldScene === "night";

    useEffect(() => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = isNight ? 0.94 : STORYBOOK_RENDERING.exposure;
        scene.background = new THREE.Color(theme.skyHorizon);
    }, [gl, isNight, scene, theme.skyHorizon]);

    return (
        <>
            <ambientLight
                color={isNight ? "#7898bf" : "#eaf3e9"}
                intensity={isNight ? 0.42 : 0.72}
            />
            <hemisphereLight
                args={[theme.skyTop, theme.grassOutside, isNight ? 0.68 : 1.18]}
            />
            <directionalLight
                color={isNight ? "#fff1c6" : theme.sun}
                position={[
                    -fieldWidth * 0.48,
                    largestDimension * 0.68,
                    fieldDepth * 0.72,
                ]}
                intensity={isNight ? 2.15 : 2.7}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-near={1}
                shadow-camera-far={largestDimension * 2.5}
                shadow-camera-left={-fieldWidth * 0.62}
                shadow-camera-right={fieldWidth * 0.62}
                shadow-camera-top={fieldDepth * 0.78}
                shadow-camera-bottom={-fieldDepth * 0.78}
                shadow-normalBias={0.025}
                shadow-bias={-0.00025}
            />
        </>
    );
}
