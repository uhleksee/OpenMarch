import { useLayoutEffect, useMemo, useRef } from "react";
import {
    createRoot,
    flushSync,
    useFrame,
    useThree,
    type ReconcilerRoot,
    type RootStore,
} from "@react-three/fiber";
import * as THREE from "three";
import { FieldProperties } from "@openmarch/core";
import Marcher from "@/global/classes/Marcher";
import type MarcherPageMap from "@/global/classes/MarcherPageIndex";
import type Page from "@/global/classes/Page";
import { resolveAppearanceFromStack } from "@/entity-components/appearance";
import {
    getCoordinatesAtTime,
    type MarcherTimeline,
} from "@/utilities/Keyframes";
import {
    getDirectorCameraStateAtTimeFromSortedShots,
    sortDirectorCameraShots,
    type DirectorCameraShot,
    type DirectorCameraState,
} from "@/utilities/directorCamera";
import type { MarcherAppearancesByPageId } from "../utils/exportAppearances";
import { getPlaybackPageForTimeMs } from "../utils/exportAppearances";
import Field3D from "../../viewer3d/Field3D";
import IndoorArenaEnvironment from "../../viewer3d/IndoorArenaEnvironment";
import LightingRig from "../../viewer3d/LightingRig";
import Marcher3D, {
    type MarcherGaitRef,
    type MarcherMotionRef,
} from "../../viewer3d/Marcher3D";
import MarcherShadows, {
    type MarcherShadowGroupRef,
} from "../../viewer3d/MarcherShadows";
import StadiumEnvironment from "../../viewer3d/StadiumEnvironment";
import {
    createMarchBeatTimeline,
    getMarchStepAtTime,
} from "../../viewer3d/marchBeatPhase";
import { LIGHTING_THEMES } from "../../viewer3d/sceneTheme";
import type {
    ResolvedVenue,
    Viewer3DPreferences,
} from "../../viewer3d/viewer3d.types";
import {
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getField3DValidationError,
    getFieldWorldDimensions,
    getLegFacingOffset,
    hasWorldPositionChanged,
    rgbaStringToThreeColor,
    resolveVenue,
} from "../../viewer3d/viewer3d.utils";

// cspell:ignore frameloop

const ASSET_READY_TIMEOUT_MS = 15_000;
const MOTION_SAMPLE_MS = 1000 / 60;
const SHADOW_WARMUP_FRAMES = 3;

interface ExportTimeRef {
    current: number;
}

export interface CreateThreeDVideoRenderContextArgs {
    fieldProperties: FieldProperties;
    sortedPages: Page[];
    marchers: Marcher[];
    marcherTimelines: Map<number, MarcherTimeline>;
    marcherAppearancesByPageId?: MarcherAppearancesByPageId;
    fieldImage: Uint8Array | null;
    marcherPages: MarcherPageMap;
    gridLines: boolean;
    halfLines: boolean;
    width: number;
    height: number;
    directorCameraShots: DirectorCameraShot[];
    viewerPreferences: Viewer3DPreferences;
}

export interface ThreeDVideoRenderContext {
    /** The WebGL canvas containing the most recently rendered frame. */
    canvas: HTMLCanvasElement;
    /** Render an exact show timestamp. Export calls this in ascending order. */
    renderFrame: (timeSeconds: number) => void;
    dispose: () => void;
}

interface ExportCameraProps {
    timeRef: ExportTimeRef;
    shots: DirectorCameraShot[];
    fallback: DirectorCameraState;
}

const applyCameraState = (
    camera: THREE.PerspectiveCamera,
    state: DirectorCameraState,
) => {
    camera.position.set(...state.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...state.target);
    camera.rotateZ(THREE.MathUtils.degToRad(state.rollDegrees));
    if (camera.fov !== state.fov) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
    }
};

function ExportCamera({ timeRef, shots, fallback }: ExportCameraProps) {
    const { camera } = useThree();

    useLayoutEffect(() => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return;
        applyCameraState(
            camera,
            getDirectorCameraStateAtTimeFromSortedShots(
                shots,
                timeRef.current,
            ) ?? fallback,
        );
    }, [camera, fallback, shots, timeRef]);

    useFrame(() => {
        if (!(camera instanceof THREE.PerspectiveCamera)) return;
        applyCameraState(
            camera,
            getDirectorCameraStateAtTimeFromSortedShots(
                shots,
                timeRef.current,
            ) ?? fallback,
        );
    }, -2);

    return null;
}

const safelyGetCoordinates = (
    timeline: MarcherTimeline | undefined,
    timeMs: number,
) => {
    if (!timeline) return null;
    try {
        return getCoordinatesAtTime(timeMs, timeline);
    } catch {
        return null;
    }
};

const collectUniqueBeats = (pages: Page[]) => {
    const beatsById = new Map<number, Page["beats"][number]>();
    for (const page of pages) {
        for (const beat of page.beats) {
            if (!beatsById.has(beat.id)) beatsById.set(beat.id, beat);
        }
    }
    return [...beatsById.values()];
};

interface ExportMarcherFormationProps {
    timeRef: ExportTimeRef;
    activePageId: number;
    marchers: Marcher[];
    pages: Page[];
    marcherPages: MarcherPageMap;
    marcherTimelines: Map<number, MarcherTimeline>;
    marcherAppearancesByPageId?: MarcherAppearancesByPageId;
    fieldProperties: FieldProperties;
    preferences: Viewer3DPreferences;
    fieldWidth: number;
    fieldDepth: number;
    venue: ResolvedVenue;
}

function ExportMarcherFormation({
    timeRef,
    activePageId,
    marchers,
    pages,
    marcherPages,
    marcherTimelines,
    marcherAppearancesByPageId,
    fieldProperties,
    preferences,
    fieldWidth,
    fieldDepth,
    venue,
}: ExportMarcherFormationProps) {
    const marcherRefs = useRef(new Map<number, MarcherShadowGroupRef>());
    const motionRefs = useRef(new Map<number, MarcherMotionRef>());
    const gaitRef = useRef<MarcherGaitRef>({ phase: 0 });
    const marcherIds = useMemo(
        () => marchers.map((marcher) => marcher.id),
        [marchers],
    );
    const beatTimeline = useMemo(
        () => createMarchBeatTimeline(collectUniqueBeats(pages)),
        [pages],
    );
    const activeMarcherPages =
        marcherPages.marcherPagesByPage[activePageId] ?? {};
    const activeAppearances =
        marcherAppearancesByPageId?.get(activePageId) ?? {};

    useFrame(() => {
        const timeSeconds = timeRef.current;
        const timeMs = timeSeconds * 1000;
        const marchStep = getMarchStepAtTime(timeSeconds, beatTimeline);
        gaitRef.current.phase = Math.PI * (marchStep ?? 0);

        for (const marcher of marchers) {
            const group = marcherRefs.current.get(marcher.id)?.current;
            const motion = motionRefs.current.get(marcher.id);
            if (!group || !motion) continue;

            const marcherPage = activeMarcherPages[marcher.id];
            const authoredYaw = marcherPage
                ? THREE.MathUtils.degToRad(-marcherPage.rotation_degrees)
                : group.rotation.y;
            group.rotation.y = authoredYaw;

            const timeline = marcherTimelines.get(marcher.id);
            const coordinate =
                safelyGetCoordinates(timeline, timeMs) ?? marcherPage ?? null;
            if (!coordinate) {
                motion.current = false;
                motion.legFacing = 0;
                group.visible = false;
                continue;
            }

            const [x, y, z] = canvasCoordinatesToWorld(
                coordinate,
                fieldProperties,
            );
            const previousCoordinate = safelyGetCoordinates(
                timeline,
                Math.max(0, timeMs - MOTION_SAMPLE_MS),
            );
            const previousWorld = previousCoordinate
                ? canvasCoordinatesToWorld(previousCoordinate, fieldProperties)
                : null;
            const moving =
                previousWorld != null &&
                hasWorldPositionChanged(
                    { x: previousWorld[0], z: previousWorld[2] },
                    { x, z },
                );

            motion.current = moving;
            motion.legFacing = moving
                ? getLegFacingOffset(
                      x - previousWorld![0],
                      z - previousWorld![2],
                      authoredYaw,
                  )
                : 0;
            group.position.set(x, y, z);
        }
    }, -1);

    return (
        <group>
            <MarcherShadows
                marcherIds={marcherIds}
                marcherRefs={marcherRefs.current}
                mode={preferences.lightingMode}
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                venue={venue}
            />
            {marchers.map((marcher) => {
                const marcherPage = activeMarcherPages[marcher.id];
                if (!marcherPage) return null;

                const appearance = resolveAppearanceFromStack(
                    activeAppearances[marcher.id] ?? [],
                    fieldProperties.theme,
                );
                let motionRef = motionRefs.current.get(marcher.id);
                if (!motionRef) {
                    motionRef = { current: false, legFacing: 0 };
                    motionRefs.current.set(marcher.id, motionRef);
                }
                let marcherRef = marcherRefs.current.get(marcher.id);
                if (!marcherRef) {
                    marcherRef = { current: null };
                    marcherRefs.current.set(marcher.id, marcherRef);
                }

                return (
                    <group
                        key={marcher.id}
                        ref={marcherRef}
                        visible={appearance.visible}
                    >
                        <Marcher3D
                            marcherId={marcher.id}
                            drillNumber={marcher.drill_number}
                            section={marcher.section}
                            color={
                                preferences.uniformColorMode === "override"
                                    ? preferences.uniformColor
                                    : rgbaStringToThreeColor(
                                          appearance.fillRgba,
                                      )
                            }
                            labelVisible={false}
                            uniformStyle={preferences.uniformStyle}
                            motionRef={motionRef}
                            gaitRef={gaitRef.current}
                            playbackActive
                        />
                    </group>
                );
            })}
        </group>
    );
}

interface ExportSceneProps extends Omit<
    CreateThreeDVideoRenderContextArgs,
    "width" | "height" | "directorCameraShots"
> {
    timeRef: ExportTimeRef;
    activePageId: number;
    fieldWidth: number;
    fieldDepth: number;
    venue: ResolvedVenue;
    directorCameraShots: DirectorCameraShot[];
    fallbackCamera: DirectorCameraState;
    onMounted: () => void;
    onFieldImageReady: () => void;
}

function SceneMounted({ onMounted }: { onMounted: () => void }) {
    useLayoutEffect(onMounted, [onMounted]);
    return null;
}

function ExportScene({
    timeRef,
    activePageId,
    fieldProperties,
    sortedPages,
    marchers,
    marcherTimelines,
    marcherAppearancesByPageId,
    fieldImage,
    marcherPages,
    gridLines,
    halfLines,
    viewerPreferences,
    fieldWidth,
    fieldDepth,
    venue,
    directorCameraShots,
    fallbackCamera,
    onMounted,
    onFieldImageReady,
}: ExportSceneProps) {
    const lighting = LIGHTING_THEMES[viewerPreferences.lightingMode];
    const largestDimension = Math.max(fieldWidth, fieldDepth);

    return (
        <>
            <SceneMounted onMounted={onMounted} />
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
                mode={viewerPreferences.lightingMode}
                venue={venue}
            />
            {venue === "outdoor" ? (
                <StadiumEnvironment
                    fieldWidth={fieldWidth}
                    fieldDepth={fieldDepth}
                    lightingMode={viewerPreferences.lightingMode}
                />
            ) : (
                <IndoorArenaEnvironment
                    lightingMode={viewerPreferences.lightingMode}
                />
            )}
            <Field3D
                fieldProperties={fieldProperties}
                showGrid={gridLines}
                showHalfLines={halfLines}
                fieldImage={fieldImage}
                venue={venue}
                onFieldImageReady={onFieldImageReady}
            />
            <ExportMarcherFormation
                timeRef={timeRef}
                activePageId={activePageId}
                marchers={marchers}
                pages={sortedPages}
                marcherPages={marcherPages}
                marcherTimelines={marcherTimelines}
                marcherAppearancesByPageId={marcherAppearancesByPageId}
                fieldProperties={fieldProperties}
                preferences={viewerPreferences}
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                venue={venue}
            />
            <ExportCamera
                timeRef={timeRef}
                shots={directorCameraShots}
                fallback={fallbackCamera}
            />
        </>
    );
}

const waitForSceneAssets = async (
    sceneMounted: Promise<void>,
    fieldImageReady: Promise<void>,
) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
            () =>
                reject(new Error("The 3D export scene took too long to load")),
            ASSET_READY_TIMEOUT_MS,
        );
    });
    try {
        await Promise.race([
            Promise.all([sceneMounted, fieldImageReady]),
            timeout,
        ]);
        // FieldSurfaceImage resolves when it schedules its texture state. Give
        // that state one task to commit before the warm-up renders upload it.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

/**
 * Create an isolated, manually advanced R3F scene for deterministic video
 * export. Nothing is attached to the document and no live playback state is
 * read, so rendering cannot disturb either editor mode.
 */
// eslint-disable-next-line max-lines-per-function
export async function createThreeDVideoRenderContext(
    args: CreateThreeDVideoRenderContextArgs,
): Promise<ThreeDVideoRenderContext> {
    if (args.sortedPages.length === 0)
        throw new Error("The show has no pages to render in 3D");
    if (
        !Number.isFinite(args.width) ||
        !Number.isFinite(args.height) ||
        args.width <= 0 ||
        args.height <= 0
    ) {
        throw new Error("The 3D export needs a positive frame size");
    }
    const fieldError = getField3DValidationError(args.fieldProperties);
    if (fieldError) throw new Error(fieldError);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(args.width);
    canvas.height = Math.round(args.height);
    const root: ReconcilerRoot<HTMLCanvasElement> = createRoot(canvas);
    let store!: RootStore;
    let disposed = false;

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        root.unmount();
        const renderer = store?.getState().gl;
        renderer?.renderLists.dispose();
        renderer?.dispose();
        canvas.width = 1;
        canvas.height = 1;
    };

    try {
        const { width: fieldWidth, depth: fieldDepth } =
            getFieldWorldDimensions(args.fieldProperties);
        const venue = resolveVenue(
            args.viewerPreferences.venue,
            args.fieldProperties,
        );
        const fallbackCamera: DirectorCameraState = {
            ...getCameraPresetConfiguration("pressBox", fieldWidth, fieldDepth),
            rollDegrees: 0,
        };
        const directorCameraShots = sortDirectorCameraShots(
            args.directorCameraShots,
        );
        const largestDimension = Math.max(fieldWidth, fieldDepth);
        const furthestShot = directorCameraShots.reduce(
            (distance, shot) =>
                Math.max(
                    distance,
                    Math.hypot(...shot.position),
                    Math.hypot(...shot.target),
                ),
            0,
        );

        await root.configure({
            size: {
                width: canvas.width,
                height: canvas.height,
                top: 0,
                left: 0,
            },
            dpr: 1,
            frameloop: "never",
            shadows: "percentage",
            gl: {
                antialias: false,
                alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: "high-performance",
            },
            camera: {
                fov: fallbackCamera.fov,
                near: 0.1,
                far: Math.max(100, largestDimension * 20, furthestShot * 4),
                position: fallbackCamera.position,
            },
        });

        let resolveMounted!: () => void;
        const sceneMounted = new Promise<void>((resolve) => {
            resolveMounted = resolve;
        });
        const needsFieldImage = Boolean(
            args.fieldImage &&
            args.fieldProperties.showFieldImage &&
            args.fieldProperties.backgroundImageOpacity > 0,
        );
        let resolveFieldImage!: () => void;
        const fieldImageReady = new Promise<void>((resolve) => {
            resolveFieldImage = resolve;
        });
        if (!needsFieldImage) resolveFieldImage();

        const timeRef: ExportTimeRef = { current: 0 };
        const pages = [...args.sortedPages].sort(
            (first, second) => first.order - second.order,
        );
        let activePageId = getPlaybackPageForTimeMs(pages, 0).id;

        const renderScene = () => (
            <ExportScene
                {...args}
                sortedPages={pages}
                timeRef={timeRef}
                activePageId={activePageId}
                fieldWidth={fieldWidth}
                fieldDepth={fieldDepth}
                venue={venue}
                directorCameraShots={directorCameraShots}
                fallbackCamera={fallbackCamera}
                onMounted={resolveMounted}
                onFieldImageReady={resolveFieldImage}
            />
        );

        flushSync(() => {
            store = root.render(renderScene());
        });
        await waitForSceneAssets(sceneMounted, fieldImageReady);

        const initializedStore = store;
        const renderer = initializedStore.getState().gl;
        const gl = renderer.getContext();
        const maxRenderbufferSize = gl.getParameter(
            gl.MAX_RENDERBUFFER_SIZE,
        ) as number;
        if (
            canvas.width > maxRenderbufferSize ||
            canvas.height > maxRenderbufferSize
        ) {
            throw new Error(
                `This system supports 3D exports up to ${maxRenderbufferSize}px per side`,
            );
        }

        for (let frame = 0; frame < SHADOW_WARMUP_FRAMES; frame += 1) {
            initializedStore.getState().advance(0, false);
        }

        return {
            canvas,
            renderFrame(timeSeconds) {
                const currentStore = store;
                if (disposed)
                    throw new Error(
                        "The 3D export renderer is no longer active",
                    );
                const safeTime = Number.isFinite(timeSeconds)
                    ? Math.max(0, timeSeconds)
                    : 0;
                timeRef.current = safeTime;
                const nextPageId = getPlaybackPageForTimeMs(
                    pages,
                    safeTime * 1000,
                ).id;
                if (nextPageId !== activePageId) {
                    activePageId = nextPageId;
                    flushSync(() => {
                        root.render(renderScene());
                    });
                }
                currentStore.getState().advance(safeTime * 1000, false);
            },
            dispose,
        };
    } catch (error) {
        dispose();
        throw error;
    }
}
