export type CameraVector3 = [number, number, number];

export type PerformerCameraMode =
    | { kind: "free" }
    | { kind: "pov"; marcherId: number }
    | { kind: "follow-performer"; marcherId: number }
    | { kind: "follow-section"; section: string };

/**
 * A minimal snapshot of a rendered performer. `facingRadians` follows the 3D
 * scene convention: zero faces world +Z and positive values turn toward +X.
 */
export interface PerformerWorldPose {
    id: number;
    section: string;
    position: readonly [number, number, number];
    facingRadians: number;
    visible?: boolean;
}

export interface PerformerCameraState {
    position: CameraVector3;
    target: CameraVector3;
    fov: number;
    rollDegrees: number;
}

export interface PerformerFocusBounds {
    min: CameraVector3;
    max: CameraVector3;
    radius: number;
}

export interface PerformerCameraFocus {
    kind: "performer" | "section";
    memberIds: number[];
    target: CameraVector3;
    bounds: PerformerFocusBounds;
}

interface FocusOptions {
    focusHeight?: number;
    performerHeight?: number;
    performerRadius?: number;
}

export interface PerformerPovOptions {
    eyeHeight?: number;
    forwardOffset?: number;
    lookDistance?: number;
    fov?: number;
    rollDegrees?: number;
}

export interface PerformerFollowOptions {
    aspect?: number;
    padding?: number;
    minimumDistance?: number;
    maximumDistance?: number;
    fallbackDirection?: readonly [number, number, number];
}

const DEFAULT_FOCUS_HEIGHT = 1.65;
const DEFAULT_PERFORMER_HEIGHT = 3.45;
const DEFAULT_PERFORMER_RADIUS = 0.58;
const DEFAULT_POV_EYE_HEIGHT = 2.64;
const DEFAULT_POV_FORWARD_OFFSET = 0.4;
const DEFAULT_POV_LOOK_DISTANCE = 10;
const DEFAULT_POV_FOV = 58;
const DEFAULT_FOLLOW_DIRECTION = [0, 0.38, 1] as const;
const EPSILON = 0.000001;

const finiteOr = (value: number | undefined, fallback: number): number =>
    value !== undefined && Number.isFinite(value) ? value : fallback;

const positiveOr = (value: number | undefined, fallback: number): number => {
    const finiteValue = finiteOr(value, fallback);
    return finiteValue > 0 ? finiteValue : fallback;
};

const isFiniteVector = (value: readonly [number, number, number]): boolean =>
    value.every(Number.isFinite);

const isUsablePose = (pose: PerformerWorldPose): boolean =>
    pose.visible !== false &&
    Number.isFinite(pose.id) &&
    Number.isFinite(pose.facingRadians) &&
    isFiniteVector(pose.position);

const normalize = (
    vector: readonly [number, number, number],
    fallback: readonly [number, number, number],
): CameraVector3 => {
    const length = Math.hypot(...vector);
    if (!Number.isFinite(length) || length <= EPSILON) {
        const fallbackLength = Math.hypot(...fallback);
        if (!Number.isFinite(fallbackLength) || fallbackLength <= EPSILON)
            return [0, 0, 1];
        return fallback.map(
            (component) => component / fallbackLength,
        ) as CameraVector3;
    }
    return vector.map((component) => component / length) as CameraVector3;
};

/** Return the performer's authored upper-body forward vector. */
export const getPerformerForwardVector = (
    facingRadians: number,
): CameraVector3 | null => {
    if (!Number.isFinite(facingRadians)) return null;
    return [Math.sin(facingRadians), 0, Math.cos(facingRadians)];
};

const createFocus = (
    poses: PerformerWorldPose[],
    kind: PerformerCameraFocus["kind"],
    options: FocusOptions,
): PerformerCameraFocus | null => {
    if (poses.length === 0) return null;

    const focusHeight = positiveOr(options.focusHeight, DEFAULT_FOCUS_HEIGHT);
    const performerHeight = positiveOr(
        options.performerHeight,
        DEFAULT_PERFORMER_HEIGHT,
    );
    const performerRadius = positiveOr(
        options.performerRadius,
        DEFAULT_PERFORMER_RADIUS,
    );
    const target: CameraVector3 = [0, 0, 0];
    const min: CameraVector3 = [Infinity, Infinity, Infinity];
    const max: CameraVector3 = [-Infinity, -Infinity, -Infinity];

    for (const pose of poses) {
        const [x, y, z] = pose.position;
        target[0] += x;
        target[1] += y + focusHeight;
        target[2] += z;
        min[0] = Math.min(min[0], x - performerRadius);
        min[1] = Math.min(min[1], y);
        min[2] = Math.min(min[2], z - performerRadius);
        max[0] = Math.max(max[0], x + performerRadius);
        max[1] = Math.max(max[1], y + performerHeight);
        max[2] = Math.max(max[2], z + performerRadius);
    }

    target[0] /= poses.length;
    target[1] /= poses.length;
    target[2] /= poses.length;
    const radius = Math.hypot(
        Math.max(Math.abs(target[0] - min[0]), Math.abs(max[0] - target[0])),
        Math.max(Math.abs(target[1] - min[1]), Math.abs(max[1] - target[1])),
        Math.max(Math.abs(target[2] - min[2]), Math.abs(max[2] - target[2])),
    );

    return {
        kind,
        memberIds: poses.map((pose) => pose.id).sort((a, b) => a - b),
        target,
        bounds: { min, max, radius },
    };
};

/**
 * Resolve a camera subject without assuming that every marcher is currently
 * mounted or visible. Missing and invalid targets return `null` rather than a
 * camera state containing NaN.
 */
export const resolvePerformerCameraFocus = (
    mode: PerformerCameraMode,
    poses: readonly PerformerWorldPose[],
    options: FocusOptions = {},
): PerformerCameraFocus | null => {
    if (mode.kind === "free") return null;
    const usablePoses = poses.filter(isUsablePose);

    if (mode.kind === "follow-section") {
        const sectionPoses = usablePoses.filter(
            (pose) => pose.section === mode.section,
        );
        return createFocus(sectionPoses, "section", options);
    }

    const performer = usablePoses.find((pose) => pose.id === mode.marcherId);
    return performer ? createFocus([performer], "performer", options) : null;
};

/** Build the eye-level camera state for a marcher using authored facing. */
export const getPerformerPovCameraState = (
    pose: PerformerWorldPose | null | undefined,
    options: PerformerPovOptions = {},
): PerformerCameraState | null => {
    if (!pose || !isUsablePose(pose)) return null;
    const forward = getPerformerForwardVector(pose.facingRadians);
    if (!forward) return null;

    const eyeHeight = positiveOr(options.eyeHeight, DEFAULT_POV_EYE_HEIGHT);
    const forwardOffset = finiteOr(
        options.forwardOffset,
        DEFAULT_POV_FORWARD_OFFSET,
    );
    const lookDistance = positiveOr(
        options.lookDistance,
        DEFAULT_POV_LOOK_DISTANCE,
    );
    const fov = Math.min(
        179,
        Math.max(1, positiveOr(options.fov, DEFAULT_POV_FOV)),
    );
    const rollDegrees = finiteOr(options.rollDegrees, 0);
    const position: CameraVector3 = [
        pose.position[0] + forward[0] * forwardOffset,
        pose.position[1] + eyeHeight,
        pose.position[2] + forward[2] * forwardOffset,
    ];

    return {
        position,
        target: [
            position[0] + forward[0] * lookDistance,
            position[1],
            position[2] + forward[2] * lookDistance,
        ],
        fov,
        rollDegrees,
    };
};

/**
 * Create a framed follow-camera state. The current view supplies its viewing
 * direction, FOV, and roll; distance is chosen to contain the focus bounds.
 */
export const getPerformerFollowCameraState = (
    focus: PerformerCameraFocus | null | undefined,
    currentState: PerformerCameraState | null | undefined,
    options: PerformerFollowOptions = {},
): PerformerCameraState | null => {
    if (!focus || !isFiniteVector(focus.target)) return null;

    const currentPosition =
        currentState && isFiniteVector(currentState.position)
            ? currentState.position
            : null;
    const currentTarget =
        currentState && isFiniteVector(currentState.target)
            ? currentState.target
            : null;
    const fallbackDirection =
        options.fallbackDirection && isFiniteVector(options.fallbackDirection)
            ? options.fallbackDirection
            : DEFAULT_FOLLOW_DIRECTION;
    const direction = normalize(
        currentPosition && currentTarget
            ? [
                  currentPosition[0] - currentTarget[0],
                  currentPosition[1] - currentTarget[1],
                  currentPosition[2] - currentTarget[2],
              ]
            : fallbackDirection,
        fallbackDirection,
    );
    const fov = Math.min(
        179,
        Math.max(
            1,
            currentState && Number.isFinite(currentState.fov)
                ? currentState.fov
                : 45,
        ),
    );
    const aspect = positiveOr(options.aspect, 16 / 9);
    const padding = positiveOr(options.padding, 1.2);
    const minimumDistance = positiveOr(options.minimumDistance, 4.5);
    const maximumDistance = positiveOr(options.maximumDistance, Infinity);
    const verticalHalfFov = (fov * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
    const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
    const fitDistance =
        (Math.max(0, focus.bounds.radius) * padding) /
        Math.max(EPSILON, Math.tan(limitingHalfFov));
    const distance = Math.min(
        maximumDistance,
        Math.max(minimumDistance, fitDistance),
    );

    return {
        position: [
            focus.target[0] + direction[0] * distance,
            focus.target[1] + direction[1] * distance,
            focus.target[2] + direction[2] * distance,
        ],
        target: [...focus.target],
        fov,
        rollDegrees:
            currentState && Number.isFinite(currentState.rollDegrees)
                ? currentState.rollDegrees
                : 0,
    };
};
