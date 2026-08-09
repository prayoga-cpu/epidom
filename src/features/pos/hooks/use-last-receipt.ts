import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReceiptData } from "@/lib/pwa/thermal-printer";

/** Just enough order identity to power the printer menu's "Send via
 * WhatsApp" action alongside the reprint — deliberately not folded into
 * ReceiptData itself, which models what gets printed on paper, not the
 * underlying order's identity/contact info. */
export interface LastReceiptMeta {
  orderId: string;
  customerName: string;
  customerPhone: string | null;
}

interface LastReceiptState {
  receipt: ReceiptData | null;
  meta: LastReceiptMeta | null;
  setLastReceipt: (receipt: ReceiptData, meta: LastReceiptMeta) => void;
  clear: () => void;
}

/** The most recently completed order's receipt, for the printer menu's
 * "reprint last order" action — set once per successful checkout in
 * pos-checkout-dialog.tsx, read from pos-printer-menu.tsx. */
export const useLastReceipt = create<LastReceiptState>()(
  persist(
    (set) => ({
      receipt: null,
      meta: null,
      setLastReceipt: (receipt, meta) => set({ receipt, meta }),
      clear: () => set({ receipt: null, meta: null }),
    }),
    { name: "epidom-pos-last-receipt" }
  )
);
