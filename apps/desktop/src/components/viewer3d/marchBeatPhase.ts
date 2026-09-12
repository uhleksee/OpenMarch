export interface MarchBeatTiming {
    readonly timestamp: number;
    readonly duration: number;
}

export interface MarchBeatTimelineEntry extends MarchBeatTiming {
    /** Zero-based ordinal of this playable beat, excluding timing sentinels. */
    readonly step: number;
}

/**
 * Build the small, immutable timing index used by the 3D gait animation.
 *
 * OpenMarch's count-zero anchor is represented by a zero-duration beat. It is
 * useful for page timing, but is not a playable count and must not flip which
 * foot lands on count one. Invalid timing rows are ignored for the same reason.
 */
export const createMarchBeatTimeline = (
    beats: readonly MarchBeatTiming[],
): MarchBeatTimelineEntry[] =>
    beats
        .map((beat, sourceIndex) => ({ beat, sourceIndex }))
        .filter(
            ({ beat }) =>
                Number.isFinite(beat.timestamp) &&
                Number.isFinite(beat.duration) &&
                beat.duration > 0,
        )
        .sort(
            (a, b) =>
                a.beat.timestamp - b.beat.timestamp ||
                a.sourceIndex - b.sourceIndex,
        )
        .map(({ beat }, step) => ({
            timestamp: beat.timestamp,
            duration: beat.duration,
            step,
        }));

/**
 * Resolve absolute playback time to a continuous marching step.
 *
 * Integer values are heel strikes. Even integers represent one foot and odd
 * integers the other; the fractional part is progress toward the next strike.
 * The result is derived entirely from absolute time, so seeks never retain
 * stale animation state.
 */
export const getMarchStepAtTime = (
    playbackSeconds: number,
    timeline: readonly MarchBeatTimelineEntry[],
): number | null => {
    if (!Number.isFinite(playbackSeconds) || timeline.length === 0) return null;

    const firstBeat = timeline[0]!;
    if (playbackSeconds <= firstBeat.timestamp) return firstBeat.step;

    // Find the latest beat at or before playbackSeconds. Choosing the latest
    // entry also makes an exact beat boundary resolve to the new heel strike.
    let low = 0;
    let high = timeline.length - 1;
    let beatIndex = 0;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (timeline[middle]!.timestamp <= playbackSeconds) {
            beatIndex = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    const beat = timeline[beatIndex]!;
    const beatProgress = Math.max(
        0,
        Math.min(1, (playbackSeconds - beat.timestamp) / beat.duration),
    );
    return beat.step + beatProgress;
};
