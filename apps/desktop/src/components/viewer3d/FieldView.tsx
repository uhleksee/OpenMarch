import { lazy, Suspense, useEffect, useState } from "react";
import Canvas from "@/components/canvas/Canvas";
import CanvasZoomControls from "@/components/canvas/CanvasZoomControls";
import OpenMarchCanvas from "@/global/classes/canvasObjects/OpenMarchCanvas";
import clsx from "clsx";

const ThreeDViewer = lazy(() => import("./ThreeDViewer"));

export type FieldViewMode = "2d" | "3d";

interface FieldViewProps {
    canvas?: OpenMarchCanvas;
    onCanvasReady: (canvas: OpenMarchCanvas | undefined) => void;
}

export default function FieldView({ canvas, onCanvasReady }: FieldViewProps) {
    const [viewMode, setViewMode] = useState<FieldViewMode>("2d");

    useEffect(() => {
        if (viewMode !== "3d") return;

        const blockEditorShortcuts = (event: KeyboardEvent) => {
            if (
                document.activeElement?.matches(
                    "input, textarea, select, [contenteditable]",
                )
            )
                return;

            const hasCommandModifier =
                event.metaKey || event.ctrlKey || event.altKey;
            const isPlayback = event.code === "Space" && !hasCommandModifier;
            const isPageNavigation =
                (event.code === "KeyQ" || event.code === "KeyE") &&
                !hasCommandModifier;

            if (isPlayback || isPageNavigation) return;

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        window.addEventListener("keydown", blockEditorShortcuts, true);
        return () => {
            window.removeEventListener("keydown", blockEditorShortcuts, true);
        };
    }, [viewMode]);

    return (
        <div className="relative flex h-full min-h-0 min-w-0 flex-1">
            {viewMode === "2d" && (
                <Canvas active onCanvasReady={onCanvasReady} />
            )}
            {viewMode === "3d" && (
                <Suspense
                    fallback={
                        <div className="bg-bg-2 text-text flex h-full w-full items-center justify-center">
                            Loading 3D field…
                        </div>
                    }
                >
                    <ThreeDViewer />
                </Suspense>
            )}

            <div
                className="border-stroke bg-bg-1/90 absolute top-6 left-1/2 z-20 flex -translate-x-1/2 overflow-hidden rounded-lg border p-2 shadow-lg backdrop-blur-sm"
                aria-label="Field view"
            >
                {(["2d", "3d"] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        onClick={() => {
                            if (mode === "3d") onCanvasReady(undefined);
                            setViewMode(mode);
                        }}
                        className={clsx(
                            "rounded-6 min-w-48 px-10 py-6 text-sm font-semibold uppercase transition-colors",
                            viewMode === mode
                                ? "bg-accent text-black"
                                : "text-text hover:bg-fg-2",
                        )}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            {viewMode === "2d" && <CanvasZoomControls canvas={canvas} />}
        </div>
    );
}
