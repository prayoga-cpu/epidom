import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params;
      return handler(req, { params, userId: "u1" });
    },
}));

const verifyStoreAccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/store-verification", () => ({ verifyStoreAccess }));

const authorizeStaffPrincipal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/staff-principal-policy", () => ({ authorizeStaffPrincipal }));

const getActiveStaffSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/staff-session", () => ({ getActiveStaffSession }));

const getSetupProgress = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/setup-progress.service", () => ({ getSetupProgress }));

import { GET } from "../route";

const STORE = "store_mine";
const PROGRESS = { storeId: STORE, items: [], sections: [], completed: 0, total: 0 };

const call = (storeId = STORE) =>
  GET(new Request(`http://localhost/api/stores/${storeId}/setup-progress`), {
    params: Promise.resolve({ id: storeId }),
  });

const ownerAccess = { store: { id: STORE }, accessType: "owner" as const };
const staffAccess = {
  store: { id: STORE },
  accessType: "staff" as const,
  staffMemberId: "staff_1",
};

const MANAGER_PAGES = ["/dashboard", "/storefront", "/pos", "/tables", "/data", "/schedule"];

const persona = (role: string, over: Record<string, unknown> = {}) => ({
  storeId: STORE,
  staffMemberId: "staff_1",
  name: "Sam",
  role,
  allowedPages: MANAGER_PAGES,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyStoreAccess.mockResolvedValue(ownerAccess);
  authorizeStaffPrincipal.mockResolvedValue(null);
  getActiveStaffSession.mockResolvedValue(null);
  getSetupProgress.mockResolvedValue(PROGRESS);
});

describe("GET /api/stores/[id]/setup-progress — who may read it", () => {
  it("the store's owner (no PIN persona): 200 with the progress, never cached", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: PROGRESS });
    expect(verifyStoreAccess).toHaveBeenCalledWith(STORE, "u1");
    // No page grants: the owner sees every item.
    expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), null);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("another business's store: 403 (not 404), and nothing is read", async () => {
    verifyStoreAccess.mockRejectedValue(
      new Error("Store not found or does not belong to your business")
    );
    const res = await call("store_theirs");
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(getSetupProgress).not.toHaveBeenCalled();
  });

  it("an unknown store id: the same 403", async () => {
    verifyStoreAccess.mockRejectedValue(new Error("Store not found"));
    expect((await call("store_ghost")).status).toBe(403);
  });

  it.each(["CASHIER", "KITCHEN"])(
    "a %s PIN persona for this store on the owner's device: 403",
    async (role) => {
      getActiveStaffSession.mockResolvedValue(persona(role));
      const res = await call();
      expect(res.status).toBe(403);
      expect(getSetupProgress).not.toHaveBeenCalled();
    }
  );

  it.each(["MANAGER", "OWNER"])("a %s PIN persona for this store: 200", async (role) => {
    getActiveStaffSession.mockResolvedValue(persona(role));
    expect((await call()).status).toBe(200);
  });

  it("a MANAGER persona only gets the items its page grants open", async () => {
    getActiveStaffSession.mockResolvedValue(persona("MANAGER"));
    await call();
    expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), MANAGER_PAGES);
  });

  it("a MANAGER persona without /dashboard: 403 (the dashboard page would redirect it), nothing read", async () => {
    getActiveStaffSession.mockResolvedValue(
      persona("MANAGER", { allowedPages: ["/finance", "/storefront"] })
    );
    const res = await call();
    expect(res.status).toBe(403);
    expect(getSetupProgress).not.toHaveBeenCalled();
  });

  it("an OWNER-role persona on the owner's device is unrestricted, whatever its page list", async () => {
    getActiveStaffSession.mockResolvedValue(persona("OWNER", { allowedPages: [] }));
    expect((await call()).status).toBe(200);
    expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), null);
  });

  it("a cashier persona left over from ANOTHER store doesn't restrict this one (dashboard rule)", async () => {
    getActiveStaffSession.mockResolvedValue(persona("CASHIER", { storeId: "store_other" }));
    expect((await call()).status).toBe(200);
    expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), null);
  });

  describe("a linked staff account", () => {
    beforeEach(() => {
      verifyStoreAccess.mockResolvedValue(staffAccess);
    });

    it("goes through the default-deny staff policy — refused while the route isn't listed", async () => {
      authorizeStaffPrincipal.mockResolvedValue(
        NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 })
      );
      getActiveStaffSession.mockResolvedValue(persona("MANAGER"));

      const res = await call();

      expect(res.status).toBe(403);
      expect(authorizeStaffPrincipal).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: STORE, staffMemberId: "staff_1" })
      );
      expect(getSetupProgress).not.toHaveBeenCalled();
    });

    it("if the policy ever admits it: only as its own MANAGER persona, held to its page grants", async () => {
      getActiveStaffSession.mockResolvedValue(persona("MANAGER"));
      expect((await call()).status).toBe(200);
      expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), MANAGER_PAGES);
    });

    it("if the policy ever admits it: an OWNER-role persona still doesn't take the owner shortcut", async () => {
      getActiveStaffSession.mockResolvedValue(persona("OWNER", { allowedPages: ["/pos"] }));
      expect((await call()).status).toBe(403);

      getActiveStaffSession.mockResolvedValue(persona("OWNER"));
      expect((await call()).status).toBe(200);
      expect(getSetupProgress).toHaveBeenCalledWith(STORE, expect.any(Date), MANAGER_PAGES);
    });

    it("if the policy ever admits it: a MANAGER persona without /dashboard is 403", async () => {
      getActiveStaffSession.mockResolvedValue(persona("MANAGER", { allowedPages: ["/pos"] }));
      expect((await call()).status).toBe(403);
      expect(getSetupProgress).not.toHaveBeenCalled();
    });

    it("if the policy ever admits it: a cashier persona is still 403", async () => {
      getActiveStaffSession.mockResolvedValue(persona("CASHIER"));
      expect((await call()).status).toBe(403);
    });

    it("if the policy ever admits it: no persona, or someone else's, is 403", async () => {
      expect((await call()).status).toBe(403);
      getActiveStaffSession.mockResolvedValue(persona("MANAGER", { staffMemberId: "staff_2" }));
      expect((await call()).status).toBe(403);
    });
  });
});
