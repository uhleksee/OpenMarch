import { describe, expect, it, vi } from "vitest";
import { CubicCurve, Line, Path } from "@openmarch/core";
import FieldPropertiesTemplates from "@/global/classes/FieldProperties.templates";
import type {
    CoordinateDefinition,
    MarcherTimeline,
} from "@/utilities/Keyframes";
import {
    buildMotionTrailGeometryData,
    MOTION_TRAIL_Y,
} from "../motionTrailGeometry";
import { PIXELS_PER_WORLD_UNIT } from "../viewer3d.utils";

const field = FieldPropertiesTemplates.COLLEGE_FOOTBALL_FIELD_NO_END_ZONES;
const center = { x: field.width / 2, y: field.height / 2 };

const timeline = (
    entries: [number, CoordinateDefinition][],
): MarcherTimeline => ({
    pathMap: new Map(entries),
    sortedTimestamps: entries.map(([timestamp]) => timestamp),
});

const build = (
    marcherTimeline: MarcherTimeline,
    options?: Parameters<typeof buildMotionTrailGeometryData>[0]["options"],
) =>
    buildMotionTrailGeometryData({
        marcherTimelines: new Map([[1, marcherTimeline]]),
        fieldProperties: field,
        activeMarcherIds: [1],
        options,
    });

describe("motion trail geometry", () => {
    it("converts a linear timeline into centered world-space segments", () => {
        const data = build(
            timeline([
                [0, center],
                [1000, { x: center.x + PIXELS_PER_WORLD_UNIT, y: center.y }],
            ]),
        );

        expect(data.segmentCount).toBe(1);
        expect(data.marcherCount).toBe(1);
        expect(data.positions[0]).toBeCloseTo(0);
        expect(data.positions[1]).toBeCloseTo(MOTION_TRAIL_Y);
        expect(data.positions[2]).toBeCloseTo(0);
        expect(data.positions[3]).toBeCloseTo(1);
        expect(data.positions[4]).toBeCloseTo(MOTION_TRAIL_Y);
        expect(data.positions[5]).toBeCloseTo(0);
        expect([...data.times]).toEqual([0, 1]);
    });

    it("skips holds and non-finite coordinates", () => {
        const data = build(
            timeline([
                [0, center],
                [500, center],
                [1000, { x: Number.NaN, y: center.y }],
            ]),
        );

        expect(data.segmentCount).toBe(0);
        expect(data.positions).toHaveLength(0);
        expect(data.times).toHaveLength(0);
    });

    it("samples curved paths and includes both timeline endpoints", () => {
        const curve = new Path([
            new CubicCurve(
                center,
                { x: center.x, y: center.y + PIXELS_PER_WORLD_UNIT },
                {
                    x: center.x + PIXELS_PER_WORLD_UNIT,
                    y: center.y + PIXELS_PER_WORLD_UNIT,
                },
                { x: center.x + PIXELS_PER_WORLD_UNIT, y: center.y },
            ),
        ]);
        const data = build(
            timeline([
                [
                    0,
                    {
                        ...center,
                        previousPathPosition: 0,
                        nextPathPosition: 1,
                    },
                ],
                [
                    1000,
                    {
                        x: center.x + PIXELS_PER_WORLD_UNIT,
                        y: center.y,
                        path: curve,
                        previousPathPosition: 0,
                        nextPathPosition: 1,
                    },
                ],
            ]),
            { curveSampleSpacingWorld: 0.2 },
        );

        expect(data.segmentCount).toBeGreaterThan(1);
        expect(Array.from(data.positions).every(Number.isFinite)).toBe(true);
        expect(Array.from(data.times).every(Number.isFinite)).toBe(true);
        expect(data.positions[0]).toBeCloseTo(0);
        expect(data.positions[1]).toBeCloseTo(MOTION_TRAIL_Y);
        expect(data.positions[2]).toBeCloseTo(0);
        expect(data.positions.at(-3)).toBeCloseTo(1);
        expect(data.positions.at(-2)).toBeCloseTo(MOTION_TRAIL_Y);
        expect(data.positions.at(-1)).toBeCloseTo(0);
        const worldZValues = Array.from(data.positions).filter(
            (_, index) => index % 3 === 2,
        );
        expect(worldZValues.some((value) => value > 0)).toBe(true);
        expect(data.times.at(-1)).toBe(1);
    });

    it("honors partial authored path positions", () => {
        const path = new Path([
            new Line(center, {
                x: center.x + PIXELS_PER_WORLD_UNIT * 4,
                y: center.y,
            }),
        ]);
        const data = build(
            timeline([
                [
                    0,
                    {
                        x: center.x + PIXELS_PER_WORLD_UNIT,
                        y: center.y,
                        previousPathPosition: 0.25,
                    },
                ],
                [
                    1000,
                    {
                        x: center.x + PIXELS_PER_WORLD_UNIT * 3,
                        y: center.y,
                        path,
                        nextPathPosition: 0.75,
                    },
                ],
            ]),
        );

        expect(data.positions[0]).toBeCloseTo(1);
        expect(data.positions.at(-3)).toBeCloseTo(3);
        expect(data.times[0]).toBe(0);
        expect(data.times.at(-1)).toBe(1);
    });

    it("falls back to stored coordinates when a custom path throws", () => {
        const brokenPath = {
            getTotalLength: () => 100,
            getPointAtLength: () => {
                throw new Error("broken path");
            },
        } as CoordinateDefinition["path"];
        const data = build(
            timeline([
                [0, center],
                [
                    1000,
                    {
                        x: center.x + PIXELS_PER_WORLD_UNIT,
                        y: center.y,
                        path: brokenPath,
                    },
                ],
            ]),
        );

        expect(data.segmentCount).toBeGreaterThan(0);
        expect(data.positions[0]).toBeCloseTo(0);
        expect(data.positions.at(-3)).toBeCloseTo(1);
    });

    it("caches path lengths across trail rebuilds", () => {
        const getTotalLength = vi.fn(() => PIXELS_PER_WORLD_UNIT);
        const path = {
            getTotalLength,
            getPointAtLength: (length: number) => ({
                x: center.x + length,
                y: center.y,
            }),
        } as CoordinateDefinition["path"];
        const marcherTimeline = timeline([
            [0, center],
            [
                1000,
                {
                    x: center.x + PIXELS_PER_WORLD_UNIT,
                    y: center.y,
                    path,
                },
            ],
        ]);

        build(marcherTimeline);
        build(marcherTimeline);

        expect(getTotalLength).toHaveBeenCalledTimes(1);
    });

    it("deduplicates active IDs and obeys marcher and segment limits", () => {
        const longTimeline = timeline([
            [0, center],
            [1000, { x: center.x + 10, y: center.y }],
            [2000, { x: center.x + 20, y: center.y }],
            [3000, { x: center.x + 30, y: center.y }],
        ]);
        const data = buildMotionTrailGeometryData({
            marcherTimelines: new Map([
                [1, longTimeline],
                [2, longTimeline],
                [3, longTimeline],
            ]),
            fieldProperties: field,
            activeMarcherIds: [1, 1, 2, 3],
            options: {
                maxMarchers: 2,
                maxSegments: 4,
                maxSegmentsPerMarcher: 10,
            },
        });

        expect(data.marcherCount).toBe(2);
        expect(data.segmentCount).toBeLessThanOrEqual(4);
        expect(data.positions).toHaveLength(data.segmentCount * 6);
        expect(data.times).toHaveLength(data.segmentCount * 2);
    });

    it("returns empty typed buffers for absent timelines", () => {
        const data = buildMotionTrailGeometryData({
            marcherTimelines: new Map(),
            fieldProperties: field,
            activeMarcherIds: [1],
        });

        expect(data.positions).toBeInstanceOf(Float32Array);
        expect(data.times).toBeInstanceOf(Float32Array);
        expect(data.segmentCount).toBe(0);
        expect(data.marcherCount).toBe(0);
    });
});
