import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ menuItem: { count: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const viewer = vi.hoisted(() => ({ getStoreViewer: vi.fn() }));
vi.mock("@/lib/auth/store-viewer", () => viewer);

const plan = vi.hoisted(() => ({ getStorePlan: vi.fn() }));
vi.mock("@/lib/plans/store-plan", () => plan);

const access = vi.hoisted(() => ({ canAccessStaffPage: vi.fn() }));
vi.mock("@/lib/auth/require-staff-page-access", () => access);

import { countTillMenuItems, resolveMenuSetupHref } from "../till-menu";

beforeEach(() => {
  vi.clearAllMocks();
  viewer.getStoreViewer.mockResolvedValue({ kind: "owner" });
  plan.getStorePlan.mockResolvedValue("OPERATIONS");
  access.canAccessStaffPage.mockResolvedValue(true);
});

describe("countTillMenuItems", () => {
  it("counts what the till shows: this store's cashier items", async () => {
    prismaMock.menuItem.count.mockResolvedValue(4);
    await expect(countTillMenuItems("s1", true)).resolves.toBe(4);
    expect(prismaMock.menuItem.count).toHaveBeenCalledWith({
      where: { storefront: { storeId: "s1" }, showOnCashier: true },
    });
  });

  it("leaves out the second product line while the store has it off, keeping items with no product", async () => {
    prismaMock.menuItem.count.mockResolvedValue(0);
    await countTillMenuItems("s1", false);
    expect(prismaMock.menuItem.count).toHaveBeenCalledWith({
      where: {
        storefront: { storeId: "s1" },
        showOnCashier: true,
        OR: [{ productId: null }, { product: { productLine: { not: "CUSTOM" } } }],
      },
    });
  });
});

describe("resolveMenuSetupHref", () => {
  it("the owner on a plan with Data goes to Data", async () => {
    await expect(resolveMenuSetupHref("s1")).resolves.toBe("/store/s1/data?from=pos");
    expect(access.canAccessStaffPage).toHaveBeenCalledWith("s1", "/data");
  });

  it("Enterprise counts as having Data", async () => {
    plan.getStorePlan.mockResolvedValue("ENTERPRISE");
    await expect(resolveMenuSetupHref("s1")).resolves.toBe("/store/s1/data?from=pos");
  });

  it("on the POS plan (no Data page) the storefront's Menu tab instead", async () => {
    plan.getStorePlan.mockResolvedValue("POS");
    await expect(resolveMenuSetupHref("s1")).resolves.toBe(
      "/store/s1/storefront?tab=menu&from=pos"
    );
    expect(access.canAccessStaffPage).not.toHaveBeenCalledWith("s1", "/data");
  });

  it("a persona without Data but with the storefront goes to the storefront", async () => {
    access.canAccessStaffPage.mockImplementation(
      async (_s: string, page: string) => page !== "/data"
    );
    await expect(resolveMenuSetupHref("s1")).resolves.toBe(
      "/store/s1/storefront?tab=menu&from=pos"
    );
  });

  it("a persona granted neither page gets null (sending them would bounce back to /pos)", async () => {
    access.canAccessStaffPage.mockResolvedValue(false);
    await expect(resolveMenuSetupHref("s1")).resolves.toBeNull();
  });

  it("a linked staff account never: Back Office is the owner's shell", async () => {
    viewer.getStoreViewer.mockResolvedValue({ kind: "staff", staffMemberId: "m1" });
    await expect(resolveMenuSetupHref("s1")).resolves.toBeNull();
    expect(access.canAccessStaffPage).not.toHaveBeenCalled();
  });

  it("no viewer, no link", async () => {
    viewer.getStoreViewer.mockResolvedValue({ kind: "none" });
    await expect(resolveMenuSetupHref("s1")).resolves.toBeNull();
  });
});
