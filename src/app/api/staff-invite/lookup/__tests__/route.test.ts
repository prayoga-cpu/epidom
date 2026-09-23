import { describe, it, expect, vi, beforeEach } from "vitest";

const rateLimitMiddleware = vi.fn();
vi.mock("@/lib/middleware/rate-limit", () => ({
  rateLimitMiddleware: (...a: unknown[]) => rateLimitMiddleware(...a),
}));

const lookupStaffInvite = vi.fn();
vi.mock("@/lib/services/staff-invite.service", () => ({
  lookupStaffInvite: (...a: unknown[]) => lookupStaffInvite(...a),
}));

import { POST } from "../route";

const TOKEN = "t".repeat(43);
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/staff-invite/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMiddleware.mockResolvedValue(null);
  lookupStaffInvite.mockResolvedValue({ state: "not_found" });
});

describe("POST /api/staff-invite/lookup", () => {
  it("is rate limited per IP, under its own limit key", async () => {
    rateLimitMiddleware.mockResolvedValue({ limit: 30, remaining: 0, reset: 12 });

    const res = await post({ token: TOKEN });

    expect(rateLimitMiddleware).toHaveBeenCalledWith(expect.any(Request), "/api/staff-invite/lookup");
    expect(res.status).toBe(429);
    expect(lookupStaffInvite).not.toHaveBeenCalled();
  });

  it("hands the body's token to the service and returns its answer", async () => {
    lookupStaffInvite.mockResolvedValue({ state: "expired" });

    const res = await post({ token: TOKEN });

    expect(lookupStaffInvite).toHaveBeenCalledWith(TOKEN);
    expect((await res.json()).data).toEqual({ state: "expired" });
  });

  it.each([["not json"], [{}], [{ token: 42 }], [{ token: "short" }], [{ token: "x".repeat(500) }], [null]])(
    "answers a malformed payload (%j) like an unknown link, without touching the database",
    async (body) => {
      const res = await post(body as never);

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual({ state: "not_found" });
      expect(lookupStaffInvite).not.toHaveBeenCalled();
    }
  );
});
