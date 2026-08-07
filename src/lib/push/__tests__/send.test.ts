import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn().mockResolvedValue(undefined);
const setVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const findMany = vi.fn();
const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushSubscription: {
      findMany: (...args: unknown[]) => findMany(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}));

const ORIGINAL_ENV = { ...process.env };

function setConfigured(configured: boolean) {
  if (configured) {
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
  } else {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  }
}

// sendPushToStore caches whether VAPID is configured in a module-level
// variable (same pattern as isRealtimeConfigured's singleton), so we need a
// fresh module instance per test to exercise both the configured and
// unconfigured branches without cross-test leakage.
async function freshSendPushToStore() {
  vi.resetModules();
  const mod = await import("../send");
  return mod.sendPushToStore;
}

// Flush the fire-and-forget microtask chain kicked off inside sendPushToStore.
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  findMany.mockResolvedValue([]);
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("sendPushToStore", () => {
  it("no-ops without throwing when VAPID is not configured", async () => {
    setConfigured(false);
    const sendPushToStore = await freshSendPushToStore();

    expect(() => sendPushToStore("store-1", { title: "t", body: "b" })).not.toThrow();
    await flush();

    expect(findMany).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends to every subscription for the store when configured", async () => {
    setConfigured(true);
    findMany.mockResolvedValue([
      { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      { id: "sub-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
    ]);
    const sendPushToStore = await freshSendPushToStore();

    sendPushToStore("store-1", { title: "New order", body: "ORD-1" });
    await flush();

    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/1", keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "New order", body: "ORD-1" })
    );
  });

  it("deletes subscriptions that reject with 404/410 and leaves others untouched", async () => {
    setConfigured(true);
    findMany.mockResolvedValue([
      { id: "sub-dead-404", endpoint: "e1", p256dh: "p1", auth: "a1" },
      { id: "sub-dead-410", endpoint: "e2", p256dh: "p2", auth: "a2" },
      { id: "sub-alive", endpoint: "e3", p256dh: "p3", auth: "a3" },
    ]);
    sendNotification
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }))
      .mockResolvedValueOnce(undefined);
    const sendPushToStore = await freshSendPushToStore();

    sendPushToStore("store-1", { title: "t", body: "b" });
    await flush();
    await flush();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["sub-dead-404", "sub-dead-410"]) } },
    });
    const deletedIds = deleteMany.mock.calls[0][0].where.id.in;
    expect(deletedIds).not.toContain("sub-alive");
  });

  it("does not delete subscriptions on non-404/410 errors", async () => {
    setConfigured(true);
    findMany.mockResolvedValue([{ id: "sub-1", endpoint: "e1", p256dh: "p1", auth: "a1" }]);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("server error"), { statusCode: 500 }));
    const sendPushToStore = await freshSendPushToStore();

    sendPushToStore("store-1", { title: "t", body: "b" });
    await flush();
    await flush();

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("never throws even when every send rejects", async () => {
    setConfigured(true);
    findMany.mockResolvedValue([{ id: "sub-1", endpoint: "e1", p256dh: "p1", auth: "a1" }]);
    sendNotification.mockRejectedValue(new Error("network error"));
    const sendPushToStore = await freshSendPushToStore();

    expect(() => sendPushToStore("store-1", { title: "t", body: "b" })).not.toThrow();
    await flush();
    await flush();
  });
});
