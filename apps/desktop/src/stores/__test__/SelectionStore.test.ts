import { beforeEach, describe, expect, it } from "vitest";
import { useSelectionStore } from "../SelectionStore";

describe("SelectionStore", () => {
    beforeEach(() => {
        useSelectionStore.getState().setSelectedShapePageIds([]);
    });

    it("does not publish an unchanged selection", () => {
        let updates = 0;
        const unsubscribe = useSelectionStore.subscribe(() => {
            updates += 1;
        });

        useSelectionStore.getState().setSelectedShapePageIds([]);
        useSelectionStore.getState().setSelectedShapePageIds([12, 24]);
        useSelectionStore.getState().setSelectedShapePageIds([12, 24]);

        expect(updates).toBe(1);
        unsubscribe();
    });
});
