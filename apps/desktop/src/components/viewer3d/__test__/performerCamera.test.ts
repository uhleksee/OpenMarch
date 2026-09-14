import { describe, expect, it } from "vitest";
import {
    getPerformerFollowCameraState,
    getPerformerForwardVector,
    getPerformerPovCameraState,
    resolvePerformerCameraFocus,
    type PerformerCameraState,
    type PerformerWorldPose,
} from "../performerCamera";

const pose = (
    id: number,
    section: string,
    position: readonly [number, number, number],
    facingRadians = 0,
    visible = true,
): PerformerWorldPose => ({
    id,
    section,
    position,
    facingRadians,
    visible,
});

const currentCamera: PerformerCameraState = {
    position: [0, 8, 12],
    target: [0, 1, 0],
    fov: 50,
    rollDegrees: -8,
};

describe("performer camera utilities", () => {
    it("uses the 3D marcher's +Z forward convention", () => {
        expect(getPerformerForwardVector(0)).toEqual([0, 0, 1]);
        const quarterTurn = getPerformerForwardVector(Math.PI / 2);
        expect(quarterTurn?.[0]).toBeCloseTo(1);
        expect(quarterTurn?.[1]).toBe(0);
        expect(quarterTurn?.[2]).toBeCloseTo(0);
        expect(getPerformerForwardVector(Number.NaN)).toBeNull();
    });

    it("resolves one visible performer and deterministic body bounds", () => {
        const focus = resolvePerformerCameraFocus(
            { kind: "follow-performer", marcherId: 2 },
            [pose(2, "Trumpet", [4, 0, -3])],
        );

        expect(focus?.kind).toBe("performer");
        expect(focus?.memberIds).toEqual([2]);
        expect(focus?.target).toEqual([4, 1.65, -3]);
        expect(focus?.bounds.min).toEqual([3.42, 0, -3.58]);
        expect(focus?.bounds.max).toEqual([4.58, 3.45, -2.42]);
        expect(focus?.bounds.radius).toBeGreaterThan(1.7);
    });

    it("uses the visible section centroid and ignores other or hidden marchers", () => {
        const focus = resolvePerformerCameraFocus(
            { kind: "follow-section", section: "Trumpet" },
            [
                pose(8, "Trumpet", [-4, 0, 2]),
                pose(2, "Trumpet", [6, 0, -2]),
                pose(4, "Trumpet", [100, 0, 100], 0, false),
                pose(1, "Flute", [20, 0, 20]),
            ],
        );

        expect(focus?.kind).toBe("section");
        expect(focus?.memberIds).toEqual([2, 8]);
        expect(focus?.target).toEqual([1, 1.65, 0]);
        expect(focus?.bounds.min[0]).toBeCloseTo(-4.58);
        expect(focus?.bounds.max[0]).toBeCloseTo(6.58);
        expect(focus?.bounds.min[2]).toBeCloseTo(-2.58);
        expect(focus?.bounds.max[2]).toBeCloseTo(2.58);
    });

    it("returns null for free, missing, hidden, and invalid targets", () => {
        const poses = [
            pose(1, "Trumpet", [0, 0, 0], 0, false),
            pose(2, "Flute", [Number.NaN, 0, 0]),
        ];
        expect(resolvePerformerCameraFocus({ kind: "free" }, poses)).toBeNull();
        expect(
            resolvePerformerCameraFocus(
                { kind: "follow-performer", marcherId: 1 },
                poses,
            ),
        ).toBeNull();
        expect(
            resolvePerformerCameraFocus(
                { kind: "follow-section", section: "Trumpet" },
                poses,
            ),
        ).toBeNull();
        expect(
            resolvePerformerCameraFocus({ kind: "pov", marcherId: 999 }, poses),
        ).toBeNull();
    });

    it("places POV ahead of the face and looks along authored facing", () => {
        const state = getPerformerPovCameraState(
            pose(3, "Mellophone", [10, 0, 20], Math.PI / 2),
            { rollDegrees: 6 },
        );

        expect(state?.position[0]).toBeCloseTo(10.4);
        expect(state?.position[1]).toBeCloseTo(2.64);
        expect(state?.position[2]).toBeCloseTo(20);
        expect(state?.target[0]).toBeCloseTo(20.4);
        expect(state?.target[1]).toBeCloseTo(2.64);
        expect(state?.target[2]).toBeCloseTo(20);
        expect(state?.fov).toBe(58);
        expect(state?.rollDegrees).toBe(6);
    });

    it("rejects an unusable POV pose and sanitizes optional camera values", () => {
        expect(
            getPerformerPovCameraState(
                pose(1, "Trumpet", [0, Number.POSITIVE_INFINITY, 0]),
            ),
        ).toBeNull();
        const state = getPerformerPovCameraState(
            pose(1, "Trumpet", [0, 0, 0]),
            { fov: 300, lookDistance: -1, eyeHeight: Number.NaN },
        );
        expect(state?.fov).toBe(179);
        expect(state?.position[1]).toBe(2.64);
        expect(state?.target[2]).toBeCloseTo(10.4);
    });

    it("frames focus bounds while preserving camera direction, FOV, and roll", () => {
        const focus = resolvePerformerCameraFocus(
            { kind: "follow-section", section: "Guard" },
            [pose(1, "Guard", [-12, 0, 0]), pose(2, "Guard", [12, 0, 0])],
        );
        const state = getPerformerFollowCameraState(focus, currentCamera, {
            aspect: 16 / 9,
        });

        expect(state?.target).toEqual([0, 1.65, 0]);
        expect(state?.fov).toBe(50);
        expect(state?.rollDegrees).toBe(-8);
        expect(state!.position[1]).toBeGreaterThan(state!.target[1]);
        expect(state!.position[2]).toBeGreaterThan(state!.target[2]);
        expect(
            Math.hypot(
                state!.position[0] - state!.target[0],
                state!.position[1] - state!.target[1],
                state!.position[2] - state!.target[2],
            ),
        ).toBeGreaterThan(25);
    });

    it("uses a safe fallback view for a degenerate or missing current camera", () => {
        const focus = resolvePerformerCameraFocus(
            { kind: "follow-performer", marcherId: 1 },
            [pose(1, "Snare Drum", [3, 0, 4])],
        );
        const degenerate: PerformerCameraState = {
            position: [1, 1, 1],
            target: [1, 1, 1],
            fov: Number.NaN,
            rollDegrees: Number.NaN,
        };
        const state = getPerformerFollowCameraState(focus, degenerate);

        expect(state).not.toBeNull();
        expect(state?.position.every(Number.isFinite)).toBe(true);
        expect(state?.target.every(Number.isFinite)).toBe(true);
        expect(state?.fov).toBe(45);
        expect(state?.rollDegrees).toBe(0);
        expect(state!.position[2]).toBeGreaterThan(state!.target[2]);
        expect(getPerformerFollowCameraState(null, currentCamera)).toBeNull();
    });

    it("honors portrait aspect ratio and explicit distance clamps", () => {
        const focus = resolvePerformerCameraFocus(
            { kind: "follow-section", section: "Brass" },
            [pose(1, "Brass", [-20, 0, 0]), pose(2, "Brass", [20, 0, 0])],
        );
        const state = getPerformerFollowCameraState(focus, currentCamera, {
            aspect: 0.5,
            minimumDistance: 8,
            maximumDistance: 30,
        });
        const distance = Math.hypot(
            state!.position[0] - state!.target[0],
            state!.position[1] - state!.target[1],
            state!.position[2] - state!.target[2],
        );

        expect(distance).toBeCloseTo(30);
    });
});
