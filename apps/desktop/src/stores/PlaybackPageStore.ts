import { create } from "zustand";

interface PlaybackPageStore {
    playbackPageId: number | null;
    pendingSelectionSyncPageId: number | null;
    setPlaybackPageId: (playbackPageId: number | null) => void;
    setPendingSelectionSyncPageId: (
        pendingSelectionSyncPageId: number | null,
    ) => void;
    reset: () => void;
}

export const usePlaybackPageStore = create<PlaybackPageStore>((set) => ({
    playbackPageId: null,
    pendingSelectionSyncPageId: null,
    setPlaybackPageId: (playbackPageId) =>
        set((state) =>
            state.playbackPageId === playbackPageId
                ? state
                : { playbackPageId },
        ),
    setPendingSelectionSyncPageId: (pendingSelectionSyncPageId) =>
        set((state) =>
            state.pendingSelectionSyncPageId === pendingSelectionSyncPageId
                ? state
                : { pendingSelectionSyncPageId },
        ),
    reset: () =>
        set({
            playbackPageId: null,
            pendingSelectionSyncPageId: null,
        }),
}));
