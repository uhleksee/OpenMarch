import {
    useCallback,
    useEffect,
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
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import * as THREE from "three";
import clsx from "clsx";
import {
    allMarchersQueryOptions,
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
import Marcher3D, { type MarcherMotionRef } from "./Marcher3D";
import {
    CameraPreset,
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getFieldWorldDimensions,
    getLegFacingOffset,
    hasWorldPositionChanged,
    rgbaStringToThreeColor,
} from "./viewer3d.utils";
import { FieldProperties } from "@openmarch/core";
import Marcher from "@/global/classes/Marcher";
import MarcherPage from "@/global/classes/MarcherPage";
import { MarcherTimeline } from "@/utilities/Keyframes";
import { MarcherAppearanceByIdMap } from "@/hooks/queries/useMarcherAppearances";
import LightingRig from "./LightingRig";
import StadiumEnvironment from "./StadiumEnvironment";
import { CINEMATIC_OVERLAYS, LIGHTING_THEMES } from "./sceneTheme";
import {
    DEFAULT_VIEWER_3D_PREFERENCES,
    type LightingMode,
    type UniformColorMode,
    type UniformStyle,
} from "./viewer3d.types";
import {
    threeDiagnosticSnapshot,
    usePerformanceDiagnosticsStore,
} from "@/stores/PerformanceDiagnosticsStore";
import { usePlaybackPageStore } from "@/stores/PlaybackPageStore";

const CAMERA_LABELS: Record<CameraPreset, string> = {
    overhead: "Overhead",
    pressBox: "Press box",
    fieldLevel: "Field level",
};

const VIEWER_PREFERENCES_KEY = "openmarch-3d-viewer-preferences";

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

const loadViewerPreferences = () => {
    try {
        const saved = window.localStorage.getItem(VIEWER_PREFERENCES_KEY);
        if (!saved) return DEFAULT_VIEWER_3D_PREFERENCES;
        const parsed = JSON.parse(saved) as Partial<
            typeof DEFAULT_VIEWER_3D_PREFERENCES
        >;
        return {
            uniformStyle: ["classic", "modern", "summer"].includes(
                parsed.uniformStyle ?? "",
            )
                ? (parsed.uniformStyle as UniformStyle)
                : DEFAULT_VIEWER_3D_PREFERENCES.uniformStyle,
            uniformColorMode: ["editor", "override"].includes(
                parsed.uniformColorMode ?? "",
            )
                ? (parsed.uniformColorMode as UniformColorMode)
                : DEFAULT_VIEWER_3D_PREFERENCES.uniformColorMode,
            uniformColor:
                typeof parsed.uniformColor === "string"
                    ? parsed.uniformColor
                    : DEFAULT_VIEWER_3D_PREFERENCES.uniformColor,
            showLabels:
                typeof parsed.showLabels === "boolean"
                    ? parsed.showLabels
                    : DEFAULT_VIEWER_3D_PREFERENCES.showLabels,
            lightingMode: ["day", "sunset", "night"].includes(
                parsed.lightingMode ?? "",
            )
                ? (parsed.lightingMode as LightingMode)
                : DEFAULT_VIEWER_3D_PREFERENCES.lightingMode,
        };
    } catch {
        return DEFAULT_VIEWER_3D_PREFERENCES;
    }
};

interface CameraRigProps {
    preset: CameraPreset;
    fieldWidth: number;
    fieldDepth: number;
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
}

function CameraRig({ preset, fieldWidth, fieldDepth }: CameraRigProps) {
    const { camera } = useThree();
    const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
    const transitionRef = useRef<CameraTransition | null>(null);
    const initializedRef = useRef(false);
    const configuration = useMemo(
        () => getCameraPresetConfiguration(preset, fieldWidth, fieldDepth),
        [fieldDepth, fieldWidth, preset],
    );

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls || !(camera instanceof THREE.PerspectiveCamera)) return;

        // A tighter depth range prevents the field layers from fighting when
        // viewed from the overhead camera or from far away.
        camera.near = 0.5;
        camera.far = Math.max(fieldWidth, fieldDepth) * 12;

        if (!initializedRef.current) {
            camera.position.set(...configuration.position);
            camera.fov = configuration.fov;
            controls.target.set(...configuration.target);
            camera.updateProjectionMatrix();
            controls.update();
            initializedRef.current = true;
            return;
        }

        transitionRef.current = {
            elapsed: 0,
            duration: 0.38,
            fromPosition: camera.position.clone(),
            toPosition: new THREE.Vector3(...configuration.position),
            fromTarget: controls.target.clone(),
            toTarget: new THREE.Vector3(...configuration.target),
            fromFov: camera.fov,
            toFov: configuration.fov,
        };
    }, [camera, configuration, fieldDepth, fieldWidth]);

    useFrame((_, delta) => {
        const transition = transitionRef.current;
        const controls = controlsRef.current;
        if (
            !transition ||
            !controls ||
            !(camera instanceof THREE.PerspectiveCamera)
        )
            return;

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

        if (progress >= 1) transitionRef.current = null;
    });

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
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
            maxDistance={Math.max(fieldWidth, fieldDepth) * 4}
            maxPolarAngle={Math.PI / 2 - 0.015}
        />
    );
}

const MemoizedCameraRig = memo(CameraRig);

interface StaticFieldSceneProps {
    fieldProperties: FieldProperties;
    fieldWidth: number;
    fieldDepth: number;
    showGrid: boolean;
    showHalfLines: boolean;
    lightingMode: LightingMode;
    showEnvironment: boolean;
}

const StaticFieldScene = memo(function StaticFieldScene({
    fieldProperties,
    fieldWidth,
    fieldDepth,
    showGrid,
    showHalfLines,
    lightingMode,
    showEnvironment,
}: StaticFieldSceneProps) {
    const lighting = LIGHTING_THEMES[lightingMode];
    return (
        <>
            <fog
                attach="fog"
                args={[
                    lighting.skyHorizon,
                    fieldWidth * lighting.fogNearFactor,
                    fieldWidth * lighting.fogFarFactor,
                ]}
            />
            <LightingRig
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                mode={lightingMode}
            />
            {showEnvironment && (
                <StadiumEnvironment
                    fieldWidth={fieldWidth}
                    fieldDepth={fieldDepth}
                    lightingMode={lightingMode}
                />
            )}
            <Field3D
                fieldProperties={fieldProperties}
                showGrid={showGrid}
                showHalfLines={showHalfLines}
            />
        </>
    );
});

interface MarcherFormationProps {
    marchers: Marcher[];
    marcherPages: Record<number, MarcherPage>;
    marcherTimelines: Map<number, MarcherTimeline>;
    marcherAppearances: MarcherAppearanceByIdMap;
    fieldProperties: FieldProperties;
    uniformStyle: UniformStyle;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
}

interface MarcherGroupRef {
    current: THREE.Group | null;
}

function MarcherFormation({
    marchers,
    marcherPages,
    marcherTimelines,
    marcherAppearances,
    fieldProperties,
    uniformStyle,
    uniformColorMode,
    uniformColor,
    showLabels,
}: MarcherFormationProps) {
    const marcherRefs = useRef(new Map<number, MarcherGroupRef>());
    const marcherMotionRefs = useRef(new Map<number, MarcherMotionRef>());
    const { isPlaying } = useIsPlaying()!;
    const queryClient = useQueryClient();

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
        const currentTime = getLivePlaybackPosition() * 1000;

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
    });

    return (
        <group>
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
                        />
                    </group>
                );
            })}
        </group>
    );
}

export default function ThreeDViewer() {
    const [cameraPreset, setCameraPreset] = useState<CameraPreset>("pressBox");
    const [preferences, setPreferences] = useState(loadViewerPreferences);
    const databaseReady = useDatabaseReady();
    const queryClient = useQueryClient();
    const { selectedPage } = useSelectedPage()!;
    const { pages } = useTimingObjects();
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

    useEffect(() => {
        window.localStorage.setItem(
            VIEWER_PREFERENCES_KEY,
            JSON.stringify(preferences),
        );
    }, [preferences]);

    if (!fieldProperties || !selectedPage) {
        return (
            <div className="bg-bg-2 text-text flex h-full w-full items-center justify-center">
                Loading 3D field…
            </div>
        );
    }

    const { width, depth } = getFieldWorldDimensions(fieldProperties);
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
                />
                {showPerformers && (
                    <MarcherFormation
                        marchers={marchers}
                        marcherPages={marcherPages}
                        marcherTimelines={marcherTimelines}
                        marcherAppearances={marcherAppearances}
                        fieldProperties={fieldProperties}
                        uniformStyle={preferences.uniformStyle}
                        uniformColorMode={preferences.uniformColorMode}
                        uniformColor={preferences.uniformColor}
                        showLabels={preferences.showLabels}
                    />
                )}
                <MemoizedCameraRig
                    preset={cameraPreset}
                    fieldWidth={width}
                    fieldDepth={depth}
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
                                onClick={() => setCameraPreset(preset)}
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
            </div>

            <p className="bg-bg-1/80 text-text/80 pointer-events-none absolute bottom-6 left-6 rounded-md px-8 py-4 text-xs backdrop-blur-sm">
                Drag to orbit · right-drag to pan · scroll to zoom
            </p>
        </div>
    );
}
