import { describe, it, expect, vi, beforeEach } from "vitest";

const getActiveStaffSession = vi.fn();
vi.mock("@/lib/staff-session", () => ({
  getActiveStaffSession: () => getActiveStaffSession(),
}));

const getStoreViewer = vi.fn();
vi.mock("../store-viewer", () => ({
  getStoreViewer: (...a: unknown[]) => getStoreViewer(...a),
}));

const linkedStaffHomePath = vi.fn();
vi.mock("../staff-home", () => ({
  linkedStaffHomePath: (...a: unknown[]) => linkedStaffHomePath(...a),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

import { requireOwnerOnly, requireOwnerOnlyApi } from "../require-owner-only";
import { requireManagerOrOwnerApi } from "../require-manager-or-owner";

const STORE = "store_1";
const OWNER = { kind: "owner" };
const LINKED = { kind: "staff", staffMemberId: "staff_me" };

const persona = (o: Record<string, unknown> = {}) => ({
  storeId: STORE,
  staffMemberId: "staff_me",
  name: "Me",
  role: "CASHIER",
  allowedPages: ["/pos"],
  ...o,
});

beforeEach(() => {
  getActiveStaffSession.mockReset();
  getStoreViewer.mockReset();
  redirect.mockClear();
  linkedStaffHomePath.mockReset();
  linkedStaffHomePath.mockResolvedValue("/store/store_1/pos");
  getStoreViewer.mockResolvedValue(OWNER);
});

describe("requireOwnerOnly", () => {
  it("owner with no persona: allowed (unchanged behaviour)", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    await expect(requireOwnerOnly(STORE)).resolves.toBeUndefined();
  });

  it("owner with a restricted persona layered on: still redirected (unchanged behaviour)", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ staffMemberId: "x", allowedPages: ["/pos"] }));
    await expect(requireOwnerOnly(STORE)).rejects.toThrow("REDIRECT:/store/store_1/pos");
  });

  it("a linked staff account with NO PIN persona is turned away — 'no persona' is not 'owner' for them", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(null);
    await expect(requireOwnerOnly(STORE)).rejects.toThrow("REDIRECT:/store/store_1/pos");
  });

  it("a linked staff account WITH a persona is turned away too", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(persona());
    await expect(requireOwnerOnly(STORE)).rejects.toThrow("REDIRECT:/store/store_1/pos");
  });

  it("no relationship to the store at all: fails closed to the store list", async () => {
    getStoreViewer.mockResolvedValue({ kind: "none" });
    await expect(requireOwnerOnly(STORE)).rejects.toThrow("REDIRECT:/stores");
  });
});

describe("requireOwnerOnlyApi", () => {
  it("owner with no persona: allowed", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(await requireOwnerOnlyApi(STORE)).toBeNull();
  });

  it("owner with a non-owner persona layered on: 403", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER" }));
    expect((await requireOwnerOnlyApi(STORE))?.status).toBe(403);
  });

  it("a linked staff account: 403, even a Manager persona", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER" }));
    expect((await requireOwnerOnlyApi(STORE))?.status).toBe(403);
  });

  it("a stranger: 403", async () => {
    getStoreViewer.mockResolvedValue({ kind: "none" });
    expect((await requireOwnerOnlyApi(STORE))?.status).toBe(403);
  });
});

describe("requireManagerOrOwnerApi", () => {
  it("owner with no persona: allowed (unchanged behaviour)", async () => {
    getActiveStaffSession.mockResolvedValue(null);
    expect(await requireManagerOrOwnerApi(STORE)).toBeNull();
  });

  it("owner with a Cashier persona: 403 (unchanged behaviour)", async () => {
    getActiveStaffSession.mockResolvedValue(persona({ staffMemberId: "x" }));
    expect((await requireManagerOrOwnerApi(STORE))?.status).toBe(403);
  });

  it("linked staff with no PIN persona: 403 — absence of a persona must not read as owner", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(null);
    expect((await requireManagerOrOwnerApi(STORE))?.status).toBe(403);
  });

  it("linked staff as a Cashier: 403", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(persona());
    expect((await requireManagerOrOwnerApi(STORE))?.status).toBe(403);
  });

  it("linked staff as a Manager with their OWN persona: allowed", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(persona({ role: "MANAGER" }));
    expect(await requireManagerOrOwnerApi(STORE)).toBeNull();
  });

  it("linked staff whose live persona is a DIFFERENT manager on this browser: 403", async () => {
    getStoreViewer.mockResolvedValue(LINKED);
    getActiveStaffSession.mockResolvedValue(persona({ staffMemberId: "the_manager", role: "MANAGER" }));
    expect((await requireManagerOrOwnerApi(STORE))?.status).toBe(403);
  });

  it("a stranger: 403", async () => {
    getStoreViewer.mockResolvedValue({ kind: "none" });
    expect((await requireManagerOrOwnerApi(STORE))?.status).toBe(403);
  });
});
