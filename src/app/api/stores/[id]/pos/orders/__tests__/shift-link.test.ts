import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Wiring tests for the shift a POS sale attaches to. The client names the shift it
 * believes is open — learned at sign-in and refreshed by a 60s poll — and with one till
 * shared by every tablet that belief can be stale: another tablet may have finished the
 * shift, or opened the next. The routes must store what the SERVER resolves (see
 * lib/services/shift-link.ts, tested on its own), never the raw claim: a sale on a closed
 * shift is missing from that shift's frozen expected cash and makes the next drawer read
 * Over, and a foreign shift id would link an order to another tenant's till.
 */

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

var prismaMock: any;
var txMock: any;
vi.mock("@/lib/prisma", () => {
  txMock = {
    order: { create: vi.fn() },
    table: { updateMany: vi.fn() },
  };
  prismaMock = {
    order: { findUnique: vi.fn(), findFirst: vi.fn() },
    shift: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(txMock)),
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/auth/require-session", () => ({
  requireSessionApi: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccessWithResponse: vi.fn(async () => ({
    store: { id: "store-1", name: "Test Store", phone: null, kitchenDisplayEnabled: true },
    accessType: "owner",
  })),
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/realtime/publish", () => ({ publishStoreEvent: vi.fn() }));
vi.mock("@/lib/server/serialize", () => ({ serializePosOrders: (o: unknown) => o }));

// Bodies go straight through — validation is not what's under test.
vi.mock("@/lib/validation/pos.schemas", () => ({
  createPosOrderSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
  createHoldOrderSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
}));

const allocateQueueNumber = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/order-queue-number", () => ({ allocateQueueNumber }));

vi.mock("@/lib/services/pos-order-settlement", () => ({
  buildPosSettlement: vi.fn(async () => ({
    immediatelyDelivered: false,
    settledStatus: "CONFIRMED",
    customerName: "Budi",
    paymentMethod: "CASH",
    charges: { total: 100 },
    orderItems: [],
    tenders: [],
  })),
  buildSettlementOrderData: vi.fn(() => ({ notes: null })),
  applySettlementBookkeeping: vi.fn(async () => ({ pointsEarned: 0 })),
  buildPosOrderCreatedResponse: vi.fn(() => ({})),
  buildOrderItemCreateData: vi.fn(() => []),
  mapSettlementError: vi.fn(() => null),
  posOrderSource: vi.fn((input: { onlinePlatform?: string }) => input.onlinePlatform ?? "POS"),
  resolveStoreTableId: vi.fn(async () => null),
  SettlementError: class SettlementError extends Error {},
  POS_ORDER_TX_TIMEOUT_MS: 15000,
}));
vi.mock("@/lib/services/pos-order-builder", () => ({
  deliverOrderImmediately: vi.fn(),
  draftShortfallBatchesForConfirmedOrder: vi.fn(),
  validateAndBuildOrderItems: vi.fn(async () => ({ orderItems: [], subtotal: 0 })),
}));
vi.mock("@/lib/services/order-status.helpers", () => ({ claimOrderTransition: vi.fn() }));
vi.mock("@/lib/services/pos-discount.service", () => ({
  resolveOrderDiscount: vi.fn(async () => ({ discountAmount: 0 })),
}));
vi.mock("@/lib/services", () => ({
  resolveFinanceSettingsForOrder: vi.fn(async () => ({})),
}));
vi.mock("@/lib/finance/order-charges", () => ({
  computeOrderCharges: vi.fn(() => ({
    subtotal: 0,
    tax: 0,
    total: 0,
    discountAmount: 0,
    serviceCharge: 0,
    processingFee: 0,
    taxRate: 0,
    serviceChargeRate: 0,
    processingFeeRate: 0,
  })),
}));

import { POST as createOrder } from "../route";
import { POST as holdOrder } from "../hold/route";

const params = { params: Promise.resolve({ id: "store-1" }) };
const post = (body: object) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  allocateQueueNumber.mockResolvedValue(42);
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));
  prismaMock.shift.findMany.mockResolvedValue([]);
  txMock.order.create.mockResolvedValue({ id: "o1", orderNumber: "POS-X", items: [], table: null });
});

const open = (id: string) => ({ id, closedAt: null });
const closed = (id: string) => ({ id, closedAt: new Date("2026-09-20T10:00:00Z") });
const storedShiftId = () => txMock.order.create.mock.calls[0][0].data.shiftId;

describe.each([
  ["POST /pos/orders", createOrder],
  ["POST /pos/orders/hold", holdOrder],
])("%s — the shift a sale attaches to", (_name, handler) => {
  it("the named shift is open in this store: stored as named", async () => {
    prismaMock.shift.findMany.mockResolvedValue([open("S1")]);
    const res = await handler(post({ items: [], orderType: "DINE_IN", shiftId: "S1" }), params);
    expect(res.status).toBe(201);
    expect(storedShiftId()).toBe("S1");
  });

  it("the named shift was finished and another opened: the sale goes to the CURRENT one", async () => {
    prismaMock.shift.findMany.mockResolvedValue([open("S2"), closed("S1")]);
    await handler(post({ items: [], orderType: "DINE_IN", shiftId: "S1" }), params);
    expect(storedShiftId()).toBe("S2");
  });

  it("the named shift was finished and none is open: the sale is unlinked, not filed on the closed shift", async () => {
    prismaMock.shift.findMany.mockResolvedValue([closed("S1")]);
    await handler(post({ items: [], orderType: "DINE_IN", shiftId: "S1" }), params);
    expect(storedShiftId()).toBeNull();
  });

  it("a shift id from another store is never stored, and the lookup is scoped to THIS store", async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    await handler(post({ items: [], orderType: "DINE_IN", shiftId: "OTHER_STORES_SHIFT" }), params);

    expect(storedShiftId()).not.toBe("OTHER_STORES_SHIFT");
    expect(prismaMock.shift.findMany.mock.calls[0][0].where.storeId).toBe("store-1");
  });

  it("no shift named (an offline replay): nothing is guessed and the database isn't asked", async () => {
    await handler(post({ items: [], orderType: "DINE_IN" }), params);
    expect(prismaMock.shift.findMany).not.toHaveBeenCalled();
    expect(storedShiftId()).toBeUndefined();
  });
});
