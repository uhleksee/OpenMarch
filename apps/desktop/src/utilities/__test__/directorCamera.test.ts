import { describe, expect, it } from "vitest";
import {
    formatDirectorTime,
    getDirectorCameraStateAtTime,
    getDirectorCameraStateAtTimeFromSortedShots,
    sortDirectorCameraShots,
    type DirectorCameraShot,
} from "../directorCamera";
import { workspaceSettingsSchema } from "@/settings/workspaceSettings";

const shot = (
    id: string,
    timeSeconds: number,
    x: number,
    transitionSeconds = 2,
): DirectorCameraShot => ({
    id,
    name: `Shot ${id}`,
    timeSeconds,
    transitionSeconds,
    position: [x, 10, 20],
    target: [x, 0, 0],
    fov: 40 + x,
});

describe("director camera timeline", () => {
    it("sorts shots without mutating the saved list", () => {
        const saved = [shot("b", 8, 8), shot("a", 0, 0)];
        expect(sortDirectorCameraShots(saved).map(({ id }) => id)).toEqual([
            "a",
            "b",
        ]);
        expect(saved[0].id).toBe("b");
    });

    it("holds a shot until the next glide begins", () => {
        const shots = [shot("a", 0, 0), shot("b", 10, 10, 2)];
        expect(getDirectorCameraStateAtTime(shots, 7)?.position[0]).toBe(0);
    });

    it("glides smoothly and arrives exactly on the destination cue", () => {
        const shots = [shot("a", 0, 0), shot("b", 10, 10, 2)];
        expect(getDirectorCameraStateAtTime(shots, 9)?.position[0]).toBeCloseTo(
            5,
        );
        expect(getDirectorCameraStateAtTime(shots, 10)?.position[0]).toBe(10);
    });

    it("resolves pre-sorted shots without cloning them in a render loop", () => {
        const shots = [shot("a", 0, 0), shot("b", 10, 10, 2)];
        expect(
            getDirectorCameraStateAtTimeFromSortedShots(shots, 9)?.position[0],
        ).toBeCloseTo(5);
    });

    it("supports an instantaneous cut", () => {
        const shots = [shot("a", 0, 0), shot("b", 10, 10, 0)];
        expect(getDirectorCameraStateAtTime(shots, 9.99)?.position[0]).toBe(0);
        expect(getDirectorCameraStateAtTime(shots, 10)?.position[0]).toBe(10);
    });

    it("uses the first shot before its cue and formats cue times", () => {
        expect(
            getDirectorCameraStateAtTime([shot("a", 5, 3)], 0)?.position[0],
        ).toBe(3);
        expect(formatDirectorTime(65.25)).toBe("1:05.3");
    });
});

describe("director camera workspace settings", () => {
    it("adds an empty shot list when an older show has no director data", () => {
        expect(workspaceSettingsSchema.parse({}).directorCameraShots).toEqual(
            [],
        );
    });

    it("preserves valid saved shots", () => {
        const savedShot = shot("saved", 12.5, 4);
        expect(
            workspaceSettingsSchema.parse({
                directorCameraShots: [savedShot],
            }).directorCameraShots,
        ).toEqual([savedShot]);
    });
});
