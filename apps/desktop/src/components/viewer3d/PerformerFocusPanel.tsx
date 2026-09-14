import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Marcher, { compare as compareMarchers } from "@/global/classes/Marcher";
import MarcherPage from "@/global/classes/MarcherPage";
import { ReadableCoords } from "@/global/classes/ReadableCoords";

export type PerformerFocusMode =
    | "free"
    | "followPerformer"
    | "followSection"
    | "pov";

export type MotionTrailMode = "off" | "performer" | "section";

export interface PerformerFocusPanelProps {
    marchers: Marcher[];
    selectedMarcher: Marcher | null;
    selectedMarcherPage?: MarcherPage;
    selectedPageName: string;
    focusMode: PerformerFocusMode;
    trailMode: MotionTrailMode;
    onSelectMarcher: (marcherId: number | null) => void;
    onFocusModeChange: (mode: PerformerFocusMode) => void;
    onTrailModeChange: (mode: MotionTrailMode) => void;
}

const formatRawCoordinate = (value: number): string =>
    Number.isFinite(value) ? value.toFixed(1) : "—";

const formatCoordinate = (marcherPage?: MarcherPage): string => {
    if (!marcherPage) return "Unavailable";

    try {
        const readable = ReadableCoords.fromMarcherPage(marcherPage);
        return `${readable.toTerseStringX()} · ${readable.toTerseStringY()}`;
    } catch {
        return `X ${formatRawCoordinate(marcherPage.x)} · Y ${formatRawCoordinate(marcherPage.y)}`;
    }
};

const formatFacing = (marcherPage?: MarcherPage): string => {
    if (!marcherPage || !Number.isFinite(marcherPage.rotation_degrees))
        return "Unavailable";

    const rounded = Math.round(marcherPage.rotation_degrees * 10) / 10;
    return `${rounded}°`;
};

const focusOptions: ReadonlyArray<{
    mode: PerformerFocusMode;
    label: string;
    requiresPerformer: boolean;
}> = [
    { mode: "free", label: "Free", requiresPerformer: false },
    {
        mode: "followPerformer",
        label: "Follow performer",
        requiresPerformer: true,
    },
    {
        mode: "followSection",
        label: "Follow section",
        requiresPerformer: true,
    },
    { mode: "pov", label: "POV", requiresPerformer: true },
];

const trailOptions: ReadonlyArray<{
    mode: MotionTrailMode;
    label: string;
    requiresPerformer: boolean;
}> = [
    { mode: "off", label: "Off", requiresPerformer: false },
    { mode: "performer", label: "Performer", requiresPerformer: true },
    { mode: "section", label: "Section", requiresPerformer: true },
];

const selectionButtonClass = (selected: boolean) =>
    clsx(
        "rounded-4 border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        selected
            ? "border-accent bg-fg-2 text-accent"
            : "border-stroke hover:bg-fg-2",
    );

export default function PerformerFocusPanel({
    marchers,
    selectedMarcher,
    selectedMarcherPage,
    selectedPageName,
    focusMode,
    trailMode,
    onSelectMarcher,
    onFocusModeChange,
    onTrailModeChange,
}: PerformerFocusPanelProps) {
    const sortedMarchers = useMemo(
        () => [...marchers].sort(compareMarchers),
        [marchers],
    );
    const hasSelection = selectedMarcher !== null;
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        if (selectedMarcher) setExpanded(true);
    }, [selectedMarcher]);

    return (
        <section
            aria-label="Performer focus controls"
            className="border-stroke bg-bg-1/92 text-text flex w-[22rem] max-w-full flex-col rounded-lg border p-4 text-xs shadow-lg backdrop-blur-sm"
        >
            <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="hover:bg-fg-2 -m-2 flex items-center justify-between gap-4 rounded-md p-2 text-left transition-colors"
            >
                <h2 className="text-sm font-medium">Performer focus</h2>
                <span className="flex items-center gap-3">
                    {selectedMarcher && (
                        <span className="text-accent font-mono font-medium">
                            {selectedMarcher.drill_number}
                        </span>
                    )}
                    <span aria-hidden="true" className="text-text/60">
                        {expanded ? "▾" : "▸"}
                    </span>
                </span>
            </button>

            {expanded && (
                <div className="mt-4 flex flex-col gap-4">
                    <label
                        className="flex flex-col gap-1"
                        htmlFor="3d-performer-focus"
                    >
                        <span className="text-text/70">Performer</span>
                        <select
                            id="3d-performer-focus"
                            value={selectedMarcher?.id ?? ""}
                            onChange={(event) =>
                                onSelectMarcher(
                                    event.target.value === ""
                                        ? null
                                        : Number(event.target.value),
                                )
                            }
                            className="border-stroke bg-bg-2 rounded-4 border px-3 py-2"
                        >
                            <option value="">Select a performer…</option>
                            {sortedMarchers.map((marcher) => (
                                <option key={marcher.id} value={marcher.id}>
                                    {marcher.drill_number} · {marcher.section}
                                </option>
                            ))}
                        </select>
                    </label>

                    {selectedMarcher ? (
                        <div className="border-stroke bg-bg-2 rounded-4 border p-3">
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                                <dt className="text-text/60">Name</dt>
                                <dd className="min-w-0 truncate text-right">
                                    {selectedMarcher.name?.trim() || "—"}
                                </dd>
                                <dt className="text-text/60">Section</dt>
                                <dd className="min-w-0 truncate text-right">
                                    {selectedMarcher.section}
                                </dd>
                                <dt className="text-text/60">Year</dt>
                                <dd className="min-w-0 truncate text-right">
                                    {selectedMarcher.year?.trim() || "—"}
                                </dd>
                                <dt className="text-text/60">Page</dt>
                                <dd className="min-w-0 truncate text-right">
                                    {selectedPageName}
                                </dd>
                                <dt className="text-text/60">Facing</dt>
                                <dd className="text-right font-mono">
                                    {formatFacing(selectedMarcherPage)}
                                </dd>
                                <dt className="text-text/60">Coordinate</dt>
                                <dd className="min-w-0 text-right font-mono leading-snug">
                                    {formatCoordinate(selectedMarcherPage)}
                                </dd>
                            </dl>
                        </div>
                    ) : (
                        <p className="border-stroke text-text/60 rounded-4 border border-dashed px-4 py-5 text-center">
                            Click a performer on the field or choose one above.
                        </p>
                    )}

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-text/70 mb-1">Camera</legend>
                        <div className="grid grid-cols-2 gap-2">
                            {focusOptions.map((option) => (
                                <button
                                    key={option.mode}
                                    type="button"
                                    aria-pressed={focusMode === option.mode}
                                    disabled={
                                        option.requiresPerformer &&
                                        !hasSelection
                                    }
                                    onClick={() =>
                                        onFocusModeChange(option.mode)
                                    }
                                    className={selectionButtonClass(
                                        focusMode === option.mode,
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="flex flex-col gap-2">
                        <legend className="text-text/70 mb-1">
                            Motion trails
                        </legend>
                        <div className="grid grid-cols-3 gap-2">
                            {trailOptions.map((option) => (
                                <button
                                    key={option.mode}
                                    type="button"
                                    aria-pressed={trailMode === option.mode}
                                    disabled={
                                        option.requiresPerformer &&
                                        !hasSelection
                                    }
                                    onClick={() =>
                                        onTrailModeChange(option.mode)
                                    }
                                    className={selectionButtonClass(
                                        trailMode === option.mode,
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <p className="text-text/50">
                        Viewing tools only. Drill coordinates and performer
                        details are never changed here.
                    </p>
                </div>
            )}
        </section>
    );
}
