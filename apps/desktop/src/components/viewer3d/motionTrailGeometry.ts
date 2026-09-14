import type { FieldProperties, IPath } from "@openmarch/core";
import type {
    CoordinateDefinition,
    MarcherTimeline,
} from "@/utilities/Keyframes";
import {
    canvasCoordinatesToWorld,
    PIXELS_PER_WORLD_UNIT,
} from "./viewer3d.utils";

export const MOTION_TRAIL_Y = 0.09;
export const MAX_MOTION_TRAIL_MARCHERS = 96;
export const MAX_MOTION_TRAIL_SEGMENTS = 65_536;
export const MAX_MOTION_TRAIL_SEGMENTS_PER_MARCHER = 1_024;

const MAX_CURVE_SEGMENTS_PER_INTERVAL = 32;
const CURVE_SAMPLE_SPACING_WORLD = 0.5;
const POSITION_EPSILON_SQUARED = 0.000_001;
const motionTrailPathLengthCache = new WeakMap<IPath, number | null>();

export interface MotionTrailGeometryData {
    /** Pairs of xyz vertices, ready for a single THREE.LineSegments geometry. */
    positions: Float32Array;
    /** Playback time in seconds for each corresponding position vertex. */
    times: Float32Array;
    segmentCount: number;
    marcherCount: number;
}

export interface BuildMotionTrailGeometryOptions {
    maxMarchers?: number;
    maxSegments?: number;
    maxSegmentsPerMarcher?: number;
    curveSampleSpacingWorld?: number;
    y?: number;
}

interface TrailPoint {
    x: number;
    z: number;
    timeSeconds: number;
}

interface TrailInterval {
    startTimestamp: number;
    endTimestamp: number;
    start: CoordinateDefinition;
    end: CoordinateDefinition;
    pathLength: number | null;
    pathStart: number;
    pathEnd: number;
    desiredSegments: number;
}

const finitePositiveInteger = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) && (value ?? 0) > 0
        ? Math.max(1, Math.floor(value!))
        : fallback;

const finitePositive = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) && (value ?? 0) > 0 ? value! : fallback;

const coordinateIsFinite = (
    coordinate: CoordinateDefinition | undefined,
): coordinate is CoordinateDefinition =>
    coordinate != null &&
    Number.isFinite(coordinate.x) &&
    Number.isFinite(coordinate.y);

const coordinateDistanceSquared = (
    a: Pick<CoordinateDefinition, "x" | "y">,
    b: Pick<CoordinateDefinition, "x" | "y">,
) => {
    const x = b.x - a.x;
    const y = b.y - a.y;
    return x * x + y * y;
};

const getSafePathLength = (coordinate: CoordinateDefinition): number | null => {
    if (!coordinate.path) return null;
    const cachedLength = motionTrailPathLengthCache.get(coordinate.path);
    if (cachedLength !== undefined) return cachedLength;

    try {
        const length = coordinate.path.getTotalLength();
        const safeLength =
            Number.isFinite(length) && length > 0 ? length : null;
        motionTrailPathLengthCache.set(coordinate.path, safeLength);
        return safeLength;
    } catch {
        motionTrailPathLengthCache.set(coordinate.path, null);
        return null;
    }
};

const finitePathPosition = (value: number | undefined, fallback: number) =>
    Number.isFinite(value) ? value! : fallback;

const buildIntervals = (
    timeline: MarcherTimeline,
    curveSampleSpacingWorld: number,
): TrailInterval[] => {
    const timestamps = [...new Set(timeline.sortedTimestamps)]
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const intervals: TrailInterval[] = [];

    for (let index = 0; index < timestamps.length - 1; index += 1) {
        const startTimestamp = timestamps[index]!;
        const endTimestamp = timestamps[index + 1]!;
        if (endTimestamp <= startTimestamp) continue;

        const start = timeline.pathMap.get(startTimestamp);
        const end = timeline.pathMap.get(endTimestamp);
        if (!coordinateIsFinite(start) || !coordinateIsFinite(end)) continue;

        const pathLength = getSafePathLength(end);
        // These are the same path-position fields used by the live playback
        // interpolator. Keeping them here makes partial authored paths line up
        // exactly with the moving performer.
        const pathStart = finitePathPosition(start.previousPathPosition, 0);
        const pathEnd = finitePathPosition(end.nextPathPosition, 1);
        const partialPathLength =
            pathLength == null ? 0 : Math.abs(pathEnd - pathStart) * pathLength;
        const hasPathMotion = partialPathLength > 0.0001;
        const hasLinearMotion =
            coordinateDistanceSquared(start, end) > POSITION_EPSILON_SQUARED;
        if (!hasPathMotion && !hasLinearMotion) continue;

        const desiredSegments = hasPathMotion
            ? Math.min(
                  MAX_CURVE_SEGMENTS_PER_INTERVAL,
                  Math.max(
                      1,
                      Math.ceil(
                          partialPathLength /
                              PIXELS_PER_WORLD_UNIT /
                              curveSampleSpacingWorld,
                      ),
                  ),
              )
            : 1;
        intervals.push({
            startTimestamp,
            endTimestamp,
            start,
            end,
            pathLength,
            pathStart,
            pathEnd,
            desiredSegments,
        });
    }

    return intervals;
};

/**
 * Spread a fixed segment budget across the entire show. Every interval gets a
 * segment before curved intervals receive additional detail.
 */
const allocateSegments = (
    intervals: TrailInterval[],
    budget: number,
): { interval: TrailInterval; segments: number }[] => {
    if (intervals.length === 0 || budget <= 0) return [];

    if (intervals.length > budget) {
        if (budget === 1) return [{ interval: intervals[0]!, segments: 1 }];
        const selectedIndexes = new Set<number>();
        for (let index = 0; index < budget; index += 1) {
            selectedIndexes.add(
                Math.round((index * (intervals.length - 1)) / (budget - 1)),
            );
        }
        return [...selectedIndexes].map((index) => ({
            interval: intervals[index]!,
            segments: 1,
        }));
    }

    const allocations = intervals.map((interval) => ({
        interval,
        segments: 1,
    }));
    let remaining = budget - allocations.length;

    // Allocate one subdivision at a time. With the bounded public budget this
    // stays small and avoids starving shorter curved intervals.
    while (remaining > 0) {
        let changed = false;
        for (const allocation of allocations) {
            if (allocation.segments >= allocation.interval.desiredSegments)
                continue;
            allocation.segments += 1;
            remaining -= 1;
            changed = true;
            if (remaining === 0) break;
        }
        if (!changed) break;
    }

    return allocations;
};

const sampleInterval = (
    interval: TrailInterval,
    progress: number,
): Pick<TrailPoint, "x" | "z"> | null => {
    let x = interval.start.x + progress * (interval.end.x - interval.start.x);
    let z = interval.start.y + progress * (interval.end.y - interval.start.y);

    if (interval.pathLength != null && interval.end.path) {
        try {
            const pathProgress =
                interval.pathStart +
                progress * (interval.pathEnd - interval.pathStart);
            const point = interval.end.path.getPointAtLength(
                interval.pathLength * pathProgress,
            );
            if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
                x = point.x;
                z = point.y;
            }
        } catch {
            // A malformed custom path should not make the 3D viewer unusable.
            // The stored endpoint coordinates still provide a safe fallback.
        }
    }

    return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
};

const appendMarcherSegments = ({
    positions,
    times,
    timeline,
    fieldProperties,
    segmentBudget,
    curveSampleSpacingWorld,
    y,
}: {
    positions: number[];
    times: number[];
    timeline: MarcherTimeline;
    fieldProperties: FieldProperties;
    segmentBudget: number;
    curveSampleSpacingWorld: number;
    y: number;
}): number => {
    const intervals = buildIntervals(timeline, curveSampleSpacingWorld);
    const allocations = allocateSegments(intervals, segmentBudget);
    let appended = 0;

    for (const { interval, segments } of allocations) {
        let previous: TrailPoint | null = null;
        for (let index = 0; index <= segments; index += 1) {
            const progress = index / segments;
            const sample = sampleInterval(interval, progress);
            if (!sample) {
                previous = null;
                continue;
            }
            const [worldX, , worldZ] = canvasCoordinatesToWorld(
                { x: sample.x, y: sample.z },
                fieldProperties,
            );
            const current: TrailPoint = {
                x: worldX,
                z: worldZ,
                timeSeconds:
                    (interval.startTimestamp +
                        progress *
                            (interval.endTimestamp - interval.startTimestamp)) /
                    1000,
            };

            if (previous) {
                const dx = current.x - previous.x;
                const dz = current.z - previous.z;
                if (dx * dx + dz * dz > POSITION_EPSILON_SQUARED) {
                    positions.push(
                        previous.x,
                        y,
                        previous.z,
                        current.x,
                        y,
                        current.z,
                    );
                    times.push(previous.timeSeconds, current.timeSeconds);
                    appended += 1;
                }
            }
            previous = current;
        }
    }

    return appended;
};

/**
 * Build a bounded, batched motion-trail buffer for selected performers.
 * Geometry is static across playback; only the shader's time uniform changes.
 */
export const buildMotionTrailGeometryData = ({
    marcherTimelines,
    fieldProperties,
    activeMarcherIds,
    options = {},
}: {
    marcherTimelines: Map<number, MarcherTimeline>;
    fieldProperties: FieldProperties;
    activeMarcherIds: readonly number[];
    options?: BuildMotionTrailGeometryOptions;
}): MotionTrailGeometryData => {
    const maxMarchers = finitePositiveInteger(
        options.maxMarchers,
        MAX_MOTION_TRAIL_MARCHERS,
    );
    const maxSegments = finitePositiveInteger(
        options.maxSegments,
        MAX_MOTION_TRAIL_SEGMENTS,
    );
    const maxSegmentsPerMarcher = finitePositiveInteger(
        options.maxSegmentsPerMarcher,
        MAX_MOTION_TRAIL_SEGMENTS_PER_MARCHER,
    );
    const curveSampleSpacingWorld = finitePositive(
        options.curveSampleSpacingWorld,
        CURVE_SAMPLE_SPACING_WORLD,
    );
    const y = Number.isFinite(options.y) ? options.y! : MOTION_TRAIL_Y;

    const ids: number[] = [];
    const seen = new Set<number>();
    for (const id of activeMarcherIds) {
        if (
            ids.length >= maxMarchers ||
            !Number.isFinite(id) ||
            seen.has(id) ||
            !marcherTimelines.has(id)
        )
            continue;
        ids.push(id);
        seen.add(id);
    }

    if (ids.length === 0) {
        return {
            positions: new Float32Array(0),
            times: new Float32Array(0),
            segmentCount: 0,
            marcherCount: 0,
        };
    }

    const positions: number[] = [];
    const times: number[] = [];
    const sharedBudget = Math.max(1, Math.floor(maxSegments / ids.length));
    const segmentBudget = Math.min(maxSegmentsPerMarcher, sharedBudget);
    let segmentCount = 0;
    let marcherCount = 0;

    for (const id of ids) {
        const timeline = marcherTimelines.get(id);
        if (!timeline) continue;
        const appended = appendMarcherSegments({
            positions,
            times,
            timeline,
            fieldProperties,
            segmentBudget,
            curveSampleSpacingWorld,
            y,
        });
        if (appended > 0) marcherCount += 1;
        segmentCount += appended;
    }

    return {
        positions: Float32Array.from(positions),
        times: Float32Array.from(times),
        segmentCount,
        marcherCount,
    };
};
