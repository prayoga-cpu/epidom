import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { PromotionService, toCouponDto, toPresetDto } from "../promotion.service";
import type { PromotionRepository } from "@/lib/repositories/promotion.repository";

const D = (n: number | string) => new Prisma.Decimal(n);

const preset = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  storeId: "s1",
  name: "Member",
  type: "PERCENT",
  value: D(10),
  isActive: true,
  sortOrder: 0,
  ...over,
});

const coupon = (over: Record<string, unknown> = {}) => ({
  id: "k1",
  storeId: "s1",
  code: "SAVE10",
  name: "Ten off",
  type: "PERCENT",
  value: D(10),
  minSubtotal: null,
  maxUses: null,
  usedCount: 0,
  validFrom: null,
  validUntil: null,
  isActive: true,
  ...over,
});

function makeRepo() {
  return {
    listPresets: vi.fn(),
    findPresetById: vi.fn(),
    nextPresetSortOrder: vi.fn().mockResolvedValue(3),
    createPreset: vi.fn(),
    updatePreset: vi.fn(),
    deletePreset: vi.fn(),
    listCoupons: vi.fn(),
    findCouponById: vi.fn(),
    findCouponByCode: vi.fn().mockResolvedValue(null),
    createCoupon: vi.fn(),
    updateCoupon: vi.fn(),
  };
}

let repo: ReturnType<typeof makeRepo>;
let service: PromotionService;

beforeEach(() => {
  repo = makeRepo();
  service = new PromotionService(repo as unknown as PromotionRepository);
});

describe("DTO mapping — Decimals become plain literal numbers", () => {
  it("presets", () => {
    expect(toPresetDto(preset({ type: "FIXED", value: D("2.50") }) as never)).toEqual({
      id: "p1",
      name: "Member",
      type: "FIXED",
      value: 2.5,
      isActive: true,
      sortOrder: 0,
    });
  });

  it("coupons keep null bounds null and serialise dates", () => {
    const from = new Date("2026-10-01T00:00:00Z");
    expect(
      toCouponDto(
        coupon({ minSubtotal: D("20.00"), maxUses: 5, usedCount: 2, validFrom: from }) as never
      )
    ).toEqual({
      id: "k1",
      code: "SAVE10",
      name: "Ten off",
      type: "PERCENT",
      value: 10,
      minSubtotal: 20,
      maxUses: 5,
      usedCount: 2,
      validFrom: from.toISOString(),
      validUntil: null,
      isActive: true,
    });
    expect(toCouponDto(coupon() as never).minSubtotal).toBeNull();
  });
});

describe("discount presets", () => {
  it("lists active only by default, everything on request", async () => {
    repo.listPresets.mockResolvedValue([preset()]);
    await service.listPresets("s1");
    expect(repo.listPresets).toHaveBeenLastCalledWith("s1", false);
    await service.listPresets("s1", true);
    expect(repo.listPresets).toHaveBeenLastCalledWith("s1", true);
  });

  it("creates at the end of the list unless a sortOrder is given, active by default", async () => {
    repo.createPreset.mockResolvedValue(preset());

    await service.createPreset("s1", { name: "Member", type: "PERCENT", value: 10 });
    expect(repo.createPreset).toHaveBeenLastCalledWith({
      storeId: "s1",
      name: "Member",
      type: "PERCENT",
      value: 10,
      isActive: true,
      sortOrder: 3,
    });

    await service.createPreset("s1", {
      name: "Free",
      type: "FIXED",
      value: 5,
      isActive: false,
      sortOrder: 0,
    });
    expect(repo.createPreset).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false, sortOrder: 0 })
    );
  });

  it("stores a FIXED value LITERALLY (no currency conversion)", async () => {
    repo.createPreset.mockResolvedValue(preset({ type: "FIXED", value: D(5) }));
    await service.createPreset("s1", { name: "5 off", type: "FIXED", value: 5 });
    expect(repo.createPreset.mock.calls[0][0].value).toBe(5);
  });

  it("update is a 404 for a preset of another store (the lookup is store-scoped)", async () => {
    repo.findPresetById.mockResolvedValue(null);
    await expect(service.updatePreset("s1", "px", { isActive: false })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.findPresetById).toHaveBeenCalledWith("s1", "px");
    expect(repo.updatePreset).not.toHaveBeenCalled();
  });

  it("update writes only what was sent", async () => {
    repo.findPresetById.mockResolvedValue(preset());
    repo.updatePreset.mockResolvedValue(preset({ isActive: false }));
    await service.updatePreset("s1", "p1", { isActive: false });
    expect(repo.updatePreset).toHaveBeenCalledWith("p1", { isActive: false });
  });

  it("changing the type checks the STORED value (FIXED 5000 cannot silently become 5000%)", async () => {
    repo.findPresetById.mockResolvedValue(preset({ type: "FIXED", value: D(5000) }));
    await expect(service.updatePreset("s1", "p1", { type: "PERCENT" })).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: "value" }],
    });
    expect(repo.updatePreset).not.toHaveBeenCalled();
  });

  it("changing just the value checks it against the STORED type", async () => {
    repo.findPresetById.mockResolvedValue(preset({ type: "PERCENT", value: D(10) }));
    await expect(service.updatePreset("s1", "p1", { value: 250 })).rejects.toMatchObject({
      statusCode: 400,
    });
    repo.updatePreset.mockResolvedValue(preset({ value: D(25) }));
    await expect(service.updatePreset("s1", "p1", { value: 25 })).resolves.toMatchObject({
      value: 25,
    });
  });

  it("delete is store-scoped, then hard", async () => {
    repo.findPresetById.mockResolvedValue(preset());
    await service.deletePreset("s1", "p1");
    expect(repo.deletePreset).toHaveBeenCalledWith("p1");

    repo.findPresetById.mockResolvedValue(null);
    await expect(service.deletePreset("s1", "px")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.deletePreset).toHaveBeenCalledTimes(1);
  });
});

describe("coupons", () => {
  const input = { code: "SAVE10", type: "PERCENT", value: 10 } as const;

  it("creates with nullable bounds defaulted to null and active by default", async () => {
    repo.createCoupon.mockResolvedValue(coupon());
    await service.createCoupon("s1", { ...input });
    expect(repo.createCoupon).toHaveBeenCalledWith({
      storeId: "s1",
      code: "SAVE10",
      name: null,
      type: "PERCENT",
      value: 10,
      minSubtotal: null,
      maxUses: null,
      validFrom: null,
      validUntil: null,
      isActive: true,
    });
  });

  it("refuses a code the store already has with a 409 on the code field", async () => {
    repo.findCouponByCode.mockResolvedValue(coupon());
    await expect(service.createCoupon("s1", { ...input })).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
      details: [{ field: "code" }],
    });
    expect(repo.findCouponByCode).toHaveBeenCalledWith("s1", "SAVE10");
    expect(repo.createCoupon).not.toHaveBeenCalled();
  });

  it("maps a lost race (P2002) to the same 409, and rethrows anything else", async () => {
    repo.createCoupon.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "t" })
    );
    await expect(service.createCoupon("s1", { ...input })).rejects.toMatchObject({
      statusCode: 409,
    });

    const boom = new Error("db");
    repo.createCoupon.mockRejectedValueOnce(boom);
    await expect(service.createCoupon("s1", { ...input })).rejects.toBe(boom);
  });

  it("update is a 404 for another store's coupon", async () => {
    repo.findCouponById.mockResolvedValue(null);
    await expect(service.updateCoupon("s1", "kx", { isActive: false })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("deactivating is just isActive:false — there is no delete", async () => {
    repo.findCouponById.mockResolvedValue(coupon());
    repo.updateCoupon.mockResolvedValue(coupon({ isActive: false }));
    expect(await service.updateCoupon("s1", "k1", { isActive: false })).toMatchObject({
      isActive: false,
    });
    expect(repo.updateCoupon).toHaveBeenCalledWith("k1", { isActive: false });
    expect(service).not.toHaveProperty("deleteCoupon");
  });

  it("null clears a bound", async () => {
    repo.findCouponById.mockResolvedValue(coupon({ maxUses: 5 }));
    repo.updateCoupon.mockResolvedValue(coupon());
    await service.updateCoupon("s1", "k1", { maxUses: null, validUntil: null });
    expect(repo.updateCoupon).toHaveBeenCalledWith("k1", { maxUses: null, validUntil: null });
  });

  it("checks the validity window against the STORED other end", async () => {
    repo.findCouponById.mockResolvedValue(coupon({ validFrom: new Date("2026-10-10T00:00:00Z") }));
    await expect(
      service.updateCoupon("s1", "k1", { validUntil: new Date("2026-10-01T00:00:00Z") })
    ).rejects.toMatchObject({ statusCode: 400, details: [{ field: "validUntil" }] });
    expect(repo.updateCoupon).not.toHaveBeenCalled();
  });

  it("changing the type checks the stored value", async () => {
    repo.findCouponById.mockResolvedValue(coupon({ type: "FIXED", value: D(500) }));
    await expect(service.updateCoupon("s1", "k1", { type: "PERCENT" })).rejects.toMatchObject({
      details: [{ field: "value" }],
    });
  });
});

describe("validateCoupon — always resolves, never throws for a business reason", () => {
  const validate = (over: Record<string, unknown> = {}, itemsTotal = 100, code = "SAVE10") => {
    repo.findCouponByCode.mockResolvedValue(over === null ? null : coupon(over));
    return service.validateCoupon("s1", { code, itemsTotal });
  };

  it("an unknown code is NOT_FOUND", async () => {
    repo.findCouponByCode.mockResolvedValue(null);
    expect(await service.validateCoupon("s1", { code: "NOPE", itemsTotal: 10 })).toEqual({
      valid: false,
      reason: "NOT_FOUND",
    });
    expect(repo.findCouponByCode).toHaveBeenCalledWith("s1", "NOPE");
  });

  it("prices a percent coupon against the items total the client sent", async () => {
    expect(await validate({ type: "PERCENT", value: D(15) }, 80)).toEqual({
      valid: true,
      coupon: {
        id: "k1",
        code: "SAVE10",
        name: "Ten off",
        type: "PERCENT",
        value: 15,
        minSubtotal: null,
      },
      discountAmount: 12,
    });
  });

  it("prices a FIXED coupon literally and never past the bill", async () => {
    expect((await validate({ type: "FIXED", value: D(5) }, 40)).discountAmount).toBe(5);
    expect((await validate({ type: "FIXED", value: D(500) }, 40)).discountAmount).toBe(40);
  });

  it.each([
    ["INACTIVE", { isActive: false }],
    ["NOT_STARTED", { validFrom: new Date(Date.now() + 86_400_000) }],
    ["EXPIRED", { validUntil: new Date(Date.now() - 86_400_000) }],
    ["USED_UP", { maxUses: 3, usedCount: 3 }],
    ["BELOW_MINIMUM", { minSubtotal: D(50) }],
  ])("%s is valid:false with the reason and the coupon's public info", async (reason, over) => {
    const out = await validate(over as Record<string, unknown>, 20);
    expect(out).toMatchObject({ valid: false, reason, coupon: { id: "k1", code: "SAVE10" } });
    expect(out.discountAmount).toBeUndefined();
  });

  it("a coupon exactly at its minimum subtotal is valid", async () => {
    expect((await validate({ minSubtotal: D(50) }, 50)).valid).toBe(true);
  });

  // The cart re-checks against this when the bill shrinks after the coupon was applied.
  it("returns the coupon's minSubtotal as a plain number (or null) on both valid and rejected results", async () => {
    const ok = await validate({ minSubtotal: D("12.50") }, 40);
    expect(ok.valid).toBe(true);
    expect(ok.coupon?.minSubtotal).toBe(12.5);

    const below = await validate({ minSubtotal: D(50) }, 20);
    expect(below).toMatchObject({ valid: false, reason: "BELOW_MINIMUM" });
    expect(below.coupon?.minSubtotal).toBe(50);

    expect((await validate({ minSubtotal: null }, 20)).coupon?.minSubtotal).toBeNull();
  });
});
