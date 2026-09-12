import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getSceneLightPosition, getStadiumLightPositions } from "./sceneTheme";
import type { LightingMode } from "./viewer3d.types";

export interface MarcherShadowGroupRef {
    current: THREE.Group | null;
}

interface MarcherShadowsProps {
    marcherIds: number[];
    marcherRefs: Map<number, MarcherShadowGroupRef>;
    mode: LightingMode;
    fieldWidth: number;
    fieldDepth: number;
}

interface ShadowLayer {
    material: THREE.ShaderMaterial;
    width: number;
    length: number;
    yOffset: number;
    fixedDirection?: THREE.Vector3;
    lightPosition?: THREE.Vector3;
    distanceLengthFactor?: number;
    maxLength?: number;
}

const SHADOW_GEOMETRY = new THREE.PlaneGeometry(1, 1);
SHADOW_GEOMETRY.rotateX(-Math.PI / 2);

const SHADOW_VERTEX_SHADER = `
    varying vec2 shadowUv;
    void main() {
        shadowUv = uv;
        vec4 instancePosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
            instancePosition = instanceMatrix * instancePosition;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
    }
`;

const SHADOW_FRAGMENT_SHADER = `
    uniform vec3 shadowColor;
    uniform float shadowOpacity;
    uniform float shadowTaper;
    varying vec2 shadowUv;

    void main() {
        float along = shadowUv.y;
        float halfWidth = 0.5 * mix(1.0, 1.0 - shadowTaper, along);
        float lateral = abs(shadowUv.x - 0.5) / max(halfWidth, 0.08);
        float softSides = 1.0 - smoothstep(0.58, 1.0, lateral);
        float nearFade = smoothstep(-0.04, 0.055, along);
        float farFade = 1.0 - smoothstep(0.58, 1.0, along);
        float softCore = mix(0.72, 1.0, 1.0 - smoothstep(0.08, 0.9, lateral));
        float alpha = shadowOpacity * softSides * nearFade * farFade * softCore;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(shadowColor, alpha);
    }
`;

const createShadowMaterial = ({
    color,
    opacity,
    taper,
}: {
    color: string;
    opacity: number;
    taper: number;
}) =>
    new THREE.ShaderMaterial({
        uniforms: {
            shadowColor: { value: new THREE.Color(color) },
            shadowOpacity: { value: opacity },
            shadowTaper: { value: taper },
        },
        vertexShader: SHADOW_VERTEX_SHADER,
        fragmentShader: SHADOW_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
    });

const DAY_SHADOW_MATERIAL = createShadowMaterial({
    color: "#142a21",
    opacity: 0.3,
    taper: 0.1,
});
const SUNSET_CORE_SHADOW_MATERIAL = createShadowMaterial({
    color: "#21121e",
    opacity: 0.23,
    taper: 0.22,
});
const NIGHT_SHADOW_MATERIAL = createShadowMaterial({
    color: "#020916",
    opacity: 0.14,
    taper: 0.2,
});

const LOCAL_SHADOW_FORWARD = new THREE.Vector3(0, 0, -1);
const HIDDEN_SCALE = new THREE.Vector3(0, 0, 0);
const IDENTITY_QUATERNION = new THREE.Quaternion();

export default function MarcherShadows({
    marcherIds,
    marcherRefs,
    mode,
    fieldWidth,
    fieldDepth,
}: MarcherShadowsProps) {
    const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
    const lastStatesRef = useRef<Float32Array>(new Float32Array(0));
    const lastConfigurationRef = useRef<{
        layers: ShadowLayer[] | null;
        marcherIds: number[] | null;
    }>({ layers: null, marcherIds: null });
    const changedLayersRef = useRef<boolean[]>([]);
    const matrix = useMemo(() => new THREE.Matrix4(), []);
    const position = useMemo(() => new THREE.Vector3(), []);
    const scale = useMemo(() => new THREE.Vector3(), []);
    const direction = useMemo(() => new THREE.Vector3(), []);
    const quaternion = useMemo(() => new THREE.Quaternion(), []);
    const hiddenPosition = useMemo(() => new THREE.Vector3(0, -1000, 0), []);

    const layers = useMemo<ShadowLayer[]>(() => {
        const largestDimension = Math.max(fieldWidth, fieldDepth);
        const sceneLight = getSceneLightPosition(mode, fieldWidth, fieldDepth);
        const awayFromSceneLight = new THREE.Vector3(
            -sceneLight[0],
            0,
            -sceneLight[2],
        ).normalize();

        if (mode === "night") {
            return getStadiumLightPositions(fieldWidth, fieldDepth).map(
                ({ x, y, z }, index) => ({
                    material: NIGHT_SHADOW_MATERIAL,
                    width: 0.92,
                    length: 3.9,
                    distanceLengthFactor: 0.022,
                    maxLength: 5.8,
                    yOffset: 0.032 + index * 0.0012,
                    lightPosition: new THREE.Vector3(x, y, z),
                }),
            );
        }

        if (mode === "sunset") {
            const longShadowLength = Math.min(largestDimension * 0.065, 10.5);
            return [
                {
                    material: SUNSET_CORE_SHADOW_MATERIAL,
                    width: 1.18,
                    length: longShadowLength,
                    yOffset: 0.032,
                    fixedDirection: awayFromSceneLight,
                },
            ];
        }

        return [
            {
                material: DAY_SHADOW_MATERIAL,
                width: 1.18,
                length: 1.7,
                yOffset: 0.032,
                fixedDirection: awayFromSceneLight,
            },
        ];
    }, [fieldDepth, fieldWidth, mode]);

    useFrame(() => {
        if (
            lastConfigurationRef.current.layers !== layers ||
            lastConfigurationRef.current.marcherIds !== marcherIds
        ) {
            lastConfigurationRef.current = { layers, marcherIds };
            lastStatesRef.current = new Float32Array(0);
        }

        const stateLength = marcherIds.length * 4;
        if (lastStatesRef.current.length !== stateLength) {
            lastStatesRef.current = new Float32Array(stateLength);
            lastStatesRef.current.fill(Number.NaN);
        }

        if (changedLayersRef.current.length !== layers.length) {
            changedLayersRef.current = new Array(layers.length).fill(false);
        } else {
            changedLayersRef.current.fill(false);
        }
        const changedLayers = changedLayersRef.current;
        for (let index = 0; index < marcherIds.length; index += 1) {
            const marcher = marcherRefs.get(marcherIds[index])?.current;
            const isVisible = marcher?.visible ?? false;
            const x = marcher?.position.x ?? 0;
            const y = marcher?.position.y ?? 0;
            const z = marcher?.position.z ?? 0;
            const stateOffset = index * 4;
            const lastStates = lastStatesRef.current;
            const unchanged =
                lastStates[stateOffset] === x &&
                lastStates[stateOffset + 1] === y &&
                lastStates[stateOffset + 2] === z &&
                lastStates[stateOffset + 3] === (isVisible ? 1 : 0);
            if (unchanged) continue;

            lastStates[stateOffset] = x;
            lastStates[stateOffset + 1] = y;
            lastStates[stateOffset + 2] = z;
            lastStates[stateOffset + 3] = isVisible ? 1 : 0;

            for (
                let layerIndex = 0;
                layerIndex < layers.length;
                layerIndex += 1
            ) {
                const shadowMesh = meshRefs.current[layerIndex];
                if (!shadowMesh) continue;
                const layer = layers[layerIndex];

                if (!isVisible) {
                    matrix.compose(
                        hiddenPosition,
                        IDENTITY_QUATERNION,
                        HIDDEN_SCALE,
                    );
                    shadowMesh.setMatrixAt(index, matrix);
                    changedLayers[layerIndex] = true;
                    continue;
                }

                let shadowLength = layer.length;
                if (layer.lightPosition) {
                    direction.set(
                        x - layer.lightPosition.x,
                        0,
                        z - layer.lightPosition.z,
                    );
                    const distanceToLight = direction.length();
                    shadowLength = THREE.MathUtils.clamp(
                        layer.length +
                            distanceToLight * (layer.distanceLengthFactor ?? 0),
                        layer.length,
                        layer.maxLength ?? layer.length,
                    );
                    direction.normalize();
                } else {
                    direction.copy(layer.fixedDirection!);
                }

                quaternion.setFromUnitVectors(LOCAL_SHADOW_FORWARD, direction);
                position.set(
                    x + direction.x * shadowLength * 0.5,
                    y + layer.yOffset,
                    z + direction.z * shadowLength * 0.5,
                );
                scale.set(layer.width, 1, shadowLength);
                matrix.compose(position, quaternion, scale);
                shadowMesh.setMatrixAt(index, matrix);
                changedLayers[layerIndex] = true;
            }
        }

        changedLayers.forEach((changed, layerIndex) => {
            const shadowMesh = meshRefs.current[layerIndex];
            if (changed && shadowMesh) {
                shadowMesh.instanceMatrix.needsUpdate = true;
            }
        });
    });

    if (marcherIds.length === 0) return null;

    return (
        <group dispose={null}>
            {layers.map((layer, index) => (
                <instancedMesh
                    key={`${mode}-${index}`}
                    ref={(mesh) => {
                        meshRefs.current[index] = mesh;
                        mesh?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    }}
                    args={[SHADOW_GEOMETRY, layer.material, marcherIds.length]}
                    frustumCulled={false}
                    renderOrder={1 + index}
                    dispose={null}
                />
            ))}
        </group>
    );
}
