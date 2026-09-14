import * as z from "zod";

const cameraVectorSchema = z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
]);

export const directorCameraShotSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    timeSeconds: z.number().finite().nonnegative(),
    transitionSeconds: z.number().finite().min(0).max(12),
    position: cameraVectorSchema,
    target: cameraVectorSchema,
    fov: z.number().finite().min(10).max(120),
});

export type DirectorCameraShot = z.infer<typeof directorCameraShotSchema>;

export const MAX_DIRECTOR_CAMERA_SHOTS = 200;

export interface DirectorCameraState {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
}

const shotState = (shot: DirectorCameraShot): DirectorCameraState => ({
    position: [...shot.position],
    target: [...shot.target],
    fov: shot.fov,
});

export const sortDirectorCameraShots = (
    shots: DirectorCameraShot[],
): DirectorCameraShot[] =>
    [...shots].sort(
        (first, second) =>
            first.timeSeconds - second.timeSeconds ||
            first.id.localeCompare(second.id),
    );

const lerp = (start: number, end: number, progress: number) =>
    start + (end - start) * progress;

const lerpVector = (
    start: [number, number, number],
    end: [number, number, number],
    progress: number,
): [number, number, number] => [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress),
];

const smoothStep = (progress: number) =>
    progress * progress * (3 - 2 * progress);

/**
 * Resolve a deterministic director camera at a show timestamp. A shot's cue
 * marks its arrival time; the glide begins before that cue and holds after it.
 */
export function getDirectorCameraStateAtTime(
    shotsInput: DirectorCameraShot[],
    timeSeconds: number,
): DirectorCameraState | null {
    return getDirectorCameraStateAtTimeFromSortedShots(
        sortDirectorCameraShots(shotsInput),
        timeSeconds,
    );
}

/**
 * Resolve a camera from shots that have already been sorted by cue time. Use
 * this variant in render loops so the shot list is not cloned and sorted on
 * every frame.
 */
export function getDirectorCameraStateAtTimeFromSortedShots(
    shots: DirectorCameraShot[],
    timeSeconds: number,
): DirectorCameraState | null {
    if (shots.length === 0) return null;
    const safeTime = Number.isFinite(timeSeconds)
        ? Math.max(0, timeSeconds)
        : 0;

    if (shots.length === 1 || safeTime <= shots[0].timeSeconds) {
        return shotState(shots[0]);
    }

    for (let index = 1; index < shots.length; index += 1) {
        const previous = shots[index - 1];
        const destination = shots[index];
        if (safeTime >= destination.timeSeconds) continue;

        const transitionStart = Math.max(
            previous.timeSeconds,
            destination.timeSeconds - destination.transitionSeconds,
        );
        if (destination.transitionSeconds <= 0 || safeTime <= transitionStart) {
            return shotState(previous);
        }

        const duration = destination.timeSeconds - transitionStart;
        const progress = smoothStep(
            Math.min(1, Math.max(0, (safeTime - transitionStart) / duration)),
        );
        return {
            position: lerpVector(
                previous.position,
                destination.position,
                progress,
            ),
            target: lerpVector(previous.target, destination.target, progress),
            fov: lerp(previous.fov, destination.fov, progress),
        };
    }

    return shotState(shots[shots.length - 1]);
}

export const formatDirectorTime = (timeSeconds: number): string => {
    const safeSeconds = Math.max(0, Math.round(timeSeconds * 10) / 10);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds - minutes * 60;
    return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
};
