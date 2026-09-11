import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STORYBOOK_RENDERING, STORYBOOK_THEME } from "./sceneTheme";

interface LightingRigProps {
    fieldWidth: number;
    fieldDepth: number;
}

export default function LightingRig({
    fieldWidth,
    fieldDepth,
}: LightingRigProps) {
    const { gl, scene } = useThree();
    const largestDimension = Math.max(fieldWidth, fieldDepth);

    useEffect(() => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = STORYBOOK_RENDERING.exposure;
        scene.background = new THREE.Color(STORYBOOK_THEME.skyHorizon);
    }, [gl, scene]);

    return (
        <>
            <ambientLight color="#eaf3e9" intensity={0.72} />
            <hemisphereLight
                args={[
                    STORYBOOK_THEME.skyTop,
                    STORYBOOK_THEME.grassOutside,
                    1.18,
                ]}
            />
            <directionalLight
                color={STORYBOOK_THEME.sun}
                position={[
                    -fieldWidth * 0.48,
                    largestDimension * 0.68,
                    fieldDepth * 0.72,
                ]}
                intensity={2.7}
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
