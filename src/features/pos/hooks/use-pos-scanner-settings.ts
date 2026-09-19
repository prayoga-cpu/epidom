import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SCAN_MAX_KEY_GAP_MS } from "../lib/barcode";

/**
 * How forgiving scan detection is about the pause between a scanner's keys:
 *  - standard: a wedge scanner's usual burst (SCAN_MAX_KEY_GAP_MS)
 *  - slow: Bluetooth scanners on a busy tablet can space their keys further apart
 */
export type PosScannerSpeed = "standard" | "slow";

export const POS_SCANNER_SPEEDS: readonly PosScannerSpeed[] = ["standard", "slow"];

export const SCANNER_SPEED_GAP_MS: Record<PosScannerSpeed, number> = {
  standard: SCAN_MAX_KEY_GAP_MS,
  slow: 120,
};

interface PosScannerSettingsState {
  /**
   * Off, nothing listens page-wide: a scan only counts when it lands in the
   * search box, whose own Enter handler still adds an exact barcode hit.
   */
  enabled: boolean;
  speed: PosScannerSpeed;
  setEnabled: (enabled: boolean) => void;
  setSpeed: (speed: PosScannerSpeed) => void;
}

/**
 * Per-device on purpose (localStorage, not a store setting), like the view mode:
 * the scanner is paired to one tablet, and how fast ITS keys arrive says nothing
 * about the scanner on the next till.
 */
export const usePosScannerSettings = create<PosScannerSettingsState>()(
  persist(
    (set) => ({
      enabled: true,
      speed: "standard",
      setEnabled: (enabled) => set({ enabled }),
      setSpeed: (speed) => set({ speed }),
    }),
    {
      name: "epidom-pos-scanner",
      partialize: (state) => ({ enabled: state.enabled, speed: state.speed }),
      // A value written by some other build (or hand-edited) must never leave
      // scanning switched off or mis-timed with no way to see why — fall back to
      // the defaults field by field instead of trusting it.
      merge: (persisted, current) => {
        const saved = persisted as Partial<PosScannerSettingsState> | undefined;
        return {
          ...current,
          enabled: typeof saved?.enabled === "boolean" ? saved.enabled : current.enabled,
          speed:
            saved?.speed && POS_SCANNER_SPEEDS.includes(saved.speed) ? saved.speed : current.speed,
        };
      },
    }
  )
);
