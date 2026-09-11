import { useEffect, useRef } from "react";
import clsx from "clsx";
import {
    threeDiagnosticSnapshot,
    usePerformanceDiagnosticsStore,
    type DiagnosticSceneMode,
} from "@/stores/PerformanceDiagnosticsStore";
import type { FieldViewMode } from "./FieldView";

const SCENE_LABELS: Record<DiagnosticSceneMode, string> = {
    full: "Full scene",
    performers: "Performers + field",
    environment: "Environment + field",
    field: "Field only",
};

export default function PerformanceDiagnosticsPanel({
    viewMode,
}: {
    viewMode: FieldViewMode;
}) {
    const outputRef = useRef<HTMLPreElement>(null);
    const {
        enabled,
        freezePageUpdates,
        freezeWaveform,
        sceneMode,
        setEnabled,
        setFreezePageUpdates,
        setFreezeWaveform,
        setSceneMode,
    } = usePerformanceDiagnosticsStore();

    useEffect(() => {
        if (!enabled) return;
        let animationFrame = 0;
        let sampleStartedAt = performance.now();
        let previousFrameAt = sampleStartedAt;
        let frameCount = 0;
        let frameTotalMs = 0;
        let worstFrameMs = 0;

        const sample = (now: number) => {
            const frameMs = now - previousFrameAt;
            previousFrameAt = now;
            frameCount += 1;
            frameTotalMs += frameMs;
            worstFrameMs = Math.max(worstFrameMs, frameMs);

            if (now - sampleStartedAt >= 750 && outputRef.current) {
                const averageFrameMs = frameTotalMs / Math.max(1, frameCount);
                const lines = [
                    `App FPS          ${Math.round(1000 / averageFrameMs)}`,
                    `Average frame    ${averageFrameMs.toFixed(1)} ms`,
                    `Worst frame      ${worstFrameMs.toFixed(1)} ms`,
                ];
                if (viewMode === "3d" && threeDiagnosticSnapshot.fps !== null) {
                    lines.push(
                        `3D FPS           ${threeDiagnosticSnapshot.fps}`,
                        `3D average       ${threeDiagnosticSnapshot.averageFrameMs?.toFixed(1)} ms`,
                        `3D worst         ${threeDiagnosticSnapshot.worstFrameMs?.toFixed(1)} ms`,
                        `Draw calls       ${threeDiagnosticSnapshot.drawCalls?.toLocaleString()}`,
                        `Triangles        ${threeDiagnosticSnapshot.triangles?.toLocaleString()}`,
                        `Geometries       ${threeDiagnosticSnapshot.geometries?.toLocaleString()}`,
                        `Textures         ${threeDiagnosticSnapshot.textures?.toLocaleString()}`,
                    );
                }
                outputRef.current.textContent = lines.join("\n");
                sampleStartedAt = now;
                frameCount = 0;
                frameTotalMs = 0;
                worstFrameMs = 0;
            }

            animationFrame = requestAnimationFrame(sample);
        };

        animationFrame = requestAnimationFrame(sample);
        return () => cancelAnimationFrame(animationFrame);
    }, [enabled, viewMode]);

    return (
        <div className="absolute top-6 left-6 z-30 flex flex-col items-start gap-[8px]">
            <button
                type="button"
                aria-pressed={enabled}
                onClick={() => setEnabled(!enabled)}
                className={clsx(
                    "rounded-6 border px-8 py-5 text-xs font-semibold whitespace-nowrap shadow-lg backdrop-blur-sm",
                    enabled
                        ? "border-accent bg-fg-2 text-accent"
                        : "border-stroke bg-bg-1/90 text-text hover:bg-fg-2",
                )}
            >
                Diagnostics {enabled ? "on" : "off"}
            </button>

            {enabled && (
                <div className="border-stroke bg-bg-1/95 text-text flex w-[300px] max-w-[calc(100vw-24px)] flex-col gap-[10px] rounded-lg border p-[12px] text-xs shadow-xl backdrop-blur-sm">
                    <label className="flex items-start gap-[8px] leading-[18px]">
                        <input
                            type="checkbox"
                            checked={freezePageUpdates}
                            className="mt-[2px] shrink-0"
                            onChange={(event) =>
                                setFreezePageUpdates(event.target.checked)
                            }
                        />
                        Freeze editor page updates
                    </label>
                    <label className="flex items-start gap-[8px] leading-[18px]">
                        <input
                            type="checkbox"
                            checked={freezeWaveform}
                            className="mt-[2px] shrink-0"
                            onChange={(event) =>
                                setFreezeWaveform(event.target.checked)
                            }
                        />
                        Freeze waveform progress
                    </label>
                    {viewMode === "3d" && (
                        <label className="flex flex-col gap-[5px] leading-[18px]">
                            <span>Scene isolation</span>
                            <select
                                value={sceneMode}
                                onChange={(event) =>
                                    setSceneMode(
                                        event.target
                                            .value as DiagnosticSceneMode,
                                    )
                                }
                                className="border-stroke bg-bg-2 rounded-4 w-full border px-[8px] py-[6px]"
                            >
                                {(
                                    Object.keys(
                                        SCENE_LABELS,
                                    ) as DiagnosticSceneMode[]
                                ).map((mode) => (
                                    <option key={mode} value={mode}>
                                        {SCENE_LABELS[mode]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <pre
                        ref={outputRef}
                        className="m-0 w-full overflow-hidden font-mono leading-[18px] whitespace-pre tabular-nums"
                    />
                    <p className="border-stroke text-text/60 border-t pt-[8px] leading-[16px]">
                        Change one option at a time while playing the same
                        pages.
                    </p>
                </div>
            )}
        </div>
    );
}
