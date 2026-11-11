import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The SSE order stream (only used while Pusher isn't configured) polls the
 * database from a setInterval for as long as the connection lives. Under Fluid
 * that is billed CPU, so a client that disconnects must stop the polling:
 * cancel() has to clear the timers instead of leaving them ticking.
 */

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: m.findUnique },
    order: { findMany: m.findMany },
  },
}));
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/utils/store-verification", () => ({
  verifyStoreAccessWithResponse: vi.fn(async () => ({ store: { id: "store-1" } })),
}));
vi.mock("@/lib/server/serialize", () => ({ serializePosOrders: (o: unknown) => o }));

import { GET } from "../route";

const call = () =>
  GET(new Request("http://localhost/api/stores/store-1/orders/stream"), {
    params: Promise.resolve({ id: "store-1" }),
  });

describe("GET /api/stores/[id]/orders/stream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    m.findUnique.mockReset().mockResolvedValue({ kitchenDisplayEnabled: true });
    m.findMany.mockReset().mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps polling every 15s while the client stays connected", async () => {
    const res = await call();
    const reader = res.body!.getReader();
    await reader.read(); // first poll's message
    expect(m.findMany).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(m.findMany).toHaveBeenCalledTimes(2);

    await reader.cancel();
  });

  it("stops polling as soon as the client cancels", async () => {
    const res = await call();
    const reader = res.body!.getReader();
    await reader.read();
    // read() resolves on the first message, before the timers are created:
    // let start() finish so cancel() has live timers to clear.
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(2); // poll interval + keep-alive

    await reader.cancel();
    expect(vi.getTimerCount()).toBe(0);

    const callsAtCancel = m.findMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(m.findMany.mock.calls.length).toBe(callsAtCancel);
  });

  it("never starts its timers if the client leaves during the first poll", async () => {
    const res = await call();
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel(); // before start() has created any timer

    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);

    const callsAtCancel = m.findMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(m.findMany.mock.calls.length).toBe(callsAtCancel);
  });
});
