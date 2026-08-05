import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  connectPrinter,
  disconnectPrinter,
  isBluetoothSupported,
  isPrinterConnected,
} from "@/lib/pwa/thermal-printer";

interface PrinterSettingsState {
  autoPrint: boolean;
  connected: boolean;
  isConnecting: boolean;
  setAutoPrint: (value: boolean) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

export const usePrinterSettings = create<PrinterSettingsState>()(
  persist(
    (set) => ({
      autoPrint: false,
      // Not persisted (see partialize below) — the Bluetooth device pairing
      // itself never survives a reload, so a stale "connected: true" here
      // would just misrepresent the actual hardware state.
      connected: isBluetoothSupported() && isPrinterConnected(),
      isConnecting: false,

      setAutoPrint: (value) => set({ autoPrint: value }),

      connect: async () => {
        set({ isConnecting: true });
        try {
          const ok = await connectPrinter(() => set({ connected: false }));
          set({ connected: ok });
          return ok;
        } finally {
          set({ isConnecting: false });
        }
      },

      disconnect: () => {
        disconnectPrinter();
        set({ connected: false });
      },
    }),
    {
      name: "epidom-pos-printer-settings",
      partialize: (state) => ({ autoPrint: state.autoPrint }),
    }
  )
);
