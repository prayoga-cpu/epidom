/**
 * A store's plan is its OWNER's subscription, whoever is asking — the rule
 * requirePlan uses, as a plain read.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { store: { findUnique: db.findUnique } } }));

import { getStorePlan } from "../store-plan";

const storeWith = (subscription: { plan: string; status: string } | null) => ({
  business: { user: { subscription } },
});

beforeEach(() => {
  db.findUnique.mockReset();
});

describe("getStorePlan", () => {
  it.each([
    ["OPERATIONS", "ACTIVE", "OPERATIONS"],
    ["ENTERPRISE", "ACTIVE", "ENTERPRISE"],
    ["POS", "ACTIVE", "POS"],
    ["OPERATIONS", "CANCELED", "FREE"],
    ["ENTERPRISE", "PAST_DUE", "FREE"],
  ])("%s %s → %s", async (planName, status, expected) => {
    db.findUnique.mockResolvedValue(storeWith({ plan: planName, status }));
    expect(await getStorePlan(`store-${planName}-${status}`)).toBe(expected);
  });

  it("no subscription, or no store at all, is FREE", async () => {
    db.findUnique.mockResolvedValue(storeWith(null));
    expect(await getStorePlan("store-nosub")).toBe("FREE");
    db.findUnique.mockResolvedValue(null);
    expect(await getStorePlan("store-missing")).toBe("FREE");
  });

  it("reads the store owner's subscription through the store, never the caller's", async () => {
    db.findUnique.mockResolvedValue(storeWith({ plan: "OPERATIONS", status: "ACTIVE" }));
    await getStorePlan("store-owner-read");
    expect(db.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "store-owner-read" } })
    );
  });
});
