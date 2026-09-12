import { beforeEach, describe, expect, it } from "vitest";
import { usePlaybackPageStore } from "../PlaybackPageStore";

describe("PlaybackPageStore", () => {
    beforeEach(() => {
        usePlaybackPageStore.getState().reset();
    });

    it("tracks the lightweight page shown during playback", () => {
        usePlaybackPageStore.getState().setPlaybackPageId(42);

        expect(usePlaybackPageStore.getState().playbackPageId).toBe(42);
    });
});
