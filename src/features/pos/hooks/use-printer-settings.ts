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
  // 32 cols = 58mm, 48 cols = 80mm — matches ReceiptData["width"] in
  // thermal-printer.ts. A per-device/till setting (which physical printer is
  // paired here), not a store-wide config, so it lives alongside autoPrint.
  paperWidth: 32 | 48;
  connected: boolean;
  isConnecting: boolean;
  setAutoPrint: (value: boolean) => void;
  setPaperWidth: (value: 32 | 48) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

export const usePrinterSettings = create<PrinterSettingsState>()(
  persist(
    (set) => ({
      autoPrint: false,
      paperWidth: 32,
      // Not persisted (see partialize below) — the Bluetooth device pairing
      // itself never survives a reload, so a stale "connected: true" here
      // would just misrepresent the actual hardware state.
      connected: isBluetoothSupported() && isPrinterConnected(),
      isConnecting: false,

      setAutoPrint: (value) => set({ autoPrint: value }),
      setPaperWidth: (value) => set({ paperWidth: value }),

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
      partialize: (state) => ({ autoPrint: state.autoPrint, paperWidth: state.paperWidth }),
    }
  )
);
