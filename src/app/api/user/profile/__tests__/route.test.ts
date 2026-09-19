import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const getProfile = vi.fn();
vi.mock("@/lib/services", () => ({
  userService: { getProfile: (...a: unknown[]) => getProfile(...a), updateProfile: vi.fn() },
}));

const getLinkedStaffForUser = vi.fn();
vi.mock("@/lib/auth/staff-link", () => ({
  getLinkedStaffForUser: (...a: unknown[]) => getLinkedStaffForUser(...a),
}));

import { GET } from "../route";

const call = (userId = "u1") =>
  GET(new Request("http://localhost/api/user/profile"), { userId } as never);

beforeEach(() => {
  getProfile.mockReset();
  getLinkedStaffForUser.mockReset();
});

describe("GET /api/user/profile — staffLink (what the /stores gatekeeper keys on)", () => {
  it("an owner: profile unchanged, staffLink null", async () => {
    getProfile.mockResolvedValue({ id: "u1", business: { id: "biz_1", stores: [{ id: "s" }] } });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.business.id).toBe("biz_1");
    expect(data.staffLink).toBeNull();
  });

  it("a linked staff login: no business, but staffLink says which store — and nothing more about the staff row", async () => {
    getProfile.mockResolvedValue({ id: "u2", business: null });
    getLinkedStaffForUser.mockResolvedValue({
      id: "staff_1",
      storeId: "store_b",
      role: "MANAGER",
      allowedPages: ["/pos"],
      store: { id: "store_b", name: "Cafe B" },
    });

    const { data } = await (await call("u2")).json();

    expect(data.business).toBeNull();
    expect(data.staffLink).toEqual({ storeId: "store_b", storeName: "Cafe B" });
  });
});
