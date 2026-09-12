import { describe, expect, it } from "vitest";
import { createMarchBeatTimeline, getMarchStepAtTime } from "../marchBeatPhase";

describe("march beat phase", () => {
    it("places alternating heel-strike extrema exactly on beat boundaries", () => {
        const timeline = createMarchBeatTimeline([
            { timestamp: 0, duration: 0.5 },
            { timestamp: 0.5, duration: 0.5 },
            { timestamp: 1, duration: 0.5 },
        ]);

        expect(getMarchStepAtTime(0, timeline)).toBe(0);
        expect(getMarchStepAtTime(0.5, timeline)).toBe(1);
        expect(getMarchStepAtTime(1, timeline)).toBe(2);

        const strikeValues = [0, 0.5, 1].map((time) =>
            Math.cos(Math.PI * getMarchStepAtTime(time, timeline)!),
        );
        expect(strikeValues).toEqual([1, -1, 1]);
    });

    it("follows each beat's duration across tempo changes", () => {
        const timeline = createMarchBeatTimeline([
            { timestamp: 0, duration: 0.5 },
            { timestamp: 0.5, duration: 1 },
            { timestamp: 1.5, duration: 0.25 },
        ]);

        expect(getMarchStepAtTime(0.25, timeline)).toBeCloseTo(0.5);
        expect(getMarchStepAtTime(1, timeline)).toBeCloseTo(1.5);
        expect(getMarchStepAtTime(1.625, timeline)).toBeCloseTo(2.5);
    });

    it("ignores the zero-duration count-zero sentinel", () => {
        const timeline = createMarchBeatTimeline([
            { timestamp: 0, duration: 0 },
            { timestamp: 0, duration: 0.5 },
            { timestamp: 0.5, duration: 0.5 },
        ]);

        expect(timeline).toHaveLength(2);
        expect(timeline[0]!.step).toBe(0);
        expect(getMarchStepAtTime(0, timeline)).toBe(0);
        expect(getMarchStepAtTime(0.5, timeline)).toBe(1);
    });

    it("is stateless when playback seeks backward", () => {
        const timeline = createMarchBeatTimeline([
            { timestamp: 0, duration: 0.5 },
            { timestamp: 0.5, duration: 0.5 },
            { timestamp: 1, duration: 0.5 },
        ]);

        expect(getMarchStepAtTime(1.25, timeline)).toBeCloseTo(2.5);
        expect(getMarchStepAtTime(0.25, timeline)).toBeCloseTo(0.5);
        expect(getMarchStepAtTime(1.25, timeline)).toBeCloseTo(2.5);
    });

    it("clamps safely before the first beat and after the last beat", () => {
        const timeline = createMarchBeatTimeline([
            { timestamp: 2, duration: 0.5 },
            { timestamp: 2.5, duration: 0.5 },
        ]);

        expect(getMarchStepAtTime(-10, timeline)).toBe(0);
        expect(getMarchStepAtTime(100, timeline)).toBe(2);
        expect(getMarchStepAtTime(Number.NaN, timeline)).toBeNull();
        expect(getMarchStepAtTime(0, [])).toBeNull();
    });
});
