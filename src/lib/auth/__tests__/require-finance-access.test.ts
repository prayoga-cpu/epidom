import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const requireStoreFeatureApi = vi.fn();
vi.mock("../require-store-feature", () => ({
  requireStoreFeatureApi: (...a: unknown[]) => requireStoreFeatureApi(...a),
}));

const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: (...a: unknown[]) => getActiveStaffSession(...a),
}));

import {
  requireFinanceReportAccessApi,
  staffPersonaMayReadFinance,
} from "../require-finance-access";

const persona = (storeId: string, role: string, allowedPages: string[] = []) => ({
  storeId,
  role,
  allowedPages,
});

describe("staffPersonaMayReadFinance", () => {
  it("the owner — no persona, or the OWNER persona — may read any outlet", () => {
    expect(staffPersonaMayReadFinance(null, "store-a")).toBe(true);
    expect(staffPersonaMayReadFinance(persona("store-b", "OWNER"), "store-a")).toBe(true);
  });

  it("a persona of this outlet needs the page granted", () => {
    expect(staffPersonaMayReadFinance(persona("store-a", "MANAGER", ["/finance"]), "store-a")).toBe(
      true
    );
    expect(staffPersonaMayReadFinance(persona("store-a", "CASHIER", ["/pos"]), "store-a")).toBe(
      false
    );
  });

  it("accepts any of the pages the route names (/shifts also reads cash reconciliation)", () => {
    const manager = persona("store-a", "MANAGER", ["/shifts"]);
    expect(staffPersonaMayReadFinance(manager, "store-a")).toBe(false);
    expect(staffPersonaMayReadFinance(manager, "store-a", ["/finance", "/shifts"])).toBe(true);
  });

  // The owner-only All outlets scope means nothing if a manager of outlet A
  // can read outlet B's report routes one by one on the owner's iPad.
  it("never lets another outlet's persona read this outlet, whatever it was granted", () => {
    expect(staffPersonaMayReadFinance(persona("store-b", "MANAGER", ["/finance"]), "store-a")).toBe(
      false
    );
  });
});

describe("requireFinanceReportAccessApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStoreFeatureApi.mockResolvedValue(null);
    getActiveStaffSession.mockResolvedValue(null);
  });

  it("checks the plan first, on the finance feature, and returns its 403 untouched", async () => {
    const locked = NextResponse.json({ success: false }, { status: 403 });
    requireStoreFeatureApi.mockResolvedValue(locked);

    expect(await requireFinanceReportAccessApi("store-a")).toBe(locked);
    expect(requireStoreFeatureApi).toHaveBeenCalledWith("store-a", "finance", expect.any(String));
  });

  it("lets the owner through once the plan qualifies", async () => {
    expect(await requireFinanceReportAccessApi("store-a")).toBeNull();
  });

  it("refuses a persona without the grant with 403 FORBIDDEN", async () => {
    getActiveStaffSession.mockResolvedValue(persona("store-a", "CASHIER", ["/pos"]));

    const res = await requireFinanceReportAccessApi("store-a");

    expect(res!.status).toBe(403);
    expect((await res!.json()).error.code).toBe("FORBIDDEN");
  });

  it("refuses another outlet's persona", async () => {
    getActiveStaffSession.mockResolvedValue(persona("store-b", "MANAGER", ["/finance"]));
    expect((await requireFinanceReportAccessApi("store-a"))!.status).toBe(403);
  });
});
