import { describe, it, expect, vi, beforeEach } from "vitest";

const staffFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { staffMember: { findFirst: (...a: unknown[]) => staffFindFirst(...a) } },
}));

import { getLinkedStaffForUser, linkedStaffLandingPath, linkedStaffWhere } from "../staff-link";

beforeEach(() => staffFindFirst.mockReset());

describe("linkedStaffWhere", () => {
  it("is 'active, and never the OWNER row' — the same predicate the store wall uses", () => {
    expect(linkedStaffWhere("u1")).toEqual({
      userId: "u1",
      isActive: true,
      role: { not: "OWNER" },
    });
  });
});

describe("getLinkedStaffForUser", () => {
  it("looks the account up by that predicate and selects only the store columns the list shows", async () => {
    staffFindFirst.mockResolvedValue(null);

    await getLinkedStaffForUser("u1");

    const arg = staffFindFirst.mock.calls[0][0];
    expect(arg.where).toEqual(linkedStaffWhere("u1"));
    expect(Object.keys(arg.select.store.select).sort()).toEqual(
      [
        "address",
        "businessId",
        "city",
        "country",
        "createdAt",
        "email",
        "id",
        "image",
        "name",
        "phone",
        "updatedAt",
      ].sort()
    );
  });
});

describe("linkedStaffLandingPath", () => {
  const cashier = { storeId: "store_1", role: "CASHIER" as const, allowedPages: [] };

  it("sends a staffer to their first reachable POS page", () => {
    expect(linkedStaffLandingPath(cashier)).toBe("/store/store_1/pos");
  });

  it("honours a requested POS page they were granted (the PWA /go/pos/orders shortcut)", () => {
    expect(linkedStaffLandingPath({ ...cashier, allowedPages: ["/pos", "/pos/orders"] }, "/pos/orders")).toBe(
      "/store/store_1/pos/orders"
    );
  });

  it("ignores a requested page they weren't granted, a Back Office section, or junk — and lands on their first page instead", () => {
    const link = { ...cashier, allowedPages: ["/pos"] };
    expect(linkedStaffLandingPath(link, "/pos/kds")).toBe("/store/store_1/pos");
    expect(linkedStaffLandingPath(link, "/finance")).toBe("/store/store_1/pos");
    expect(linkedStaffLandingPath(link, "/nope")).toBe("/store/store_1/pos");
  });

  it("is null for a back-office-only grant, so callers fall back to the store list instead of looping", () => {
    expect(linkedStaffLandingPath({ ...cashier, allowedPages: ["/dashboard", "/finance"] })).toBeNull();
  });
});
