import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  store: { findFirst: vi.fn() },
  staffMember: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  applyGuideStatePatch,
  getGuideState,
  GuideStoreAccessError,
  parseGuideState,
  userCanAccessStore,
} from "../guide.service";

const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ guideState: null });
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.store.findFirst.mockResolvedValue(null);
  prismaMock.staffMember.findFirst.mockResolvedValue(null);
});

describe("parseGuideState (re-exported for server callers)", () => {
  it("is the tolerant parser", () => {
    expect(parseGuideState({ dismissedTips: ["stock", "bogus"] }).dismissedTips).toEqual(["stock"]);
  });
});

describe("getGuideState", () => {
  it("reads only the caller's row and parses it", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      guideState: { tourSeenAt: "2026-09-01T00:00:00.000Z", dismissedTips: ["stock", "x"] },
    });

    const state = await getGuideState(USER);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER },
      select: { guideState: true },
    });
    expect(state).toEqual({
      tourSeenAt: "2026-09-01T00:00:00.000Z",
      dismissedTips: ["stock"],
      dismissedChecklists: [],
    });
  });

  it("is the empty state for a user with nothing stored, or no row at all", async () => {
    expect(await getGuideState(USER)).toEqual({
      tourSeenAt: null,
      dismissedTips: [],
      dismissedChecklists: [],
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    expect((await getGuideState(USER)).dismissedTips).toEqual([]);
  });
});

describe("applyGuideStatePatch", () => {
  const writtenState = () => prismaMock.user.updateMany.mock.calls.at(-1)![0].data.guideState;

  it("tourSeen writes an ISO timestamp and returns the full state", async () => {
    const state = await applyGuideStatePatch(USER, { tourSeen: true });

    expect(state.tourSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(writtenState()).toEqual(state);
  });

  it("compare-and-swaps against the NULL column when nothing was stored", async () => {
    await applyGuideStatePatch(USER, { dismissTip: "stock" });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER, guideState: { equals: Prisma.AnyNull } },
      data: { guideState: { tourSeenAt: null, dismissedTips: ["stock"], dismissedChecklists: [] } },
    });
  });

  it("compare-and-swaps against exactly what it read (even keys the parser drops)", async () => {
    const raw = { tourSeenAt: null, dismissedTips: ["finance"], legacy: 1 };
    prismaMock.user.findUnique.mockResolvedValue({ guideState: raw });

    await applyGuideStatePatch(USER, { dismissTip: "stock" });

    const call = prismaMock.user.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: USER, guideState: { equals: raw } });
    expect(call.data.guideState.dismissedTips).toEqual(["finance", "stock"]);
    expect(call.data.guideState).not.toHaveProperty("legacy");
  });

  it("re-reads and re-applies when another write landed first, so neither change is lost", async () => {
    // Read 1: empty. Meanwhile another request marks the tour seen. Read 2 sees it.
    prismaMock.user.findUnique.mockResolvedValueOnce({ guideState: null }).mockResolvedValueOnce({
      guideState: { tourSeenAt: "2026-09-26T09:00:00.000Z", dismissedTips: [] },
    });
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({
      count: 1,
    });

    const state = await applyGuideStatePatch(USER, { dismissTip: "stock" });

    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(2);
    expect(state).toEqual({
      tourSeenAt: "2026-09-26T09:00:00.000Z",
      dismissedTips: ["stock"],
      dismissedChecklists: [],
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("after repeated conflicts, the last attempt writes unconditionally", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 });

    const state = await applyGuideStatePatch(USER, { restoreTips: true });

    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: { guideState: state },
    });
  });

  it("restoreChecklist needs no store check — un-hiding only ever touches the caller's row", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      guideState: { dismissedChecklists: ["store_a", "store_b"] },
    });

    const state = await applyGuideStatePatch(USER, { restoreChecklist: "store_a" });

    expect(state.dismissedChecklists).toEqual(["store_b"]);
    expect(prismaMock.store.findFirst).not.toHaveBeenCalled();
  });

  describe("dismissChecklist", () => {
    it("accepts a store the user's business owns", async () => {
      prismaMock.store.findFirst.mockResolvedValue({ id: "store_own" });

      const state = await applyGuideStatePatch(USER, { dismissChecklist: "store_own" });

      expect(prismaMock.store.findFirst).toHaveBeenCalledWith({
        where: { id: "store_own", business: { userId: USER } },
        select: { id: true },
      });
      expect(state.dismissedChecklists).toEqual(["store_own"]);
    });

    it("accepts the store the account is linked to as active staff", async () => {
      prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff_1" });

      const state = await applyGuideStatePatch(USER, { dismissChecklist: "store_linked" });

      expect(prismaMock.staffMember.findFirst).toHaveBeenCalledWith({
        where: {
          storeId: "store_linked",
          userId: USER,
          isActive: true,
          role: { not: "OWNER" },
        },
        select: { id: true },
      });
      expect(state.dismissedChecklists).toEqual(["store_linked"]);
    });

    it("rejects any other store and writes nothing", async () => {
      await expect(
        applyGuideStatePatch(USER, { dismissChecklist: "someone_elses_store" })
      ).rejects.toBeInstanceOf(GuideStoreAccessError);

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});

describe("userCanAccessStore", () => {
  it("is false when the user neither owns nor is linked to the store", async () => {
    expect(await userCanAccessStore(USER, "s")).toBe(false);
  });

  it("is true for either way in", async () => {
    prismaMock.store.findFirst.mockResolvedValueOnce({ id: "s" });
    expect(await userCanAccessStore(USER, "s")).toBe(true);
    prismaMock.staffMember.findFirst.mockResolvedValueOnce({ id: "m" });
    expect(await userCanAccessStore(USER, "s")).toBe(true);
  });
});
