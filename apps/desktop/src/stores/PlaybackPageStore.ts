import { create } from "zustand";

interface PlaybackPageStore {
    playbackPageId: number | null;
    setPlaybackPageId: (playbackPageId: number | null) => void;
    reset: () => void;
}

export const usePlaybackPageStore = create<PlaybackPageStore>((set) => ({
    playbackPageId: null,
    setPlaybackPageId: (playbackPageId) =>
        set((state) =>
            state.playbackPageId === playbackPageId
                ? state
                : { playbackPageId },
        ),
    reset: () => set({ playbackPageId: null }),
}));
