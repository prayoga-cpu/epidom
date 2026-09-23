import type { PosOrderDisplay } from "../../types/pos.types";

/** A queue order with sensible defaults; override only what a test cares about. */
export function makeOrder(overrides: Partial<PosOrderDisplay> = {}): PosOrderDisplay {
  return {
    id: "o1",
    orderNumber: "POS-20260919-AB12CD",
    status: "CONFIRMED",
    source: "POS",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    paymentStatus: "PAID",
    customerName: "Budi",
    queueNumber: 12,
    tableNumber: "5",
    subtotal: 100000,
    total: 110000,
    items: [
      {
        id: "i1",
        menuItemId: "m1",
        name: "Americano",
        quantity: 2,
        unitPrice: 50000,
        total: 100000,
        status: "PENDING",
        menuItem: { name: "Americano" },
      },
    ],
    createdAt: "2026-09-19T05:36:00.000Z",
    ...overrides,
  } as PosOrderDisplay;
}
