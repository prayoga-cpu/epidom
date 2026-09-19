import { describe, it, expect, vi, beforeEach } from "vitest";

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: (...a: unknown[]) => getSession(...a) }));

const userFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } },
}));

const getLinkedStaffForUser = vi.fn();
vi.mock("@/lib/auth/staff-link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/staff-link")>()),
  getLinkedStaffForUser: (...a: unknown[]) => getLinkedStaffForUser(...a),
}));

import StoreLauncherPage from "../[...path]/page";

/** Runs the launcher and returns where it redirected to. */
async function launch(path: string[]): Promise<string> {
  try {
    await StoreLauncherPage({ params: Promise.resolve({ path }) });
  } catch (error) {
    if (error instanceof Redirect) return error.url;
    throw error;
  }
  throw new Error("launcher did not redirect");
}

const staffLink = (over: Record<string, unknown> = {}) => ({
  id: "staff_1",
  storeId: "store_b",
  role: "CASHIER",
  allowedPages: [],
  store: { id: "store_b" },
  ...over,
});

beforeEach(() => {
  getSession.mockReset();
  userFindUnique.mockReset();
  getLinkedStaffForUser.mockReset();
  getSession.mockResolvedValue({ user: { id: "u1" } });
  getLinkedStaffForUser.mockResolvedValue(null);
});

describe("/go/* launcher", () => {
  it("signed out: sends them through login and back to the same shortcut", async () => {
    getSession.mockResolvedValue(null);
    expect(await launch(["pos"])).toBe("/login?callbackUrl=%2Fgo%2Fpos");
  });

  it("an owner lands in their newest store, on the requested section — unchanged by staff support", async () => {
    userFindUnique.mockResolvedValue({
      defaultLanding: "dashboard",
      business: { stores: [{ id: "store_new" }, { id: "store_old" }] },
    });

    expect(await launch(["pos"])).toBe("/store/store_new/pos");
    expect(getLinkedStaffForUser).not.toHaveBeenCalled();
  });

  it("an owner who is ALSO linked as staff elsewhere still gets their own store (owning wins)", async () => {
    userFindUnique.mockResolvedValue({
      defaultLanding: "dashboard",
      business: { stores: [{ id: "mine" }] },
    });
    getLinkedStaffForUser.mockResolvedValue(staffLink());

    expect(await launch(["pos"])).toBe("/store/mine/pos");
  });

  it("a staff-only login goes straight to the store it works at, not the store list", async () => {
    userFindUnique.mockResolvedValue({ defaultLanding: "dashboard", business: null });
    getLinkedStaffForUser.mockResolvedValue(staffLink());

    expect(await launch(["pos"])).toBe("/store/store_b/pos");
  });

  it("honours a POS shortcut they were granted, e.g. the PWA's /go/pos/orders", async () => {
    userFindUnique.mockResolvedValue({ defaultLanding: "dashboard", business: null });
    getLinkedStaffForUser.mockResolvedValue(staffLink({ allowedPages: ["/pos", "/pos/orders"] }));

    expect(await launch(["pos", "orders"])).toBe("/store/store_b/pos/orders");
  });

  it("a Back Office section or an ungranted page falls back to their first POS page, never a page that would bounce", async () => {
    userFindUnique.mockResolvedValue({ defaultLanding: "dashboard", business: null });
    getLinkedStaffForUser.mockResolvedValue(staffLink({ allowedPages: ["/pos"] }));

    expect(await launch(["dashboard"])).toBe("/store/store_b/pos");
    expect(await launch(["pos", "kds"])).toBe("/store/store_b/pos");
    expect(await launch(["junk"])).toBe("/store/store_b/pos");
  });

  it("a back-office-only role has no POS page to land on: the store list, which never redirects back", async () => {
    userFindUnique.mockResolvedValue({ defaultLanding: "dashboard", business: null });
    getLinkedStaffForUser.mockResolvedValue(staffLink({ role: "MANAGER", allowedPages: ["/dashboard", "/finance"] }));

    expect(await launch(["pos"])).toBe("/stores");
  });

  it("no store and no staff link: the store list (create flow), as before", async () => {
    userFindUnique.mockResolvedValue({ defaultLanding: "dashboard", business: null });

    expect(await launch(["pos"])).toBe("/stores");
  });
});
