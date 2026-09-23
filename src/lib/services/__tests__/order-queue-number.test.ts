import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { allocateQueueNumber, storeLocalDay } from "../order-queue-number";

/** Just the slice of the transaction client the helper touches. */
function makeTx({
  last = 1,
  timezone = "Asia/Jakarta" as string | null,
  sibling = null as { queueNumber: number | null } | null,
} = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(last === null ? [] : [{ last }]),
    store: {
      findUnique: vi.fn().mockResolvedValue(timezone ? { business: { timezone } } : null),
    },
    order: { findFirst: vi.fn().mockResolvedValue(sibling) },
  };
  return tx;
}

const asTx = (tx: ReturnType<typeof makeTx>) => tx as unknown as Prisma.TransactionClient;

/** The values interpolated into the tagged-template SQL: [storeId, day]. */
const boundValues = (tx: ReturnType<typeof makeTx>) => tx.$queryRaw.mock.calls[0].slice(1);

describe("storeLocalDay", () => {
  it("buckets by the store's calendar day, not the server's", () => {
    // 17:30Z is already tomorrow in Jakarta (UTC+7) but still today in UTC.
    const now = new Date("2026-09-19T17:30:00Z");
    expect(storeLocalDay(now, "Asia/Jakarta")).toBe("2026-09-20");
    expect(storeLocalDay(now, "UTC")).toBe("2026-09-19");
  });

  it("falls back to UTC on an invalid timezone instead of throwing", () => {
    const now = new Date("2026-09-19T17:30:00Z");
    expect(storeLocalDay(now, "Not/AZone")).toBe("2026-09-19");
  });
});

describe("allocateQueueNumber", () => {
  it("returns the counter's new value for the store-local day", async () => {
    const tx = makeTx({ last: 7 });
    const n = await allocateQueueNumber(asTx(tx), {
      storeId: "store-1",
      now: new Date("2026-09-19T17:30:00Z"),
    });
    expect(n).toBe(7);
    expect(boundValues(tx)).toEqual(["store-1", "2026-09-20"]);
  });

  it("reads the timezone from the store's business when not given", async () => {
    const tx = makeTx({ timezone: "Asia/Jakarta" });
    await allocateQueueNumber(asTx(tx), {
      storeId: "store-1",
      now: new Date("2026-09-19T17:30:00Z"),
    });
    expect(tx.store.findUnique).toHaveBeenCalledWith({
      where: { id: "store-1" },
      select: { business: { select: { timezone: true } } },
    });
  });

  it("skips the store lookup when the caller already has the timezone", async () => {
    const tx = makeTx();
    await allocateQueueNumber(asTx(tx), {
      storeId: "store-1",
      timezone: "Europe/Paris",
      now: new Date("2026-09-19T23:30:00Z"),
    });
    expect(tx.store.findUnique).not.toHaveBeenCalled();
    // 23:30Z is 01:30 the next day in Paris (UTC+2).
    expect(boundValues(tx)).toEqual(["store-1", "2026-09-20"]);
  });

  it("buckets by UTC when the store row is missing", async () => {
    const tx = makeTx({ timezone: null });
    await allocateQueueNumber(asTx(tx), { storeId: "gone", now: new Date("2026-09-19T17:30:00Z") });
    expect(boundValues(tx)).toEqual(["gone", "2026-09-19"]);
  });

  it("gives every bill of a split the number the first bill took", async () => {
    const tx = makeTx({ sibling: { queueNumber: 12 } });
    const n = await allocateQueueNumber(asTx(tx), { storeId: "store-1", splitGroupId: "grp-1" });
    expect(n).toBe(12);
    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: "store-1", splitGroupId: "grp-1", queueNumber: { not: null } },
      })
    );
    // Reusing a number must not spend one from the counter.
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("takes a fresh number for the first bill of a split", async () => {
    const tx = makeTx({ last: 3, sibling: null });
    expect(await allocateQueueNumber(asTx(tx), { storeId: "store-1", splitGroupId: "grp-1" })).toBe(
      3
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("does not look for split siblings on an ordinary order", async () => {
    const tx = makeTx();
    await allocateQueueNumber(asTx(tx), { storeId: "store-1", splitGroupId: null });
    expect(tx.order.findFirst).not.toHaveBeenCalled();
  });

  it("throws rather than return a bogus number if the upsert yields no row", async () => {
    const tx = makeTx({ last: null as unknown as number });
    await expect(allocateQueueNumber(asTx(tx), { storeId: "store-1" })).rejects.toThrow(
      /returned no row/
    );
  });
});
