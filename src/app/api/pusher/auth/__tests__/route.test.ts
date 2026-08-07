import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/staff-session", () => ({ getActiveStaffSession: vi.fn() }));
vi.mock("@/lib/utils/store-verification", () => ({ verifyStoreOwnership: vi.fn() }));

const authorizeChannel = vi.fn();
vi.mock("@/lib/realtime/pusher-server", () => ({
  isRealtimeConfigured: vi.fn().mockReturnValue(true),
  getPusherServer: vi.fn(() => ({ authorizeChannel })),
}));

import { POST } from "../route";
import { getSession } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";

function makeRequest(channelName: string, socketId = "123.456") {
  const form = new FormData();
  form.set("socket_id", socketId);
  form.set("channel_name", channelName);
  return new Request("http://localhost/api/pusher/auth", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeChannel.mockReturnValue({ auth: "key:signature" });
  vi.mocked(getActiveStaffSession).mockResolvedValue(null);
  vi.mocked(getSession).mockResolvedValue(null);
});

describe("POST /api/pusher/auth", () => {
  it("returns 401 when neither an owner nor staff session exists", async () => {
    const res = await POST(makeRequest("private-store-store-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a channel name it doesn't recognize", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1", name: "Owner" } } as never);
    vi.mocked(verifyStoreOwnership).mockResolvedValue({} as never);
    const res = await POST(makeRequest("private-something-else"));
    expect(res.status).toBe(403);
  });

  it("authorizes the data channel for a valid owner session", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1", name: "Owner" } } as never);
    vi.mocked(verifyStoreOwnership).mockResolvedValue({} as never);

    const res = await POST(makeRequest("private-store-store-1"));

    expect(res.status).toBe(200);
    expect(authorizeChannel).toHaveBeenCalledWith("123.456", "private-store-store-1");
  });

  it("rejects an owner session for a store they don't own", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "user-1", name: "Owner" } } as never);
    vi.mocked(verifyStoreOwnership).mockRejectedValue(new Error("Store not found"));

    const res = await POST(makeRequest("private-store-store-1"));

    expect(res.status).toBe(401);
  });

  it("authorizes the presence channel for an active staff session", async () => {
    vi.mocked(getActiveStaffSession).mockResolvedValue({
      storeId: "store-1",
      staffMemberId: "staff-1",
      name: "Budi",
      role: "CASHIER",
      allowedPages: [],
    } as never);

    const res = await POST(makeRequest("presence-store-store-1"));

    expect(res.status).toBe(200);
    expect(authorizeChannel).toHaveBeenCalledWith("123.456", "presence-store-store-1", {
      user_id: "staff-1",
      user_info: { name: "Budi", role: "CASHIER" },
    });
  });

  it("rejects a staff session scoped to a different store", async () => {
    vi.mocked(getActiveStaffSession).mockResolvedValue({
      storeId: "store-2",
      staffMemberId: "staff-1",
      name: "Budi",
      role: "CASHIER",
      allowedPages: [],
    } as never);

    const res = await POST(makeRequest("private-store-store-1"));

    expect(res.status).toBe(401);
  });
});
