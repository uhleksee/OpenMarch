export interface PlaybackStartInfo {
    playStartTime: number;
    startTimestamp: number;
    pageDuration: number;
}

export const calculateLivePlaybackSeconds = (
    currentAudioTime: number,
    playback: PlaybackStartInfo,
): number =>
    playback.startTimestamp +
    playback.pageDuration +
    Math.max(0, currentAudioTime - playback.playStartTime);
