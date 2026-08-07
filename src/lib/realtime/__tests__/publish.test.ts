import { describe, it, expect, vi, beforeEach } from "vitest";

const trigger = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/realtime/pusher-server", () => ({
  isRealtimeConfigured: vi.fn(),
  getPusherServer: vi.fn(),
}));

import { publishStoreEvent } from "../publish";
import { isRealtimeConfigured, getPusherServer } from "@/lib/realtime/pusher-server";
import { REALTIME_EVENTS } from "../channels";

beforeEach(() => {
  vi.clearAllMocks();
  trigger.mockClear();
});

describe("publishStoreEvent", () => {
  it("no-ops without throwing when realtime is not configured", () => {
    vi.mocked(isRealtimeConfigured).mockReturnValue(false);

    expect(() =>
      publishStoreEvent("store-1", REALTIME_EVENTS.ORDER_CREATED, {
        action: "created",
        entityId: "order-1",
      })
    ).not.toThrow();
    expect(getPusherServer).not.toHaveBeenCalled();
  });

  it("triggers the store's private data channel when configured", () => {
    vi.mocked(isRealtimeConfigured).mockReturnValue(true);
    vi.mocked(getPusherServer).mockReturnValue({ trigger } as never);

    publishStoreEvent("store-1", REALTIME_EVENTS.MATERIAL_CHANGED, {
      action: "updated",
      entityId: "mat-1",
    });

    expect(trigger).toHaveBeenCalledWith("private-store-store-1", "material.changed", {
      action: "updated",
      entityId: "mat-1",
    });
  });

  it("does not throw when the underlying trigger call rejects", () => {
    vi.mocked(isRealtimeConfigured).mockReturnValue(true);
    trigger.mockRejectedValueOnce(new Error("network error"));
    vi.mocked(getPusherServer).mockReturnValue({ trigger } as never);

    expect(() =>
      publishStoreEvent("store-1", REALTIME_EVENTS.STOCK_CHANGED, {
        action: "updated",
        entityId: "x",
      })
    ).not.toThrow();
  });
});
