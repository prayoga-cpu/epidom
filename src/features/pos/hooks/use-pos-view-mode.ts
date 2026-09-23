import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * How the POS menu lays its items out:
 *  - grid: image tiles (the original look)
 *  - columns: compact text-forward tiles, more per row
 *  - list: one row per item with a thumbnail
 */
export type PosViewMode = "grid" | "columns" | "list";

export const POS_VIEW_MODES: readonly PosViewMode[] = ["grid", "columns", "list"];

interface PosViewModeState {
  viewMode: PosViewMode;
  setViewMode: (mode: PosViewMode) => void;
}

/**
 * Per-device on purpose (localStorage, not a store setting): a phone at the
 * counter and the iPad at the till are held differently, and one cashier's
 * preference must not rewrite what another device shows.
 */
export const usePosViewMode = create<PosViewModeState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: "epidom-pos-view-mode",
      partialize: (state) => ({ viewMode: state.viewMode }),
      // A value written by some other build (or hand-edited) must never leave the
      // grid rendering nothing — fall back to the default instead of trusting it.
      merge: (persisted, current) => {
        const mode = (persisted as Partial<PosViewModeState> | undefined)?.viewMode;
        return {
          ...current,
          viewMode: mode && POS_VIEW_MODES.includes(mode) ? mode : current.viewMode,
        };
      },
    }
  )
);
