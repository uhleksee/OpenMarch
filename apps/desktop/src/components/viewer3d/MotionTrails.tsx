import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FieldProperties } from "@openmarch/core";
import type { MarcherTimeline } from "@/utilities/Keyframes";
import { getLivePlaybackPosition } from "@/components/timeline/audio/AudioPlayer";
import { buildMotionTrailGeometryData } from "./motionTrailGeometry";

const TRAIL_VERTEX_SHADER = `
    attribute float trailTime;
    varying float vTrailTime;

    void main() {
        vTrailTime = trailTime;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const TRAIL_FRAGMENT_SHADER = `
    uniform float currentTime;
    uniform float pastSeconds;
    uniform float futureSeconds;
    uniform vec3 pastColor;
    uniform vec3 futureColor;
    varying float vTrailTime;

    void main() {
        float timeOffset = vTrailTime - currentTime;
        if (timeOffset < -pastSeconds || timeOffset > futureSeconds) discard;

        bool isPast = timeOffset <= 0.0;
        float duration = max(isPast ? pastSeconds : futureSeconds, 0.0001);
        float distanceFromNow = abs(timeOffset) / duration;
        float fade = 1.0 - smoothstep(0.62, 1.0, distanceFromNow);
        float alpha = fade * (isPast ? 0.38 : 0.82);
        vec3 color = isPast ? pastColor : futureColor;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(color, alpha);
    }
`;

export interface MotionTrailsProps {
    marcherTimelines: Map<number, MarcherTimeline>;
    fieldProperties: FieldProperties;
    activeMarcherIds: readonly number[];
    isPlaying: boolean;
    /** Explicit model-aligned time to use while playback is paused. */
    pausedTimeSeconds: number;
    pastSeconds?: number;
    futureSeconds?: number;
}

export default function MotionTrails({
    marcherTimelines,
    fieldProperties,
    activeMarcherIds,
    isPlaying,
    pausedTimeSeconds,
    pastSeconds = 2.5,
    futureSeconds = 8,
}: MotionTrailsProps) {
    const trailData = useMemo(
        () =>
            buildMotionTrailGeometryData({
                marcherTimelines,
                fieldProperties,
                activeMarcherIds,
            }),
        [activeMarcherIds, fieldProperties, marcherTimelines],
    );
    const geometry = useMemo(() => {
        const nextGeometry = new THREE.BufferGeometry();
        nextGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(trailData.positions, 3),
        );
        nextGeometry.setAttribute(
            "trailTime",
            new THREE.BufferAttribute(trailData.times, 1),
        );
        if (trailData.segmentCount > 0) nextGeometry.computeBoundingSphere();
        return nextGeometry;
    }, [trailData]);
    const material = useMemo(
        () =>
            new THREE.ShaderMaterial({
                uniforms: {
                    currentTime: { value: 0 },
                    pastSeconds: { value: 0 },
                    futureSeconds: { value: 0 },
                    pastColor: { value: new THREE.Color("#60a5fa") },
                    futureColor: { value: new THREE.Color("#fbbf24") },
                },
                vertexShader: TRAIL_VERTEX_SHADER,
                fragmentShader: TRAIL_FRAGMENT_SHADER,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                toneMapped: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
            }),
        [],
    );

    useEffect(() => {
        material.uniforms.pastSeconds!.value = Math.max(0, pastSeconds);
        material.uniforms.futureSeconds!.value = Math.max(0, futureSeconds);
    }, [futureSeconds, material, pastSeconds]);

    useEffect(
        () => () => {
            geometry.dispose();
        },
        [geometry],
    );
    useEffect(
        () => () => {
            material.dispose();
        },
        [material],
    );

    useFrame(() => {
        const liveTime = isPlaying
            ? getLivePlaybackPosition()
            : pausedTimeSeconds;
        material.uniforms.currentTime!.value = Number.isFinite(liveTime)
            ? Math.max(0, liveTime)
            : 0;
    });

    if (trailData.segmentCount === 0) return null;

    return (
        <lineSegments
            geometry={geometry}
            material={material}
            renderOrder={4}
            dispose={null}
        />
    );
}
