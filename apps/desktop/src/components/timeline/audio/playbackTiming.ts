export interface PlaybackStartInfo {
    playStartTime: number;
    startOffset: number;
}

export const calculateLivePlaybackSeconds = (
    currentAudioTime: number,
    playback: PlaybackStartInfo,
): number =>
    playback.startOffset +
    Math.max(0, currentAudioTime - playback.playStartTime);
