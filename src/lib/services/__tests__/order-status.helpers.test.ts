import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  claimOrderTransition,
  claimOrderTransitions,
  resolveInitialOrderItemStatus,
} from "../order-status.helpers";

describe("resolveInitialOrderItemStatus", () => {
  it("returns SERVED for a CUSTOM-productLine item — no kitchen/bar prep step", () => {
    expect(resolveInitialOrderItemStatus("CUSTOM")).toBe("SERVED");
  });

  it("returns PENDING for a STANDARD-productLine item", () => {
    expect(resolveInitialOrderItemStatus("STANDARD")).toBe("PENDING");
  });

  it("returns PENDING when productLine is null/undefined (unresolvable product)", () => {
    expect(resolveInitialOrderItemStatus(null)).toBe("PENDING");
    expect(resolveInitialOrderItemStatus(undefined)).toBe("PENDING");
  });

  // POS "Custom Item" — an ad-hoc line with no MenuItem, so it carries its own
  // prep area. No prep area means no KDS ticket, so nothing would ever move it
  // off PENDING.
  it("returns SERVED for a Custom Item with no prep area", () => {
    expect(resolveInitialOrderItemStatus(null, { isCustom: true, department: null })).toBe(
      "SERVED"
    );
    expect(resolveInitialOrderItemStatus(null, { isCustom: true })).toBe("SERVED");
  });

  it("returns PENDING for a Custom Item routed to a prep area", () => {
    expect(resolveInitialOrderItemStatus(null, { isCustom: true, department: "KITCHEN" })).toBe(
      "PENDING"
    );
    expect(resolveInitialOrderItemStatus(null, { isCustom: true, department: "BAR" })).toBe(
      "PENDING"
    );
  });

  it("ignores the custom branch for an ordinary line", () => {
    expect(resolveInitialOrderItemStatus("CUSTOM", { isCustom: false, department: null })).toBe(
      "SERVED"
    );
    expect(resolveInitialOrderItemStatus("STANDARD", { isCustom: false, department: null })).toBe(
      "PENDING"
    );
  });
});

/**
 * The claim primitives are the only thing standing between two tills and a
 * double-spend. What is being asserted is narrow but load-bearing: the guard
 * and the store scope both end up in the WHERE of a single updateMany (so the
 * check and the write are one statement), and a zero-row result is reported as
 * a loss rather than swallowed.
 */
describe("claimOrderTransition", () => {
  let tx: any;

  beforeEach(() => {
    tx = { order: { updateMany: vi.fn() } };
  });

  it("folds the guard, the id and the store scope into one guarded write", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 1 });

    const won = await claimOrderTransition(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      guard: { status: "HELD" },
      data: { status: "CONFIRMED" },
    });

    expect(won).toBe(true);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { status: "HELD", id: "ord-1", storeId: "store-1" },
      data: { status: "CONFIRMED" },
    });
  });

  it("reports a loss when the row no longer matches the guard", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      claimOrderTransition(tx, {
        orderId: "ord-1",
        storeId: "store-1",
        guard: { status: "HELD" },
        data: { status: "CONFIRMED" },
      })
    ).resolves.toBe(false);
  });

  it("cannot be tricked into claiming another tenant's order", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await claimOrderTransition(tx, {
      orderId: "ord-1",
      storeId: "store-1",
      // A caller-supplied guard must never be able to drop the scope.
      guard: { status: "HELD", storeId: "other-store" } as never,
      data: { status: "CONFIRMED" },
    });

    expect(tx.order.updateMany.mock.calls[0][0].where.storeId).toBe("store-1");
  });
});

describe("claimOrderTransitions", () => {
  let tx: any;

  beforeEach(() => {
    tx = { order: { updateMany: vi.fn() } };
  });

  it("wins only when EVERY order was claimed", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 3 });
    await expect(
      claimOrderTransitions(tx, {
        orderIds: ["a", "b", "c"],
        storeId: "store-1",
        guard: { status: "HELD" },
        data: { status: "CANCELLED" },
      })
    ).resolves.toBe(true);
  });

  it("treats a PARTIAL claim as a loss — half a merge is worse than none", async () => {
    tx.order.updateMany.mockResolvedValue({ count: 2 });
    await expect(
      claimOrderTransitions(tx, {
        orderIds: ["a", "b", "c"],
        storeId: "store-1",
        guard: { status: "HELD" },
        data: { status: "CANCELLED" },
      })
    ).resolves.toBe(false);
  });

  it("short-circuits an empty batch without writing", async () => {
    await expect(
      claimOrderTransitions(tx, {
        orderIds: [],
        storeId: "store-1",
        guard: {},
        data: {},
      })
    ).resolves.toBe(true);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });
});
