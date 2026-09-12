import { create } from "zustand";

type SelectionStore = {
    selectedShapePageIds: number[];
    setSelectedShapePageIds: (ids: number[]) => void;
};

export const useSelectionStore = create<SelectionStore>((set) => ({
    selectedShapePageIds: [],
    setSelectedShapePageIds: (ids) =>
        set((state) => {
            const currentIds = state.selectedShapePageIds;
            const isUnchanged =
                currentIds.length === ids.length &&
                currentIds.every((id, index) => id === ids[index]);
            return isUnchanged ? state : { selectedShapePageIds: ids };
        }),
}));
