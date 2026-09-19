import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api/responses";

// ── Mocks ────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  ctx: {
    current: {
      storeId: "store_1" as string | undefined,
      userId: "user_1",
      session: {
        user: { id: "user_1", email: "owner@shop.co", name: "Olivia", emailVerified: true },
      },
    },
  },
  guard: vi.fn(),
  rateLimit: vi.fn(),
  getPending: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  lookup: vi.fn(),
  accept: vi.fn(),
}));

vi.mock("@/lib/api-handler", () => ({
  withApiHandler: (fn: Function, _opts: object) => async (req: NextRequest, _ctx?: unknown) =>
    fn(req, h.ctx.current),
}));
vi.mock("@/lib/auth/require-owner-only", () => ({ requireOwnerOnlyApi: h.guard }));
vi.mock("@/lib/middleware/rate-limit", () => ({ rateLimitMiddleware: h.rateLimit }));
vi.mock("@/lib/services/store-transfer.service", () => ({
  getPendingTransfer: h.getPending,
  startStoreTransfer: h.start,
  cancelPendingTransfer: h.cancel,
  lookupStoreTransfer: h.lookup,
  acceptStoreTransfer: h.accept,
}));

import {
  GET as ownerGet,
  POST as ownerPost,
  DELETE as ownerDelete,
} from "@/app/api/stores/[id]/transfer-ownership/route";
import { POST as lookupPost } from "@/app/api/transfer-ownership/lookup/route";
import { POST as acceptPost } from "@/app/api/transfer-ownership/accept/route";

const TOKEN = "b".repeat(64);

function req(method: string, body?: unknown, url = "http://localhost/api/x") {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const notOwner = () =>
  NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue(null);
  h.rateLimit.mockResolvedValue(null);
  h.getPending.mockResolvedValue(null);
  h.start.mockResolvedValue({ toEmail: "new@owner.com" });
  h.cancel.mockResolvedValue(undefined);
  h.ctx.current = {
    storeId: "store_1",
    userId: "user_1",
    session: { user: { id: "user_1", email: "owner@shop.co", name: "Olivia", emailVerified: true } },
  };
});

describe("/api/stores/[id]/transfer-ownership — owner-only guard", () => {
  it.each([
    ["GET", () => ownerGet(req("GET"), {} as never)],
    ["POST", () => ownerPost(req("POST", { toEmail: "new@owner.com" }), {} as never)],
    ["DELETE", () => ownerDelete(req("DELETE"), {} as never)],
  ])("%s is refused while a staff persona is active, and touches nothing", async (_m, call) => {
    h.guard.mockResolvedValue(notOwner());

    const res = await call();

    expect(res.status).toBe(403);
    expect(h.guard).toHaveBeenCalledWith("store_1");
    expect(h.getPending).not.toHaveBeenCalled();
    expect(h.start).not.toHaveBeenCalled();
    expect(h.cancel).not.toHaveBeenCalled();
  });

  it("GET reports the pending invite", async () => {
    h.getPending.mockResolvedValue({ toEmail: "new@owner.com", expiresAt: "2026-09-26T00:00:00.000Z" });
    const res = await ownerGet(req("GET"), {} as never);
    expect(res.status).toBe(200);
    expect((await res.json()).data.pending).toEqual({
      toEmail: "new@owner.com",
      expiresAt: "2026-09-26T00:00:00.000Z",
    });
    expect(h.getPending).toHaveBeenCalledWith("store_1");
  });

  it("POST hands the service the store, the normalized recipient and the sender", async () => {
    const res = await ownerPost(req("POST", { toEmail: "  New@Owner.COM " }), {} as never);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ sent: true, toEmail: "new@owner.com" });
    expect(h.start).toHaveBeenCalledWith({
      storeId: "store_1",
      toEmail: "new@owner.com",
      fromUser: { id: "user_1", email: "owner@shop.co", name: "Olivia" },
    });
  });

  it.each([{}, { toEmail: "" }, { toEmail: "nope" }, { toEmail: 5 }, { other: "x" }])(
    "POST rejects an invalid body %j with a 400 and sends nothing",
    async (body) => {
      const res = await ownerPost(req("POST", body), {} as never);
      expect(res.status).toBe(400);
      expect(h.start).not.toHaveBeenCalled();
    }
  );

  it("DELETE cancels the store's pending invite", async () => {
    const res = await ownerDelete(req("DELETE"), {} as never);
    expect(res.status).toBe(200);
    expect(h.cancel).toHaveBeenCalledWith("store_1");
  });
});

describe("POST /api/transfer-ownership/lookup (public)", () => {
  const details = {
    storeName: "Kopi",
    toEmail: "new@owner.com",
    fromName: "Olivia",
    storeTimezone: "Asia/Jakarta",
    expiresAt: "2026-09-26T00:00:00.000Z",
  };

  it("returns the invitation details for a well-formed token", async () => {
    h.lookup.mockResolvedValue(details);
    const res = await lookupPost(req("POST", { token: TOKEN }));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual(details);
    expect(h.lookup).toHaveBeenCalledWith(TOKEN);
  });

  it.each([{}, { token: "short" }, { token: "Z".repeat(64) }, { token: 1 }])(
    "answers a malformed token %j like a dead link without querying anything",
    async (body) => {
      const res = await lookupPost(req("POST", body));
      expect(res.status).toBe(404);
      expect(h.lookup).not.toHaveBeenCalled();
    }
  );

  it("treats an unparseable body the same way", async () => {
    const bad = new NextRequest("http://localhost/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{nope",
    });
    const res = await lookupPost(bad);
    expect(res.status).toBe(404);
    expect(h.lookup).not.toHaveBeenCalled();
  });

  it("is IP rate-limited, and a limited caller never reaches the lookup", async () => {
    h.rateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 30 });
    const res = await lookupPost(req("POST", { token: TOKEN }));
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Reset")).toBe("30");
    expect(h.lookup).not.toHaveBeenCalled();
    expect(h.rateLimit).toHaveBeenCalledWith(expect.anything(), "/api/transfer-ownership/lookup");
  });

  it("maps an expired invite to 410 and an unknown one to 404", async () => {
    h.lookup.mockRejectedValueOnce(
      new AppError("expired", ApiErrorCode.TOKEN_EXPIRED, 410)
    );
    expect((await lookupPost(req("POST", { token: TOKEN }))).status).toBe(410);

    h.lookup.mockRejectedValueOnce(new AppError("nope", ApiErrorCode.NOT_FOUND, 404));
    expect((await lookupPost(req("POST", { token: TOKEN }))).status).toBe(404);
  });
});

describe("POST /api/transfer-ownership/accept", () => {
  it("accepts as the signed-in account, passing whether ITS email is verified", async () => {
    h.accept.mockResolvedValue({ storeId: "store_9" });
    h.ctx.current = {
      storeId: undefined,
      userId: "new_1",
      session: { user: { id: "new_1", email: "new@owner.com", name: "Nia", emailVerified: true } },
    };

    const res = await acceptPost(req("POST", { token: TOKEN }), {} as never);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ storeId: "store_9" });
    expect(h.accept).toHaveBeenCalledWith({
      token: TOKEN,
      recipient: { id: "new_1", email: "new@owner.com", name: "Nia", emailVerified: true },
    });
  });

  it("treats a missing/false emailVerified as unverified (never truthy by accident)", async () => {
    h.accept.mockResolvedValue({ storeId: "store_9" });
    h.ctx.current = {
      storeId: undefined,
      userId: "new_1",
      session: { user: { id: "new_1", email: "new@owner.com", name: "Nia" } } as never,
    };
    await acceptPost(req("POST", { token: TOKEN }), {} as never);
    expect(h.accept.mock.calls[0][0].recipient.emailVerified).toBe(false);
  });

  it.each([{}, { token: "x" }, { token: "A".repeat(64) }])(
    "rejects a malformed token %j as a dead link, without attempting a transfer",
    async (body) => {
      const res = await acceptPost(req("POST", body), {} as never);
      expect(res.status).toBe(404);
      expect(h.accept).not.toHaveBeenCalled();
    }
  );
});
