import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "epidom-pos-customer-display-settings";

interface CustomerDisplaySettingsState {
  /** Off by default — most tills are a single screen, and a store that has no
   * second monitor should never pay the cost of mirroring its cart. A
   * per-device setting (does *this* till have a customer screen attached),
   * not a store-wide config, so it lives in localStorage alongside the
   * printer's own per-till settings rather than on the Store row. */
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

export const useCustomerDisplaySettings = create<CustomerDisplaySettingsState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (value) => set({ enabled: value }),
    }),
    { name: STORAGE_KEY }
  )
);

// zustand's persist middleware hydrates once, at store creation, and never
// listens for later writes. Without this, a POS tab opened before the toggle
// was flipped keeps a stale `enabled` in memory — and since its publisher
// broadcasts on the same channel as the up-to-date tab, a stale `false` tab
// would blank a customer display the other tab is actively driving.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      const next = event.newValue ? JSON.parse(event.newValue)?.state?.enabled : false;
      if (typeof next === "boolean" && next !== useCustomerDisplaySettings.getState().enabled) {
        useCustomerDisplaySettings.setState({ enabled: next });
      }
    } catch {
      // A half-written or hand-edited entry — keep whatever this tab has.
    }
  });
}
