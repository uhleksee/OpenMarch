import { describe, expect, it } from "vitest";
import { calculateLivePlaybackSeconds } from "../playbackTiming";

describe("calculateLivePlaybackSeconds", () => {
    const playback = {
        playStartTime: 10.02,
        startOffset: 16,
    };

    it("waits at the page departure until scheduled audio begins", () => {
        expect(calculateLivePlaybackSeconds(10, playback)).toBe(16);
    });

    it("uses the same elapsed clock as the scheduled audio", () => {
        expect(calculateLivePlaybackSeconds(11.52, playback)).toBe(17.5);
    });

    it("supports an arbitrary playback offset", () => {
        expect(
            calculateLivePlaybackSeconds(21, {
                playStartTime: 20,
                startOffset: 17.25,
            }),
        ).toBe(18.25);
    });
});
