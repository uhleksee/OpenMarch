import { describe, expect, it } from "vitest";
import {
    formatDirectorTime,
    getDirectorCameraStateAtTime,
    getDirectorCameraStateAtTimeFromSortedShots,
    interpolateCameraRollDegrees,
    sortDirectorCameraShots,
    type DirectorCameraShot,
} from "../directorCamera";
import {
    parseWorkspaceSettings,
    serializeWorkspaceSettings,
    workspaceSettingsSchema,
} from "@/settings/workspaceSettings";

const shot = (
    id: string,
    timeSeconds: number,
    x: number,
    transitionSeconds = 2,
    rollDegrees = 0,
): DirectorCameraShot => ({
    id,
    name: `Shot ${id}`,
    timeSeconds,
    transitionSeconds,
    position: [x, 10, 20],
    target: [x, 0, 0],
    fov: 40 + x,
    rollDegrees,
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
        const shots = [shot("a", 0, 0, 2, -10), shot("b", 10, 10, 2, 30)];
        expect(getDirectorCameraStateAtTime(shots, 7)).toMatchObject({
            position: [0, 10, 20],
            rollDegrees: -10,
        });
    });

    it("glides smoothly and arrives exactly on the destination cue", () => {
        const shots = [shot("a", 0, 0, 2, 0), shot("b", 10, 10, 2, 90)];
        expect(getDirectorCameraStateAtTime(shots, 9)?.position[0]).toBeCloseTo(
            5,
        );
        expect(getDirectorCameraStateAtTime(shots, 9)?.rollDegrees).toBe(45);
        expect(getDirectorCameraStateAtTime(shots, 10)).toMatchObject({
            position: [10, 10, 20],
            rollDegrees: 90,
        });
    });

    it("resolves pre-sorted shots without cloning them in a render loop", () => {
        const shots = [shot("a", 0, 0, 2, -20), shot("b", 10, 10, 2, 20)];
        expect(
            getDirectorCameraStateAtTimeFromSortedShots(shots, 9),
        ).toMatchObject({
            position: [5, 10, 20],
            rollDegrees: 0,
        });
    });

    it("supports an instantaneous cut", () => {
        const shots = [shot("a", 0, 0, 2, -15), shot("b", 10, 10, 0, 25)];
        expect(getDirectorCameraStateAtTime(shots, 9.99)).toMatchObject({
            position: [0, 10, 20],
            rollDegrees: -15,
        });
        expect(getDirectorCameraStateAtTime(shots, 10)).toMatchObject({
            position: [10, 10, 20],
            rollDegrees: 25,
        });
    });

    it("interpolates roll over the shortest arc across the angle seam", () => {
        expect(interpolateCameraRollDegrees(170, -170, 0.5)).toBe(180);
        expect(interpolateCameraRollDegrees(-170, 170, 0.5)).toBe(-180);
        expect(interpolateCameraRollDegrees(170, -170, 1)).toBe(-170);
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

    it("defaults legacy saved shots to zero roll without losing other settings", () => {
        const { rollDegrees: _rollDegrees, ...legacyShot } = shot(
            "legacy",
            12.5,
            4,
        );
        const settings = parseWorkspaceSettings(
            JSON.stringify({
                projectName: "Legacy show",
                defaultTempo: 144,
                directorCameraShots: [legacyShot],
            }),
        );

        expect(settings.projectName).toBe("Legacy show");
        expect(settings.defaultTempo).toBe(144);
        expect(settings.directorCameraShots[0]).toMatchObject({
            id: "legacy",
            rollDegrees: 0,
        });
    });

    it("preserves valid saved shots", () => {
        const savedShot = shot("saved", 12.5, 4, 2, 27.5);
        const parsedSettings = workspaceSettingsSchema.parse({
            projectName: "Roll test",
            directorCameraShots: [savedShot],
        });
        const roundTripped = parseWorkspaceSettings(
            serializeWorkspaceSettings(parsedSettings),
        );

        expect(roundTripped.projectName).toBe("Roll test");
        expect(roundTripped.directorCameraShots).toEqual([savedShot]);
    });
});
