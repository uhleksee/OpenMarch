import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Marcher3D from "./Marcher3D";
import {
    CameraPreset,
    canvasCoordinatesToWorld,
    getCameraPresetConfiguration,
    getFieldWorldDimensions,
    rgbaStringToThreeColor,
} from "./viewer3d.utils";
import { FieldProperties } from "@openmarch/core";
import Marcher from "@/global/classes/Marcher";
import MarcherPage from "@/global/classes/MarcherPage";
import { MarcherTimeline } from "@/utilities/Keyframes";
import { MarcherAppearanceByIdMap } from "@/hooks/queries/useMarcherAppearances";
import LightingRig from "./LightingRig";
import StadiumEnvironment from "./StadiumEnvironment";
import { STORYBOOK_RENDERING, STORYBOOK_THEME } from "./sceneTheme";

const CAMERA_LABELS: Record<CameraPreset, string> = {
    overhead: "Overhead",
    pressBox: "Press box",
    fieldLevel: "Field level",
};

interface CameraRigProps {
    preset: CameraPreset;
    fieldWidth: number;
    fieldDepth: number;
}

function CameraRig({ preset, fieldWidth, fieldDepth }: CameraRigProps) {
    const { camera } = useThree();
    const configuration = useMemo(
        () => getCameraPresetConfiguration(preset, fieldWidth, fieldDepth),
        [fieldDepth, fieldWidth, preset],
    );

    useEffect(() => {
        camera.position.set(...configuration.position);
        camera.lookAt(...configuration.target);
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = configuration.fov;
            camera.near = 0.1;
            camera.far = Math.max(fieldWidth, fieldDepth) * 12;
            camera.updateProjectionMatrix();
        }
    }, [camera, configuration, fieldDepth, fieldWidth]);

    return (
        <OrbitControls
            key={preset}
            makeDefault
            target={configuration.target}
            enablePan
            enableRotate
            enableZoom
            screenSpacePanning
            minDistance={2}
            maxDistance={Math.max(fieldWidth, fieldDepth) * 4}
            maxPolarAngle={Math.PI / 2 - 0.015}
        />
    );
}

interface MarcherFormationProps {
    marchers: Marcher[];
    marcherPages: Record<number, MarcherPage>;
    marcherTimelines: Map<number, MarcherTimeline>;
    marcherAppearances: MarcherAppearanceByIdMap;
    fieldProperties: FieldProperties;
}

function MarcherFormation({
    marchers,
    marcherPages,
    marcherTimelines,
    marcherAppearances,
    fieldProperties,
}: MarcherFormationProps) {
    const marcherRefs = useRef(new Map<number, THREE.Group>());
    const { isPlaying } = useIsPlaying()!;

    const setPausedPositions = useCallback(() => {
        for (const marcher of marchers) {
            const marcherPage = marcherPages[marcher.id];
            const marcherGroup = marcherRefs.current.get(marcher.id);
            if (!marcherPage || !marcherGroup) continue;
            marcherGroup.position.set(
                ...canvasCoordinatesToWorld(marcherPage, fieldProperties),
            );
        }
    }, [fieldProperties, marcherPages, marchers]);

    useEffect(() => {
        if (!isPlaying) setPausedPositions();
    }, [isPlaying, setPausedPositions]);

    useFrame(() => {
        if (!isPlaying) return;
        const currentTime = getLivePlaybackPosition() * 1000;

        for (const marcher of marchers) {
            const marcherGroup = marcherRefs.current.get(marcher.id);
            const timeline = marcherTimelines.get(marcher.id);
            if (!marcherGroup || !timeline) continue;

            try {
                const coordinate = getCoordinatesAtTime(currentTime, timeline);
                if (!coordinate) continue;
                marcherGroup.position.set(
                    ...canvasCoordinatesToWorld(coordinate, fieldProperties),
                );
            } catch {
                // A neighboring page query may still be loading at this frame.
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

                return (
                    <group
                        key={marcher.id}
                        ref={(node) => {
                            if (node) marcherRefs.current.set(marcher.id, node);
                            else marcherRefs.current.delete(marcher.id);
                        }}
                        position={canvasCoordinatesToWorld(
                            marcherPage,
                            fieldProperties,
                        )}
                        rotation={[
                            0,
                            THREE.MathUtils.degToRad(
                                -marcherPage.rotation_degrees,
                            ),
                            0,
                        ]}
                        visible={appearance.visible}
                    >
                        <Marcher3D
                            marcherId={marcher.id}
                            drillNumber={marcher.drill_number}
                            color={rgbaStringToThreeColor(appearance.fillRgba)}
                            labelVisible={appearance.textVisible}
                        />
                    </group>
                );
            })}
        </group>
    );
}

export default function ThreeDViewer() {
    const [cameraPreset, setCameraPreset] = useState<CameraPreset>("pressBox");
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
    const nearbyPages = useMemo(
        () =>
            selectedPage
                ? pages.filter(
                      (page) => Math.abs(page.order - selectedPage.order) <= 2,
                  )
                : [],
        [pages, selectedPage],
    );
    const { data: marcherTimelines } = useManyCoordinateData(nearbyPages);

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
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false }}
                camera={{ fov: 43 }}
            >
                <fog
                    attach="fog"
                    args={[
                        STORYBOOK_THEME.skyHorizon,
                        width * STORYBOOK_RENDERING.fogNearFactor,
                        width * STORYBOOK_RENDERING.fogFarFactor,
                    ]}
                />
                <LightingRig fieldWidth={width} fieldDepth={depth} />
                <StadiumEnvironment fieldWidth={width} fieldDepth={depth} />
                <Field3D
                    fieldProperties={fieldProperties}
                    showGrid={uiSettings.gridLines}
                    showHalfLines={uiSettings.halfLines}
                />
                <MarcherFormation
                    marchers={marchers}
                    marcherPages={marcherPages}
                    marcherTimelines={marcherTimelines}
                    marcherAppearances={marcherAppearances}
                    fieldProperties={fieldProperties}
                />
                <CameraRig
                    preset={cameraPreset}
                    fieldWidth={width}
                    fieldDepth={depth}
                />
            </ThreeCanvas>

            <div
                className="border-stroke bg-bg-1/90 absolute top-6 right-6 z-10 flex gap-2 rounded-lg border p-2 shadow-lg backdrop-blur-sm"
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

            <p className="bg-bg-1/80 text-text/80 pointer-events-none absolute bottom-6 left-6 rounded-md px-8 py-4 text-xs backdrop-blur-sm">
                Drag to orbit · right-drag to pan · scroll to zoom
            </p>
        </div>
    );
}
