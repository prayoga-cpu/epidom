import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyStoreAccess = vi.hoisted(() => vi.fn());
const getStorePlan = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  staffMember: { findUnique: vi.fn() },
}));

vi.mock("@/lib/utils/store-verification", () => ({ verifyStoreAccess }));
vi.mock("@/lib/plans/store-plan", () => ({ getStorePlan }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { authorizeMcpStore, McpAccessError, staffMayUse } from "../authorize";

const STORE = { id: "store-1", name: "Kopi Senja", businessId: "biz-1" };
const READ = ["epidom:read"];
const WRITE = ["epidom:read", "epidom:write"];
const principal = (scopes = WRITE) => ({
  userId: "user-1",
  clientId: "c1",
  clientName: "Claude",
  scopes,
});

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(McpAccessError);
    return (error as McpAccessError).code;
  }
  throw new Error("expected a refusal");
}

describe("staffMayUse", () => {
  const cashier = {
    role: "CASHIER" as const,
    pages: ["/pos", "/pos/orders", "/tables", "/pos/schedule"],
  };
  const manager = { role: "MANAGER" as const, pages: ["/dashboard", "/schedule", "/management"] };

  it("denies by default: a tool that names no pages is the owner's", () => {
    expect(staffMayUse({}, manager)).toBe(false);
    expect(staffMayUse({ pages: [] }, manager)).toBe(false);
  });

  it("admits staff whose grants include one of the tool's pages", () => {
    expect(staffMayUse({ pages: ["/pos/orders", "/dashboard"] }, cashier)).toBe(true);
    expect(staffMayUse({ pages: ["/finance"] }, cashier)).toBe(false);
  });

  it("applies managerOnly and ownerOnly on top", () => {
    expect(staffMayUse({ pages: ["/schedule", "/pos/schedule"], managerOnly: true }, cashier)).toBe(
      false
    );
    expect(staffMayUse({ pages: ["/schedule"], managerOnly: true }, manager)).toBe(true);
    expect(staffMayUse({ pages: ["/schedule"], ownerOnly: true }, manager)).toBe(false);
  });
});

describe("authorizeMcpStore", () => {
  beforeEach(() => {
    verifyStoreAccess.mockReset();
    getStorePlan.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.staffMember.findUnique.mockReset();
    getStorePlan.mockResolvedValue("ENTERPRISE");
    prisma.user.findUnique.mockResolvedValue({ name: "Sari", email: "sari@example.com" });
  });

  it("refuses a write on a read-only connection before reading anything", async () => {
    expect(await refusal(authorizeMcpStore(principal(READ), "store-1", {}, "write"))).toBe(
      "WRITE_SCOPE_REQUIRED"
    );
    expect(verifyStoreAccess).not.toHaveBeenCalled();
  });

  it("refuses a store the account can't open", async () => {
    verifyStoreAccess.mockRejectedValue(new Error("Store not found"));
    expect(await refusal(authorizeMcpStore(principal(), "store-x", {}, "read"))).toBe(
      "STORE_NOT_FOUND"
    );
  });

  it("refuses a store whose plan doesn't include the connector", async () => {
    verifyStoreAccess.mockResolvedValue({ store: STORE, accessType: "owner" });
    getStorePlan.mockResolvedValue("OPERATIONS");
    expect(await refusal(authorizeMcpStore(principal(), "store-1", {}, "read"))).toBe(
      "PLAN_REQUIRED"
    );
  });

  it("lets the owner through every rule, attributed to the owner", async () => {
    verifyStoreAccess.mockResolvedValue({ store: STORE, accessType: "owner" });
    const ctx = await authorizeMcpStore(principal(), "store-1", { ownerOnly: true }, "write");
    expect(ctx.role).toBe("OWNER");
    expect(ctx.actor).toMatchObject({ kind: "USER", refId: "user-1", email: "sari@example.com" });
  });

  it("holds a linked staff account to its role and page grants", async () => {
    verifyStoreAccess.mockResolvedValue({
      store: STORE,
      accessType: "staff",
      staffMemberId: "staff-1",
    });
    prisma.staffMember.findUnique.mockResolvedValue({
      id: "staff-1",
      name: "Andi",
      role: "CASHIER",
      allowedPages: [],
    });

    // CASHIER's default pages include /pos/orders ...
    const ctx = await authorizeMcpStore(principal(), "store-1", { pages: ["/pos/orders"] }, "read");
    expect(ctx.role).toBe("CASHIER");
    expect(ctx.actor).toMatchObject({ kind: "STAFF", refId: "staff-1" });
    // ... but not /finance, and never an owner-only tool.
    expect(
      await refusal(authorizeMcpStore(principal(), "store-1", { pages: ["/finance"] }, "read"))
    ).toBe("FORBIDDEN");
    expect(
      await refusal(authorizeMcpStore(principal(), "store-1", { ownerOnly: true }, "read"))
    ).toBe("FORBIDDEN");
  });

  it("uses a staff member's own page list when one is set", async () => {
    verifyStoreAccess.mockResolvedValue({
      store: STORE,
      accessType: "staff",
      staffMemberId: "staff-1",
    });
    prisma.staffMember.findUnique.mockResolvedValue({
      id: "staff-1",
      name: "Andi",
      role: "MANAGER",
      allowedPages: ["/finance"],
    });
    await expect(
      authorizeMcpStore(principal(), "store-1", { pages: ["/finance"], managerOnly: true }, "read")
    ).resolves.toMatchObject({ role: "MANAGER" });
    expect(
      await refusal(authorizeMcpStore(principal(), "store-1", { pages: ["/schedule"] }, "read"))
    ).toBe("FORBIDDEN");
  });
});
