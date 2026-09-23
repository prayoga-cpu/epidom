import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { staffMember: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

import { linkedStaffHomePath } from "../staff-home";
import { pickStaffHomePage } from "@/config/staff-permissions.config";

beforeEach(() => findFirst.mockReset());

describe("pickStaffHomePage", () => {
  it("prefers the register, then the order queue, kitchen, tables, schedule", () => {
    expect(pickStaffHomePage(["/pos/kds", "/pos", "/tables"])).toBe("/pos");
    expect(pickStaffHomePage(["/tables", "/pos/kds"])).toBe("/pos/kds");
    expect(pickStaffHomePage(["/pos/schedule"])).toBe("/pos/schedule");
  });

  it("ignores Back Office pages entirely — staff accounts are POS Mode only for now", () => {
    expect(pickStaffHomePage(["/dashboard", "/finance", "/staff"])).toBeNull();
    expect(pickStaffHomePage(["/dashboard", "/pos/kds"])).toBe("/pos/kds");
  });
});

describe("linkedStaffHomePath", () => {
  it("sends a Cashier to the register", async () => {
    findFirst.mockResolvedValue({ role: "CASHIER", allowedPages: [] }); // role default
    expect(await linkedStaffHomePath("s1", "m1")).toBe("/store/s1/pos");
  });

  it("sends a Kitchen member to the kitchen display, not a register they don't have", async () => {
    findFirst.mockResolvedValue({ role: "KITCHEN", allowedPages: [] });
    expect(await linkedStaffHomePath("s1", "m1")).toBe("/store/s1/pos/kds");
  });

  it("sends a back-office-only member (no POS pages) to the store list — never a page that would bounce them", async () => {
    findFirst.mockResolvedValue({
      role: "MANAGER",
      allowedPages: ["/dashboard", "/finance", "/data"],
    });
    expect(await linkedStaffHomePath("s1", "m1")).toBe("/stores");
  });

  it("sends a deactivated / missing member to the store list", async () => {
    findFirst.mockResolvedValue(null);
    expect(await linkedStaffHomePath("s1", "m1")).toBe("/stores");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "m1", storeId: "s1", isActive: true });
  });
});
