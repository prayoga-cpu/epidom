import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: () => mockGetActiveStaffSession(),
}));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

import { requireStaffPageAccess } from "../require-staff-page-access";

function session(overrides: Partial<{ storeId: string; role: string; allowedPages: string[] }> = {}) {
  return {
    storeId: "store-1",
    staffMemberId: "staff-1",
    name: "Test",
    role: "CASHIER",
    allowedPages: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockGetActiveStaffSession.mockReset();
  mockRedirect.mockClear();
});

describe("requireStaffPageAccess", () => {
  it("no active staff session — the real owner is browsing, always unrestricted", async () => {
    mockGetActiveStaffSession.mockResolvedValue(null);
    await expect(requireStaffPageAccess("store-1", "/finance")).resolves.toBeUndefined();
  });

  it("session for a different store — unrestricted here", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ storeId: "store-2" }));
    await expect(requireStaffPageAccess("store-1", "/finance")).resolves.toBeUndefined();
  });

  it("OWNER-role StaffMember row — unrestricted regardless of allowedPages", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ role: "OWNER", allowedPages: [] }));
    await expect(requireStaffPageAccess("store-1", "/finance")).resolves.toBeUndefined();
  });

  it("single page: granted — no redirect", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/pos"] }));
    await expect(requireStaffPageAccess("store-1", "/pos")).resolves.toBeUndefined();
  });

  it("single page: not granted — redirects to the fallback", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/pos"] }));
    await expect(requireStaffPageAccess("store-1", "/finance")).rejects.toThrow(
      "REDIRECT:/store/store-1/pos"
    );
  });

  // New behavior — a route now serving two grants (e.g. /storefront covering
  // both "/storefront" and the retired standalone "/menu" permission).
  it("array of pages: granted via ANY one of them — no redirect", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/menu"] }));
    await expect(
      requireStaffPageAccess("store-1", ["/menu", "/storefront"])
    ).resolves.toBeUndefined();
  });

  it("array of pages: granted via the other one — no redirect", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/storefront"] }));
    await expect(
      requireStaffPageAccess("store-1", ["/menu", "/storefront"])
    ).resolves.toBeUndefined();
  });

  it("array of pages: granted via neither — redirects", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: ["/pos"] }));
    await expect(requireStaffPageAccess("store-1", ["/menu", "/storefront"])).rejects.toThrow(
      "REDIRECT:/store/store-1/pos"
    );
  });

  it("no allowed pages at all — falls back to /dashboard", async () => {
    mockGetActiveStaffSession.mockResolvedValue(session({ allowedPages: [] }));
    await expect(requireStaffPageAccess("store-1", "/finance")).rejects.toThrow(
      "REDIRECT:/store/store-1/dashboard"
    );
  });
});
