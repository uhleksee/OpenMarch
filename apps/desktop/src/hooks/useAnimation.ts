import { useCallback, useEffect, useMemo, useRef } from "react";
import { useIsPlaying } from "@/context/IsPlayingContext";
import OpenMarchCanvas from "@/global/classes/canvasObjects/OpenMarchCanvas";
import { getCoordinatesAtTime } from "@/utilities/Keyframes";
import { getLivePlaybackPosition } from "@/components/timeline/audio/AudioPlayer";
import { useTimingObjects } from "@/hooks";
import { useSelectedPage } from "@/context/SelectedPageContext";
import { useCollisionStore } from "@/stores/CollisionStore";
import { useManyCoordinateData } from "./queries/useCoordinateData";
import Page from "@/global/classes/Page";
import { usePerformanceDiagnosticsStore } from "@/stores/PerformanceDiagnosticsStore";
import { usePlaybackPageStore } from "@/stores/PlaybackPageStore";

interface UseAnimationProps {
    canvas: OpenMarchCanvas | null;
    renderCanvas?: boolean;
}

// eslint-disable-next-line max-lines-per-function
export const useAnimation = ({
    canvas,
    renderCanvas = true,
}: UseAnimationProps) => {
    const { pages } = useTimingObjects()!;
    const pagesById: Record<number, Page> = useMemo(() => {
        return pages.reduce(
            (acc, page) => {
                acc[page.id] = page;
                return acc;
            },
            {} as Record<number, Page>,
        );
    }, [pages]);
    const { setSelectedPage, selectedPage } = useSelectedPage()!;
    const selectedPageRef = useRef(selectedPage);
    const { isPlaying, setIsPlaying } = useIsPlaying()!;
    const { collisions: pageCollisions, setCurrentCollision } =
        useCollisionStore();
    const diagnosticsEnabled = usePerformanceDiagnosticsStore(
        (state) => state.enabled,
    );
    const diagnosticPageFreeze = usePerformanceDiagnosticsStore(
        (state) => state.freezePageUpdates,
    );
    const freezePageUpdates = diagnosticsEnabled && diagnosticPageFreeze;

    // The number of pages +/- to fetch
    const PAGE_DELTA = 2;
    const renderedPage = renderCanvas ? selectedPage : null;
    const animationPages = useMemo(
        () =>
            renderedPage
                ? isPlaying || freezePageUpdates
                    ? pages
                    : pages.filter(
                          (p) =>
                              Math.abs(p.order - renderedPage.order) <=
                              PAGE_DELTA,
                      )
                : [],
        [freezePageUpdates, isPlaying, pages, renderedPage],
    );
    const { data: marcherTimelines } = useManyCoordinateData(animationPages);

    const animationFrameRef = useRef<number | null>(null);
    const wasPlayingRef = useRef(false);

    useEffect(() => {
        selectedPageRef.current = selectedPage;
    }, [selectedPage]);

    // Playback has its own tiny page signal so page highlighting can advance
    // without refreshing every selected-page consumer in the editor.
    useEffect(() => {
        const playbackStore = usePlaybackPageStore.getState();

        if (isPlaying) {
            if (!wasPlayingRef.current) {
                playbackStore.setPendingSelectionSyncPageId(null);
                if (!freezePageUpdates) {
                    playbackStore.setPlaybackPageId(
                        selectedPageRef.current?.id ?? null,
                    );
                }
            }
            wasPlayingRef.current = true;
            return;
        }

        if (!wasPlayingRef.current) return;
        wasPlayingRef.current = false;

        const playbackPageId = playbackStore.playbackPageId;
        const playbackPage = playbackPageId ? pagesById[playbackPageId] : null;
        if (playbackPage && playbackPage.id !== selectedPageRef.current?.id) {
            playbackStore.setPendingSelectionSyncPageId(playbackPage.id);
            setSelectedPage(playbackPage);
        }
    }, [freezePageUpdates, isPlaying, pagesById, setSelectedPage]);

    // const marcherTimelines = useMemo(() => {
    //     if (
    //         // !midsetsLoaded ||
    //         !marcherPagesLoaded ||
    //         // midsets == null ||
    //         marcherPages == null
    //     ) {
    //         // console.debug("not loading timeline");
    //         // console.debug("midsetsLoaded", midsetsLoaded);
    //         // console.debug("midsets", midsets);
    //         // console.debug("marcherPagesLoaded", marcherPagesLoaded);
    //         // console.debug("marcherPages", marcherPages);
    //         return new Map<number, MarcherTimeline>();
    //     }

    //     const pagesMap = pages.reduce(
    //         (acc, page) => {
    //             acc[page.id] = page;
    //             return acc;
    //         },
    //         {} as Record<number, Page>,
    //     );

    //     // Organize midsets by marcher page ID for efficient lookup
    //     // const midsetsByMarcherPage = midsets.reduce(
    //     //     (acc: Record<number, Midset[]>, midset: Midset) => {
    //     //         if (!acc[midset.mp_id]) {
    //     //             acc[midset.mp_id] = [];
    //     //         }
    //     //         acc[midset.mp_id].push(midset);
    //     //         return acc;
    //     //     },
    //     //     {} as Record<number, Midset[]>,
    //     // );

    //     const timelines = new Map<number, MarcherTimeline>();
    //     if (!marchers.length || !pages.length) return timelines;

    //     for (const marcher of marchers) {
    //         const coordinateMap = new Map<number, CoordinateDefinition>();
    //         const marcherPagesForMarcher = getByMarcherId(
    //             marcherPages,
    //             marcher.id,
    //         );

    //         for (const marcherPage of marcherPagesForMarcher) {
    //             const page = pagesMap[marcherPage.page_id];
    //             if (page) {
    //                 // // Get midsets for this marcher page
    //                 // const midsetsForMarcherPage =
    //                 //     midsetsByMarcherPage[marcherPage.id] || [];

    //                 // Add the marcher page position as the base coordinate
    //                 coordinateMap.set((page.timestamp + page.duration) * 1000, {
    //                     x: marcherPage.x,
    //                     y: marcherPage.y,
    //                     path: marcherPage.path_data || undefined,
    //                     previousPathPosition:
    //                         marcherPage.path_start_position || 0,
    //                     nextPathPosition: marcherPage.path_end_position || 1,
    //                 });

    //                 // // Add midset positions at their progress placements
    //                 // for (const midset of midsetsForMarcherPage) {
    //                 //     const progressTime =
    //                 //         page.timestamp +
    //                 //         page.duration * midset.progress_placement;
    //                 //     coordinateMap.set(progressTime, {
    //                 //         x: midset.x,
    //                 //         y: midset.y,
    //                 //         path: midset.path_data || undefined,
    //                 //     });
    //                 // }
    //             }
    //         }

    //         const sortedTimestamps = Array.from(coordinateMap.keys()).sort(
    //             (a, b) => a - b,
    //         );
    //         timelines.set(marcher.id, {
    //             pathMap: coordinateMap,
    //             sortedTimestamps,
    //         });
    //     }
    //     return timelines;
    // }, [marcherPagesLoaded, marcherPages, pages, marchers]);

    // Incremental collision calculation with caching
    // TODO - make collisions a query and put this back
    // useEffect(() => {
    //     setCollisions(marchers, marcherTimelines, pages, marcherPages);
    // }, [marchers, marcherTimelines, pages, marcherPages]);

    // Get collisions for the currently selected page
    const getCollisionsForSelectedPage = useCallback(() => {
        if (!selectedPage) return [];
        const collisions = selectedPage.nextPageId
            ? pageCollisions.get(selectedPage.nextPageId)
            : [];
        return collisions ?? [];
    }, [pageCollisions, selectedPage]);

    // Update collisions when selected page changes
    useEffect(() => {
        setCurrentCollision(selectedPage);
    }, [selectedPage, getCollisionsForSelectedPage, setCurrentCollision]);

    // Set marcher positions at a specific time
    const setMarcherPositionsAtTime = useCallback(
        (timeMilliseconds: number) => {
            if (!canvas) return;
            let output = true;

            const canvasMarchers = canvas.getCanvasMarchers();
            for (const canvasMarcher of canvasMarchers) {
                const timeline = marcherTimelines.get(
                    canvasMarcher.marcherObj.id,
                );

                if (timeline) {
                    // try {
                    const coords = getCoordinatesAtTime(
                        timeMilliseconds,
                        timeline,
                    );
                    if (!coords) output = false;
                    else canvasMarcher.setLiveCoordinates(coords);
                } else {
                    console.debug(
                        `Marcher ${canvasMarcher.marcherObj.id} has no timeline at time ${timeMilliseconds}`,
                    );
                    output = false;
                }
            }

            canvas.requestRenderAll();
            return output;
        },
        [canvas, marcherTimelines],
    );

    // Update the lightweight playback page based on the audio timestamp.
    const updatePlaybackPage = useCallback(
        (currentTime: number) => {
            if (!pages.length) return;

            const currentPage = pages.find((p) => {
                const nextPage = p.nextPageId ? pagesById[p.nextPageId] : null;
                if (nextPage == null) return false;
                return (
                    currentTime >= (p.timestamp + p.duration) * 1000 &&
                    currentTime <
                        (nextPage.timestamp + nextPage.duration) * 1000
                );
            });
            if (!currentPage) {
                // We're past the end. The full editor selection synchronizes
                // after playback stops, outside the animation loop.
                const lastPage = pages[pages.length - 1];
                if (!freezePageUpdates) {
                    usePlaybackPageStore
                        .getState()
                        .setPlaybackPageId(lastPage.id);
                }
                setIsPlaying(false);
            } else if (!freezePageUpdates) {
                usePlaybackPageStore
                    .getState()
                    .setPlaybackPageId(currentPage.id);
            }
        },
        [freezePageUpdates, pages, pagesById, setIsPlaying],
    );

    // Animate the canvas based on playback timestamp
    useEffect(() => {
        // Helper to sync the animation with the live playback position
        const animate = () => {
            if (!canvas) return;

            try {
                const currentTime = getLivePlaybackPosition() * 1000; // s to ms
                const continueAnimation = renderCanvas
                    ? setMarcherPositionsAtTime(currentTime)
                    : true;
                updatePlaybackPage(currentTime);
                animationFrameRef.current = requestAnimationFrame(animate);
                if (!continueAnimation) setIsPlaying(false);
            } catch (e) {
                console.error(e);
                setIsPlaying(false);
            }
        };

        // Start the animation loop
        if (isPlaying) {
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }

        // Cleanup
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [
        isPlaying,
        canvas,
        setMarcherPositionsAtTime,
        updatePlaybackPage,
        marcherTimelines,
        renderCanvas,
        setIsPlaying,
    ]);

    return {
        setMarcherPositionsAtTime,
        _selectedPage: selectedPage,
        _isPlaying: isPlaying,
        _setIsPlaying: setIsPlaying,
    };
};
