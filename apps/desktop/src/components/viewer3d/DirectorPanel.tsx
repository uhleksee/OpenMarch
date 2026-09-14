import clsx from "clsx";
import {
    formatDirectorTime,
    type DirectorCameraShot,
} from "@/utilities/directorCamera";

const TRANSITION_OPTIONS = [0, 1, 2, 4, 6] as const;

interface DirectorPanelProps {
    shots: DirectorCameraShot[];
    enabled: boolean;
    canCapture: boolean;
    selectedPageName: string;
    onToggle: () => void;
    onCapture: () => void;
    onPreview: (shot: DirectorCameraShot) => void;
    onDelete: (shotId: string) => void;
    onTransitionChange: (shotId: string, transitionSeconds: number) => void;
}

export default function DirectorPanel({
    shots,
    enabled,
    canCapture,
    selectedPageName,
    onToggle,
    onCapture,
    onPreview,
    onDelete,
    onTransitionChange,
}: DirectorPanelProps) {
    return (
        <details className="border-stroke bg-bg-1/92 text-text w-[22rem] max-w-full rounded-lg border shadow-lg backdrop-blur-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium select-none">
                Director mode · {shots.length} shot
                {shots.length === 1 ? "" : "s"}
            </summary>
            <div className="border-stroke flex flex-col gap-4 border-t p-4 text-xs">
                <div className="flex gap-3">
                    <button
                        type="button"
                        aria-pressed={enabled}
                        disabled={shots.length === 0}
                        onClick={onToggle}
                        className={clsx(
                            "rounded-4 flex-1 border px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                            enabled
                                ? "border-accent bg-fg-2 text-accent"
                                : "border-stroke hover:bg-fg-2",
                        )}
                    >
                        Director {enabled ? "on" : "off"}
                    </button>
                    <button
                        type="button"
                        disabled={!canCapture}
                        onClick={onCapture}
                        className="border-stroke hover:bg-fg-2 rounded-4 flex-1 border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        Capture shot
                    </button>
                </div>

                <p className="text-text/60">
                    Capture the current camera at page {selectedPageName}. The
                    glide arrives exactly on each shot’s cue.
                </p>

                {shots.length === 0 ? (
                    <p className="border-stroke text-text/60 rounded-4 border border-dashed px-4 py-5 text-center">
                        Position the camera, then capture your first shot.
                    </p>
                ) : (
                    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                        {shots.map((shot, index) => (
                            <div
                                key={shot.id}
                                className="border-stroke bg-bg-2 rounded-4 grid grid-cols-[1fr_auto] gap-3 border p-3"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {index + 1}. {shot.name}
                                    </p>
                                    <p className="text-text/55 font-mono">
                                        {formatDirectorTime(shot.timeSeconds)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-text/65 flex items-center gap-1">
                                        Glide
                                        <select
                                            aria-label={`Transition for ${shot.name}`}
                                            value={shot.transitionSeconds}
                                            onChange={(event) =>
                                                onTransitionChange(
                                                    shot.id,
                                                    Number(event.target.value),
                                                )
                                            }
                                            className="border-stroke bg-bg-1 rounded-4 border px-2 py-1"
                                        >
                                            {TRANSITION_OPTIONS.map(
                                                (seconds) => (
                                                    <option
                                                        key={seconds}
                                                        value={seconds}
                                                    >
                                                        {seconds === 0
                                                            ? "Cut"
                                                            : `${seconds}s`}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => onPreview(shot)}
                                        className="hover:bg-fg-1 rounded-4 px-2 py-1"
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={`Delete ${shot.name}`}
                                        onClick={() => onDelete(shot.id)}
                                        className="rounded-4 px-2 py-1 text-red-400 hover:bg-red-500/15"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-text/50">
                    Shots are saved with this show and are reused by 3D video
                    export.
                </p>
            </div>
        </details>
    );
}
