import { describe, it, expect, vi, beforeEach } from "vitest";

// Run the handler body directly — auth/rate-limit wrapping is not what's under test.
vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const getBusinessByUserId = vi.fn();
const getStoresByBusinessId = vi.fn();
vi.mock("@/lib/services", () => ({
  businessService: {
    getBusinessByUserId: (...a: unknown[]) => getBusinessByUserId(...a),
    getStoresByBusinessId: (...a: unknown[]) => getStoresByBusinessId(...a),
    createStoreForUser: vi.fn(),
  },
}));

const getLinkedStaffForUser = vi.fn();
const linkedStaffLandingPath = vi.fn();
vi.mock("@/lib/auth/staff-link", () => ({
  getLinkedStaffForUser: (...a: unknown[]) => getLinkedStaffForUser(...a),
  linkedStaffLandingPath: (...a: unknown[]) => linkedStaffLandingPath(...a),
}));

import { GET } from "../route";

const store = (id: string) => ({ id, businessId: "biz_1", name: `Store ${id}` });
const staffLink = (storeId: string) => ({
  id: "staff_1",
  storeId,
  role: "CASHIER",
  allowedPages: [],
  store: store(storeId),
});

const call = (userId = "u1") =>
  GET(new Request("http://localhost/api/stores"), { userId } as never);

beforeEach(() => {
  getBusinessByUserId.mockReset();
  getStoresByBusinessId.mockReset();
  getLinkedStaffForUser.mockReset();
  linkedStaffLandingPath.mockReset();
  getLinkedStaffForUser.mockResolvedValue(null);
});

describe("GET /api/stores", () => {
  it("an owner sees their stores, each tagged as owned — and no staff row", async () => {
    getBusinessByUserId.mockResolvedValue({ id: "biz_1" });
    getStoresByBusinessId.mockResolvedValue([store("a"), store("b")]);

    const { data } = await (await call()).json();

    expect(data.map((s: { id: string }) => s.id)).toEqual(["a", "b"]);
    expect(data.every((s: { accessRole: string }) => s.accessRole === "owner")).toBe(true);
  });

  it("a staff-only login (no business) sees exactly the one store it works at, tagged as staff, pointing at its POS page", async () => {
    getBusinessByUserId.mockResolvedValue(null);
    getLinkedStaffForUser.mockResolvedValue(staffLink("store_b"));
    linkedStaffLandingPath.mockReturnValue("/store/store_b/pos");

    const { data } = await (await call("staff_user")).json();

    expect(getStoresByBusinessId).not.toHaveBeenCalled();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: "store_b",
      accessRole: "staff",
      staffHomePath: "/store/store_b/pos",
    });
  });

  it("someone who owns a store AND works at another sees both, distinguishable", async () => {
    getBusinessByUserId.mockResolvedValue({ id: "biz_1" });
    getStoresByBusinessId.mockResolvedValue([store("mine")]);
    getLinkedStaffForUser.mockResolvedValue(staffLink("theirs"));
    linkedStaffLandingPath.mockReturnValue("/store/theirs/pos");

    const { data } = await (await call()).json();

    expect(data.map((s: { id: string; accessRole: string }) => [s.id, s.accessRole])).toEqual([
      ["mine", "owner"],
      ["theirs", "staff"],
    ]);
  });

  it("never lists a store twice: owner access outranks a stale staff link to the same store (e.g. after an ownership transfer)", async () => {
    getBusinessByUserId.mockResolvedValue({ id: "biz_1" });
    getStoresByBusinessId.mockResolvedValue([store("same")]);
    getLinkedStaffForUser.mockResolvedValue(staffLink("same"));

    const { data } = await (await call()).json();

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: "same", accessRole: "owner" });
  });

  it("a role with no POS page still lists the store, with nowhere to go (null), so the card can say why", async () => {
    getBusinessByUserId.mockResolvedValue(null);
    getLinkedStaffForUser.mockResolvedValue(staffLink("store_b"));
    linkedStaffLandingPath.mockReturnValue(null);

    const { data } = await (await call()).json();

    expect(data[0]).toMatchObject({ id: "store_b", accessRole: "staff", staffHomePath: null });
  });

  it("no business and no link: empty list, as before (the empty-state UI depends on it)", async () => {
    getBusinessByUserId.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data).toEqual([]);
  });
});
