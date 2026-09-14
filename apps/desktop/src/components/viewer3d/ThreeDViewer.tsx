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
import { Canvas as ThreeCanvas, useFrame, useThree } from "@react-three/fiber";
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
}

export interface CameraRigHandle {
    capture: () => DirectorCameraState | null;
    flyTo: (state: DirectorCameraState, durationSeconds?: number) => void;
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
        },
        ref,
    ) {
        const { camera } = useThree();
        const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
        const transitionRef = useRef<CameraTransition | null>(null);
        const appliedRollDegreesRef = useRef(rollDegrees);
        const initializedRef = useRef(false);
        const isPlaying = useIsPlaying()?.isPlaying ?? false;
        const configuration = useMemo(
            () => getCameraPresetConfiguration(preset, fieldWidth, fieldDepth),
            [fieldDepth, fieldWidth, preset],
        );
        const sortedDirectorShots = useMemo(
            () => sortDirectorCameraShots(directorShots),
            [directorShots],
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
            const controls = controlsRef.current;
            if (!controls || !(camera instanceof THREE.PerspectiveCamera))
                return;

            // A tighter depth range prevents the field layers from fighting
            // when viewed from overhead or from far away.
            camera.near = 0.5;
            camera.far = Math.max(25, Math.max(fieldWidth, fieldDepth) * 12);
            camera.updateProjectionMatrix();
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
                enabled={!directorEnabled}
                enablePan
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
}

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
}: MarcherFormationProps) {
    const marcherRefs = useRef(new Map<number, MarcherShadowGroupRef>());
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
            const marcherGroup = marcherRefs.current.get(marcher.id)?.current;
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
    }, [fieldProperties, marcherPages, marchers]);

    useLayoutEffect(() => {
        if (!isPlaying) setPausedPositions();
    }, [isPlaying, setPausedPositions]);

    useLayoutEffect(() => {
        for (const marcher of marchers) {
            const marcherPage = marcherPages[marcher.id];
            const marcherGroup = marcherRefs.current.get(marcher.id)?.current;
            if (!marcherPage || !marcherGroup) continue;
            marcherGroup.rotation.y = THREE.MathUtils.degToRad(
                -marcherPage.rotation_degrees,
            );
        }
    }, [marcherPages, marchers]);

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
                    const marcherGroup = marcherRefs.current.get(
                        marcher.id,
                    )?.current;
                    if (!marcherPage || !marcherGroup) continue;
                    marcherGroup.rotation.y = THREE.MathUtils.degToRad(
                        -marcherPage.rotation_degrees,
                    );
                }
            }),
        [marchers, queryClient],
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
            const marcherGroup = marcherRefs.current.get(marcher.id)?.current;
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
                marcherRefs={marcherRefs.current}
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
                let marcherGroupRef = marcherRefs.current.get(marcher.id);
                if (!marcherGroupRef) {
                    marcherGroupRef = { current: null };
                    marcherRefs.current.set(marcher.id, marcherGroupRef);
                }

                return (
                    <group
                        key={marcher.id}
                        ref={marcherGroupRef}
                        visible={appearance.visible}
                    >
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
    const cameraRigRef = useRef<CameraRigHandle>(null);
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

    useEffect(() => {
        saveViewerPreferences(preferences);
    }, [preferences]);

    useEffect(() => {
        if (directorShots.length === 0) setDirectorEnabled(false);
    }, [directorShots.length]);

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
                                    setDirectorEnabled(false);
                                    setCameraRollDegrees(0);
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
                        if (directorEnabled) setCameraRollDegrees(0);
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

            <p className="bg-bg-1/80 text-text/80 pointer-events-none absolute bottom-6 left-6 rounded-md px-8 py-4 text-xs backdrop-blur-sm">
                {directorEnabled
                    ? `Director camera · ${directorShots.length} saved shots`
                    : "Drag to orbit · right-drag to pan · scroll to zoom"}
            </p>
        </div>
    );
}
