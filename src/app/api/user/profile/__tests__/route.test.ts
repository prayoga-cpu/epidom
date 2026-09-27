import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api-handler", () => ({
  withApiHandler:
    (handler: (req: Request, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: Request, ctx: Record<string, unknown>) =>
      handler(req, ctx),
}));

const getProfile = vi.fn();
vi.mock("@/lib/services", () => ({
  userService: { getProfile: (...a: unknown[]) => getProfile(...a), updateProfile: vi.fn() },
}));

const getLinkedStaffForUser = vi.fn();
vi.mock("@/lib/auth/staff-link", () => ({
  getLinkedStaffForUser: (...a: unknown[]) => getLinkedStaffForUser(...a),
}));

import { GET } from "../route";

const call = (userId = "u1") =>
  GET(new Request("http://localhost/api/user/profile"), { userId } as never);

beforeEach(() => {
  getProfile.mockReset();
  getLinkedStaffForUser.mockReset();
});

describe("GET /api/user/profile — staffLink (what the /stores gatekeeper keys on)", () => {
  it("an owner: profile unchanged, staffLink null", async () => {
    getProfile.mockResolvedValue({ id: "u1", business: { id: "biz_1", stores: [{ id: "s" }] } });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.business.id).toBe("biz_1");
    expect(data.staffLink).toBeNull();
  });

  it("a linked staff login: no business, but staffLink says which store — and nothing more about the staff row", async () => {
    getProfile.mockResolvedValue({ id: "u2", business: null });
    getLinkedStaffForUser.mockResolvedValue({
      id: "staff_1",
      storeId: "store_b",
      role: "MANAGER",
      allowedPages: ["/pos"],
      store: { id: "store_b", name: "Cafe B" },
    });

    const { data } = await (await call("u2")).json();

    expect(data.business).toBeNull();
    expect(data.staffLink).toEqual({ storeId: "store_b", storeName: "Cafe B" });
  });
});

describe("GET /api/user/profile — owner PIN hash never leaves the server", () => {
  // bcrypt hash of a 4-digit PIN: 10,000 candidates, cracked offline in minutes
  // by a staff persona that opens this URL on the owner's device.
  const HASH = "$2a$10$abcdefghijklmnopqrstuuM2m4o0nN6wWm1l1y8y0Yb0Yb0Yb0Yb0";

  it("drops business.ownerPin, says hasOwnerPin: true, keeps every other field", async () => {
    getProfile.mockResolvedValue({
      id: "u1",
      hasOnboarded: true,
      business: {
        id: "biz_1",
        name: "Kopi",
        timezone: "Asia/Jakarta",
        ownerPin: HASH,
        onboardingStep: null,
        stores: [{ id: "s" }],
      },
    });
    getLinkedStaffForUser.mockResolvedValue(null);

    const res = await call();
    const text = await res.clone().text();
    const { data } = await res.json();

    expect(text).not.toContain(HASH);
    expect(data.business).not.toHaveProperty("ownerPin");
    expect(data.business).toEqual({
      id: "biz_1",
      name: "Kopi",
      timezone: "Asia/Jakarta",
      hasOwnerPin: true,
      onboardingStep: null,
      stores: [{ id: "s" }],
    });
  });

  it("hasOwnerPin: false when no PIN is set", async () => {
    getProfile.mockResolvedValue({
      id: "u1",
      business: { id: "biz_1", ownerPin: null, stores: [] },
    });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.business).not.toHaveProperty("ownerPin");
    expect(data.business.hasOwnerPin).toBe(false);
  });

  it("keeps the flag when the repository already stripped the hash", async () => {
    getProfile.mockResolvedValue({
      id: "u1",
      business: { id: "biz_1", hasOwnerPin: true, stores: [] },
    });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.business.hasOwnerPin).toBe(true);
  });
});

describe("GET /api/user/profile — setup wizard progress (what sends a half-onboarded owner back)", () => {
  it("passes hasOnboarded and business.onboardingStep through", async () => {
    getProfile.mockResolvedValue({
      id: "u1",
      hasOnboarded: false,
      business: { id: "biz_1", onboardingStep: 2, stores: [{ id: "s" }] },
    });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.hasOnboarded).toBe(false);
    expect(data.business.onboardingStep).toBe(2);
    expect(data.business.stores).toEqual([{ id: "s" }]);
  });

  it("always present: false / null when the row doesn't carry them", async () => {
    getProfile.mockResolvedValue({ id: "u1", business: { id: "biz_1", stores: [] } });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.hasOnboarded).toBe(false);
    expect(data.business.onboardingStep).toBeNull();
  });

  it("a finished owner", async () => {
    getProfile.mockResolvedValue({
      id: "u1",
      hasOnboarded: true,
      business: { id: "biz_1", onboardingStep: null, stores: [{ id: "s" }] },
    });
    getLinkedStaffForUser.mockResolvedValue(null);

    const { data } = await (await call()).json();

    expect(data.hasOnboarded).toBe(true);
    expect(data.business.onboardingStep).toBeNull();
  });
});
