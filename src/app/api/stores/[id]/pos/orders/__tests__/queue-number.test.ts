import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Wiring tests for the call-out number: the two POS routes that INSERT an order
 * row must take a number from allocateQueueNumber, inside the same transaction,
 * before the insert — and the paths that don't insert must not spend one.
 *
 * The allocator's own maths (store-local day, split sharing, the counter SQL) is
 * covered in src/lib/services/__tests__/order-queue-number.test.ts; what can go
 * wrong here is a route that forgets to call it, calls it on the bare client
 * instead of the transaction, or calls it after the insert.
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
  txMock.order.create.mockResolvedValue({ id: "o1", orderNumber: "POS-X", items: [], table: null });
});

describe("POST /pos/orders — call-out number", () => {
  it("allocates on the transaction client and stores the number on the new order", async () => {
    const res = await createOrder(post({ items: [], orderType: "DINE_IN" }), params);
    expect(res.status).toBe(201);

    expect(allocateQueueNumber).toHaveBeenCalledTimes(1);
    // The transaction client, not the bare prisma one — otherwise a rolled-back
    // order would keep its number and the sequence would skip.
    expect(allocateQueueNumber.mock.calls[0][0]).toBe(txMock);
    expect(allocateQueueNumber.mock.calls[0][1]).toMatchObject({ storeId: "store-1" });
    expect(txMock.order.create.mock.calls[0][0].data.queueNumber).toBe(42);
  });

  it("allocates before the insert, so the counter lock is held as briefly as possible", async () => {
    await createOrder(post({ items: [], orderType: "DINE_IN" }), params);
    const allocated = allocateQueueNumber.mock.invocationCallOrder[0];
    const inserted = txMock.order.create.mock.invocationCallOrder[0];
    expect(allocated).toBeLessThan(inserted);
  });

  it("hands the split group to the allocator so a split's bills share one number", async () => {
    await createOrder(post({ items: [], orderType: "DINE_IN", splitGroupId: "grp-9" }), params);
    expect(allocateQueueNumber.mock.calls[0][1]).toMatchObject({
      storeId: "store-1",
      splitGroupId: "grp-9",
    });
  });

  it("spends no number when an offline replay is de-duplicated to the existing order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "existing",
      orderNumber: "POS-OLD",
      status: "CONFIRMED",
      storeId: "store-1",
    });
    const res = await createOrder(
      post({ items: [], orderType: "DINE_IN", clientRequestId: "req-1" }),
      params
    );
    expect((await res.json()).data.deduplicated).toBe(true);
    expect(allocateQueueNumber).not.toHaveBeenCalled();
    expect(txMock.order.create).not.toHaveBeenCalled();
  });

  it("does not create the order when the allocation fails — the whole transaction fails", async () => {
    allocateQueueNumber.mockRejectedValue(new Error("counter unavailable"));
    const res = await createOrder(post({ items: [], orderType: "DINE_IN" }), params);
    expect(res.status).toBe(500);
    expect(txMock.order.create).not.toHaveBeenCalled();
  });
});

describe("POST /pos/orders/hold — call-out number", () => {
  it("gives a fresh hold its number at creation, on the transaction client", async () => {
    const res = await holdOrder(post({ items: [], orderType: "DINE_IN" }), params);
    expect(res.status).toBe(201);

    expect(allocateQueueNumber).toHaveBeenCalledTimes(1);
    expect(allocateQueueNumber.mock.calls[0][0]).toBe(txMock);
    expect(allocateQueueNumber.mock.calls[0][1]).toMatchObject({ storeId: "store-1" });
    expect(txMock.order.create.mock.calls[0][0].data.queueNumber).toBe(42);
    expect(allocateQueueNumber.mock.invocationCallOrder[0]).toBeLessThan(
      txMock.order.create.mock.invocationCallOrder[0]
    );
  });
});
