import { Prisma, type Coupon, type DiscountPreset } from "@prisma/client";
import { promotionRepository, PromotionRepository } from "@/lib/repositories/promotion.repository";
import { NotFoundError } from "@/lib/errors";
import { FieldConflictError, FieldError } from "@/lib/errors/field-error";
import { checkCouponEligibility, computeRuleDiscount } from "@/lib/finance/discounts";
import {
  discountValueError,
  type CreateCouponInput,
  type UpdateCouponInput,
  type UpdateDiscountPresetInput,
  type UpsertDiscountPresetInput,
  type ValidateCouponInput,
} from "@/lib/validation/promotions.schemas";
import type { CouponDto, CouponValidationDto, DiscountPresetDto } from "@/types/api/cashier";

/**
 * Promotion Service — discount presets and coupons (OPERATIONS tier; the plan
 * gate is enforced on the routes, see requirePromotionsPlanApi).
 *
 * Amounts are LITERAL in the store's display currency and are stored as-is —
 * a FIXED 5 in a EUR store is 5 EUR, never IDR-converted.
 */

export function toPresetDto(p: DiscountPreset): DiscountPresetDto {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    value: Number(p.value),
    isActive: p.isActive,
    sortOrder: p.sortOrder,
  };
}

export function toCouponDto(c: Coupon): CouponDto {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    type: c.type,
    value: Number(c.value),
    minSubtotal: c.minSubtotal == null ? null : Number(c.minSubtotal),
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    validFrom: c.validFrom ? c.validFrom.toISOString() : null,
    validUntil: c.validUntil ? c.validUntil.toISOString() : null,
    isActive: c.isActive,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const DUPLICATE_CODE = "A coupon with this code already exists";

export class PromotionService {
  constructor(private readonly repo: PromotionRepository = promotionRepository) {}

  // ─── Discount presets ──────────────────────────────────────────────────────

  async listPresets(storeId: string, includeInactive = false): Promise<DiscountPresetDto[]> {
    return (await this.repo.listPresets(storeId, includeInactive)).map(toPresetDto);
  }

  async createPreset(
    storeId: string,
    input: UpsertDiscountPresetInput
  ): Promise<DiscountPresetDto> {
    const created = await this.repo.createPreset({
      storeId,
      name: input.name,
      type: input.type,
      value: input.value,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? (await this.repo.nextPresetSortOrder(storeId)),
    });
    return toPresetDto(created);
  }

  async updatePreset(
    storeId: string,
    presetId: string,
    input: UpdateDiscountPresetInput
  ): Promise<DiscountPresetDto> {
    const existing = await this.repo.findPresetById(storeId, presetId);
    if (!existing) throw new NotFoundError("Discount preset");

    // The schema can only cross-check type against value when BOTH arrive; a
    // body with just one has to be checked against the stored other half.
    if (input.type !== undefined || input.value !== undefined) {
      const problem = discountValueError(
        input.type ?? existing.type,
        input.value ?? Number(existing.value)
      );
      if (problem) throw new FieldError("value", problem);
    }

    const updated = await this.repo.updatePreset(presetId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    });
    return toPresetDto(updated);
  }

  async deletePreset(storeId: string, presetId: string): Promise<void> {
    const existing = await this.repo.findPresetById(storeId, presetId);
    if (!existing) throw new NotFoundError("Discount preset");
    await this.repo.deletePreset(presetId);
  }

  // ─── Coupons ───────────────────────────────────────────────────────────────

  async listCoupons(storeId: string): Promise<CouponDto[]> {
    return (await this.repo.listCoupons(storeId)).map(toCouponDto);
  }

  async createCoupon(storeId: string, input: CreateCouponInput): Promise<CouponDto> {
    if (await this.repo.findCouponByCode(storeId, input.code)) {
      throw new FieldConflictError("code", DUPLICATE_CODE);
    }

    try {
      const created = await this.repo.createCoupon({
        storeId,
        code: input.code,
        name: input.name ?? null,
        type: input.type,
        value: input.value,
        minSubtotal: input.minSubtotal ?? null,
        maxUses: input.maxUses ?? null,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        isActive: input.isActive ?? true,
      });
      return toCouponDto(created);
    } catch (error) {
      // Lost a race with another till creating the same code.
      if (isUniqueViolation(error)) throw new FieldConflictError("code", DUPLICATE_CODE);
      throw error;
    }
  }

  async updateCoupon(
    storeId: string,
    couponId: string,
    input: UpdateCouponInput
  ): Promise<CouponDto> {
    const existing = await this.repo.findCouponById(storeId, couponId);
    if (!existing) throw new NotFoundError("Coupon");

    if (input.type !== undefined || input.value !== undefined) {
      const problem = discountValueError(
        input.type ?? existing.type,
        input.value ?? Number(existing.value)
      );
      if (problem) throw new FieldError("value", problem);
    }

    // Same partial-body problem for the validity window: the schema only sees
    // the dates present in THIS request.
    const from = input.validFrom !== undefined ? input.validFrom : existing.validFrom;
    const until = input.validUntil !== undefined ? input.validUntil : existing.validUntil;
    if (from && until && until <= from) {
      throw new FieldError("validUntil", "The end date must be after the start date");
    }

    const updated = await this.repo.updateCoupon(couponId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.value !== undefined && { value: input.value }),
      ...(input.minSubtotal !== undefined && { minSubtotal: input.minSubtotal }),
      ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
      ...(input.validFrom !== undefined && { validFrom: input.validFrom }),
      ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
    return toCouponDto(updated);
  }

  /**
   * The cart's "does this code work, and for how much" check. Always resolves
   * (never throws for a business reason) so the route can answer HTTP 200 with
   * `valid: false` — a wrong code is an ordinary till event, not a failure.
   *
   * Advisory only: the order transaction re-enforces `usedCount < maxUses`
   * atomically, since two tills can race for the last use.
   */
  async validateCoupon(storeId: string, input: ValidateCouponInput): Promise<CouponValidationDto> {
    const coupon = await this.repo.findCouponByCode(storeId, input.code);
    if (!coupon) return { valid: false, reason: "NOT_FOUND" };

    // minSubtotal rides along so the cart can drop the coupon if the bill later
    // shrinks below it (the order re-checks at checkout regardless).
    const info = {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      type: coupon.type,
      value: Number(coupon.value),
      minSubtotal: coupon.minSubtotal == null ? null : Number(coupon.minSubtotal),
    };

    const reason = checkCouponEligibility(
      {
        isActive: coupon.isActive,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        minSubtotal: coupon.minSubtotal == null ? null : Number(coupon.minSubtotal),
      },
      input.itemsTotal
    );
    if (reason) return { valid: false, reason, coupon: info };

    return {
      valid: true,
      coupon: info,
      discountAmount: computeRuleDiscount(
        { type: coupon.type, value: Number(coupon.value) },
        input.itemsTotal
      ),
    };
  }
}

export const promotionService = new PromotionService();
