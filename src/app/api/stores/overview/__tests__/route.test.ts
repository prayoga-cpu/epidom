import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the handler body directly: auth and rate-limit wrapping is not what's under test.
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const getBusinessByUserId = vi.fn();
const getStoreOverviews = vi.fn();
vi.mock("@/lib/services", () => ({
  businessService: {
    getBusinessByUserId: (...a: unknown[]) => getBusinessByUserId(...a),
  },
  getStoreOverviews: (...a: unknown[]) => getStoreOverviews(...a),
}));

const getLinkedStaffForUser = vi.fn();
vi.mock("@/lib/auth/staff-link", () => ({
  getLinkedStaffForUser: (...a: unknown[]) => getLinkedStaffForUser(...a),
}));

// The real one reads cookies(), which fails outside a request.
const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: (...a: unknown[]) => getActiveStaffSession(...a),
}));

import { GET } from "../route";

const persona = (role: string) => ({
  storeId: "store_a",
  staffMemberId: "sm_1",
  name: "Ayu",
  role,
  allowedPages: [],
});

const call = (userId = "u1") =>
  GET(new Request("http://localhost/api/stores/overview"), { userId } as never);

beforeEach(() => {
  getBusinessByUserId.mockReset();
  getStoreOverviews.mockReset();
  getLinkedStaffForUser.mockReset();
  getActiveStaffSession.mockReset();
  getBusinessByUserId.mockResolvedValue({ id: "biz_1" });
  getLinkedStaffForUser.mockResolvedValue(null);
  getActiveStaffSession.mockResolvedValue(null);
  getStoreOverviews.mockResolvedValue([]);
});

describe("GET /api/stores/overview", () => {
  it("returns the service's rows as { success, data }", async () => {
    const rows = [{ storeId: "a", stats: { revenue: 1, customerCount: 2, staffCount: 3 } }];
    getStoreOverviews.mockResolvedValue(rows);

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, data: rows });
  });

  it("scopes the stores to the session: its own business and its linked-staff store", async () => {
    getLinkedStaffForUser.mockResolvedValue({ id: "sm_9", storeId: "theirs", store: {} });

    await call("u42");

    expect(getBusinessByUserId).toHaveBeenCalledWith("u42");
    expect(getLinkedStaffForUser).toHaveBeenCalledWith("u42");
    expect(getStoreOverviews).toHaveBeenCalledTimes(1);
    expect(getStoreOverviews).toHaveBeenCalledWith({
      businessId: "biz_1",
      linkedStoreId: "theirs",
      includeTotals: true,
    });
  });

  it("no business and no link: passes nulls through, and the empty list comes back", async () => {
    getBusinessByUserId.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(getStoreOverviews).toHaveBeenCalledWith({
      businessId: null,
      linkedStoreId: null,
      includeTotals: true,
    });
    expect(data).toEqual([]);
  });

  it("a staff-only account (no business) is scoped to its linked store", async () => {
    getBusinessByUserId.mockResolvedValue(null);
    getLinkedStaffForUser.mockResolvedValue({ id: "sm_9", storeId: "store_b", store: {} });

    await call("staff_user");

    expect(getStoreOverviews).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: null, linkedStoreId: "store_b" })
    );
  });

  describe("who sees totals (the PIN persona on this browser)", () => {
    it.each([
      ["no persona", true, null],
      ["an OWNER persona", true, persona("OWNER")],
      ["a CASHIER persona", false, persona("CASHIER")],
      ["a MANAGER persona", false, persona("MANAGER")],
      ["a KITCHEN persona", false, persona("KITCHEN")],
    ])("%s gives includeTotals %s", async (_label, expected, session) => {
      getActiveStaffSession.mockResolvedValue(session);

      await call();

      expect(getStoreOverviews).toHaveBeenCalledWith(
        expect.objectContaining({ includeTotals: expected })
      );
    });
  });

  it("never takes the store list from the request (query params are ignored)", async () => {
    await GET(new Request("http://localhost/api/stores/overview?businessId=biz_evil&storeId=x"), {
      userId: "u1",
    } as never);

    expect(getStoreOverviews).toHaveBeenCalledWith({
      businessId: "biz_1",
      linkedStoreId: null,
      includeTotals: true,
    });
  });
});
