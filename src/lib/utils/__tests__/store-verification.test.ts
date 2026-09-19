import { describe, it, expect, vi, beforeEach } from "vitest";

const getBusinessByUserId = vi.fn();
const getStoreById = vi.fn();
vi.mock("@/lib/services", () => ({
  businessService: {
    getBusinessByUserId: (...a: unknown[]) => getBusinessByUserId(...a),
    getStoreById: (...a: unknown[]) => getStoreById(...a),
  },
}));

const staffFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { staffMember: { findFirst: (...a: unknown[]) => staffFindFirst(...a) } },
}));

const authorizeStaffPrincipal = vi.fn();
vi.mock("@/lib/auth/staff-principal-policy", () => ({
  authorizeStaffPrincipal: (...a: unknown[]) => authorizeStaffPrincipal(...a),
}));

import {
  verifyStoreAccess,
  verifyStoreAccessWithResponse,
  verifyStoreOwnership,
} from "../store-verification";

const STORE = { id: "store_1", businessId: "biz_owner", name: "Shop" };

// react's cache() memoizes by argument identity within a request scope; each
// test uses its own ids so nothing leaks between cases.
let n = 0;
const ids = () => {
  n += 1;
  return { storeId: `store_${n}`, userId: `user_${n}` };
};

beforeEach(() => {
  getBusinessByUserId.mockReset();
  getStoreById.mockReset();
  staffFindFirst.mockReset();
  authorizeStaffPrincipal.mockReset();
});

describe("verifyStoreAccess", () => {
  it("returns owner access for the store's owner, without touching staff links", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue({ id: "biz_owner" });
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });

    const access = await verifyStoreAccess(storeId, userId);

    expect(access.accessType).toBe("owner");
    expect(staffFindFirst).not.toHaveBeenCalled();
  });

  it("returns staff access, with the linked member id, for an ACTIVE linked account", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null); // a staff account owns no business
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue({ id: "staff_77" });

    const access = await verifyStoreAccess(storeId, userId);

    expect(access).toMatchObject({ accessType: "staff", staffMemberId: "staff_77" });
    // Scoped to exactly this store + this user + active — the revocation lever.
    expect(staffFindFirst).toHaveBeenCalledWith({
      where: { storeId, userId, isActive: true, role: { not: "OWNER" } },
      select: { id: true },
    });
  });

  it("re-throws the ORIGINAL owner error when there is no active link (deactivated / unlinked / stranger)", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue(null);

    await expect(verifyStoreAccess(storeId, userId)).rejects.toThrow("Business not found");
  });

  it("does not let a staffer of ANOTHER store in (the link query is store-scoped)", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue(null); // no row for (storeId, userId)

    await expect(verifyStoreAccess(storeId, userId)).rejects.toThrow();
    expect(staffFindFirst.mock.calls[0][0].where.storeId).toBe(storeId);
  });

  it("prefers owner over staff when someone is both (e.g. after an ownership transfer)", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue({ id: "biz_owner" });
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue({ id: "staff_77" });

    expect((await verifyStoreAccess(storeId, userId)).accessType).toBe("owner");
  });
});

describe("verifyStoreOwnership stays owner-only", () => {
  it("still throws for a linked staff account — it must never learn about staff", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue({ id: "staff_77" });

    await expect(verifyStoreOwnership(storeId, userId)).rejects.toThrow("Business not found");
    expect(staffFindFirst).not.toHaveBeenCalled();
  });
});

describe("verifyStoreAccessWithResponse", () => {
  const request = new Request("http://localhost/api/stores/x/pos/menu");

  it("does not consult the staff policy for the owner", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue({ id: "biz_owner" });
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });

    const result = await verifyStoreAccessWithResponse(storeId, userId, request);

    expect(result).toMatchObject({ accessType: "owner" });
    expect(authorizeStaffPrincipal).not.toHaveBeenCalled();
  });

  it("hands a staff principal to the policy and returns its denial", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue({ id: "staff_77" });
    const denial = new Response(null, { status: 403 });
    authorizeStaffPrincipal.mockResolvedValue(denial);

    const result = await verifyStoreAccessWithResponse(storeId, userId, request);

    expect(result).toBe(denial);
    expect(authorizeStaffPrincipal).toHaveBeenCalledWith({
      storeId,
      staffMemberId: "staff_77",
      request,
    });
  });

  it("returns access when the policy admits the staff principal", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue({ id: "staff_77" });
    authorizeStaffPrincipal.mockResolvedValue(null);

    const result = await verifyStoreAccessWithResponse(storeId, userId, request);

    expect(result).toMatchObject({ accessType: "staff", staffMemberId: "staff_77" });
  });

  it("maps a stranger to the same 404 the owner-only helper gives", async () => {
    const { storeId, userId } = ids();
    getBusinessByUserId.mockResolvedValue(null);
    getStoreById.mockResolvedValue({ ...STORE, id: storeId });
    staffFindFirst.mockResolvedValue(null);

    const result = await verifyStoreAccessWithResponse(storeId, userId, request);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
  });
});
