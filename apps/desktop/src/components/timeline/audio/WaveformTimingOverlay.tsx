import React, {
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import type Beat from "@/global/classes/Beat";
import type Measure from "@/global/classes/Measure";
import clsx from "clsx";
import BeatOrMeasureContextMenu from "./BeatOrMeasureContextMenu";
import { FIRST_BEAT_ID } from "@/db-functions";

interface WaveformTimingOverlayProps {
    beats: Beat[];
    measures: Measure[];
    beatIdsOnPages: Set<number>;
    duration: number;
    pixelsPerSecond: number;
    height: number;
    width: number;
}

interface VisibleRange {
    start: number;
    end: number;
}

const BEAT_HEIGHT_RATIO = 0.35;
const VIEWPORT_OVERSCAN = 1.5;
const VIEWPORT_GUARD = 0.35;

const hasRehearsalMark = (measure: Measure) =>
    !!measure.rehearsalMark && measure.rehearsalMark.trim().length > 0;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

interface RenderedPixelRange {
    start: number;
    end: number;
    overlayContentLeft: number;
    viewportWidth: number;
}

export default function WaveformTimingOverlay({
    beats,
    measures,
    beatIdsOnPages,
    duration,
    pixelsPerSecond,
    height,
    width,
}: WaveformTimingOverlayProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const renderedPixelRangeRef = useRef<RenderedPixelRange | null>(null);
    const [visibleRange, setVisibleRange] = useState<VisibleRange>({
        start: 0,
        end: duration,
    });
    const beatIdsWithMeasures = useMemo(() => {
        return new Set(measures.map((measure) => measure.startBeat.id));
    }, [measures]);

    const pxPerSecond = useMemo(
        () => (pixelsPerSecond > 0 ? pixelsPerSecond : 0),
        [pixelsPerSecond],
    );

    const beatMarkerHeight = Math.max(height * BEAT_HEIGHT_RATIO, 12);

    const updateVisibleRange = useCallback(() => {
        if (!overlayRef.current || pxPerSecond <= 0 || width <= 0) return;

        const container = document.getElementById("timeline");
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const overlayRect = overlayRef.current.getBoundingClientRect();

        const visibleLeft = Math.max(containerRect.left, overlayRect.left);
        const visibleRight = Math.min(containerRect.right, overlayRect.right);

        if (visibleRight <= visibleLeft) {
            setVisibleRange({ start: 0, end: 0 });
            return;
        }

        const viewWidth = visibleRight - visibleLeft;
        const visibleStartPx = clamp(visibleLeft - overlayRect.left, 0, width);
        const visibleEndPx = clamp(visibleStartPx + viewWidth, 0, width);
        const overscanPx = viewWidth * VIEWPORT_OVERSCAN;
        const startPx = clamp(visibleStartPx - overscanPx, 0, width);
        const endPx = clamp(visibleEndPx + overscanPx, 0, width);

        renderedPixelRangeRef.current = {
            start: startPx,
            end: endPx,
            overlayContentLeft:
                overlayRect.left - containerRect.left + container.scrollLeft,
            viewportWidth: containerRect.width,
        };

        const newRange: VisibleRange = {
            start: clamp(startPx / pxPerSecond, 0, duration),
            end: clamp(endPx / pxPerSecond, 0, duration),
        };

        startTransition(() => {
            setVisibleRange((prev) =>
                prev.start === newRange.start && prev.end === newRange.end
                    ? prev
                    : newRange,
            );
        });
    }, [duration, pxPerSecond, width]);

    useEffect(() => {
        if (!duration) {
            setVisibleRange({ start: 0, end: 0 });
            return;
        }
        setVisibleRange((prev) =>
            prev.end === duration ? prev : { start: 0, end: duration },
        );
    }, [duration]);

    useEffect(() => {
        if (pxPerSecond <= 0 || width <= 0) return;

        const container = document.getElementById("timeline");
        if (!container) return;

        let rangeUpdateFrame = 0;

        const scheduleRangeUpdate = () => {
            if (rangeUpdateFrame) return;
            rangeUpdateFrame = requestAnimationFrame(() => {
                rangeUpdateFrame = 0;
                updateVisibleRange();
            });
        };

        const handleScroll = () => {
            const renderedRange = renderedPixelRangeRef.current;
            if (!renderedRange) return;

            // The ordinary playback scroll remains entirely inside the
            // buffered marker window, so it does no React or layout work.
            // A large manual jump refreshes only when it approaches an edge.
            const viewportStart =
                container.scrollLeft - renderedRange.overlayContentLeft;
            const viewportEnd = viewportStart + renderedRange.viewportWidth;
            const guard = renderedRange.viewportWidth * VIEWPORT_GUARD;
            const hasLeftBuffer =
                renderedRange.start <= 0 ||
                viewportStart >= renderedRange.start + guard;
            const hasRightBuffer =
                renderedRange.end >= width ||
                viewportEnd <= renderedRange.end - guard;

            if (!hasLeftBuffer || !hasRightBuffer) scheduleRangeUpdate();
        };
        const handleResize = () => updateVisibleRange();

        container.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleResize);

        // Initial calculation to sync with current viewport
        handleResize();

        return () => {
            container.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(rangeUpdateFrame);
        };
    }, [pxPerSecond, updateVisibleRange, width]);

    const visibleMeasures: { measure: Measure; beat: Beat }[] = useMemo(() => {
        if (pxPerSecond <= 0) return [];
        return measures
            .filter((measure) => {
                const start = measure.timestamp;
                const end = measure.timestamp + measure.duration;
                return end >= visibleRange.start && start <= visibleRange.end;
            })
            .map((measure) => ({ measure, beat: measure.beats[0] }));
    }, [measures, visibleRange, pxPerSecond]);

    const visibleBeats = useMemo(() => {
        if (pxPerSecond <= 0) return [];
        return beats.filter(
            (beat) =>
                beat.timestamp >= visibleRange.start &&
                beat.timestamp <= visibleRange.end &&
                !beatIdsWithMeasures.has(beat.id),
        );
    }, [
        pxPerSecond,
        beats,
        visibleRange.start,
        visibleRange.end,
        beatIdsWithMeasures,
    ]);

    if (pxPerSecond <= 0 || width <= 0 || height <= 0) {
        return null;
    }

    return (
        <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 z-20 h-full"
            style={{ height }}
        >
            <div className="relative h-full" style={{ width }}>
                {visibleMeasures.map(({ measure, beat }) => {
                    const x = measure.timestamp * pxPerSecond;
                    const isRehearsalMark = hasRehearsalMark(measure);
                    const label = isRehearsalMark
                        ? measure.rehearsalMark!.trim()
                        : measure.number.toString();

                    return (
                        <React.Fragment key={`measure-${measure.id}`}>
                            <BeatOrMeasureContextMenu
                                beat={beat}
                                beatIdsOnPages={beatIdsOnPages}
                                measure={measure}
                            >
                                <div
                                    className={clsx(
                                        "hover:bg-accent pointer-events-auto absolute top-0 bottom-0 -translate-x-1/2 cursor-pointer rounded-full",
                                        isRehearsalMark
                                            ? "w-2 bg-[var(--color-accent)] hover:w-8"
                                            : "w-1 bg-[rgb(180,180,180)] hover:w-4 dark:bg-[rgb(90,90,90)]",
                                    )}
                                    style={{
                                        left: x,
                                    }}
                                />
                            </BeatOrMeasureContextMenu>
                            <div
                                className="absolute top-0 font-mono whitespace-nowrap"
                                style={{ left: x }}
                            >
                                <span
                                    className={clsx(
                                        "border-stroke bg-modal rounded-4 border px-3",
                                        isRehearsalMark
                                            ? "text-accent text-lg"
                                            : "text-text-subtitle text-sm",
                                    )}
                                >
                                    {label}
                                </span>
                            </div>
                        </React.Fragment>
                    );
                })}

                {visibleBeats.map((beat) => {
                    if (beat.id === FIRST_BEAT_ID) return undefined;
                    const x = beat.timestamp * pxPerSecond;
                    return (
                        <BeatOrMeasureContextMenu
                            beat={beat}
                            beatIdsOnPages={beatIdsOnPages}
                            measure={null}
                            key={`beat-${beat.id}`}
                        >
                            <div
                                key={`beat-${beat.id}`}
                                className="hover:bg-accent pointer-events-auto absolute w-1 -translate-x-1/2 cursor-pointer rounded-full bg-[rgb(205,205,205)] hover:w-4 dark:bg-[rgb(60,60,60)]"
                                style={{
                                    left: x,
                                    top: 0,
                                    height: beatMarkerHeight,
                                }}
                            />
                        </BeatOrMeasureContextMenu>
                    );
                })}
            </div>
        </div>
    );
}
