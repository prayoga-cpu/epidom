import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

interface LastReceiptState {
  receipt: ReceiptData | null;
  setLastReceipt: (receipt: ReceiptData) => void;
  clear: () => void;
}

/** The most recently completed order's receipt, for the printer menu's
 * "reprint last order" action — set once per successful checkout in
 * pos-checkout-dialog.tsx, read from pos-printer-menu.tsx. */
export const useLastReceipt = create<LastReceiptState>()(
  persist(
    (set) => ({
      receipt: null,
      setLastReceipt: (receipt) => set({ receipt }),
      clear: () => set({ receipt: null }),
    }),
    { name: "epidom-pos-last-receipt" }
  )
);
