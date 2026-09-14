import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    memo,
    useMemo,
    useRef,
    useState,
    type ElementRef,
} from "react";
import {
    Canvas as ThreeCanvas,
    useFrame,
    useThree,
    type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import * as THREE from "three";
import clsx from "clsx";
import {
    allMarchersQueryOptions,
    fieldPropertiesImageQueryOptions,
    fieldPropertiesQueryOptions,
    marcherAppearancesQueryOptions,
    marcherPageKeys,
    marcherPagesByPageQueryOptions,
} from "@/hooks/queries";
import { useManyCoordinateData } from "@/hooks/queries/useCoordinateData";
import { useDatabaseReady } from "@/hooks/useDatabaseReady";
import { useSelectedPage } from "@/context/SelectedPageContext";
import { useIsPlaying } from "@/context/IsPlayingContext";
import { useTimingObjects } from "@/hooks";
import { useUiSettingsStore } from "@/stores/UiSettingsStore";
import { getCoordinatesAtTime } from "@/utilities/Keyframes";
import { getLivePlaybackPosition } from "@/components/timeline/audio/AudioPlayer";
import { resolveAppearanceFromStack } from "@/entity-components/appearance";
import Field3D from "./Field3D";
import Marcher3D, {
    type MarcherGaitRef,
    type MarcherMotionRef,
} from "./Marcher3D";
import {
    CameraPreset,
    canUseIndoorArena,
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getField3DValidationError,
    getFieldWorldDimensions,
    getLegFacingOffset,
    hasWorldPositionChanged,
    rgbaStringToThreeColor,
    resolveVenue,
} from "./viewer3d.utils";
import { FieldProperties } from "@openmarch/core";
import Marcher from "@/global/classes/Marcher";
import MarcherPage from "@/global/classes/MarcherPage";
import { MarcherTimeline } from "@/utilities/Keyframes";
import { MarcherAppearanceByIdMap } from "@/hooks/queries/useMarcherAppearances";
import LightingRig from "./LightingRig";
import StadiumEnvironment from "./StadiumEnvironment";
import MarcherShadows, { type MarcherShadowGroupRef } from "./MarcherShadows";
import { CINEMATIC_OVERLAYS, LIGHTING_THEMES } from "./sceneTheme";
import {
    type LightingMode,
    type ResolvedVenue,
    type UniformColorMode,
    type UniformStyle,
    type VenuePreference,
} from "./viewer3d.types";
import {
    loadViewerPreferences,
    saveViewerPreferences,
} from "./viewer3d.preferences";
import {
    threeDiagnosticSnapshot,
    usePerformanceDiagnosticsStore,
} from "@/stores/PerformanceDiagnosticsStore";
import { usePlaybackPageStore } from "@/stores/PlaybackPageStore";
import type Beat from "@/global/classes/Beat";
import { createMarchBeatTimeline, getMarchStepAtTime } from "./marchBeatPhase";
import IndoorArenaEnvironment from "./IndoorArenaEnvironment";
import DirectorPanel from "./DirectorPanel";
import PerformerFocusPanel, {
    type MotionTrailMode,
    type PerformerFocusMode,
} from "./PerformerFocusPanel";
import {
    getPerformerFollowCameraState,
    getPerformerPovCameraState,
    resolvePerformerCameraFocus,
    type PerformerCameraMode,
    type PerformerWorldPose,
} from "./performerCamera";
import MotionTrails from "./MotionTrails";
import {
    getDirectorCameraStateAtTimeFromSortedShots,
    interpolateCameraRollDegrees,
    MAX_DIRECTOR_CAMERA_SHOTS,
    sortDirectorCameraShots,
    type DirectorCameraShot,
    type DirectorCameraState,
} from "@/utilities/directorCamera";
import {
    updateWorkspaceSettingsMutationOptions,
    workspaceSettingsKeys,
    workspaceSettingsQueryOptions,
} from "@/hooks/queries/useWorkspaceSettings";
import type { WorkspaceSettings } from "@/settings/workspaceSettings";

const CAMERA_LABELS: Record<CameraPreset, string> = {
    overhead: "Overhead",
    pressBox: "Press box",
    fieldLevel: "Field level",
};

function PerformanceSampler() {
    const { gl } = useThree();
    const sampleStartedAtRef = useRef(0);
    const frameCountRef = useRef(0);
    const frameTotalMsRef = useRef(0);
    const worstFrameMsRef = useRef(0);

    useEffect(
        () => () => {
            Object.assign(threeDiagnosticSnapshot, {
                fps: null,
                averageFrameMs: null,
                worstFrameMs: null,
                drawCalls: null,
                triangles: null,
                geometries: null,
                textures: null,
            });
        },
        [],
    );

    useFrame(({ clock }, delta) => {
        const now = clock.elapsedTime;
        if (sampleStartedAtRef.current === 0) sampleStartedAtRef.current = now;
        const frameMs = delta * 1000;
        frameCountRef.current += 1;
        frameTotalMsRef.current += frameMs;
        worstFrameMsRef.current = Math.max(worstFrameMsRef.current, frameMs);

        if (now - sampleStartedAtRef.current < 0.75) return;
        const averageFrameMs =
            frameTotalMsRef.current / Math.max(1, frameCountRef.current);
        Object.assign(threeDiagnosticSnapshot, {
            fps: Math.round(1000 / averageFrameMs),
            averageFrameMs,
            worstFrameMs: worstFrameMsRef.current,
            drawCalls: gl.info.render.calls,
            triangles: gl.info.render.triangles,
            geometries: gl.info.memory.geometries,
            textures: gl.info.memory.textures,
        });
        sampleStartedAtRef.current = now;
        frameCountRef.current = 0;
        frameTotalMsRef.current = 0;
        worstFrameMsRef.current = 0;
    });

    return null;
}

interface CameraRigProps {
    preset: CameraPreset;
    fieldWidth: number;
    fieldDepth: number;
    rollDegrees: number;
    directorEnabled: boolean;
    directorShots: DirectorCameraShot[];
    pausedTimeSeconds: number;
    focusMode: PerformerFocusMode;
    focusSection: string | null;
    focusedMarcherIds: readonly number[];
    marcherRefs: Map<number, MarcherShadowGroupRef>;
}

export interface CameraRigHandle {
    capture: () => DirectorCameraState | null;
    flyTo: (state: DirectorCameraState, durationSeconds?: number) => void;
    restoreFreeView: () => void;
    setRoll: (rollDegrees: number) => void;
}

interface CameraTransition {
    elapsed: number;
    duration: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    fromFov: number;
    toFov: number;
    fromRollDegrees: number;
    toRollDegrees: number;
}

function applyCameraRoll(
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    rollDegrees: number,
) {
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(THREE.MathUtils.degToRad(rollDegrees));
}

type MutablePerformerWorldPose = Omit<PerformerWorldPose, "position"> & {
    position: [number, number, number];
};

function syncPerformerPoses(
    poses: MutablePerformerWorldPose[],
    marcherRefs: Map<number, MarcherShadowGroupRef>,
    includeHidden: boolean,
) {
    for (const pose of poses) {
        const group = marcherRefs.get(pose.id)?.current;
        pose.visible = !!group && (includeHidden || group.visible);
        if (!group) continue;
        pose.position[0] = group.position.x;
        pose.position[1] = group.position.y;
        pose.position[2] = group.position.z;
        pose.facingRadians = group.rotation.y;
    }
}

function getVisiblePerformerTarget(
    poses: readonly MutablePerformerWorldPose[],
    target: THREE.Vector3,
): boolean {
    let count = 0;
    target.set(0, 0, 0);
    for (const pose of poses) {
        if (pose.visible === false) continue;
        target.x += pose.position[0];
        target.y += pose.position[1] + 1.65;
        target.z += pose.position[2];
        count += 1;
    }
    if (count === 0) return false;
    target.multiplyScalar(1 / count);
    return true;
}

const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(
    function CameraRig(
        {
            preset,
            fieldWidth,
            fieldDepth,
            rollDegrees,
            directorEnabled,
            directorShots,
            pausedTimeSeconds,
            focusMode,
            focusSection,
            focusedMarcherIds,
            marcherRefs,
        },
        ref,
    ) {
        const { camera, size } = useThree();
        const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
        const transitionRef = useRef<CameraTransition | null>(null);
        const appliedRollDegreesRef = useRef(rollDegrees);
        const initializedRef = useRef(false);
        const activeFocusKeyRef = useRef("");
        const preFocusCameraStateRef = useRef<DirectorCameraState | null>(null);
        const trackedFocusTargetRef = useRef(new THREE.Vector3());
        const liveFocusTargetRef = useRef(new THREE.Vector3());
        const focusDeltaRef = useRef(new THREE.Vector3());
        const povPositionRef = useRef(new THREE.Vector3());
        const povTargetRef = useRef(new THREE.Vector3());
        const isPlaying = useIsPlaying()?.isPlaying ?? false;
        const configuration = useMemo(
            () => getCameraPresetConfiguration(preset, fieldWidth, fieldDepth),
            [fieldDepth, fieldWidth, preset],
        );
        const sortedDirectorShots = useMemo(
            () => sortDirectorCameraShots(directorShots),
            [directorShots],
        );
        const focusCameraMode = useMemo<PerformerCameraMode>(() => {
            const marcherId = focusedMarcherIds[0];
            if (focusMode === "pov" && marcherId != null)
                return { kind: "pov", marcherId };
            if (focusMode === "followPerformer" && marcherId != null)
                return { kind: "follow-performer", marcherId };
            if (focusMode === "followSection" && focusSection != null)
                return { kind: "follow-section", section: focusSection };
            return { kind: "free" };
        }, [focusMode, focusSection, focusedMarcherIds]);
        const focusKey = useMemo(
            () =>
                `${focusMode}:${focusSection ?? ""}:${focusedMarcherIds.join(",")}`,
            [focusMode, focusSection, focusedMarcherIds],
        );
        const focusPoses = useMemo<MutablePerformerWorldPose[]>(
            () =>
                focusedMarcherIds.map((marcherId) => ({
                    id: marcherId,
                    section: focusSection ?? "",
                    position: [0, 0, 0],
                    facingRadians: 0,
                    visible: false,
                })),
            [focusSection, focusedMarcherIds],
        );

        const startTransition = useCallback(
            (state: DirectorCameraState, durationSeconds = 0.85) => {
                const controls = controlsRef.current;
                if (!controls || !(camera instanceof THREE.PerspectiveCamera))
                    return;
                transitionRef.current = {
                    elapsed: 0,
                    duration: Math.max(0.05, durationSeconds),
                    fromPosition: camera.position.clone(),
                    toPosition: new THREE.Vector3(...state.position),
                    fromTarget: controls.target.clone(),
                    toTarget: new THREE.Vector3(...state.target),
                    fromFov: camera.fov,
                    toFov: state.fov,
                    fromRollDegrees: appliedRollDegreesRef.current,
                    toRollDegrees: state.rollDegrees,
                };
                initializedRef.current = true;
            },
            [camera],
        );

        useImperativeHandle(
            ref,
            () => ({
                capture: () => {
                    const controls = controlsRef.current;
                    if (
                        !controls ||
                        !(camera instanceof THREE.PerspectiveCamera)
                    )
                        return null;
                    return {
                        position: camera.position.toArray(),
                        target: controls.target.toArray(),
                        fov: camera.fov,
                        rollDegrees: appliedRollDegreesRef.current,
                    };
                },
                flyTo: startTransition,
                restoreFreeView: () => {
                    const savedState = preFocusCameraStateRef.current;
                    if (!savedState) return;
                    activeFocusKeyRef.current = "";
                    preFocusCameraStateRef.current = null;
                    startTransition(savedState, 0.7);
                },
                setRoll: (nextRollDegrees) => {
                    const controls = controlsRef.current;
                    if (
                        !controls ||
                        !(camera instanceof THREE.PerspectiveCamera)
                    )
                        return;
                    transitionRef.current = null;
                    controls.update();
                    applyCameraRoll(camera, controls.target, nextRollDegrees);
                    appliedRollDegreesRef.current = nextRollDegrees;
                },
            }),
            [camera, startTransition],
        );

        useEffect(() => {
            if (!(camera instanceof THREE.PerspectiveCamera)) return;
            // POV needs a short near plane, while the tighter default range
            // keeps layered field markings stable in distant views.
            camera.near = focusMode === "pov" ? 0.08 : 0.5;
            camera.far = Math.max(25, Math.max(fieldWidth, fieldDepth) * 12);
            camera.updateProjectionMatrix();
        }, [camera, fieldDepth, fieldWidth, focusMode]);

        useEffect(() => {
            const controls = controlsRef.current;
            if (!controls || !(camera instanceof THREE.PerspectiveCamera))
                return;

            // Director mode owns the camera while it is active. Shot edits
            // must not pull a manually positioned camera back to its preset.
            if (directorEnabled) return;

            const presetState: DirectorCameraState = {
                position: configuration.position,
                target: configuration.target,
                fov: configuration.fov,
                rollDegrees: 0,
            };
            if (!initializedRef.current) {
                camera.position.set(...presetState.position);
                camera.fov = presetState.fov;
                controls.target.set(...presetState.target);
                camera.updateProjectionMatrix();
                controls.update();
                applyCameraRoll(
                    camera,
                    controls.target,
                    presetState.rollDegrees,
                );
                appliedRollDegreesRef.current = presetState.rollDegrees;
                initializedRef.current = true;
                return;
            }
            startTransition(presetState);
        }, [
            camera,
            configuration,
            directorEnabled,
            fieldDepth,
            fieldWidth,
            startTransition,
        ]);

        useFrame((_, delta) => {
            const controls = controlsRef.current;
            if (!controls || !(camera instanceof THREE.PerspectiveCamera))
                return;

            if (directorEnabled && sortedDirectorShots.length > 0) {
                transitionRef.current = null;
                const directorState =
                    getDirectorCameraStateAtTimeFromSortedShots(
                        sortedDirectorShots,
                        isPlaying
                            ? getLivePlaybackPosition()
                            : pausedTimeSeconds,
                    );
                if (!directorState) return;
                camera.position.set(...directorState.position);
                controls.target.set(...directorState.target);
                applyCameraRoll(
                    camera,
                    controls.target,
                    directorState.rollDegrees,
                );
                camera.fov = directorState.fov;
                camera.updateProjectionMatrix();
                appliedRollDegreesRef.current = directorState.rollDegrees;
                initializedRef.current = true;
                return;
            }

            if (focusCameraMode.kind === "free") {
                activeFocusKeyRef.current = "";
            } else {
                const isPov = focusCameraMode.kind === "pov";
                syncPerformerPoses(focusPoses, marcherRefs, isPov);

                if (isPov) {
                    transitionRef.current = null;
                    const povState = getPerformerPovCameraState(focusPoses[0], {
                        rollDegrees,
                    });
                    if (povState) {
                        if (activeFocusKeyRef.current === "") {
                            preFocusCameraStateRef.current = {
                                position: camera.position.toArray(),
                                target: controls.target.toArray(),
                                fov: camera.fov,
                                rollDegrees: appliedRollDegreesRef.current,
                            };
                        }
                        const smoothing = 1 - Math.exp(-delta * 9);
                        povPositionRef.current.set(...povState.position);
                        povTargetRef.current.set(...povState.target);
                        camera.position.lerp(povPositionRef.current, smoothing);
                        controls.target.lerp(povTargetRef.current, smoothing);
                        const nextFov = THREE.MathUtils.lerp(
                            camera.fov,
                            povState.fov,
                            smoothing,
                        );
                        if (Math.abs(camera.fov - nextFov) > 0.0001) {
                            camera.fov = nextFov;
                            camera.updateProjectionMatrix();
                        }
                        applyCameraRoll(camera, controls.target, rollDegrees);
                        appliedRollDegreesRef.current = rollDegrees;
                        activeFocusKeyRef.current = focusKey;
                        initializedRef.current = true;
                    }
                    return;
                }

                const hasLiveTarget = getVisiblePerformerTarget(
                    focusPoses,
                    liveFocusTargetRef.current,
                );
                if (hasLiveTarget) {
                    if (activeFocusKeyRef.current !== focusKey) {
                        const focus = resolvePerformerCameraFocus(
                            focusCameraMode,
                            focusPoses,
                        );
                        const followState = getPerformerFollowCameraState(
                            focus,
                            {
                                position: camera.position.toArray(),
                                target: controls.target.toArray(),
                                fov: camera.fov,
                                rollDegrees: appliedRollDegreesRef.current,
                            },
                            {
                                aspect:
                                    size.height > 0
                                        ? size.width / size.height
                                        : 16 / 9,
                                padding:
                                    focusCameraMode.kind === "follow-section"
                                        ? 1.3
                                        : 1.15,
                                minimumDistance:
                                    focusCameraMode.kind === "follow-section"
                                        ? 8
                                        : 6,
                                maximumDistance:
                                    Math.max(fieldWidth, fieldDepth) * 3,
                            },
                        );
                        if (followState && focus) {
                            if (activeFocusKeyRef.current === "") {
                                preFocusCameraStateRef.current = {
                                    position: camera.position.toArray(),
                                    target: controls.target.toArray(),
                                    fov: camera.fov,
                                    rollDegrees: appliedRollDegreesRef.current,
                                };
                            }
                            startTransition(followState, 0.7);
                            trackedFocusTargetRef.current.set(...focus.target);
                            activeFocusKeyRef.current = focusKey;
                        }
                    } else {
                        focusDeltaRef.current
                            .copy(liveFocusTargetRef.current)
                            .sub(trackedFocusTargetRef.current);
                        const focusTransition = transitionRef.current;
                        if (focusTransition) {
                            focusTransition.toPosition.add(
                                focusDeltaRef.current,
                            );
                            focusTransition.toTarget.add(focusDeltaRef.current);
                        } else {
                            camera.position.add(focusDeltaRef.current);
                            controls.target.copy(liveFocusTargetRef.current);
                            controls.update();
                            applyCameraRoll(
                                camera,
                                controls.target,
                                rollDegrees,
                            );
                            appliedRollDegreesRef.current = rollDegrees;
                        }
                        trackedFocusTargetRef.current.copy(
                            liveFocusTargetRef.current,
                        );
                        if (!focusTransition) return;
                    }
                }
            }

            const transition = transitionRef.current;
            if (!transition) {
                applyCameraRoll(camera, controls.target, rollDegrees);
                appliedRollDegreesRef.current = rollDegrees;
                return;
            }
            transition.elapsed = Math.min(
                transition.duration,
                transition.elapsed + delta,
            );
            const progress = transition.elapsed / transition.duration;
            const eased = progress * progress * (3 - 2 * progress);

            camera.position.lerpVectors(
                transition.fromPosition,
                transition.toPosition,
                eased,
            );
            controls.target.lerpVectors(
                transition.fromTarget,
                transition.toTarget,
                eased,
            );
            camera.fov = THREE.MathUtils.lerp(
                transition.fromFov,
                transition.toFov,
                eased,
            );
            camera.updateProjectionMatrix();
            controls.update();
            const transitionRollDegrees = interpolateCameraRollDegrees(
                transition.fromRollDegrees,
                transition.toRollDegrees,
                eased,
            );
            applyCameraRoll(camera, controls.target, transitionRollDegrees);
            appliedRollDegreesRef.current = transitionRollDegrees;

            if (progress >= 1) transitionRef.current = null;
        });

        return (
            <OrbitControls
                ref={controlsRef}
                makeDefault
                enabled={!directorEnabled && focusMode !== "pov"}
                enablePan={focusMode === "free"}
                enableRotate
                enableZoom
                enableDamping
                dampingFactor={0.12}
                onStart={() => {
                    transitionRef.current = null;
                }}
                screenSpacePanning
                minDistance={2}
                maxDistance={Math.max(8, Math.max(fieldWidth, fieldDepth) * 4)}
                maxPolarAngle={Math.PI / 2 - 0.015}
            />
        );
    },
);

const MemoizedCameraRig = memo(CameraRig);

interface StaticFieldSceneProps {
    fieldProperties: FieldProperties;
    fieldWidth: number;
    fieldDepth: number;
    showGrid: boolean;
    showHalfLines: boolean;
    lightingMode: LightingMode;
    showEnvironment: boolean;
    fieldImage: Uint8Array | null;
    venue: ResolvedVenue;
}

const StaticFieldScene = memo(function StaticFieldScene({
    fieldProperties,
    fieldWidth,
    fieldDepth,
    showGrid,
    showHalfLines,
    lightingMode,
    showEnvironment,
    fieldImage,
    venue,
}: StaticFieldSceneProps) {
    const lighting = LIGHTING_THEMES[lightingMode];
    const largestDimension = Math.max(fieldWidth, fieldDepth);
    return (
        <>
            {venue === "outdoor" && (
                <fog
                    attach="fog"
                    args={[
                        lighting.skyHorizon,
                        largestDimension * lighting.fogNearFactor,
                        largestDimension * lighting.fogFarFactor,
                    ]}
                />
            )}
            <LightingRig
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                mode={lightingMode}
                venue={venue}
            />
            {showEnvironment && venue === "outdoor" && (
                <StadiumEnvironment
                    fieldWidth={fieldWidth}
                    fieldDepth={fieldDepth}
                    lightingMode={lightingMode}
                />
            )}
            {showEnvironment && venue === "indoor" && (
                <IndoorArenaEnvironment lightingMode={lightingMode} />
            )}
            <Field3D
                fieldProperties={fieldProperties}
                showGrid={showGrid}
                showHalfLines={showHalfLines}
                fieldImage={fieldImage}
                venue={venue}
            />
        </>
    );
});

interface MarcherFormationProps {
    marchers: Marcher[];
    beats: Beat[];
    marcherPages: Record<number, MarcherPage>;
    marcherTimelines: Map<number, MarcherTimeline>;
    marcherAppearances: MarcherAppearanceByIdMap;
    fieldProperties: FieldProperties;
    uniformStyle: UniformStyle;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
    lightingMode: LightingMode;
    fieldWidth: number;
    fieldDepth: number;
    venue: ResolvedVenue;
    marcherRefs: Map<number, MarcherShadowGroupRef>;
    selectedMarcherId: number | null;
    povMarcherId: number | null;
    onSelectMarcher: (marcherId: number) => void;
}

const SELECTED_MARCHER_RING_GEOMETRY = new THREE.RingGeometry(0.52, 0.7, 32);
SELECTED_MARCHER_RING_GEOMETRY.rotateX(-Math.PI / 2);
const MARCHER_SELECTION_TARGET_GEOMETRY = new THREE.BoxGeometry(1.2, 3.7, 1.2);
const MARCHER_SELECTION_TARGET_MATERIAL = new THREE.MeshBasicMaterial();
MARCHER_SELECTION_TARGET_MATERIAL.visible = false;

interface MarcherSelectionTargetProps {
    marcherId: number;
    onSelectMarcher: (marcherId: number) => void;
}

const MarcherSelectionTarget = memo(function MarcherSelectionTarget({
    marcherId,
    onSelectMarcher,
}: MarcherSelectionTargetProps) {
    const handleClick = useCallback(
        (event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            onSelectMarcher(marcherId);
        },
        [marcherId, onSelectMarcher],
    );

    return (
        <mesh
            geometry={MARCHER_SELECTION_TARGET_GEOMETRY}
            material={MARCHER_SELECTION_TARGET_MATERIAL}
            position={[0, 1.75, 0]}
            dispose={null}
            onClick={handleClick}
        />
    );
});

function MarcherFormation({
    marchers,
    beats,
    marcherPages,
    marcherTimelines,
    marcherAppearances,
    fieldProperties,
    uniformStyle,
    uniformColorMode,
    uniformColor,
    showLabels,
    lightingMode,
    fieldWidth,
    fieldDepth,
    venue,
    marcherRefs,
    selectedMarcherId,
    povMarcherId,
    onSelectMarcher,
}: MarcherFormationProps) {
    const marcherMotionRefs = useRef(new Map<number, MarcherMotionRef>());
    const gaitRef = useRef<MarcherGaitRef>({ phase: 0 });
    const { isPlaying } = useIsPlaying()!;
    const queryClient = useQueryClient();
    const marcherIds = useMemo(
        () => marchers.map((marcher) => marcher.id),
        [marchers],
    );
    const marchBeatTimeline = useMemo(
        () => createMarchBeatTimeline(beats),
        [beats],
    );

    const setPausedPositions = useCallback(() => {
        for (const marcher of marchers) {
            const marcherPage = marcherPages[marcher.id];
            const marcherGroup = marcherRefs.get(marcher.id)?.current;
            if (!marcherPage || !marcherGroup) continue;
            const motionRef = marcherMotionRefs.current.get(marcher.id);
            if (motionRef) {
                motionRef.current = false;
                motionRef.legFacing = 0;
            }
            marcherGroup.position.set(
                ...canvasCoordinatesToWorld(marcherPage, fieldProperties),
            );
        }
    }, [fieldProperties, marcherPages, marcherRefs, marchers]);

    useLayoutEffect(() => {
        if (!isPlaying) setPausedPositions();
    }, [isPlaying, setPausedPositions]);

    useLayoutEffect(() => {
        for (const marcher of marchers) {
            const marcherPage = marcherPages[marcher.id];
            const marcherGroup = marcherRefs.get(marcher.id)?.current;
            if (!marcherPage || !marcherGroup) continue;
            marcherGroup.rotation.y = THREE.MathUtils.degToRad(
                -marcherPage.rotation_degrees,
            );
        }
    }, [marcherPages, marcherRefs, marchers]);

    useEffect(
        () =>
            usePlaybackPageStore.subscribe((state, previousState) => {
                if (
                    state.playbackPageId === previousState.playbackPageId ||
                    state.playbackPageId == null
                )
                    return;

                const playbackMarcherPages = queryClient.getQueryData<
                    Record<number, MarcherPage>
                >(marcherPageKeys.byPage(state.playbackPageId));
                if (!playbackMarcherPages) return;

                for (const marcher of marchers) {
                    const marcherPage = playbackMarcherPages[marcher.id];
                    const marcherGroup = marcherRefs.get(marcher.id)?.current;
                    if (!marcherPage || !marcherGroup) continue;
                    marcherGroup.rotation.y = THREE.MathUtils.degToRad(
                        -marcherPage.rotation_degrees,
                    );
                }
            }),
        [marcherRefs, marchers, queryClient],
    );

    useFrame(() => {
        if (!isPlaying) return;
        const playbackSeconds = getLivePlaybackPosition();
        const marchStep = getMarchStepAtTime(
            playbackSeconds,
            marchBeatTimeline,
        );
        if (marchStep != null) {
            gaitRef.current.phase = Math.PI * marchStep;
        }
        const currentTime = playbackSeconds * 1000;

        for (const marcher of marchers) {
            const marcherGroup = marcherRefs.get(marcher.id)?.current;
            const timeline = marcherTimelines.get(marcher.id);
            const motionRef = marcherMotionRefs.current.get(marcher.id);
            if (!marcherGroup || !timeline || !motionRef) continue;

            try {
                const coordinate = getCoordinatesAtTime(currentTime, timeline);
                if (!coordinate) {
                    motionRef.current = false;
                    motionRef.legFacing = 0;
                    continue;
                }
                const [x, y, z] = canvasCoordinatesToWorld(
                    coordinate,
                    fieldProperties,
                );
                const isMoving = hasWorldPositionChanged(
                    marcherGroup.position,
                    { x, z },
                );
                motionRef.current = isMoving;
                motionRef.legFacing = isMoving
                    ? getLegFacingOffset(
                          x - marcherGroup.position.x,
                          z - marcherGroup.position.z,
                          marcherGroup.rotation.y,
                      )
                    : 0;
                marcherGroup.position.set(x, y, z);
            } catch {
                motionRef.current = false;
                motionRef.legFacing = 0;
                // A drill timeline query may still be loading at this frame.
            }
        }
    }, -1);

    return (
        <group>
            <MarcherShadows
                marcherIds={marcherIds}
                marcherRefs={marcherRefs}
                mode={lightingMode}
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                venue={venue}
            />
            {marchers.map((marcher) => {
                const marcherPage = marcherPages[marcher.id];
                if (!marcherPage) return null;
                const appearance = resolveAppearanceFromStack(
                    marcherAppearances[marcher.id] ?? [],
                    fieldProperties.theme,
                );
                let motionRef = marcherMotionRefs.current.get(marcher.id);
                if (!motionRef) {
                    motionRef = { current: false, legFacing: 0 };
                    marcherMotionRefs.current.set(marcher.id, motionRef);
                }
                let marcherGroupRef = marcherRefs.get(marcher.id);
                if (!marcherGroupRef) {
                    marcherGroupRef = { current: null };
                    marcherRefs.set(marcher.id, marcherGroupRef);
                }

                return (
                    <group
                        key={marcher.id}
                        ref={marcherGroupRef}
                        visible={
                            appearance.visible && marcher.id !== povMarcherId
                        }
                    >
                        {appearance.visible && marcher.id !== povMarcherId && (
                            <MarcherSelectionTarget
                                marcherId={marcher.id}
                                onSelectMarcher={onSelectMarcher}
                            />
                        )}
                        {marcher.id === selectedMarcherId && (
                            <mesh
                                geometry={SELECTED_MARCHER_RING_GEOMETRY}
                                position={[0, 0.085, 0]}
                                renderOrder={8}
                                dispose={null}
                            >
                                <meshBasicMaterial
                                    color="#a78bfa"
                                    transparent
                                    opacity={0.94}
                                    depthWrite={false}
                                    toneMapped={false}
                                    polygonOffset
                                    polygonOffsetFactor={-2}
                                    polygonOffsetUnits={-2}
                                />
                            </mesh>
                        )}
                        <Marcher3D
                            marcherId={marcher.id}
                            drillNumber={marcher.drill_number}
                            section={marcher.section}
                            color={
                                uniformColorMode === "override"
                                    ? uniformColor
                                    : rgbaStringToThreeColor(
                                          appearance.fillRgba,
                                      )
                            }
                            labelVisible={showLabels && appearance.textVisible}
                            uniformStyle={uniformStyle}
                            motionRef={motionRef}
                            gaitRef={gaitRef.current}
                        />
                    </group>
                );
            })}
        </group>
    );
}

export default function ThreeDViewer() {
    const [cameraPreset, setCameraPreset] = useState<CameraPreset>("pressBox");
    const [cameraRollDegrees, setCameraRollDegrees] = useState(0);
    const [preferences, setPreferences] = useState(loadViewerPreferences);
    const [directorEnabled, setDirectorEnabled] = useState(false);
    const [selectedMarcherId, setSelectedMarcherId] = useState<number | null>(
        null,
    );
    const [focusMode, setFocusMode] = useState<PerformerFocusMode>("free");
    const [trailMode, setTrailMode] = useState<MotionTrailMode>("off");
    const cameraRigRef = useRef<CameraRigHandle>(null);
    const marcherRefs = useRef(new Map<number, MarcherShadowGroupRef>());
    const databaseReady = useDatabaseReady();
    const queryClient = useQueryClient();
    const { selectedPage } = useSelectedPage()!;
    const isPlaying = useIsPlaying()?.isPlaying ?? false;
    const { beats, pages } = useTimingObjects();
    const { uiSettings } = useUiSettingsStore();
    const diagnosticsEnabled = usePerformanceDiagnosticsStore(
        (state) => state.enabled,
    );
    const diagnosticSceneMode = usePerformanceDiagnosticsStore(
        (state) => state.sceneMode,
    );
    const { data: fieldProperties } = useQuery(
        fieldPropertiesQueryOptions(databaseReady),
    );
    const { data: fieldImage = null } = useQuery(
        fieldPropertiesImageQueryOptions(
            databaseReady && (fieldProperties?.showFieldImage ?? false),
        ),
    );
    const { data: marchers = [] } = useQuery(allMarchersQueryOptions());
    const { data: marcherPages = {} } = useQuery({
        ...marcherPagesByPageQueryOptions(selectedPage?.id),
        placeholderData: keepPreviousData,
    });
    const { data: marcherAppearances = {} } = useQuery({
        ...marcherAppearancesQueryOptions(selectedPage?.id, queryClient),
        placeholderData: keepPreviousData,
    });
    const { data: marcherTimelines } = useManyCoordinateData(pages);
    const { data: workspaceSettings } = useQuery(
        workspaceSettingsQueryOptions(databaseReady),
    );
    const { mutate: updateWorkspaceSettings } = useMutation(
        updateWorkspaceSettingsMutationOptions(queryClient),
    );
    const directorShots = useMemo(
        () =>
            sortDirectorCameraShots(
                workspaceSettings?.directorCameraShots ?? [],
            ),
        [workspaceSettings?.directorCameraShots],
    );
    const selectedMarcher = useMemo(
        () =>
            marchers.find((marcher) => marcher.id === selectedMarcherId) ??
            null,
        [marchers, selectedMarcherId],
    );
    const selectedSectionMarcherIds = useMemo(
        () =>
            selectedMarcher
                ? marchers
                      .filter(
                          (marcher) =>
                              marcher.section === selectedMarcher.section,
                      )
                      .map((marcher) => marcher.id)
                : [],
        [marchers, selectedMarcher],
    );
    const focusedMarcherIds = useMemo(() => {
        if (!selectedMarcher || focusMode === "free") return [];
        return focusMode === "followSection"
            ? selectedSectionMarcherIds
            : [selectedMarcher.id];
    }, [focusMode, selectedMarcher, selectedSectionMarcherIds]);
    const trailMarcherIds = useMemo(() => {
        if (!selectedMarcher || trailMode === "off") return [];
        return trailMode === "section"
            ? selectedSectionMarcherIds
            : [selectedMarcher.id];
    }, [selectedMarcher, selectedSectionMarcherIds, trailMode]);

    useEffect(() => {
        saveViewerPreferences(preferences);
    }, [preferences]);

    useEffect(() => {
        if (directorShots.length === 0) setDirectorEnabled(false);
    }, [directorShots.length]);

    useEffect(() => {
        if (selectedMarcherId == null || selectedMarcher) return;
        cameraRigRef.current?.restoreFreeView();
        setSelectedMarcherId(null);
        setFocusMode("free");
        setTrailMode("off");
    }, [selectedMarcher, selectedMarcherId]);

    const saveDirectorShots = useCallback(
        (shots: DirectorCameraShot[]) => {
            const currentSettings =
                queryClient.getQueryData<WorkspaceSettings>(
                    workspaceSettingsKeys.detail(),
                ) ?? workspaceSettings;
            if (!currentSettings) return;
            const nextSettings: WorkspaceSettings = {
                ...currentSettings,
                directorCameraShots: sortDirectorCameraShots(shots),
            };
            queryClient.setQueryData(
                workspaceSettingsKeys.detail(),
                nextSettings,
            );
            updateWorkspaceSettings(nextSettings);
        },
        [queryClient, updateWorkspaceSettings, workspaceSettings],
    );

    const captureDirectorShot = useCallback(() => {
        const state = cameraRigRef.current?.capture();
        if (!state || !selectedPage) return;
        const liveTime = isPlaying ? getLivePlaybackPosition() : NaN;
        const timeSeconds = Number.isFinite(liveTime)
            ? Math.max(0, liveTime)
            : selectedPage.timestamp;
        const existingIndex = directorShots.findIndex(
            (shot) => Math.abs(shot.timeSeconds - timeSeconds) < 0.05,
        );
        if (existingIndex >= 0) {
            const nextShots = [...directorShots];
            nextShots[existingIndex] = {
                ...nextShots[existingIndex],
                ...state,
                timeSeconds,
            };
            saveDirectorShots(nextShots);
            return;
        }

        if (directorShots.length >= MAX_DIRECTOR_CAMERA_SHOTS) return;

        const baseName = `Page ${selectedPage.name}`;
        const pageShotCount = directorShots.filter(
            (shot) =>
                shot.name === baseName ||
                shot.name.startsWith(`${baseName} shot `),
        ).length;
        saveDirectorShots([
            ...directorShots,
            {
                id: crypto.randomUUID(),
                name: `${baseName}${
                    pageShotCount > 0 ? ` shot ${pageShotCount + 1}` : ""
                }`,
                timeSeconds,
                transitionSeconds: directorShots.length === 0 ? 0 : 2,
                ...state,
            },
        ]);
    }, [directorShots, isPlaying, saveDirectorShots, selectedPage]);

    const previewDirectorShot = useCallback((shot: DirectorCameraShot) => {
        setFocusMode("free");
        setDirectorEnabled(false);
        requestAnimationFrame(() => {
            cameraRigRef.current?.flyTo(shot, 0.9);
            setCameraRollDegrees(shot.rollDegrees);
        });
    }, []);

    const changeCameraRoll = useCallback((rollDegrees: number) => {
        cameraRigRef.current?.setRoll(rollDegrees);
        setCameraRollDegrees(rollDegrees);
    }, []);

    const selectMarcher = useCallback((marcherId: number | null) => {
        setSelectedMarcherId(marcherId);
        if (marcherId == null) {
            cameraRigRef.current?.restoreFreeView();
            setFocusMode("free");
            setTrailMode("off");
        }
    }, []);

    const changeFocusMode = useCallback((mode: PerformerFocusMode) => {
        if (mode === "free") cameraRigRef.current?.restoreFreeView();
        setDirectorEnabled(false);
        setFocusMode(mode);
    }, []);

    if (!fieldProperties || !selectedPage) {
        return (
            <div className="bg-bg-2 text-text flex h-full w-full items-center justify-center">
                Loading 3D field…
            </div>
        );
    }

    const fieldValidationError = getField3DValidationError(fieldProperties);
    if (fieldValidationError) {
        return (
            <div className="bg-bg-2 text-text flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center">
                <p className="font-semibold">
                    This field cannot open in 3D yet.
                </p>
                <p className="text-text/70 max-w-lg text-sm">
                    {fieldValidationError}
                </p>
            </div>
        );
    }

    const { width, depth } = getFieldWorldDimensions(fieldProperties);
    const indoorAvailable = canUseIndoorArena(fieldProperties);
    const venue = resolveVenue(preferences.venue, fieldProperties);
    const showEnvironment =
        !diagnosticsEnabled ||
        diagnosticSceneMode === "full" ||
        diagnosticSceneMode === "environment";
    const showPerformers =
        !diagnosticsEnabled ||
        diagnosticSceneMode === "full" ||
        diagnosticSceneMode === "performers";

    return (
        <div className="bg-bg-2 rounded-6 relative h-full w-full overflow-hidden">
            <ThreeCanvas
                shadows="percentage"
                dpr={1}
                performance={{ min: 0.6 }}
                onPointerMissed={() => selectMarcher(null)}
                gl={{
                    antialias: false,
                    alpha: false,
                    powerPreference: "high-performance",
                }}
                camera={{ fov: 43 }}
            >
                <StaticFieldScene
                    fieldProperties={fieldProperties}
                    fieldWidth={width}
                    fieldDepth={depth}
                    showGrid={uiSettings.gridLines}
                    showHalfLines={uiSettings.halfLines}
                    lightingMode={preferences.lightingMode}
                    showEnvironment={showEnvironment}
                    fieldImage={fieldImage}
                    venue={venue}
                />
                {showPerformers && trailMarcherIds.length > 0 && (
                    <MotionTrails
                        marcherTimelines={marcherTimelines}
                        fieldProperties={fieldProperties}
                        activeMarcherIds={trailMarcherIds}
                        isPlaying={isPlaying}
                        pausedTimeSeconds={
                            selectedPage.timestamp + selectedPage.duration
                        }
                    />
                )}
                {showPerformers && (
                    <MarcherFormation
                        marchers={marchers}
                        beats={beats}
                        marcherPages={marcherPages}
                        marcherTimelines={marcherTimelines}
                        marcherAppearances={marcherAppearances}
                        fieldProperties={fieldProperties}
                        uniformStyle={preferences.uniformStyle}
                        uniformColorMode={preferences.uniformColorMode}
                        uniformColor={preferences.uniformColor}
                        showLabels={preferences.showLabels}
                        lightingMode={preferences.lightingMode}
                        fieldWidth={width}
                        fieldDepth={depth}
                        venue={venue}
                        marcherRefs={marcherRefs.current}
                        selectedMarcherId={selectedMarcherId}
                        povMarcherId={
                            focusMode === "pov" ? selectedMarcherId : null
                        }
                        onSelectMarcher={selectMarcher}
                    />
                )}
                <MemoizedCameraRig
                    ref={cameraRigRef}
                    preset={cameraPreset}
                    fieldWidth={width}
                    fieldDepth={depth}
                    rollDegrees={cameraRollDegrees}
                    directorEnabled={directorEnabled}
                    directorShots={directorShots}
                    pausedTimeSeconds={selectedPage.timestamp}
                    focusMode={focusMode}
                    focusSection={selectedMarcher?.section ?? null}
                    focusedMarcherIds={focusedMarcherIds}
                    marcherRefs={marcherRefs.current}
                />
                {diagnosticsEnabled && <PerformanceSampler />}
            </ThreeCanvas>

            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-[5]"
                style={CINEMATIC_OVERLAYS[preferences.lightingMode]}
            />

            <div className="absolute top-6 right-6 z-10 flex max-w-[calc(100%_-_3rem)] flex-col items-end gap-3">
                <div
                    className="border-stroke bg-bg-1/90 flex gap-2 rounded-lg border p-2 shadow-lg backdrop-blur-sm"
                    aria-label="3D camera preset"
                >
                    {(Object.keys(CAMERA_LABELS) as CameraPreset[]).map(
                        (preset) => (
                            <button
                                key={preset}
                                type="button"
                                aria-pressed={cameraPreset === preset}
                                onClick={() => {
                                    setFocusMode("free");
                                    setDirectorEnabled(false);
                                    setCameraRollDegrees(0);
                                    if (cameraPreset === preset) {
                                        const presetConfiguration =
                                            getCameraPresetConfiguration(
                                                preset,
                                                width,
                                                depth,
                                            );
                                        cameraRigRef.current?.flyTo({
                                            position:
                                                presetConfiguration.position,
                                            target: presetConfiguration.target,
                                            fov: presetConfiguration.fov,
                                            rollDegrees: 0,
                                        });
                                    }
                                    setCameraPreset(preset);
                                }}
                                className={clsx(
                                    "rounded-6 px-10 py-6 text-sm transition-colors",
                                    cameraPreset === preset
                                        ? "bg-fg-2 text-accent"
                                        : "text-text hover:bg-fg-2",
                                )}
                            >
                                {CAMERA_LABELS[preset]}
                            </button>
                        ),
                    )}
                </div>

                <div
                    className="border-stroke bg-bg-1/90 text-text flex flex-wrap items-end gap-4 rounded-lg border px-4 py-3 text-xs shadow-lg backdrop-blur-sm"
                    aria-label="3D scene style"
                >
                    <label className="flex flex-col gap-1">
                        <span className="text-text/70">Uniform</span>
                        <select
                            value={preferences.uniformStyle}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    uniformStyle: event.target
                                        .value as UniformStyle,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="classic">Classic</option>
                            <option value="modern">Modern</option>
                            <option value="summer">Summer</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-text/70">Venue</span>
                        <select
                            value={preferences.venue}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    venue: event.target
                                        .value as VenuePreference,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="auto">Auto</option>
                            <option value="outdoor">Outdoor</option>
                            <option value="indoor" disabled={!indoorAvailable}>
                                {indoorAvailable
                                    ? "Indoor arena"
                                    : "Indoor (field too large)"}
                            </option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-text/70">Lighting</span>
                        <select
                            value={preferences.lightingMode}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    lightingMode: event.target
                                        .value as LightingMode,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="day">Day</option>
                            <option value="sunset">Sunset</option>
                            <option value="night">Night</option>
                        </select>
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-text/70">Uniform colors</span>
                        <select
                            value={preferences.uniformColorMode}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    uniformColorMode: event.target
                                        .value as UniformColorMode,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="editor">From 2D editor</option>
                            <option value="override">Single color</option>
                        </select>
                    </label>

                    {preferences.uniformColorMode === "override" && (
                        <label className="flex flex-col gap-1">
                            <span className="text-text/70">Color</span>
                            <input
                                type="color"
                                aria-label="3D uniform color"
                                value={preferences.uniformColor}
                                onChange={(event) =>
                                    setPreferences((current) => ({
                                        ...current,
                                        uniformColor: event.target.value,
                                    }))
                                }
                                className="border-stroke bg-bg-2 h-9 w-14 rounded border p-1"
                            />
                        </label>
                    )}

                    <button
                        type="button"
                        aria-pressed={preferences.showLabels}
                        onClick={() =>
                            setPreferences((current) => ({
                                ...current,
                                showLabels: !current.showLabels,
                            }))
                        }
                        className={clsx(
                            "rounded-4 border px-4 py-2 transition-colors",
                            preferences.showLabels
                                ? "border-accent bg-fg-2 text-accent"
                                : "border-stroke hover:bg-fg-2",
                        )}
                    >
                        Labels {preferences.showLabels ? "on" : "off"}
                    </button>
                </div>

                <DirectorPanel
                    shots={directorShots}
                    enabled={directorEnabled}
                    canCapture={
                        !!workspaceSettings &&
                        directorShots.length < MAX_DIRECTOR_CAMERA_SHOTS
                    }
                    rollDegrees={cameraRollDegrees}
                    selectedPageName={selectedPage.name}
                    onToggle={() => {
                        if (directorEnabled) {
                            setCameraRollDegrees(0);
                        } else {
                            setFocusMode("free");
                        }
                        setDirectorEnabled((current) => !current);
                    }}
                    onCapture={captureDirectorShot}
                    onRollChange={changeCameraRoll}
                    onPreview={previewDirectorShot}
                    onDelete={(shotId) =>
                        saveDirectorShots(
                            directorShots.filter((shot) => shot.id !== shotId),
                        )
                    }
                    onTransitionChange={(shotId, transitionSeconds) =>
                        saveDirectorShots(
                            directorShots.map((shot) =>
                                shot.id === shotId
                                    ? { ...shot, transitionSeconds }
                                    : shot,
                            ),
                        )
                    }
                />
            </div>

            <div className="absolute right-6 bottom-6 z-10 max-h-[calc(100%_-_3rem)] max-w-[calc(100%_-_3rem)] overflow-y-auto">
                <PerformerFocusPanel
                    marchers={marchers}
                    selectedMarcher={selectedMarcher}
                    selectedMarcherPage={
                        selectedMarcher
                            ? marcherPages[selectedMarcher.id]
                            : undefined
                    }
                    selectedPageName={selectedPage.name}
                    focusMode={focusMode}
                    trailMode={trailMode}
                    onSelectMarcher={selectMarcher}
                    onFocusModeChange={changeFocusMode}
                    onTrailModeChange={setTrailMode}
                />
            </div>

            <p className="bg-bg-1/80 text-text/80 pointer-events-none absolute bottom-6 left-6 rounded-md px-8 py-4 text-xs backdrop-blur-sm">
                {directorEnabled
                    ? `Director camera · ${directorShots.length} saved shots`
                    : "Drag to orbit · right-drag to pan · scroll to zoom"}
            </p>
        </div>
    );
}
