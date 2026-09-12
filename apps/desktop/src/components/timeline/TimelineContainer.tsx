import { useIsPlaying } from "@/context/IsPlayingContext";
import { useSelectedPage } from "@/context/SelectedPageContext";
import { useEffect, useRef } from "react";
import {
    XIcon,
    PencilSimpleIcon,
    PlusIcon,
    MinusIcon,
} from "@phosphor-icons/react";
import { defaultSettings, useUiSettingsStore } from "@/stores/UiSettingsStore";
import { useTimingObjects } from "@/hooks";
import AudioPlayer from "./audio/AudioPlayer";
import RegisteredActionButton from "../RegisteredActionButton";
import { RegisteredActionsObjects } from "@/utilities/RegisteredActionsHandler";
import EditableAudioPlayer from "./audio/EditableAudioPlayer";
import TimelineControls from "./TimelineControls";
import { useFullscreenStore } from "@/stores/FullscreenStore";
import PerspectiveSlider from "./PerspectiveSlider";
import PageTimeline from "./PageTimeline";
import { T } from "@tolgee/react";
import clsx from "clsx";
import { usePlaybackPageStore } from "@/stores/PlaybackPageStore";

export default function TimelineContainer() {
    const { isPlaying } = useIsPlaying()!;
    const { measures, pages } = useTimingObjects()!;
    const { selectedPage } = useSelectedPage()!;
    const { uiSettings } = useUiSettingsStore();
    const { isFullscreen } = useFullscreenStore();
    const timelineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isPlaying || !selectedPage) return;

        const container = timelineRef.current;
        const selectedPageElement = document.querySelector(
            `[timeline-page-id="${selectedPage.id}"]`,
        );

        if (!container || !selectedPageElement) return;

        // Manual page changes should feel immediate. Playback has its own
        // smooth-follow path below, so using smooth scrolling here only adds a
        // browser-controlled delay after a click.
        container.style.scrollBehavior = "auto";
        selectedPageElement.scrollIntoView({
            block: "nearest",
            inline: "center",
            behavior: "auto",
        });

        return () => {
            container.style.scrollBehavior = "";
            container.style.transition = "";
        };
    }, [selectedPage, isPlaying]);

    useEffect(() => {
        if (!isPlaying) return;

        let updateFrame = 0;
        let scrollFrame = 0;
        let scrollDelay = 0;
        let activeHighlight: HTMLElement | null = null;
        let activeProgress: HTMLElement | null = null;
        const timeline = timelineRef.current;
        const timelineRect = timeline?.getBoundingClientRect();
        const pageElements = new Map<
            number,
            {
                highlight: HTMLElement | null;
                progress: HTMLElement | null;
                destinationDuration: number | null;
                scrollLeft: number | null;
            }
        >();

        pages.forEach((page, pageIndex) => {
            const container = document.querySelector(
                `[timeline-page-id="${page.id}"]`,
            );
            const highlight = container?.matches("[data-page-highlight]")
                ? container
                : container?.querySelector("[data-page-highlight]");
            const destination = pages[pageIndex + 1];
            const destinationContainer = destination
                ? document.querySelector(
                      `[timeline-page-id="${destination.id}"]`,
                  )
                : null;
            const progress = destinationContainer?.querySelector(
                "[data-playback-progress]",
            );
            const containerRect =
                container instanceof HTMLElement
                    ? container.getBoundingClientRect()
                    : null;
            pageElements.set(page.id, {
                highlight: highlight instanceof HTMLElement ? highlight : null,
                progress: progress instanceof HTMLElement ? progress : null,
                destinationDuration: destination?.duration ?? null,
                scrollLeft:
                    timeline && timelineRect && containerRect
                        ? containerRect.left +
                          timeline.scrollLeft -
                          timelineRect.left -
                          (timelineRect.width - containerRect.width) / 2
                        : null,
            });
        });

        const clearPlaybackDecorations = () => {
            if (activeHighlight) {
                activeHighlight.dataset.playbackActive = "false";
                activeHighlight.classList.remove("border-accent");
                activeHighlight.classList.add("border-stroke");
                activeHighlight = null;
            }

            if (activeProgress) {
                activeProgress.dataset.playbackProgressActive = "false";
                activeProgress.classList.add("invisible");
                activeProgress.getAnimations().forEach((animation) => {
                    animation.cancel();
                });
                activeProgress.style.transform = "";
                activeProgress = null;
            }
        };

        const showPlaybackPage = (pageId: number | null) => {
            clearPlaybackDecorations();
            if (pageId == null) return;

            const elements = pageElements.get(pageId);
            if (!elements) return;

            if (elements.highlight) {
                activeHighlight = elements.highlight;
                activeHighlight.dataset.playbackActive = "true";
                activeHighlight.classList.remove("border-stroke");
                activeHighlight.classList.add("border-accent");
            }

            if (elements.progress && elements.destinationDuration != null) {
                activeProgress = elements.progress;
                activeProgress.dataset.playbackProgressActive = "true";
                activeProgress.classList.remove("invisible");
                activeProgress.animate(
                    [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
                    {
                        duration: elements.destinationDuration * 1000,
                        easing: "linear",
                        fill: "forwards",
                    },
                );
            }

            if (timeline && elements.scrollLeft != null) {
                window.clearTimeout(scrollDelay);
                cancelAnimationFrame(scrollFrame);
                scrollDelay = window.setTimeout(() => {
                    scrollFrame = requestAnimationFrame(() => {
                        timeline.scrollTo({
                            left: elements.scrollLeft ?? 0,
                            behavior: "smooth",
                        });
                    });
                }, 72);
            }
        };

        const schedulePlaybackPage = (pageId: number | null) => {
            cancelAnimationFrame(updateFrame);
            updateFrame = requestAnimationFrame(() => showPlaybackPage(pageId));
        };

        const unsubscribe = usePlaybackPageStore.subscribe(
            (state, previousState) => {
                if (state.playbackPageId !== previousState.playbackPageId) {
                    schedulePlaybackPage(state.playbackPageId);
                }
            },
        );
        schedulePlaybackPage(usePlaybackPageStore.getState().playbackPageId);

        return () => {
            unsubscribe();
            cancelAnimationFrame(updateFrame);
            cancelAnimationFrame(scrollFrame);
            window.clearTimeout(scrollDelay);
            clearPlaybackDecorations();
        };
    }, [isPlaying, pages, uiSettings.timelinePixelsPerSecond]);

    // Rerender the timeline when the measures or pages change
    useEffect(() => {
        // do nothing, just re-render
    }, [measures]);

    return (
        <div className="flex gap-8">
            {uiSettings.focussedComponent !== "timeline" && (
                <TimelineControls />
            )}
            {isFullscreen && <PerspectiveSlider />}
            <div
                ref={timelineRef}
                id="timeline"
                className="rounded-6 border-stroke bg-fg-1 relative flex h-full w-full min-w-0 overflow-x-auto overflow-y-hidden border p-8 transition-all duration-200"
            >
                <div className="flex h-full min-h-0 w-fit flex-col justify-center gap-8">
                    <div className="flex h-fit items-center">
                        <div>
                            <p className="text-sub w-[4rem]">
                                <T keyName="timeline.pages" />
                            </p>
                        </div>
                        <PageTimeline />
                    </div>

                    <div className={"flex items-center"}>
                        {!isFullscreen && (
                            <div className="flex w-[4rem] gap-6">
                                <p className="text-sub">
                                    <T keyName="timeline.audio" />
                                </p>
                                {uiSettings.focussedComponent !== "timeline" ? (
                                    <RegisteredActionButton
                                        registeredAction={
                                            RegisteredActionsObjects.focusTimeline
                                        }
                                        className="w-fit"
                                    >
                                        <PencilSimpleIcon />
                                    </RegisteredActionButton>
                                ) : (
                                    <RegisteredActionButton
                                        registeredAction={
                                            RegisteredActionsObjects.focusCanvas
                                        }
                                        className="w-fit"
                                    >
                                        <XIcon />
                                    </RegisteredActionButton>
                                )}
                            </div>
                        )}

                        {uiSettings.focussedComponent === "timeline" ? (
                            <EditableAudioPlayer />
                        ) : (
                            <div
                                style={{
                                    display: isFullscreen ? "none" : "flex",
                                }}
                            >
                                <AudioPlayer />
                            </div>
                        )}
                    </div>
                </div>
                <TimelineZoomControls />
            </div>
        </div>
    );
}

const TIMELINE_MIN_PX_PER_SEC = 10;
const TIMELINE_MAX_PX_PER_SEC = 200;
const TIMELINE_BASE_PX_PER_SEC = defaultSettings.timelinePixelsPerSecond;

function TimelineZoomControls() {
    const { uiSettings, setPixelsPerSecond } = useUiSettingsStore();
    const { isFullscreen } = useFullscreenStore();
    const currentPixels = uiSettings.timelinePixelsPerSecond;
    const zoomPercent = Math.round(
        (currentPixels / TIMELINE_BASE_PX_PER_SEC) * 100,
    );

    const handleZoomOut = () => {
        if (currentPixels <= TIMELINE_MIN_PX_PER_SEC) return;
        const nextValue = Math.max(
            currentPixels * 0.8,
            TIMELINE_MIN_PX_PER_SEC,
        );
        setPixelsPerSecond(nextValue);
    };

    const handleZoomIn = () => {
        if (currentPixels >= TIMELINE_MAX_PX_PER_SEC) return;
        const nextValue = Math.min(
            currentPixels * 1.2,
            TIMELINE_MAX_PX_PER_SEC,
        );
        setPixelsPerSecond(nextValue);
    };

    const handleReset = () => {
        if (currentPixels === TIMELINE_BASE_PX_PER_SEC) return;
        setPixelsPerSecond(TIMELINE_BASE_PX_PER_SEC);
    };

    return (
        <div
            className={clsx(
                { "right-290": !isFullscreen },
                "border-stroke bg-modal fixed right-16 bottom-16 z-50 flex w-96 items-stretch justify-between overflow-hidden rounded-lg border shadow-lg",
            )}
        >
            <button
                onClick={handleZoomOut}
                className="border-stroke text-text flex w-full items-center justify-center border-l p-2 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPixels <= TIMELINE_MIN_PX_PER_SEC}
                title="Zoom out"
            >
                <MinusIcon size={14} weight="bold" />
            </button>
            <button
                onClick={handleReset}
                className="border-stroke bg-fg-2 text-text text-sub flex h-full w-full items-center justify-center border-r border-l px-3 py-2 font-mono transition-colors duration-150 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPixels === TIMELINE_BASE_PX_PER_SEC}
                title="Reset timeline zoom"
            >
                {zoomPercent}%
            </button>
            <button
                onClick={handleZoomIn}
                className="border-stroke text-text flex w-full items-center justify-center border-l p-2 transition-colors duration-150 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentPixels >= TIMELINE_MAX_PX_PER_SEC}
                title="Zoom in"
            >
                <PlusIcon size={14} weight="bold" />
            </button>
        </div>
    );
}
