import {
    Profiler,
    useCallback,
    useEffect,
    useLayoutEffect,
    memo,
    useMemo,
    useRef,
    useState,
    type ElementRef,
    type ProfilerOnRenderCallback,
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
    getLowerBodyFacingAngle,
    rgbaStringToThreeColor,
} from "./viewer3d.utils";
import { FieldProperties } from "@openmarch/core";
import Marcher from "@/global/classes/Marcher";
import MarcherPage from "@/global/classes/MarcherPage";
import { MarcherTimeline } from "@/utilities/Keyframes";
import { MarcherAppearanceByIdMap } from "@/hooks/queries/useMarcherAppearances";
import LightingRig from "./LightingRig";
import StadiumEnvironment from "./StadiumEnvironment";
import { getFieldSceneTheme, STORYBOOK_RENDERING } from "./sceneTheme";
import { getMarcherDetailDistance } from "./instrumentCatalog";
import BatchedMarcherLayer from "./BatchedMarcherLayer";
import {
    DEFAULT_VIEWER_3D_PREFERENCES,
    type FieldScene,
    type InstrumentFinish,
    type UniformColorMode,
    type UniformStyle,
    type Viewer3DPreferences,
} from "./viewer3d.types";

const CAMERA_LABELS: Record<CameraPreset, string> = {
    overhead: "Overhead",
    pressBox: "Press box",
    fieldLevel: "Field level",
};

const FIELD_SCENE_LABELS: Record<FieldScene, string> = {
    storybook: "Storybook stadium",
    night: "Night stadium",
    practice: "Practice field",
};

const VIEWER_PREFERENCES_KEY = "openmarch-3d-viewer-preferences";

const loadViewerPreferences = (): Viewer3DPreferences => {
    try {
        const saved = window.localStorage.getItem(VIEWER_PREFERENCES_KEY);
        if (!saved) return DEFAULT_VIEWER_3D_PREFERENCES;
        const parsed = JSON.parse(saved) as Partial<
            typeof DEFAULT_VIEWER_3D_PREFERENCES
        >;
        const fieldScene = ["storybook", "night", "practice"].includes(
            parsed.fieldScene ?? "",
        )
            ? (parsed.fieldScene as FieldScene)
            : DEFAULT_VIEWER_3D_PREFERENCES.fieldScene;
        const uniformColorMode = ["drill", "override"].includes(
            parsed.uniformColorMode ?? "",
        )
            ? (parsed.uniformColorMode as UniformColorMode)
            : DEFAULT_VIEWER_3D_PREFERENCES.uniformColorMode;
        const uniformColor = /^#[\da-f]{6}$/i.test(parsed.uniformColor ?? "")
            ? parsed.uniformColor!
            : DEFAULT_VIEWER_3D_PREFERENCES.uniformColor;

        return {
            uniformStyle: ["classic", "modern", "summer"].includes(
                parsed.uniformStyle ?? "",
            )
                ? (parsed.uniformStyle as UniformStyle)
                : DEFAULT_VIEWER_3D_PREFERENCES.uniformStyle,
            instrumentFinish: ["brass", "silver"].includes(
                parsed.instrumentFinish ?? "",
            )
                ? (parsed.instrumentFinish as InstrumentFinish)
                : DEFAULT_VIEWER_3D_PREFERENCES.instrumentFinish,
            fieldScene,
            uniformColorMode,
            uniformColor,
            showLabels:
                typeof parsed.showLabels === "boolean"
                    ? parsed.showLabels
                    : DEFAULT_VIEWER_3D_PREFERENCES.showLabels,
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

        camera.near = 0.1;
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

interface ViewerPerformanceMetrics {
    marcherFrameCount: number;
    marcherFrameTotalMs: number;
    marcherFrameWorstMs: number;
    batchFrameCount: number;
    batchFrameTotalMs: number;
    batchFrameWorstMs: number;
    reactCommitLatestMs: number;
    reactCommitWorstMs: number;
}

interface ViewerPerformanceMetricsRef {
    current: ViewerPerformanceMetrics;
}

const createViewerPerformanceMetrics = (): ViewerPerformanceMetrics => ({
    marcherFrameCount: 0,
    marcherFrameTotalMs: 0,
    marcherFrameWorstMs: 0,
    batchFrameCount: 0,
    batchFrameTotalMs: 0,
    batchFrameWorstMs: 0,
    reactCommitLatestMs: 0,
    reactCommitWorstMs: 0,
});

function PerformanceSampler({
    enabled,
    panelRef,
    metricsRef,
    pageId,
}: {
    enabled: boolean;
    panelRef: { current: HTMLPreElement | null };
    metricsRef: ViewerPerformanceMetricsRef;
    pageId: number;
}) {
    const lastFrameAtRef = useRef(0);
    const sampleStartedAtRef = useRef(0);
    const frameCountRef = useRef(0);
    const frameTotalMsRef = useRef(0);
    const frameWorstMsRef = useRef(0);
    const sessionWorstMsRef = useRef(0);

    useEffect(() => {
        lastFrameAtRef.current = 0;
        sampleStartedAtRef.current = 0;
        frameCountRef.current = 0;
        frameTotalMsRef.current = 0;
        frameWorstMsRef.current = 0;
        sessionWorstMsRef.current = 0;
        metricsRef.current = createViewerPerformanceMetrics();
    }, [enabled, metricsRef]);

    useFrame(({ gl }) => {
        if (!enabled) return;

        const now = performance.now();
        if (sampleStartedAtRef.current === 0) {
            sampleStartedAtRef.current = now;
            lastFrameAtRef.current = now;
            return;
        }

        const frameMs = now - lastFrameAtRef.current;
        lastFrameAtRef.current = now;
        frameCountRef.current += 1;
        frameTotalMsRef.current += frameMs;
        frameWorstMsRef.current = Math.max(frameWorstMsRef.current, frameMs);
        sessionWorstMsRef.current = Math.max(
            sessionWorstMsRef.current,
            frameMs,
        );

        const sampleDuration = now - sampleStartedAtRef.current;
        if (sampleDuration < 750 || !panelRef.current) return;

        const metrics = metricsRef.current;
        const averageFrameMs = frameTotalMsRef.current / frameCountRef.current;
        const fps = (frameCountRef.current * 1000) / sampleDuration;
        const marcherFrameMs = metrics.marcherFrameCount
            ? metrics.marcherFrameTotalMs / metrics.marcherFrameCount
            : 0;
        const batchFrameMs = metrics.batchFrameCount
            ? metrics.batchFrameTotalMs / metrics.batchFrameCount
            : 0;

        panelRef.current.textContent = [
            `Page ${pageId} performance`,
            `FPS                 ${fps.toFixed(0)}`,
            `Average frame       ${averageFrameMs.toFixed(1)} ms`,
            `Slowest frame       ${frameWorstMsRef.current.toFixed(1)} ms`,
            `Slowest since open  ${sessionWorstMsRef.current.toFixed(1)} ms`,
            `Coordinate CPU      ${marcherFrameMs.toFixed(2)} ms`,
            `Instance update CPU ${batchFrameMs.toFixed(2)} ms avg`,
            `Worst instance CPU  ${metrics.batchFrameWorstMs.toFixed(2)} ms`,
            `Marcher React work  ${metrics.reactCommitLatestMs.toFixed(1)} ms`,
            `Worst React work    ${metrics.reactCommitWorstMs.toFixed(1)} ms`,
            `Draw calls          ${gl.info.render.calls.toLocaleString()}`,
            `Triangles           ${gl.info.render.triangles.toLocaleString()}`,
            `3D shapes in memory ${gl.info.memory.geometries.toLocaleString()}`,
            "",
            "Play through a page change and watch the slowest values.",
        ].join("\n");

        sampleStartedAtRef.current = now;
        frameCountRef.current = 0;
        frameTotalMsRef.current = 0;
        frameWorstMsRef.current = 0;
        metrics.marcherFrameCount = 0;
        metrics.marcherFrameTotalMs = 0;
        metrics.marcherFrameWorstMs = 0;
        metrics.batchFrameCount = 0;
        metrics.batchFrameTotalMs = 0;
        metrics.batchFrameWorstMs = 0;
        metrics.reactCommitWorstMs = metrics.reactCommitLatestMs;
    });

    return null;
}

interface StaticFieldSceneProps {
    fieldProperties: FieldProperties;
    fieldWidth: number;
    fieldDepth: number;
    showGrid: boolean;
    showHalfLines: boolean;
    scene: FieldScene;
}

const StaticFieldScene = memo(function StaticFieldScene({
    fieldProperties,
    fieldWidth,
    fieldDepth,
    showGrid,
    showHalfLines,
    scene,
}: StaticFieldSceneProps) {
    const theme = getFieldSceneTheme(scene);
    return (
        <>
            <fog
                attach="fog"
                args={[
                    theme.skyHorizon,
                    fieldWidth * STORYBOOK_RENDERING.fogNearFactor,
                    fieldWidth * STORYBOOK_RENDERING.fogFarFactor,
                ]}
            />
            <LightingRig
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                scene={scene}
            />
            <StadiumEnvironment
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                scene={scene}
            />
            <Field3D
                fieldProperties={fieldProperties}
                showGrid={showGrid}
                showHalfLines={showHalfLines}
                scene={scene}
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
    instrumentFinish: InstrumentFinish;
    uniformColorMode: UniformColorMode;
    uniformColor: string;
    showLabels: boolean;
    measurePerformance: boolean;
    performanceMetricsRef: ViewerPerformanceMetricsRef;
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
    instrumentFinish,
    uniformColorMode,
    uniformColor,
    showLabels,
    measurePerformance,
    performanceMetricsRef,
}: MarcherFormationProps) {
    const marcherRefs = useRef(new Map<number, MarcherGroupRef>());
    const marcherMotionRefs = useRef(new Map<number, MarcherMotionRef>());
    const { isPlaying } = useIsPlaying()!;
    const detailDistance = getMarcherDetailDistance(marchers.length);
    const marcherBatchKey = useMemo(
        () =>
            `${uniformStyle}:${marchers
                .filter((marcher) => marcherPages[marcher.id] != null)
                .map((marcher) => `${marcher.id}:${marcher.section}`)
                .join("|")}`,
        [marcherPages, marchers, uniformStyle],
    );

    const setPausedPositions = useCallback(() => {
        for (const marcher of marchers) {
            const marcherPage = marcherPages[marcher.id];
            const marcherGroup = marcherRefs.current.get(marcher.id)?.current;
            if (!marcherPage || !marcherGroup) continue;
            const motionRef = marcherMotionRefs.current.get(marcher.id);
            if (motionRef) {
                motionRef.current = false;
                motionRef.lowerBodyAngle = 0;
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

    useFrame(() => {
        if (!isPlaying) return;
        const startedAt = measurePerformance ? performance.now() : 0;
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
                    motionRef.lowerBodyAngle = 0;
                    continue;
                }
                const x =
                    (coordinate.x - fieldProperties.width / 2) /
                    fieldProperties.pixelsPerStep;
                const z =
                    (coordinate.y - fieldProperties.height / 2) /
                    fieldProperties.pixelsPerStep;
                const deltaX = x - marcherGroup.position.x;
                const deltaZ = z - marcherGroup.position.z;
                const isMoving = deltaX * deltaX + deltaZ * deltaZ > 0.00000001;
                motionRef.current = isMoving;
                motionRef.lowerBodyAngle = isMoving
                    ? getLowerBodyFacingAngle(
                          deltaX,
                          deltaZ,
                          marcherGroup.rotation.y,
                      )
                    : 0;
                marcherGroup.position.set(x, 0, z);
            } catch {
                motionRef.current = false;
                motionRef.lowerBodyAngle = 0;
                // A drill timeline query may still be loading at this frame.
            }
        }

        if (measurePerformance) {
            const duration = performance.now() - startedAt;
            const metrics = performanceMetricsRef.current;
            metrics.marcherFrameCount += 1;
            metrics.marcherFrameTotalMs += duration;
            metrics.marcherFrameWorstMs = Math.max(
                metrics.marcherFrameWorstMs,
                duration,
            );
        }
    }, -2);

    return (
        <BatchedMarcherLayer
            rebuildKey={marcherBatchKey}
            measurePerformance={measurePerformance}
            performanceMetricsRef={performanceMetricsRef}
        >
            <group>
                {marchers.map((marcher) => {
                    const marcherPage = marcherPages[marcher.id];
                    if (!marcherPage) return null;
                    const appearance = resolveAppearanceFromStack(
                        marcherAppearances[marcher.id] ?? [],
                        fieldProperties.theme,
                    );
                    const drillColor = rgbaStringToThreeColor(
                        appearance.fillRgba,
                    );
                    const uniformColorToUse =
                        uniformColorMode === "override"
                            ? uniformColor
                            : drillColor;
                    let motionRef = marcherMotionRefs.current.get(marcher.id);
                    if (!motionRef) {
                        motionRef = { current: false, lowerBodyAngle: 0 };
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
                                color={uniformColorToUse}
                                equipmentAccentColor={drillColor}
                                labelVisible={
                                    showLabels && appearance.textVisible
                                }
                                uniformStyle={uniformStyle}
                                instrumentFinish={instrumentFinish}
                                detailDistance={detailDistance}
                                motionRef={motionRef}
                            />
                        </group>
                    );
                })}
            </group>
        </BatchedMarcherLayer>
    );
}

export default function ThreeDViewer() {
    const [cameraPreset, setCameraPreset] = useState<CameraPreset>("pressBox");
    const [preferences, setPreferences] = useState(loadViewerPreferences);
    const [showPerformance, setShowPerformance] = useState(false);
    const performancePanelRef = useRef<HTMLPreElement>(null);
    const performanceMetricsRef = useRef(createViewerPerformanceMetrics());
    const databaseReady = useDatabaseReady();
    const queryClient = useQueryClient();
    const { selectedPage } = useSelectedPage()!;
    const { pages } = useTimingObjects();
    const { uiSettings } = useUiSettingsStore();
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

    const handleMarcherRender = useCallback<ProfilerOnRenderCallback>(
        (_id, _phase, actualDuration) => {
            if (!showPerformance) return;
            const metrics = performanceMetricsRef.current;
            metrics.reactCommitLatestMs = actualDuration;
            metrics.reactCommitWorstMs = Math.max(
                metrics.reactCommitWorstMs,
                actualDuration,
            );
        },
        [showPerformance],
    );

    useEffect(() => {
        window.localStorage.setItem(
            VIEWER_PREFERENCES_KEY,
            JSON.stringify(preferences),
        );
    }, [preferences]);

    useEffect(() => {
        if (!selectedPage || pages.length < 2) return;

        const selectedIndex = pages.findIndex(
            (page) => page.id === selectedPage.id,
        );
        if (selectedIndex < 0) return;

        const nearbyPages = [
            pages[selectedIndex + 1],
            pages[selectedIndex + 2],
            pages[selectedIndex + 3],
            pages[selectedIndex - 1],
        ].filter((page) => page != null);
        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                for (const page of nearbyPages) {
                    if (cancelled) return;
                    await queryClient.prefetchQuery(
                        marcherAppearancesQueryOptions(page.id, queryClient),
                    );
                }
            })();
        }, 0);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [pages, queryClient, selectedPage]);

    if (!fieldProperties || !selectedPage) {
        return (
            <div className="bg-bg-2 text-text flex h-full w-full items-center justify-center">
                Loading 3D field…
            </div>
        );
    }

    const { width, depth } = getFieldWorldDimensions(fieldProperties);

    return (
        <div className="bg-bg-2 rounded-6 relative h-full w-full overflow-hidden">
            <ThreeCanvas
                shadows="basic"
                dpr={1}
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
                    scene={preferences.fieldScene}
                />
                <Profiler id="3d-marchers" onRender={handleMarcherRender}>
                    <MarcherFormation
                        marchers={marchers}
                        marcherPages={marcherPages}
                        marcherTimelines={marcherTimelines}
                        marcherAppearances={marcherAppearances}
                        fieldProperties={fieldProperties}
                        uniformStyle={preferences.uniformStyle}
                        instrumentFinish={preferences.instrumentFinish}
                        uniformColorMode={preferences.uniformColorMode}
                        uniformColor={preferences.uniformColor}
                        showLabels={preferences.showLabels}
                        measurePerformance={showPerformance}
                        performanceMetricsRef={performanceMetricsRef}
                    />
                </Profiler>
                <MemoizedCameraRig
                    preset={cameraPreset}
                    fieldWidth={width}
                    fieldDepth={depth}
                />
                <PerformanceSampler
                    enabled={showPerformance}
                    panelRef={performancePanelRef}
                    metricsRef={performanceMetricsRef}
                    pageId={selectedPage.id}
                />
            </ThreeCanvas>

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
                        <span className="text-text/70">Field</span>
                        <select
                            value={preferences.fieldScene}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    fieldScene: event.target
                                        .value as FieldScene,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            {(
                                Object.keys(FIELD_SCENE_LABELS) as FieldScene[]
                            ).map((scene) => (
                                <option key={scene} value={scene}>
                                    {FIELD_SCENE_LABELS[scene]}
                                </option>
                            ))}
                        </select>
                    </label>

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
                        <span className="text-text/70">Instrument finish</span>
                        <select
                            value={preferences.instrumentFinish}
                            onChange={(event) =>
                                setPreferences((current) => ({
                                    ...current,
                                    instrumentFinish: event.target
                                        .value as InstrumentFinish,
                                }))
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="brass">Brass</option>
                            <option value="silver">Silver</option>
                        </select>
                    </label>

                    <div className="flex flex-col gap-1">
                        <span className="text-text/70">Uniform color</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-pressed={
                                    preferences.uniformColorMode === "override"
                                }
                                onClick={() =>
                                    setPreferences((current) => ({
                                        ...current,
                                        uniformColorMode:
                                            current.uniformColorMode === "drill"
                                                ? "override"
                                                : "drill",
                                    }))
                                }
                                className={clsx(
                                    "rounded-4 border px-4 py-2 transition-colors",
                                    preferences.uniformColorMode === "override"
                                        ? "border-accent bg-fg-2 text-accent"
                                        : "border-stroke hover:bg-fg-2",
                                )}
                            >
                                {preferences.uniformColorMode === "override"
                                    ? "3D override"
                                    : "Drill colors"}
                            </button>
                            {preferences.uniformColorMode === "override" && (
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
                                    className="border-stroke bg-bg-2 h-8 w-10 cursor-pointer rounded border p-1"
                                />
                            )}
                        </div>
                    </div>

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

                    <button
                        type="button"
                        aria-pressed={showPerformance}
                        onClick={() =>
                            setShowPerformance((current) => !current)
                        }
                        className={clsx(
                            "rounded-4 border px-4 py-2 transition-colors",
                            showPerformance
                                ? "border-accent bg-fg-2 text-accent"
                                : "border-stroke hover:bg-fg-2",
                        )}
                    >
                        Performance {showPerformance ? "on" : "off"}
                    </button>
                </div>
            </div>

            {showPerformance && (
                <pre
                    ref={performancePanelRef}
                    className="border-stroke bg-bg-1/90 text-text pointer-events-none absolute right-6 bottom-6 z-10 rounded-lg border p-4 font-mono text-xs leading-relaxed shadow-lg backdrop-blur-sm"
                >
                    Measuring performance…
                </pre>
            )}

            <p className="bg-bg-1/80 text-text/80 pointer-events-none absolute bottom-6 left-6 rounded-md px-8 py-4 text-xs backdrop-blur-sm">
                Instruments follow each marcher&apos;s section · drag to orbit ·
                right-drag to pan · scroll to zoom
            </p>
        </div>
    );
}
