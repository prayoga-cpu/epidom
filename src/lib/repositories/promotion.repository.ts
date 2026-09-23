import { Prisma, type Coupon, type DiscountPreset } from "@prisma/client";
import { BaseRepository } from "./base.repository";

/**
 * Promotion Repository — discount presets and coupons.
 *
 * Same layering as supplier.repository.ts: data access only, every read scoped
 * to `storeId`. Amounts come back as Prisma Decimals; the service turns them
 * into plain numbers (they are LITERAL in the store's display currency).
 */
export class PromotionRepository extends BaseRepository {
  // ─── Discount presets ──────────────────────────────────────────────────────

  async listPresets(storeId: string, includeInactive: boolean): Promise<DiscountPreset[]> {
    return this.db.discountPreset.findMany({
      where: { storeId, ...(!includeInactive && { isActive: true }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findPresetById(storeId: string, presetId: string): Promise<DiscountPreset | null> {
    return this.db.discountPreset.findFirst({ where: { id: presetId, storeId } });
  }

  /** The next free `sortOrder`, so a new preset lands at the end of the list. */
  async nextPresetSortOrder(storeId: string): Promise<number> {
    const agg = await this.db.discountPreset.aggregate({
      where: { storeId },
      _max: { sortOrder: true },
    });
    return (agg._max.sortOrder ?? -1) + 1;
  }

  async createPreset(data: Prisma.DiscountPresetUncheckedCreateInput): Promise<DiscountPreset> {
    return this.db.discountPreset.create({ data });
  }

  async updatePreset(
    presetId: string,
    data: Prisma.DiscountPresetUncheckedUpdateInput
  ): Promise<DiscountPreset> {
    return this.db.discountPreset.update({ where: { id: presetId }, data });
  }

  /** Hard delete: orders only ever froze an amount + a reason string, never a FK to a preset. */
  async deletePreset(presetId: string): Promise<DiscountPreset> {
    return this.db.discountPreset.delete({ where: { id: presetId } });
  }

  // ─── Coupons ───────────────────────────────────────────────────────────────

  async listCoupons(storeId: string): Promise<Coupon[]> {
    return this.db.coupon.findMany({
      where: { storeId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async findCouponById(storeId: string, couponId: string): Promise<Coupon | null> {
    return this.db.coupon.findFirst({ where: { id: couponId, storeId } });
  }

  /** `code` must already be uppercase — codes are stored that way. */
  async findCouponByCode(storeId: string, code: string): Promise<Coupon | null> {
    return this.db.coupon.findFirst({ where: { storeId, code } });
  }

  async createCoupon(data: Prisma.CouponUncheckedCreateInput): Promise<Coupon> {
    return this.db.coupon.create({ data });
  }

  async updateCoupon(couponId: string, data: Prisma.CouponUncheckedUpdateInput): Promise<Coupon> {
    return this.db.coupon.update({ where: { id: couponId }, data });
  }
}

export const promotionRepository = new PromotionRepository();
