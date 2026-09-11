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

    it("tracks and clears a pending editor selection sync", () => {
        const store = usePlaybackPageStore.getState();
        store.setPendingSelectionSyncPageId(84);

        expect(usePlaybackPageStore.getState().pendingSelectionSyncPageId).toBe(
            84,
        );

        usePlaybackPageStore.getState().setPendingSelectionSyncPageId(null);
        expect(
            usePlaybackPageStore.getState().pendingSelectionSyncPageId,
        ).toBeNull();
    });
});
