import { describe, it, expect, vi, beforeEach } from "vitest";

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve([...store.keys()])),
}));

import {
  enqueueOrder,
  listQueue,
  offlineOrderNumber,
  OFFLINE_QUEUE_CHANGED_EVENT,
  recordRejection,
  requeueParked,
} from "../offline-queue";
import type { CreatePosOrderInput } from "@/lib/validation/pos.schemas";

const ORDER = {
  items: [{ menuItemId: "m1", quantity: 2 }],
  orderType: "TAKEAWAY",
  paymentMethod: "CASH",
} as unknown as CreatePosOrderInput;

const failure = { status: 422, message: "Invalid order data", at: "2026-10-05T12:00:00.000Z" };

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("offline order queue", () => {
  it("stamps the sale with the time it was queued", async () => {
    await enqueueOrder("store-1", ORDER);
    const [entry] = await listQueue();
    expect(entry.order.clientCreatedAt).toBe(entry.queuedAt);
    expect(entry.attempts).toBe(0);
  });

  it("keeps a time the caller already set", async () => {
    await enqueueOrder("store-1", { ...ORDER, clientCreatedAt: "2026-10-05T01:02:03.000Z" });
    const [entry] = await listQueue();
    expect(entry.order.clientCreatedAt).toBe("2026-10-05T01:02:03.000Z");
  });

  // The online attempt's key, so a request that reached the server can't double.
  it("uses the idempotency key it is given", async () => {
    const id = await enqueueOrder("store-1", ORDER, "req-123");
    expect(id).toBe("req-123");
    expect((await listQueue())[0].id).toBe("req-123");
    expect(offlineOrderNumber("abcdef12-3456")).toBe("OFFLINE-ABCDEF12");
  });

  it("tells the screen a sale was queued", async () => {
    const listener = vi.fn();
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, listener);
    await enqueueOrder("store-1", ORDER);
    window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("parks an entry after the maximum refusals instead of deleting it", async () => {
    await enqueueOrder("store-1", ORDER, "q1");
    let [entry] = await listQueue();
    for (let i = 0; i < 4; i++) entry = await recordRejection(entry, failure, 5);
    expect(entry.needsAttention).toBe(false);
    entry = await recordRejection(entry, failure, 5);
    expect(entry.needsAttention).toBe(true);
    const [stored] = await listQueue();
    expect(stored).toMatchObject({
      id: "q1",
      attempts: 5,
      needsAttention: true,
      lastError: failure,
    });
  });

  it("puts only this store's parked entries back in line", async () => {
    await enqueueOrder("store-1", ORDER, "mine");
    await enqueueOrder("store-2", ORDER, "theirs");
    for (const entry of await listQueue()) await recordRejection(entry, failure, 1);

    expect(await requeueParked("store-1")).toBe(1);
    const byId = Object.fromEntries((await listQueue()).map((e) => [e.id, e]));
    expect(byId.mine).toMatchObject({ attempts: 0, needsAttention: false });
    expect(byId.theirs).toMatchObject({ needsAttention: true });
  });
});
