import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { DEFAULT_LOYALTY_SETTINGS, LoyaltySettingsService } from "../loyalty-settings.service";

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  storeId: "s1",
  enabled: true,
  spendPerPoint: new Prisma.Decimal("10000.00"),
  pointValue: new Prisma.Decimal("100.0000"),
  minRedeemPoints: 20,
  ...over,
});

let db: {
  storeLoyaltySettings: { findUnique: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
};
let service: LoyaltySettingsService;

beforeEach(() => {
  db = { storeLoyaltySettings: { findUnique: vi.fn(), upsert: vi.fn() } };
  service = new LoyaltySettingsService(db as never);
});

describe("get", () => {
  it("resolves defaults and NEVER returns null for a store that never configured it", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(null);
    expect(await service.get("s1")).toEqual({
      enabled: false,
      spendPerPoint: 0,
      pointValue: 0,
      minRedeemPoints: 0,
    });
    expect(await service.get("s1")).not.toBe(DEFAULT_LOYALTY_SETTINGS); // a copy, so callers can't mutate the default
  });

  it("returns the stored settings as literal numbers", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(row());
    expect(await service.get("s1")).toEqual({
      enabled: true,
      spendPerPoint: 10000,
      pointValue: 100,
      minRedeemPoints: 20,
    });
    expect(db.storeLoyaltySettings.findUnique).toHaveBeenCalledWith({ where: { storeId: "s1" } });
  });
});

describe("update", () => {
  const upserted = (over: Record<string, unknown> = {}) =>
    db.storeLoyaltySettings.upsert.mockResolvedValue(row(over));

  it("enables with both amounts positive", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(null);
    upserted();

    const out = await service.update("s1", {
      enabled: true,
      spendPerPoint: 1,
      pointValue: 0.05,
      minRedeemPoints: 10,
    });

    expect(db.storeLoyaltySettings.upsert).toHaveBeenCalledWith({
      where: { storeId: "s1" },
      create: {
        storeId: "s1",
        enabled: true,
        spendPerPoint: 1,
        pointValue: 0.05,
        minRedeemPoints: 10,
      },
      update: { enabled: true, spendPerPoint: 1, pointValue: 0.05, minRedeemPoints: 10 },
    });
    expect(out.enabled).toBe(true);
  });

  it("refuses to enable a never-configured store — spendPerPoint is still 0", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(null);

    await expect(service.update("s1", { enabled: true })).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: "spendPerPoint" }],
    });
    expect(db.storeLoyaltySettings.upsert).not.toHaveBeenCalled();
  });

  it("refuses to enable with a zero point value, naming that field", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(null);

    await expect(service.update("s1", { enabled: true, spendPerPoint: 1 })).rejects.toMatchObject({
      details: [{ field: "pointValue" }],
    });
  });

  it("the switch alone works once the amounts are stored (validated on the MERGED result)", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(row({ enabled: false }));
    upserted();

    await service.update("s1", { enabled: true });

    expect(db.storeLoyaltySettings.upsert.mock.calls[0][0].update).toEqual({
      enabled: true,
      spendPerPoint: 10000,
      pointValue: 100,
      minRedeemPoints: 20,
    });
  });

  it("refuses to zero an amount while the program is on", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(row());
    await expect(service.update("s1", { pointValue: 0 })).rejects.toMatchObject({
      details: [{ field: "pointValue" }],
    });
  });

  it("amounts may be edited (even to 0) while the program is OFF — nothing runs on them", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(row({ enabled: false }));
    upserted({ enabled: false, spendPerPoint: new Prisma.Decimal(0) });

    await service.update("s1", { spendPerPoint: 0 });

    expect(db.storeLoyaltySettings.upsert).toHaveBeenCalled();
  });

  it("stores amounts LITERALLY — a EUR store's 0.05 is 0.05, not an IDR conversion", async () => {
    db.storeLoyaltySettings.findUnique.mockResolvedValue(null);
    upserted({ spendPerPoint: new Prisma.Decimal(1), pointValue: new Prisma.Decimal("0.0500") });

    const out = await service.update("s1", { enabled: true, spendPerPoint: 1, pointValue: 0.05 });

    expect(db.storeLoyaltySettings.upsert.mock.calls[0][0].create).toMatchObject({
      spendPerPoint: 1,
      pointValue: 0.05,
    });
    expect(out).toMatchObject({ spendPerPoint: 1, pointValue: 0.05 });
  });
});
