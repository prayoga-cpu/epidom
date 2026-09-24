import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * The supplier-order flow is two steps: create the order, tap Received.
 *  - Creating it places it (PLACED); there is no "mark as placed" step left.
 *  - Received is one tap, so a double tap or a second device sends it twice.
 *    Only one of those may add the delivery to stock.
 */

vi.mock("@/lib/api-handler", async () => {
  const { handleApiError } = await import("@/lib/utils/api-error-handler");
  return {
    withApiHandler:
      (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
      async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
        const params = await ctx.params;
        try {
          return await handler(req, { params, storeId: params.id, userId: "u1" });
        } catch (error) {
          return handleApiError(error, { endpoint: "test" });
        }
      },
  };
});
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/services", () => ({
  subscriptionService: { hasSupplierManagementAccess: vi.fn(async () => true) },
}));
const publishStockChanged = vi.hoisted(() => vi.fn());
vi.mock("@/lib/realtime/publish", () => ({ publishStockChanged }));

const tx = vi.hoisted(() => ({
  supplierOrder: { updateMany: vi.fn() },
  material: { update: vi.fn() },
  stockMovement: { create: vi.fn() },
}));
const prisma = vi.hoisted(() => ({
  supplier: { findFirst: vi.fn() },
  material: { findFirst: vi.fn() },
  supplierOrder: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { POST } from "../route";
import { PATCH } from "../[orderId]/route";

const STORE = "cmppdqplp000004l88zerz2ad";
const SUPPLIER = "cmppdqplp000004l88zerz2ae";
const MATERIAL = "cmppdqplp000004l88zerz2af";
const ORDER = "cmppdqplp000004l88zerz2ag";

const D = (n: number) => new Prisma.Decimal(n);

const openOrder = (status = "PLACED") => ({
  id: ORDER,
  storeId: STORE,
  orderNumber: "SO-1-0001",
  status,
  items: [
    {
      materialId: MATERIAL,
      quantity: D(5),
      unit: "kg",
      expiryDate: null,
      material: { id: MATERIAL, currentStock: D(2), expirationDate: null },
    },
  ],
});

const receive = () =>
  PATCH(
    new Request(`http://localhost/api/stores/${STORE}/supplier-orders/${ORDER}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "RECEIVED" }),
    }),
    { params: Promise.resolve({ id: STORE, orderId: ORDER }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
  prisma.supplierOrder.findFirst.mockResolvedValue(openOrder());
  prisma.supplierOrder.findUnique.mockResolvedValue({ ...openOrder("RECEIVED") });
  tx.supplierOrder.updateMany.mockResolvedValue({ count: 1 });
  tx.material.update.mockResolvedValue({ currentStock: D(7) });
});

describe("POST /supplier-orders — creating the order places it", () => {
  it("stores the new order as PLACED, not PENDING", async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: SUPPLIER });
    prisma.material.findFirst.mockResolvedValue({ id: MATERIAL, unit: "kg" });
    prisma.supplierOrder.count.mockResolvedValue(0);
    prisma.supplierOrder.create.mockResolvedValue({ id: ORDER });

    const res = await POST(
      new Request(`http://localhost/api/stores/${STORE}/supplier-orders`, {
        method: "POST",
        body: JSON.stringify({
          supplierId: SUPPLIER,
          expectedDate: "2026-09-25",
          items: [{ materialId: MATERIAL, quantity: 5, unit: "kg", unitPrice: 2 }],
        }),
      }),
      { params: Promise.resolve({ id: STORE }) }
    );

    expect(res.status).toBe(201);
    expect(prisma.supplierOrder.create.mock.calls[0][0].data.status).toBe("PLACED");
  });
});

describe("PATCH /supplier-orders/[orderId] — Received", () => {
  it("claims the transition conditionally, scoped to this store", async () => {
    const res = await receive();

    expect(res.status).toBe(200);
    const claim = tx.supplierOrder.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: ORDER, storeId: STORE, status: { not: "RECEIVED" } });
    expect(claim.data.status).toBe("RECEIVED");
    // No date picker any more: the receipt is dated when it's tapped.
    expect(claim.data.receivedDate).toBeInstanceOf(Date);
  });

  it("adds the delivery with an atomic increment and logs the resulting balance", async () => {
    await receive();

    // increment, not the stock read before the transaction + 5: a till sale in
    // between would otherwise be overwritten.
    expect(tx.material.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MATERIAL },
        data: { currentStock: { increment: D(5) } },
      })
    );
    const movement = tx.stockMovement.create.mock.calls[0][0].data;
    expect(movement.type).toBe("PURCHASE");
    expect(String(movement.balanceAfter)).toBe("7");
    expect(publishStockChanged).toHaveBeenCalledWith(STORE, { materialIds: [MATERIAL] });
  });

  it("a second tap that loses the claim adds nothing and answers 409", async () => {
    tx.supplierOrder.updateMany.mockResolvedValue({ count: 0 });

    const res = await receive();

    expect(res.status).toBe(409);
    expect(tx.material.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(publishStockChanged).not.toHaveBeenCalled();
  });

  it("an order already marked received never reaches the stock path", async () => {
    prisma.supplierOrder.findFirst.mockResolvedValue(openOrder("RECEIVED"));

    await receive();

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.material.update).not.toHaveBeenCalled();
  });
});
